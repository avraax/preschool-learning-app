// "Is this device playing WITHOUT an account?" — two device-scoped localStorage keys.
//
// App Store PRD §3.2 / Phase A1. Guideline 5.1.1(v): "If your app doesn't include significant
// account-based features, let people use it without a login… Apps may not require users to enter
// personal information to function." `AuthGate` used to block the entire app behind Google sign-in,
// which is exactly the pattern that rule exists to stop — and a reviewer who cannot get past a sign-in
// screen rejects on sight (Guideline 2.1).
//
// **Not `progressStore`**: that is per-child and inert until `profileStore.attach()`, and this fact is
// about the device, not the child — the same reasoning as `audioEverWorked`. It also has to be readable
// BEFORE anything is attached, since it is what decides whether anything gets attached at all.
//
// THE TWO KEYS DO DIFFERENT JOBS, and collapsing them into one would lose the case that matters:
//
//   `bl-guest-mode`      this device is playing locally right now.
//   `bl-has-signed-in`   an account has been signed in on this device at some point.
//
// A device that has NEVER signed in auto-enters guest, so a fresh install (a reviewer's, or a new
// family's) opens straight into the section menu with no auth UI at all. A device that HAS signed in
// and then signed out does NOT auto-enter guest — it gets the lock screen, with "Spil uden konto" as an
// explicit choice. Without that second key, an accidental sign-out would silently drop the child into
// an empty guest book that looks exactly like lost progress (owner's call, 2026-08-06).

const GUEST_KEY = 'bl-guest-mode'
const EVER_SIGNED_IN_KEY = 'bl-has-signed-in'
/** The guest book has been adopted onto a real child. Set once, NEVER cleared. */
const GUEST_CLAIMED_KEY = 'bl-guest-claimed'

const read = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    // Private mode / quota. "Unknown" reads as false for BOTH keys, which composes correctly:
    // no guest flag and no sign-in history ⇒ `shouldAutoGuest()` is true ⇒ the app is playable.
    // Failing toward playable is the right direction for a gate whose whole purpose is not to block.
    return false
  }
}

const write = (key: string, on: boolean): void => {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* nothing persisted — the choice then lasts only this page load */
  }
}

/** Is this device playing locally, with no account? */
export const guestModeActive = (): boolean => read(GUEST_KEY)

/** Has an account ever been signed in on this device? */
export const hasEverSignedIn = (): boolean => read(EVER_SIGNED_IN_KEY)

/**
 * A device with no session AND no sign-in history opens playable rather than showing a lock screen.
 * Pure over the two keys so the boot decision has one name.
 */
export const shouldAutoGuest = (): boolean => !hasEverSignedIn()

/** The adult chose local-only play (or a fresh device auto-entered it at boot). */
export const enterGuestMode = (): void => write(GUEST_KEY, true)

/** A real session took over. */
export const exitGuestMode = (): void => write(GUEST_KEY, false)

/**
 * Record that an account has existed here. Called from `adoptSession`, i.e. on every sign-in path
 * (Google claim and passkey unlock alike) — so a later sign-out lands on the lock screen, not in guest.
 * Deliberately NEVER cleared: "has an account ever been here" is history, not state.
 */
export const noteSignedIn = (): void => write(EVER_SIGNED_IN_KEY, true)

/**
 * Has the guest book already been copied onto a real child?
 *
 * THIS ONE FAILS THE OTHER WAY. `read()` above answers "unknown" with `false` because for the two flags
 * it serves, false means playable — the safe direction for a gate whose job is not to block. Here false
 * means "go ahead and adopt", and the unsafe outcome is adopting the SAME book into a second account,
 * counting the same XP twice. So a storage throw reads as CLAIMED and the offer simply doesn't appear.
 *
 * The flag is device-scoped and never cleared: signing out and tapping "Spil uden konto" resumes play on
 * the very same guest book, which is intended — it just can never be adopted again.
 */
export const guestBookClaimed = (): boolean => {
  try {
    return localStorage.getItem(GUEST_CLAIMED_KEY) === '1'
  } catch {
    return true
  }
}

/** Record that the guest book has been handed to a child. One-way. */
export const markGuestBookClaimed = (): void => write(GUEST_CLAIMED_KEY, true)
