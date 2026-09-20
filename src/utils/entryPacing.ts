// Entry pacing for a game's arrival narration.
//
// The problem it solves (owner, 2026-09-20: the intro "seems stressed and too fast"): the welcome used
// to be spoken on MOUNT — underneath the themed wipe that is still uncovering the screen (220-340ms
// depending on the skin) and on top of the board's own charge-in — and the first prompt then followed
// the welcome clip with no gap at all. So a child arriving on a board heard its title before they could
// see it, and the question before they had looked at anything.
//
// Two silences fix it. They live in ONE place rather than at the twelve `playGameWelcome` call sites,
// because every one of them has the same shape (`await playGameWelcome(...)` then speak the prompt) and
// a per-site constant is a per-site chance to drift.
//
// These are SILENCES, not queued audio — the app's no-queue rule is untouched. Both are abandoned the
// moment anything else claims the channel (see `EntryClaim`), so a child who taps during the lead-in is
// never talked over by a welcome that was scheduled before they touched anything.

/** Wait for the wipe to finish uncovering and the board to settle before the title is spoken. */
export const WELCOME_LEAD_IN_MS = 700

/** Breath between the spoken title and the board's first prompt. */
export const WELCOME_SETTLE_MS = 600

/**
 * A claim-check on the audio channel, so a pending silence can tell whether it is still the thing the
 * app is waiting for.
 *
 * The rule is the same one the engine already has — new audio cancels current — extended to cover the
 * silence BEFORE a clip. `claim()` takes the channel for an entry step; anything that stops playback
 * calls `release()`; `pause()` resolves `false` if the claim was superseded while it waited.
 */
export class EntryClaim {
  private token = 0

  /** Take the channel for one entry step. The returned token is what `pause` checks against. */
  claim(): number {
    return ++this.token
  }

  /** Something else took the channel (a tap, a new board, leaving the screen). */
  release(): void {
    this.token++
  }

  /** True while `token` is still the live claim. */
  holds(token: number): boolean {
    return this.token === token
  }

  /**
   * A cancellable silence. Resolves `true` if `token` is still the live claim when `ms` elapses,
   * `false` if anything took the channel in the meantime.
   *
   * It always waits the full `ms` — releasing does not resolve it early, because the caller's job on a
   * `false` is only to stay quiet, and settling early would let a superseded welcome race the audio
   * that superseded it.
   */
  pause(ms: number, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.holds(token)), ms)
    })
  }
}
