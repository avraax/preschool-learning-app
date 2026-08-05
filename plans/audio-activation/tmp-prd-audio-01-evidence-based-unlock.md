# PRD — Audio activation: an evidence-based verdict, and no blocking modal

Status: authored 2026-08-05, **NOT IMPLEMENTED**. One work item, five files, plus a rules update.

Comes out of the 2026-08-05 diagnosis session (code read + WebKit-source research, no play-test). The
owner's report: on a cold launch of the installed PWA on the iPad, **narration is already audible and
the blocking "Tænd for lyd" modal appears anyway** — it blocks the board, and dismissing it changes
nothing. Occasionally audio genuinely *is* off, so the modal is wrong in both directions.

---

## 1. The problem

### 1.1 The verdict is uncorrelated with whether the child can hear anything

`src/contexts/SimplifiedAudioContext.tsx:192`

```ts
const isWorking = audioContextWorking || speechSynthesisWorking
```

Both halves are wrong, in opposite directions.

- **`speechSynthesisWorking` is a lie by construction.** It is set to `true` at `:179` because
  `speechSynthesis.speak(<empty utterance>)` did not *throw*. No `onstart`, no `onend`, nothing
  observed. It is a pure false-positive generator, and because it is OR'd it can single-handedly latch
  `hasUnlockedRef` (`:198`) for the whole session.
- **`audioContextWorking` watches the wrong object.** It is `ctx.state === 'running'` (`:188`) on a
  **probe** `AudioContext` that never plays a sample. Narration does not go through it — narration
  plays through `ttsClient`'s shared `<audio>` element (`ttsClient.ts:129-135`). SFX go through
  `Howler.ctx` (WebAudio, `sfxClient.ts:149`). Music goes through Howler's **HTML5** backend
  (`musicClient.ts:247`). All three audible channels can be working while the watched context sits
  `suspended`. **That is the reported false negative, exactly.**

This is the same class of defect the app already documented once: `.claude/rules/audio-system.md` —
"**`isWorking` was TRUE right through the Ogg failure**". The lesson was applied to
`src/config/narrationHealth.ts` for the two audio-only games and **never propagated to the modal**.

### 1.2 The one real evidence signal is thrown away

`ttsClient.primePlaybackElement()` (`ttsClient.ts:143-167`) plays a 50 ms silent WAV through the actual
narration element inside the unlock gesture. Its promise resolving is the closest thing this app has to
proof that narration is unlocked; its rejecting with `NotAllowedError` is proof that it is not. Both
outcomes are `console.warn`ed and discarded.

`ttsClient.consecutivePlaybackFailures` / `notePlaybackOk()` (`ttsClient.ts:104`, `241-249`) — the
"a clip reported a duration, so sound really came out" signal — is mirrored into React state
(`SimplifiedAudioContext.tsx:305-313`) and consulted **only** by `config/narrationHealth.ts`. The modal
never sees it.

### 1.3 `showPrompt` is a latch that nothing withdraws

The arming effect (`:320-337`) sets `showPrompt: true` 1500 ms after mount and **nothing but
`hidePrompt` ever clears it**. `shouldRenderAudioPrompt` (`contexts/audioPromptPolicy.ts:31-39`) does
not consult `isWorking` at all. So a tap whose unlock resolves *after* the timer fires leaves the modal
standing over an app that is already talking. On iOS `resume()` can lag well past 1.5 s.

### 1.4 Four facts from WebKit that the current code contradicts

All verified against WebKit source / layout tests / Bugzilla, not blog posts:

1. **`ctx.state === 'running'` is not liveness.** WebKit bug 263627 (iOS 17.0.3, still open): after a
   foreground restore the context reports `running` with `currentTime` **frozen**. The robust probe is
   `currentTime` monotonicity across ~120 ms; the documented recovery is `suspend()` → `resume()`.
   https://bugs.webkit.org/show_bug.cgi?id=263627
2. **An interruption ENDS IN `suspended`, not `running`.**
   `LayoutTests/webaudio/audiocontext-state-interrupted.html`: "running AudioContexts will not resume
   after an interruption ends". So `onstatechange` at `:154-161` re-arms `needsUserAction` after every
   app-switch round trip even though audio is fine.
3. **WebKit needs *transient* activation for the first Web Audio start, not sticky.**
   `AudioContext.cpp` → `shouldDocumentAllowWebAudioToAutoPlay` returns
   `window->hasTransientActivation()`; the sticky `hasHadUserInteraction()` branch is a site quirk for
   zoom.com. This is *stricter* than the Web Audio spec permits, and it is why the existing in-gesture
   ordering in `initializeAudio` (`:144-190`) is load-bearing and must not be touched.
4. **The "4 AudioContext limit" is a myth here** — WebKit's cap is inside `#if OS(WINDOWS)` (verified on
   the WebKit-7614/7615/7616 tags, i.e. the Safari 15–17 era). Not a constraint on iPadOS. The cost of
   many contexts in this app is the state divergence in §1.1, not a quota.

### 1.5 Two capabilities the app doesn't use, both available on the 17.7 floor device

- **`navigator.userActivation`** (Safari **16.4**+, `safari_ios` mirrors) appears **nowhere in the
  repo**. It is the only way to distinguish "audio is blocked" from "nobody has tapped yet" — precisely
  the distinction the prompt needs, and the one the 1500 ms timer was a bad proxy for.
- **`navigator.audioSession.type = 'playback'`** (Safari **16.4**+). Since iOS 17 the default session
  type is `ambient`, which is **silenced by the device mute state**. WebKit engineer Jean-Yves Avenard,
  bug 237322 (`RESOLVED CONFIGURATION CHANGED`): *"Add in your code something like
  `navigator.audioSession.type = 'playback'` and audio will not be suspended… By default the type is
  `ambient` and so audio will be muted if the phone is muted."*
  https://bugs.webkit.org/show_bug.cgi?id=237322 — **this is a candidate root cause of the "sometimes
  audio really IS off" half of the report**, and it is one feature-detected line.
  Note: only `.type` is unconditionally exposed; `.state`/`.onstatechange` sit behind
  `EnabledBySetting=DOMAudioSessionFullEnabled` in WebKit's IDL, so **feature-detect, don't assume**.

### 1.6 The modal is the wrong pattern regardless

Every current reference implementation unlocks on the **first gesture anywhere**, with no primer
surface: Howler's `_unlockAudio` (capture-phase `touchstart`/`touchend`/`click`/`keydown`), Tone.js
(`await Tone.start()` inside any handler), PlayCanvas (detect → queue → resume on `visibilitychange`),
and Chrome's own autoplay guidance. This app **already does that** — `SimplifiedAudioContext.tsx:284-300`
plus `App.tsx:170-185` — and the child must tap the home menu to reach any game, so the primer has no
job to do. `docs/prd/PRD-09-reward-and-result-ux.md:61-62` already flagged the modal as adult-worded and
full-screen on every cold start.

One more in-tree hazard worth naming: **Howler unlocks in the capture phase** and, on iPad (48 kHz ≠
44.1 kHz), *closes and rebuilds* `Howler.ctx` inside that first touch. The provider listens in the
**bubble** phase, so it can end up observing a context that no longer exists.

---

## 2. Non-goals

- **No change to the no-queue model**, `ttsClient`'s epoch token, the circuit breaker, or the prebake
  pipeline.
- **No change to the SFX or music channels**, or to `howlerGuard.ts`.
- **No change to the in-gesture ordering** in `initializeAudio` (resume kicked-but-not-awaited → prime →
  speech unlock → await only to verify). It is correct and it is the thing WebKit's transient-activation
  rule demands. Everything new must also run before the first `await`.
- **Not collapsing the `simplifiedAudioContextInstance` module global** (flagged in
  `plans/tmp-prd-audio-rebuild.md:272`). Owner scoped this to the readiness/prompt layer.
- No change to `narrationHealth`'s *behaviour* — see §4.6.
- No schema change. `progressStore` is per-child and inert until `profileStore.attach()`; this state is
  per-device.

---

## 3. The model

One pure module, `src/config/audioReadiness.ts`, **replacing** `src/contexts/audioPromptPolicy.ts`
(move its two regression cases across — see §5.4). Pure and Node-importable for the same reason
`narrationHealth.ts` is: the interesting part is *which signals it takes*, and that must be testable
with no DOM.

```ts
export interface AudioReadinessInput {
  /** navigator.userActivation.hasBeenActive — FALSE when unsupported. See §3.1. */
  hasBeenActive: boolean
  /** ttsClient's silent-WAV prime, latest result this session. */
  primeResult: 'unknown' | 'ok' | 'blocked'
  /** ttsClient.getHealth().consecutivePlaybackFailures */
  playbackFailures: number
  /** A real clip has reported a duration this session (notePlaybackOk fired at least once). */
  playbackOkOnce: boolean
  /** currentTime advanced on ANY app-owned AudioContext. See §4.2. */
  ctxLive: boolean
}

export type AudioReadiness = 'idle' | 'live' | 'blocked'
```

The verdict, in order:

| verdict | condition | surface |
|---|---|---|
| `live` | `playbackOkOnce \|\| primeResult === 'ok' \|\| ctxLive` | none |
| `idle` | not `live`, and `!hasBeenActive` | **none** — nobody has tapped yet, which is not a failure |
| `blocked` | not `live`, `hasBeenActive`, and (`primeResult === 'blocked'` \|\| `playbackFailures >= PLAYBACK_FAILURES_UNHEALTHY`) | the cue |
| `idle` | otherwise (tapped, no positive evidence, no negative evidence either) | none — wait for evidence |

Reuse `PLAYBACK_FAILURES_UNHEALTHY` from `src/config/narrationHealth.ts`; do not re-declare the 2. Its
justification (one failure is routinely transient) applies unchanged here.

**"Unverified is not broken."** The last row is the whole point: with no evidence in either direction
the app says nothing and stays silent-capable. That mirrors the rule that already governs
`narrationHealth` — a cold start must never read as dead.

The final render decision keeps its own function, as today:

```ts
export function shouldShowAudioCue(s: {
  readiness: AudioReadiness
  authUiOpen: boolean
  devNoGate: boolean
}): boolean
```

`devNoGate` and `authUiOpen` still stand the cue down. **One blocking overlay at a time stays the
rule** even though the cue no longer blocks — "tryk for lyd" is meaningless before you know who is
playing, and `authUiOpen` is the app's single notion of that (`.claude/rules/audio-system.md`).

### 3.1 `hasBeenActive` when unsupported

`navigator.userActivation` is Safari 16.4+, so the floor device has it — but a headless engine or an
older browser may not. **Unsupported ⇒ `hasBeenActive: false` ⇒ never `blocked`.** Fail toward silence,
never toward a false accusation. Track it separately in the bug report so an unsupported environment is
distinguishable from a genuinely untapped one.

---

## 4. Changes, by file

### 4.1 `src/services/ttsClient.ts`

`primePlaybackElement()` returns `Promise<'ok' | 'blocked' | 'error'>` instead of only logging.

- **The `a.src = …` / `a.play()` pair must stay synchronous** — the method is called from inside the
  unlock gesture and iOS consumes the activation across an `await`. Only the *result* becomes
  observable; the call shape does not change.
- Classify: resolve ⇒ `'ok'`; reject with `name === 'NotAllowedError'` ⇒ `'blocked'`; any other
  rejection or throw ⇒ `'error'` (a decode/format problem is not an activation problem — that is what
  `consecutivePlaybackFailures` is for).
- **Keep the existing `console.warn`s.** The bug-report diagnostics ring reads them and the
  `[audio-unlock]` prefix is how a production report is debugged today.

Add a `playbackOkOnce` boolean to `getHealth()` — set by `notePlaybackOk()`, never cleared.

### 4.2 `src/utils/audioLiveness.ts` (new)

```ts
export async function probeContextLive(ctx: AudioContext | null): Promise<boolean>
export async function recoverFrozenContext(ctx: AudioContext): Promise<void>
```

- `probeContextLive`: sample `ctx.currentTime`, wait ~120 ms, require a **strict increase**. A null
  context, or a `closed` one, is `false`.
- `recoverFrozenContext`: `await ctx.suspend()` then `await ctx.resume()` — the documented workaround
  for WebKit 263627 (`running` with a frozen clock after a foreground restore).
- **Re-read `Howler.ctx` on every probe.** Howler replaces its context on iPad's first touch; a cached
  reference goes stale silently. The probe covers the app's own context *and* `Howler.ctx`, OR'd.
- **This probe must never run inside the unlock gesture** — it awaits, and an await burns the
  activation. Run it after the gesture's synchronous work has been kicked off.

### 4.3 `src/contexts/SimplifiedAudioContext.tsx`

- **Delete `speechSynthesisWorking` from the verdict.** Keep the empty-utterance unlock call itself
  (it costs nothing and does unlock Web Speech); just stop treating "didn't throw" as evidence.
- **Delete the 1500 ms arming effect** (`:320-337`) and the `showPrompt` state field. The cue is derived
  from the verdict on every render — no latch to go stale.
- **Set `navigator.audioSession.type = 'playback'`** in-gesture, feature-detected, as the *first*
  statement of the synchronous block in `initializeAudio` (before `resume()`), wrapped in try/catch.
- Feed the pure model: capture `primeResult` from §4.1, read `playbackOkOnce`/`playbackFailures` from
  the existing health subscription (`:305-313`), and set `ctxLive` from §4.2 after the gesture.
- **`onstatechange → 'suspended' | 'interrupted'` must NOT feed `blocked`.** It re-arms silent
  re-unlock on the next interaction and nothing else — per §1.4 fact 2 that transition is the *normal*
  aftermath of an app switch. This is the invariant that the current `hasUnlockedRef`/`userDismissedRef`
  pair exists to approximate; with an evidence-based verdict both refs can go.
- Add a `visibilitychange → visible` handler: re-probe liveness, and if a context reports `running`
  with a frozen clock, call `recoverFrozenContext`. Throttle it — this fires on **every** iPad app
  switch (the same hazard `.claude/rules/auth.md` documents for `validate()`).

### 4.4 `src/components/common/AudioBlockedCue.tsx` (replaces `SimplifiedAudioPermission.tsx`)

A small **non-blocking** tappable chip. Not a scrim, not a full-screen box, nothing behind it is
covered.

- Shape: the shared `TactilePill` material, top-centre, clear of the reward ring and the corner mascot
  (`MASCOT_CORNER_SIZE` — see `.claude/rules/responsive-design.md`).
- Icon: MUI `VolumeOff` (an SVG, so the empty-allowlist no-emoji rule holds — `src/config/noEmoji.test.ts`).
- Motion: `hintPulse` from `src/theme/idleMotion.ts` — a **CSS keyframe animation**, never a framer
  `repeat: Infinity` (`.claude/rules/animation-and-performance.md`; `idleMotionBudget.test.ts` would
  fail the build anyway).
- Copy: child-facing and short — **"Tryk for lyd"** — not the current adult wording ("Tryk på knappen
  for at høre dansk tale og musik i spillet. Dette kræves kun én gang").
- **`onClick` only.** The tap-through rule in `.claude/rules/audio-system.md` still applies: closing or
  acting on `pointerdown`/`touchstart` — or from async work a down-event starts — hands the trailing
  click to whatever was behind. The cue is small, so the blast radius is smaller, but the rule is
  unconditional.
- Tapping re-runs the unlock. The cue disappears when the verdict leaves `blocked`; there is no dismiss
  button and no session latch — if audio starts working, the evidence says so.
- 44px minimum touch target.

Delete `SimplifiedAudioPermission.tsx`. Also remove the `--keep-audio-modal` handling and the
auto-click of "Start lyd nu" in `.claude/skills/ui-screenshot/cdp.mjs:200-201`,
`webkit.mjs:151-154`, `perf.mjs:150` — there is nothing left to click.

### 4.5 Persistence

One device-scoped localStorage key, `bl-audio-ever-worked`, set the first time the verdict reaches
`live`. **Not `progressStore`** — that is per-child and inert until `profileStore.attach()`, and this
fact is about the device.

Honest scope, stated because it is smaller than it sounds: with the primer gone there is no first-run
modal left for this flag to suppress. Its two real jobs are

1. an adult-menu line under "Til de voksne" → Lyd — *"Lyd har virket på denne enhed"* — so the adult can
   tell "never worked here" from "worked and then stopped"; and
2. a field in the bug report (§4.7).

It must **not** gate the cue. A device where audio worked yesterday can be blocked today.

Add it to the KEPT list in `src/utils/storageReset.ts`'s comment block (it is not swept — the sweep is
marker-guarded and enumerates exact keys and one prefix, so a new key is untouched by default; the
comment is what stops a future session from adding it to `EXACT_KEYS`).

### 4.6 `src/config/narrationHealth.ts`

`isNarrationHealthy`'s **behaviour must not change** — its `unlockedOnce && !isWorking` clause exists
because the naive form printed Tal Quiz's numeral over its own answer tiles on every cold launch.

Re-express it in terms of the new inputs (`readiness !== 'blocked'` plus the failure count) **only if
the existing `narrationHealth.test.ts` passes unchanged**. If it doesn't, leave the module alone and
feed it the equivalent booleans. The degraded-mode rule is not what this PRD is fixing.

### 4.7 Bug report

Extend `SimplifiedAudioController.getPermissionSnapshot()` (`:477-494`, read by
`services/bugReporter.ts:137-139`) with: the readiness verdict, `primeResult`, `playbackOkOnce`,
`hasBeenActive` (plus a `userActivationSupported` flag), per-context liveness (app context and
`Howler.ctx` separately), `audioSessionType` if readable, and `everWorked`.

That set is chosen so a single future report answers "was it blocked, was it muted, or was it silent?"
without a second round trip to the owner.

---

## 5. Verification

**A claim must name its rung** (`CLAUDE.md`). Recipes: `.claude/skills/ui-screenshot/`.

### 5.1 Rung 1 — `cdp.mjs --audio-report`

- **Cold load, no input for 3 s** → assert **no cue in the DOM**. This is the reported bug, inverted.
- **Then tap** → assert a `/sounds/tts/<hash>.mp3` actually sounded (`--audio-report`'s `sounded`
  bucket, not `pending`), and still no cue.
- **Force-block autoplay** → assert the cue appears, and that tapping it recovers to no-cue once a clip
  sounds.
- Assertions must be tight enough to fail: `--audio-report` exits 1 on `SILENT`, but a cue-presence
  check must assert the element's *absence by selector*, not "the page rendered".

### 5.2 Rung 2 — named probe hazard

**`webkit.mjs` cannot play audio at all.** Under the new policy a real WebKit run will legitimately
reach `blocked` once a gesture happens. Rung 2 may assert layout, no-crash and the cue's geometry — it
may **never** be cited as evidence about the verdict. Write that into the probe's own comment, or a
future session will read a correct `blocked` as a regression.

### 5.3 Rung 3 — the owner's iPad (the residue)

Nothing below is reachable at rung 1 or 2:

- Cold launch × 5 from the home-screen icon → no cue, audio audible.
- App-switcher round trip (background, wait, return) → no cue, narration still works. This exercises
  the `suspended`-aftermath path and the frozen-clock recovery.
- Siri / a phone call mid-game → recovery without a cue.
- **Control Centre silent / mute** → the only way to test `audioSession.type = 'playback'`. Compare
  against the current build: if muted-but-audible is new behaviour, that confirms §1.5 was the second
  root cause.
- Confirm `/api/version`'s `commitHash` first — the installed PWA keeps its loaded bundle until swiped
  away, so a play-test right after a push tests the previous build
  (`.claude/rules/pwa-and-device.md`).

### 5.4 Unit — `src/config/audioReadiness.test.ts`

The full truth table, plus the two regressions carried over from `audioPromptPolicy.test.ts` that must
stay fixed:

- **No surface before any gesture.** (`hasBeenActive: false` ⇒ `idle`, whatever else is set.)
- **No re-arm after a transient iOS suspend once audio has worked.** (`playbackOkOnce: true` ⇒ `live`,
  even with `ctxLive: false`.)

Plus the new ones:

- `primeResult: 'ok'` alone ⇒ `live` (narration element unlocked, context irrelevant).
- `ctxLive: false` + `state === 'running'` is not expressible — assert the module takes **no** `state`
  input at all. That is a source-reading guard in the same shape as the existing ones
  (strip comments first — a plain `includes()` was satisfied by prose once already).
- Unsupported `userActivation` ⇒ never `blocked`.
- `playbackFailures: 1` ⇒ not `blocked` (one failure is transient).

### 5.5 `/re-break` is mandatory

Run the `re-break` skill on every new invariant. Specifically, and the break **must target what the
test measures**:

| break | the test that must go red |
|---|---|
| make `primePlaybackElement` always resolve `'ok'` | the blocked-path case |
| force `hasBeenActive: true` with no evidence | the "wait for evidence" case |
| freeze `currentTime` in `probeContextLive` | the liveness case |
| re-introduce `speechSynthesisWorking` into the OR | the source-reading guard |
| delete the `authUiOpen` stand-down | the one-blocking-overlay case |

A green suite after breaking something *adjacent* proves nothing.

---

## 6. After implementation

- **`.claude/rules/audio-system.md`** — the whole "Navigation Cleanup & Permission" section describes a
  modal that no longer exists. Rewrite it around: the verdict is evidence-based; the cue never blocks;
  `hasBeenActive` is what separates "blocked" from "untapped"; the in-gesture ordering is unchanged and
  still load-bearing; `audioSession.type = 'playback'` is set in-gesture; an interruption ends in
  `suspended` and that is not a failure. Keep the tap-through rule verbatim — it is general.
- **`CLAUDE.md`** — the Audio bullet and the SFX bullet both reference the permission modal indirectly.
- **`docs/ui-reference/`** — the `overlays/` set contains the old modal; re-capture.
- **`docs/device-testing.md`** — record the rung-3 results, especially the mute-switch A/B.

---

## 7. Sources

WebKit source and layout tests (strongest), then Bugzilla, then vendor docs. Community reports are
marked as such and none of the design rests on one.

- `Source/WebCore/Modules/webaudio/AudioContext.cpp` — `shouldDocumentAllowWebAudioToAutoPlay`
  (transient activation; zoom.com quirk), `sourceNodeWillBeginPlayback`, the `#if OS(WINDOWS)`
  context cap.
- `LayoutTests/webaudio/audiocontext-state-interrupted.html` (+ `-expected.txt`) — `resume()` stays
  *pending* while interrupted (it does not reject), and an interruption ends in `suspended`.
- `Source/WebCore/Modules/audiosession/DOMAudioSession.idl` — only `type` is unconditionally exposed.
- https://bugs.webkit.org/show_bug.cgi?id=263627 — `running` with frozen `currentTime`, iOS 17.0.3, open.
- https://bugs.webkit.org/show_bug.cgi?id=237322 — `audioSession.type = 'playback'`, Apple's answer to
  the mute state.
- https://bugs.webkit.org/show_bug.cgi?id=261858 — standalone-PWA-only autoplay/lock-screen breakage,
  iOS 16.x/17.x, open.
- https://webkit.org/blog/13862/the-user-activation-api/ + MDN BCD — `navigator.userActivation`,
  Safari 16.4.
- https://webkit.org/blog/6784/new-video-policies-for-ios/ — which events count for `play()`.
- https://www.w3.org/TR/webaudio/ — the `state` enum is `suspended|running|closed`; `'interrupted'` is a
  WebKit extension outside the TS union.
- Howler `howler.core.js` `_unlockAudio` / `_autoResume` / `_autoSuspend`; PlayCanvas engine PR #4462;
  Tone.js autoplay wiki — the first-gesture-anywhere pattern.
