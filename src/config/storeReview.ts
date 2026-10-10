// "Bedøm appen" — the one place a parent can rate the app, behind the parental gate.
//
// WHY A ROW AND NOT A PROMPT. Ratings drive App Store search ranking, and after the first month the
// listing's problem was reach, not conversion (~10 impressions a day, ~1 in 5 downloading). But Kids
// Guideline 1.3 keeps everything adult-directed behind the gate, so the usual timed
// `SKStoreReviewController` nudge during play is not available to us. A row inside "Indstillinger"
// is: the adult has already passed the gate, and nothing is ever shown to the child.
//
// WHY THE WRITE-REVIEW URL AND NOT `requestReview()`. Apple's own guidance for a PERSISTENT rating
// control in settings is to deep-link to the product page with `action=write-review`. `requestReview`
// is rate-limited by iOS (a few times a year) and may show NOTHING, which is fine for a nudge and
// wrong for a button an adult deliberately tapped — a row that silently does nothing reads as broken.
// It also needs no new native plugin: `@capacitor/app-launcher` is already in the shell.
//
// PURE + Node-importable, so the URL is pinned by `storeReview.test.ts`.

/** The production app's App Store Connect record (`com.vraa.earlylearning`). NOT the staging app's. */
export const APP_STORE_ID = '6799119188'

export const RATE_ENTRY_LABEL = 'Bedøm appen'

/** Opens the App Store app straight on the "Write a Review" sheet for this app. */
export const WRITE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
