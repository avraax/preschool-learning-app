// Is an AudioContext actually running a clock, and has the user activated the document?
// (Audio activation PRD-01 §4.2 / §3.1.)
//
// **`ctx.state === 'running'` is not liveness.** WebKit bug 263627 (open, first seen iOS 17.0.3): after a
// foreground restore the context reports `running` with `currentTime` **frozen**. The robust probe is
// `currentTime` monotonicity across ~120 ms; the documented recovery is `suspend()` → `resume()`.
// https://bugs.webkit.org/show_bug.cgi?id=263627
//
// Duck-typed on purpose (`ClockContext`, `RecoverableContext`) so the whole file is Node-importable and
// the probes are unit-testable with a fake clock — an `AudioContext` satisfies both. It also keeps
// `Howler` out of this module's import graph: the caller passes THUNKS, which is what makes
// "re-read `Howler.ctx` on every probe" true (Howler closes and rebuilds its context inside the first
// touch on iPad — 48 kHz ≠ 44.1 kHz — so a cached reference goes stale silently).
//
// **Never call these inside the unlock gesture.** They `await`, and iOS consumes the transient
// activation across an `await`; the whole in-gesture ordering in `initializeAudio` exists to avoid that.

/** Just enough of an `AudioContext` to read a clock. */
export interface ClockContext {
  readonly currentTime: number
  readonly state: string
}

/** Just enough of an `AudioContext` to perform the 263627 recovery. */
export interface RecoverableContext {
  readonly state: string
  suspend(): Promise<void>
  resume(): Promise<void>
}

/** How long to watch the clock. Long enough that a 128-sample quantum at 44.1 kHz has ticked many times. */
export const LIVENESS_PROBE_MS = 120

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * True iff `currentTime` STRICTLY increased over the probe window. A null context, or a `closed` one,
 * is false. A `suspended`/`interrupted` one is false too — by observation, not by reading `state`,
 * because the point of this probe is that `state` lies in both directions.
 */
export async function probeContextLive(
  ctx: ClockContext | null | undefined,
  waitMs: number = LIVENESS_PROBE_MS,
): Promise<boolean> {
  if (!ctx) return false
  try {
    if (ctx.state === 'closed') return false
    const before = ctx.currentTime
    await sleep(waitMs)
    return ctx.currentTime > before
  } catch {
    return false
  }
}

/**
 * OR the probe across every context the app owns — ours AND `Howler.ctx`. Takes thunks so each is
 * re-read at probe time (see the header). One window covers all of them: they are sampled together,
 * waited once, then compared.
 */
export async function probeAnyContextLive(
  getters: Array<() => ClockContext | null | undefined>,
  waitMs: number = LIVENESS_PROBE_MS,
): Promise<boolean> {
  const sampled = getters.map((get) => {
    try {
      const ctx = get()
      if (!ctx || ctx.state === 'closed') return null
      return { ctx, before: ctx.currentTime }
    } catch {
      return null
    }
  })
  if (sampled.every((s) => s === null)) return false
  await sleep(waitMs)
  return sampled.some((s) => {
    if (!s) return false
    try {
      return s.ctx.currentTime > s.before
    } catch {
      return false
    }
  })
}

/**
 * The documented workaround for WebKit 263627: a context reporting `running` with a frozen clock is
 * revived by a full `suspend()` → `resume()` round trip. Never throws — a failed recovery leaves the
 * verdict where it was, which is the honest outcome.
 */
export async function recoverFrozenContext(ctx: RecoverableContext | null | undefined): Promise<void> {
  if (!ctx) return
  try {
    if (ctx.state === 'closed') return
    await ctx.suspend()
    await ctx.resume()
  } catch {
    /* nothing to do — the caller re-probes and reports what it finds */
  }
}

/**
 * How long the unlock waits for an ANSWER from `resume()` / the prime `play()` before giving up on the
 * answer. Measured on the iPhone report J62KA (2026-08-06): the prime settled in ~250 ms, so this is
 * ~3× headroom over the only real reading we have.
 */
export const UNLOCK_VERIFY_TIMEOUT_MS = 800

/**
 * How long `ensureAudioReady` waits for the whole unlock before playing anyway. The SECOND, independent
 * brake — deliberately outside `initializeAudio`, because the thing that can wedge is inside it (same
 * two-brakes shape as Sig et Ord's recognition watchdog).
 */
export const UNLOCK_TOTAL_TIMEOUT_MS = 2500

/** What `settleWithin` observed: the promise answered, or the window closed first. */
export type SettleOutcome = 'settled' | 'timeout'

/**
 * Wait for a promise, but never longer than `ms` — and report WHICH happened.
 *
 * This exists because **an iOS `AudioContext.resume()` can never settle at all.** Report J62KA
 * (iPhone, iOS 18.7 / Safari 26.6): the unlock logged `initializeAudio: ctxState= suspended`, the
 * narration element primed OK, and the very next line in `initializeAudio` never printed — one bare
 * `await ctx.resume()` sat between them. Nothing timed it out, so `initializeAudio()` never resolved,
 * its de-dupe promise never cleared, and every later `speak()` awaited the same dead promise: the whole
 * app went permanently mute while Howler's music and SFX (their own context) played on.
 *
 * A rejection is a SETTLE, not a timeout — the caller has its own answer for that. Never rejects, and
 * always clears its timer, so a bounded wait can't itself leak a pending handle.
 */
export function settleWithin(p: Promise<unknown>, ms: number): Promise<SettleOutcome> {
  return new Promise<SettleOutcome>((resolve) => {
    // `done` is DEFENSIVE, not load-bearing — a second `resolve()` is already a no-op in the language,
    // so no test can pin it. `clearTimeout` is the part with observable consequences (a 2500 ms handle
    // left pending on every tap), and `audioLiveness.test.ts` pins that one.
    let done = false
    const finish = (outcome: SettleOutcome) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(outcome)
    }
    const timer = setTimeout(() => finish('timeout'), ms)
    p.then(
      () => finish('settled'),
      () => finish('settled'),
    )
  })
}

/**
 * Why did the silent-unlock clip's `play()` reject? This is THE line that turns the app's one real
 * evidence signal into a verdict, so it lives here — pure and testable — rather than inline in
 * `ttsClient.primePlaybackElement()`, where nothing could reach it.
 *
 * `NotAllowedError` is an ACTIVATION refusal: the element is not user-activated, which is the
 * "no sound after tapping" signature. Anything else is a decode/format/network problem, which is NOT an
 * activation problem and must not be reported as one — that class is what `consecutivePlaybackFailures`
 * sees, and conflating them is how the Ogg silence would have been mislabelled as "blocked".
 */
export function classifyPrimeFailure(e: unknown): 'blocked' | 'error' {
  const name = (e as { name?: string } | null | undefined)?.name
  return name === 'NotAllowedError' ? 'blocked' : 'error'
}

/**
 * `navigator.userActivation` (Safari 16.4+, so the floor device has it) — the only way to tell
 * "audio is blocked" from "nobody has tapped yet". Reported SEPARATELY in the bug report so an
 * unsupported environment stays distinguishable from a genuinely untapped one (PRD §3.1).
 */
export function userActivationSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { userActivation?: unknown }).userActivation
}

/** `hasBeenActive`, or **false** when unsupported — fail toward silence, never toward a false accusation. */
export function readHasBeenActive(): boolean {
  try {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation
    return !!ua?.hasBeenActive
  } catch {
    return false
  }
}

/**
 * `navigator.audioSession.type = 'playback'` (Safari 16.4+). Since iOS 17 the default session type is
 * `ambient`, which is **silenced by the device mute state** — a candidate root cause of the "sometimes
 * audio really IS off" half of the owner's report. WebKit engineer Jean-Yves Avenard, bug 237322
 * (RESOLVED CONFIGURATION CHANGED): *"Add in your code something like
 * `navigator.audioSession.type = 'playback'` and audio will not be suspended… By default the type is
 * `ambient` and so audio will be muted if the phone is muted."*
 * https://bugs.webkit.org/show_bug.cgi?id=237322
 *
 * Feature-detected, never assumed: only `.type` is unconditionally exposed in WebKit's IDL —
 * `.state`/`.onstatechange` sit behind `EnabledBySetting=DOMAudioSessionFullEnabled`.
 * Returns the type actually readable afterwards (for the bug report), or null.
 *
 * SYNCHRONOUS and cheap on purpose: it runs as the first statement of the in-gesture block.
 */
export function requestPlaybackAudioSession(): string | null {
  try {
    const session = (navigator as Navigator & { audioSession?: { type?: string } }).audioSession
    if (!session) return null
    if (session.type !== 'playback') session.type = 'playback'
    return session.type ?? null
  } catch {
    return null
  }
}
