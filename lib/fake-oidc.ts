// A FAKE IDENTITY PROVIDER, for driving the sign-in round trip without Google or Apple.
//
// Sign-in reliability PRD W7 — "the test key". Every fault in that PRD was found from bug reports the
// owner sent from an iPad, because nothing here could be exercised any other way: a real sign-in needs a
// real consent screen, so `start → callback → claim → adopt → profile-create` had no automated coverage
// at all, and neither did any of its failure branches. With this, `cdp.mjs` and `webkit.mjs` can drive
// the whole thing end to end, including a 403 refusal and a rejected token exchange.
//
// TRIPLE-GATED, FAILING CLOSED, at `fakeProviderEnabled()` in `lib/env.ts` — the flag, the runtime and
// the tier, none of which can be true on production. What this bypasses is the identity check itself, so
// the gate is the only thing standing between it and "anyone may sign in as anyone".
//
// TWO DELIBERATE DEVIATIONS FROM THE PRD's SKETCH, both narrowing:
//   * The key is verified against the in-memory PUBLIC KEY rather than through a local JWKS endpoint.
//     Identical strength (we own both ends and `verifyIdToken` is our own override) and it adds no
//     route, which matters for something whose entire risk is being reachable.
//   * The token rides a REAL better-auth provider slot (`microsoft`), because `signInSocial` resolves
//     its provider from better-auth's own registry — an invented key is dropped before the handler runs.
//     That keeps the REAL code path under test: `verifyIdToken` → `getUserInfo` → the allowlist hook →
//     session creation → parking. Only the two overridden functions are ours.
//
// Reached by a Vercel function, so relative imports end in `.js`.

import { generateKeyPairSync, type KeyObject } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

/** The better-auth provider slot the fake token rides in. Never used for a real Microsoft sign-in. */
export const FAKE_PROVIDER_SLOT = 'microsoft'

/** Issuer of the fake tokens — a value that could never be mistaken for a real provider's. */
const FAKE_ISSUER = 'https://fake-oidc.invalid'
const FAKE_AUDIENCE = 'boernelaering-fake'

/**
 * Generated once per process, held only in memory, and never written anywhere.
 *
 * That is a property, not an omission: a token signed by one process is worthless to the next, so
 * nothing minted here can outlive the dev server it was made in.
 */
let keys: { privateKey: KeyObject; publicKey: KeyObject } | null = null
function keyPair(): { privateKey: KeyObject; publicKey: KeyObject } {
  if (!keys) keys = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  return keys
}

export interface FakeIdentity {
  sub: string
  email: string
  name?: string
}

/** Mint an ID token for `identity`, in the shape `getUserInfo` below reads back. */
export async function signFakeIdToken(identity: FakeIdentity): Promise<string> {
  return new SignJWT({
    email: identity.email,
    email_verified: true,
    name: identity.name ?? 'Fake Adult',
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(FAKE_ISSUER)
    .setAudience(FAKE_AUDIENCE)
    .setSubject(identity.sub)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(keyPair().privateKey)
}

/** Verify one. Returns the claims, or null — the same two answers a real provider's check gives. */
export async function verifyFakeIdToken(token: string): Promise<FakeIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, keyPair().publicKey, {
      issuer: FAKE_ISSUER,
      audience: FAKE_AUDIENCE,
      algorithms: ['ES256'],
    })
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null
    return { sub: payload.sub, email: payload.email, name: payload.name as string | undefined }
  } catch {
    return null
  }
}

/**
 * The provider config to register in `socialProviders` when — and only when — the gate is open.
 *
 * `verifyIdToken` and `getUserInfo` are the only two functions better-auth uses on the `idToken` branch
 * of `signInSocial`, and both are documented override points on the real providers. Everything after
 * them is untouched: the allowlist hook still runs, the session is still created the same way, and the
 * `set-auth-token` header still carries the signed cookie value the claim has to split.
 */
export function fakeSocialProvider() {
  return {
    // Never used — there is no authorize URL and no token exchange on this path — but the provider
    // factory expects them, and empty strings would read as "half-configured" to anyone debugging.
    clientId: 'fake-oidc-client',
    clientSecret: 'fake-oidc-secret',
    verifyIdToken: async (token: string): Promise<boolean> => !!(await verifyFakeIdToken(token)),
    getUserInfo: async (token: { idToken?: string }) => {
      const identity = token.idToken ? await verifyFakeIdToken(token.idToken) : null
      if (!identity) return null
      return {
        user: {
          id: identity.sub,
          name: identity.name ?? 'Fake Adult',
          email: identity.email,
          emailVerified: true,
        },
        data: { sub: identity.sub, email: identity.email },
      }
    },
  }
}

/**
 * What a driven test wants the flow to do. Encoded into the fake authorization "code", so the whole
 * scenario is chosen at `/oauth/start` time and needs no server state.
 */
export type FakeOutcome =
  /** A normal, successful sign-in as `email`. */
  | { kind: 'ok'; email: string }
  /** The token exchange itself fails — the `token-exchange-rejected` branch (PRD scenario C5). */
  | { kind: 'reject-exchange' }
  /** A token that will not verify — what a wrong Apple audience produced (RC1, scenario C2/C3). */
  | { kind: 'bad-token' }

const OUTCOME_PREFIX = 'fake:'

export function encodeFakeCode(outcome: FakeOutcome): string {
  if (outcome.kind === 'ok') return `${OUTCOME_PREFIX}ok:${encodeURIComponent(outcome.email)}`
  return `${OUTCOME_PREFIX}${outcome.kind}`
}

export function decodeFakeCode(code: string): FakeOutcome | null {
  if (!code.startsWith(OUTCOME_PREFIX)) return null
  const rest = code.slice(OUTCOME_PREFIX.length)
  if (rest === 'reject-exchange' || rest === 'bad-token') return { kind: rest }
  if (rest.startsWith('ok:')) {
    const email = decodeURIComponent(rest.slice(3))
    // An address is required: a silent fallback would make a mis-typed test look like a pass.
    return email ? { kind: 'ok', email } : null
  }
  return null
}
