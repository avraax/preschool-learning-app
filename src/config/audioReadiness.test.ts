import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { computeAudioReadiness, shouldShowAudioCue, type AudioReadinessInput } from './audioReadiness.ts'
import { PLAYBACK_FAILURES_UNHEALTHY } from './narrationHealth.ts'

// Source-read guards below need the comments GONE before matching: every rule they assert is also
// EXPLAINED in a comment right beside the code, so a plain `includes()` would be satisfied by the prose
// and stay green after the fix itself was deleted (CLAUDE.md: a guard that greps source must strip
// comments first).
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '')

const readStripped = (rel: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))

/** Nothing known: nobody has tapped, nothing primed, nothing played, no clock. */
const base: AudioReadinessInput = {
  hasBeenActive: false,
  primeResult: 'unknown',
  playbackFailures: 0,
  playbackOkOnce: false,
  ctxLive: false,
}

const tapped = { ...base, hasBeenActive: true }

// ----- positive evidence wins, from any of the three sources -------------------------------------

test('a clip that actually sounded ⇒ live', () => {
  assert.equal(computeAudioReadiness({ ...base, playbackOkOnce: true }), 'live')
})

test("primeResult 'ok' ALONE ⇒ live — the narration element is unlocked, the context is irrelevant", () => {
  // This is the reported false negative, as a unit: narration audible while the watched probe
  // AudioContext sits suspended. The old verdict was `ctx.state === 'running' || <the speech lie>`.
  assert.equal(computeAudioReadiness({ ...base, primeResult: 'ok' }), 'live')
  assert.equal(computeAudioReadiness({ ...tapped, primeResult: 'ok' }), 'live')
})

test('a moving AudioContext clock ⇒ live', () => {
  assert.equal(computeAudioReadiness({ ...base, ctxLive: true }), 'live')
})

test('positive evidence OUTRANKS negative evidence — it is later in time, not weaker', () => {
  assert.equal(
    computeAudioReadiness({
      ...tapped,
      primeResult: 'blocked',
      playbackFailures: 9,
      playbackOkOnce: true,
    }),
    'live',
  )
})

// ----- the two regressions carried over from audioPromptPolicy.test.ts --------------------------

test('CARRIED OVER: no surface before any gesture — untapped is not a failure', () => {
  // `hasBeenActive: false` must win over EVERY negative signal. The old 1500ms arming timer was a bad
  // proxy for this, and it fired over an app that was already talking.
  assert.equal(computeAudioReadiness({ ...base, primeResult: 'blocked' }), 'idle')
  assert.equal(computeAudioReadiness({ ...base, playbackFailures: 99 }), 'idle')
  assert.equal(
    computeAudioReadiness({ ...base, primeResult: 'blocked', playbackFailures: 99 }),
    'idle',
  )
})

test('CARRIED OVER: no re-arm after a transient iOS suspend once audio has worked', () => {
  // An interruption ENDS IN `suspended`, not `running` (WebKit's own
  // audiocontext-state-interrupted.html), so this is the aftermath of EVERY iPad app switch. Before
  // this model it re-armed the modal 1.5s later and neither the ✕ nor the button could keep it closed.
  assert.equal(
    computeAudioReadiness({ ...tapped, playbackOkOnce: true, ctxLive: false }),
    'live',
  )
})

// ----- negative evidence, and only with a gesture behind it --------------------------------------

test("primeResult 'blocked' AFTER a gesture ⇒ blocked", () => {
  assert.equal(computeAudioReadiness({ ...tapped, primeResult: 'blocked' }), 'blocked')
})

test('a playback-failure STREAK after a gesture ⇒ blocked', () => {
  assert.equal(
    computeAudioReadiness({ ...tapped, playbackFailures: PLAYBACK_FAILURES_UNHEALTHY }),
    'blocked',
  )
})

test('ONE playback failure is transient — never blocked', () => {
  // Same justification as narrationHealth's: a stale prebaked file 404ing through to Azure, one
  // blocked play before the unlock gesture. The threshold is REUSED from there, not re-declared.
  assert.equal(PLAYBACK_FAILURES_UNHEALTHY, 2)
  assert.equal(computeAudioReadiness({ ...tapped, playbackFailures: 1 }), 'idle')
})

test('THE POINT: tapped, no positive evidence and no negative evidence either ⇒ idle', () => {
  // "Unverified is not broken." With nothing to go on the app says nothing and stays silent-capable.
  assert.equal(computeAudioReadiness(tapped), 'idle')
  assert.equal(computeAudioReadiness({ ...tapped, primeResult: 'unknown' }), 'idle')
})

test('unsupported navigator.userActivation ⇒ NEVER blocked (it arrives as hasBeenActive: false)', () => {
  // §3.1: fail toward silence, never toward a false accusation. A headless engine or a pre-16.4 Safari
  // cannot answer "has anyone tapped?", so it must not be told the device is broken.
  for (const primeResult of ['unknown', 'blocked'] as const) {
    for (const playbackFailures of [0, 1, 2, 50]) {
      assert.notEqual(
        computeAudioReadiness({ ...base, hasBeenActive: false, primeResult, playbackFailures }),
        'blocked',
      )
    }
  }
})

test('the full truth table has no third negative path into blocked', () => {
  // Exhaustive over the input space that matters, so a new OR-branch cannot slip in unnoticed.
  const verdicts = new Set<string>()
  for (const hasBeenActive of [false, true]) {
    for (const primeResult of ['unknown', 'ok', 'blocked'] as const) {
      for (const playbackFailures of [0, 1, 2]) {
        for (const playbackOkOnce of [false, true]) {
          for (const ctxLive of [false, true]) {
            const v = computeAudioReadiness({
              hasBeenActive,
              primeResult,
              playbackFailures,
              playbackOkOnce,
              ctxLive,
            })
            verdicts.add(v)
            const positive = playbackOkOnce || primeResult === 'ok' || ctxLive
            const negative = primeResult === 'blocked' || playbackFailures >= PLAYBACK_FAILURES_UNHEALTHY
            const expected = positive ? 'live' : !hasBeenActive ? 'idle' : negative ? 'blocked' : 'idle'
            assert.equal(v, expected, JSON.stringify({ hasBeenActive, primeResult, playbackFailures, playbackOkOnce, ctxLive }))
          }
        }
      }
    }
  }
  assert.deepEqual([...verdicts].sort(), ['blocked', 'idle', 'live'])
})

// ----- shouldShowAudioCue: ONE blocking overlay at a time ----------------------------------------

test('only `blocked` surfaces the cue', () => {
  assert.equal(shouldShowAudioCue({ readiness: 'blocked', authUiOpen: false, devNoGate: false }), true)
  assert.equal(shouldShowAudioCue({ readiness: 'idle', authUiOpen: false, devNoGate: false }), false)
  assert.equal(shouldShowAudioCue({ readiness: 'live', authUiOpen: false, devNoGate: false }), false)
})

test('an open auth/onboarding surface stands the cue down', () => {
  // "Tryk for lyd" is meaningless before you know who is playing, and the modal this replaces painted
  // over the mandatory PIN setup and "who is playing?" twice — the first fix was a z-index bump.
  assert.equal(shouldShowAudioCue({ readiness: 'blocked', authUiOpen: true, devNoGate: false }), false)
})

test('devNoGate (?nogate=1) stands it down so every screenshot recipe keeps working', () => {
  assert.equal(shouldShowAudioCue({ readiness: 'blocked', authUiOpen: false, devNoGate: true }), false)
})

test('standing down never FORCES the cue on', () => {
  assert.equal(shouldShowAudioCue({ readiness: 'live', authUiOpen: true, devNoGate: true }), false)
})

// ----- source-reading guards ---------------------------------------------------------------------

test('THE FIX: the model takes NO AudioContext `state` input, at all', () => {
  // `state === 'running'` is not liveness (WebKit 263627: `running` with a frozen clock) and it is the
  // most tempting wrong input to add back. So the absence is asserted structurally: `ctxLive: false`
  // together with `state === 'running'` must not even be EXPRESSIBLE here.
  const src = readStripped('./audioReadiness.ts')
  const start = src.indexOf('export interface AudioReadinessInput')
  const end = src.indexOf('}', start)
  assert.ok(start > 0 && end > start, 'could not locate AudioReadinessInput in the source')
  const iface = src.slice(start, end)
  assert.ok(!/\bstate\b/.test(iface), 'AudioReadinessInput took a `state` field again')
  assert.ok(!/running|suspended|interrupted/.test(src), 'the readiness model reads an AudioContext state again')
})

test('THE FIX: the speechSynthesis lie is not back in the unlock verdict', () => {
  // `speechSynthesis.speak(<empty utterance>)` not THROWING observes nothing — no onstart, no onend.
  // OR'd into the verdict it could single-handedly latch a whole session as "working".
  const src = readStripped('../contexts/SimplifiedAudioContext.tsx')
  assert.ok(
    !/speechSynthesisWorking/.test(src),
    'the empty-utterance result is being treated as evidence again',
  )
  assert.ok(
    /const isWorking = readinessNow !== 'blocked'\s*$/m.test(src),
    "the unlock verdict is no longer exactly the evidence-based one (`readinessNow !== 'blocked'`)",
  )
})

test('THE FIX: every await in the unlock path is BOUNDED — a resume() that never settles cannot mute the app', () => {
  // Report J62KA (iPhone, iOS 18.7, /alphabet/learn): the prime logged OK, the line after it never
  // printed, and one bare `await resumePromise` sat between them — an iOS `resume()` promise that never
  // settled. `initializeAudio()` never resolved, its de-dupe promise never cleared, and every later
  // `speak()` awaited the same dead promise: total silence for the session while Howler's music played.
  const src = readStripped('../contexts/SimplifiedAudioContext.tsx')
  // Both forbidden forms are single-line on purpose: line endings are MIXED in this repo (this test's
  // own file is CRLF, `SimplifiedAudioContext.tsx` is LF — measured, not assumed), so a multi-line anchor
  // matches in one file and passes vacuously in the other. `await primePromise` cannot be
  // forbidden outright — the ternary below legitimately contains it — so forbid the UNCONDITIONAL form.
  for (const bare of ['await resumePromise', 'const primeResult = await primePromise']) {
    assert.ok(
      !src.includes(bare),
      `\`${bare}\` is unbounded again — an iOS promise that never settles mutes the whole app`,
    )
  }
  assert.ok(
    /settleWithin\(resumePromise, UNLOCK_VERIFY_TIMEOUT_MS\)/.test(src),
    'resume() is no longer raced against a timeout',
  )
  assert.ok(
    /settleWithin\(primePromise, UNLOCK_VERIFY_TIMEOUT_MS\)/.test(src),
    'the prime play() is no longer raced against a timeout',
  )
  // A verification that never ARRIVED is no evidence. `'blocked'` would accuse the device of the one
  // thing it did not do — the prime had already succeeded in the report that produced this test.
  assert.ok(
    /primeOutcome === 'settled' \? await primePromise : \('unknown' as const\)/.test(src),
    'a timed-out prime no longer falls back to `unknown` (no evidence)',
  )
})

test('THE FIX: the second brake — ensureAudioReady never waits on the unlock forever, and plays anyway', () => {
  // Deliberately OUTSIDE initializeAudio: the thing that wedged is inside it, and one hung unlock is
  // cached in the context's de-dupe promise, so every tap of the session inherits it.
  const src = readStripped('../utils/SimplifiedAudioController.ts')
  assert.ok(
    !/return await ctx\.initializeAudio\(\)/.test(src),
    'ensureAudioReady awaits the unlock unbounded again',
  )
  assert.ok(
    /settleWithin\(init, UNLOCK_TOTAL_TIMEOUT_MS\)/.test(src),
    'the unlock await in ensureAudioReady is no longer bounded',
  )
  // TRUE on timeout, for the same reason `isWorking` is permissive: attempting playback is how evidence
  // gets gathered, so an unlock that will not answer must not mute the app.
  assert.ok(
    /if \(outcome === 'timeout'\) \{[\s\S]{0,300}?return true/.test(src),
    'a timed-out unlock no longer falls through to a real play() attempt',
  )
})

test('THE FIX: nothing latches the cue — no showPrompt, no arming timer, no dismiss flag', () => {
  const src = readStripped('../contexts/SimplifiedAudioContext.tsx')
  for (const latch of ['showPrompt', 'hidePrompt', 'userDismissed', 'hasUnlockedRef', '1500']) {
    assert.ok(!src.includes(latch), `\`${latch}\` is back — the cue can now go stale over a working app`)
  }
})

test('the cue may only act on a CLICK, never a touch/pointer-down (tap-through rule)', () => {
  // Unconditional, and general to any overlay: a `click` is the LAST event a tap produces and its
  // target is resolved before the handler runs. Acting on `pointerdown`/`touchstart` — or from async
  // work a down-event starts — hands the tap's trailing click to whatever sits behind.
  const src = readStripped('../components/common/AudioBlockedCue.tsx')
  assert.ok(src.includes('onClick={handleTap}'), 'the cue no longer acts on click')
  for (const early of ['onPointerDown', 'onTouchStart', 'onMouseDown', 'onPointerUp', 'onTouchEnd']) {
    assert.ok(!src.includes(early), `${early} on the audio cue would fall through to the page behind`)
  }
})

test('the cue does NOT block: no full-viewport box, no scrim, no auth-tier z-index', () => {
  const src = readStripped('../components/common/AudioBlockedCue.tsx')
  for (const blocking of ['right: 0', 'bottom: 0', 'backgroundColor: \'rgba(0, 0, 0', 'zIndex: 9999']) {
    assert.ok(!src.includes(blocking), `the cue grew a blocking surface again (${blocking})`)
  }
  // Below MUI's modal default (1300) so an adult dialog covers it rather than fighting it.
  const z = src.match(/zIndex:\s*(\d+)/)
  assert.ok(z, 'the cue has no z-index at all')
  assert.ok(Number(z![1]) < 1300, `the cue sits at ${z![1]}, at or above MUI's modal tier`)
})

test('the cue animates with a CSS keyframe bundle, never a framer infinite loop', () => {
  // `.claude/rules/animation-and-performance.md`: a continuous, stateless animation is CSS.
  // `idleMotionBudget.test.ts` would fail the build anyway; this pins the intent at the call site.
  const src = readStripped('../components/common/AudioBlockedCue.tsx')
  assert.ok(src.includes('hintPulse('), 'the cue no longer uses the shared idle-motion vocabulary')
  assert.ok(!/repeat:\s*Infinity/.test(src), 'the cue grew a framer infinite loop')
})
