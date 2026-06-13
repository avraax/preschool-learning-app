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
// plus a light despill on magenta fringe pixels.
async function chromaKeyMagenta(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
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

const args = process.argv.slice(2)
const themes = args.length ? args : await readdir(SRC_ROOT)

for (const id of themes) {
  if (!(await stat(join(SRC_ROOT, id)).then((s) => s.isDirectory()).catch(() => false))) continue
  await optimizeTheme(id)
}
console.log('\nDone.')
