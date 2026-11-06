import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMERA,
  cameraPosition,
  canZoom,
  dragTurn,
  fitDistance,
  horizontalRelation,
  lerpPose,
  pinchZoom,
  stepAzimuth,
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

test("Let's arrows turn exactly 90° a step and four steps come home", () => {
  let p = home
  for (let i = 0; i < 4; i++) p = stepAzimuth(p, 1)
  assert.ok(Math.abs(Math.cos(p.azimuth - home.azimuth) - 1) < 1e-9)
  assert.ok(Math.abs(stepAzimuth(home, -1).azimuth - (home.azimuth - Math.PI / 2)) < 1e-9)
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

test('"foran" is always the side nearest the camera, whichever way the build is turned', () => {
  let p = { ...home, azimuth: 0.1 } // camera on +z
  assert.deepEqual(towardsCamera(p), { x: 0, z: 1 })
  assert.equal(horizontalRelation(p, { x: 0, z: 1 }), 'foran')
  assert.equal(horizontalRelation(p, { x: 0, z: -1 }), 'bagved')
  assert.equal(horizontalRelation(p, { x: 1, z: 0 }), 'ved siden af')
  p = stepAzimuth(p, 1) // camera on +x
  assert.equal(horizontalRelation(p, { x: 1, z: 0 }), 'foran')
  assert.equal(horizontalRelation(p, { x: 0, z: 1 }), 'ved siden af')
})
