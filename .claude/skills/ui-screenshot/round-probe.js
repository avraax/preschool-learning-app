// Drives a REAL round to completion and reports what happened. Injected as the --eval body by
// `sweep.mjs --phase round` (it returns a JSON string, so it works with any driver's --eval).
//
// WHY BRUTE FORCE: a wrong answer does NOT advance a question here (it only breaks the first-try flag),
// so a round can only be completed by finding the CORRECT tile. Nothing in the DOM reveals which one
// that is before the tap — `data-tile-state` only turns 'wrong' after. So the probe tries candidates in
// turn until the question signature changes. That is not a workaround: it exercises the real
// wrong-answer path (retry, hint-after-N-wrong, first-try bookkeeping) on the way to finishing.
//
// The success criterion is `resultScreen` — "Se bog" is a button unique to RoundResultScreen — AND xp
// actually moving in the store. Counting advances alone would pass on a game that advances forever
// without ever ending a round, and reading only xp would pass on a single lucky tap.
//
// HONEST LIMIT: Hukommelse is not covered. Its cards carry no stable hook (see the skill's per-game
// table) and matching pairs needs flip-and-remember, not candidate cycling. It reports notCovered.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const log = []
  const out = {
    advances: 0, clicks: 0, resultScreen: false, xpBefore: null, xpAfter: null,
    stuck: null, notCovered: null, crashed: false, log,
  }
  try {
    // `progressStore` is INERT until profileStore.attach(), so reading XP too early yields null — and a
    // null read must NEVER be folded into "XP did not move" (that reported Tal Quiz as paying 0 XP when
    // it pays 53). A probe of a dependency has three outcomes, not two: wait for readiness, and if it
    // never arrives say UNKNOWN.
    const xp = () => {
      try {
        const s = window.__progress
        return s ? s.get().progression.globalXp : null
      } catch (e) { return null }
    }
    for (let i = 0; i < 30 && xp() === null; i++) await sleep(200)
    out.xpBefore = xp()
    if (out.xpBefore === null) out.log.push('progressStore never became readable — XP verdict is UNKNOWN')

    const resultUp = () => [...document.querySelectorAll('button')]
      .some((b) => /Se bog/i.test(b.textContent || ''))
    const crashUp = () => /Noget gik galt|Ups!/.test(document.body.innerText || '')

    // Question fingerprint: prompt text + every tile's text and image + the draggable count. A correct
    // answer changes at least one of these; a wrong answer changes none of them.
    const sig = () => {
      const p = document.querySelector('[data-prompt-focus]')
      const tiles = [...document.querySelectorAll('[data-answer-tile]')]
        .map((e) => (e.textContent || '') + ((e.querySelector('img') || {}).src || '')).join('|')
      const drags = document.querySelectorAll('[aria-roledescription="draggable"]').length
      const promptImg = p ? ((p.querySelector('img') || {}).src || '') : ''
      // Ram Farven's progress is the POT'S COLOUR — no text, no count, no image changes as droplets go
      // in, so a signature built only from those reads the game as frozen and the round as undriveable.
      // Sampling the background of the big content boxes makes a colour-mixing board legible too.
      const paints = [...document.querySelectorAll('div')]
        .filter((e) => { const r = e.getBoundingClientRect(); return r.width >= 60 && r.width <= 400 && r.height >= 60 })
        .slice(0, 24)
        .map((e) => getComputedStyle(e).backgroundColor).join(',')
      return `${(p && p.textContent) || ''}|${promptImg}|${tiles}|${drags}|${paints}`
    }

    // Candidates, in the order a child's CHOICE lives: answer tiles first, else draggables (every drag
    // game here also answers a plain tap — see .claude/rules/drag-and-drop.md).
    // Third tier: Hvilken Farve's answers are plain 92x92 `cursor:pointer` DIV swatches — no
    // `data-answer-tile`, no draggable role — so a tiles-then-draggables set drove 0 advances there and
    // read as a broken game. Exclude app chrome by aria-label so the back button is never "answered".
    const CHROME = /Til de voksne|Tilbage|Min Bog|Hør igen|Tryk på figuren|Snak med figuren|Luk|Hjem/i
    const candidates = () => {
      const tiles = [...document.querySelectorAll('[data-answer-tile]')]
      if (tiles.length) return tiles
      const drags = [...document.querySelectorAll('[aria-roledescription="draggable"]')]
      if (drags.length) return drags
      return [...document.querySelectorAll('div,button')].filter((e) => {
        const r = e.getBoundingClientRect()
        if (r.width < 60 || r.width > 220 || r.height < 60) return false
        if (getComputedStyle(e).cursor !== 'pointer') return false
        const al = e.getAttribute('aria-label') || e.textContent || ''
        return !CHROME.test(al)
      })
    }

    if (!candidates().length) {
      // A memory board or a free browse — neither has a tile/draggable surface.
      out.notCovered = /learning\/memory/.test(location.pathname)
        ? 'Hukommelse: cards carry no stable hook; needs flip-and-remember, not candidate cycling'
        : 'no answer tiles or draggables on this screen (browse/learning surface — no round to drive)'
      return JSON.stringify(out)
    }

    let guard = 0
    while (!resultUp() && guard++ < 60) {
      if (crashUp()) { out.crashed = true; break }
      const before = sig()
      let advanced = false
      for (const c of candidates()) {
        // Tap the DEEPEST node: a finger lands on the inner button and the click bubbles up; a click on
        // an ancestor never reaches the descendant's handler (the skill's false-negative trap).
        const hit = c.querySelector('button') || c
        if (hit.getAttribute && hit.getAttribute('aria-disabled') === 'true') continue
        hit.click()
        out.clicks++
        await sleep(2300) // advance dwell + echo; a correct answer takes ~2s to move the board
        if (resultUp()) { advanced = true; break }
        if (crashUp()) { out.crashed = true; advanced = true; break }
        if (sig() !== before) { advanced = true; out.advances++; break }
      }
      if (!advanced) {
        out.stuck = `no candidate advanced the board after ${out.advances} advance(s)`
        break
      }
    }
    out.resultScreen = resultUp()
    await sleep(600)
    out.xpAfter = xp()
  } catch (e) {
    log.push('THREW: ' + (e && e.message ? e.message : String(e)))
  }
  return JSON.stringify(out)
})()
