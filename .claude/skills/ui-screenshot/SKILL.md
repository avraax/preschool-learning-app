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
2. **The app is auth-gated.** Add `?nogate=1` to reach any screen (it implies no-auth too). It also
   attaches a stand-in child (`dev-local`), so `progressStore` is live — without that the store stays
   INERT, `?rewards=n` awaits `whenAttached()` forever and the un-dismissible "add a child" dialog
   covers whatever you were capturing. DEV handles: `__auth`, `__profiles`, `__progress`, `__sync`.
   **Do NOT mint a session with `scripts/auth-dev-session.mjs` just to take a screenshot** — it writes a
   real user + session into the owner's PRODUCTION Neon database, and test rows have reached his
   play-test that way before (`.claude/rules/auth.md`). Reserve it for passkey work that genuinely
   needs a server session, and delete the `user` row afterwards (it cascades). For everything else,
   set the fields you need on `window.__auth` in the same `--eval` — no network, no database.
3. Chrome defaults to `C:/Program Files/Google/Chrome/Application/chrome.exe` (override `CHROME_PATH`).

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

### Driving passkeys / Face ID (`--webauthn`)
`--webauthn` installs a CDP **virtual authenticator** (ctap2, internal transport, resident key + user
verification, auto-presence) before the page loads, so passkey register + unlock can be exercised
headlessly. It proves the real plumbing — options endpoint, `navigator.credentials.*`, verification,
the `set-auth-token` handoff — but **not** the iOS gesture rule (activation consumed across an
`await`); only the real iPad can.
- **Use `http://localhost:5173`, never `127.0.0.1`.** With `WEBAUTHN_RP_ID=localhost` the RP ID must
  be a registrable suffix of the page's domain, so `127.0.0.1` fails with a `SecurityError` that reads
  exactly like "this device doesn't support Face ID".
- The lock screen's Face ID button stays **disabled until the pre-fetched WebAuthn options land**
  (~400ms) — that's by design, since the tap handler must not await. Poll for `!btn.disabled` before
  clicking, or the click is a no-op.
- Seed a session in the same run with `window.__auth.adoptSession(token, user)` (DEV only); each run
  gets a fresh Chrome profile, so nothing persists between invocations. Mint a token with
  `node --env-file=.env.local scripts/auth-dev-session.mjs`.
- A MUI `TextField` will NOT pick up `el.value = x`; use the native setter
  (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el, x)`) then
  dispatch `input`.

### `import()` inside `--eval` can give you a DIFFERENT module instance
Vite dev serves edited modules at HMR-timestamped URLs (`authSignIn.ts?t=1785…`). An `--eval` doing
`await import('/src/services/x.ts')` (no `?t=`) therefore gets a **second, separate instance** — so any
module-level state the app registered (singletons, registries, `let` caches) reads as empty and the
test fails while the product is fine. Symptom: a function that should hit the network returns its
"not registered" default with no request in the network log.
Drive the real path instead (a DEV `?param=` harness hook that seeds state before React mounts, as
`?oauthflow=`/`?rewards=` do), or assert through `window.__*` debug handles the app itself installed.

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

**Prebaked clips bypass `/api/tts-azure` → the fetch hook returns empty.** Most of the closed set
(English words, numbers, letters, the letter↔word phrases, colours) plays a committed `.mp3` directly
and never hits Azure, so `window.__tts` comes back `[]` — do NOT read that as "no audio fired." To
prove the exact spoken text of a prebaked clip, hook the shared `<audio>` element instead and map the
file back to its text: patch `HTMLMediaElement.prototype.play` to push `this.currentSrc` (the
`.mp3` name) into a global, drive the taps, then `grep <hash> src/config/prebakedTts.ts` — the manifest
key embeds the exact text (e.g. `…|Yoyo starter med Y` → `c85cfd7…mp3`). Combine both hooks when a flow
mixes prebaked + live (dynamic) speech.

**Read `this.getAttribute('src')`, NOT `currentSrc`, in that hook.** `currentSrc` is only set when the
resource-selection task runs, so at `play()` time it still holds the PREVIOUS clip — every entry is
off by one and you end up chasing a phantom (a letter that looked like it played twice).

**Proving a timed sequence didn't clip its audio** (autoplay browses — see `.claude/rules/audio-system.md`
on why they don't await): patch `play()` **and** `load()`; on each src swap record the outgoing
element's `currentTime`, then compare it against that clip's measured speech end (`ffmpeg silencedetect`).
`currentTime < speechEnd` = the step cut the word off. Onset-to-onset gaps between `play()` calls give
you the real cadence — the step constant alone doesn't, because playback starts ~250ms late.

To verify audio **plumbing** rather than wording (codecs, missing files, silent fallbacks), read
`performance.getEntriesByType('resource')` filtered to `/sounds/` — a request is itself proof Howler's
codec gate passed, since a rejected codec makes **no** request at all — and hook `console.warn` to
collect `[audio-unlock]` / "→ Web Speech" lines, because the driver only surfaces console *errors*.
A clean run shows cue + `tts/*.mp3` requests, zero media `error` events, and zero fallbacks.

### Proving what PAINTS a region (A/B pixel test)
For "is there a background / veil / grey panel behind this?", **a DOM inspection is not proof.** Walking
a tile's ancestors and finding every one transparent proves no *ancestor* paints it — and still misses the
real cause, because the wash can come from many **siblings**: at chart density each tile's own
`drop-shadow` (reach = offset + blur, ~24px) spills past 3px gaps, and ~200 overlapping shadows pool into
an even grey slab covering exactly the board's bounding box, which no single element owns. That's how
Lær Tal's "background" was first mis-reported as "nothing paints it".

Measure instead: screenshot twice — once normally, once with the suspect paint layer killed via `--eval`
(`el.style.filter='none'`, hide `blur(6px)` ellipses, `el.style.boxShadow='none'`) — then compare pixels.
`ffmpeg-static` is already a devDependency, so read raw pixels without any new package:
`spawnSync(ffmpeg, ['-i', png, '-f','rawvideo','-pix_fmt','rgb24','-'])` → index `(y*width + x)*3`.
Write that script **inside the project** (a scratchpad file can't resolve `node_modules`) and delete it after.

Two rules make the result trustworthy:
- **Always sample a control region outside the board.** If the control moves too, the two captures differ
  for some other reason and the comparison is void. A valid run shows `0,0,0` there.
- **Compare tile FACES against the GAPS** — this is the discriminator between healthy depth and a defect:
  gaps darkened while faces stay untouched = shadows doing their job (Hukommelse measured face −0.0);
  faces as dark as the gaps = an even wash, i.e. a slab (Lær Tal measured face −32 / gap −35).

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
- **Force difficulty live**: DEV exposes the store as `window.__progress`.
  `window.__progress.setDifficulty({global:'let'|'normal'|'svaer'})` inside an `--eval` switches the
  level and the current game **regenerates its question at the new level** — the way to headlessly
  verify difficulty-gated content (Læs Ordet option count, Ram Farven target pool, math ranges)
  without the adult menu. Give it ~900ms to re-render before you screenshot/assert.
- **Catch ghost audio after navigation** by patching `window.fetch` + `XMLHttpRequest.open` for
  `/api/tts-azure` and timestamping calls, then asserting none fire after the route change.
- Advance dwell + the echo `await` mean a correct answer takes ~2s+ to advance — size detection
  windows generously and use a high `--timeout` for full-round drives.

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
- **Check what your wait helper returns.** A timed-out `until()` you don't assert on makes every later
  line vacuous — the probe reports success against an element that never appeared.
- **Wait for the state to START before waiting for it to END.** `while (label() !== 'Stop')` right after
  the click exits on the first poll — React hasn't re-rendered yet, so the button still says its idle
  label — and the whole run is then "over" in 0.6s with every later assertion vacuous. Wait for `Stop` to
  appear (bail if it never does), THEN wait for it to go away. An `eval: undefined` usually means a wait
  like this fell through, not that the eval timed out — 75s+ evals complete fine.
- **Write `--eval` from the Bash tool, not PowerShell** (`--eval "$(cat <file>)"`). PowerShell mangles
  multi-line JS and you get `eval: undefined` with no error to explain it.
- Prefer driving via the app's own listeners over DOM selectors when one exists (e.g. `PinPad` handles
  `window` keydown, so `dispatchEvent(new KeyboardEvent('keydown',{key:'5'}))` beats hunting tiles).

## Gotchas (built-in, but know them)
- **A screenshot cannot prove a surface is on top — hit-test it.** An overlay that renders UNDERNEATH
  another is live and interactive but simply not drawn, so the picture looks perfectly correct and every
  `--wait-for`/`--measure` still passes (the element exists and has a rect). Assert
  `document.elementFromPoint(cx, cy)` at the element's centre returns it (or a descendant), not the
  thing above it. This is what found two shipped dead buttons: a MUI `<Dialog>` defaults to
  `theme.zIndex.modal` (1300) while this app's blocking surfaces are hand-rolled `fixed` boxes at
  ~10000, so any dialog opened FROM one of those mounts behind it.
- **A killed run leaves Chrome holding port 9333**, and the next invocation then hangs forever against
  that dead instance (looks like the page never loads). After any timeout/interrupt:
  `powershell.exe -Command "Get-Process chrome -EA SilentlyContinue | Stop-Process -Force"`.
- **Back-to-back runs occasionally die inside `getJSON`** (the previous Chrome hasn't released the port
  yet) — that's launcher contention, NOT a page bug, so don't go debugging the app. `sleep 2` between
  consecutive invocations, and re-run the one that failed.
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
  **`document.scrollWidth <= innerWidth` is NOT proof of no-clip** — GameShell's no-scroll root is
  `overflow:hidden`, so content that overflows the viewport is *clipped, not scrollable*, and
  scrollWidth still equals innerWidth. Prove on-screen by comparing each element's
  `getBoundingClientRect()` left/right against `[0, innerWidth]` (this caught a Ram Farven
  phone-landscape row clipped −64px left / +22px right that read as "no overflow").
- **MUI `sx` compiles to an emotion CLASS, not inline style** → in an `--eval`, `el.style.border` /
  `el.style.borderRadius` is **empty** for a `<Box sx={{…}}>`. Only raw `style={{}}` props show up in
  `el.style` — in practice the dnd primitives (`DroppableZone`/`DraggableItem`) and scatter `left/top%`.
  So `[...divs].filter(d => d.style.border.includes('dashed'))` silently matches nothing on sx-styled
  nodes and the eval returns `{}`. Select/measure MUI-styled elements via `getComputedStyle(el)` (styles)
  or `getBoundingClientRect()` (geometry) instead.
- App sizes to `--vh`; default 540x940 is representative. Useful selectors: the adult menu opens
  via `[aria-label="Til de voksne"]` (add `?adult-tap=1` to the URL so a plain click opens it —
  the real gesture is a 2s hold); inside it `[aria-label="Stemme-test"]` opens the voice panel.
  MUI dialogs render under `.MuiDialog-paper`, popovers under `.MuiPopover-paper`.
- **DEV query params force states deterministically for capture** (all DEV-only — see
  `src/utils/devHarness.ts`): `?fx=correct|wrong|hint|streak` forces one tile/board into that feedback
  state (no need to solve), `?seed=<n>` makes questions deterministic (probe with `--eval` to find a
  seed that yields the case you want, e.g. a count-mode number or a high comparison pile), `?nogate=1`
  skips the audio welcome/permission gate, `?reduce=1` forces reduced-motion, `?theme=<id>` sets the skin.
- **Auto-played game TTS often doesn't fire in headless** (no real audio device), so the fetch-capture
  audio recipe is unreliable for a game's welcome/prompt — it works for **tap-triggered** echoes (browse
  screens, answer taps), not the gated auto-play. To identify which quiz **subject** is showing without
  audio, read the hero image src: `[data-prompt-focus] img` → the filename (Vite keeps the content id,
  e.g. `.../X.webp`). Combine with `?seed=<n>` to force a specific question deterministically.
- Always check the printed "console errors"/"page exceptions" lines — a clean screenshot can still
  hide a runtime error.
- **`?reduce=1` flips only the JS `useReducedMotion()` hook, NOT the CSS `@media (prefers-reduced-motion:
  reduce)`.** So animations gated purely in CSS (e.g. the living-card idle breathe) stay ON under
  `?reduce=1` — it only exercises the JS-gated paths (transition fallback, framer bumps, idle attract).
  Verify CSS-media-gated motion by emulating the media feature at the OS/DevTools level, not the dev param.
- **Games open straight to an interactive board** (no entry-beat curtain — the "Er du klar? … Kør!"
  `GameIntro` was removed in Liveliness PRD-06). The themed wipe (`TransitionOverlay`) still covers the
  mount/unmount, but it lifts on its own; there's no `[data-game-intro]` to click and no first-tap-as-skip.
- **Headless Chrome runs rAF/framer-motion unthrottled**, so route transitions + entrance animations
  complete almost instantly — you generally CAN'T screenshot a mid-animation frame (even `--wait 70`
  lands post-animation). Verify steady states + console cleanliness instead; for a "no white-flash"
  regression check, use a DARK skin (`?theme=space`) where any white frame would be unmissable.

## Cleanup
Delete temp PNGs when done. Chrome is killed each run. Stop the dev servers (free 3001/5173) if you
started them only for the test.
