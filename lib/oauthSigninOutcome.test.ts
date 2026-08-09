import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifySignInFailure, readSignInResponse } from './oauth-signin-outcome.ts'

// THE REASON THREE BUG REPORTS SAID THE SAME THING ABOUT TWO DIFFERENT FAULTS.
//
// `auth.api.signInSocial({ …, asResponse: true })` does not THROW an APIError — better-call converts it
// into an error Response and RETURNS it. So the callback's `catch` never ran, `set-auth-token` was
// merely absent, and every distinct failure — a wrong Apple audience, a missing email, an allowlist
// refusal — arrived as one indistinguishable slug with an empty detail object.
//
// These are behavioural, not source greps: real `Response` objects in, verdicts out.

const errorResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

test('a 200 carrying set-auth-token is the only success', async () => {
  const res = new Response(null, { status: 200, headers: { 'set-auth-token': 'raw.hmac' } })
  assert.deepEqual(await readSignInResponse(res), { ok: true, token: 'raw.hmac' })
})

test('an APIError Response yields its status, code and message instead of nothing', async () => {
  // The Apple shape RC1 produced: better-auth rejects the id_token whose `aud` did not match.
  const outcome = await readSignInResponse(
    errorResponse(401, { code: 'INVALID_TOKEN', message: 'id token is not valid' }),
  )
  assert.deepEqual(outcome, {
    ok: false,
    status: 401,
    code: 'INVALID_TOKEN',
    message: 'id token is not valid',
  })
})

test('a 401 maps to its own reason, not to the header-less-200 slug', () => {
  assert.deepEqual(classifySignInFailure({ status: 401, code: 'INVALID_TOKEN' }), {
    kind: 'fault',
    reason: 'signin-rejected',
  })
  // The historical slug now means ONLY what it says, so the staging report codes quoting it still
  // resolve to the same thing rather than to "some sign-in failure or other".
  assert.deepEqual(classifySignInFailure({ status: 200 }), {
    kind: 'fault',
    reason: 'no-session-token-after-signin',
  })
})

test('a 403 is the allowlist refusal — the branch that was unreachable through OAuth', () => {
  // `databaseHooks.user.create.before` throws FORBIDDEN, which `asResponse` turned into a 403 Response
  // nobody read. Its Danish copy ("Denne konto har ikke adgang til Børnelæring.") could therefore never
  // be shown for an OAuth sign-in, which is the only kind we have.
  assert.deepEqual(classifySignInFailure({ status: 403 }), { kind: 'forbidden' })
  // Both directions: better-auth may send the code with a different status.
  assert.deepEqual(classifySignInFailure({ status: 500, code: 'FORBIDDEN' }), { kind: 'forbidden' })
  // A forbidden verdict has no `reason`, which is what makes "no report, no Fejlkode" structural rather
  // than a branch someone has to remember to write.
  assert.ok(!('reason' in classifySignInFailure({ status: 403 })))
})

test('a 200 with no token and no body still produces a usable outcome', async () => {
  // The literal `no-session-token-after-signin` case. An empty body must not throw its way out of the
  // reader — a diagnostic that crashes the response is worse than no diagnostic.
  const outcome = await readSignInResponse(new Response(null, { status: 200 }))
  assert.deepEqual(outcome, { ok: false, status: 200, code: undefined, message: undefined })
  assert.deepEqual(classifySignInFailure({ status: 200 }), {
    kind: 'fault',
    reason: 'no-session-token-after-signin',
  })
})

test('a non-Response answer is a fault, not a crash', async () => {
  const outcome = await readSignInResponse({ headers: {} })
  assert.deepEqual(outcome, { ok: false, status: 0, code: 'not_a_response' })
})

test('the strings that reach a report are bounded', async () => {
  // They ride into a bug report, which is public-by-URL. Nothing here should be able to carry a wall of
  // provider text.
  const outcome = await readSignInResponse(
    errorResponse(400, { code: 'x'.repeat(500), message: 'y'.repeat(5000) }),
  )
  assert.equal(outcome.ok, false)
  if (outcome.ok) return
  assert.equal(outcome.code?.length, 80)
  assert.equal(outcome.message?.length, 200)
})
