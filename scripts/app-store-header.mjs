// `npm run header:build` — compose the App Store "Header and Search Results" image from the app's own art.
//
// One UNIVERSAL asset: 16:9, 5244x2950, PNG, NO alpha (Apple rejects transparency). Apple crops it two
// ways, so everything that matters sits in the intersection of both crops:
//   product page header  21:9 → the middle 5244x2247 (≈352 px lost top and bottom)
//   search results        3:2 → the middle 4425x2950 (≈410 px lost left and right)
// `--crops` also writes both crops next to the output so they can be eyeballed before uploading.
//
// It is built from shipped art, never new art: the store must show the app the child gets. The world is
// the default skin's (Dinosaurer, `defaultThemeId`), the mascot waves, and the five section icons float
// in an arc — one per section, in menu order. If the default skin or a section changes, re-run this and
// `npm run header:upload`. See docs/app-store/listing.md §2.4.
import sharp from 'sharp'

const OUT = 'docs/app-store/header/header-universal.png'
const W = 5244, H = 2950
const WORLD = 'src/assets/themes/dino/'
const ICONS = ['alphabet', 'math', 'colors', 'english', 'ordleg'].map((n) => `src/assets/themes/icons/${n}.webp`)

// Icon centres on an arc above the mascot, all inside both crops (x 410..4834, y 352..2598).
const ICON = 660
const ARC = [[1020, 1600], [1560, 990], [2622, 770], [3684, 990], [4224, 1600]]
const MASCOT_H = 1350, FEET_Y = 2490

const fit = (f) => sharp(f).resize(W, H, { fit: 'cover', kernel: 'lanczos3' }).toBuffer()
const svg = (s) => Buffer.from(s)

// A soft white halo behind each icon so it reads against both the pale sky and the green hills.
const R = ICON * 0.8
const halo = svg(`<svg width="${R * 2}" height="${R * 2}"><defs><radialGradient id="g">
  <stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.6"/>
  <stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <circle cx="${R}" cy="${R}" r="${R}" fill="url(#g)"/></svg>`)
const shadow = svg(`<svg width="900" height="200"><defs><radialGradient id="s">
  <stop offset="0" stop-color="#1d2a10" stop-opacity="0.45"/><stop offset="1" stop-color="#1d2a10" stop-opacity="0"/>
  </radialGradient></defs><ellipse cx="450" cy="100" rx="450" ry="100" fill="url(#s)"/></svg>`)

const layers = [{ input: await fit(WORLD + 'scene-near.webp'), left: 0, top: 0 }]
for (let i = 0; i < ICONS.length; i++) {
  const [cx, cy] = ARC[i]
  layers.push({ input: halo, left: Math.round(cx - R), top: Math.round(cy - R) })
  layers.push({ input: await sharp(ICONS[i]).resize(ICON, ICON, { kernel: 'lanczos3' }).toBuffer(), left: cx - ICON / 2, top: cy - ICON / 2 })
}
const mascot = await sharp(WORLD + 'mascot-greet.webp').resize({ height: MASCOT_H, kernel: 'lanczos3' }).toBuffer()
const { width: mw } = await sharp(mascot).metadata()
layers.push({ input: shadow, left: W / 2 - 450, top: FEET_Y - 110 })
layers.push({ input: mascot, left: Math.round(W / 2 - mw / 2), top: FEET_Y - MASCOT_H })

await sharp(await fit(WORLD + 'scene-far.webp')).composite(layers).removeAlpha().png().toFile(OUT)
const m = await sharp(OUT).metadata()
if (m.width !== W || m.height !== H || m.hasAlpha) throw new Error(`bad output ${m.width}x${m.height} alpha=${m.hasAlpha}`)
console.log(`${OUT}  ${m.width}x${m.height}, no alpha`)

if (process.argv.includes('--crops')) {
  await sharp(OUT).extract({ left: 0, top: 352, width: W, height: 2247 }).resize(1600).png().toFile(OUT.replace('.png', '.crop-header-21x9.preview.png'))
  await sharp(OUT).extract({ left: 410, top: 0, width: 4425, height: H }).resize(900).png().toFile(OUT.replace('.png', '.crop-search-3x2.preview.png'))
  console.log('crop previews written next to it (*.preview.png — not committed)')
}
