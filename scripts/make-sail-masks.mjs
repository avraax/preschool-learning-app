// Build a SAIL MASK per boat render: the cream sail cloth as alpha, so the number painted on a correct
// send only ever lands on cloth (Fyld Båden, owner 2026-10-16: the numeral sat half off the sail).
//
//   node scripts/make-sail-masks.mjs        → src/assets/games/boat/sail-mask-<look>.webp
//
// Cloth = bright, low-chroma, opaque pixels inside the sail's box (x 0.42–0.56, y < 0.6 of the render —
// the paleblue hull is light enough to match without the box). Feathered 1.5 px so the paint's edge is
// soft like a real painted sail, and eroded a touch so no ink sits right on the cloth's outline.
import sharp from 'sharp'

for (const look of ['red', 'yellow', 'navy', 'paleblue']) {
  const src = `src/assets/games/boat/boat-${look}.webp`
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const m = Buffer.alloc(W * H)
  for (let y = 0; y < H * 0.6; y++)
    for (let x = Math.floor(W * 0.42); x < W * 0.56; x++) {
      const i = (y * W + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      const mn = Math.min(r, g, b), mx = Math.max(r, g, b)
      // cream cloth: never bluer than it is red (the paleblue boat's pale mast top is otherwise "cloth")
      if (a > 200 && mn > 150 && mx - mn < 60 && r >= b) m[y * W + x] = 255
    }
  const rgba = Buffer.alloc(W * H * 4, 255)
  for (let p = 0; p < W * H; p++) rgba[p * 4 + 3] = m[p]
  const out = `src/assets/games/boat/sail-mask-${look}.webp`
  // erode (min filter via a negated dilate) then feather
  const alpha = await sharp(m, { raw: { width: W, height: H, channels: 1 } }).negate().dilate(2).negate().blur(1.5).extractChannel(0).raw().toBuffer()
  // sharp's single-channel negate/dilate round-trip comes back inverted — flip it back to cloth = opaque.
  for (let p = 0; p < W * H; p++) rgba[p * 4 + 3] = 255 - alpha[p]
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ lossless: true }).toFile(out)
  console.log('  ', out)
}
