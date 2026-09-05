// The stacking order of the blocking auth/onboarding overlays — in ONE place, because getting it wrong
// makes a button look broken rather than look wrong.
//
// These surfaces are not all MUI Dialogs: the lock screen and the profile picker are hand-rolled
// `position: fixed` boxes sitting at ~10 000, while every PIN surface is a MUI `<Dialog>`, whose default
// z-index is `theme.zIndex.modal` = **1300**. So a Dialog opened FROM one of those boxes renders
// underneath it and the adult sees nothing happen. Two real instances of that, both found by wiring up
// the lock action:
//
//   * "Brug kode i stedet" on the lock screen (9999) opened PinDialog at 1300 — invisible. This is part
//     of why the whole `locked` phase could sit unnoticed as dead code. (That phase is unreachable again
//     by decision — the adult menu offers a plain logout instead — so PinDialog's value here is now
//     correct-but-unexercised ordering. It is still the right value, and the next surface that raises a
//     PIN over a full-screen box will need it.)
//   * "Lav en ny profil" in the profile picker (10 000) opened CreateProfileDialog at 1300 — invisible,
//     on a path reachable by any household with two children. Measured both ways with a hit-test at the
//     dialog's centre: `elementFromPoint` returned the PICKER before the fix and the dialog after it.
//
// That second one is now guarded twice over, deliberately: `profileGateSurface()` also stands the picker
// DOWN while the create dialog is up (one blocking surface at a time, the app's own rule), so the
// z-index is currently redundant there. Keep it anyway — it is what protects the NEXT surface that
// opens a dialog from one of these boxes, and the redundancy costs nothing.
//
// The rule: a surface that can be opened FROM another must sit ABOVE it, and anything that DEMANDS input
// before the app can continue sits above everything. Add new surfaces here, never with a local literal.
//
// (This is ordering WITHIN the auth stack. It is not the audio cue's problem: that one stands down via
// `authUiOpen` instead of competing — see `config/audioReadiness.ts`. Do not re-litigate that with a
// z-index. The cue it replaced used to be a full-screen modal at 9999; the cue itself is non-blocking
// and deliberately sits BELOW MUI's modal tier, so it is nowhere near this stack.)
export const AUTH_Z = {
  /**
   * "Hvem spiller?" reopened MID-SESSION from the profile chip (Corner identity PRD-01 §2.6).
   *
   * **Deliberately MUI's own modal default, i.e. NOT in the stack below.** It is not a gate and it is
   * not onboarding: it is a plain dialog opened from the page's title row, and it is reachable only
   * when none of these surfaces is up — the chip renders nothing until a child is attached, and every
   * surface below blocks play. It sits here so a reader finds the reasoning where they look for it,
   * and so the directory sweep in `authOverlayZ.test.ts` (every `<Dialog>` in this folder names an
   * `AUTH_Z`) can't be satisfied by a hand-written 1300.
   *
   * It closes BEFORE the adult surface opens, so the two never stack; if that ever stops being true,
   * this is the value to raise, not `AdultSettings`'.
   */
  whoIsPlayingSheet: 1300,
  /** The gate itself. 9999 is the app's top blocking tier — nothing else claims it. */
  lockScreen: 9999,
  /** "Hvem spiller?" — above the gate, because it appears just INSIDE it. */
  profilePicker: 10_000,
  /** Opened from the picker, so it must outrank it. */
  createProfile: 10_001,
  /** An OAuth return in the wrong browser context — the last word over onboarding. */
  wrongContext: 10_002,
  /**
   * Every PIN surface. Top of the stack: `requirePin()` can be demanded from the lock screen, from the
   * picker, or from the adult menu, and the answer must be reachable in all three.
   */
  pin: 10_003,
} as const
