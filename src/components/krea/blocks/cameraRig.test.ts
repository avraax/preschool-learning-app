import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMERA,
  cameraPosition,
  canZoom,
  dragTurn,
  fitBox,
  fitDistance,
  horizontalRelation,
  lerpPose,
  pinchZoom,
  towardsCamera,
  zoomBy,
  type Pose,
} from './cameraRig.ts'

const home: Pose = CAMERA.home

test('tilt is held between low and high — never under the island, never straight down', () => {
  assert.equal(dragTurn(home, 0, 100000).tilt, CAMERA.tiltMax)
  assert.equal(dragTurn(home, 0, -100000).tilt, CAMERA.tiltMin)
  assert.ok(CAMERA.tiltMin > 0, 'the floor is above the horizon')
  assert.ok(CAMERA.tiltMax < Math.PI / 2)
})

test('zoom is clamped between a fixed min and max, by buttons and by pinch alike', () => {
  let p = home
  for (let i = 0; i < 20; i++) p = zoomBy(p, 1)
  assert.equal(p.zoom, CAMERA.zoomMin)
  assert.equal(canZoom(p, 1), false)
  assert.equal(canZoom(p, -1), true)
  for (let i = 0; i < 40; i++) p = zoomBy(p, -1)
  assert.equal(p.zoom, CAMERA.zoomMax)
  assert.equal(pinchZoom(home, 50).zoom, CAMERA.zoomMin)
  assert.equal(pinchZoom(home, 0.01).zoom, CAMERA.zoomMax)
  assert.ok(Math.abs(pinchZoom(home, 1).zoom - home.zoom) < 1e-9, 'fingers still = no change')
})

test('a step eases the short way round and ends exactly on the target', () => {
  const a = { ...home, azimuth: Math.PI * 0.9 }
  const b = { ...home, azimuth: -Math.PI * 0.9 }
  const mid = lerpPose(a, b, 0.5)
  assert.ok(Math.abs(Math.cos(mid.azimuth) + 1) < 1e-9, 'went through π, not through 0')
  const end = lerpPose(a, b, 1)
  assert.ok(Math.abs(Math.cos(end.azimuth - b.azimuth) - 1) < 1e-9)
})

// §4.13: zoom is a multiple of the FIT distance, so the island fills a wide stage and a tall one alike.
test('the fit distance holds the island on both axes — a narrow stage backs the camera off', () => {
  const wide = fitDistance(5, 1.6)
  const tall = fitDistance(5, 0.6)
  assert.ok(tall > wide, 'portrait (width binds) needs more distance')
  assert.ok(Math.abs(fitDistance(5, 1.6) / fitDistance(10, 1.6) - 0.5) < 1e-9, 'linear in the radius')
  // The camera sits on that distance from the target.
  const c = cameraPosition(home, { x: 0, y: 0, z: 0 }, wide)
  assert.ok(Math.abs(Math.hypot(c.x, c.y, c.z) - wide) < 1e-9)
  assert.ok(c.y > 0, 'above the island')
})

// The island fills the stage EXACTLY: every corner of its box projects inside `fill` of the view, and one
// sits on that edge (a loose fit is the wasted room the owner's bigger islands can't afford).
test('fitBox: every island corner lands inside the stage, and the binding one on its edge', () => {
  const box = { half: 8.2, bottom: -0.9, top: 2 }
  const target = { x: 0, y: 0.5, z: 0 }
  for (const aspect of [1366 / 840, 1100 / 840, 0.75, 1.9]) {
    const fill = 0.92
    const d = fitBox(CAMERA.home, box, target, aspect, fill)
    const cam = cameraPosition(CAMERA.home, target, d)
    const f = { x: target.x - cam.x, y: target.y - cam.y, z: target.z - cam.z }
    const fl = Math.hypot(f.x, f.y, f.z)
    const fwd = { x: f.x / fl, y: f.y / fl, z: f.z / fl }
    const r0 = { x: -fwd.z, y: 0, z: fwd.x } // right = fwd × up(0,1,0)
    const rl = Math.hypot(r0.x, r0.z)
    const right = { x: r0.x / rl, y: 0, z: r0.z / rl }
    const up = { x: right.y * fwd.z - right.z * fwd.y, y: right.z * fwd.x - right.x * fwd.z, z: right.x * fwd.y - right.y * fwd.x }
    const tv = Math.tan((CAMERA.fovDeg * Math.PI) / 360)
    let worst = 0
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [box.bottom, box.top]) {
      const q = { x: sx * box.half - cam.x, y: y - cam.y, z: sz * box.half - cam.z }
      const depth = q.x * fwd.x + q.y * fwd.y + q.z * fwd.z
      const nx = Math.abs(q.x * right.x + q.y * right.y + q.z * right.z) / (depth * tv * aspect)
      const ny = Math.abs(q.x * up.x + q.y * up.y + q.z * up.z) / (depth * tv)
      worst = Math.max(worst, nx, ny)
    }
    assert.ok(worst <= fill + 1e-9, `aspect ${aspect}: a corner leaves the stage (${worst})`)
    assert.ok(worst > fill - 1e-6, `aspect ${aspect}: the fit is loose (${worst} < ${fill})`)
  }
})

test('"foran" is always the side nearest the camera, whichever way the build is turned', () => {
  let p = { ...home, azimuth: 0.1 } // camera on +z
  assert.deepEqual(towardsCamera(p), { x: 0, z: 1 })
  assert.equal(horizontalRelation(p, { x: 0, z: 1 }), 'foran')
  assert.equal(horizontalRelation(p, { x: 0, z: -1 }), 'bagved')
  assert.equal(horizontalRelation(p, { x: 1, z: 0 }), 'ved siden af')
  p = { ...p, azimuth: p.azimuth + Math.PI / 2 } // camera on +x
  assert.equal(horizontalRelation(p, { x: 1, z: 0 }), 'foran')
  assert.equal(horizontalRelation(p, { x: 0, z: 1 }), 'ved siden af')
})
