// Is audio actually working, and — if not — is that a FAILURE or has nobody tapped yet?
// (Audio activation PRD-01. Replaces `src/contexts/audioPromptPolicy.ts`.)
//
// The verdict this replaces was `audioContextWorking || speechSynthesisWorking`, and both halves were
// wrong in opposite directions:
//
//   * `speechSynthesisWorking` was set to TRUE because `speechSynthesis.speak(<empty utterance>)` did
//     not THROW. No `onstart`, no `onend`, nothing observed — a pure false-positive generator, OR'd, so
//     it could single-handedly latch the whole session as "working".
//   * `audioContextWorking` watched an object that never makes a sound: a probe `AudioContext` that
//     plays no sample. Narration goes through `ttsClient`'s shared `<audio>` element, SFX through
//     `Howler.ctx`, music through Howler's HTML5 backend. All three can be audible while the watched
//     context sits `suspended` — which is the owner-reported false negative: narration audible on a
//     cold PWA launch, and the blocking modal up anyway.
//
// So this module takes ONLY signals that mean something was heard (or provably wasn't), and it is PURE
// and Node-importable for the same reason `narrationHealth.ts` is: the interesting part is not the
// enum, it is WHICH signals it takes. There is deliberately **no `AudioContext.state` input** — see the
// source-reading guard in `audioReadiness.test.ts`. WebKit bug 263627 (open, iOS 17.0.3) has a context
// report `running` with `currentTime` frozen, so `state` is not liveness even for the context itself;
// liveness is a moving clock (`src/utils/audioLiveness.ts`).
import { PLAYBACK_FAILURES_UNHEALTHY } from './narrationHealth.ts'

export interface AudioReadinessInput {
  /**
   * `navigator.userActivation.hasBeenActive` — **FALSE when unsupported** (Safari 16.4+, so the floor
   * device has it; a headless engine or an older browser may not). This is the only signal that
   * separates "audio is blocked" from "nobody has tapped yet", which is the distinction the old 1500 ms
   * arming timer was a bad proxy for. Fail toward silence, never toward a false accusation.
   */
  hasBeenActive: boolean
  /** `ttsClient.primePlaybackElement()`'s latest result this session — the 50 ms silent WAV through the
   * REAL narration element, inside the unlock gesture. Resolving is the closest thing to proof that
   * narration is unlocked; `NotAllowedError` is proof that it is not. A decode/format error is neither
   * (that is what `playbackFailures` is for) and arrives here as `'unknown'`. */
  primeResult: 'unknown' | 'ok' | 'blocked'
  /** `ttsClient.getHealth().consecutivePlaybackFailures`. */
  playbackFailures: number
  /** A real clip has reported a duration this session (`notePlaybackOk` fired at least once). */
  playbackOkOnce: boolean
  /** `currentTime` advanced on ANY app-owned AudioContext (ours OR `Howler.ctx`). */
  ctxLive: boolean
}

/** `idle` = no verdict yet (show nothing) · `live` = something sounded · `blocked` = provably silenced. */
export type AudioReadiness = 'idle' | 'live' | 'blocked'

/**
 * The verdict, in order. `PLAYBACK_FAILURES_UNHEALTHY` is REUSED from `narrationHealth.ts`, not
 * re-declared: its justification — one failure is routinely transient (a stale prebaked file, one
 * blocked play before the unlock gesture) — applies here unchanged.
 *
 * **"Unverified is not broken."** The last line is the whole point: with no evidence in either
 * direction the app says nothing and stays silent-capable. That mirrors the rule that already governs
 * `narrationHealth` — a cold start must never read as dead.
 */
export function computeAudioReadiness(i: AudioReadinessInput): AudioReadiness {
  if (i.playbackOkOnce || i.primeResult === 'ok' || i.ctxLive) return 'live'
  // Nobody has tapped yet (or we cannot tell, which counts as the same). Not a failure.
  if (!i.hasBeenActive) return 'idle'
  if (i.primeResult === 'blocked' || i.playbackFailures >= PLAYBACK_FAILURES_UNHEALTHY) return 'blocked'
  return 'idle'
}

/**
 * The FINAL render decision for the non-blocking cue, composed with the app's other blocking surfaces.
 *
 * **ONE BLOCKING OVERLAY AT A TIME still holds even though the cue no longer blocks**: "tryk for lyd"
 * is meaningless before you know who is playing, and `authUiOpen` is the app's single notion of that
 * (the same flag that makes the adult-surface tap inert over an auth surface). This kept the old modal off
 * the mandatory PIN-setup and "who is playing?" dialogs — the first attempt at that was a z-index bump,
 * which is the wrong shape.
 *
 * Kept as its own function (rather than inline in the component) so the claim in
 * `.claude/rules/audio-system.md` — that the show decision is a pure, unit-tested function — stays
 * literally true.
 */
export function shouldShowAudioCue(s: {
  readiness: AudioReadiness
  authUiOpen: boolean
  devNoGate: boolean
}): boolean {
  if (s.devNoGate) return false
  if (s.authUiOpen) return false
  return s.readiness === 'blocked'
}
