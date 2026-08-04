---
name: ui-screenshot
description: Headlessly drive the local app to SEE and verify UI — screenshot a route or component, click into modals/popovers, wait for elements, and measure element rects to catch layout bugs (overflow, clipping, wrapping) plus runtime console errors. Also drives REAL WebKit with an iPad user agent (webkit.mjs) for Safari-engine and iOS-code-path checks, and asserts that audio ACTUALLY PRODUCED SOUND (--audio-report) instead of asking the owner to listen. Use PROACTIVELY and automatically — without waiting to be asked — whenever the work involves the app's visible UI or its audio: after making or reviewing a change to any component/layout/style/theme, when the user asks to "look at / see / check / verify how X looks", when diagnosing a visual or layout issue, or before reporting a UI or narration change as done. This is a Vite + MUI app; the dev servers must be running.
---

# UI screenshot & layout verification

## How far each rung can actually verify (read this before promising anything)

Three rungs, in increasing cost and decreasing convenience. **Say which rung a claim came from** — the
owner's standing complaint is being asked to play-test things a machine could have checked, and the
opposite error (calling a WebKit run "verified on iPad") is worse.

| rung | command | proves | cannot prove |
|---|---|---|---|
| 1. Chrome | `cdp.mjs` | layout, interaction, game logic, progress, **and that audio produced sound** (`--audio-report`) | anything Safari-specific; Chrome plays Ogg happily, so it can NEVER catch the codec floor |
| 2. real WebKit | `webkit.mjs` | Safari-engine layout, the app's **iOS branches** (`deviceDetection` sees an iPad UA), and codec support via `canPlayType` — it correctly reports `audio/ogg` as unsupported | audio PLAYBACK (see below), Mobile-Safari scroll/`fixed`/viewport quirks, iOS transient user-activation, iPadOS 17.7 engine gaps |
| 3. real device | the owner's iPad | everything, including whether it sounds right | — |

**Rung 2 cannot play audio at all.** Playwright's WebKit build on Windows has **no WebAudio and no
speechSynthesis** — `typeof AudioContext === 'undefined'`, verified directly. The app therefore logs
`initializeAudio: ctxState= undefined speechAvail= false` and narration never starts. That is an
environment limit, **not an app bug** — do not go debugging the app when you see it. Audio *playback*
assertions belong on rung 1; WebKit's audio contribution is the `canPlayType` snapshot, which is a
static codec table and needs no device.

**What rung 1 + 2 together replace:** every "does it render / lay out / respond / score / actually make
a sound" question. **What still needs the owner:** does the Danish sound *right* (wording, pronunciation,
pacing to the ear), real-iPad touch feel, and true iPadOS 17.7 engine behaviour. See
`docs/device-testing.md` for why no paid service removes the listening step, and what a device farm
would cost if we ever want rung 3 automated.

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
4. For `webkit.mjs`: the `playwright` devDependency (installed) + `npx playwright install webkit`
   (one-time, ~150MB into the user cache, not the repo). If it reports a missing browser, re-run that.

Then **view a saved PNG with the Read tool** (it renders images).

## Recipes

```bash
# Wait for the app to render, then screenshot a route
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/alphabet/quiz \
  --wait-for '#root > *' --out shot.png

# Open "Til de voksne" (a plain click; a PIN pad may intercept) and select a settings pane.
# The ~4.5s settle is REQUIRED — a snapdom screenshot runs before the surface renders, so a shorter
# wait silently yields the un-opened page.
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/quiz' \
  --click '[aria-label="Til de voksne"]' --wait-for '.MuiDialog-paper' --settle 4500 \
  --click '[data-rail-item=lyd]' --settle 700 \
  --clip '.MuiDialog-paper' --out panel.png

# PROVE no overflow/clipping (compare child rect.r to the container's inner right edge)
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/quiz' \
  --click '[aria-label="Til de voksne"]' --wait-for '.MuiDialog-paper' --settle 4500 \
  --measure '.MuiDialog-paper, .MuiDialog-paper button'

# Check a different viewport (landscape) for responsive layout
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/math/counting \
  --w 900 --h 440 --wait-for '#root > *' --out landscape.png
```

### Sweeping the WHOLE app (`sweep.mjs`) — and why not a shell loop

```bash
node .claude/skills/ui-screenshot/sweep.mjs --selftest              # ALWAYS first: proves the guards fire
node .claude/skills/ui-screenshot/sweep.mjs --phase smoke --engine both
node .claude/skills/ui-screenshot/sweep.mjs --phase layout --concurrency 4 --json out.json
#   phases: smoke | layout | audio | round | difficulty | triggers
#   --only <substr>  --engine chrome|webkit|both  --concurrency n
```
It plans every job up front and each must end PASS / FAIL / N/A / UNKNOWN; anything else is DEAD,
retried once, then reported. Routes and expected Danish titles are DERIVED from `categoryThemes.ts`, and
difficulty exemptions from `difficulty.ts`'s own `EXEMPT`/`TILE_AXIS_EXEMPT` maps — so a stale hand-list
can't become a silent coverage hole. A full sweep takes 10+ min: run it with `run_in_background`, because
the Bash tool caps at 10 minutes.

**A shell `for` loop over the drivers lies in two directions.** A dead iteration prints nothing and the
loop carries on, so a "5-viewport sweep" silently covers 3 (this bit twice in one session — including
once while measuring perf, where it produced two blank rows I nearly ignored). And a crashed or mistyped
route satisfies every wait and passes vacuously. Count one result line per planned job, or use the runner.

### A probe needs FOUR outcomes, not two

The single most expensive lesson of the sweep sessions: **almost every defect a new probe reports is the
probe's own.** Roughly ten probe bugs to two real ones. They were all the same mistake — folding a state
that isn't a failure into the failure bucket. Budget for this, and give every probe:

- **N/A** — the feature legitimately doesn't exist here. Læs Ordet has no replay by design (the child
  can't spell yet), Sig et Ord is speech INPUT, browses have no round, `EXEMPT` games ignore difficulty.
- **UNKNOWN** — the measurement didn't work. A dependency wasn't ready (`progressStore` is INERT until
  `profileStore.attach()`, so an early XP read is `null` — folding that into "XP didn't move" reported a
  game paying 53 XP as paying 0), or the probe can't drive the mechanic (colour-mixing needs the right
  combination; Hvilken Farve needs a real drag). **Unverified is not broken**, and laundering it into a
  pass is worse than both.
- **Expected-but-odd states must be enumerated WITH REASONS**, or they read as bugs: the music bed starts
  at `volume 0` and fades in; Howler's `_unlockAudio` walks a 10-node html5 pool of src-less elements on
  every touch platform; `AbortError` is the documented no-queue cancel; the in-game mascot tap is
  animation-only.
- **Assertions must be tight enough to fail.** `xpAfter > xpBefore` passed on a product with `taskXp`
  zeroed, because bonuses still credited 8. Assert the contract (~one reward per round), not mere motion.

Corollary: **a phase with its own `--eval` payload must be judged on its OWN fields.** Reusing another
phase's judging read undefined values and reported "#root empty" on every healthy page — twice.

### Two rect traps, in opposite directions — hit-test instead

`getBoundingClientRect()` is not the ink, and it errs both ways:
- **Too low**: Farvejagt's draggable wrapper sits at the scatter anchor while its only child is
  `translate(-50%,-50%)`'d away, so the wrapper hangs 40px below the painted object — 3 phantom
  "off-screen" objects whose ink and hit-target were both inside.
- **Too big**: `ObjectArt`/`SymbolTile` scale their `<img>` ~2.5–3× over transparent padding, so a
  union-of-descendants measure over-reports by that factor (the documented `SymbolTile` trap).

An `<img>`-only rule "fixes" the first and hides real text-label overflow. **So confirm any off-screen
rect with `document.elementFromPoint` at the on-screen part**: reachable → not a finding; unreachable →
real, which is the shape a genuine clipped-below-an-unscrollable-fold bug has. `sweep.mjs --phase layout`
does this.

### Real WebKit / iOS code paths (`webkit.mjs`)

Same flags as `cdp.mjs` (`--url --out --clip --measure --eval --wait-for --settle --click --click-text
--type --full-page --timeout`), plus `--device`, `--dark`, `--reduced-motion`, `--tap`, `--dom-click`.
Requires the `playwright` devDependency and a one-time `npx playwright install webkit`.

```bash
# iPad landscape, real Safari engine, iPad UA → the app takes its iOS branches
node .claude/skills/ui-screenshot/webkit.mjs --url 'http://127.0.0.1:5173/math/addition?nogate=1' \
  --device ipad --settle 4000 --out shot.png

# dark skin + reduced motion, phone landscape
node .claude/skills/ui-screenshot/webkit.mjs --url 'http://127.0.0.1:5173/album?nogate=1&rewards=12' \
  --device iphone-landscape --dark --reduced-motion --out album.png
```

- `--device`: `ipad` (1024x768) · `ipad-portrait` (768x1024) · `iphone` (390x844) ·
  `iphone-landscape` (844x390) · `wide` (1254x872, desktop UA). Sizes mirror `referenceViewports.ts`;
  `--w/--h` override. All but `wide` set an iPad/iPhone UA + touch + meta-viewport handling.
- **`--click` here is REAL trusted input** (unlike `cdp.mjs`'s `element.click()`), so it fires
  `pointerdown`/`pointerup` and exercises the paths dnd-kit and the diagnostics breadcrumbs listen on.
  `--tap` sends touch events; `--dom-click` falls back to `element.click()` when an overlay intercepts.
- **`--settle` matters more here than in Chrome.** The default 500ms caught a Plus board mid-generation:
  the screenshot showed the title and "Hør igen" with **no problem and no answer tiles**, which reads
  exactly like a phone-landscape layout bug. It rendered fine at `--settle 4000`. Before reporting an
  empty/partial board, re-run with a longer settle AND compare the same size in `cdp.mjs`.
- The UA's `Version/17.6` is a **string**, not an engine. It flips `isIOS`/`isIPad`/`version` in
  `deviceDetection.ts` (which regexes the UA), so iOS-only code runs — it does **not** give you Safari 17.
- `maxTouchPoints` stays `0` and `navigator.platform` stays `Win32`, so the `isM1iPad` branch
  (`platform === 'MacIntel' && maxTouchPoints > 1`) is NOT reachable here. `'ontouchstart' in window` is
  true, so `touchSupported` is.

### Performance on the target device (`--cpu-throttle`, `--perf`, `build:harness`)

```bash
npm run build:harness && node node_modules/vite/bin/vite.js preview --port 4173 --host 127.0.0.1
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:4173/album?nogate=1' \
  --w 1366 --h 992 --settle 4500 --perf --cpu-throttle 4
```
**Measure the harness build, never the dev server** — unbundled ESM overstates load ~10× (FCP 1.3s vs
0.3s on the same screen), and my first "production" numbers were actually the login screen at 6.4MB heap,
caught only because the number was implausible. `?nogate=1` is `DEV &&`-gated and `import.meta.env.DEV` is
false in EVERY `vite build` regardless of `--mode`, so a normal build tree-shakes the harness away;
`build:harness` is the production-shaped bundle that keeps it (see `docs/device-testing.md`).
`--cpu-throttle` scales CPU only — not an A10X. **Frame/jank numbers are not trustworthy**: headless runs
`--disable-gpu`, so raster is software and a 33ms median at 1× is an artifact. Load timings and the
relative ranking between screens are the usable signals.

### Proving audio actually made a sound (`--audio-report`)

Works on `cdp.mjs` (playback + codecs) and `webkit.mjs` (codecs only — see the ladder). It injects
`audio-probe.js` before app scripts, patching `HTMLMediaElement.play` and `decodeAudioData`, then prints
a one-line verdict and exits **1** on `SILENT`, so it can gate a script.

```bash
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/quiz?nogate=1' \
  --audio-report --settle 2500 --click '[aria-label="Hør igen"]' --settle 3000
# audio verdict: OK — 1/2 clips played (1 pre-empted by design, 1 silent unlock primes, 0 webaudio sources)
```

**You must drive a trigger.** Nothing plays on mount (narration is gated on interaction), so a bare run
reports `NO AUDIO ATTEMPTED`. `[aria-label="Hør igen"]` is the reliable one in task games; browses use
`Hør alfabetet` / `Hør tallene`, menus `Snak med figuren`. **Never `Tryk på figuren`** — the in-game
mascot's handler is animation-only (`Mascot.handleTap`), so using it as a trigger reports correct games as
silent. A trigger candidate must actually be a narration control.

**`cdp.mjs --ipad-ua` is the only way to check audio ON an iOS code path.** WebKit has no WebAudio and
Chrome has no Safari codec table, so an iPad UA in Chrome is the one place `deviceDetection`'s isIOS
branches, the unlock path and Howler's touch-platform pool run WHILE clips can still play. It is not
Safari and not the device — the codec verdict still only comes from `webkit.mjs`.

The probe sorts every `play()` into four buckets, and the classification is the whole difficulty —
three of the four look like silence and are not:
- **prime** — deliberately silent unlock clips: ttsClient's `SILENT_UNLOCK_CLIP` (`data:audio/wav`) and
  Howler's `_unlockAudio` walking its 10-node html5 pool. Under an iPad UA that pool produced **22**
  src-less `play()` calls in one run; a naive rule reads them as 22 silent clips. Any element with **no
  src** is a prime by definition.
- **preempted** — `play()` rejected `AbortError`. This is the app's documented no-queue model (new audio
  cancels current; `ttsClient.play` treats `AbortError` as a cancellation too). Normal on fast taps.
- **failed** — real silence: `NotAllowedError` (the iOS gesture rule), `NotSupportedError` /
  `MEDIA_ERR_DECODE` (the Ogg shape), muted, volume 0, or play() **resolved and the clock never moved**.
- **sounded** — `currentTime` actually advanced past 50ms.

Verdict is `SILENT` if anything **failed**, or if a decode failed, or if nothing ever sounded (all
pre-empted = something is cancelling narration, a bug class this repo has hit).

Two ordering traps, both found by re-breaking rather than by reading:
- **Check muted/volume BEFORE the clock.** A silenced element advances `currentTime` perfectly normally,
  so testing progress first scores the loudest possible bug as a success.
- **`AbortError` is not failure**, but *only* pre-empted with nothing ever heard still must fail.

Proven by re-break (each mutation reverted; each produced a distinct correct verdict): `volume = 0` in
`ttsClient.play` → `2 of 2 clips genuinely failed` + exit 1; a bad `src` → `NotSupportedError` naming the
file; a `load()` 60ms after `play()` → `nothing was ever heard: all 2 clips were pre-empted`.

**Limits — state these when reporting.** It proves the browser decoded audio and the clock advanced. It
cannot prove loudness, that the right Danish words were spoken (use the prebaked-src → manifest recipe
below for that), mix balance, or that a device's hardware route was audible. For Howler's WebAudio path
(SFX) the ceiling is "decoded + source started" — there is no clock to read. Under `--audio-report`
`webkit.mjs` also prints the app's own `[audio-unlock]`/`[tts]`/Howler **warnings**, which the drivers
otherwise drop (they surface only console *errors*) and which are usually the most informative lines.

### Driving a TAP (and why a bad probe reports a working tap as broken)
Every drag game also answers on a tap and vice versa (`.claude/rules/drag-and-drop.md`), so a gesture
sweep has to drive both. `--click`'s `element.click()` fires no `pointerdown`, and the tap path measures
pointer travel — so dispatch the real trio at ONE point: `pointerdown`, `pointerup`, then a `click`,
all with the same `clientX/Y`.

**Dispatch on the DEEPEST element, not the wrapper.** A finger lands on the innermost node and the click
bubbles up; a synthetic click on an ancestor never reaches a descendant `<button>`'s handler — and the
tap handlers live on those buttons (`TactileTile`, `AnswerTile`). Getting this wrong is a **false
negative**: it reported Stav Ordet's tap as broken when the product was fine, which is the expensive
direction of wrong. Resolve the target as `el.querySelector('button') || el` in both your tap AND drag
helpers.

```js
const hit = el.querySelector('button') || el
const r = hit.getBoundingClientRect(), x = Math.round(r.left+r.width/2), y = Math.round(r.top+r.height/2)
fire('pointerdown',x,y,hit); await sleep(30); fire('pointerup',x,y,hit)
hit.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,composed:true,clientX:x,clientY:y}))
```

Then prove a drag does **not** also fire that tap — one gesture must not answer twice. Dispatch the
trailing click your helper would suppress (a browser fires one whenever pointerdown/up share an
ancestor) and assert nothing scored, in both shapes: **release ~70px into empty space**, and a
**wiggle-and-return** that moves well past the threshold and releases back on the tile.

Pick the observable per game — a count is usually the honest one (draggables remaining,
`[aria-disabled="true"]`, `[data-tile-state]` leaving `idle`); see the difficulty-sweep table below for
which signal each family actually moves. Two that mislead: Hvilken Farve?'s prompt object is **not**
inside `[data-prompt-focus]` (its "solved" signal is an `<img>` appearing inside the swatch droppable),
and a correct answer ADVANCES the question, so allow >2s before re-reading state.

### Driving dnd-kit drag-and-drop (the drag games)
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

To verify audio **plumbing** rather than wording (codecs, missing files, silent fallbacks), use
**`--audio-report`** (above) — it supersedes the hand-rolled version of this check. The older technique
is still a useful cross-check: read `performance.getEntriesByType('resource')` filtered to `/sounds/` —
a request is itself proof Howler's codec gate passed, since a rejected codec makes **no** request at all.
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
- Behaviour: `--keep-audio-modal` · `--port <n>` · `--audio-report` (see above; exits 1 on `SILENT`).
  Exit code is non-zero if a `--wait-for`/click target never appears (so failures are loud, not
  silently green).
- `webkit.mjs` adds `--device <ipad|ipad-portrait|iphone|iphone-landscape|wide>` · `--dark` ·
  `--reduced-motion` · `--tap "<css>"` · `--dom-click "<css>"`, and its `--click` is real trusted input.

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
- **Never put a `//` comment in an array you `.join('')` into one line** — it comments out the entire
  rest of the probe. The run then fails to parse on every viewport at once, which reads like the app
  broke, not the harness. Put comments *between* the string elements, or use `/* … */`.
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
- **A CRASHED route still satisfies `--wait-for`, and then your probe passes VACUOUSLY.**
  `AppErrorBoundary`'s "Prøv igen" is a real `[role=button]`, so a wait/selector aimed at page content
  matches it, every `--measure` succeeds, and an "is anything overlapping?" probe cheerfully reports
  **0 overlaps on a page with 0 tiles**. This is not hypothetical: a parallel session's half-saved file
  crashed `/math` mid-sweep and would have turned 100 configurations green. So before reporting, **bail
  on `document.body.innerText.includes('Noget gik galt')` AND assert the EXPECTED element count** — then
  prove both guards fire (a deliberately wrong count, and `?crash-test=1`) before you trust the run.
  Distinct from the silent-dead-iteration trap below: there the run fails quietly; here it lies.
- **A MISTYPED ROUTE lies the same way, and it's easier to do.** A 404 renders `NotFound`, which has no
  game chrome at all — so the probe reports "the element is missing" and that reads as a bug in the
  feature you're verifying, not as a bad URL. Enumerate the routes from `App.tsx` instead of guessing
  them from the section names; three guesses in a row were wrong in one sweep (it is `/farver/jagt` not
  `/farver/farvejagt`, `/english/learn` not `/english/laer`, `/ordleg/spelling` not `/ordleg/stav`).
  Cheap insurance: bail on the NotFound copy the same way you bail on `Noget gik galt`.
- **A CSS-transformed element's rect is its PAINTED box, not its layout box** — so a rect-overlap sweep
  reports collisions that do not exist. `SymbolTile` scales its glyph ~2.5–3× to correct for the
  render's transparent padding (see `.claude/rules/scene-assets.md`), which made
  `getBoundingClientRect()` over-report it by that factor: measured 58px into each of Sammenlign Tal's
  answer tiles and ~9px into Plus Opgaver's numerals, with no visual and no hit-test consequence in
  either case. Derive the ink box (it is centred on the rect: `rect.width × inkW/160`), or drop the rect
  comparison and **hit-test** instead — `elementFromPoint` answers the question you actually care about.
- **A killed run leaves Chrome holding port 9333**, and the next invocation then hangs forever against
  that dead instance (looks like the page never loads). After any timeout/interrupt:
  `powershell.exe -Command "Get-Process chrome -EA SilentlyContinue | Stop-Process -Force"`.
- **Two driver runs cannot share port 9333** — they are not just slow, they collide. A long background
  sweep therefore blocks every other capture until it ends (a screenshot fired alongside one hung until
  its own timeout). Sequence them, or give the second run `--port`.
- **The "Tænd for lyd" modal cannot be reached headlessly.** `?nogate=1` is the only way past the auth
  gate, and `shouldRenderAudioPrompt` explicitly stands the modal down under it (an iPad user-agent
  override does NOT help) — and minting a real session just for a screenshot writes into the owner's
  production DB. Verify its geometry by reproducing the **px** case in any live page instead; see the
  corner-inset section of `.claude/rules/responsive-design.md`.
- **Back-to-back runs occasionally die inside `getJSON`** (the previous Chrome hasn't released the port
  yet) — that's launcher contention, NOT a page bug, so don't go debugging the app. `sleep 2` between
  consecutive invocations, and re-run the one that failed. A sweep over several viewports in one shell
  loop **hides** this: the dead iteration prints nothing and the loop carries on, so count one
  `measure:`/`screenshot saved:` line **per viewport** before claiming "verified at all sizes".
- **Git Bash mangles a leading-slash ARGUMENT into a Windows path.** `--only /math/numbers` reached the
  script as `C:/Program Files/Git/math/numbers`, so the filter matched nothing and three runs printed no
  results at all — which reads like the sweep being broken. Drop the leading slash (`--only math/numbers`)
  or set `MSYS_NO_PATHCONV=1`. Same class as the PowerShell quote-stripping note below.
- **Run the driver on the Windows side too** when working from WSL: WSL cannot reach the
  Windows-bound servers or Chrome's CDP port (NAT). Use
  `powershell.exe -Command "node .claude/skills/ui-screenshot/cdp.mjs --url '...' ..."`.
  PowerShell 5.1 strips embedded double quotes from native args, and the symptom is a silent
  `TIMEOUT waiting for selector` / `eval: undefined`, not a quoting error. Either use **quote-free CSS
  selectors** (`[aria-label^=Til]`, `.MuiDialog-paper [role=button]`) or — more generally, since CSS
  accepts either quote — **single-quote the string INSIDE the selector**:
  `--click "[aria-label='Til de voksne']"`. That survives PS arg passing and keeps exact matching.
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
- **A layout probe's failures are meaningless without a BASELINE.** Before calling any of them a
  regression, re-run the SAME probe at HEAD and diff the two failure sets. **COMMIT YOUR OWN WORK
  FIRST** — this used to read "`git stash`/`git checkout --` the file", and `git checkout HEAD -- <file>`
  silently discards whatever is uncommitted in that file, including the `data-*` probe hook you added
  minutes ago for this very sweep. Restoring the file afterwards brings back HEAD, not your edit, so the
  probe then reports the feature as broken/absent and you debug a phantom (a ceremony "never appeared"
  for three runs). Commit, or use a throwaway `git worktree` at HEAD, and re-check `git status` after. Five of seven "failures" from a section-menu sweep were pre-existing — the shipped code
  was already violating the invariant a code comment in it claimed to hold. Report the delta (fixed /
  introduced / untouched), never the raw count. Same run, same trap in the other direction: **scope the
  selector to a `data-bl-*` hook on the container.** A bare `[aria-label]` sweep also matched the app-bar
  ring and the mascot, which bucketed into phantom extra "rows" and reported 25 failures on a page with
  none. Over-selecting fails loudly; under-selecting passes silently — both lie.
- **A CELEBRATION overlay is not just its content — scope the measurement to the content column.**
  `CelebrationEffect` mounts a **full-viewport `<canvas>`** as a sibling of the column, and react-confetti
  also injects **off-screen sprite `<img>`s**. So a `overlay.querySelectorAll('*')` bounding-box union
  reports a "column" 1213px wide on an 844px viewport (→ a false overflow failure), and
  `overlay.querySelector('img')` returns a **confetti particle** rather than the reward — which then
  measures 59px and looks like the sticker rendered at the wrong size. Both were probe bugs, not layout
  bugs. Pick the non-canvas direct child (`[...o.children].find(e => e.tagName !== 'CANVAS' &&
  !e.querySelector('canvas'))`) and measure inside that.
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
- App sizes to `--vh`; default 540x940 is representative. Useful selectors: the adult settings surface
  opens via a plain click on `[aria-label="Til de voksne"]` (the old 2s hold and its `?adult-tap=1`
  workaround are gone), needs **~4.5s settle**, and its five panes are
  `[data-rail-item=barn|laering|lyd|udseende|konto]`. **On a phone-sized viewport the rail only exists
  at the ROOT** — the surface opens onto the last-viewed pane, so click `[aria-label="Tilbage"]` first
  or the rail selector is simply absent. MUI dialogs render under `.MuiDialog-paper`, popovers under
  `.MuiPopover-paper`.
- **`?nogate=1` also disables `requirePin`** (`authStore.isDevBypass()` short-circuits it), so PIN pads
  raised via `requirePin` never appear headlessly and a "PIN-gated" path is really being driven
  un-gated. The only pad you can exercise is one a component raises DIRECTLY — e.g. the
  account-deletion pad in the Konto pane, which is how the settings dialog↔pad stacking was hit-tested.
- **DEV query params force states deterministically for capture** (all DEV-only — see
  `src/utils/devHarness.ts`): `?fx=correct|wrong|hint|streak` forces one tile/board into that feedback
  state (no need to solve), `?seed=<n>` makes questions deterministic (probe with `--eval` to find a
  seed that yields the case you want, e.g. a count-mode number or a high comparison pile), `?nogate=1`
  skips the audio welcome/permission gate, `?reduce=1` forces reduced-motion, `?theme=<id>` sets the skin.
- **`?theme=` takes a REGISTERED id and an unknown one SILENTLY HALF-WORKS.** The ids are
  `kid`/`ocean`/`space`/`dino` (`src/theme/themes.ts`) — Regnbue is **`kid`**, not `rainbow`. A bogus id
  falls back to the default TOKENS, so the page looks like the default skin and nothing errors, but
  `loadSceneAssets(id)` returns `null` — so the parallax world, the mascot poses and the
  `ProgressionCompanion` all render **art-less**. An empty companion ring in a ceremony was chased as a
  missing-art bug for several runs before the URL turned out to be the cause. If art is inexplicably
  absent, check the theme id first.
- **Auto-played game TTS often doesn't fire in headless** (no real audio device), so the fetch-capture
  audio recipe is unreliable for a game's welcome/prompt — it works for **tap-triggered** echoes (browse
  screens, answer taps), not the gated auto-play. Confirmed with `--audio-report`: a bare Chrome run of
  `/alphabet/quiz` reports `NO AUDIO ATTEMPTED`, and tapping `[aria-label="Hør igen"]` then plays a real
  prebaked clip (clock advances ~1.5s of a 2.0s file). So **drive a trigger; never read "nothing played"
  on mount as a defect.** To identify which quiz **subject** is showing without
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

## Verifying a bug-report capture (snapdom A/B)

The bug-report screenshot is NOT a photograph — snapdom clones the DOM, copies each node's *computed*
style onto the clone and rasterises that through an SVG `<foreignObject>` (CLAUDE.md, adult-tools
bullet). The only way to prove a capture change is to A/B it against a real screenshot of the SAME
frame, so do this for ANY edit to `screenshotService.ts` or its snapdom options.

One run gives you both: `--eval` fires the app's own `captureScreenshot()` and prints its data URL,
then `--out` takes the CDP screenshot. Redirect stdout to a file, slice the base64 after
`DATA:data:image/jpeg;base64,`, and pixel-diff the two with `sharp` (already a devDependency) from a
script **inside the project**.

```bash
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/?nogate=1&theme=ocean' \
  --w 1251 --h 869 --wait-for '#root > *' --settle 2000 --out real.png \
  --eval "(async()=>{const m=await import('/src/services/screenshotService.ts');
           const d=await m.captureScreenshot(); return 'DATA:'+d})()" > out.txt
```

Four things that make the result trustworthy:

- **`--eval` runs BEFORE `--out`**, so ~1s of ambient drift (bubbles, idle breathe, mascot pose) sits
  between the two frames and shows up as a real-looking diff. Discount moving decor; judge text,
  boxes and colour. Freeze what you can (`?reduce=1`) before blaming the capture.
- **A near-zero diff is a FAILURE signal, not a pass.** Two blank captures diff to `0.00`. A parallel
  session's mid-edit `SyntaxError` (a missing export) stopped the app mounting, and the run reported
  `ms=45`, `mean abs diff: 0.00` — perfect scores on an app that never rendered. Always read the
  driver's `TIMEOUT waiting for selector` / `page exceptions` lines before believing a number.
- **Assert nothing leaked.** `stabilizeForCapture` mutates the live DOM and restores it in a `finally`.
  In the same `--eval`, after the capture, count `[style]` nodes still carrying
  `margin-left: …!important` / `backdrop-filter: none !important` / `overflow: visible !important` —
  it must be 0, or the child is left looking at a page you edited.
- **Cover the shapes, not just one page**: a centred pill (Min Bog's header count → `margin:auto`), a
  long label near its `max-width` (home's "Tal og Regning" → false ellipsis), a frosted card over
  art (Min Bog's page panel → `backdrop-filter`), a dark skin, and phone landscape.

To attribute a defect, get at the clone itself rather than guessing — pass a plugin and keep the
context: `plugins: [{name:'spy', afterClone(ctx){ ref = ctx }}]` gives you `ctx.clone` (the styled
clone) and `ctx.classCSS` (the flat `.cNN{…}` rules snapdom generated), and `snapdom(...).url` is the
SVG data URL you can `decodeURIComponent` and read. Bare `import('@zumer/snapdom')` does NOT resolve
in `--eval`; use `/node_modules/@zumer/snapdom/dist/snapdom.mjs`.

**Known unexplained residual:** `/album`'s "x / 9 samlet" line does not paint, while the clone holds
the element with the right box, colour and font and the surrounding layout is pixel-identical. Ruled
out: font family, snapdom's `::first-letter` materialisation, multi-text-node children, geometry, and
snapdom 2.23.1 with and without `reconcile`. Don't re-run those four.

## Cleanup
Delete temp PNGs when done. Chrome is killed each run. Stop the dev servers (free 3001/5173) if you
started them only for the test.
