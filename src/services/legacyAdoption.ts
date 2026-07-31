// Adopting the old anonymous v3 blob into a real child profile (accounts PRD §5.5).
//
// Explicit `.ts` extensions: legacyAdoption.test.ts loads this graph in plain Node, which does not
// resolve extensionless relative specifiers (§10.13).
//
// The son's 45-reward book lives under the single localStorage key `bornelaering-progress`. This is how
// it becomes a profile's book without ever being at risk.
//
// THREE INDEPENDENT IDEMPOTENCY GUARDS, because double-counting a book is the worst outcome here:
//   1. EXPLICIT   — a marker records that adoption already happened.
//   2. STRUCTURAL — legacy XP goes into the ledger entry `'legacy-v3'`, never this device's real id. A
//                   re-adoption is then a per-device `max` of the same key onto itself, i.e. a no-op,
//                   EVEN IF the marker write failed. (Using the real deviceId would conflate legacy XP
//                   with live counters, and a re-adopt would clobber later play.)
//   3. DETECTABLE — a fingerprint turns a silent double-count into a diagnosable case.
//
// And the rule that makes even a botched adoption recoverable: **never write to, and never delete, the
// legacy key.** It stays on disk permanently.

import {
  LEGACY_ADOPTION_KEY,
  LEGACY_DEVICE_ID,
  LEGACY_STORAGE_KEY,
  THEME_HINT_KEY,
  migrateToV4,
  totalSlots,
  totalXp,
  type PersistedProgress,
} from '../config/progressSchema.ts'
import { levelFromXp } from '../config/progression.ts'
import { getDeviceId } from './deviceId.ts'
import { progressStore } from './progressStore.ts'
import type { MergeReport } from '../config/progressMerge.ts'

export interface LegacyPreview {
  present: boolean
  collectedCount: number
  level: number
  totalStars: number
  /** Cheap content hash, so a repeat adoption of the SAME blob is distinguishable from a new one. */
  fingerprint: string
}

export interface AdoptionMarker {
  adoptedInto: string
  at: number
  fingerprint: string
}

export type AdoptionResult =
  | { status: 'adopted'; report: MergeReport }
  | { status: 'already-adopted'; marker: AdoptionMarker }
  | { status: 'nothing-to-adopt' }
  | { status: 'unreadable' }

const EMPTY_PREVIEW: LegacyPreview = {
  present: false,
  collectedCount: 0,
  level: 1,
  totalStars: 0,
  fingerprint: '',
}

/** Stable, order-insensitive, and cheap — this is a change detector, not a security hash. */
function fingerprintOf(doc: PersistedProgress): string {
  const ids = Object.keys(doc.stickers.firstAt).sort().join(',')
  let h = 2166136261
  const material = `${totalXp(doc)}|${totalSlots(doc)}|${doc.totals.totalStars}|${ids}`
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function readLegacyRaw(): unknown {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return undefined // undefined = present-but-unreadable, null = absent
  }
}

function migrateLegacy(): PersistedProgress | null {
  const raw = readLegacyRaw()
  if (raw == null) return null
  return migrateToV4(raw, {
    deviceId: getDeviceId(),
    now: Date.now(),
    // GUARD 2: the legacy ledger entry, never this device's real id.
    ledgerKey: LEGACY_DEVICE_ID,
    themeIdHint: (() => {
      try {
        return localStorage.getItem(THEME_HINT_KEY) ?? undefined
      } catch {
        return undefined
      }
    })(),
  })
}

/** What the adult is shown before confirming — "45 klistermærker, niveau 46". */
export function legacyPreview(): LegacyPreview {
  const doc = migrateLegacy()
  if (!doc) return EMPTY_PREVIEW
  const slots = totalSlots(doc)
  return {
    present: true,
    collectedCount: Math.min(45, slots),
    level: levelFromXp(totalXp(doc)).level,
    totalStars: doc.totals.totalStars,
    fingerprint: fingerprintOf(doc),
  }
}

export function adoptionMarker(): AdoptionMarker | null {
  try {
    const raw = localStorage.getItem(LEGACY_ADOPTION_KEY)
    if (!raw) return null
    const m = JSON.parse(raw) as Partial<AdoptionMarker>
    if (typeof m?.adoptedInto !== 'string') return null
    return {
      adoptedInto: m.adoptedInto,
      at: typeof m.at === 'number' ? m.at : 0,
      fingerprint: typeof m.fingerprint === 'string' ? m.fingerprint : '',
    }
  } catch {
    return null
  }
}

/**
 * Adopt the legacy blob into `profileId`.
 *
 * `force` lets the adult DELIBERATELY adopt the same blob into a second profile (two kids really did
 * share the iPad). The marker exists to prevent ACCIDENTAL repeats, not to forbid intentional ones.
 */
export function adoptLegacyInto(profileId: string, force = false): AdoptionResult {
  const marker = adoptionMarker()
  if (marker && !force) return { status: 'already-adopted', marker } // GUARD 1

  const raw = readLegacyRaw()
  if (raw === undefined) return { status: 'unreadable' }
  if (raw === null) return { status: 'nothing-to-adopt' }

  const doc = migrateLegacy()
  if (!doc) return { status: 'nothing-to-adopt' } // present but not v3 → nothing we can map

  if (progressStore.activeProfileId() !== profileId) progressStore.attach(profileId)

  // ADOPTION IS A MERGE — the exact same tested code path sync uses. No second implementation, and
  // therefore no second set of bugs.
  const report = progressStore.applyRemote(doc)
  progressStore.flush()

  // GUARD 3: written AFTER the merge, so a crash in between leaves guard 2 doing the work.
  try {
    const next: AdoptionMarker = {
      adoptedInto: profileId,
      at: Date.now(),
      fingerprint: fingerprintOf(doc),
    }
    localStorage.setItem(LEGACY_ADOPTION_KEY, JSON.stringify(next))
  } catch {
    /* the structural guard still holds without the marker */
  }

  // NB the legacy key is deliberately NOT deleted and NOT rewritten. Even a botched adoption stays
  // recoverable from disk.
  return { status: 'adopted', report: report ?? emptyReport() }
}

const emptyReport = (): MergeReport => ({
  epochWinner: 'equal',
  xpBefore: 0,
  xpAfter: 0,
  slotsBefore: 0,
  slotsAfter: 0,
  clampedSlots: false,
  changedSettings: [],
  changed: false,
})
