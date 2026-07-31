// The PERSISTED progress document (schema v4) and the derivation that turns it back into the exact
// in-memory shape the app already reads.
//
// THE KEY ARCHITECTURAL INSIGHT (accounts PRD §5.1): `stickers.collected` / `.newIds` have exactly
// ONE consumer — src/components/hub/StickerAlbum.tsx — even though 45 files read progressStore. So we
// change the persisted source of truth to a tiny composition of CRDTs (which is what makes local-first
// sync sound) while keeping the in-memory READ MODEL byte-identical, and no consumer changes at all:
//
//     PersistedProgress (v4)   ← canonical, tiny, all CRDTs; this is what syncs
//             │ derive()
//             ▼
//     ProgressState            ← today's exact shape (+ profileId), what 45 files read
//
// Because `collected`, `newIds`, `totalStickers`, `globalXp` and `bloom` become DERIVED rather than
// merged, the store invariants hold BY CONSTRUCTION and no merge can violate them.
//
// PURE + Node-importable: no `window`, no network, no `Date.now()` outside an injected `now`. The
// Vercel function api/progress.ts imports this file directly (so there is exactly one schema), and
// `node --test` imports it in plain Node — hence the explicit `.ts` extensions below.

import {
  REWARD_PATH,
  allRewards,
  rewardAt,
  slotOfReward,
} from './stickers.ts'
import { REWARD_SLOTS, collectedFromLevel, levelFromXp } from './progression.ts'

export const SCHEMA_VERSION = 4 as const

// ----- Storage keys (accounts PRD §5.8) ---------------------------------------------------------
/** The v3 anonymous blob. Adoption SOURCE only: never written again, never deleted. */
export const LEGACY_STORAGE_KEY = 'bornelaering-progress'
/** Ledger key that legacy XP is adopted under. MUST differ from any real deviceId (§5.5 guard 2). */
export const LEGACY_DEVICE_ID = 'legacy-v3'
export const DEVICE_ID_KEY = 'bornelaering-device-id'
export const ACCOUNT_KEY = 'bornelaering-account'
export const ACTIVE_PROFILE_KEY = 'bornelaering-active-profile'
export const LEGACY_ADOPTION_KEY = 'bornelaering-legacy-adoption'
/** Device-level first-paint hint. Truth lives in `settings.themeId` (profile-scoped, syncs). */
export const THEME_HINT_KEY = 'bornelaering-theme'

export const progressKeyFor = (profileId: string): string => `bornelaering-progress:${profileId}`

// ----- The read model (unchanged shape — moved here so both halves share one definition) ---------

export type DifficultyLevel = 'let' | 'normal' | 'svaer'
export type SectionId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'

/** Canonical section list (note: colors is `colors`, the route is `/farver`). */
export const SECTION_IDS: SectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

export interface DifficultySetting {
  global: DifficultyLevel
  perSection?: Partial<Record<SectionId, DifficultyLevel>>
}

export interface ProgressSettings {
  sfxEnabled: boolean
  musicEnabled: boolean
  /** Migration MARKER, not a preference — see the merge rule for it in progressMerge.ts. */
  musicDefaultOn?: boolean
  difficulty: DifficultySetting
  /** v4: the chosen skin follows the child across devices. */
  themeId?: string
}

export interface PerGameStats {
  bestStreak: number
  bestStars: number
  bestCount: number
  roundsCompleted: number
  lifetimeCorrect: number
}

export interface SectionBloom {
  xp: number
  updatedAt: number
}

export interface ProgressionState {
  globalXp: number
  lastCelebratedLevel: number
  bloom: Record<SectionId, SectionBloom>
  explored: Record<SectionId, string[]>
  updatedAt: number
}

export interface ProgressState {
  version: typeof SCHEMA_VERSION
  /** v4: which child this state belongs to. `null` while the store is INERT (detached). */
  profileId: string | null
  stickers: {
    collected: Record<string, { count: number; firstAt: number }>
    newIds: string[]
  }
  perGame: Record<string, PerGameStats>
  totals: {
    totalStars: number
    totalStickers: number
  }
  progression: ProgressionState
  settings: ProgressSettings
}

// ----- The persisted (canonical, syncable) form --------------------------------------------------

/**
 * One device's monotonic contributions. Each device only ever increments ITS OWN entry, so the merge
 * is a per-device `max` and the totals are sums — a G-Counter. This is what makes two iPads playing
 * offline add up instead of one erasing the other's rewards (§6.2b).
 */
export interface DeviceCounters {
  xp: number
  /** Slots THIS device actually handed over via a ceremony. */
  slots: number
  bloom: Partial<Record<SectionId, number>>
}

export interface LwwStamp {
  at: number
  by: string
}

export interface SyncMeta {
  /** Monotonic local revision, bumped on every persisted commit. */
  rev: number
  updatedAt: number
  /** Bumped by resetAll(); a HIGHER epoch wins WHOLESALE (a reset is a declared fresh start). */
  epoch: number
  /** The rev the server has acked → dirty === rev > syncedRev. */
  syncedRev: number
  /** The server rev we last reconciled against (the `baseRev` for the next PUT). */
  serverRev: number
  originDevice: string
}

export interface PersistedProgress {
  version: typeof SCHEMA_VERSION
  profileId: string | null
  stickers: {
    /** The path cursor: how many slots have been handed over, duplicates (gold pass) included. */
    grantedSlots: number
    /** Slots already SEEN in the book. `newIds` is the contiguous suffix above this (§6.2d). */
    seenThroughSlot: number
    firstAt: Record<string, number>
  }
  ledger: Record<string /* deviceId */, DeviceCounters>
  perGame: Record<string, PerGameStats>
  /** `totalStickers` is DERIVED and deliberately absent from the wire. */
  totals: { totalStars: number }
  progression: {
    lastCelebratedLevel: number
    explored: Record<SectionId, string[]>
    updatedAt: number
  }
  settings: ProgressSettings
  /** Keyed by field PATH, e.g. 'difficulty.perSection.math' — see progressMerge.ts. */
  settingsMeta: Record<string, LwwStamp>
  sync: SyncMeta
}

// ----- small helpers ----------------------------------------------------------------------------

const DIFFICULTY_LEVELS: DifficultyLevel[] = ['let', 'normal', 'svaer']
export const isDifficultyLevel = (v: unknown): v is DifficultyLevel =>
  typeof v === 'string' && (DIFFICULTY_LEVELS as string[]).includes(v)

const nonNegInt = (x: unknown): number => Math.max(0, Math.floor(Number(x) || 0))

/** Ids that actually exist on the reward path. */
const ON_PATH = new Set(allRewards().map((r) => r.id))

export const emptyGameStats = (): PerGameStats => ({
  bestStreak: 0,
  bestStars: 0,
  bestCount: 0,
  roundsCompleted: 0,
  lifetimeCorrect: 0,
})

export const emptyDeviceCounters = (): DeviceCounters => ({ xp: 0, slots: 0, bloom: {} })

const emptyExplored = (): Record<SectionId, string[]> =>
  Object.fromEntries(SECTION_IDS.map((s) => [s, [] as string[]])) as Record<SectionId, string[]>

export const defaultSettings = (): ProgressSettings => ({
  sfxEnabled: true,
  musicEnabled: true,
  musicDefaultOn: true,
  difficulty: { global: 'normal' },
})

export function defaultPersisted(
  profileId: string | null,
  deviceId: string,
  now: number,
): PersistedProgress {
  return {
    version: SCHEMA_VERSION,
    profileId,
    stickers: { grantedSlots: 0, seenThroughSlot: 0, firstAt: {} },
    ledger: {},
    perGame: {},
    totals: { totalStars: 0 },
    progression: {
      // Everyone STARTS at level 1 (an empty book), so it is already "reached" — celebrating it
      // would fire a bogus ceremony on first load. NEVER 0.
      lastCelebratedLevel: 1,
      explored: emptyExplored(),
      updatedAt: 0,
    },
    settings: defaultSettings(),
    settingsMeta: {},
    sync: {
      rev: 1,
      updatedAt: now,
      epoch: 0,
      syncedRev: 0,
      serverRev: 0,
      originDevice: deviceId,
    },
  }
}

// ----- derivation (the read model 45 files consume) ----------------------------------------------

export function totalXp(p: PersistedProgress): number {
  let n = 0
  for (const d of Object.values(p.ledger)) n += Math.max(0, d.xp)
  return n
}

export function totalSlots(p: PersistedProgress): number {
  let n = 0
  for (const d of Object.values(p.ledger)) n += Math.max(0, d.slots)
  return n
}

export function bloomXpFor(p: PersistedProgress, section: SectionId): number {
  let n = 0
  for (const d of Object.values(p.ledger)) n += Math.max(0, d.bloom?.[section] ?? 0)
  return n
}

/** 0-based handed-over slot → its index on REWARD_PATH, wrapping deterministically past 45. */
export const pathIndexForSlot = (slot: number): number =>
  slot >= REWARD_SLOTS ? (slot - REWARD_SLOTS) % REWARD_SLOTS : slot

/**
 * Rebuild the collected multiset from the slot CURSOR. Path order + the `(slot-45) % 45` gold wrap,
 * exactly as `grantSlot` walks it — that determinism is what lets the ring preview a prize before
 * it's earned, and it means membership never has to be merged.
 */
export function rebuildCollected(
  grantedSlots: number,
  firstAt: Record<string, number>,
  now: number,
): ProgressState['stickers']['collected'] {
  const out: ProgressState['stickers']['collected'] = {}
  const n = Math.max(0, Math.floor(grantedSlots))
  for (let slot = 0; slot < n; slot++) {
    const reward = rewardAt(pathIndexForSlot(slot))
    if (!reward) continue
    const existing = out[reward.id]
    if (existing) existing.count += 1
    else {
      const stamped = firstAt[reward.id]
      out[reward.id] = {
        count: 1,
        // A prefix id missing on both sides of a merge falls back to `now` rather than 1970.
        firstAt: typeof stamped === 'number' && stamped > 0 ? stamped : now,
      }
    }
  }
  return out
}

/**
 * "New since the book was last opened" is always a CONTIGUOUS SUFFIX of the granted prefix — rewards
 * are handed out strictly in path order and gold duplicates are never `isNew` — so an unmergeable
 * array becomes a max-register (§6.2d).
 */
export function deriveNewIds(grantedSlots: number, seenThroughSlot: number): string[] {
  const end = Math.min(REWARD_SLOTS, Math.max(0, Math.floor(grantedSlots)))
  const start = Math.min(end, Math.max(0, Math.floor(seenThroughSlot)))
  const out: string[] = []
  for (let slot = start; slot < end; slot++) {
    const reward = REWARD_PATH[slot]
    if (reward) out.push(reward.id)
  }
  return out
}

export function derive(p: PersistedProgress, now: number): ProgressState {
  const collected = rebuildCollected(p.stickers.grantedSlots, p.stickers.firstAt, now)
  const xp = totalXp(p)
  return {
    version: SCHEMA_VERSION,
    profileId: p.profileId,
    stickers: {
      collected,
      newIds: deriveNewIds(p.stickers.grantedSlots, p.stickers.seenThroughSlot),
    },
    perGame: Object.fromEntries(
      Object.entries(p.perGame).map(([id, s]) => [id, { ...s }]),
    ),
    totals: {
      totalStars: p.totals.totalStars,
      totalStickers: Object.keys(collected).length,
    },
    progression: {
      globalXp: xp,
      lastCelebratedLevel: p.progression.lastCelebratedLevel,
      bloom: Object.fromEntries(
        SECTION_IDS.map((s) => [s, { xp: bloomXpFor(p, s), updatedAt: p.progression.updatedAt }]),
      ) as Record<SectionId, SectionBloom>,
      explored: Object.fromEntries(
        SECTION_IDS.map((s) => [s, [...(p.progression.explored[s] ?? [])]]),
      ) as Record<SectionId, string[]>,
      updatedAt: p.progression.updatedAt,
    },
    settings: {
      ...p.settings,
      difficulty: {
        global: p.settings.difficulty.global,
        ...(p.settings.difficulty.perSection
          ? { perSection: { ...p.settings.difficulty.perSection } }
          : {}),
      },
    },
  }
}

/** The INERT read model: what getSnapshot() returns while the store is detached (see §5.4). */
export function inertState(): ProgressState {
  return derive(defaultPersisted(null, 'inert', 0), 0)
}

// ----- invariants --------------------------------------------------------------------------------

/**
 * The invariant is an INEQUALITY, not an equality (§10.9). `collectedFromLevel(level)` is the debt
 * CEILING; `grantedSlots` legitimately lags it, and that gap IS the pending ceremony. A "fix" that
 * restores equality destroys the ceremony the child is about to see.
 */
export function progressInvariantViolations(p: PersistedProgress): string[] {
  const v: string[] = []
  const slots = totalSlots(p)
  const xp = totalXp(p)
  const ceiling = collectedFromLevel(levelFromXp(xp).level)

  if (p.version !== SCHEMA_VERSION) v.push(`version is ${p.version}, expected ${SCHEMA_VERSION}`)
  // Cheap redundancy that catches a whole bug class: the stored display cursor must agree with the
  // ledger, which is the truth.
  if (p.stickers.grantedSlots !== slots) {
    v.push(`grantedSlots ${p.stickers.grantedSlots} !== Σ ledger.slots ${slots}`)
  }
  if (slots > ceiling) v.push(`granted ${slots} slots but the level only owes ${ceiling}`)
  if (p.stickers.seenThroughSlot > Math.min(REWARD_SLOTS, slots)) {
    v.push(`seenThroughSlot ${p.stickers.seenThroughSlot} exceeds the granted prefix`)
  }
  if (p.progression.lastCelebratedLevel < 1) v.push('lastCelebratedLevel < 1 (would re-celebrate the empty book)')
  for (const [id, d] of Object.entries(p.ledger)) {
    if (d.xp < 0 || d.slots < 0) v.push(`ledger[${id}] has a negative counter`)
    for (const [s, n] of Object.entries(d.bloom ?? {})) {
      if ((n ?? 0) < 0) v.push(`ledger[${id}].bloom.${s} is negative`)
    }
  }
  for (const [id, at] of Object.entries(p.stickers.firstAt)) {
    if (!(at > 0)) v.push(`firstAt[${id}] is not a positive timestamp`)
  }
  return v
}

/** Rewards owed by the level cursor but not yet handed over. Normally 0 or 1. */
export const owedRewards = (p: PersistedProgress): number =>
  Math.max(0, collectedFromLevel(levelFromXp(totalXp(p)).level) - totalSlots(p))

/**
 * The static half of the empty-ceremony guard (§6.3). With NO debt outstanding, the level has already
 * been paid out, so the celebrated cursor must not lag behind it — otherwise being killed right after
 * `grantSlot()` but before `markLevelCelebrated()` fires a CONTENTLESS ceremony on the next boot.
 *
 * It can never suppress a real ceremony: a pending one always HAS debt (grantedSlots < ceiling), so
 * this is a no-op there. Applying it on every read also makes `mergeProgress(a, a) ≡ a` hold for
 * every blob that came off disk.
 */
export function clampCelebratedCursor(p: PersistedProgress): void {
  const level = levelFromXp(totalXp(p)).level
  if (p.stickers.grantedSlots >= collectedFromLevel(level)) {
    p.progression.lastCelebratedLevel = Math.max(p.progression.lastCelebratedLevel, level)
  }
}

// ----- validation of an already-v4 blob ---------------------------------------------------------

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

function normalizeSettings(raw: unknown): ProgressSettings {
  const s = defaultSettings()
  const r = asRecord(raw)
  if (!r) return s
  s.sfxEnabled = r.sfxEnabled !== false
  // Music defaults ON. A blob saved before that flip (no marker) gets it turned on once; a blob that
  // already carries the marker keeps the user's explicit choice.
  s.musicEnabled = r.musicDefaultOn === true ? r.musicEnabled !== false : true
  s.musicDefaultOn = true
  if (typeof r.themeId === 'string' && r.themeId) s.themeId = r.themeId
  const d = asRecord(r.difficulty)
  if (d) {
    s.difficulty.global = isDifficultyLevel(d.global) ? d.global : 'normal'
    const per = asRecord(d.perSection)
    if (per) {
      const out: Partial<Record<SectionId, DifficultyLevel>> = {}
      for (const [k, v] of Object.entries(per)) {
        if ((SECTION_IDS as string[]).includes(k) && isDifficultyLevel(v)) out[k as SectionId] = v
      }
      if (Object.keys(out).length) s.difficulty.perSection = out
    }
  }
  return s
}

function normalizeSettingsMeta(raw: unknown): Record<string, LwwStamp> {
  const out: Record<string, LwwStamp> = {}
  const r = asRecord(raw)
  if (!r) return out
  for (const [k, v] of Object.entries(r)) {
    const s = asRecord(v)
    if (!s) continue
    const at = Number(s.at)
    if (!Number.isFinite(at) || at < 0) continue
    out[k] = { at: Math.floor(at), by: typeof s.by === 'string' ? s.by : 'unknown' }
  }
  return out
}

function normalizeLedger(raw: unknown): Record<string, DeviceCounters> {
  const out: Record<string, DeviceCounters> = {}
  const r = asRecord(raw)
  if (!r) return out
  for (const [device, v] of Object.entries(r)) {
    const d = asRecord(v)
    if (!d) continue
    const bloom: Partial<Record<SectionId, number>> = {}
    const b = asRecord(d.bloom)
    if (b) {
      for (const s of SECTION_IDS) {
        const n = nonNegInt(b[s])
        if (n > 0) bloom[s] = n
      }
    }
    out[device] = { xp: nonNegInt(d.xp), slots: nonNegInt(d.slots), bloom }
  }
  return out
}

/**
 * Validate an ALREADY-v4 blob. Returns `null` when the input is not v4 at all — the caller then
 * decides (defaults for a profile key, "nothing to adopt" for the legacy key).
 */
export function normalizePersisted(raw: unknown): PersistedProgress | null {
  const r = asRecord(raw)
  if (!r || r.version !== SCHEMA_VERSION) return null

  const ledger = normalizeLedger(r.ledger)
  const base = defaultPersisted(
    typeof r.profileId === 'string' ? r.profileId : null,
    typeof asRecord(r.sync)?.originDevice === 'string'
      ? (asRecord(r.sync)!.originDevice as string)
      : 'unknown',
    nonNegInt(asRecord(r.sync)?.updatedAt),
  )
  base.ledger = ledger

  const st = asRecord(r.stickers)
  if (st) {
    const firstAt: Record<string, number> = {}
    const fa = asRecord(st.firstAt)
    if (fa) {
      for (const [id, at] of Object.entries(fa)) {
        // Prune ids that are no longer on the path (a later data edit). Because the CURSOR is what's
        // stored, dropping a stale stamp can never manufacture debt the way v3's pruning did (§10.11).
        if (!ON_PATH.has(id)) continue
        const n = Number(at)
        if (Number.isFinite(n) && n > 0) firstAt[id] = Math.floor(n)
      }
    }
    base.stickers = {
      grantedSlots: nonNegInt(st.grantedSlots),
      seenThroughSlot: nonNegInt(st.seenThroughSlot),
      firstAt,
    }
  }
  // Repair: the ledger is the truth, the cursor is the display copy.
  const slots = totalSlots(base)
  if (base.stickers.grantedSlots !== slots) base.stickers.grantedSlots = slots
  base.stickers.seenThroughSlot = Math.min(
    base.stickers.seenThroughSlot,
    Math.min(REWARD_SLOTS, base.stickers.grantedSlots),
  )

  const pg = asRecord(r.perGame)
  if (pg) {
    for (const [id, v] of Object.entries(pg)) {
      const s = asRecord(v)
      if (!s) continue
      base.perGame[id] = {
        bestStreak: nonNegInt(s.bestStreak),
        bestStars: nonNegInt(s.bestStars),
        bestCount: nonNegInt(s.bestCount),
        roundsCompleted: nonNegInt(s.roundsCompleted),
        lifetimeCorrect: nonNegInt(s.lifetimeCorrect),
      }
    }
  }

  base.totals.totalStars = nonNegInt(asRecord(r.totals)?.totalStars)

  const prog = asRecord(r.progression)
  if (prog) {
    base.progression.lastCelebratedLevel = Math.max(1, nonNegInt(prog.lastCelebratedLevel))
    base.progression.updatedAt = nonNegInt(prog.updatedAt)
    const ex = asRecord(prog.explored)
    if (ex) {
      for (const s of SECTION_IDS) {
        const list = ex[s]
        if (Array.isArray(list)) {
          base.progression.explored[s] = Array.from(
            new Set(list.filter((k): k is string => typeof k === 'string')),
          )
        }
      }
    }
  }

  base.settings = normalizeSettings(r.settings)
  base.settingsMeta = normalizeSettingsMeta(r.settingsMeta)

  const sync = asRecord(r.sync)
  if (sync) {
    base.sync = {
      rev: Math.max(1, nonNegInt(sync.rev)),
      updatedAt: nonNegInt(sync.updatedAt),
      epoch: nonNegInt(sync.epoch),
      syncedRev: nonNegInt(sync.syncedRev),
      serverRev: nonNegInt(sync.serverRev),
      originDevice: typeof sync.originDevice === 'string' ? sync.originDevice : 'unknown',
    }
  }
  clampCelebratedCursor(base)
  return base
}

// ----- the v3 → v4 migration (§5.3) -------------------------------------------------------------

/** The v3 read model, described loosely because we're reading untrusted stored JSON. */
interface V3Blob {
  version?: unknown
  stickers?: { collected?: Record<string, { count?: unknown; firstAt?: unknown }>; newIds?: unknown }
  perGame?: Record<string, unknown>
  totals?: { totalStars?: unknown }
  progression?: {
    globalXp?: unknown
    lastCelebratedLevel?: unknown
    bloom?: Record<string, { xp?: unknown }>
    explored?: Record<string, unknown>
    updatedAt?: unknown
  }
  settings?: unknown
}

export interface MigrateContext {
  deviceId: string
  now: number
  /** `bornelaering-theme` — carried into settings.themeId so the skin survives the migration. */
  themeIdHint?: string
  /** Ledger entry to attribute the migrated counters to. Legacy adoption passes LEGACY_DEVICE_ID. */
  ledgerKey?: string
}

/**
 * v3 → v4. A PURE STRUCTURAL upgrade — unlike v1→v2 and v2→v3, whose random sticker pools genuinely
 * could not be mapped onto a deterministic path. Bumping SCHEMA_VERSION without this branch is what
 * would delete the son's 45-reward book (§5.3), which is why the store's old unconditional
 * `if (r.version !== SCHEMA_VERSION) return base` must be replaced by a version-directed chain.
 */
export function migrateToV4(raw: unknown, ctx: MigrateContext): PersistedProgress | null {
  const r = asRecord(raw) as V3Blob | null
  if (!r || r.version !== 3) return null

  const key = ctx.ledgerKey ?? ctx.deviceId
  const out = defaultPersisted(null, ctx.deviceId, ctx.now)

  const xp = nonNegInt(r.progression?.globalXp)

  // The multiset cursor: Σ counts IS the number of slots handed over, gold duplicates included.
  let slots = 0
  const collected = asRecord(r.stickers?.collected) ?? {}
  for (const [id, v] of Object.entries(collected)) {
    const c = asRecord(v)
    if (!c) continue
    const count = Math.max(1, Math.floor(Number(c.count) || 1))
    slots += count
    if (ON_PATH.has(id)) {
      const at = Number(c.firstAt)
      out.stickers.firstAt[id] = Number.isFinite(at) && at > 0 ? Math.floor(at) : ctx.now
    }
  }
  // Repair clamp: a v3 blob whose counts exceed what its XP can justify (only reachable through a
  // hand-edit or an old bug) is trimmed rather than carried forward as an invariant violation.
  slots = Math.min(slots, collectedFromLevel(levelFromXp(xp).level))

  const bloom: Partial<Record<SectionId, number>> = {}
  const rawBloom = asRecord(r.progression?.bloom)
  if (rawBloom) {
    for (const s of SECTION_IDS) {
      const n = nonNegInt(asRecord(rawBloom[s])?.xp)
      if (n > 0) bloom[s] = n
    }
  }

  out.ledger = { [key]: { xp, slots, bloom } }
  out.stickers.grantedSlots = slots

  // Preserve pending "nyt!" badges: the lowest slot still flagged new becomes the seen cursor.
  const newIds = Array.isArray(r.stickers?.newIds)
    ? (r.stickers.newIds as unknown[]).filter((v): v is string => typeof v === 'string')
    : []
  const newSlots = newIds.map((id) => slotOfReward(id)).filter((s) => s >= 0)
  out.stickers.seenThroughSlot = newSlots.length
    ? Math.max(0, Math.min(...newSlots))
    : Math.min(REWARD_SLOTS, slots)
  out.stickers.seenThroughSlot = Math.min(
    out.stickers.seenThroughSlot,
    Math.min(REWARD_SLOTS, slots),
  )

  out.progression.lastCelebratedLevel = Math.max(1, nonNegInt(r.progression?.lastCelebratedLevel ?? 1))
  out.progression.updatedAt = nonNegInt(r.progression?.updatedAt)
  const ex = asRecord(r.progression?.explored)
  if (ex) {
    for (const s of SECTION_IDS) {
      const list = ex[s]
      if (Array.isArray(list)) {
        out.progression.explored[s] = Array.from(
          new Set(list.filter((k): k is string => typeof k === 'string')),
        )
      }
    }
  }

  const pg = asRecord(r.perGame)
  if (pg) {
    for (const [id, v] of Object.entries(pg)) {
      const s = asRecord(v)
      if (!s) continue
      out.perGame[id] = { ...emptyGameStats() }
      for (const f of Object.keys(emptyGameStats()) as (keyof PerGameStats)[]) {
        out.perGame[id][f] = nonNegInt(s[f])
      }
    }
  }
  out.totals.totalStars = nonNegInt(r.totals?.totalStars)

  out.settings = normalizeSettings(r.settings)
  if (!out.settings.themeId && ctx.themeIdHint) out.settings.themeId = ctx.themeIdHint

  // Stamp every carried setting so an ADOPTED legacy preference beats an untouched fresh profile
  // (whose defaults are stamped at 0) but loses to any later explicit change on another device.
  const stampAt = out.progression.updatedAt || 1
  const stamp = (path: string) => {
    out.settingsMeta[path] = { at: stampAt, by: 'legacy' }
  }
  stamp('sfxEnabled')
  stamp('musicEnabled')
  stamp('difficulty.global')
  if (out.settings.themeId) stamp('themeId')
  for (const s of Object.keys(out.settings.difficulty.perSection ?? {})) {
    stamp(`difficulty.perSection.${s}`)
  }

  out.sync = {
    rev: 1,
    updatedAt: ctx.now,
    epoch: 0,
    syncedRev: 0,
    serverRev: 0,
    originDevice: ctx.deviceId,
  }
  clampCelebratedCursor(out)
  return out
}

/**
 * The version-directed chain that replaces v3's unconditional hard reset.
 * `null` ⇒ nothing usable; the CALLER decides what that means.
 */
export function readPersisted(raw: unknown, ctx: MigrateContext): PersistedProgress | null {
  return normalizePersisted(raw) ?? migrateToV4(raw, ctx)
}
