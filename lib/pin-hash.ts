// Server-side storage format for the 4-digit adult PIN.
//
// Format: `scrypt$16384$8$1$<saltB64url>$<hashB64url>` over `HMAC-SHA256(PIN_PEPPER, pin)`.
//
// PEPPER FIRST is the point. A 4-digit PIN has a 10 000-value keyspace, so no KDF work factor makes
// a stolen hash safe on its own — but the pepper lives only in the environment, so a DATABASE DUMP
// ALONE cannot enumerate the candidates. Read §8.2: the two controls that actually matter here are
// this pepper and the persisted escalating lockout in src/config/pinPolicy.ts. The KDF is the least
// important of the three; do not "optimise" the other two away because this looks strong.
//
// N=16384 (16 MiB) deliberately, not 32768: at N=32768 scrypt needs exactly Node's default 32 MiB
// `maxmem` and is borderline — a future Node default change would start throwing at runtime.
// pin-hash.test.ts asserts we stay under the default.

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { requireEnv } from './env.js'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

export const SCRYPT_N = 16384
export const SCRYPT_R = 8
export const SCRYPT_P = 1
const KEY_LENGTH = 32
const SALT_LENGTH = 16

const b64url = (b: Buffer): string => b.toString('base64url')

/** Pepper the PIN before it ever reaches the KDF, so the stored hash is useless without the env. */
function peppered(pin: string): Buffer {
  return createHmac('sha256', requireEnv('PIN_PEPPER')).update(pin, 'utf8').digest()
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await scrypt(peppered(pin), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${b64url(salt)}$${b64url(key)}`
}

/**
 * Constant-time comparison against a stored hash. Returns false (never throws) for a malformed or
 * unknown-algorithm record — a corrupt row must read as "wrong PIN", not as a 500.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false
    const [, nStr, rStr, pStr, saltB64, hashB64] = parts
    const N = Number(nStr)
    const r = Number(rStr)
    const p = Number(pStr)
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
    // Refuse absurd parameters from a tampered row rather than trying to allocate for them.
    if (N > 1 << 20 || r > 32 || p > 16) return false

    const salt = Buffer.from(saltB64, 'base64url')
    const expected = Buffer.from(hashB64, 'base64url')
    if (!salt.length || !expected.length) return false

    const actual = await scrypt(peppered(pin), salt, expected.length, { N, r, p })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/** True when a stored record uses parameters we'd no longer write (→ re-hash on next success). */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return true
  return Number(parts[1]) !== SCRYPT_N || Number(parts[2]) !== SCRYPT_R || Number(parts[3]) !== SCRYPT_P
}
