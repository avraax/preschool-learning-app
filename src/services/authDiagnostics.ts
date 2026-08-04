// Why a sign-in failed — the one thing the app could never tell us.
//
// THE HOLE THIS FILLS. Two failure classes can never produce a bug report (see
// `.claude/skills/debug-report/SKILL.md`): the ⚙️ that sends one lives inside `<App />`, behind the auth
// gate, so **nothing can be reported from the lock screen**; and only a CRASH auto-uploads, while every
// sign-in failure is *handled* — a Danish message, or, worst of all, `OAuthReturnHandler`'s poll loop
// simply reaching its 3-minute window and stopping without a word. The owner has now hit failed logins on
// the iPad twice with no data anywhere to look at.
//
// So this module does two things:
//   1. records a STEP TRAIL of the sign-in attempt (also mirrored to `console`, which `diagnosticsBuffer`
//      rings, so the trail rides along in any later manual report too), and
//   2. AUTO-UPLOADS a report — with a screenshot, like a crash report but a handled failure — the moment
//      an attempt decisively fails, and surfaces the short code so the adult can read it out.
//
// WHAT MAY NEVER GO IN. The bug-report blob is public-by-URL. The PIN travels in a POST body, the flowId
// is a live credential for ~10 minutes, and the session token is the account. So every field recorded
// here is an enum, an HTTP status or an error NAME — never a body, a URL with a query, an email or a
// token. `redactText` is applied to the one free-text field as a second line of defence, and
// `authDiagnostics.test.ts` asserts a planted secret cannot reach the payload.

import { redactText } from './redact'

export type AuthStage =
  | 'google-start'
  | 'google-claim'
  | 'google-return'
  | 'passkey-options'
  | 'passkey-unlock'
  | 'access-token'
  | 'session-validate'
  | 'pin-verify'

export type AuthOutcome = 'begin' | 'ok' | 'fail'

export interface AuthStepDetail {
  status?: number
  code?: string
  errorName?: string
  /** Short, non-secret note (e.g. 'no-authorize-url'). Redacted before it is stored. */
  note?: string
}

const TRAIL_MAX = 40
const trail: string[] = []
let startedAt = 0

/**
 * Record one step of a sign-in attempt. Cheap, synchronous, never throws — it is called from paths whose
 * whole job is to fail gracefully.
 *
 * Also mirrored to `console` (warn for a failure, log otherwise) because `diagnosticsBuffer` rings console
 * lines: that makes the trail available even in reports this module never sends.
 */
export function noteAuthStep(stage: AuthStage, outcome: AuthOutcome, detail?: AuthStepDetail): void {
  try {
    if (!startedAt) startedAt = Date.now()
    const bits = [
      `+${Date.now() - startedAt}ms`,
      stage,
      outcome,
      detail?.status !== undefined ? `status=${detail.status}` : '',
      detail?.code ? `code=${detail.code}` : '',
      detail?.errorName ? `name=${detail.errorName}` : '',
      detail?.note ? redactText(String(detail.note)).slice(0, 80) : '',
    ].filter(Boolean)
    const line = bits.join(' ')
    trail.push(line)
    if (trail.length > TRAIL_MAX) trail.shift()
    const say = outcome === 'fail' ? console.warn : console.log
    say(`[auth] ${line}`)
  } catch {
    /* diagnostics must never break the thing they observe */
  }
}

/** The trail so far, oldest first. Safe to embed in a report. */
export function getAuthTrail(): string[] {
  return [...trail]
}

/** Called when a sign-in SUCCEEDS, so the next attempt's trail starts clean. */
export function resetAuthTrail(): void {
  trail.length = 0
  startedAt = 0
}

// ----- auto-reporting ---------------------------------------------------------------------------

const CAP_PER_SESSION = 3
const SIG_KEY = 'bl-auth-report-signatures'
const MIN_INTERVAL_MS = 30_000

let lastUploadAt = 0
let lastCode: string | null = null
const listeners = new Set<(code: string | null) => void>()

/** Subscribe to "a login failure was just reported as <code>" — the lock screen shows it to the adult. */
export function subscribeAuthReportCode(fn: (code: string | null) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getLastAuthReportCode(): string | null {
  return lastCode
}

/**
 * Auto-upload a failed sign-in. Returns the short code, or null if nothing was sent.
 *
 * Throttling matters more here than for crashes: `google-claim` runs inside a 3s POLL, so a server-side
 * fault would otherwise upload 60 reports in one login attempt. Dedupe is by `stage|reason` (so one
 * report per distinct fault), capped per session, with a floor on the interval between uploads. If
 * `sessionStorage` is unavailable we do NOT report at all — the same choice crash reporting makes, since
 * without it there is no way to bound a loop.
 */
export async function reportAuthFailure(
  stage: AuthStage,
  reason: string,
  detail?: AuthStepDetail,
): Promise<string | null> {
  noteAuthStep(stage, 'fail', detail)
  const signature = `${stage}|${reason}`
  try {
    const sent: string[] = JSON.parse(sessionStorage.getItem(SIG_KEY) ?? '[]')
    if (sent.includes(signature) || sent.length >= CAP_PER_SESSION) return null
    if (Date.now() - lastUploadAt < MIN_INTERVAL_MS) return null
    sent.push(signature)
    sessionStorage.setItem(SIG_KEY, JSON.stringify(sent))
  } catch {
    return null
  }
  lastUploadAt = Date.now()

  try {
    // Imported lazily so the whole reporting + screenshot graph stays out of the pre-gate bundle path
    // until something actually fails.
    const [{ buildReportPayload, submitBugReport }, { captureScreenshot }] = await Promise.all([
      import('./bugReporter'),
      import('./screenshotService'),
    ])
    const payload = buildReportPayload({
      type: 'auth',
      category: 'login',
      // The note is what shows in the report LISTING, so make it self-describing at a glance.
      note: `Login mislykkedes: ${stage} — ${reason}`,
      auth: {
        stage,
        reason,
        status: detail?.status,
        code: detail?.code,
        errorName: detail?.errorName,
        trail: getAuthTrail(),
      },
    })
    // A screenshot, like the owner asked for — the lock screen's own state is most of the story. The auth
    // surfaces carry `data-bl-redact` and `screenshotService` drops those nodes, so the capture cannot
    // carry the account email or a PIN pad's contents (`.claude/rules/auth.md`).
    const shot = await captureScreenshot().catch(() => null)
    const result = await submitBugReport(payload, shot)
    lastCode = result.id
    listeners.forEach((fn) => {
      try {
        fn(lastCode)
      } catch {
        /* ignore */
      }
    })
    return result.id
  } catch {
    // Offline, or the endpoint is down — the trail is still in the console ring for a later report.
    return null
  }
}
