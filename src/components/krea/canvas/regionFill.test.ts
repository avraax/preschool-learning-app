import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GREY_REJECT, UNFILLABLE, greyShare, labelRegions } from './regionLabel.ts'
import { allFilled, decodeLabels, deserialiseFills, fillsOf, paintRegion, regionAt, serialiseFills, unfilled, type FillAction } from './regionFill.ts'

/** A 40×40 white page: an outer frame, split by a vertical line into two boxes, plus a 2×2 speck. */
function page(): { lum: Uint8Array; w: number; h: number } {
  const w = 40, h = 40
  const lum = new Uint8Array(w * h).fill(255)
  const black = (x: number, y: number) => { lum[y * w + x] = 0 }
  for (let i = 4; i <= 35; i++) { black(i, 4); black(i, 35); black(4, i); black(35, i); black(20, i) }
  // A tiny closed cell inside the left box: its inside (2×2) is a speck no finger can hit.
  for (let i = 8; i <= 11; i++) { black(i, 8); black(i, 11); black(8, i); black(11, i) }
  return { lum, w, h }
}

test('labelling: two regions, the speck is unfillable, the outside is dropped', () => {
  const { lum, w, h } = page()
  const m = labelRegions(lum, w, h, { minArea: 10, outside: 'drop' })
  assert.equal(m.count, 2)
  assert.equal(m.labels[0], UNFILLABLE, 'outside is not paper you colour')
  assert.equal(m.labels[9 * w + 9], UNFILLABLE, 'the speck is merged away')
  assert.equal(m.labels[4 * w + 10], 0, 'a line pixel is 0')
  const left = m.labels[20 * w + 12]
  const right = m.labels[20 * w + 28]
  assert.ok(left >= 1 && right >= 1 && left !== right)
  // …and keeping the outside makes it a third region.
  assert.equal(labelRegions(lum, w, h, { minArea: 10, outside: 'keep' }).count, 3)
})

test('a one-pixel diagonal gap in a line does NOT join two regions (4-connected)', () => {
  const w = 10, h = 10
  const lum = new Uint8Array(w * h).fill(255)
  // A diagonal line: pixels touch only at corners, so 8-connectivity would leak across it.
  for (let i = 0; i < 10; i++) lum[i * w + i] = 0
  assert.equal(labelRegions(lum, w, h, { minArea: 1, outside: 'keep' }).count, 2)
})

test('grey shading is REJECTED, clean anti-aliased line art is not', () => {
  const { lum, w, h } = page()
  // Anti-aliasing: mid-grey right beside the lines is normal and must not count.
  for (let i = 5; i <= 34; i++) lum[i * w + 21] = 150
  assert.ok(greyShare(lum, w, h) <= GREY_REJECT)
  // Shading: a mid-grey wash across the right box, away from any line.
  for (let y = 8; y <= 31; y++) for (let x = 24; x <= 31; x++) lum[y * w + x] = 140
  assert.ok(greyShare(lum, w, h) > GREY_REJECT)
})

test('a fill touches ONLY its own region’s pixels', () => {
  const { lum, w, h } = page()
  const m = labelRegions(lum, w, h, { minArea: 10, outside: 'drop' })
  const id = m.labels[20 * w + 12]
  const box = m.boxes[id - 1]
  const bw = box[2] - box[0] + 1
  const bh = box[3] - box[1] + 1
  const out = new Uint8ClampedArray(bw * bh * 4)
  paintRegion(out, m.labels, w, box, id, [10, 20, 30])
  let painted = 0
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const on = out[(y * bw + x) * 4 + 3] === 255
      const mine = m.labels[(y + box[1]) * w + x + box[0]] === id
      assert.equal(on, mine, `pixel ${x + box[0]},${y + box[1]}`)
      if (on) painted++
    }
  assert.equal(painted, m.areas[id - 1])
  // The eraser clears it again.
  paintRegion(out, m.labels, w, box, id, null)
  assert.ok(out.every((v, i) => i % 4 !== 3 || v === 0))
})

test('a tap on a line resolves to the nearest region; on paper you cannot colour, to nothing', () => {
  const { lum, w, h } = page()
  const m = labelRegions(lum, w, h, { minArea: 10, outside: 'drop' })
  assert.equal(regionAt(m.labels, w, h, 21, 20, 3), m.labels[20 * w + 22], 'just right of the divider')
  assert.equal(regionAt(m.labels, w, h, 1, 1, 3), 0, 'outside')
  assert.equal(regionAt(m.labels, w, h, 9.5, 9.5, 3), 0, 'the speck')
})

test('the label PNG round-trips ids in R + G×256', () => {
  const rgba = new Uint8Array([7, 0, 0, 255, 0x2c, 0x01, 0, 255, 255, 255, 0, 255])
  assert.deepEqual([...decodeLabels(rgba)], [7, 300, UNFILLABLE])
})

test('fills are actions: undo = drop the last, any colour counts, resume drops junk', () => {
  const a: FillAction[] = [[1, 'roed'], [2, 'hvid'], [1, 'blaa']]
  assert.deepEqual([...fillsOf(a)], [[1, 'blaa'], [2, 'hvid']])
  assert.equal(allFilled(a, 2), true, 'white counts as a fill')
  assert.equal(allFilled([...a, [2, null]], 2), false, 'the eraser un-fills')
  assert.deepEqual(unfilled([[2, 'gul']], 3), [1, 3])
  assert.deepEqual(deserialiseFills(serialiseFills(a), 2), a)
  assert.deepEqual(deserialiseFills('{"v":1,"a":[[1,"roed"],[9,"roed"],[2,"lilla?"],"x",[2,null]]}', 2), [[1, 'roed'], [2, null]])
  assert.deepEqual(deserialiseFills('not json', 2), [])
})
