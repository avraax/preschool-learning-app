// TEMP probe: locate the hard-edged artifact rect. Delete after use.
import sharp from 'sharp'
const [a, b] = process.argv.slice(2)
const load = async (p) => {
  const img = sharp(p)
  const { width, height } = await img.metadata()
  const data = await img.raw().toColourspace('srgb').removeAlpha().toBuffer()
  return { data, width, height }
}
const A = await load(a) // real
const B = await load(b) // snap
const { width: W } = A
const rowDiff = (y) => {
  const cols = []
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3
    cols.push((Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3)
  }
  return cols
}
for (const y of [745, 760, 780, 860]) {
  const c = rowDiff(y)
  // find contiguous runs where diff > 6
  const runs = []
  let s = -1
  for (let x = 0; x < W; x++) {
    if (c[x] > 6 && s < 0) s = x
    else if (c[x] <= 6 && s >= 0) { if (x - s > 12) runs.push([s, x]); s = -1 }
  }
  if (s >= 0) runs.push([s, W])
  console.log('y=' + y, 'runs:', JSON.stringify(runs))
}
