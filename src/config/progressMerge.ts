// The merge. ONE implementation, shared by the client (cross-tab, sync, legacy adoption) and the
// Vercel function (api/progress.ts imports this exact file), which is why it must stay free of
// `Date.now()`, `crypto` and `localStorage` — everything time-shaped arrives in `MergeContext`.
//
// WHY IT IS A CRDT JOIN, AND WHY THAT MATTERS MORE THAN PRECISION (accounts PRD §6.2):
//
//  (a) Membership is re-derived from SLOTS HANDED OVER, never from the level.
//      `collectedFromLevel(level)` is the debt CEILING, not the balance; `grantedSlots` legitimately
//      lags it and that gap IS the pending ceremony. Deriving from the level would pre-grant the owed
//      reward (the child never sees the ceremony), flatten every `count` to 1 (destroying the
//      gold-pass cursor, so a level-60 player's next gold reward resets to slot 1), and manufacture a
//      phantom fistful of golds for anyone past 45.
//
//  (b) `max()` on XP doesn't just under-count, it LOSES A REWARD ALREADY HANDED OVER. Two iPads
//      offline with 200 XP each: max = 200 → 5 slots allowed, but each device granted 5, so one
//      device's view silently erases 5 rewards the other child physically celebrated. Hence a
//      per-device G-Counter ledger: increment your own entry, merge per-device with `max`, total with
//      `Σ`. 200+200 = 400 XP → 10 slots allowed and Σ slots = 10. Exactly consistent.
//
//  (c) `resetAll()` cannot be expressed in a join-only merge — under any monotone rule the next pull
//      resurrects every sticker. Hence `sync.epoch`: differing epochs mean the HIGHER one wins
//      WHOLESALE, with no join at all, because a reset is a declared fresh start.
//
//  (d) `newIds` as a set would resurrect dismissed "nyt!" badges. Rewards are handed out strictly in
//      path order and never repeat, so "new" is always a contiguous suffix of the granted prefix:
//      store `seenThroughSlot` and merge it with `max`.
//
// The payoff of the whole thing being `idempotent ∧ commutative ∧ associative` is that
// `applyRemote()` can be applied AT ANY INSTANT — mid-round, mid-ceremony — with no lock and no
// queue. That property is worth more than the arithmetic.

import { collectedFromLevel, levelFromXp } from './progression.ts'
import { REWARD_SLOTS } from './stickers.ts'
import {
  SECTION_IDS,
  emptyGameStats,
  totalSlots,
  totalXp,
  type DeviceCounters,
  type DifficultyLevel,
  type LwwStamp,
  type PerGameStats,
  type PersistedProgress,
  type ProgressSettings,
  type SectionId,
} from './progressSchema.ts'

export interface MergeContext {
  now: number
  deviceId: string
}

export interface MergeReport {
  epochWinner: 'local' | 'remote' | 'equal'
  xpBefore: number
  xpAfter: number
  slotsBefore: number
  slotsAfter: number
  /** The repair clamp fired ⇒ one side was corrupt. Provably inert on valid input (see below). */
  clampedSlots: boolean
  changedSettings: string[]
  /** false ⇒ nothing new arrived; skip the write-back (this is what stops a cross-tab ping-pong). */
  changed: boolean
}

// ----- settings field paths (LWW registers) -----------------------------------------------------

const NO_STAMP: LwwStamp = { at: 0, by: '' }

const stampFor = (p: PersistedProgress, path: string): LwwStamp => p.settingsMeta[path] ?? NO_STAMP

/**
 * Which side owns a field. Newer `at` wins; on a tie the larger `by` (deviceId) wins so two
 * clock-synced devices converge on the SAME answer whichever order they merge in. When the stamps are
 * completely equal we fall back to a deterministic total order on the VALUE itself — without that,
 * two unstamped defaults holding different values would make the merge non-commutative.
 */
function pickSide<T>(
  local: T,
  remote: T,
  ls: LwwStamp,
  rs: LwwStamp,
): { value: T; fromRemote: boolean } {
  if (rs.at > ls.at) return { value: remote, fromRemote: true }
  if (ls.at > rs.at) return { value: local, fromRemote: false }
  if (rs.by > ls.by) return { value: remote, fromRemote: true }
  if (ls.by > rs.by) return { value: local, fromRemote: false }
  const lj = JSON.stringify(local ?? null)
  const rj = JSON.stringify(remote ?? null)
  if (lj === rj) return { value: local, fromRemote: false }
  return rj > lj ? { value: remote, fromRemote: true } : { value: local, fromRemote: false }
}

type SettingsPath =
  | 'sfxEnabled'
  | 'musicEnabled'
  | 'themeId'
  | 'difficulty.global'
  | `difficulty.perSection.${SectionId}`

function readSetting(s: ProgressSettings, path: SettingsPath): unknown {
  switch (path) {
    case 'sfxEnabled':
      return s.sfxEnabled
    case 'musicEnabled':
      return s.musicEnabled
    case 'themeId':
      return s.themeId
    case 'difficulty.global':
      return s.difficulty.global
    default: {
      const section = path.slice('difficulty.perSection.'.length) as SectionId
      return s.difficulty.perSection?.[section]
    }
  }
}

function writeSetting(s: ProgressSettings, path: SettingsPath, value: unknown): void {
  switch (path) {
    case 'sfxEnabled':
      s.sfxEnabled = value !== false
      return
    case 'musicEnabled':
      s.musicEnabled = value !== false
      return
    case 'themeId':
      if (typeof value === 'string' && value) s.themeId = value
      else delete s.themeId
      return
    case 'difficulty.global':
      s.difficulty.global = (value as DifficultyLevel) ?? 'normal'
      return
    default: {
      const section = path.slice('difficulty.perSection.'.length) as SectionId
      const per = { ...(s.difficulty.perSection ?? {}) }
      // ABSENCE IS A VALUE here: an override that was cleared on the newer device must clear here.
      if (value == null) delete per[section]
      else per[section] = value as DifficultyLevel
      s.difficulty.perSection = Object.keys(per).length ? per : undefined
      return
    }
  }
}

function settingsPaths(local: PersistedProgress, remote: PersistedProgress): SettingsPath[] {
  const sections = new Set<string>([
    ...Object.keys(local.settings.difficulty.perSection ?? {}),
    ...Object.keys(remote.settings.difficulty.perSection ?? {}),
    // Any per-section path that has a stamp but no current value (a cleared override) still has to
    // take part, or the clearing itself can never propagate.
    ...Object.keys(local.settingsMeta)
      .concat(Object.keys(remote.settingsMeta))
      .filter((k) => k.startsWith('difficulty.perSection.'))
      .map((k) => k.slice('difficulty.perSection.'.length)),
  ])
  const base: SettingsPath[] = ['sfxEnabled', 'musicEnabled', 'themeId', 'difficulty.global']
  for (const s of SECTION_IDS) {
    if (sections.has(s)) base.push(`difficulty.perSection.${s}` as SettingsPath)
  }
  return base
}

// ----- content fingerprint (used for `changed` and by the tests for the algebraic laws) ----------

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null) ?? 'null'
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`).join(',')}}`
}

/**
 * Everything that is real STATE, excluding the per-device sync bookkeeping (`rev`, `syncedRev`,
 * `serverRev`, `originDevice`, `updatedAt`) which is intentionally NOT part of the merge algebra —
 * it describes this device's relationship with the server, not the child's progress.
 */
export function contentFingerprint(p: PersistedProgress): string {
  return stableStringify({
    stickers: p.stickers,
    ledger: p.ledger,
    perGame: p.perGame,
    totals: p.totals,
    progression: p.progression,
    settings: p.settings,
    settingsMeta: p.settingsMeta,
    epoch: p.sync.epoch,
  })
}

// ----- the join ---------------------------------------------------------------------------------

const clone = <T>(v: T): T => structuredClone(v)

function mergeLedger(
  a: Record<string, DeviceCounters>,
  b: Record<string, DeviceCounters>,
): Record<string, DeviceCounters> {
  const out: Record<string, DeviceCounters> = {}
  for (const device of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const la = a[device]
    const lb = b[device]
    const bloom: Partial<Record<SectionId, number>> = {}
    for (const s of SECTION_IDS) {
      const n = Math.max(la?.bloom?.[s] ?? 0, lb?.bloom?.[s] ?? 0)
      if (n > 0) bloom[s] = n
    }
    out[device] = {
      xp: Math.max(la?.xp ?? 0, lb?.xp ?? 0),
      slots: Math.max(la?.slots ?? 0, lb?.slots ?? 0),
      bloom,
    }
  }
  return out
}

function mergePerGame(
  a: Record<string, PerGameStats>,
  b: Record<string, PerGameStats>,
): Record<string, PerGameStats> {
  const out: Record<string, PerGameStats> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id] ?? emptyGameStats()
    const y = b[id] ?? emptyGameStats()
    out[id] = {
      bestStreak: Math.max(x.bestStreak, y.bestStreak),
      bestStars: Math.max(x.bestStars, y.bestStars),
      bestCount: Math.max(x.bestCount, y.bestCount),
      // NB these two are COUNTERS, not bests. `max` under-counts slightly under concurrency; `sum`
      // would be catastrophic — the merge runs on every sync, so summing is non-idempotent and the
      // numbers explode. Promoting them to the ledger is Phase B.
      roundsCompleted: Math.max(x.roundsCompleted, y.roundsCompleted),
      lifetimeCorrect: Math.max(x.lifetimeCorrect, y.lifetimeCorrect),
    }
  }
  return out
}

export function mergeProgress(
  local: PersistedProgress,
  remote: PersistedProgress,
  ctx: MergeContext,
): { merged: PersistedProgress; report: MergeReport } {
  const xpBefore = totalXp(local)
  const slotsBefore = totalSlots(local)
  const localFingerprint = contentFingerprint(local)

  const finish = (
    merged: PersistedProgress,
    partial: Omit<MergeReport, 'changed' | 'xpBefore' | 'xpAfter' | 'slotsBefore' | 'slotsAfter'>,
  ): { merged: PersistedProgress; report: MergeReport } => {
    const changed = contentFingerprint(merged) !== localFingerprint
    merged.sync = {
      // Local bookkeeping is preserved: `syncedRev` tracks OUR rev numbering, and progressSync owns
      // `serverRev`. Bumping rev only when something changed is also what makes merge(a,a) ≡ a.
      ...local.sync,
      epoch: merged.sync.epoch,
      originDevice: local.sync.originDevice || ctx.deviceId,
      rev: changed ? Math.max(local.sync.rev, remote.sync.rev) + 1 : local.sync.rev,
      updatedAt: changed
        ? Math.max(local.sync.updatedAt, remote.sync.updatedAt, ctx.now)
        : local.sync.updatedAt,
    }
    return {
      merged,
      report: {
        ...partial,
        changed,
        xpBefore,
        xpAfter: totalXp(merged),
        slotsBefore,
        slotsAfter: totalSlots(merged),
      },
    }
  }

  // (c) The epoch GATE: a reset is a declared fresh start, so the higher epoch wins wholesale.
  if (local.sync.epoch !== remote.sync.epoch) {
    const remoteWins = remote.sync.epoch > local.sync.epoch
    const winner = clone(remoteWins ? remote : local)
    winner.profileId = local.profileId ?? remote.profileId
    return finish(winner, {
      epochWinner: remoteWins ? 'remote' : 'local',
      clampedSlots: false,
      changedSettings: remoteWins ? ['*epoch-reset*'] : [],
    })
  }

  const merged = clone(local)
  merged.version = local.version
  merged.profileId = local.profileId ?? remote.profileId

  // (b) G-Counter ledger.
  merged.ledger = mergeLedger(local.ledger, remote.ledger)

  const mergedXp = totalXp(merged)
  const mergedSlots = totalSlots(merged)
  const level = levelFromXp(mergedXp).level
  const ceiling = collectedFromLevel(level)

  // (a) The cursor is Σ slots, bounded by BOTH the level ceiling and the END OF THE BOOK.
  //
  // The level half is NOT merely repair. It was documented as "provably inert on valid input", with a
  // proof over `max_i slots_i` — but the cursor is `Σ slots_i`, and the curve is CONVEX (a slot costs
  // REWARD_XP inside the fast tier, 3× after), so Σ xpForSlots(n_i) < xpForSlots(Σ n_i). Two perfectly
  // valid devices that each played offline can therefore sum to more slots than their summed XP
  // justifies, and this clamp fires on good data. The old 18/×2 curve did it at 15 + 15 slots; the
  // 9/×3 curve does it at 5 + 5 (Reward Pacing PRD-01 moved the threshold down, it did not create it).
  // Pinned by the CONVEXITY case in progressMerge.test.ts. Keeping the clamp is what keeps
  // `grantedSlots ≤ collectedFromLevel(globalLevel())` — the inequality the read model rests on — true.
  //
  // The REWARD_SLOTS half is a REAL bound and reachable (Reward Horizon PRD-01 §3.5): each device
  // clamps its own grants at the cap, but the ledger is a G-Counter, so two devices that each filled
  // the book offline sum to 2×REWARD_SLOTS. The gold pass used to absorb that by wrapping; without it
  // the cursor has to be capped here, or `rewardNumber()` would out-run the 72 pictures in the book.
  const cap = Math.min(ceiling, REWARD_SLOTS)
  const clampedSlots = mergedSlots > cap
  merged.stickers.grantedSlots = Math.min(cap, mergedSlots)
  if (clampedSlots) {
    // Keep the invariant `grantedSlots === Σ ledger.slots` true by trimming the ledger too, largest
    // contributor first, so the repair is deterministic.
    let excess = mergedSlots - cap
    for (const device of Object.keys(merged.ledger).sort((a, b) =>
      merged.ledger[b].slots - merged.ledger[a].slots || (a < b ? -1 : 1),
    )) {
      if (excess <= 0) break
      const take = Math.min(excess, merged.ledger[device].slots)
      merged.ledger[device].slots -= take
      excess -= take
    }
  }

  // firstAt: min-register over POSITIVE values only (a plain Math.min against 0 would show 1970),
  // union of keys.
  const firstAt: Record<string, number> = {}
  for (const [id, at] of Object.entries(local.stickers.firstAt)) {
    if (at > 0) firstAt[id] = at
  }
  for (const [id, at] of Object.entries(remote.stickers.firstAt)) {
    if (!(at > 0)) continue
    firstAt[id] = firstAt[id] ? Math.min(firstAt[id], at) : at
  }
  merged.stickers.firstAt = firstAt

  // (d) seenThroughSlot: max-register, clamped to the granted prefix so a stale-but-higher value
  // from a device that had more rewards can't hide fresh "nyt!" badges.
  merged.stickers.seenThroughSlot = Math.min(
    Math.max(local.stickers.seenThroughSlot, remote.stickers.seenThroughSlot),
    Math.min(REWARD_SLOTS, merged.stickers.grantedSlots),
  )

  merged.perGame = mergePerGame(local.perGame, remote.perGame)
  merged.totals = { totalStars: Math.max(local.totals.totalStars, remote.totals.totalStars) }

  merged.progression.lastCelebratedLevel = Math.max(
    local.progression.lastCelebratedLevel,
    remote.progression.lastCelebratedLevel,
  )
  merged.progression.updatedAt = Math.max(
    local.progression.updatedAt,
    remote.progression.updatedAt,
  )
  // Grow-only set: markBrowsed never removes, so a union is exactly right.
  for (const s of SECTION_IDS) {
    merged.progression.explored[s] = Array.from(
      new Set([...(local.progression.explored[s] ?? []), ...(remote.progression.explored[s] ?? [])]),
    ).sort()
  }

  // THE EMPTY-CEREMONY GUARD (§6.3 guard 1). A level whose reward was already handed over on another
  // device has already been celebrated THERE, so advancing the cursor here prevents confetti about
  // nothing. It cannot suppress a real ceremony: a pending one always has debt
  // (grantedSlots < ceiling), so this branch is not taken.
  if (merged.stickers.grantedSlots >= ceiling) {
    merged.progression.lastCelebratedLevel = Math.max(
      merged.progression.lastCelebratedLevel,
      level,
    )
  }

  // settings: LWW per FIELD PATH.
  const changedSettings: string[] = []
  merged.settings = clone(local.settings)
  merged.settingsMeta = { ...local.settingsMeta }
  for (const path of settingsPaths(local, remote)) {
    const lv = readSetting(local.settings, path)
    const rv = readSetting(remote.settings, path)
    const ls = stampFor(local, path)
    const rs = stampFor(remote, path)
    const { value, fromRemote } = pickSide(lv, rv, ls, rs)
    if (fromRemote) {
      writeSetting(merged.settings, path, value)
      merged.settingsMeta[path] = rs === NO_STAMP ? { at: 0, by: '' } : { ...rs }
    }
    if (stableStringify(readSetting(merged.settings, path)) !== stableStringify(lv)) {
      changedSettings.push(path)
    }
  }
  // Keep the newer stamp for every path either side knows about, so a later merge can't flip a
  // decision back on stale metadata.
  for (const [path, stamp] of Object.entries(remote.settingsMeta)) {
    const cur = merged.settingsMeta[path]
    if (!cur || stamp.at > cur.at || (stamp.at === cur.at && stamp.by > cur.by)) {
      merged.settingsMeta[path] = { ...stamp }
    }
  }
  // musicDefaultOn is an OR, not an LWW register: it is a MIGRATION MARKER, not a preference. Under
  // LWW an old blob's `false` would re-flip music on for a profile that had deliberately muted it.
  merged.settings.musicDefaultOn =
    local.settings.musicDefaultOn === true || remote.settings.musicDefaultOn === true

  merged.sync = { ...local.sync, epoch: Math.max(local.sync.epoch, remote.sync.epoch) }

  return finish(merged, { epochWinner: 'equal', clampedSlots, changedSettings })
}
