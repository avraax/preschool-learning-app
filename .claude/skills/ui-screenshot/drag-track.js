// Drag-tracking probe for the dnd-kit games — pass as `--eval "$(cat drag-track.js)"` to cdp.mjs or
// webkit.mjs. Answers "does the dragged item stay under the finger?", which a screenshot cannot.
//
// 1. TRACK: moves a synthetic pointer 5.8px/frame for 50 frames and reads the FIRST enabled draggable's
//    rect centre each frame. avgLag/maxLag ≈ 0 and finalOff ≈ [0,0] is correct. A lag that shrinks to 0
//    after the pointer stops (catchFrames > 0) is an EASED translate; a constant finalOff that grows with
//    distance is a SCALED ANCESTOR (2026-10-05: 15px and 24/31px — see dnd/draggableStyle.ts).
// 2. CONTROL / ABORT / POSITIVE: a no-drag control (board signature stable over 900ms), a release in
//    empty air (must change nothing), then each draggable onto each `[data-droppable-id]` until the board
//    reacts. `landed:false` with a stable control means drops are dead, not that the abort passed.
//
// In headless WebKit (~2fps) moves sent 20ms apart get DROPPED, which reads as a short translate in
// every game alike — compare against a no-lift control or slow the moves (700ms) before believing it.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const raf = () => new Promise((r) => requestAnimationFrame(r))
  await sleep(1500)
  const fire = (t, x, y, tg) => tg.dispatchEvent(new PointerEvent(t, {
    bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: t === 'pointerup' ? 0 : 1, clientX: x, clientY: y,
  }))
  const drags = () => [...document.querySelectorAll('[aria-roledescription="draggable"]')]
    .filter((e) => e.getAttribute('aria-disabled') !== 'true')
  const zones = () => [...document.querySelectorAll('[data-droppable-id]')]
  const sig = () => JSON.stringify([drags().length, zones().map((z) => [z.childElementCount, z.textContent])])
  const centre = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] }
  const out = { zones: zones().map((z) => z.dataset.droppableId), draggables: drags().length }
  if (!out.draggables) return JSON.stringify({ ...out, verdict: 'UNKNOWN — no draggable' })

  // 1. TRACK
  const el = drags()[0]
  const [sx, sy] = centre(el)
  fire('pointerdown', sx, sy, el); await raf()
  const lags = []
  const N = 50, step = 5
  for (let i = 1; i <= N; i++) {
    const px = sx + i * step * 0.6, py = sy - i * step
    fire('pointermove', px, py, document); await raf()
    const [cx, cy] = centre(el)
    if (i > 3) lags.push(Math.hypot(px - cx, py - cy)) // skip the activation threshold
  }
  const px = sx + N * step * 0.6, py = sy - N * step
  let catchFrames = 0
  for (; catchFrames < 60; catchFrames++) { const [cx, cy] = centre(el); if (Math.hypot(px - cx, py - cy) < 2) break; await raf() }
  const [fx, fy] = centre(el)
  fire('pointerup', sx, sy + 2000, document); await sleep(800)
  out.avgLag = +(lags.reduce((s, x) => s + x, 0) / lags.length).toFixed(1)
  out.maxLag = +Math.max(...lags).toFixed(1)
  out.finalOff = [+(px - fx).toFixed(1), +(py - fy).toFixed(1)]
  out.catchFrames = catchFrames

  // 2. CONTROL / ABORT / POSITIVE
  const drag = async (d, ex, ey) => {
    const [x0, y0] = centre(d)
    fire('pointerdown', x0, y0, d); await sleep(30)
    for (let k = 1; k <= 12; k++) { fire('pointermove', x0 + (ex - x0) * k / 12, y0 + (ey - y0) * k / 12, document); await sleep(20) }
    fire('pointerup', ex, ey, document)
  }
  const c0 = sig(); await sleep(900); out.controlStable = sig() === c0
  const d0 = drags()[0]; const [cx, cy] = centre(d0)
  let air = null
  for (const [dx, dy] of [[0, -60], [60, 0], [-60, 0], [0, 60], [80, -80]]) {
    const e = document.elementFromPoint(cx + dx, cy + dy)
    if (e && !e.closest('[data-droppable-id],[aria-roledescription="draggable"],button')) { air = [cx + dx, cy + dy]; break }
  }
  if (air) { const s0 = sig(); await drag(d0, ...air); await sleep(900); out.abortUnchanged = sig() === s0 } else out.abortUnchanged = 'UNKNOWN — no empty air'
  out.landed = false
  outer: for (let i = 0; i < out.draggables; i++) {
    for (const z of zones()) {
      const d = drags()[i]; if (!d) break
      const s = sig(); const [zx, zy] = centre(z)
      await drag(d, zx, zy); await sleep(1200)
      if (sig() !== s) { out.landed = [i, z.dataset.droppableId]; break outer }
    }
  }
  return JSON.stringify(out)
})()
