// Page-side half of mic-e2e.mjs. Runs inside the app; returns a structured verdict.
// Four outcomes, never two — a product state (the retry line) is NOT a probe failure.
(async () => {
  const notes = []
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const log = (m) => notes.push(m)
  try {
    if (document.body.innerText.includes('Noget gik galt')) return { verdict: 'UNKNOWN', notes: ['route crashed'] }
    if (document.body.innerText.includes('Beklager')) return { verdict: 'UNKNOWN', notes: ['NotFound route?'] }

    // Trace the STT round-trip so a hang can be attributed: never fired / fired-and-hung / answered.
    window.__stt = []
    const origFetch = window.fetch
    window.fetch = function (u, o) {
      const url = String(typeof u === 'string' ? u : (u && u.url) || '')
      if (!url.includes('/api/stt')) return origFetch.apply(this, arguments)
      const t = performance.now()
      const bytes = o && typeof o.body === 'string' ? o.body.length : 0
      window.__stt.push({ event: 'request', at: Math.round(t), bodyChars: bytes })
      return origFetch.apply(this, arguments).then(
        (res) => {
          const entry = { event: 'response', status: res.status, ms: Math.round(performance.now() - t) }
          res.clone().json().then((j) => { entry.transcript = j.transcript; entry.confidence = j.confidence }).catch(() => {})
          window.__stt.push(entry)
          return res
        },
        (err) => { window.__stt.push({ event: 'reject', ms: Math.round(performance.now() - t), err: String(err && err.name) }); throw err },
      )
    }
    // Trace the recorder too: if `onstop` never fires, the blob promise hangs BEFORE any network call.
    window.__rec = []
    const RealMR = window.MediaRecorder
    if (RealMR) {
      const Patched = function (...args) {
        const mr = new RealMR(...args)
        window.__rec.push({ event: 'created', mime: mr.mimeType, at: Math.round(performance.now()) })
        const realStop = mr.stop.bind(mr)
        mr.stop = () => { window.__rec.push({ event: 'stop() called', state: mr.state, at: Math.round(performance.now()) }); return realStop() }
        mr.addEventListener('stop', () => window.__rec.push({ event: 'onstop fired', at: Math.round(performance.now()) }))
        mr.addEventListener('dataavailable', (e) => window.__rec.push({ event: 'data', size: e.data && e.data.size, at: Math.round(performance.now()) }))
        mr.addEventListener('error', (e) => window.__rec.push({ event: 'error', err: String(e && e.error && e.error.name) }))
        return mr
      }
      Patched.isTypeSupported = RealMR.isTypeSupported.bind(RealMR)
      window.MediaRecorder = Patched
    }

    const orb = document.querySelector('[aria-label="Sig et ord"]')
    if (!orb) return { verdict: 'UNKNOWN', notes: ['mic orb not found — is the fallback screen up? ' + document.body.innerText.slice(0, 160)] }

    const r = orb.getBoundingClientRect()
    const cx = Math.round(r.left + r.width / 2)
    const cy = Math.round(r.top + r.height / 2)
    const orbBox = { w: Math.round(r.width), h: Math.round(r.height), cx, cy }

    // Small-finger reality check: does a press LANDING SHORT of the clay still reach the button? The
    // pressable box is the padded wrapper; the ART is its aria-hidden child. Hit-test a point in the
    // slop — outside the painted circle, inside the target — which is where a 5-year-old's finger lands.
    const art = orb.querySelector('[aria-hidden]')
    const ar = art ? art.getBoundingClientRect() : r
    const slopPx = Math.round(r.right - ar.right)
    const probeX = Math.round(ar.right + Math.max(1, slopPx / 2))
    const atSlop = document.elementFromPoint(probeX, cy)
    const atCentre = document.elementFromPoint(cx, cy)
    const hitTarget = atCentre === orb || orb.contains(atCentre)
    const slopHit = atSlop === orb || orb.contains(atSlop)
    log(`art ${Math.round(ar.width)}px, target ${Math.round(r.width)}px, slop ${slopPx}px → ${slopHit ? 'a press in the slop reaches the button' : 'SLOP IS DEAD SPACE'}`)

    // Status line the child sees. Poll it so we get the real transition trail.
    const statusOf = () => {
      const t = document.body.innerText
      for (const s of ['Et øjeblik', 'Jeg lytter', 'Lad mig tænke', 'hørte jeg ikke helt', 'Hold knappen nede', 'mikrofonen klar', 'Hold knappen og sig et ord']) {
        if (t.includes(s)) return s
      }
      return '?'
    }
    const trail = []
    const push = () => { const s = statusOf(); if (s !== trail[trail.length - 1]) trail.push(s) }
    push()

    // The live level meter: sample the equalizer bars' transforms. If these move past the 0.35 idle
    // scale, the bars are being driven by REAL captured audio (an AnalyserNode on the mic stream) —
    // which is the only on-screen proof the device is actually hearing him.
    const bars = () => [...document.querySelectorAll('[data-mic-bar]')]
    let maxScale = 0, samples = 0
    const sampleBars = () => {
      for (const b of bars()) {
        const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(b).transform)
        if (m) { const parts = m[1].split(','); const sy = parseFloat(parts[3]); if (Number.isFinite(sy)) { maxScale = Math.max(maxScale, sy); samples++ } }
      }
    }

    const fire = (type, target, extra = {}) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'touch',
      isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: cx, clientY: cy, ...extra,
    }))

    // --- press ---------------------------------------------------------------------------------
    // window.__HOLD_MS lets the driver test the SHORT-PRESS coach path as well as a real hold.
    const holdMs = typeof window.__HOLD_MS === 'number' ? window.__HOLD_MS : 2700
    // Press in the SLOP (not the centre) when it is reachable — that is the small-finger case, and it
    // must drive the whole flow, not merely hit-test.
    const pressX = slopHit ? probeX : cx
    const t0 = performance.now()
    fire('pointerdown', orb, { clientX: pressX })
    let tListen = null
    for (let i = 0; i < 120; i++) {
      await sleep(40)
      push()
      sampleBars()
      if (tListen === null && statusOf() === 'Jeg lytter') tListen = Math.round(performance.now() - t0)
      if (performance.now() - t0 > holdMs) break
    }
    // --- release -------------------------------------------------------------------------------
    const tRelease = performance.now()
    fire('pointerup', orb)

    // Wait for a resolution: the spelled word, or the game's own retry line, or idle again.
    let heard = null
    let tResult = null
    for (let i = 0; i < 200; i++) {
      await sleep(150)
      push()
      const banner = document.querySelector('[data-spell-banner]')
      const text = document.body.innerText
      // The spelled word renders as a big uppercase banner plus one tile per letter.
      const m = /(^|\n)([A-ZÆØÅ-]{2,})(\n|$)/.exec(text)
      if (m && !['HØR', 'TILBAGE'].includes(m[2])) { heard = m[2].toLowerCase(); tResult = Math.round(performance.now() - tRelease); break }
      if (banner) { heard = banner.textContent.trim().toLowerCase(); tResult = Math.round(performance.now() - tRelease); break }
      if (text.includes('hørte jeg ikke helt')) { tResult = Math.round(performance.now() - tRelease); break }
      if (text.includes('Hold knappen nede')) { tResult = Math.round(performance.now() - tRelease); break }
      if (performance.now() - tRelease > 25000) break
    }

    let verdict
    if (heard) verdict = 'HEARD'
    else if (trail.includes('hørte jeg ikke helt')) verdict = 'NOT_HEARD (product retry state)'
    else if (trail.includes('Hold knappen nede')) verdict = 'TOO_SHORT (product coach state)'
    else if (trail.includes('Lad mig tænke')) verdict = 'STUCK_IN_PROCESSING'
    else verdict = 'UNKNOWN'

    const after = getComputedStyle(orb, '::after')
    log(`::after content=${JSON.stringify(after.content)} inset=${after.inset || after.top}`)

    return {
      verdict, heard, orb: orbBox, hitTarget, hitAt: slopHit ? 'centre+slop' : (hitTarget ? 'centre only' : 'none'),
      trail, tListen, tResult,
      levels: { max: Number(maxScale.toFixed(3)), samples },
      stt: window.__stt, rec: window.__rec,
      notes,
    }
  } catch (e) {
    return { verdict: 'UNKNOWN', notes: [...notes, 'threw: ' + String(e && e.message || e)] }
  }
})()
