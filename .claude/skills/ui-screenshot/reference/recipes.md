# Recipes

Command recipes: screenshotting a route, sweeping the app, real WebKit, throttled performance, proving audio made a sound, speech input, driving a tap, dnd-kit drag, passkeys, and the A/B pixel test.

Back to `../SKILL.md`.

## Recipes

```bash
# Wait for the app to render, then screenshot a route
node .claude/skills/ui-screenshot/cdp.mjs --url http://127.0.0.1:5173/alphabet/quiz \
  --wait-for '#root > *' --out shot.png

# Open "Til de voksne" (a plain click on the child's avatar; a PIN/guest gate may intercept) and select
# a settings pane. The settle is now headroom, not a requirement: the capture no longer blocks the
# surface, and rail-ready measured ~530ms under ?nogate=1. Keep a generous value anyway — the surface is
# a lazy chunk, and a short wait silently yields the un-opened page rather than an error.
# PASS --w/--h. Below the `md` breakpoint the surface is fullScreen single-pane push-nav, so the rail
# does not exist: `[data-rail-item=…]` and the rail-footer "Rapportér et problem" are simply absent
# and the click misses with no error. cdp.mjs defaults narrow, so OMITTING the size silently gives you
# the compact layout on a run you thought was iPad-sized.
# The trigger is the CHILD'S AVATAR now (the gear is deleted) — same `aria-label`, top-right.
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/quiz' \
  --w 1024 --h 768 \
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
#   phases: smoke | layout | audio | round | ceremony | difficulty | triggers
#   --only <substr>  --engine chrome|webkit|both  --concurrency n
```
`round` drives 8 tasks and judges advances + XP (play never "ends" — see `probes.md`). `ceremony` seeds
`?rewards=8`, plays to the crossing, and asserts the three things a screenshot cannot show: the reward
overlay opens **without leaving the game**, it **owns the board centre** (`elementFromPoint`), and the
board does **not** advance underneath it.
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
pre-empted = something is cancelling narration, a bug class this repo has hit), or if **no narration was
ever REQUESTED while a WebAudio source played** — SFX alive, TTS dead. That last one used to read
`OK — 0/0 clips played`, and it is the one shape that hid report J62KA perfectly: a hung unlock swallowed
every `speak()` before it could reach an `<audio>` element, while Howler's music and SFX (their own
context, their own elements) played on. `real === 0` means nothing was ever meant to be heard, so a live
SFX buffer cannot redeem it.

### Reproducing a hung unlock (`--simulate-hung-resume`)

Report J62KA (iPhone, iOS 18.7 / Safari 26.6, `/alphabet/learn`): `AudioContext.resume()` never SETTLED —
not "resolved without running the clock", which is what `--simulate-audio-blocked` does and which the app
correctly reports as `blocked`. Nothing rejected, nothing timed out, so the app reached no verdict at all
and every later `speak()` awaited the same dead promise. This is the regression gate for the bounded
unlock (`settleWithin` in `src/utils/audioLiveness.ts`):

```bash
node .claude/skills/ui-screenshot/cdp.mjs --url 'http://127.0.0.1:5173/alphabet/learn?nogate=1' \
  --ipad-ua --audio-report --simulate-hung-resume --block-autoplay --settle 2000 \
  --trusted-tap 'button[aria-label="Hør alfabetet"]' --settle 6000
# audio verdict: OK — 2/3 clips played …      ← bounded: the app waits out its budget and plays anyway
# restore the bare `await resumePromise` and the SAME command reports
# SILENT — no narration was ever requested … SFX alive, TTS dead
```

Two things that made this sim silently inert, both found by re-breaking rather than by reading — check
`window.__hungResumeSim` (`{resumes, statePatched}`) before trusting a green run:

- **Hanging `resume()` alone does nothing here.** Chrome hands the app a context that is already
  `running`, so `initializeAudio`'s `if (state !== 'running')` never calls `resume()` at all. The state
  has to be forced to what the iPhone reported (`ctxState= suspended`), and `--block-autoplay` does not
  do it — the one `resume()` seen in that run was Howler's.
- **`state` lives on `BaseAudioContext.prototype`, not `AudioContext.prototype`.** Patching the latter
  returns `undefined` from `getOwnPropertyDescriptor` and the override is skipped, so the run reported
  `OK` **with the bug restored** — the "mutation never arrived" failure, wearing a passing verdict.

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

### Speech INPUT end-to-end (`mic.mjs`) — a fake microphone fed real Danish

Sig et Ord is the one game rungs 1–2 could never touch, because it needs a *voice*. `mic.mjs` supplies
one: Chrome's `--use-fake-device-for-media-stream` + `--use-file-for-fake-audio-capture=<wav>` replace the
microphone with an audio file (looped), and `--use-fake-ui-for-media-stream` auto-grants permission. It
then drives the real hold gesture and reports one verdict per run.

```bash
node --env-file=.env.local --import ./scripts/js-to-ts-resolve.mjs \
  .claude/skills/ui-screenshot/mic.mjs kat hund sol --viewport=all
node … mic.mjs kat --child          # pitch +40% at the same speed, quieter, rushed
node … mic.mjs stille               # SILENCE → must reach the friendly retry, never hang
node … mic.mjs kat --hold=150       # below MIN_PRESS_MS → must SAY the "hold the button" coach
```

The source audio is the app's own prebaked Azure clips, so any word in `PREBAKED_TTS` works. Run it from
the repo root with **both dev servers up**, and restart `dev-server.js` after touching `api/stt.ts` — it
holds the recognizer config in memory (CLAUDE.md's dev-server note).

- **Verdicts are four, not two**: `HEARD` (+ the word it spelled), `NOT_HEARD` (the game's own retry
  line — a product state), `TOO_SHORT` (the coach state), `STUCK_IN_PROCESSING`, `UNKNOWN` (probe).
- It prints the recorder event trail and the `/api/stt` request/response, so a hang is attributable:
  `NEVER CALLED` (no usable audio — also means no billing), fired-and-hung, or answered.
- **`--child` is a PROXY, not a child.** Pitch/level/tempo only. Whether a real 5-year-old is understood,
  and whether the Danish read-back sounds right, is still rung 3.
- **A moving level meter alone proves nothing** — the bars fall back to a synthetic wave when metering is
  unavailable, which swings just as convincingly. The discriminator is the `stille` run: real metering
  leaves the bars at the 0.35 idle scale, the fallback would swing to ~0.9.

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
  --wait-for '#root > *' --settle 1200 --eval "$(cat <<'JS'
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

**When a singleton has NO `window.__*` handle, make the app hand it over: fire a crash and read the bug
report.** `dispatchEvent(new ErrorEvent('error', …))` from an `--eval` triggers the crash auto-upload, and
`dev-server.js` mirrors it to `.bug-reports/<date>/<CODE>/report.json` (gitignored — delete the probe
report afterwards). That payload carries the audio verdict + evidence, TTS health, progress and the
diagnostics rings, all read from the app's OWN instances. It verified the audio snapshot's field set here
in one shot, and it is faster than adding a debug handle for a one-off question.

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
