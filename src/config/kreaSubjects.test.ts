import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KREA_FAMILIES, KREA_SUBJECTS, MIRROR_AXIS } from './kreaSubjects.ts'
import { sampleShape, shapePath, mirrorShape } from './kreaShapes.ts'

test('v1 content: 3 subjects per family, 4 families, ids are letters only', () => {
  assert.equal(KREA_SUBJECTS.length, 12)
  for (const fam of KREA_FAMILIES) assert.equal(KREA_SUBJECTS.filter((s) => s.family === fam).length, 3, fam)
  assert.equal(new Set(KREA_SUBJECTS.map((s) => s.id)).size, 12)
  for (const s of KREA_SUBJECTS) assert.match(s.id, /^[a-z]+$/)
})

test('every subject simplifies to ≤ 6 steps, each a whole spoken sentence', () => {
  for (const s of KREA_SUBJECTS) {
    assert.ok(s.steps.length >= 3 && s.steps.length <= 6, `${s.id}: ${s.steps.length} steps`)
    for (const st of s.steps) {
      assert.match(st.line, /^Tegn .+\.$/, `${s.id}: "${st.line}"`)
      assert.ok(st.shapes.length > 0)
    }
    assert.match(s.doneLine, /^Se, .+!$/, s.id)
  }
})

test('the symmetric subjects have mirror steps, drawn on the left of the axis', () => {
  const mirrored = KREA_SUBJECTS.filter((s) => s.steps.some((st) => st.mirror)).map((s) => s.id)
  assert.deepEqual(mirrored.sort(), ['robot', 'slot', 'sommerfugl'])
  for (const s of KREA_SUBJECTS)
    for (const st of s.steps.filter((x) => x.mirror))
      for (const sh of st.shapes) {
        const pts = sampleShape(sh)
        for (let i = 0; i < pts.length; i += 2) assert.ok(pts[i] <= MIRROR_AXIS + 1, `${s.id}: mirror shape crosses the axis`)
      }
})

test('every guide lies inside the subject box and renders as a path', () => {
  for (const s of KREA_SUBJECTS)
    for (const st of s.steps)
      for (const sh of st.shapes) {
        const pts = sampleShape(sh)
        for (const v of pts) assert.ok(v >= 0 && v <= 1000, `${s.id}: ${v} outside the box`)
        assert.match(shapePath(sh), /^M [\d.-]+ [\d.-]+ /)
        assert.match(shapePath(mirrorShape(sh, MIRROR_AXIS)), /^M /)
      }
})

test('a circle is sampled about every 8 units, all the way round', () => {
  const pts = sampleShape({ kind: 'circle', cx: 500, cy: 500, r: 100 })
  const n = pts.length / 2
  assert.ok(n >= 75 && n <= 85, String(n))
  assert.ok(Math.abs(pts[0] - pts[pts.length - 2]) < 0.01)
})
