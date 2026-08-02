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

import { REWARD_PATH, REWARD_SLOTS, allRewards, rewardAt } from './stickers.ts'
import { collectedFromLevel, levelFromXp } from './progression.ts'

export const SCHEMA_VERSION = 4 as const

// ----- Storage keys (accounts PRD §5.8) ---------------------------------------------------------
export const DEVICE_ID_KEY = 'bornelaering-device-id'
export const ACCOUNT_KEY = 'bornelaering-account'
export const ACTIVE_PROFILE_KEY = 'bornelaering-active-profile'
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
    /** The path cursor: how many slots have been handed over. Never exceeds REWARD_SLOTS. */
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

/**
 * Rebuild the collected SET from the slot CURSOR: a straight walk of REWARD_PATH's prefix, exactly as
 * `grantSlot` walks it — that determinism is what lets the ring preview a prize before it's earned,
 * and it means membership never has to be merged.
 *
 * There is no `pathIndexForSlot` any more (Reward Horizon PRD-01 §3.5). It wrapped `(slot-45) % 45`
 * into gold duplicates and `count` counted them; both are gone, so a slot past the end of the path is
 * simply skipped and `count` is permanently 1. A cross-device G-Counter can still push `grantedSlots`
 * past the cap in principle, hence the `if (!reward) break` rather than a bare index.
 */
export function rebuildCollected(
  grantedSlots: number,
  firstAt: Record<string, number>,
  now: number,
): ProgressState['stickers']['collected'] {
  const out: ProgressState['stickers']['collected'] = {}
  const n = Math.max(0, Math.floor(grantedSlots))
  for (let slot = 0; slot < n; slot++) {
    const reward = rewardAt(slot)
    if (!reward) break
    const stamped = firstAt[reward.id]
    out[reward.id] = {
      count: 1,
      // A prefix id missing on both sides of a merge falls back to `now` rather than 1970.
      firstAt: typeof stamped === 'number' && stamped > 0 ? stamped : now,
    }
  }
  return out
}

/**
 * "New since the book was last opened" is always a CONTIGUOUS SUFFIX of the granted prefix — rewards
 * are handed out strictly in path order and never repeat — so an unmergeable array becomes a
 * max-register (§6.2d).
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
  // The book has a real ending now (no gold pass), so the cursor can never run past the last chapter.
  if (slots > REWARD_SLOTS) v.push(`granted ${slots} slots but the book only has ${REWARD_SLOTS}`)
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

/**
 * Rewards owed by the level cursor but not yet handed over. Normally 0 or 1.
 *
 * **Clamped at the end of the book** (Reward Horizon PRD-01 §3.5 — this is the one piece of real new
 * logic in deleting the gold pass). The XP ledger is a G-Counter that keeps climbing across devices
 * forever, and the wrap used to guarantee every owed slot resolved to *some* reward. Without the clamp
 * a full book would hand `grantSlot` a cursor past REWARD_PATH and `rewardAt()` would return null.
 */
export const owedRewards = (p: PersistedProgress): number => {
  const granted = totalSlots(p)
  const owed = collectedFromLevel(levelFromXp(totalXp(p)).level) - granted
  return Math.max(0, Math.min(owed, REWARD_SLOTS - granted))
}

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
