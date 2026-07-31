import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  registerSecret,
  forgetSecret,
  clearSecrets,
  registeredSecretCount,
  redactText,
  redactDeep,
  sanitizeUrl,
  isSensitiveUrl,
} from './redact.ts'

const SESSION_TOKEN = 'Zk7Qx9LmPaRtVbNc4WgYhJd2Fs6Te8Uu'
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInNpZCI6InNlc3Npb25fOSJ9.q7nJ4Xk2LmPaRtVbNc4WgYhJd2Fs6Te8Uu'

beforeEach(() => clearSecrets())

test('a registered secret is redacted by IDENTITY, whatever its shape', () => {
  registerSecret(SESSION_TOKEN)
  const line = `[auth] stored session ${SESSION_TOKEN} for this device`
  const out = redactText(line)
  assert.ok(!out.includes(SESSION_TOKEN))
  assert.match(out, /«redacted»/)
  // The surrounding diagnostic text survives — the ring stays useful.
  assert.match(out, /\[auth\] stored session/)
})

test('registration is length-guarded so a short string cannot mangle unrelated lines', () => {
  registerSecret('abc')
  assert.equal(registeredSecretCount(), 0)
  assert.equal(redactText('abc def abcdef'), 'abc def abcdef')
})

test('forgetSecret stops redacting a rotated value', () => {
  registerSecret(SESSION_TOKEN)
  forgetSecret(SESSION_TOKEN)
  assert.equal(redactText(SESSION_TOKEN), SESSION_TOKEN)
})

test('the registry is bounded (a long session mints an access JWT every 15 minutes)', () => {
  for (let i = 0; i < 200; i++) registerSecret(`token-value-number-${i}-padded`)
  assert.ok(registeredSecretCount() <= 64, `registry grew to ${registeredSecretCount()}`)
})

test('backstop: an UNREGISTERED JWT is still caught by shape', () => {
  const out = redactText(`Authorization failed for ${JWT}`)
  assert.ok(!out.includes(JWT))
  assert.match(out, /«redacted»/)
})

test('backstop: a Bearer header value is caught', () => {
  const out = redactText('sent header Authorization: Bearer abc123def456ghi789')
  assert.ok(!out.includes('abc123def456ghi789'))
  assert.match(out, /Bearer «redacted»/)
})

test('backstop: an email address becomes «email» (no account identity in a public blob)', () => {
  assert.equal(redactText('signed in as allanvraa@gmail.com'), 'signed in as «email»')
})

test('a longer secret containing a shorter one is redacted whole, not half', () => {
  const short = 'PREFIX-SECRET-A'
  const long = `${short}-AND-MORE-TAIL`
  registerSecret(short)
  registerSecret(long)
  const out = redactText(`value=${long}`)
  assert.equal(out, 'value=«redacted»')
})

test('redactDeep scrubs nested payload strings and keeps the structure', () => {
  registerSecret(SESSION_TOKEN)
  const payload = {
    app: { route: '/album', note: `token ${SESSION_TOKEN}` },
    list: ['clean', `x ${SESSION_TOKEN}`],
    n: 42,
    b: true,
    nil: null,
  }
  const out = redactDeep(payload)
  assert.equal(out.app.route, '/album')
  assert.ok(!JSON.stringify(out).includes(SESSION_TOKEN))
  assert.equal(out.n, 42)
  assert.equal(out.b, true)
  assert.equal(out.nil, null)
  assert.equal(out.list.length, 2)
})

test('isSensitiveUrl matches the auth surface only', () => {
  assert.equal(isSensitiveUrl('/api/auth/get-session'), true)
  assert.equal(isSensitiveUrl('/api/auth/family/pin/verify'), true)
  assert.equal(isSensitiveUrl('https://x.dev/api/auth?code=1'), true)
  assert.equal(isSensitiveUrl('/api/auth'), true)
  assert.equal(isSensitiveUrl('/api/tts-azure'), false)
  assert.equal(isSensitiveUrl('/api/progress?profileId=p1'), false)
})

test('sanitizeUrl drops the ENTIRE query and fragment on auth paths', () => {
  assert.equal(
    sanitizeUrl('/api/auth/family/oauth/claim?flowId=abcdefghij#bl_auth=1'),
    '/api/auth/family/oauth/claim',
  )
  assert.equal(
    sanitizeUrl('https://app.example/api/auth/callback/google?code=4/secret&state=xyz'),
    'https://app.example/api/auth/callback/google',
  )
})

test('sanitizeUrl strips sensitive params on NON-auth paths, keeping the rest diagnosable', () => {
  const out = sanitizeUrl('/api/progress?profileId=p1&token=supersecretvalue&rev=7')
  assert.ok(!out.includes('supersecretvalue'))
  assert.match(out, /profileId=p1/)
  assert.match(out, /rev=7/)
})

test('sanitizeUrl never records a fragment', () => {
  assert.equal(sanitizeUrl('/album#bl_auth=1'), '/album')
  assert.equal(sanitizeUrl('/?x=1#code=leak'), '/?x=1')
})

test('sanitizeUrl survives garbage rather than throwing, and still scrubs it', () => {
  assert.equal(sanitizeUrl(''), '')
  assert.equal(sanitizeUrl(undefined as unknown as string), '')
  // Nonsense parses as a relative path against the internal base. What matters is that it neither
  // throws nor lets a sensitive parameter through — not the exact shape of the salvaged path.
  const out = sanitizeUrl('::://not a url?code=1&token=supersecretvalue')
  assert.ok(!out.includes('supersecretvalue'))
  assert.ok(!/code=1(&|$)/.test(out))
})

test('a synthetic auth request never survives the ring pipeline (the §8.1 assertion)', () => {
  // Exactly what diagnosticsBuffer will do: skip the body entirely, sanitize the URL, redact the msg.
  registerSecret(SESSION_TOKEN)
  const recorded = {
    url: sanitizeUrl(`/api/auth/family/pin/verify?flow=${SESSION_TOKEN}`),
    method: 'POST',
    status: 401,
    redacted: true,
    // NB: no request body and no responseSnippet — the PIN travels in a POST body and that is the
    // single most important reason never to add body capture "for debugging".
    consoleLine: redactText(`[auth] verify failed with ${SESSION_TOKEN} / ${JWT}`),
  }
  const serialised = redactText(JSON.stringify(recorded))
  assert.ok(!serialised.includes(SESSION_TOKEN))
  assert.ok(!serialised.includes(JWT))
  assert.ok(!('body' in recorded))
  assert.equal(recorded.url, '/api/auth/family/pin/verify')
  assert.equal(recorded.status, 401) // still diagnosable
})
