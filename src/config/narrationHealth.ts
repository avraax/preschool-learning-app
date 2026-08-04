// Is narration alive enough to play a listening game? (Practice Loop PRD-01 W4)
//
// Two games are UNSOLVABLE without narration, by deliberate design: Tal Quiz shows nothing but a speaker
// and an equalizer (the numeral and the counting row were both removed as giveaways), and Lyt og Find is
// audio→picture. Both are correct designs *while audio works*. This app has shipped total silence on the
// target device twice over — Ogg on iPadOS 17.7, and iOS suspension / `NotAllowedError` — and in that
// state the child faces a board that cannot be answered and nothing tells anybody why.
//
// PURE and Node-importable so the rule itself is testable with no DOM: the interesting part is not the
// boolean, it is WHICH two signals it takes.
export interface NarrationHealthInput {
  /** `SimplifiedAudioContext.state.isWorking` — "can we play audio at all". */
  isWorking: boolean
  /**
   * Has audio EVER unlocked this session? Before that, `isWorking` being false means "nobody has tapped
   * anything yet", not "narration is dead" — see the rule below for why that distinction is load-bearing.
   */
  unlockedOnce: boolean
  /** `ttsClient.getHealth().consecutivePlaybackFailures`. */
  consecutivePlaybackFailures: number
}

/**
 * How many consecutive playback failures mean narration is dead. TWO, not one: a single failure is
 * routinely a transient (a stale prebaked file 404ing through to Azure, one blocked play before the
 * unlock gesture), and flipping the board on it would flash the answer during normal play.
 */
export const PLAYBACK_FAILURES_UNHEALTHY = 2

/**
 * Narration is presumed healthy until there is POSITIVE EVIDENCE otherwise. Two kinds:
 *
 * 1. **Playback keeps failing** (`>= PLAYBACK_FAILURES_UNHEALTHY`) — the Ogg case. `isWorking` was
 *    **true** right through that one: the `<audio>` element existed, accepted a src, and the bytes were
 *    simply undecodable, so the app believed audio was fine while the child heard nothing. Only the
 *    failure counter sees it, which is why `isWorking` alone can never be the signal.
 * 2. **Audio worked and then stopped** (`unlockedOnce && !isWorking`) — the iOS suspension case.
 *
 * `unlockedOnce` is what keeps `!isWorking` from meaning "dead" on a COLD START, and it is not a
 * refinement — PRD §6.1's literal formula (`isWorking && failures < 2`) revealed Tal Quiz's numeral
 * before the child had tapped anything at all, because audio legitimately hasn't unlocked yet at that
 * point. Measured on rung 1: entering the game headlessly printed "49" over the answer tiles. A giveaway
 * flash on the first question of every cold launch is a worse bug than the one W4 fixes.
 */
export const isNarrationHealthy = (h: NarrationHealthInput): boolean =>
  h.consecutivePlaybackFailures < PLAYBACK_FAILURES_UNHEALTHY && !(h.unlockedOnce && !h.isWorking)
