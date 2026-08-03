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
import { readdir, mkdir, stat } from 'node:fs/promises'
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
const REWARD_KEY_OVERRIDES = {
  'natur-blad': { vivid: 150, faint: 110, despill: 90 },
  // Reward Horizon chapters 6-8: the puzzle has a genuinely GREEN piece. Measured interior
  // green-excess maxes at 80 (6473 px above 60) against a screen at 201 — so the same window as the
  // leaf works. Without it the despill flattens g to max(r,b) on anything greener than ~8 and the
  // piece comes out GREY with a perfect silhouette, which every shape-based check passes.
  'leg-puslespil': { vivid: 150, faint: 110, despill: 90 },
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
}

// Section icons (theme-constant, used app-wide). Magenta-keyed cutouts.
const ICON_ROLES = ['alphabet', 'math', 'colors', 'english', 'ordleg']

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
  const { size, fill, vivid = UI_VIVID, faint = UI_FAINT, despill = UI_DESPILL, quality = 90 } = opts
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
  const push = (q) => {
    if (!clear[q] && excess[q] > faint) {
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
  if (!(await stat(join(SRC_ROOT, id)).then((s) => s.isDirectory()).catch(() => false))) continue
  await optimizeTheme(id)
}
console.log('\nDone.')
