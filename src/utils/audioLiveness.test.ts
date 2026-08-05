import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LIVENESS_PROBE_MS,
  probeAnyContextLive,
  probeContextLive,
  recoverFrozenContext,
  readHasBeenActive,
  requestPlaybackAudioSession,
  userActivationSupported,
} from './audioLiveness.ts'

// A fake AudioContext clock. `tick` is what a real running context does 60+ times per probe window;
// a FROZEN one keeps `state: 'running'` and never advances — WebKit bug 263627, which is precisely the
// case `state` cannot see and this probe can.
const clock = (state: string, rateMsPerMs = 1) => {
  const started = Date.now()
  return {
    state,
    get currentTime() {
      return ((Date.now() - started) * rateMsPerMs) / 1000
    },
  }
}
const frozen = (state: string, at = 12.5) => ({ state, currentTime: at })

const SHORT = 20 // keep the suite fast; the real default is exercised by the constant assertion below

test('the probe window is long enough to be meaningful', () => {
  assert.equal(LIVENESS_PROBE_MS, 120)
})

test('a running context with an ADVANCING clock is live', async () => {
  assert.equal(await probeContextLive(clock('running'), SHORT), true)
})

test("THE FIX: `running` with a FROZEN clock is NOT live (WebKit 263627)", async () => {
  assert.equal(await probeContextLive(frozen('running'), SHORT), false)
})

test('a null / closed / suspended context is not live', async () => {
  assert.equal(await probeContextLive(null, SHORT), false)
  assert.equal(await probeContextLive(undefined, SHORT), false)
  assert.equal(await probeContextLive(frozen('closed'), SHORT), false)
  assert.equal(await probeContextLive(frozen('suspended'), SHORT), false)
})

test('a context whose clock THROWS is not live, and does not throw out', async () => {
  const hostile = {
    state: 'running',
    get currentTime(): number {
      throw new Error('detached')
    },
  }
  assert.equal(await probeContextLive(hostile, SHORT), false)
})

test('a STRICT increase is required — equal is frozen', async () => {
  let t = 3
  const stalled = { state: 'running', get currentTime() { return t } }
  const p = probeContextLive(stalled, SHORT)
  t = 3 // unchanged on purpose
  assert.equal(await p, false)
})

// ----- probeAnyContextLive: ours OR Howler's, re-read every time ---------------------------------

test('ANY live context makes the verdict live', async () => {
  assert.equal(
    await probeAnyContextLive([() => frozen('running'), () => clock('running')], SHORT),
    true,
  )
})

test('all frozen ⇒ not live', async () => {
  assert.equal(
    await probeAnyContextLive([() => frozen('running'), () => frozen('suspended')], SHORT),
    false,
  )
})

test('no contexts at all ⇒ not live, and no wait', async () => {
  assert.equal(await probeAnyContextLive([() => null, () => undefined], SHORT), false)
})

test('THE FIX: each context is re-read at probe time, never cached', async () => {
  // Howler unlocks in the CAPTURE phase and, on iPad (48kHz ≠ 44.1kHz), CLOSES AND REBUILDS its
  // context inside the first touch. A cached reference goes stale silently, so the getter must be
  // invoked by the probe itself.
  let calls = 0
  const getter = () => {
    calls++
    return clock('running')
  }
  await probeAnyContextLive([getter], SHORT)
  await probeAnyContextLive([getter], SHORT)
  assert.equal(calls, 2, 'the probe cached the context instead of re-reading it')
})

test('a throwing getter is skipped, not fatal', async () => {
  const boom = () => {
    throw new Error('Howler is gone')
  }
  assert.equal(await probeAnyContextLive([boom, () => clock('running')], SHORT), true)
  assert.equal(await probeAnyContextLive([boom], SHORT), false)
})

// ----- recoverFrozenContext ----------------------------------------------------------------------

test('recovery is suspend() THEN resume(), in that order', async () => {
  const calls: string[] = []
  await recoverFrozenContext({
    state: 'running',
    suspend: async () => void calls.push('suspend'),
    resume: async () => void calls.push('resume'),
  })
  assert.deepEqual(calls, ['suspend', 'resume'])
})

test('recovery never throws, and skips a closed context', async () => {
  await recoverFrozenContext(null)
  await recoverFrozenContext({
    state: 'running',
    suspend: async () => {
      throw new Error('nope')
    },
    resume: async () => {},
  })
  const calls: string[] = []
  await recoverFrozenContext({
    state: 'closed',
    suspend: async () => void calls.push('suspend'),
    resume: async () => void calls.push('resume'),
  })
  assert.deepEqual(calls, [], 'a closed context was suspend/resumed')
})

// ----- feature detection: unsupported must read as "no accusation" -------------------------------

// Node ≥21 ships its own minimal `navigator` (a getter on globalThis with only `userAgent` etc.), so
// "unsupported" here is the REAL unsupported shape — a navigator with no `userActivation` and no
// `audioSession` — and a swap needs defineProperty, not assignment.
const withNavigator = <T>(nav: unknown, fn: () => T): T => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true })
  try {
    return fn()
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete (globalThis as { navigator?: unknown }).navigator
  }
}

test('THE FIX: an environment without these APIs reads as FALSE, never as an accusation', () => {
  // Fail toward silence. `false` means the verdict can never reach `blocked` (§3.1), which is why
  // support is reported as its own field rather than folded into "untapped". Node's own navigator has
  // neither API, so this is the unsupported case as it really arrives.
  assert.equal(userActivationSupported(), false)
  assert.equal(readHasBeenActive(), false)
  assert.equal(requestPlaybackAudioSession(), null)

  withNavigator(undefined, () => {
    assert.equal(userActivationSupported(), false)
    assert.equal(readHasBeenActive(), false)
    assert.equal(requestPlaybackAudioSession(), null)
  })
})

test('userActivation is read live, and a present-but-empty one still reads false', () => {
  withNavigator({ userActivation: {} }, () => {
    assert.equal(userActivationSupported(), true)
    assert.equal(readHasBeenActive(), false, 'a present-but-empty userActivation was read as active')
  })
  withNavigator({ userActivation: { hasBeenActive: true } }, () => {
    assert.equal(readHasBeenActive(), true)
  })
})

test("audioSession.type is SET to 'playback' when the API exists, and skipped when it doesn't", () => {
  // Since iOS 17 the default session type is `ambient`, which is silenced by the device mute switch
  // (WebKit 237322). Feature-detected: only `.type` is unconditionally exposed in WebKit's IDL.
  const session: { type: string } = { type: 'ambient' }
  withNavigator({ audioSession: session }, () => {
    assert.equal(requestPlaybackAudioSession(), 'playback')
  })
  assert.equal(session.type, 'playback')
  withNavigator({}, () => {
    assert.equal(requestPlaybackAudioSession(), null)
  })
})
