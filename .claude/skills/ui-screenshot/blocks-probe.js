// Byggeklodser end-to-end probe (rung 1 `cdp.mjs --webgl`, rung 2 `webkit.mjs`). One run drives the whole
// game through its DEV hooks and returns JSON with `FAILED: []` when every check holds:
//
//   node .claude/skills/ui-screenshot/cdp.mjs --webgl --url "http://localhost:5173/krea/klodser?nogate=1" \
//     --w 1024 --h 768 --wait-for "canvas[data-blocks-frames]" --timeout 20000 --settle 800 \
//     --eval "$(cat .claude/skills/ui-screenshot/blocks-probe.js)"
//
// Aims at real squares through `window.__blocks.project` (DEV-only), switches levels through
// `window.__progress.setDifficulty`. LET = the plate; NORMAL = the open world (Svær is the same world).
// Synthetic pointers: it proves the logic and the wiring, not touch FEEL (rung 3).
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const waitFor = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(80) } return null }
  const o = {}, fail = []
  const check = (name, ok, detail) => { o[name] = ok ? 'ok' : `FAIL ${detail ?? ''}`; if (!ok) fail.push(name) }
  const st = () => document.querySelector('[data-krea-stage]')
  const host = () => document.querySelector('[data-blocks-stage]')
  const cells = () => st()?.dataset.blocksCells ?? ''
  const kinds = () => st()?.dataset.blocksKinds ?? ''
  const count = () => +(st()?.dataset.blocksCount ?? -1)
  const press = (sel) => { const el = document.querySelector(sel); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0, pointerId: 9 })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse', button: 0, pointerId: 9 })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })) }
  const ev = (t, x, y, id = 5) => host().dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 5, button: 0, clientX: x, clientY: y }))
  const tap = async (q) => { ev('pointerdown', q.x, q.y); ev('pointerup', q.x, q.y); await sleep(160) }
  const at = (x, y, z, fy = 0) => window.__blocks.project(x, y, z, fy)
  /** Hold the "Ny" confirm button long enough, then release — NO click: iOS sends none after a long press. */
  const holdFresh = async () => {
    const b = document.querySelector('[data-krea-control=confirm-fresh]')
    const pe = (t) => b.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0 }))
    pe('pointerdown'); await sleep(1650); pe('pointerup'); await sleep(500)
  }

  // ---------------- LET: the plate ----------------
  await waitFor(() => window.__progress)
  window.__progress.setDifficulty({ global: 'let' })
  await waitFor(() => window.__blocks && window.__blocks.size === 14 && host()?.querySelector('canvas[data-blocks-frames]'))
  await sleep(500)
  check('let: a plate, no home button', !document.querySelector('[data-krea-control=home]'))
  check('let: no roof, no theme picker', !document.querySelector('[data-blocks-special=roof]') && !document.querySelector('[data-blocks-theme-pick]'))
  const c = 7
  press('[data-blocks-special=brick]'); await sleep(80)
  for (let x = c - 1; x <= c + 1; x++) await tap(at(x, 0, c))
  check('let: three bricks', count() === 3, count())
  press('[data-blocks-special=window]'); await sleep(80)
  await tap(at(c, 0, c, 1))
  check('let: a window ON TOP of a brick, the brick stays (QHYV8)', kinds().includes(`${c},1,${c}:window`) && kinds().includes(`${c},0,${c}:brick`), kinds())
  press('[data-blocks-special=door]'); await sleep(80)
  await tap(at(c - 4, 0, c + 3))
  check('let: a door is 2x3 = six cells, one block (6BC2N)', (kinds().match(/:door:/g) || []).length === 6, kinds())
  press('[data-krea-control=undo]'); await sleep(200)
  press('[data-krea-control=undo]'); await sleep(200)
  check('let: undo twice → three bricks', count() === 3, count())
  // Hold to move: brick (c+1) onto the top of brick (c-1)
  press('[data-blocks-chip=gul]'); await sleep(80)
  const a = at(c + 1, 0, c, 1), b = at(c - 1, 0, c, 1)
  ev('pointerdown', a.x, a.y); await sleep(600)
  for (let k = 1; k <= 12; k++) { ev('pointermove', a.x + (b.x - a.x) * k / 12, a.y + (b.y - a.y) * k / 12); await sleep(30) }
  ev('pointerup', b.x, b.y); await sleep(300)
  check('let: hold + drag moves a block onto another (T59B2)', cells().includes(`${c - 1},1,${c}:`) && !cells().includes(`${c + 1},0,${c}:`), cells())
  const n0 = cells(), q = at(c, 0, c, 1)
  ev('pointerdown', q.x, q.y); await sleep(600); ev('pointerup', q.x, q.y); await sleep(300)
  check('let: a hold that never moves leaves it', cells() === n0)
  // Ny byggeplade: a tap does nothing, a hold clears, undo brings it back
  press('[data-krea-control=new-build]'); await sleep(300)
  const btn = document.querySelector('[data-krea-control=confirm-fresh]')
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, pointerType: 'touch' })); await sleep(120)
  btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch' })); btn.click(); await sleep(300)
  check('let: a quick tap on "Ny" clears nothing', count() > 0 && !!document.querySelector('[data-krea-confirm]'))
  const before = count()
  await holdFresh()
  check('let: holding "Ny" clears', count() === 0, count())
  press('[data-krea-control=undo]'); await sleep(300)
  check('let: Fortryd brings the cleared build back', count() === before, count())
  // Context loss → same build; 0 frames at rest
  const cv = host().querySelector('canvas')
  const k0 = kinds(), ext = cv.getContext('webgl2').getExtension('WEBGL_lose_context')
  ext.loseContext(); await waitFor(() => host().getAttribute('data-blocks-lost') === '1', 3000)
  ext.restoreContext(); await waitFor(() => !host().getAttribute('data-blocks-lost'), 3000); await sleep(300)
  check('let: context loss → restored with the same build', kinds() === k0)
  const f0 = +cv.dataset.blocksFrames; await sleep(1500)
  check('let: 0 frames at rest', +cv.dataset.blocksFrames === f0, +cv.dataset.blocksFrames - f0)

  // ---------------- NORMAL: the open world ----------------
  window.__progress.setDifficulty({ global: 'normal' })
  await waitFor(() => window.__blocks && window.__blocks.size === 128 && document.querySelector('[data-krea-control=home]'))
  await sleep(800)
  const W = 64
  press('[data-blocks-chip=roed]'); await sleep(80)
  await tap(at(W, 0, W))
  const p0 = at(W, 0, W)
  // Fingers placed by the screen's size (a phone in landscape is only ~390 px tall).
  const fy = innerHeight * 0.6, fx = innerWidth * 0.4, step = Math.min(20, innerWidth / 50)
  ev('pointerdown', fx, fy, 11); ev('pointerdown', fx + 100, fy, 12)
  for (let k = 1; k <= 10; k++) { ev('pointermove', fx - k * step, fy, 11); ev('pointermove', fx + 100 - k * step, fy, 12); await sleep(16) }
  ev('pointerup', fx - 10 * step, fy, 11); ev('pointerup', fx + 100 - 10 * step, fy, 12); await sleep(300)
  const p1 = at(W, 0, W)
  // 1:1 holds for the ground UNDER the fingers; a block at another depth moves more or less (perspective).
  const dx = p1.x - p0.x, slid = 10 * step
  check('normal: two fingers slide the ground with the fingers', dx < -0.6 * slid && dx > -1.7 * slid && Math.abs(p1.y - p0.y) < 0.3 * slid, Math.round(dx))
  const cn = count()
  await tap(at(W + 6, 0, W))
  check('normal: build after a pan', count() === cn + 1, count())
  press('[data-krea-control=home]'); await sleep(700)
  check('normal: home glides back', Math.abs(at(W, 0, W).x - p0.x) < 25)
  const before2 = count()
  await tap(at(127 + 3, 0, W))
  check('normal: a tap outside the build area bounces', count() === before2, count())
  const cv2 = host().querySelector('canvas'); const g0 = +cv2.dataset.blocksFrames; await sleep(1500)
  check('normal: 0 frames at rest', +cv2.dataset.blocksFrames === g0, +cv2.dataset.blocksFrames - g0)
  o.FAILED = fail
  return JSON.stringify(o)
})()
