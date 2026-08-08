// Drives play to a REWARD CROSSING and proves the ceremony fires IN GAME, over an inert board
// (Endless Play PRD-01 W8). Injected as the --eval body by `sweep.mjs --phase ceremony`, which seeds
// the book just under a slot with `?rewards=<n>` so the crossing is a few taps away.
//
// THREE things this asserts, and only the first is visible in a screenshot:
//   1. `[data-reward-overlay]` appears WITHOUT leaving the game route — the whole point of the change.
//   2. The board does NOT advance underneath it: the question signature is identical before the
//      overlay opened and after it closed +1 (the deferred generator runs on the seam, not under it).
//   3. The overlay actually COVERS the board — `document.elementFromPoint` at the board's centre must
//      return the overlay or a descendant of it. A screenshot cannot show where a press would land,
//      and this is the exact hit-test that has caught two dead surfaces in this repo.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const log = []
  const out = {
    clicks: 0, advances: 0,
    ceremonyOpened: false, onGameRoute: null, beat: null,
    coversBoard: null, boardHeldStill: null, resumed: false,
    xpBefore: null, xpAfter: null, crashed: false, log,
  }
  try {
    const xp = () => {
      try {
        const s = window.__progress
        return s ? s.get().progression.globalXp : null
      } catch (e) { return null }
    }
    for (let i = 0; i < 30 && xp() === null; i++) await sleep(200)
    out.xpBefore = xp()

    const overlay = () => document.querySelector('[data-reward-overlay]')
    const crashUp = () => /Noget gik galt|Ups!/.test(document.body.innerText || '')
    const sig = () => {
      const p = document.querySelector('[data-prompt-focus]')
      const tiles = [...document.querySelectorAll('[data-answer-tile]')]
        .map((e) => (e.textContent || '') + ((e.querySelector('img') || {}).src || '')).join('|')
      return `${(p && p.textContent) || ''}|${tiles}`
    }
    const CHROME = /Til de voksne|Tilbage|Min Bog|Hør igen|Luk|Hjem/i
    const candidates = () => {
      const tiles = [...document.querySelectorAll('[data-answer-tile]')]
      if (tiles.length) return tiles
      return [...document.querySelectorAll('[aria-roledescription="draggable"]')]
        .filter((e) => !CHROME.test(e.getAttribute('aria-label') || e.textContent || ''))
    }
    if (!candidates().length) {
      out.log.push('no tile surface on this route — ceremony probe not applicable')
      return JSON.stringify(out)
    }

    // The board's centre, measured BEFORE the overlay exists (afterwards the tiles are covered).
    const boardCentre = () => {
      const tiles = candidates()
      if (!tiles.length) return null
      const r = tiles[Math.floor(tiles.length / 2)].getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
    }

    let sigBeforeCeremony = null
    let guard = 0
    while (!out.ceremonyOpened && guard++ < 40) {
      if (crashUp()) { out.crashed = true; break }
      const before = sig()
      const centre = boardCentre()
      let advanced = false
      for (const c of candidates()) {
        const hit = c.querySelector('button') || c
        if (hit.getAttribute && hit.getAttribute('aria-disabled') === 'true') continue
        hit.click()
        out.clicks++
        // Poll rather than sleeping a fixed dwell: the ceremony opens ~1.1-2.0s after a correct tap.
        for (let i = 0; i < 20 && !overlay(); i++) await sleep(150)
        if (overlay()) {
          out.ceremonyOpened = true
          sigBeforeCeremony = before
          out.onGameRoute = !/\/album/.test(location.pathname)
          out.beat = overlay().getAttribute('data-reward-beat')
          // (3) the hit-test — the overlay must own the point the finger was just on.
          if (centre) {
            const at = document.elementFromPoint(centre.x, centre.y)
            out.coversBoard = !!(at && (at === overlay() || overlay().contains(at)))
          }
          advanced = true
          out.advances++
          break
        }
        if (crashUp()) { out.crashed = true; advanced = true; break }
        if (sig() !== before) { advanced = true; out.advances++; break }
      }
      if (!advanced) { out.log.push(`stalled after ${out.advances} advance(s)`); break }
    }

    if (out.ceremonyOpened) {
      // (2) the board must be UNCHANGED while the overlay is up — the generator is deferred.
      out.boardHeldStill = sig() === sigBeforeCeremony
      for (let i = 0; i < 60 && overlay(); i++) await sleep(200)
      // …and play RESUMES afterwards: the deferred generator runs once the ceremony closes.
      for (let i = 0; i < 20 && sig() === sigBeforeCeremony; i++) await sleep(200)
      out.resumed = sig() !== sigBeforeCeremony
    }
    out.xpAfter = xp()
  } catch (e) {
    log.push('THREW: ' + (e && e.message ? e.message : String(e)))
  }
  return JSON.stringify(out)
})()
