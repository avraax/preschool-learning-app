// Byggeklodser's camera (Krea PRD-03 §2.3, §4.4, §4.13) — PURE maths, no three.js. Our own rig, not
// OrbitControls: that captures the pointer and can't tell a placing tap from a turn (§4.2).
//
// The camera always looks at the island's centre (no panning). Azimuth spins around it, tilt is held
// between low and high (never under the island), and zoom is a MULTIPLE OF THE FIT DISTANCE — the
// distance at which the island's bounding sphere fills the measured stage — so the clamps hold on every
// screen (§4.13).

export interface Pose {
  /** Radians around the vertical axis. 0 = the camera on +z, looking towards −z. */
  azimuth: number
  /** Radians above the horizon. */
  tilt: number
  /** Distance as a multiple of the fit distance; < 1 is closer (zoomed in). */
  zoom: number
}

const DEG = Math.PI / 180

export const CAMERA = {
  fovDeg: 35,
  tiltMin: 18 * DEG,
  tiltMax: 70 * DEG,
  /**
   * Closest and farthest, as multiples of the fit distance (the whole island filling the stage). The
   * islands grew to 12/14/16 (owner, 2026-11-06), so a fitted cell is small: zooming in to 0.4 brings a
   * 16×16 island's cells back to finger size.
   */
  zoomMin: 0.4,
  zoomMax: 1.3,
  /** One + / − press. */
  zoomStep: 1.25,
  /** One-finger drag: radians per CSS px. A full stage width ≈ one half-turn. */
  turnPerPx: 0.008,
  tiltPerPx: 0.006,
  /** Let's 90° arrows, animated (§4.4). */
  stepMs: 300,
  /** The angled 3D view Let's models use, and every level's starting pose. */
  home: { azimuth: 45 * DEG, tilt: 32 * DEG, zoom: 1 } as Pose,
} as const

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

export const clampPose = (p: Pose): Pose => ({
  azimuth: p.azimuth,
  tilt: clamp(p.tilt, CAMERA.tiltMin, CAMERA.tiltMax),
  zoom: clamp(p.zoom, CAMERA.zoomMin, CAMERA.zoomMax),
})

/** A one-finger turn: horizontal drag spins, vertical drag tilts. Dragging right turns the build right. */
export const dragTurn = (p: Pose, dxPx: number, dyPx: number): Pose =>
  clampPose({ ...p, azimuth: p.azimuth - dxPx * CAMERA.turnPerPx, tilt: p.tilt + dyPx * CAMERA.tiltPerPx })

/** + / − buttons: dir 1 zooms in. */
export const zoomBy = (p: Pose, dir: 1 | -1): Pose => clampPose({ ...p, zoom: dir > 0 ? p.zoom / CAMERA.zoomStep : p.zoom * CAMERA.zoomStep })

/** A pinch: `ratio` = current finger distance / starting distance, applied to the pose at the start. */
export const pinchZoom = (start: Pose, ratio: number): Pose => clampPose({ ...start, zoom: start.zoom / Math.max(0.01, ratio) })

export const canZoom = (p: Pose, dir: 1 | -1): boolean =>
  dir > 0 ? p.zoom > CAMERA.zoomMin + 1e-6 : p.zoom < CAMERA.zoomMax - 1e-6

/** Let's arrows: exactly 90° a step from wherever it stands, so it always lands on a home-like corner view. */
export const stepAzimuth = (p: Pose, dir: 1 | -1): Pose => ({ ...p, azimuth: p.azimuth + dir * (Math.PI / 2) })

/**
 * Distance at which a sphere of `radius` fits the view on BOTH axes (the narrower one binds), with a
 * margin so the island never touches the stage's edge.
 */
export const fitDistance = (radius: number, aspect: number, fovDeg: number = CAMERA.fovDeg, margin = 1.08): number => {
  const vHalf = (fovDeg * DEG) / 2
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.05, aspect))
  return (radius * margin) / Math.sin(Math.min(vHalf, hHalf))
}

/**
 * The distance at which a BOX (the island: `half` cells either side of the centre, from `bottom` to `top`
 * in y, around `target`) just fills the view seen from `p`'s angle, with `fill` of the stage used on the
 * binding axis. Exact for the box's eight corners — a bounding sphere wasted ~40% of the stage on the
 * flattened diamond an angled island really is (owner 2026-11-06: bigger islands, so the room matters).
 */
export const fitBox = (
  p: Pose,
  box: { half: number; bottom: number; top: number },
  target: { x: number; y: number; z: number },
  aspect: number,
  fill = 0.92,
  fovDeg: number = CAMERA.fovDeg,
): number => {
  const tv = Math.tan(((fovDeg * Math.PI) / 180) / 2) * fill
  const th = tv * Math.max(0.05, aspect)
  // Camera basis: `fwd` points from the camera to the target; right and up span the image.
  const fwd = { x: -Math.cos(p.tilt) * Math.sin(p.azimuth), y: -Math.sin(p.tilt), z: -Math.cos(p.tilt) * Math.cos(p.azimuth) }
  const right = { x: Math.cos(p.azimuth), y: 0, z: -Math.sin(p.azimuth) }
  const up = { x: right.y * fwd.z - right.z * fwd.y, y: right.z * fwd.x - right.x * fwd.z, z: right.x * fwd.y - right.y * fwd.x }
  let d = 0
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [box.bottom, box.top]) {
    const q = { x: sx * box.half - target.x, y: y - target.y, z: sz * box.half - target.z }
    const depth = q.x * fwd.x + q.y * fwd.y + q.z * fwd.z // along the view, + = beyond the target
    const px = Math.abs(q.x * right.x + q.y * right.y + q.z * right.z)
    const py = Math.abs(q.x * up.x + q.y * up.y + q.z * up.z)
    // The corner sits at camera depth (d + depth); it fits when px ≤ th·(d + depth), likewise for y.
    d = Math.max(d, px / th - depth, py / tv - depth)
  }
  return d
}

/** World position of the camera for a pose around `target`, at `fit` × zoom. */
export const cameraPosition = (p: Pose, target: { x: number; y: number; z: number }, fit: number) => {
  const d = fit * p.zoom
  return {
    x: target.x + d * Math.cos(p.tilt) * Math.sin(p.azimuth),
    y: target.y + d * Math.sin(p.tilt),
    z: target.z + d * Math.cos(p.tilt) * Math.cos(p.azimuth),
  }
}

/** Ease between two poses (t ∈ 0…1, smoothstep) — for the 90° steps. Azimuth goes the short way round. */
export const lerpPose = (a: Pose, b: Pose, t: number): Pose => {
  const s = t * t * (3 - 2 * t)
  let d = b.azimuth - a.azimuth
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return { azimuth: a.azimuth + d * s, tilt: a.tilt + (b.tilt - a.tilt) * s, zoom: a.zoom + (b.zoom - a.zoom) * s }
}

/**
 * The horizontal axis that points from the build TOWARDS the child (the camera), snapped to ±x/±z.
 * "foran" is always nearest the child (§2.4.17); a special placed on a top face faces this way (§4.6).
 */
export const towardsCamera = (p: Pose): { x: number; z: number } => {
  const sx = Math.sin(p.azimuth), cz = Math.cos(p.azimuth)
  return Math.abs(sx) > Math.abs(cz) ? { x: Math.sign(sx), z: 0 } : { x: 0, z: Math.sign(cz) }
}

/** Camera-relative word for a horizontal neighbour (§2.4.17): left/right are never used — "ved siden af". */
export const horizontalRelation = (p: Pose, d: { x: number; z: number }): 'foran' | 'bagved' | 'ved siden af' => {
  const t = towardsCamera(p)
  const dot = d.x * t.x + d.z * t.z
  return dot > 0 ? 'foran' : dot < 0 ? 'bagved' : 'ved siden af'
}
