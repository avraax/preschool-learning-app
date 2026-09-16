// Where a report lives in the bucket, and how to read its ORIGIN back out of the path.
//
// Every report — a message an adult wrote, a crash the app uploaded by itself, a sign-in that failed —
// used to land at `bug-reports/<date>/<ID>/report.json`. In the Blob dashboard they were therefore
// indistinguishable: same folder shape, same filename, and the only thing that said which was which
// was the `type` field INSIDE the JSON. The owner (2026-09-16) wants to tell them apart in the bucket
// itself — *"i would like to be able to distinguish where entries in the bucket comes from. If its
// from this feedback area or its error auto send because of errors in the app"*.
//
// So the origin goes in the FOLDER NAME: `bug-reports/<date>/feedback-M4QP2/report.json`.
//
// **The id stays the trailing segment**, because the short code is what a parent reads off the screen
// and quotes in a mail, and it must remain greppable and unambiguous. Prefixing rather than suffixing
// also makes a date folder sort by origin in any listing.
//
// **LEGACY PATHS MUST KEEP RESOLVING.** Everything stored before this change is a bare `<ID>` folder,
// and those reports are still the record of real faults. `parseReportFolder` accepts both shapes and
// reports the origin as `null` for the old ones — which is honest: an old folder genuinely does not
// say, and claiming `feedback` for it would be a guess.
//
// PURE + Node-importable. **`.js` on every relative import in this file and in anything that reaches
// it** — Vercel compiles each `api/*.ts` and `lib/*.ts` to a sibling `.js` and rewrites no specifiers,
// so a `.ts` here is a production-only `ERR_MODULE_NOT_FOUND` (there are no relative imports today;
// keep it that way or use `.js`).

/** The three ways a report can come into being. `manual` is the only one a human chose. */
export type ReportType = 'manual' | 'crash' | 'auth'

/**
 * The folder-name prefix for each type.
 *
 * `manual` becomes **`feedback`**, not `manual`: the folder name is read by a human scanning a bucket,
 * and `feedback` is what the door is called. The other two keep their own words.
 */
const ORIGIN_BY_TYPE: Record<ReportType, string> = {
  manual: 'feedback',
  crash: 'crash',
  auth: 'auth',
}

/** Anything that is not one of the three known types. Stored rather than guessed. */
export const UNKNOWN_ORIGIN = 'ukendt'

/** Every origin segment that may appear in a path, for parsing and for listing filters. */
export const REPORT_ORIGINS = ['feedback', 'crash', 'auth', UNKNOWN_ORIGIN] as const

/** `manual` → `feedback`, and an unrecognised or missing type → `ukendt` rather than a throw. */
export const originForType = (type: unknown): string =>
  typeof type === 'string' && type in ORIGIN_BY_TYPE
    ? ORIGIN_BY_TYPE[type as ReportType]
    : UNKNOWN_ORIGIN

/**
 * The folder a new report is written to, e.g. `feedback-M4QP2`.
 *
 * The id is upper-cased because the alphabet is upper-case and a lookup upper-cases what it is given;
 * a lower-case folder would be findable only by luck.
 */
export const reportFolder = (type: unknown, id: string): string =>
  `${originForType(type)}-${id.toUpperCase()}`

/**
 * Read a folder name back. Accepts both shapes:
 *   `feedback-M4QP2` → { origin: 'feedback', id: 'M4QP2' }
 *   `M4QP2`          → { origin: null,       id: 'M4QP2' }   ← stored before 2026-09-16
 *
 * `origin: null` means "this path does not say", NOT "unknown origin" — a caller that wants the real
 * answer for a legacy report has to open the JSON and read `type`. The two are kept distinct on
 * purpose: `ukendt` is a recorded verdict, `null` is an absent one.
 */
export const parseReportFolder = (folder: string): { origin: string | null; id: string } => {
  const dash = folder.indexOf('-')
  if (dash > 0) {
    const head = folder.slice(0, dash)
    if ((REPORT_ORIGINS as readonly string[]).includes(head)) {
      return { origin: head, id: folder.slice(dash + 1) }
    }
  }
  return { origin: null, id: folder }
}

/**
 * Does this folder hold the report with this id, in either shape?
 *
 * Used by the id lookup, which previously did `pathname.endsWith('/' + id + '/report.json')` — a test
 * that silently stops matching the moment the folder gains a prefix.
 */
export const folderHasId = (folder: string, id: string): boolean =>
  parseReportFolder(folder).id.toUpperCase() === id.toUpperCase()
