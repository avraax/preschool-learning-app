// "Do not photograph this surface" — the marker `screenshotService` honours, and the ONE place its
// name is written.
//
// SEPARATE FROM `data-bl-redact` ON PURPOSE, although both end up in the same `exclude` array.
// `data-bl-redact` means "this can render a SECRET, so it must never be capturable" — a privacy
// control with three independent layers behind it (`.claude/rules/auth.md` §8.1). This one means only
// "this surface opened AFTER the capture was requested, so it is not part of the picture we wanted".
// The guest parental gate is the case that forces the distinction: its own header explains at length
// why it is deliberately NOT a redact surface (it shows digits, and there is nothing to keep), yet it
// must still stay out of a shot taken behind it.
//
// It goes on the DIALOG ROOT, never the paper: MUI renders the dim backdrop as a sibling of the paper
// inside that root, so marking the paper alone leaves a grey slab over the whole capture.
//
// PURE + Node-importable: no DOM, so a guard can read the selector rather than re-declaring it.

/** The attribute itself, so a selector and a JSX prop cannot drift apart. */
export const CAPTURE_EXCLUDE_ATTR = 'data-capture-exclude'

/** Spread onto a `<Dialog>` (MUI forwards unknown props to the root element). */
export const captureExcludeProps = { [CAPTURE_EXCLUDE_ATTR]: true } as const

/**
 * Everything dropped from a capture: secrets, plus surfaces that opened over the subject.
 *
 * Kept as separate entries because that is the shape snapdom's `exclude` option takes; the joined
 * form below is for `querySelectorAll`/`matches`.
 */
export const CAPTURE_EXCLUDE_SELECTORS: readonly string[] = [
  '[data-bl-redact]',
  `[${CAPTURE_EXCLUDE_ATTR}]`,
]

export const CAPTURE_EXCLUDE_SELECTOR = CAPTURE_EXCLUDE_SELECTORS.join(', ')
