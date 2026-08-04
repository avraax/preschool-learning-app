// The practice ledger's STORAGE key, alone in a pure module (Practice Loop PRD-01 W2).
//
// It lives here rather than in `practiceLedger.ts` for the same reason `progressKeyFor` lives in
// `progressSchema.ts`: `profileStore.deleteProfile()` and `utils/storageReset.ts` have to remove a
// child's key WITHOUT importing the service (the imports point the other way, and a service pulls in
// `localStorage`), and a test has to be able to read the key without a DOM.
export const PRACTICE_KEY_PREFIX = 'bornelaering-practice:'

export const practiceKeyFor = (profileId: string): string => `${PRACTICE_KEY_PREFIX}${profileId}`
