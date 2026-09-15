// The "Send feedback" door, as DATA (owner, 2026-09-15).
//
// It used to be called "Rapportér et problem", and the label was the whole problem: a narrow label
// gets you only what it names. Real parents wrote nothing, because praise and ideas had no home and
// the only route out of the app was a personal Gmail on the /support page. So the row was widened
// rather than duplicated — ONE door, one box, one code path. There is deliberately no kind picker
// (ros / idé / fejl): it only ever existed to decide what rode along with the message, and with the
// screenshot on its own checkbox it had no job left. The owner classifies by reading; this is one
// person's inbox, not a support queue.
//
// The LABEL lives here rather than as a string literal in the component because `SUPPORT_DA` tells a
// parent to go and find a row by that exact name. Rename the row and the support page silently starts
// lying — which is the kind of defect nothing fails on. `legalContent.test.ts` holds the two together.
//
// PURE + Node-importable: no React, no DOM, so `feedbackForm.test.ts` can run it under plain
// `node --test`. Explicit `.ts` on relative imports — the test graph needs it.

/**
 * The rail-footer row, its `aria-label`, and the dialog title. ONE string for all three, because a
 * parent who taps a row expects to land on a screen with the same name on it.
 *
 * `ui-screenshot`'s recipes reference this row by name; `[aria-label="Indstillinger"]` is the SETTINGS
 * door and is untouched by this.
 */
export const FEEDBACK_ENTRY_LABEL = 'Send feedback'

/** Under the title. Says what belongs here — all three things, so none of them feels off-topic. */
export const FEEDBACK_INTRO = 'Ros, idéer eller noget der ikke virker — skriv løs.'

/** Under the text box: what is attached, in a parent's words rather than field names. */
export const FEEDBACK_ATTACHMENT_NOTE =
  'Med følger appens version, hvilken enhed du bruger, og hvad appen lavede lige før. Ingen navn og ingen e-mail.'

/** The screenshot checkbox. Ticked by default — it is the single most useful attachment. */
export const FEEDBACK_SCREENSHOT_LABEL = 'Send skærmbillede med'

/** Hard cap on the message, matching the TextField's slice. */
export const FEEDBACK_MAX_CHARS = 2000

/**
 * Whether "Send" is enabled.
 *
 * It used to always be — an empty report uploaded happily, which cost nothing while the door said
 * "Rapportér et problem" (the payload WAS the report) and costs everything now that the door invites
 * a sentence. An empty message is unreadable as praise and undebuggable as a bug.
 *
 * Whitespace-only counts as empty; `slice` at the call site means over-long input can't reach here,
 * but the cap is re-stated so the rule is complete in one place.
 */
export const canSubmitFeedback = (note: string): boolean => {
  const trimmed = note.trim()
  return trimmed.length > 0 && trimmed.length <= FEEDBACK_MAX_CHARS
}
