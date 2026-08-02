// TEMP probe (bug-report screenshot fidelity). Delete after use.
import sharp from 'sharp'

const [a, b, outPath] = process.argv.slice(2)
const load = async (p) => {
  const img = sharp(p)
  const { width, height } = await img.metadata()
  const data = await img.raw().toColourspace('srgb').removeAlpha().toBuffer()
  return { data, width, height }
}
const A = await load(a)
const B = await load(b)
if (A.width !== B.width || A.height !== B.height) throw new Error('size mismatch')
const { width: W, height: H } = A
const diff = Buffer.alloc(W * H * 3)
// Coarse grid report: 16x12 cells, mean abs diff per cell
const CX = 16, CY = 12
const cells = Array.from({ length: CY }, () => new Array(CX).fill(0))
const counts = Array.from({ length: CY }, () => new Array(CX).fill(0))
let total = 0
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3
    const d = (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3
    total += d
    const v = Math.min(255, Math.round(d * 3))
    diff[i] = v; diff[i + 1] = v > 40 ? 0 : v; diff[i + 2] = v > 40 ? 0 : v
    const cy = Math.min(CY - 1, Math.floor((y / H) * CY)), cx = Math.min(CX - 1, Math.floor((x / W) * CX))
    cells[cy][cx] += d; counts[cy][cx]++
  }
}
await sharp(diff, { raw: { width: W, height: H, channels: 3 } }).png().toFile(outPath)
console.log('mean abs diff:', (total / (W * H)).toFixed(2))
console.log('cell grid (mean abs diff, 0-255), rows top->bottom:')
for (let y = 0; y < CY; y++) {
  console.log(
    String(Math.round((y / CY) * H)).padStart(4) + ' | ' +
    cells[y].map((s, x) => String(Math.round(s / counts[y][x])).padStart(4)).join('')
  )
}
console.log('       ' + Array.from({ length: CX }, (_, x) => String(Math.round((x / CX) * W)).padStart(4)).join(''))
