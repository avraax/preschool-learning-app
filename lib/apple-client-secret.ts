// Apple's OAuth "client secret" is not a secret string — it is a JWT you sign yourself.
//
// Every other provider hands you a fixed `client_secret` and you paste it into an env var. Apple
// instead gives you a `.p8` private key and expects an **ES256-signed JWT** whose `iss` is your Team
// ID, `sub` your Services ID, and `aud` `https://appleid.apple.com`. It expires (Apple caps the
// lifetime at 6 months), so it cannot be generated once and stored — it has to be minted at use.
//
// NO JWT LIBRARY. Node's `crypto` signs ES256 directly, and the only non-obvious part is the
// signature ENCODING: `crypto.sign` defaults to DER, while JOSE requires the fixed-width r‖s form.
// `dsaEncoding: 'ieee-p1363'` is what makes the difference, and getting it wrong produces a token
// Apple rejects with a generic `invalid_client` — which reads exactly like a wrong key ID.
//
// `.js` extensions on the relative imports: this module is reached by `api/` through
// `lib/auth-family-plugin.ts`, and Vercel compiles each file to a sibling `.js` while rewriting no
// specifiers (`.claude/rules/api-endpoints.md`). A `.ts` here is a production-only ERR_MODULE_NOT_FOUND.

import { createPrivateKey, sign as cryptoSign } from 'node:crypto'
import { apple } from './env.js'

const APPLE_AUDIENCE = 'https://appleid.apple.com'

/**
 * Apple allows up to 6 months. We use a short life and cache it: a long-lived secret sitting in
 * memory buys nothing, and re-minting costs one signature.
 */
const SECRET_TTL_MS = 30 * 60 * 1000
/** Re-mint slightly early so a request can never pick up a token that expires mid-flight. */
const REFRESH_MARGIN_MS = 60 * 1000

const b64url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input).toString('base64url')

let cached: { token: string; expiresAt: number } | null = null

/**
 * Mint (or reuse) the client secret for the Apple token endpoint.
 *
 * Throws when Apple is not configured — callers must check `apple().enabled` first, which is also
 * what keeps the button off the sign-in screen until the owner has set the four env vars.
 */
export function appleClientSecret(now: number = Date.now()): string {
  const cfg = apple()
  if (!cfg.enabled) throw new Error('[auth] Sign in with Apple is not configured')

  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now) return cached.token

  const iat = Math.floor(now / 1000)
  const exp = Math.floor((now + SECRET_TTL_MS) / 1000)

  const header = { alg: 'ES256', kid: cfg.keyId, typ: 'JWT' }
  const payload = {
    iss: cfg.teamId,
    iat,
    exp,
    aud: APPLE_AUDIENCE,
    // `sub` is the SERVICES ID for the web flow — not the app's bundle identifier, and not the Team
    // ID. Using the bundle id here is the classic mistake and Apple answers `invalid_client`.
    sub: cfg.clientId,
  }

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = createPrivateKey(cfg.privateKey)
  // ieee-p1363, not DER — see the header. This is the line that breaks silently if "simplified".
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  })

  const token = `${signingInput}.${b64url(signature)}`
  cached = { token, expiresAt: now + SECRET_TTL_MS }
  return token
}

/**
 * Can Apple sign-in actually be offered? — i.e. configured AND the key genuinely signs.
 *
 * `apple().enabled` only says the four env vars are non-empty. A malformed `.p8` passes that and then
 * throws inside `createPrivateKey`, so keying the UI off `enabled` alone would show a button that dies
 * at the token exchange with the adult blaming their Apple ID. This is the ONE definition every
 * surface uses: better-auth's provider registration, `/family/status`'s `methods`, and the
 * `/family/oauth/start` guard.
 */
export function appleUsable(): boolean {
  if (!apple().enabled) return false
  try {
    appleClientSecret()
    return true
  } catch {
    return false
  }
}

/** Tests only: drop the memo so a case can control the clock. */
export function resetAppleClientSecretCache(): void {
  cached = null
}
