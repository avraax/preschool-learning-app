// "Has audio ever worked on THIS DEVICE?" — one device-scoped localStorage key
// (Audio activation PRD-01 §4.5).
//
// **Not `progressStore`**: that is per-child and inert until `profileStore.attach()`, and this fact is
// about the device, not the child.
//
// Honest scope, stated because it is smaller than it sounds: with the blocking primer gone there is no
// first-run modal left for this flag to suppress. Its two real jobs are
//   1. the "Lyd har virket på denne enhed" line in "Indstillinger" → Lyd, so the adult can tell
//      "never worked here" from "worked and then stopped"; and
//   2. a field in the bug report.
//
// **It must NOT gate the cue.** A device where audio worked yesterday can be blocked today — the cue
// keys on live evidence only.

const KEY = 'bl-audio-ever-worked'

export function audioEverWorked(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode / quota — "unknown" reads as "not yet", which is the honest direction here.
    return false
  }
}

/** Idempotent, and never throws: called from a render-adjacent effect on every verdict change. */
export function noteAudioWorked(): void {
  try {
    if (localStorage.getItem(KEY) === '1') return
    localStorage.setItem(KEY, '1')
  } catch {
    /* nothing persisted, nothing to report — the live verdict is unaffected */
  }
}
