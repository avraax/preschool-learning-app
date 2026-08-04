// Sweeps Let / Normal / Svær on ONE screen and reports what actually moved, per the per-game observable
// table in SKILL.md. Injected as the --eval body by `sweep.mjs --phase difficulty`.
//
// WHY IT MEASURES SEVERAL OBSERVABLES AT ONCE: the thing that changes differs per game family — tile
// count for config quizzes and Plus/Minus, draggable count for Farvejagt/Nuancer, swatch count for
// Hvilken Farve, board size for Hukommelse, the NUMBERS in the text for Sammenlign/Lær Tal, and for Ram
// Farven nothing visible at all (its axis is the target POOL). A single selector therefore reports "no
// change" on half the app, which reads as a broken setting when the setting is fine.
//
// WHAT THIS PROVES AND DOES NOT: plumbing only — that the level reaches the game and the board
// regenerates. It says NOTHING about whether the content is age-appropriate. CLAUDE.md is explicit that
// these are two separate audits and this is the cheap one: Tal Quiz passed every plumbing check while
// 60% of its Let questions were inverted Danish number words. Sample the PURE generators in Node for
// that (src/config/mathProblems.ts, ordlegWords.ts).
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const out = { levels: {}, moved: false, note: null, error: null }
  try {
    const store = window.__progress
    if (!store || !store.setDifficulty) { out.error = 'window.__progress.setDifficulty missing'; return JSON.stringify(out) }

    const observe = () => {
      const nums = (document.body.innerText || '').match(/\d+/g) || []
      return {
        tiles: document.querySelectorAll('[data-answer-tile]').length,
        drags: document.querySelectorAll('[aria-roledescription="draggable"]').length,
        divs: document.querySelectorAll('div').length,
        // Sammenlign / Lær Tal move their NUMBERS, not any count.
        numbers: nums.slice(0, 12).join(','),
        maxNumber: nums.length ? Math.max(...nums.map(Number).filter((n) => n < 1000)) : null,
        promptImg: (() => {
          const p = document.querySelector('[data-prompt-focus] img')
          return p ? (p.src || '').split('/').pop() : null
        })(),
      }
    }

    for (const level of ['let', 'normal', 'svaer']) {
      store.setDifficulty({ global: level })
      await sleep(1400) // regeneration + re-render; the skill says give it ~900ms minimum
      out.levels[level] = observe()
    }

    // "Moved" = ANY observable differs across the three levels. Compared as whole snapshots so a game
    // whose axis is numbers rather than counts still registers.
    const keys = Object.keys(out.levels.let)
    const changedKeys = keys.filter((k) => {
      const vals = ['let', 'normal', 'svaer'].map((l) => JSON.stringify(out.levels[l][k]))
      return new Set(vals).size > 1
    })
    // `divs` alone is noise (ambient scene sprites drift), so it does not count as evidence on its own.
    const meaningful = changedKeys.filter((k) => k !== 'divs' && k !== 'promptImg')
    out.changedKeys = changedKeys
    out.moved = meaningful.length > 0
    if (!out.moved && changedKeys.length) out.note = `only weak signals changed: ${changedKeys.join(',')}`
    store.setDifficulty({ global: 'normal' }) // leave the store as we found it
  } catch (e) {
    out.error = (e && e.message) ? e.message : String(e)
  }
  return JSON.stringify(out)
})()
