---
name: ui-screenshot
description: Headlessly drive the local app in Chrome to SEE and verify UI — screenshot a route or component, click into modals/popovers, wait for elements, and measure element rects to catch layout bugs (overflow, clipping, wrapping) plus runtime console errors. Use PROACTIVELY and automatically — without waiting to be asked — whenever the work involves the app's visible UI: after making or reviewing a change to any component/layout/style/theme, when the user asks to "look at / see / check / verify how X looks", when diagnosing a visual or layout issue, or before reporting a UI change as done. This is a Vite + MUI app; the dev servers must be running.
---

# UI screenshot & layout verification

Drive the locally-running app in **headless Chrome** (already installed) via the Chrome DevTools
Protocol, using the zero-dependency driver `cdp.mjs` here (Node 22+ global WebSocket/fetch — no
`npm install`). Capture screenshots to view, wait for elements, and measure rects to PROVE layout.

## When to use (be proactive)
Reach for this automatically when a task touches the visible UI — e.g. you edited a component and
want to confirm it renders correctly, the user asks to see/verify how something looks, or you're
hunting a layout/overflow/wrapping bug. Don't wait for an explicit "take a screenshot"; if seeing
the UI would make the answer more correct, use it. Skip it for pure logic/backend changes.

## Prerequisites (do this first)
1. Dev servers running **in Windows PowerShell, not WSL** (WSL → 502 on /api; memory
   `project_dev-server-windows-not-wsl`). Start both in the background and confirm
   `curl http://127.0.0.1:5173/` → 200:
   - API:  `node --env-file=.env.local dev-server.js`            (port 3001)
   - Vite: `node node_modules/vite/bin/vite.js --host 127.0.0.1` (port 5173)
   Vite HMR picks up source edits — re-run the driver after a change without rebuilding.
2. Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe` (override `CHROME_PATH`).

Then **view a saved PNG with the Read tool** (it renders images).

## Recipes

```bash
# Wait for the app to render, then screenshot a route
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/alphabet/quiz \
  --wait-for '#root > *' --out shot.png

# Open the adult menu (needs ?adult-tap=1 — a 2s hold can't be driven headlessly), then a
# sub-dialog, wait for it, tight-crop just that element
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/quiz?adult-tap=1' \
  --click '[aria-label="Til de voksne"]' --wait-for '.MuiDialog-paper' \
  --click '[aria-label="Stemme-test"]' --wait-for-text 'Hastighed' \
  --clip '.MuiDialog-paper' --out panel.png

# PROVE no overflow/clipping (compare child rect.r to the container's inner right edge)
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/quiz?adult-tap=1' \
  --click '[aria-label="Til de voksne"]' --wait-for '.MuiDialog-paper' \
  --click '[aria-label="Stemme-test"]' --wait-for-text 'Hastighed' \
  --measure '.MuiDialog-paper, .MuiDialog-paper button'

# Check a different viewport (landscape) for responsive layout
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/math/counting \
  --w 900 --h 440 --wait-for '#root > *' --out landscape.png
```

### Driving dnd-kit drag-and-drop (the Farver games)
`--click` uses `element.click()`, which fires **no** `pointerdown` — so it cannot exercise a
`@dnd-kit` drag. `--eval` runs with `awaitPromise:true`, so pass an async IIFE that dispatches a
synthetic PointerEvent sequence: `pointerdown` on the draggable, a few `pointermove`s on `document`
(must exceed the 8px sensor threshold), then `pointerup`. dnd-kit tags every draggable
`[aria-roledescription="draggable"]`. Always run BOTH probes when touching collision/drag code
(see `.claude/rules/drag-and-drop.md`):
- **Abort probe** — release ~28px into empty space (aim the endpoint *away* from the board centre);
  assert nothing scored (e.g. draggable count unchanged, no "solved" state).
- **Positive control** — drop on a target; assert it lands (count drops / target fills). Proves the
  synthetic drag actually reaches dnd-kit, so a passing abort means real spring-back, not dead events.

```bash
# reusable drag(startSel → x,y): fire on the FIRST draggable, release at absolute (ex,ey)
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/farver/ram-farven \
  --wait-for '#root > *' --click-text 'Start lyd nu' --settle 1200 --eval "$(cat <<'JS'
(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const el=document.querySelector('[aria-roledescription=\"draggable\"]'); if(!el) return 'NONE';
 const r=el.getBoundingClientRect(), sx=Math.round(r.left+r.width/2), sy=Math.round(r.top+r.height/2);
 const ex=sx, ey=sy-28;  // abort: 28px into empty space
 const fire=(t,x,y,tg)=>tg.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,composed:true,pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:t==='pointerup'?0:1,clientX:x,clientY:y}));
 fire('pointerdown',sx,sy,el); await sleep(25);
 for(const f of [10,20,28]){fire('pointermove',sx,sy-f,document); await sleep(25);}
 fire('pointerup',ex,ey,document); await sleep(700);
 return 'done';})()
JS
)"
```

### Verifying spoken audio (what Danish the app actually says)
To check narration/grammar/pronunciation, capture the **TTS request bodies** — the network ring
doesn't expose POST payloads, so hook `window.fetch` at the START of an `--eval` IIFE (before any
taps), push each `/api/tts-azure` request's `text` into a global, drive the interaction, then return
the collected strings. Proves the exact text sent (e.g. gender agreement "æblet er rødt", corrected
spellings) without listening. Add delays between taps — narration is single-channel (new audio
cancels current), but the fetch still fires per tap.
```bash
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/farver/laer \
  --wait-for '#root > *' --eval "$(cat <<'JS'
(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 window.__tts=[]; const of=window.fetch;
 window.fetch=function(u,o){try{if(String(u).includes('/api/tts-azure')&&o&&o.body){const b=JSON.parse(o.body);window.__tts.push(b.text||b.ssml)}}catch(e){} return of.apply(this,arguments)};
 await sleep(600);
 // …click through the elements that trigger speech, sleep(~650) between each…
 return JSON.stringify(window.__tts);})()
JS
)"
```

## Options
- Core: `--url` (req) · `--out <png>` · `--w/--h` (viewport, default 540x940)
- Waiting (prefer over sleeps): `--wait-for "<css>"` · `--wait-for-text "<txt>"` · `--timeout <ms>`
  (default 10000) · `--settle <ms>` (default 500) · `--wait <ms>` (fixed; only when no `--wait-for*`)
- Interact (clicks auto-wait for their selector): `--click "<css>"` · `--click-text "<txt>"` ·
  `--type "<css>::<text>"`
- Output: `--measure "<s1,s2>"` (rects) · `--clip "<css>"` (crop to element) · `--full-page` ·
  `--eval "<js>"`. Console errors + page exceptions are ALWAYS captured + summarised.
- Behaviour: `--keep-audio-modal` · `--port <n>`. Exit code is non-zero if a `--wait-for`/click
  target never appears (so failures are loud, not silently green).

## Verifying game logic & progress (not just pixels)
An async `--eval` IIFE (`awaitPromise` is on) can drive a whole round and assert the outcome:
- **Each run is a fresh Chrome profile** → `localStorage` starts empty and does NOT persist across
  runs. Read/assert *within one* `--eval`, or seed state at the top of the script.
- **Round outcomes** live in `localStorage['bornelaering-progress']`: per-game bests at
  `.perGame[<gameId>]` (`bestStars`, `roundsCompleted`), lifetime tallies at `.totals`
  (`totalStars`, `totalStickers`). (It's `.perGame`, NOT `.games`.) Snapshot before/after to prove a
  double-tap records once, a mis-tap doesn't drop a star, etc.
- **Catch ghost audio after navigation** by patching `window.fetch` + `XMLHttpRequest.open` for
  `/api/tts-azure` and timestamping calls, then asserting none fire after the route change.
- Advance dwell + the echo `await` mean a correct answer takes ~2s+ to advance — size detection
  windows generously and use a high `--timeout` for full-round drives.

## Gotchas (built-in, but know them)
- **Run the driver on the Windows side too** when working from WSL: WSL cannot reach the
  Windows-bound servers or Chrome's CDP port (NAT). Use
  `powershell.exe -Command "node .claude/skills/ui-screenshot/cdp.mjs --url '...' ..."`.
  PowerShell 5.1 strips embedded double quotes from native args — use **quote-free CSS
  selectors** (`[aria-label^=Til]`, `.MuiDialog-paper [role=button]`), never `[aria-label="..."]`.
- **Clicks use `element.click()`**, not synthetic mouse coordinates — MUI ignores synthetic coords.
  So `--click` takes a CSS selector. (`element.click()` fires no `pointerdown`, so tap-listeners
  like the diagnostics breadcrumbs won't see driver clicks.)
- **`--click-text` is a SUBSTRING match** on the first `<button>` whose `textContent.includes(txt)` —
  NOT exact. So `--click-text 1` clicks an `11` tile (and can silently advance a quiz). Use a value
  that isn't a substring of other on-screen text, or `--click` with a CSS/`data-*` selector to hit
  one specific element (answer tiles carry `[data-answer-tile]`).
- **Driving pointer gestures & SPA nav**: because `element.click()` fires no `pointerdown`, for an
  `onPointerDown` handler (e.g. the Sig et Ord mic) dispatch a real event via `--eval`:
  `el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))`. To unmount a route so React
  cleanup runs, **soft-navigate** (`history.pushState({},'','/x');dispatchEvent(new PopStateEvent('popstate'))`)
  — a hard `location` change skips cleanup. To inspect real mic tracks in a getUserMedia test, launch
  Chrome with `--use-fake-device-for-media-stream` (needs a one-off custom launcher, not `cdp.mjs`).
- **Can't stub `window.location.reload`** in an `--eval` — it's non-configurable, so a `defineProperty`
  throws and the *real* reload fires, navigating the page so your eval returns `undefined`. To test
  code that reloads/navigates (e.g. `lazyWithReload`'s chunk recovery), make the side effect
  **injectable** with a default (`fn = () => window.location.reload()`) and pass a spy from the eval.
- **Audio modal ("Tænd for lyd")** is auto-dismissed (launches with autoplay allowed + clicks
  "Start lyd nu"). Use `--keep-audio-modal` only to screenshot the modal itself.
- **Measure, don't eyeball, for overflow.** A scaled thumbnail can hide a button clipped past a
  popover edge; `rect.r > container.r` is unambiguous (this caught the sample-button overflow).
- App sizes to `--vh`; default 540x940 is representative. Useful selectors: the adult menu opens
  via `[aria-label="Til de voksne"]` (add `?adult-tap=1` to the URL so a plain click opens it —
  the real gesture is a 2s hold); inside it `[aria-label="Stemme-test"]` opens the voice panel.
  MUI dialogs render under `.MuiDialog-paper`, popovers under `.MuiPopover-paper`.
- **DEV query params force states deterministically for capture** (all DEV-only — see
  `src/utils/devHarness.ts`): `?fx=correct|wrong|hint|streak` forces one tile/board into that feedback
  state (no need to solve), `?seed=<n>` makes questions deterministic (probe with `--eval` to find a
  seed that yields the case you want, e.g. a count-mode number or a high comparison pile), `?nogate=1`
  skips the audio welcome/permission gate, `?reduce=1` forces reduced-motion, `?theme=<id>` sets the skin.
- Always check the printed "console errors"/"page exceptions" lines — a clean screenshot can still
  hide a runtime error.

## Cleanup
Delete temp PNGs when done. Chrome is killed each run. Stop the dev servers (free 3001/5173) if you
started them only for the test.
