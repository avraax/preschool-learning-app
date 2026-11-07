// Pure, so node tests can import it (theme/motion.ts pulls in browser-only modules).
// …but never cut a line off (owner 2026-11-07: "Hvad mangler" read the sequence and the next
// round started over it). The dwells above are measured for TYPICAL lines; a long one (a five-number
// sequence, a long fact) outran them. When a game's dwell runs out it asks how much of the line now
// playing is still to be SPOKEN — from the speech end the prebake measured for that clip
// (`prebakedSpeechEnd.ts`), never from awaiting the audio — and holds the advance that long, once.
/** A little air after the last word before the next prompt. */
const SPEECH_HOLD_TAIL_MS = 150
/** Never hold past the dwell longer than this, whatever the table says. */
export const SPEECH_HOLD_CAP_MS = 6000
/** 0 = advance now; otherwise wait this many ms first (the current line still has words left). */
export const speechHoldMs = (audio: { speechRemainingMs: () => number }): number => {
  const left = audio.speechRemainingMs()
  return left > 0 ? Math.min(Math.round(left) + SPEECH_HOLD_TAIL_MS, SPEECH_HOLD_CAP_MS) : 0
}
