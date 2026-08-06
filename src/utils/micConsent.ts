// "Has an adult consented to the microphone on THIS DEVICE?" — one device-scoped localStorage key.
//
// App Store PRD §3.6 (Phase A3). This is the plan's largest irreducible review risk, so read that
// section before changing anything here. The short version, Guideline 1.3 verbatim: "**Kids Category
// apps may not send personally identifiable information or device information to third parties.**" The
// only qualifier anywhere in Apple's material is on the kids-apps page — "even in sections intended for
// adults — **unless the parent explicitly consents**." Sig et Ord sends a child's recorded voice to
// Google Cloud STT, so this flag IS that explicit parental consent, and its default is the whole point.
//
// **DEFAULT OFF, and off means UNREACHABLE.** A switch that merely hides a tile is not a gate: the
// routes here are deep-linkable by design (`src/utils/urlParams.ts`), so `/ordleg/mic` has to refuse on
// its own as well. Both halves are wired, and `micConsent.test.ts` pins the default.
//
// **DEVICE-SCOPED, not per-child and not synced**, for three independent reasons:
//   1. Consent is about this device's microphone. A new iPad has not been consented to, and inheriting
//      a `yes` through progress sync would be consent the adult never gave on that device.
//   2. It has to work in GUEST mode (A1), where there is no synced document at all and `progressStore`
//      holds a purely local book.
//   3. It must be readable before `profileStore.attach()`, since the route guard runs on mount.
// Same reasoning and the same shape as `audioEverWorked`.
//
// Withdrawal is symmetric: turning it off is one tap in the same place, which is what the privacy
// policy promises under "du trækker samtykket tilbage" (`src/config/legalContent.ts`).

const KEY = 'bl-mic-consent'

/** Has an adult switched the microphone on, on this device? Default FALSE — see the header. */
export function micConsentGiven(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode / quota. "Unknown" must read as NOT CONSENTED: this is the one flag where failing
    // toward the permissive answer would send a child's voice to a third party on no evidence at all.
    return false
  }
}

/** Called only from the consent screen's explicit accept, never from a plain toggle. */
export function grantMicConsent(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* nothing persisted — the game stays unreachable, which is the safe direction */
  }
}

/** Withdrawal. Sig et Ord becomes unreachable again on the next render and route check. */
export function revokeMicConsent(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
