// A stable per-device id. Two jobs (accounts PRD §5.9):
//   * the LEDGER KEY — each device only ever increments its own entry, which is what makes two iPads
//     playing offline add up instead of one erasing the other's rewards,
//   * the sync ORIGIN stamp and the LWW tie-breaker (`settingsMeta[path].by`).
//
// NEVER cleared by resetAll(): a reset zeroes the child's progress, not the device's identity. Wiping
// it would orphan the ledger entry the reset just zeroed and make the next merge look like a new device.

// Explicit `.ts` extension: progressStore imports this module, and progressStore.test.ts loads that
// graph in plain Node, which does not resolve extensionless relative specifiers (§10.13).
import { DEVICE_ID_KEY } from '../config/progressSchema.ts'

let cached: string | null = null

function makeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    // Older WebViews without randomUUID — good enough for a ledger key, which only has to be unique
    // among a household's handful of devices.
    return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function getDeviceId(): string {
  if (cached) return cached
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)
    if (stored) {
      cached = stored
      return stored
    }
    const fresh = makeId()
    localStorage.setItem(DEVICE_ID_KEY, fresh)
    cached = fresh
    return fresh
  } catch {
    // Private mode: an in-memory id is harmless because ledger entries are ADDITIVE — a throwaway
    // entry contributes its own play and never overwrites another device's.
    cached = makeId()
    return cached
  }
}

/** DEV/support only: forces this device to look like a new one to the merge. */
export function resetDeviceId(): string {
  cached = null
  try {
    localStorage.removeItem(DEVICE_ID_KEY)
  } catch {
    /* ignore */
  }
  return getDeviceId()
}
