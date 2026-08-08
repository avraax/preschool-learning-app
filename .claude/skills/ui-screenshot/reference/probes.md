# Probe options & game-logic verification

`perf.mjs` steady-state cost, the full CLI option list, verifying XP/progress and difficulty rather than pixels, and how to author a long `--eval`.

Back to `../SKILL.md`.

## "It stutters" — steady-state cost (`perf.mjs`)

**`cdp.mjs --perf` cannot answer this.** It measures LOAD, and its frame times are a software-raster
artifact. What stutters on the child's iPad is the app **sitting still**, so `perf.mjs` measures a settled
window and reports GPU-independent counters (`recalcPerSec`/`recalcMsPerSec`, `busyPct`, `layers`/`layerMB`,
and an `animated`/`willChange`/`filtered` computed-style census). Harness build + `?nogate=1`, never dev.

```bash
node .claude/skills/ui-screenshot/perf.mjs --url "http://127.0.0.1:4173/?nogate=1" --label home --cpu-throttle 6
```

Its point is a **subtraction, not a number** — `--reduce-motion` (the floor), `--inject-css`,
`--no-parallax-vars`, `--eval`, `--inject-js-pre`, `--click`, `--wait-for`.

**Read `perf.md` (sibling) before trusting any result.** Four traps live there, each of which produced a
wrong conclusion in the PRD-01 session: gate on `recalcMsPerSec` not `recalcPerSec`; take a same-build
NOISE FLOOR before believing any screenshot A/B; a dpr 1-vs-2 run separates raster from CPU; and an
attribution measured while something else saturates the thread is worthless.

## Options
- Core: `--url` (req) · `--out <png>` · `--w/--h` (viewport, default 540x940)
- Waiting (prefer over sleeps): `--wait-for "<css>"` · `--wait-for-text "<txt>"` · `--timeout <ms>`
  (default 10000) · `--settle <ms>` (default 500) · `--wait <ms>` (fixed; only when no `--wait-for*`)
- Interact (clicks auto-wait for their selector): `--click "<css>"` · `--click-text "<txt>"` ·
  `--type "<css>::<text>"`
- Output: `--measure "<s1,s2>"` (rects) · `--clip "<css>"` (crop to element) · `--full-page` ·
  `--eval "<js>"`. Console errors + page exceptions are ALWAYS captured + summarised.
- Behaviour: `--port <n>` · `--audio-report` (see above; exits 1 on `SILENT`) · `--block-autoplay`
  (launch with `document-user-activation-required` so the app's audio verdict can reach `blocked`).
  Exit code is non-zero if a `--wait-for`/click target never appears (so failures are loud, not
  silently green).
- `webkit.mjs` adds `--device <ipad|ipad-portrait|iphone|iphone-landscape|wide>` · `--dark` ·
  `--reduced-motion` · `--tap "<css>"` · `--dom-click "<css>"`, and its `--click` is real trusted input.

## Verifying game logic & progress (not just pixels)
An async `--eval` IIFE (`awaitPromise` is on) can drive a whole round and assert the outcome:
- **Each run is a fresh Chrome profile** → `localStorage` starts empty and does NOT persist across
  runs. Read/assert *within one* `--eval`, or seed state at the top of the script.
- **Progress lives behind `window.__progress`, and there are no round outcomes to read.** Stars, bests,
  `perGame` and `totals.totalStars` are gone (endless play), and the storage key is per-child
  (`bornelaering-progress:<profileId>`) — so read the store, not localStorage:
  `__progress.get().progression.globalXp`, `.rewardNumber()`, `.grantedSlots()`,
  `.get().progression.lastCelebratedLevel`. Snapshot before/after to prove a double-tap grants once, a
  mis-tap doesn't cost XP, etc. Seed the book with `?rewards=n` to start a run just under a slot.
- **Force difficulty live**: DEV exposes the store as `window.__progress`.
  `window.__progress.setDifficulty({global:'let'|'normal'|'svaer'})` inside an `--eval` switches the
  level and the current game **regenerates its question at the new level** — the way to headlessly
  verify difficulty-gated content (Læs Ordet option count, Ram Farven target pool, math ranges)
  without the adult menu. Give it ~900ms to re-render before you screenshot/assert.

### A probe fails OPEN, and it looks exactly like a finding

`round-probe.js` decided a round had ended by looking for a `/Se bog/i` button. That button was removed
three days earlier, so its success flag was permanently false and `sweep.mjs` reported **every game** as
"round never ended" — 21 routes of real-looking defect, with the harness itself apparently healthy.
`--selftest` does not catch this: it proves the guards FIRE, not that the thing they look for still
exists.

- **A probe's success signal must be state the product cannot delete without the probe failing to
  RUN** — a store value, a `data-` hook — never UI text or a button label. Text is what gets reworded.
- **When a sweep reports the same failure on every route, suspect the probe first.** A defect that
  uniform is almost never the app.
- The same applies to the probe's UNIT (below): a signal that silently stops meaning what it meant is
  worse than one that breaks.

### One ADVANCE is not always one TASK

The per-family table above is about what a difficulty change moves; this is about what a *completion*
is. A probe that cycles candidates counts BOARD CHANGES, and on three games several of those make one
task — so an XP floor of "8 advances ≈ one notional round" reads correct play as broken per-task XP:

| game | one task is | so an advance is |
|---|---|---|
| Farvejagt | a whole BOARD (collect every target) | one object landing |
| Nuancer | a complete light→dark ORDERING | one shade placed |
| Stav Ordet | a whole WORD | one letter placed |

`sweep.mjs` names these in `ADVANCE_IS_NOT_A_TASK` and drops them to "XP moved at all". **State that as
a coverage limit when reporting** — on those three, a per-task XP regression has to be caught by the
unit tests, not the sweep.

### Sweeping difficulty across EVERY game
To audit whether the Sværhedsgrad setting reaches all of them, loop the three levels inside ONE
`--eval` per route (set → sleep ~1.2s → measure) rather than one run per level-and-game. The catch is
that **the observable differs per game family**, so a single selector reports "no change" on half the
app:

| family | what actually moves |
|---|---|
| config quizzes, Plus/Minus | `[data-answer-tile]` count |
| Farvejagt, Nuancer | `[aria-roledescription="draggable"]` count |
| Hvilken Farve | swatch count — neither of the above; a `div` count delta shows it |
| Hukommelse | board size; count `div`s (cards carry no stable hook) |
| Sammenlign, Lær Tal | the NUMBERS in `document.body.innerText`, not any count |
| Ram Farven | **nothing** — its axis is the target POOL, invisible in one board. Read the source. |

Two limits to state honestly when reporting:
- **This proves PLUMBING ONLY.** Tile counts moving 3→4→5 says the setting arrives; it says nothing
  about whether the content is age-appropriate. For that, sample the PURE generators in Node
  (`src/config/mathProblems.ts`, `ordlegWords.ts`) — see CLAUDE.md's Difficulty bullet.
- A route crashed by a parallel session's mid-edit passes every assertion here (see the crashed-route
  trap above) — and a pixel-diff of two such runs reads `0.00`. Check the driver's `TIMEOUT` /
  `page exceptions` lines before believing a sweep.
- **Catch ghost audio after navigation** by patching `window.fetch` + `XMLHttpRequest.open` for
  `/api/tts-azure` and timestamping calls, then asserting none fire after the route change.
- The advance dwell means a correct answer takes ~2s+ to advance, and a crossing opens the reward
  ceremony over the board for ~3.4s more — size detection windows generously, use a high `--timeout`,
  and poll for `[data-reward-overlay]` rather than assuming a fixed beat.

### Authoring a long `--eval` (do this before it wastes runs)
Inline heredocs get mangled by the shell: `${…}` becomes `bad substitution`, `\"` inside a selector is
stripped, and the failure looks like a page bug. Write the JS to a **file in the scratchpad** and pass
`--eval "$(cat <file>)"`.
- Use the **scratchpad path from the system prompt, not `/tmp`** — Node on Windows resolves `/tmp` as
  `C:\tmp`, so a file `cat`-ed there by bash isn't found.
- Inject secrets/ids by *prepending a line* to that file (`window.__PROBE_TOKEN = "…";`) rather than
  interpolating into the JS.
- **Wrap the IIFE in `try/catch` and return an accumulated `log` array.** A throw surfaces only as
  `eval: {}` (the serialized error) and you lose every earlier result — that empty object is almost
  always "it threw", not "it returned nothing".
- **The diagnostics rings hold OBJECTS, not strings.** `getDiagnosticsSnapshot().console` entries are
  `{t, level, msg}` (network/breadcrumbs likewise), so `entries.filter(e => String(e).includes('…'))`
  stringifies to `[object Object]` and silently matches nothing — which reads as "the app never logged
  it" rather than "my filter is wrong". Filter on `e.msg`.
- **Check what your wait helper returns.** A timed-out `until()` you don't assert on makes every later
  line vacuous — the probe reports success against an element that never appeared.
- **Wait for the state to START before waiting for it to END.** `while (label() !== 'Stop')` right after
  the click exits on the first poll — React hasn't re-rendered yet, so the button still says its idle
  label — and the whole run is then "over" in 0.6s with every later assertion vacuous. Wait for `Stop` to
  appear (bail if it never does), THEN wait for it to go away. An `eval: undefined` usually means a wait
  like this fell through, not that the eval timed out — 75s+ evals complete fine.
- **Write `--eval` from the Bash tool, not PowerShell** (`--eval "$(cat <file>)"`). PowerShell mangles
  multi-line JS and you get `eval: undefined` with no error to explain it.
- **Never put a `//` comment in an array you `.join('')` into one line** — it comments out the entire
  rest of the probe. The run then fails to parse on every viewport at once, which reads like the app
  broke, not the harness. Put comments *between* the string elements, or use `/* … */`.
- Prefer driving via the app's own listeners over DOM selectors when one exists (e.g. `PinPad` handles
  `window` keydown, so `dispatchEvent(new KeyboardEvent('keydown',{key:'5'}))` beats hunting tiles).
