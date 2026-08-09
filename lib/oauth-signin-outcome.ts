// WHAT `signInSocial` ACTUALLY SAID — read out of a Response, because it does not throw.
//
// `asResponse: true` makes better-call **RETURN** an `APIError` (converted to an error Response) rather
// than throw it — `node_modules/better-call/dist/endpoint.mjs`, the `.catch` wrapped around the handler:
//
//     const response = await handler(internalContext).catch(async (e) => {
//       if (isAPIError(e)) { …; if (context.asResponse) return e }
//       throw e
//     })
//
// So the `try/catch` this logic used to live behind was DEAD for every APIError. `set-auth-token` was
// simply absent, and an Apple audience mismatch, a missing email and an allowlist refusal all collapsed
// into one slug — `no-session-token-after-signin`, with `{}` as its entire detail. Three staging bug
// reports said exactly that about two different faults, and the FORBIDDEN copy ("Denne konto har ikke
// adgang til Børnelæring.") was unreachable through OAuth altogether.
//
// It lives in its OWN module, with no imports at all, so `oauthSigninOutcome.test.ts` can feed it real
// `Response` objects without dragging better-auth, the database pool or `lib/env.ts`'s module-init
// assertions into a unit test. Reached by a Vercel function, so any relative import it ever grows must
// end in `.js` (`.claude/rules/api-endpoints.md`).

export type SignInOutcome =
  | { ok: true; token: string }
  | { ok: false; status: number; code?: string; message?: string }

/**
 * Turn `signInSocial`'s answer into a verdict.
 *
 * A 200 that carries `set-auth-token` is the only success. Everything else reads the JSON body, where
 * better-auth puts `{ code, message }` — `INVALID_TOKEN` for a token whose `aud` we got wrong,
 * `FORBIDDEN` for the allowlist hook, and so on.
 */
export async function readSignInResponse(res: unknown): Promise<SignInOutcome> {
  if (!(res instanceof Response)) {
    return { ok: false, status: 0, code: 'not_a_response' }
  }
  const token = res.headers.get('set-auth-token')
  if (res.ok && token) return { ok: true, token }

  let code: string | undefined
  let message: string | undefined
  try {
    const body = (await res.json()) as { code?: unknown; message?: unknown }
    if (typeof body?.code === 'string') code = body.code.slice(0, 80)
    // better-auth's own English text, not the provider's — it echoes no request material — and it goes
    // into the read-gated report, never onto the page.
    if (typeof body?.message === 'string') message = body.message.slice(0, 200)
  } catch {
    /* not JSON, or an empty body: the status alone is the finding */
  }
  return { ok: false, status: res.status, code, message }
}

export type SignInVerdict =
  /** The allowlist said no. A WORKING refusal: its own Danish copy, no Fejlkode, no report. */
  | { kind: 'forbidden' }
  /** A fault. `reason` is the report slug the adult's Fejlkode will be filed under. */
  | { kind: 'fault'; reason: 'no-session-token-after-signin' | 'signin-rejected' }

/**
 * Which branch a failed sign-in takes.
 *
 * `no-session-token-after-signin` SURVIVES ONLY AS ITS LITERAL MEANING — a 200 that carried no header —
 * so the four staging report codes quoting it still resolve to the same thing. It is no longer the
 * catch-all it became, which is what made three reports about two faults look identical.
 */
export function classifySignInFailure(outcome: {
  status: number
  code?: string
}): SignInVerdict {
  if (outcome.status === 403 || outcome.code === 'FORBIDDEN') return { kind: 'forbidden' }
  if (outcome.status === 200) return { kind: 'fault', reason: 'no-session-token-after-signin' }
  return { kind: 'fault', reason: 'signin-rejected' }
}
