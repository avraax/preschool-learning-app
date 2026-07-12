// Phone-compact media queries (iPhone-fit pass, bug report BAZ3R).
//
// The app is designed iPad-first; these guards add a COMPACT variant on phones without
// touching tablets. In CSS pixels every current phone's short side is 320-440 (iPhone SE 375,
// iPhone 13-16 390-402, Plus/Pro Max 428-440, Galaxy 360-384, Pixel 412-428) while the
// smallest tablets start at ~600 (iPad Mini 744) — so 480 cleanly separates the classes.
//
// Use as sx keys:  [PHONE_LANDSCAPE]: { ... }

/** Landscape phones (height ≤ 480 CSS px) — the constrained direction is VERTICAL. */
export const PHONE_LANDSCAPE = '@media (orientation: landscape) and (max-height: 480px)'

/** Portrait phones (width ≤ 480 CSS px) — the constrained direction is HORIZONTAL. */
export const PHONE_PORTRAIT = '@media (orientation: portrait) and (max-width: 480px)'

/** Any phone (either orientation) — for elements that must shrink on all phones (e.g. mascots). */
export const PHONE_ANY = '@media (orientation: landscape) and (max-height: 480px), (orientation: portrait) and (max-width: 480px)'
