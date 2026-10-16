// Optimize raw world art (art-src/<id>/*.png) → bundled WebP (src/assets/themes/<id>/*.webp).
//
// Theme Worlds asset pipeline (PRD §5.2 / §7): resize each asset for iPad, encode to WebP
// (alpha preserved), report the per-theme total against the ≤700KB budget. Re-run after
// swapping raw art.
//
//   node scripts/optimize-theme-art.mjs            # all themes under art-src/
//   node scripts/optimize-theme-art.mjs ocean      # just one theme
//
// Transparency note: AI generators (Gemini) often bake a fake checkerboard into "transparent"
// images instead of a real alpha channel. The reliable workflow is to generate cutout subjects
// (mascots) on a SOLID MAGENTA (#FF00FF) background and chroma-key it out here. Full SCENE
// backdrops are opaque and need no keying.

import sharp from 'sharp'
import { readdir, mkdir, stat, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_ROOT = join(ROOT, 'art-src')
const OUT_ROOT = join(ROOT, 'src', 'assets', 'themes')
const BUDGET_KB = 700

// Math symbol tiles (Game-Page Rework PRD §C/A6) — theme-CONSTANT soft-3D operator glyphs,
// magenta-keyed cutouts, output to src/assets/symbols/. Generated on solid #FF00FF like the
// mascots/icons. Filenames are safe ASCII (the registry maps each to its operator char).
const SYMBOL_OUT = join(ROOT, 'src', 'assets', 'symbols')
const SYMBOL_WIDTH = 160
const SYMBOL_QUALITY = 90

// UI symbols (de-emoji PRD-01 W3) — theme-CONSTANT chrome glyphs, GREEN-screen keyed
// (see greenKeySprite; the UI_* hysteresis values are the shared defaults for every green batch).
const UI_OUT = join(ROOT, 'src', 'assets', 'ui')
const UI_SIZE = 192 // renders at ≤67px CSS; covers a 3× iPad DPR
const UI_FILL = 0.81 // matches src/assets/themes/icons/*.webp
const UI_VIVID = 60 // flood-fill seed: unmistakable screen green
const UI_FAINT = 18 // grow: the darkened green under the render's baked contact shadow
const UI_DESPILL = 8

// Child-profile avatars (de-emoji PRD-01) — soft-3D animal portraits on the same green screen.
// The biggest render is ProfilePicker's 64px circle, so 192px covers a 3× iPad DPR.
// `frog` and `turtle` are the two subjects sharing the screen's hue, but the measured gap is wide
// (subject max green-excess 16 and 2, vs screen 134 and 141), so the shared hysteresis values clear
// them without needing a per-image exemption — no faint-grow skip required.
const AVATAR_OUT = join(ROOT, 'src', 'assets', 'avatars')
const AVATAR_SIZE = 192
const AVATAR_FILL = 0.94 // fuller than the icons: these sit INSIDE a circular badge that crops corners

// Reward Book art (Reward Book PRD-01 §6 / de-emoji W6) — 45 subjects, one per slot on the path.
// TWO sources, which is the whole point of this pass:
//   * 16 are NEW green-screen renders in art-src/rewards/ → keyed like any other sprite;
//   * 29 already ship as approved, ALREADY-KEYED WebP in src/assets/games/ (a dog is a dog), so they
//     are only re-trimmed to the reward size. Re-keying them would be wrong — they have a real alpha
//     channel and no green screen left to remove.
const REWARD_OUT = join(ROOT, 'src', 'assets', 'rewards')
const REWARD_SIZE = 256
const REWARD_FILL = 0.88

// Per-image keying overrides for GREEN SUBJECTS (`.claude/rules/scene-assets.md`).
//
// `natur-blad` is a deep-green leaf: its body sits at green-excess ~40–80 while the screen is 180+.
// The shared defaults (vivid 60 / faint 18) therefore seed correctly but then GROW straight through
// the leaf and delete it — the first pass rendered a thin black streak. Raising both thresholds into
// the measured valley (~100–120, where the histogram is nearly empty) removes the screen and its
// contact shadow while leaving the leaf whole. Do NOT lower these to "match the others".
//
// `despill` matters just as much and is easier to miss: it flattens the green channel down to
// max(r,b) on any pixel greener than the threshold, which is right for a keying fringe and DESTRUCTIVE
// on a subject that is genuinely green. At the default 8 the leaf survived the fill and then came out
// grey — measured rgb(51,104,52) → rgb(52,53,52). So a green subject's despill must sit ABOVE its own
// green excess (the leaf's is ~52, tailing to ~80) and below the screen fringe's.
//
// `natur-regnbue` carries a green band too, but its arc keys and colours correctly on the defaults, so
// it deliberately has no entry — verified, not assumed.
// Farver objects (Game Depth PRD-01 W2) — art-src/farver/<art id>.{jpg,png} → src/assets/games/farver/.
// Size/fill match the shipped set (long side ≈ 512 px on a ~640 canvas). Every subject here has a
// green PART at least (stalks, leaves) or is green outright, so the UI defaults (faint 18 / despill 8)
// would eat the stalk or grey it — measure each file's green-excess histogram and set an override.
const FARVER_OUT = join(ROOT, 'src', 'assets', 'games', 'farver')
const FARVER_SIZE = 640
const FARVER_FILL = 0.8
const FARVER_KEY_OVERRIDES = {
  // Measured 2026-10-05 (green-excess histograms): screen 200+, baked contact shadow ~80..180.
  // Small green PART (stalk / leaf / stems) at ~0..40:
  tomato: { vivid: 150, faint: 70, despill: 60 },
  lemon: { vivid: 150, faint: 70, despill: 60 },
  plum: { vivid: 150, faint: 70, despill: 60 },
  lavender: { vivid: 150, faint: 70, despill: 60 },
  // Green SUBJECTS at ~20..60 (frog's belly reaches ~70): grow and despill stay above them, and
  // `darkScreenMax` takes the darkened-screen contact shadow whose excess overlaps the subject's.
  leaf: { vivid: 150, faint: 62, despill: 80, darkScreenMax: 9 },
  pea_pod: { vivid: 150, faint: 62, despill: 80, darkScreenMax: 9 },
  broccoli: { vivid: 150, faint: 62, despill: 80, darkScreenMax: 9 },
  frog: { vivid: 150, faint: 72, despill: 80, darkScreenMax: 4 },
  // No green anywhere in the subject — the UI defaults are right (explicit so nothing is unreviewed).
  water_drop: {},
  ladybug: {},
  umbrella_purple: {},
  butterfly_purple: {},
}

const REWARD_KEY_OVERRIDES = {
  'natur-blad': { vivid: 150, faint: 110, despill: 90 },
  // Reward Horizon chapters 6-8: the puzzle has a genuinely GREEN piece. Measured interior
  // green-excess maxes at 80 (6473 px above 60) against a screen at 201 — so the same window as the
  // leaf works. Without it the despill flattens g to max(r,b) on anything greener than ~8 and the
  // piece comes out GREY with a perfect silhouette, which every shape-based check passes.
  'leg-puslespil': { vivid: 150, faint: 110, despill: 90 },
  // Same again for the xylophone's green BAR: interior green-excess maxes at 83 (571 px above 60)
  // against a screen at 204, so the window between subject and screen is wide and the leaf's numbers
  // fit. A green subject is now 3-for-3 on needing this — assume it for anything with a green part.
  'leg-xylofon': { vivid: 150, faint: 110, despill: 90 },
  // Reward Pacing chapter 9: the glasses are MINT GREEN, and on the shared defaults they vanished
  // COMPLETELY — the keyed output was 0.2 KB of nothing, the most total version of this failure so
  // far (the leaf came out as a streak, the xylophone bar came out grey). Measured histogram: the
  // frames sit at green-excess 40..125 with the bulk at 60..79, the screen at 140..155, and a real
  // valley at 105..125 (~1.4-2.5k px per 5-wide bin vs 345k at 145). Hence vivid 140 / faint 126.
  // `despill` must clear the subject's own maximum (125) or the mint flattens to grey — same trap as
  // the xylophone. A green subject is now 4-for-4 on needing an entry here; assume it.
  //
  // NB the raised window also lets the ✦ download watermark survive the flood-fill (it keys away
  // normally, its excess being above the default faint of 18). This file's existing largest-component
  // pass is what removes it — verified, because a hand-rolled key WITHOUT that pass left the sparkle in
  // and inflated the trim box to 823x574 instead of the frames' ~823x330.
  'toej-briller': { vivid: 140, faint: 126, despill: 126 },
}

// reward id → the shipped game asset to reuse. Kept HERE rather than in src/ because it is a
// build-time provenance record, not runtime data: after this pass the reward art stands on its own.
const REWARD_REUSE = {
  'dyr-hund': 'english/dog', 'dyr-kat': 'english/cat', 'dyr-ko': 'english/cow',
  'dyr-hest': 'english/horse', 'dyr-gris': 'english/pig', 'dyr-raev': 'ordleg/raev',
  'dyr-bjoern': 'english/bear',
  'kt-bil': 'english/car', 'kt-bus': 'ordleg/bus', 'kt-tog': 'ordleg/tog',
  'kt-lastbil': 'farver/truck',
  'mad-aeble': 'english/apple', 'mad-banan': 'english/banana', 'mad-jordbaer': 'farver/strawberry',
  'mad-gulerod': 'farver/carrot', 'mad-broed': 'english/bread', 'mad-ost': 'english/cheese',
  'mad-is': 'english/icecream', 'mad-kage': 'english/cake',
  'natur-trae': 'english/tree', 'natur-blomst': 'english/flower', 'natur-sol': 'english/sun',
  'natur-maane': 'english/moon', 'natur-stjerne': 'english/star', 'natur-sky': 'english/cloud',
  'hav-fisk': 'english/fish', 'hav-haj': 'ordleg/haj', 'hav-hval': 'farver/whale',
  'hav-skildpadde': 'farver/turtle',
  // Reward Horizon PRD-01 chapters 6-8. Same rule as above: check what already ships BEFORE
  // commissioning anything — a bed is a bed. 10 of the 27 new subjects were already baked, so the
  // owner draws 17. Deliberately NOT reused: `leg-bamse` (english/bear is already `dyr-bjoern`, and
  // two slots with identical art read as a bug) and `sk-hoene` (farver/chick is a chick, not a hen).
  'hj-seng': 'english/bed', 'hj-stol': 'english/chair', 'hj-doer': 'english/door',
  'hj-ur': 'ordleg/ur', 'hj-kop': 'english/cup', 'hj-noegle': 'english/key',
  'leg-bold': 'english/ball', 'leg-ballon': 'math/balloon',
  'sk-and': 'ordleg/and', 'sk-bi': 'ordleg/bi',
  // Reward Pacing PRD-01 chapter 9 (Tøj). Same check first: `ordleg/hat` is a bowler hat with a clear
  // BRIM, which is exactly what the PRD asked the hat render for (the brim is what keeps its silhouette
  // apart from the mitten's) — so the owner drew 8 of the 9, not 9.
  'toej-hat': 'ordleg/hat',
}

// Section icons (theme-constant, used app-wide). Magenta-keyed cutouts.
const ICON_ROLES = ['alphabet', 'math', 'colors', 'english', 'ordleg', 'krea']

// Max output width per role (px). Full scenes are sized for iPad; cutouts are smaller.
const ROLE_WIDTH = {
  scene: 1536, far: 1536, mid: 1536, near: 1536, thumb: 400, mascot: 560,
  bubble: 128, fish: 220, leaf: 200, butterfly: 200, star: 128, sprout: 160,
  ...Object.fromEntries(ICON_ROLES.map((r) => [r, 224])),
}
const DEFAULT_WIDTH = 512

const ROLE_QUALITY = {
  scene: 82, far: 82, mid: 82, near: 82, thumb: 82, mascot: 90,
  bubble: 86, fish: 90, leaf: 88, butterfly: 88, star: 86, sprout: 88,
  ...Object.fromEntries(ICON_ROLES.map((r) => [r, 90])),
}
const DEFAULT_QUALITY = 86

// Roles whose solid magenta background should be keyed to transparency.
const CHROMA_KEY_ROLES = new Set(['mascot', ...ICON_ROLES])

const kb = (bytes) => Math.round(bytes / 1024)

// Return a sharp pipeline with the solid magenta (#FF00FF) background removed to transparency,
// plus a light despill on magenta fringe pixels. `opts.clearBottomRight` (fractions of
// width/height) wipes a bottom-right corner box to transparent — used to erase the small
// Gemini "✦" decoration baked into the symbol art (the centred glyphs never reach that corner).
async function chromaKeyMagenta(srcPath, opts = {}) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const corner = opts.clearBottomRight
  const minX = corner ? Math.floor(width * (1 - corner.w)) : Infinity
  const minY = corner ? Math.floor(height * (1 - corner.h)) : Infinity
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r > 140 && b > 140 && g < 110) {
      data[i + 3] = 0 // core magenta → fully transparent
    } else if (r > 120 && b > 120 && g < 160 && Math.abs(r - b) < 70) {
      // magenta fringe → despill toward green so edges don't glow pink
      data[i] = Math.min(r, g + 30)
      data[i + 2] = Math.min(b, g + 30)
    }
    if (corner) {
      const px = i / channels
      const x = px % width
      const y = (px - x) / width
      if (x >= minX && y >= minY) data[i + 3] = 0 // wipe baked corner decoration
    }
  }
  return sharp(data, { raw: { width, height, channels } })
}

async function optimizeTheme(id) {
  const srcDir = join(SRC_ROOT, id)
  const outDir = join(OUT_ROOT, id)
  if (!existsSync(srcDir)) {
    console.error(`! no art-src/${id} — skipping`)
    return
  }
  await mkdir(outDir, { recursive: true })

  const files = (await readdir(srcDir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  let total = 0
  console.log(`\n=== ${id} ===`)
  for (const file of files) {
    const role = basename(file, extname(file)).toLowerCase()
    const width = ROLE_WIDTH[role] ?? DEFAULT_WIDTH
    const quality = ROLE_QUALITY[role] ?? DEFAULT_QUALITY
    const outPath = join(outDir, `${role}.webp`)
    const srcPath = join(srcDir, file)

    const pipeline = CHROMA_KEY_ROLES.has(role) ? await chromaKeyMagenta(srcPath) : sharp(srcPath)
    await pipeline.resize({ width, withoutEnlargement: true }).webp({ quality, effort: 6 }).toFile(outPath)

    const size = (await stat(outPath)).size
    total += size
    const keyed = CHROMA_KEY_ROLES.has(role) ? ' [magenta keyed]' : ''
    console.log(`  ${role.padEnd(8)} → ${role}.webp  ${String(kb(size)).padStart(4)} KB  (w${width} q${quality})${keyed}`)
  }
  const flag = kb(total) > BUDGET_KB ? `  ⚠ OVER ${BUDGET_KB}KB BUDGET` : '  ✓ within budget'
  console.log(`  ${'TOTAL'.padEnd(8)}   ${String(kb(total)).padStart(4)} KB${flag}`)
}

// Symbol tiles live outside the per-theme tree (one constant set), so they get their own pass:
// art-src/symbols/<name>.png → src/assets/symbols/<name>.webp (magenta-keyed, ~160px, q90).
async function optimizeSymbols() {
  const srcDir = join(SRC_ROOT, 'symbols')
  if (!existsSync(srcDir)) {
    console.error('! no art-src/symbols — skipping')
    return
  }
  await mkdir(SYMBOL_OUT, { recursive: true })
  const files = (await readdir(srcDir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  let total = 0
  console.log('\n=== symbols ===')
  for (const file of files) {
    const name = basename(file, extname(file)).toLowerCase()
    const outPath = join(SYMBOL_OUT, `${name}.webp`)
    // Erase the baked-in Gemini sparkle in the bottom-right corner (glyphs are centred).
    const pipeline = await chromaKeyMagenta(join(srcDir, file), { clearBottomRight: { w: 0.2, h: 0.26 } })
    await pipeline.resize({ width: SYMBOL_WIDTH, withoutEnlargement: true }).webp({ quality: SYMBOL_QUALITY, effort: 6 }).toFile(outPath)
    const size = (await stat(outPath)).size
    total += size
    console.log(`  ${name.padEnd(9)} → ${name}.webp  ${String(kb(size)).padStart(4)} KB [magenta keyed]`)
  }
  console.log(`  ${'TOTAL'.padEnd(9)}   ${String(kb(total)).padStart(4)} KB`)
}

// GREEN-screen sprite keying — the house pipeline from `.claude/rules/scene-assets.md`, shared by the
// UI symbols (de-emoji PRD-01 W3) and the child-profile avatars. Magenta is the OLDER convention
// (mascots / section icons / math symbols); everything generated since is on #00FF00.
//
// The core rule: key on green EXCESS (`g - max(r,b)`), never on "is it greenish" — a muted subject green
// (the sage frog, the olive turtle) shares the screen's HUE and a naive key eats it. Then:
//   1. hysteresis flood-fill from the border — seed through VIVID screen, GROW through FAINT green, so
//      the darkened green under the render's baked contact shadow goes too (a plain high-threshold fill
//      leaves a green crescent at the subject's base);
//   2. keep only the largest connected component, which drops Gemini's baked "✦" corner sparkle;
//   3. despill, trim, square-contain to `fill`, and centre on a transparent `size` square.
// The renders arrive as JPEG, so edges carry more chroma noise than a PNG would — hence the low despill
// threshold. Always verify a new batch composited over MAGENTA before wiring it.
async function greenKeySprite(srcPath, outPath, opts) {
  // `darkScreenMax` (opt-in): the baked contact shadow under a GREEN subject is the screen green
  // darkened — red and blue stay near 0 (measured under the frog: 0,28,2 / 4,37,1) — while the subject's
  // own darkest green keeps some red/blue (12,48,6). Its green-excess overlaps the subject's, so no
  // `faint` separates them; this lets the border flood also take pixels with max(r,b) ≤ darkScreenMax.
  // `keepAspect` (opt-in): output the trimmed subject at `size` px WIDE in its own aspect, instead of
  // contained in a transparent square — for wide strips (Fyld Båden's wave bands) and scene props whose
  // placement is measured against their real box.
  const { size, fill, vivid = UI_VIVID, faint = UI_FAINT, despill = UI_DESPILL, quality = 90, darkScreenMax = -1, keepAspect = false } = opts
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  const px = Buffer.from(data)
  const excess = new Int16Array(w * h)
  for (let q = 0; q < w * h; q++) {
    const i = q * c
    excess[q] = px[i + 1] - Math.max(px[i], px[i + 2])
  }

  // Hysteresis flood-fill from the border: seed through VIVID screen, grow through FAINT green.
  const clear = new Uint8Array(w * h)
  const stack = []
  const darkScreen = (q) =>
    darkScreenMax >= 0 && excess[q] > 10 && Math.max(px[q * c], px[q * c + 2]) <= darkScreenMax
  const push = (q) => {
    if (!clear[q] && (excess[q] > faint || darkScreen(q))) {
      clear[q] = 1
      stack.push(q)
    }
  }
  for (let x = 0; x < w; x++) {
    if (excess[x] > vivid) push(x)
    const b = (h - 1) * w + x
    if (excess[b] > vivid) push(b)
  }
  for (let y = 0; y < h; y++) {
    if (excess[y * w] > vivid) push(y * w)
    const r = y * w + w - 1
    if (excess[r] > vivid) push(r)
  }
  while (stack.length) {
    const q = stack.pop()
    const x = q % w
    const y = (q - x) / w
    if (x > 0) push(q - 1)
    if (x < w - 1) push(q + 1)
    if (y > 0) push(q - w)
    if (y < h - 1) push(q + w)
  }
  // Enclosed pockets the border fill can't reach (inside the trophy's handles, between the rabbit's
  // ears). Safe to take globally at the VIVID threshold: no subject in these batches is vivid green.
  for (let q = 0; q < w * h; q++) {
    if (clear[q] || excess[q] > vivid) px[q * c + 3] = 0
  }

  // Keep only the largest component — drops the Gemini "✦" watermark and any keying dust.
  const owner = new Int32Array(w * h).fill(-1)
  const comps = []
  for (let s = 0; s < w * h; s++) {
    if (owner[s] !== -1 || px[s * c + 3] <= 8) continue
    const id = comps.length
    const st = [s]
    owner[s] = id
    let n = 0
    while (st.length) {
      const q = st.pop()
      n++
      const x = q % w
      const y = (q - x) / w
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const nq = ny * w + nx
        if (owner[nq] === -1 && px[nq * c + 3] > 8) {
          owner[nq] = id
          st.push(nq)
        }
      }
    }
    comps.push({ id, n })
  }
  const biggest = comps.reduce((a, b) => (b.n > a.n ? b : a), comps[0])
  for (let q = 0; q < w * h; q++) {
    if (px[q * c + 3] !== 0 && owner[q] !== biggest.id) px[q * c + 3] = 0
  }

  // Despill, then trim + square-contain to the requested fill fraction.
  for (let q = 0; q < w * h; q++) {
    const i = q * c
    if (px[i + 3] === 0) continue
    const base = Math.max(px[i], px[i + 2])
    if (px[i + 1] - base > despill) px[i + 1] = base
  }
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let q = 0; q < w * h; q++) {
    if (px[q * c + 3] <= 24) continue
    const x = q % w
    const y = (q - x) / w
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (keepAspect) {
    await sharp(px, { raw: { width: w, height: h, channels: c } })
      .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
      .resize({ width: Math.min(size, maxX - minX + 1) })
      .webp({ quality, effort: 6 })
      .toFile(outPath)
    return
  }
  const inner = Math.round(size * fill)
  const subject = await sharp(px, { raw: { width: w, height: h, channels: c } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: subject, gravity: 'center' }])
    .webp({ quality, effort: 6 })
    .toFile(outPath)
}

// Fyld Båden (Harbour PRD-01) — art-src/harbour/<id>.jpg → src/assets/games/boat/<id>.webp, one spec per
// file (size = output px; props keep their own aspect so placement can be measured against the real box).
// The backdrop is OPAQUE (a full picture, not green screen): resized + WebP only, never keyed. The menu
// icon lands beside the other game icons at their 512² / 0.81 fill.
const HARBOUR_OUT = join(ROOT, 'src', 'assets', 'games', 'boat')
const HARBOUR_SPECS = {
  box: { size: 512, keepAspect: true },
  'boat-red': { size: 1400, keepAspect: true },
  // The yellow hull's shaded underside picks up green bounce light from the screen, and the default
  // `faint` grow ran straight through it — the whole yellow hull vanished on the defaults (measured).
  'boat-yellow': { size: 1400, keepAspect: true, faint: 60, vivid: 110, despill: 40 },
  'boat-navy': { size: 1400, keepAspect: true },
  'boat-paleblue': { size: 1400, keepAspect: true },
  jetty: { size: 1024, keepAspect: true },
  horn: { size: 320, keepAspect: true },
  // `periodic`: the renders don't tile as delivered (a seam every tile), and stretching ONE across the
  // screen squashed it to a third of its height (owner: "stretched and distorted"). So each is cut at a
  // whole number of its own wave periods and repeated at its natural proportions.
  'wave-near': { size: 1024, keepAspect: true, periodic: true },
  'wave-far': { size: 1024, keepAspect: true, periodic: true },
  splash: { size: 420, keepAspect: true },
  puff: { size: 256, keepAspect: true },
}
// Turn a keyed wave strip into a seamless tile by cutting it at a WHOLE NUMBER of its own wave periods:
// the period is found from the crest silhouette (each column's first opaque row), and the tile is the
// longest run of whole periods. No blending at all — the cross-fade below left a faint second crest every
// tile, which the owner saw as "double vision" (2026-10-14).
async function makePeriodicX(path) {
  const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  const prof = new Float64Array(w)
  for (let x = 0; x < w; x++) {
    let y = 0
    while (y < h && data[(y * w + x) * c + 3] < 128) y++
    prof[x] = y
  }
  let bestP = 0
  let bestErr = Infinity
  for (let p = Math.round(w * 0.08); p <= Math.round(w * 0.5); p++) {
    let err = 0
    for (let x = 0; x + p < w; x++) err += Math.abs(prof[x] - prof[x + p])
    err /= w - p
    if (err < bestErr) {
      bestErr = err
      bestP = p
    }
  }
  // The render is lit unevenly across its width, so a bare cut at k periods still showed a brightness
  // STEP at every join. Cut at k periods, then blend the first q columns with the q columns that follow
  // the cut — those are the SAME wave shapes one tile later, so only the lighting is evened out and no
  // ghost crest can appear (shape-aligned, unlike the old fixed-fraction cross-fade).
  const q = Math.round(bestP * 0.6)
  const k = Math.floor((w - q) / bestP)
  const tw = k * bestP
  const out = Buffer.alloc(tw * h * c)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < tw; x++) {
      const o = (y * tw + x) * c
      const a = (y * w + x) * c
      if (x >= q) {
        data.copy(out, o, a, a + c)
        continue
      }
      const b = (y * w + (tw + x)) * c
      const t = x / q
      const wa = (data[a + 3] / 255) * t
      const wb = (data[b + 3] / 255) * (1 - t)
      const sum = wa + wb
      for (let ch = 0; ch < 3; ch++) out[o + ch] = sum > 0 ? Math.round((data[a + ch] * wa + data[b + ch] * wb) / sum) : 0
      out[o + 3] = Math.round(data[b + 3] * (1 - t) + data[a + 3] * t)
    }
  }
  await writeFile(path, await sharp(out, { raw: { width: tw, height: h, channels: c } }).webp({ quality: 90, effort: 6 }).toBuffer())
  return { period: bestP, periods: k, err: bestErr.toFixed(2) }
}

// (kept for reference — superseded by makePeriodicX) Cross-fade a strip's ends into a seamless tile.
async function makeSeamlessX(path, frac) {
  // Read through a buffer: on Windows sharp keeps a handle on a path it read, and writing back to the
  // same path then fails ("unable to open for write").
  const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  const ov = Math.round(w * frac)
  const tw = w - ov
  const out = Buffer.alloc(tw * h * c)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < tw; x++) {
      const o = (y * tw + x) * c
      const a = (y * w + x) * c
      if (x >= ov) {
        data.copy(out, o, a, a + c)
        continue
      }
      const b = (y * w + (tw + x)) * c // the dropped tail, laid over the head
      const t = x / ov
      // Colour is weighted by ALPHA: a transparent pixel still carries the keyed screen's green RGB, and
      // a plain lerp let that green ghost into the blend (seen on wave-far).
      const wa = (data[a + 3] / 255) * t
      const wb = (data[b + 3] / 255) * (1 - t)
      const sum = wa + wb
      for (let k = 0; k < 3; k++) out[o + k] = sum > 0 ? Math.round((data[a + k] * wa + data[b + k] * wb) / sum) : 0
      out[o + 3] = Math.round(data[b + 3] * (1 - t) + data[a + 3] * t)
    }
  }
  const buf = await sharp(out, { raw: { width: tw, height: h, channels: c } }).webp({ quality: 90, effort: 6 }).toBuffer()
  await writeFile(path, buf)
}

async function optimizeHarbour() {
  const srcDir = join(SRC_ROOT, 'harbour')
  if (!existsSync(srcDir)) {
    console.error('! no art-src/harbour — skipping')
    return
  }
  await mkdir(HARBOUR_OUT, { recursive: true })
  console.log('\n=== harbour ===')
  let total = 0
  for (const [id, spec] of Object.entries(HARBOUR_SPECS)) {
    const src = (await readdir(srcDir)).find((f) => basename(f, extname(f)) === id)
    if (!src) {
      console.warn(`  ! ${id}: no source in art-src/harbour`)
      continue
    }
    const outPath = join(HARBOUR_OUT, `${id}.webp`)
    await greenKeySprite(join(srcDir, src), outPath, { fill: 1, ...spec })
    if (spec.periodic) console.log(`    periodic tile:`, await makePeriodicX(outPath))
    const kbs = kb((await stat(outPath)).size)
    total += kbs
    console.log(`  ${id.padEnd(14)} → ${id}.webp  ${String(kbs).padStart(4)} KB`)
  }
  const bd = (await readdir(srcDir)).find((f) => basename(f, extname(f)) === 'backdrop')
  if (bd) {
    const outPath = join(HARBOUR_OUT, 'backdrop.webp')
    await sharp(join(srcDir, bd)).webp({ quality: 86, effort: 6 }).toFile(outPath)
    const kbs = kb((await stat(outPath)).size)
    total += kbs
    console.log(`  ${'backdrop'.padEnd(14)} → backdrop.webp  ${String(kbs).padStart(4)} KB [opaque, not keyed]`)
  }
  const icon = (await readdir(srcDir)).find((f) => basename(f, extname(f)) === 'icon')
  if (icon) {
    const outPath = join(ROOT, 'src', 'assets', 'themes', 'icons', 'games', 'math.boat.webp')
    await greenKeySprite(join(srcDir, icon), outPath, { size: 512, fill: UI_FILL })
    console.log(`  ${'icon'.padEnd(14)} → icons/games/math.boat.webp  ${String(kb((await stat(outPath)).size)).padStart(4)} KB`)
  }
  console.log(`  ${'TOTAL'.padEnd(14)}   ${total} KB`)
}

// Krea (Krea PRD-01) — art-src/krea/<id>.jpg → src/assets/games/krea/<id>.webp. Squares trimmed onto
// the standard transparent canvas (`fill`), except the backdrop (OPAQUE passthrough, never keyed). The
// section icon is on the legacy MAGENTA screen like the other five; the tile icons land beside the
// other game icons at their 512² / 0.81 fill. `art-src/krea/pages/` (line art, W5) and `beads/` (PRD-02)
// are NOT processed here — they have their own pipelines.
const KREA_OUT = join(ROOT, 'src', 'assets', 'games', 'krea')
const KREA_CRAYONS = ['roed', 'orange', 'gul', 'lysegroen', 'groen', 'lyseblaa', 'blaa', 'lilla', 'lyseroed', 'brun', 'sort', 'hvid', 'rainbow']
const KREA_SPECS = {
  ...Object.fromEntries(KREA_CRAYONS.map((c) => [`crayon-${c}`, { size: 320, fill: 0.92, pointDownLeft: true }])),
  glitter: { size: 256, fill: 0.88 },
  stamp: { size: 256, fill: 0.88 },
  eraser: { size: 256, fill: 0.88 },
  paper: { size: 256, fill: 0.88 },
  undo: { size: 256, fill: 0.84 },
  done: { size: 320, fill: 0.96 },
  next: { size: 320, fill: 0.96 },
  pencil: { size: 256, fill: 0.92 },
}
// Green-on-green subjects, thresholds from each file's own green-excess histogram (scene-assets.md:
// measure, never eyeball). On the defaults (2026-10-16): the green crayon's WHOLE wax body was keyed
// away and only its paper wrapper survived (the largest component); the rainbow crayon lost both its
// striped ends; the done button's dark-green rim came out ragged. Subject green-excess sits ≤ ~80, the
// screen ~200, so the leaf's thresholds (vivid 150 / faint 110 / despill 90) separate them cleanly.
const GREEN_SUBJECT = { vivid: 150, faint: 110, despill: 90 }
const KREA_KEY_OVERRIDES = {
  // The bright grass-green re-render (pass 3): its wax measures green-excess 60–100, the screen 160–190,
  // so every threshold has to sit ABOVE the wax — the shared leaf values would despill it grey.
  // `faint` 105, not 130: at 130 the screen-tinted contact shadow at both ends survived as two little
  // green hooks, invisible on magenta and plain on the wood table.
  'crayon-groen': { vivid: 155, faint: 105, despill: 110, darkScreenMax: 40 },
  // `darkScreenMax`: the baked contact shadow under a green-screened crayon is the screen darkened
  // (red and blue near 0), and it survived as a dark smudge under the ends of the three greenish
  // crayons — plain on the wood table. The waxes keep red/blue well above 40, so they are untouched.
  'crayon-lysegroen': { ...GREEN_SUBJECT, darkScreenMax: 40 },
  'crayon-rainbow': { ...GREEN_SUBJECT, darkScreenMax: 30 },
  done: GREEN_SUBJECT,
}
const KREA_TILES = { 'icon-draw': 'krea.draw', 'icon-guide': 'krea.guide', 'icon-color': 'krea.color' }

async function optimizeKrea() {
  const srcDir = join(SRC_ROOT, 'krea')
  if (!existsSync(srcDir)) {
    console.error('! no art-src/krea — skipping')
    return
  }
  await mkdir(KREA_OUT, { recursive: true })
  const files = await readdir(srcDir)
  const find = (id) => files.find((f) => basename(f, extname(f)) === id)
  console.log('\n=== krea ===')
  for (const [id, spec] of Object.entries(KREA_SPECS)) {
    const src = find(id)
    if (!src) {
      console.warn(`  ! ${id}: no source in art-src/krea`)
      continue
    }
    const outPath = join(KREA_OUT, `${id}.webp`)
    await greenKeySprite(join(srcDir, src), outPath, { ...spec, ...KREA_KEY_OVERRIDES[id] })
    if (spec.pointDownLeft) {
      // House rule (owner, 2026-10-16): what the child HOLDS lies on the right and points DOWN-LEFT,
      // like a crayon in a right hand — the same way as the pencil and the crayon on the two drawing
      // tiles. The crayon renders point up-right, so they are turned half a turn here; at button size
      // the light coming from below instead of above does not read (checked on the wood backdrop).
      // Read into memory first: on Windows sharp keeps the file open, and writing back to the same path
      // fails with `open UNKNOWN`.
      const turned = await sharp(await readFile(outPath)).rotate(180).webp({ quality: 90, effort: 6 }).toBuffer()
      await writeFile(outPath, turned)
    }
    console.log(`  ${id.padEnd(16)} → ${id}.webp  ${String(kb((await stat(outPath)).size)).padStart(4)} KB${KREA_KEY_OVERRIDES[id] ? ' [override]' : ''}`)
  }
  const bd = find('backdrop')
  if (bd) {
    const outPath = join(KREA_OUT, 'backdrop.webp')
    await sharp(join(srcDir, bd)).webp({ quality: 86, effort: 6 }).toFile(outPath)
    console.log(`  ${'backdrop'.padEnd(16)} → backdrop.webp  ${String(kb((await stat(outPath)).size)).padStart(4)} KB [opaque, not keyed]`)
  }
  for (const [id, key] of Object.entries(KREA_TILES)) {
    const src = find(id)
    if (!src) continue
    const outPath = join(ROOT, 'src', 'assets', 'themes', 'icons', 'games', `${key}.webp`)
    await greenKeySprite(join(srcDir, src), outPath, { size: 512, fill: UI_FILL, ...KREA_KEY_OVERRIDES[id] })
    console.log(`  ${id.padEnd(16)} → icons/games/${key}.webp  ${String(kb((await stat(outPath)).size)).padStart(4)} KB`)
  }
  const sec = find('section-icon')
  if (sec) {
    // Matched to the five shipped section icons, which are 512² with their ink at 0.81 of the frame:
    // keyed straight to 224² the easel drew visibly SMALLER than the other objects on home (its ink is
    // a tall narrow easel inside a lot of empty magenta). So key, then trim onto the same square.
    const outPath = join(OUT_ROOT, 'icons', 'krea.webp')
    const tmp = join(KREA_OUT, '.section-icon.keyed.png')
    await (await chromaKeyMagenta(join(srcDir, sec))).png().toFile(tmp)
    await retrimSprite(tmp, outPath, { size: 512, fill: UI_FILL, quality: ROLE_QUALITY.krea })
    await (await import('node:fs/promises')).unlink(tmp)
    console.log(`  ${'section-icon'.padEnd(16)} → icons/krea.webp  ${String(kb((await stat(outPath)).size)).padStart(4)} KB [magenta keyed]`)
  }
}

// Run one green-screen batch: art-src/<dir>/<name>.{png,jpg} → <outDir>/<name>.webp.
async function optimizeGreenBatch(dir, outDir, opts) {
  const srcDir = join(SRC_ROOT, dir)
  if (!existsSync(srcDir)) {
    console.error(`! no art-src/${dir} — skipping`)
    return
  }
  await mkdir(outDir, { recursive: true })
  const files = (await readdir(srcDir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  let total = 0
  console.log(`\n=== ${dir} ===`)
  for (const file of files) {
    const name = basename(file, extname(file)).toLowerCase()
    const outPath = join(outDir, `${name}.webp`)
    await greenKeySprite(join(srcDir, file), outPath, opts)
    const size = (await stat(outPath)).size
    total += size
    console.log(`  ${name.padEnd(10)} → ${name}.webp  ${String(kb(size)).padStart(4)} KB [green keyed]`)
  }
  console.log(`  ${'TOTAL'.padEnd(10)}   ${String(kb(total)).padStart(4)} KB`)
}

// The chrome glyphs that carry meaning: trophy / flame / sparkle (star + book are REUSED from the
// game art, so they never pass through here).
const optimizeUi = () => optimizeGreenBatch('ui', UI_OUT, { size: UI_SIZE, fill: UI_FILL })

// Farver objects — one override per file (see FARVER_KEY_OVERRIDES). A file with no override is keyed
// on the UI defaults and LOGGED, so a green part can't be eaten silently.
async function optimizeFarver() {
  const srcDir = join(SRC_ROOT, 'farver')
  if (!existsSync(srcDir)) {
    console.error('! no art-src/farver — skipping')
    return
  }
  const files = (await readdir(srcDir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  console.log('\n=== farver ===')
  for (const file of files) {
    const name = basename(file, extname(file)).toLowerCase()
    const override = FARVER_KEY_OVERRIDES[name]
    if (!override) console.warn(`  ! ${name}: no FARVER_KEY_OVERRIDES entry — keyed on defaults, check its green parts`)
    const outPath = join(FARVER_OUT, `${name}.webp`)
    await greenKeySprite(join(srcDir, file), outPath, { size: FARVER_SIZE, fill: FARVER_FILL, ...override })
    console.log(`  ${name.padEnd(18)} → ${name}.webp  ${String(kb((await stat(outPath)).size)).padStart(4)} KB`)
  }
}

// The 12 child-profile avatar portraits.
const optimizeAvatars = () => optimizeGreenBatch('avatars', AVATAR_OUT, { size: AVATAR_SIZE, fill: AVATAR_FILL })

// Re-trim an ALREADY-KEYED WebP (real alpha, no green screen) onto the standard transparent square.
// Used for the 29 reused game subjects — same output shape as greenKeySprite, none of the keying.
async function retrimSprite(srcPath, outPath, { size, fill, quality = 90 }) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let q = 0; q < w * h; q++) {
    if (data[q * c + 3] <= 24) continue
    const x = q % w
    const y = (q - x) / w
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (maxX < 0) throw new Error(`${srcPath} is fully transparent`)
  const inner = Math.round(size * fill)
  const subject = await sharp(data, { raw: { width: w, height: h, channels: c } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: subject, gravity: 'center' }])
    .webp({ quality, effort: 6 })
    .toFile(outPath)
}

// The 45 Reward Book subjects: key the 16 new renders, re-trim the 29 reused ones.
async function optimizeRewards() {
  await mkdir(REWARD_OUT, { recursive: true })
  const opts = { size: REWARD_SIZE, fill: REWARD_FILL }
  let total = 0
  let keyed = 0
  let reused = 0
  console.log('\n=== rewards ===')

  const srcDir = join(SRC_ROOT, 'rewards')
  const newFiles = existsSync(srcDir)
    ? (await readdir(srcDir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    : []
  for (const file of newFiles) {
    const id = basename(file, extname(file)).toLowerCase()
    const outPath = join(REWARD_OUT, `${id}.webp`)
    await greenKeySprite(join(srcDir, file), outPath, { ...opts, ...REWARD_KEY_OVERRIDES[id] })
    total += (await stat(outPath)).size
    keyed++
  }

  for (const [id, rel] of Object.entries(REWARD_REUSE)) {
    const src = join(ROOT, 'src', 'assets', 'games', `${rel}.webp`)
    if (!existsSync(src)) {
      console.error(`  ! ${id}: missing reuse source ${rel}.webp`)
      continue
    }
    const outPath = join(REWARD_OUT, `${id}.webp`)
    await retrimSprite(src, outPath, opts)
    total += (await stat(outPath)).size
    reused++
  }

  const count = keyed + reused
  console.log(`  ${String(keyed).padStart(2)} keyed from art-src/rewards/`)
  console.log(`  ${String(reused).padStart(2)} re-trimmed from src/assets/games/`)
  console.log(`  ${String(count).padStart(2)} total   ${kb(total)} KB   (avg ${Math.round(kb(total) / Math.max(1, count))} KB)`)
}

const args = process.argv.slice(2)
const themes = args.length ? args : await readdir(SRC_ROOT)

for (const id of themes) {
  if (id === 'symbols') {
    await optimizeSymbols()
    continue
  }
  if (id === 'ui') {
    await optimizeUi()
    continue
  }
  if (id === 'avatars') {
    await optimizeAvatars()
    continue
  }
  if (id === 'rewards') {
    await optimizeRewards()
    continue
  }
  if (id === 'farver') {
    await optimizeFarver()
    continue
  }
  if (id === 'harbour') {
    await optimizeHarbour()
    continue
  }
  if (id === 'krea') {
    await optimizeKrea()
    continue
  }
  if (!(await stat(join(SRC_ROOT, id)).then((s) => s.isDirectory()).catch(() => false))) continue
  await optimizeTheme(id)
}
console.log('\nDone.')
