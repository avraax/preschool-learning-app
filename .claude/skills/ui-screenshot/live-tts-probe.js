// Proves a screen speaks from the PREBAKED set, not from live Azure.
//
// WHY THIS EXISTS: the closed narration set is supposed to be complete — "every line the app speaks is
// prebaked except Sig et Ord's read-back" (CLAUDE.md). Two violations shipped and were found by ear on
// the owner's iPad on the same day (2026-09-05), both invisible to every other check:
//   * Hukommelsesspil spoke the raw UPPERCASE glyph, but the bake holds the letter NAME ('a', 'eks').
//   * Hvilken Farve? built its question inline in the .tsx, so the enumerator never saw it.
// Neither breaks a test, a lint or a build; the audio phase reports OK because sound IS produced.
//
// A live call is not merely slow. In the SHIPPED app a guest has `canCallPaidApis: false`, so
// `/api/tts-azure` is refused and the line falls through to Web Speech — a different voice, or silence
// with no network. That is what the child actually hears.
//
// The harness runs with `?nogate=1`, which bypasses that gate, so Azure ANSWERS here and everything
// still sounds fine. Only the request itself gives the defect away — hence hooking fetch rather than
// judging the audio.
;(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const live = []
  const baked = new Set()
  const of = window.fetch
  window.fetch = function (u, init) {
    const url = String((u && u.url) || u)
    if (url.includes('tts-azure') && init && init.body) {
      try { live.push(JSON.parse(init.body).text) } catch (e) { live.push('(unparsed body)') }
    }
    return of.apply(this, arguments)
  }
  const P = HTMLMediaElement.prototype
  const op = P.play
  P.play = function () {
    const s = String(this.src)
    if (!s.startsWith('data:')) baked.add(s.split('/').pop())
    return op.apply(this, arguments)
  }
  // Unlock first, or every later speak() is dropped by ensureAudioReady and the run proves nothing.
  // This warm-up is OUR call and is deliberately excluded from the verdict below.
  let warmed = 0
  try {
    const c = (await import('/src/utils/SimplifiedAudioController.ts')).simplifiedAudioController
    await c.speak('opvarmning').catch(() => {})
    await sleep(2000)
    warmed = live.length
  } catch (e) { /* module path only exists in dev; the hooks still work */ }

  const click = async (sel, n) => {
    for (const e of [...document.querySelectorAll(sel)].slice(0, n)) {
      try { (e.querySelector('button') || e).click() } catch (x) { /* ignore */ }
      await sleep(1900)
    }
  }
  const rep = document.querySelector('[aria-label="Hør igen"]')
  if (rep) { rep.click(); await sleep(2100) }
  await click('[data-answer-tile]', 4)
  await click('.flipper', 3)                          // memory cards
  await click('[aria-roledescription="draggable"]', 3) // drag games
  return JSON.stringify({ liveAzure: live.slice(warmed), prebaked: baked.size })
})()
