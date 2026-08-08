// Persistent PER-CHILD progress.
//
// SHAPE OF THE CHANGE (accounts PRD §5.1): the persisted source of truth is now a tiny composition of
// CRDTs (src/config/progressSchema.ts) that can be merged across devices, while the IN-MEMORY READ
// MODEL stays byte-identical to what 45 files already consume. `derive()` recomputes
// `stickers.collected`, `stickers.newIds`, `totals.totalStickers`, `progression.globalXp` and
// `progression.bloom` from the canonical form — so those become DERIVED, not merged, and the store
// invariants hold BY CONSTRUCTION. The acceptance test for the design was that StickerAlbum.tsx needs
// zero changes; it does.
//
// INERT BY DEFAULT (§5.4). This module hydrates at IMPORT time, long before React, the router or the
// auth gate — so it cannot know which child it belongs to yet. Any attempt to "just hydrate the right
// profile" here would need to read account state synchronously at import, and a sign-out in another tab
// would leave a hydrated ghost. So the store starts INERT and `profileStore` calls `attach(profileId)`.
// A write while detached is refused (loudly in DEV), which means a hydration bug can never destroy data.
//
// All storage access is try/catch-wrapped and degrades to in-memory-only on private-mode/quota errors
// (the game still works, it just doesn't persist).

// Explicit `.ts` extensions: src/services/progressStore.test.ts imports this module in plain Node
// (which won't resolve extensionless relative specifiers). Vite/tsc accept them
// (allowImportingTsExtensions), and it keeps this file testable outside a browser.
import {
  REWARD_SLOTS,
  allRewards,
  chapterForRewardId,
  chapterAt,
  rewardAt,
  totalRewardCount,
  type Reward,
  type RewardChapter,
} from '../config/stickers.ts'
import {
  levelFromXp,
  bloomStage,
  bloomFill,
  taskXp,
  BROWSE_TASK_XP,
  CHAPTER_SIZE,
  chapterOfSlot,
  companionStageForCollected,
  rewardNumber,
} from '../config/progression.ts'
import {
  ACCOUNT_KEY,
  ACTIVE_PROFILE_KEY,
  SCHEMA_VERSION,
  SECTION_IDS,
  clampCelebratedCursor,
  defaultPersisted,
  derive,
  emptyDeviceCounters,
  inertState,
  normalizePersisted,
  owedRewards as owedFromDoc,
  progressInvariantViolations,
  progressKeyFor,
  rebuildCollected,
  totalSlots,
  totalXp,
  bloomXpFor,
  type PersistedProgress,
  type SyncMeta,
} from '../config/progressSchema.ts'
import { mergeProgress, type MergeReport } from '../config/progressMerge.ts'
import { getDeviceId } from './deviceId.ts'
import { practiceLedger } from './practiceLedger.ts'

// Re-exported so all 45 consumers keep importing their types from here, unchanged.
export type {
  DifficultyLevel,
  DifficultySetting,
  PersistedProgress,
  ProgressSettings,
  ProgressState,
  ProgressionState,
  SectionBloom,
  SectionId,
  SyncMeta,
} from '../config/progressSchema.ts'
export type { MergeReport } from '../config/progressMerge.ts'

import type {
  ProgressSettings,
  ProgressState,
  SectionId,
  DifficultyLevel,
} from '../config/progressSchema.ts'

export interface XpGrantResult {
  granted: number
  section: SectionId
  global: {
    xpBefore: number
    xpAfter: number
    levelBefore: number
    levelAfter: number
    leveledUp: boolean
    xpIntoLevel: number
    xpToNextLevel: number
    xpForThisLevel: number
  }
  bloom: {
    xpBefore: number
    xpAfter: number
    stageBefore: number
    stageAfter: number
    stageAdvanced: boolean
    fillBefore: number
    fillAfter: number
  }
}

// One reward handed over by a ceremony. Deterministic: `slot` came straight off the path, never a
// random pick — the ring had been showing this exact object while it filled.
//
// There is no `gold` / `count` any more (Reward Horizon PRD-01 §3.5): the path never wraps, so a
// reward is handed over AT MOST ONCE and `isNew` is always true. The pair is kept as a field only
// because a ceremony still wants to know whether this was the book's first sighting of that slot.
export interface RewardGrant {
  reward: Reward
  slot: number // 0-based index into REWARD_PATH
  chapter: RewardChapter
  chapterIndex: number // 0-based
  slotInChapter: number // 0..8 (drives the ceremony's 3x3 chapter grid)
  chapterCompleted: boolean // this grant filled the last empty slot of its chapter
  bookCompleted: boolean // this grant filled the LAST slot of the last chapter, for the first time
  isNew: boolean // first time ever collected
}

// (`RoundResultInput` / `RoundResultOptions` / `RoundOutcome` / `recordRoundResult` are DELETED —
// Endless Play PRD-01 W3. Stars, star thresholds, personal bests and the round-end bonus XP went with
// the round that produced them; nothing records them any more. The surviving grant points are
// `grantTaskXp` (play), `grantXp` (the `?rewards=n` dev seed) and `grantPendingRewards` (the ceremony,
// the ONLY place a reward is handed over).)

// ONE frozen module constant for the detached read model. `getSnapshot()` MUST return a STABLE
// reference or `useSyncExternalStore` re-renders forever (§10.1) — returning a fresh defaultState()
// per call is an infinite loop, not a subtle inefficiency.
const INERT_STATE: ProgressState = Object.freeze(inertState()) as ProgressState

const ON_PATH = new Set(allRewards().map((r) => r.id))

type Listener = () => void
type CommitListener = (meta: SyncMeta) => void

const nowMs = (): number => Date.now()

class ProgressStore {
  private persisted: PersistedProgress | null = null
  private state: ProgressState = INERT_STATE
  private key: string | null = null
  private currentProfileId: string | null = null

  private listeners = new Set<Listener>()
  private commitListeners = new Set<CommitListener>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  // The payload is bound to its KEY at schedule time. See scheduleSave().
  private pending: { key: string; json: string } | null = null

  private attachWaiters: Array<(id: string) => void> = []

  constructor() {
    // NO hydration here — see the header. Lifecycle hooks are still installed at import so a
    // pagehide during the very first session can't lose a write.
    this.installLifecycleHooks()
  }

  // ----- lifecycle -------------------------------------------------------------------------------

  // Reliability + multi-tab (PRD-08 §P2 + accounts §5.7):
  //  • Flush the debounced write synchronously when the tab is backgrounded/closed, so earning a
  //    reward and immediately swiping the PWA away (within the 250ms debounce) can't lose it.
  //  • React to a `storage` event from another tab — see onStorage() for why this is a MERGE now.
  private installLifecycleHooks(): void {
    if (typeof window === 'undefined') return
    const flush = () => this.flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush()
    })
    window.addEventListener('storage', (e) => this.onStorage(e))
  }

  /**
   * Point the store at a child. IDEMPOTENT — StrictMode double-invokes effects, and a re-hydrate would
   * discard state committed between the two invocations.
   *
   * Attaching is a PURE READ: no reset, no write. A hydration bug therefore cannot destroy data.
   */
  attach(profileId: string): void {
    if (!profileId) return
    if (profileId === this.currentProfileId) return

    // Land any in-flight debounce under the OLD key before switching.
    this.flush()

    this.currentProfileId = profileId
    this.key = progressKeyFor(profileId)
    const deviceId = getDeviceId()
    const now = nowMs()

    let doc: PersistedProgress | null = null
    try {
      const raw = localStorage.getItem(this.key)
      // No migration path by design (owner: clean sheet). A non-v4 blob normalises to null and the
      // child simply starts fresh; utils/storageReset.ts sweeps the pre-accounts keys once per device.
      if (raw) doc = normalizePersisted(JSON.parse(raw))
    } catch {
      /* malformed / private mode → fall through to defaults */
    }
    if (!doc) doc = defaultPersisted(profileId, deviceId, now)
    doc.profileId = profileId

    this.persisted = doc
    this.state = derive(doc, now)

    const waiters = this.attachWaiters
    this.attachWaiters = []
    waiters.forEach((w) => w(profileId))
    // sfxClient / musicClient / bugReporter re-read progressStore.get() on notify, so this is all
    // they need to pick up the new child's settings (§10.6).
    this.listeners.forEach((l) => l())
  }

  detach(): void {
    this.flush()
    this.key = null
    this.persisted = null
    this.currentProfileId = null
    this.state = INERT_STATE
    this.listeners.forEach((l) => l())
  }

  isAttached(): boolean {
    return this.persisted !== null && this.key !== null
  }

  activeProfileId(): string | null {
    return this.currentProfileId
  }

  /** Re-read the active key from disk and notify (used after a cross-tab write or a server pull). */
  reload(): void {
    const id = this.currentProfileId
    if (!id) return
    this.currentProfileId = null
    this.attach(id)
  }

  /** One-shot, resolved by the first attach(). Lets devHarness wait instead of no-oping (§10.7). */
  whenAttached(): Promise<string> {
    if (this.currentProfileId) return Promise.resolve(this.currentProfileId)
    return new Promise((resolve) => this.attachWaiters.push(resolve))
  }

  /**
   * Cross-tab. The old comment here — "this is a single-child app, so last-writer-wins is fine" —
   * became factually FALSE with profiles, and LWW can drop a reward outright, so both the code and the
   * comment are replaced (§5.7).
   */
  private onStorage(e: StorageEvent): void {
    // 1. Another tab switched child or signed out → re-lock this tab. Never keep playing as the
    //    previous child while writing to the previous child's key.
    if (e.key === ACTIVE_PROFILE_KEY || e.key === ACCOUNT_KEY) {
      this.detach()
      return
    }

    // 2. Same profile, another tab wrote → MERGE, not adopt-wholesale. Sibling tabs are real now.
    if (this.key && e.key === this.key && e.newValue != null && this.persisted) {
      let remote: PersistedProgress | null
      try {
        remote = normalizePersisted(JSON.parse(e.newValue))
      } catch {
        return
      }
      if (!remote) return
      const { merged, report } = mergeProgress(this.persisted, remote, {
        now: nowMs(),
        deviceId: getDeviceId(),
      })
      // `report.changed` is what stops a write ping-pong; the join's idempotence bounds it to one
      // round even if both tabs react simultaneously.
      if (report.changed) this.commit(merged)
      else {
        // Adopt in memory only — do NOT write back.
        this.persisted = merged
        this.state = derive(merged, nowMs())
        this.listeners.forEach((l) => l())
      }
      return
    }

    // 3. Another PROFILE's key (a sibling in tab 2) → ignore entirely.
  }

  // ----- persistence -----------------------------------------------------------------------------

  /**
   * HIGHEST-RISK BUG IN THE WHOLE CHANGE (§5.4): once the key is mutable, a pending timer firing after
   * a profile swap would write child A's book under child B's key. Flushing before the swap is
   * necessary but NOT sufficient — so the payload is bound to its key HERE, at schedule time, which
   * makes the cross-key write structurally impossible.
   */
  private scheduleSave(): void {
    if (!this.key || !this.persisted) return // detached ⇒ never persist
    this.pending = { key: this.key, json: JSON.stringify(this.persisted) }
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.writePending()
    }, 250)
  }

  /** Write immediately, bypassing the debounce. No-op when nothing is pending. */
  flush(): void {
    if (!this.saveTimer) return
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    this.writePending()
  }

  private writePending(): void {
    const p = this.pending
    this.pending = null
    if (!p) return
    try {
      localStorage.setItem(p.key, p.json)
    } catch {
      /* quota / private mode — keep running on the in-memory copy */
    }
  }

  private commit(next: PersistedProgress): void {
    if (!this.key) {
      if (import.meta.env?.DEV) console.warn('[progress] write while detached — dropped')
      return
    }
    next.sync = { ...next.sync, rev: next.sync.rev + 1, updatedAt: nowMs() }
    if (import.meta.env?.DEV) {
      const v = progressInvariantViolations(next)
      if (v.length) console.error('[progress] invariant violated', v)
    }
    this.persisted = next
    this.state = derive(next, nowMs())
    this.scheduleSave()
    this.commitListeners.forEach((l) => l(next.sync)) // → progressSync's debounced push
    this.listeners.forEach((l) => l())
  }

  /**
   * Native structuredClone replaces the old hand-enumerated `structuredCloneState()`, which was an
   * implicit WHITELIST: any field you forgot to list was silently dropped on the next commit and
   * surfaced minutes later as data loss with no error (§10.5). Safari 15.4+ / Node 22 — well under the
   * iOS 17 floor. Blobs are a few KB and commits are per-task.
   */
  private draft(): PersistedProgress {
    return structuredClone(this.persisted as PersistedProgress)
  }

  // ----- reads -----------------------------------------------------------------------------------

  get(): ProgressState {
    return this.state
  }

  difficultyFor(section: SectionId): DifficultyLevel {
    const d = this.state.settings.difficulty
    return d.perSection?.[section] ?? d.global
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ----- settings --------------------------------------------------------------------------------

  private stamp(draft: PersistedProgress, path: string): void {
    draft.settingsMeta[path] = { at: nowMs(), by: getDeviceId() }
  }

  setDifficulty(next: {
    global?: DifficultyLevel
    section?: SectionId
    level?: DifficultyLevel | null
  }): void {
    if (!this.isAttached()) return
    const draft = this.draft()
    const d = draft.settings.difficulty
    if (next.global) {
      d.global = next.global
      this.stamp(draft, 'difficulty.global')
    }
    if (next.section) {
      const per = { ...(d.perSection ?? {}) }
      if (next.level == null) delete per[next.section]
      else per[next.section] = next.level
      d.perSection = Object.keys(per).length ? per : undefined
      // PER-SECTION path, not the whole object: absence is a value (an override that was cleared).
      this.stamp(draft, `difficulty.perSection.${next.section}`)
    }
    this.commit(draft)
  }

  setSetting<K extends keyof ProgressSettings>(key: K, value: ProgressSettings[K]): void {
    if (!this.isAttached()) return
    const draft = this.draft()
    draft.settings[key] = value
    this.stamp(draft, String(key))
    this.commit(draft)
  }

  // ----- reward awarding (deterministic — Reward Book PRD-01 §7) ---------------------------------

  /**
   * Award the reward at ONE 0-based CURSOR position. Mutates the given draft.
   *
   * There is NO randomness anywhere in here: the slot comes from the level cursor and the reward comes
   * straight off REWARD_PATH, which is exactly why the corner ring can show the prize BEFORE it's
   * earned. Past the end of the path there is now NOTHING — the gold pass is deleted, the book has a
   * real ending, and `owedRewards()` clamps so this is never reached out of range.
   */
  private grantSlot(draft: PersistedProgress, cursor0: number): RewardGrant {
    const slot = Math.max(0, Math.floor(cursor0))
    const reward = rewardAt(slot)!
    const chapter = chapterForRewardId(reward.id) ?? chapterAt(slot)!
    const chapterIndex = chapterOfSlot(slot)

    const now = nowMs()
    const before = rebuildCollected(slot, draft.stickers.firstAt, now)
    const isNew = !before[reward.id]
    const wasChapterComplete = chapter.rewards.every((r) => !!before[r.id])
    const wasBookComplete = Object.keys(before).length >= REWARD_SLOTS

    const device = getDeviceId()
    const entry = (draft.ledger[device] ??= emptyDeviceCounters())
    entry.slots += 1
    draft.stickers.grantedSlots = totalSlots(draft)
    if (isNew) draft.stickers.firstAt[reward.id] ??= now

    const after = rebuildCollected(slot + 1, draft.stickers.firstAt, now)
    const nowChapterComplete = chapter.rewards.every((r) => !!after[r.id])
    const nowBookComplete = Object.keys(after).length >= REWARD_SLOTS

    return {
      reward,
      slot,
      chapter,
      chapterIndex,
      slotInChapter: slot - chapterIndex * CHAPTER_SIZE,
      chapterCompleted: !wasChapterComplete && nowChapterComplete,
      bookCompleted: !wasBookComplete && nowBookComplete,
      isNew,
    }
  }

  /**
   * How many slots have been HANDED OVER in total — the cursor position along the path, which now has
   * a real end (no gold-pass wrap). Now O(1) off the ledger, which also FIXES a latent bug: the old
   * version summed `stickers.collected[*].count`, and normalize()'s off-path pruning could decrement
   * that sum and manufacture phantom debt the first time someone edited stickers.ts (§10.11).
   *
   * PUBLIC since Reward Horizon PRD-01: it is the sole input to `rewardNumber()`, the one number the
   * child sees, and the tests pin the two against each other.
   */
  grantedSlots(): number {
    return this.persisted ? totalSlots(this.persisted) : 0
  }

  /**
   * THE child-facing number — how many rewards are in the book. Deliberately `grantedSlots`, never
   * `collectedFromLevel(globalLevel())`: that one is the debt CEILING and runs one ahead while a
   * ceremony is pending, so the ring badge and the book header would disagree by one for the length of
   * the RewardWatcher grace — on the very path (ring → book) the door now makes routine (§3.1).
   *
   * Consequence, and it is the intended two-beat: mid-game a crossing flashes the won prize in the
   * ring but does NOT move the number; the number ticks up in the ceremony, with the sticker reveal.
   */
  rewardNumber(): number {
    return rewardNumber(this.grantedSlots())
  }

  /** Rewards the level cursor says are OWED but not yet handed over. Normally 0 or 1, 0 past the end. */
  private owedRewards(): number {
    return this.persisted ? owedFromDoc(this.persisted) : 0
  }

  /** Hand over EVERY owed slot in ONE commit (called once per ceremony, by RewardOverlay). */
  grantPendingRewards(): RewardGrant[] {
    if (!this.isAttached()) return []
    const owed = this.owedRewards()
    if (owed <= 0) return []
    const draft = this.draft()
    const grants: RewardGrant[] = []
    const start = this.grantedSlots() // read BEFORE mutating; the draft isn't live yet
    for (let i = 0; i < owed; i++) grants.push(this.grantSlot(draft, start + i))
    this.commit(draft)
    return grants
  }

  /**
   * DISTINCT ids in the book. What the BOOK's per-chapter counts are derived from. With the gold pass
   * gone there are no duplicates, so this equals `rewardNumber()` always — asserted, not assumed.
   */
  collectedCount(): number {
    return Object.keys(this.state.stickers.collected).length
  }

  /**
   * The reward the corner ring is filling toward and the book previews as a silhouette — the SINGLE
   * source for the ring, the book and the result meter. `null` once the book is full.
   */
  nextReward(): { reward: Reward; slot: number; chapter: RewardChapter } | null {
    const slot = this.grantedSlots()
    if (slot >= REWARD_SLOTS) return null
    const reward = rewardAt(slot)
    if (!reward) return null
    return { reward, slot, chapter: chapterForRewardId(reward.id) ?? chapterAt(slot)! }
  }

  /** The companion's growth stage (0..COMPANION_STAGES-1) — one per chapter, then fully grown. */
  companionStage(): number {
    return companionStageForCollected(this.collectedCount())
  }

  /** Record that a browse item paid out its one-time XP. True ONLY the first time ever. */
  markBrowsed(section: SectionId, key: string): boolean {
    if (!this.isAttached()) return false
    const list = this.persisted!.progression.explored[section] ?? []
    if (list.includes(key)) return false
    const draft = this.draft()
    draft.progression.explored[section] = [...list, key]
    this.commit(draft)
    return true
  }

  // ----- progression (XP / level / bloom) --------------------------------------------------------

  /**
   * Mutates the draft's LEDGER ENTRY FOR THIS DEVICE ONLY (a G-Counter: increment your own, merge with
   * per-device max, total with Σ) and returns the before/after report. The returned shape is unchanged
   * — it reads through totalXp()/bloomXpFor() — so useRound, xpBus and RewardRing are untouched.
   */
  private applyXp(draft: PersistedProgress, section: SectionId, amount: number): XpGrantResult {
    const amt = Math.max(0, Math.floor(amount))
    const now = nowMs()

    const xpBefore = totalXp(draft)
    const bloomBefore = bloomXpFor(draft, section)

    const device = getDeviceId()
    const entry = (draft.ledger[device] ??= emptyDeviceCounters())
    entry.xp += amt
    entry.bloom[section] = (entry.bloom[section] ?? 0) + amt
    draft.progression.updatedAt = now

    const xpAfter = totalXp(draft)
    const bloomAfter = bloomXpFor(draft, section)
    const before = levelFromXp(xpBefore)
    const after = levelFromXp(xpAfter)

    return {
      granted: amt,
      section,
      global: {
        xpBefore,
        xpAfter,
        levelBefore: before.level,
        levelAfter: after.level,
        leveledUp: after.level > before.level,
        xpIntoLevel: after.xpIntoLevel,
        xpToNextLevel: after.xpToNextLevel,
        xpForThisLevel: after.xpForThisLevel,
      },
      bloom: {
        xpBefore: bloomBefore,
        xpAfter: bloomAfter,
        stageBefore: bloomStage(bloomBefore),
        stageAfter: bloomStage(bloomAfter),
        stageAdvanced: bloomStage(bloomAfter) > bloomStage(bloomBefore),
        fillBefore: bloomFill(bloomBefore),
        fillAfter: bloomFill(bloomAfter),
      },
    }
  }

  /** Kept for the DEV seed harness (?rewards=n); normal play goes through grantTaskXp. */
  grantXp(section: SectionId, amount: number): XpGrantResult {
    if (!this.isAttached()) return zeroXpGrant(section)
    const draft = this.draft()
    const result = this.applyXp(draft, section, amount)
    this.commit(draft)
    return result
  }

  /**
   * Live per-task XP. Called once per COMPLETED TASK in any game. "A round is a round" (Reward Book
   * §5): the amount is REWARD_XP / tasksInRound + a first-try bonus, so ANY completed round is worth
   * ≈ one reward regardless of how it's subdivided. NEVER difficulty-dependent (fairness).
   */
  grantTaskXp(
    gameId: string,
    opts: { firstTry: boolean; tasksInRound?: number; section?: SectionId },
  ): XpGrantResult {
    const isBrowse = gameId === 'browse'
    const section = isBrowse ? opts.section ?? 'alphabet' : sectionForGameId(gameId)
    if (!this.isAttached()) return zeroXpGrant(section)
    const draft = this.draft()
    const amount = isBrowse ? BROWSE_TASK_XP : taskXp(opts.tasksInRound ?? 8, opts.firstTry)
    const result = this.applyXp(draft, section, amount)
    this.commit(draft)
    return result
  }

  globalLevel(): number {
    return levelFromXp(this.state.progression.globalXp).level
  }

  xpProgressToNextLevel(): {
    level: number
    xpIntoLevel: number
    xpToNextLevel: number
    xpForThisLevel: number
    fill: number
  } {
    const info = levelFromXp(this.state.progression.globalXp)
    return {
      level: info.level,
      xpIntoLevel: info.xpIntoLevel,
      xpToNextLevel: info.xpToNextLevel,
      xpForThisLevel: info.xpForThisLevel,
      fill: info.xpForThisLevel > 0 ? info.xpIntoLevel / info.xpForThisLevel : 0,
    }
  }

  bloomFor(section: SectionId): { xp: number; stage: number; fill: number } {
    const xp = this.state.progression.bloom[section]?.xp ?? 0
    return { xp, stage: bloomStage(xp), fill: bloomFill(xp) }
  }

  /** Advance the celebrated-level cursor (idempotent; only moves forward). */
  markLevelCelebrated(level: number): void {
    if (!this.isAttached()) return
    const lvl = Math.max(0, Math.floor(level))
    if (lvl <= this.persisted!.progression.lastCelebratedLevel) return
    const draft = this.draft()
    draft.progression.lastCelebratedLevel = lvl
    this.commit(draft)
  }

  /**
   * Clear the "nyt!" flags. Stores a CURSOR rather than emptying an array: "new since last opened" is
   * always a contiguous suffix of the granted prefix, so a max-register merges cleanly where an array
   * union would resurrect dismissed badges (§6.2d).
   */
  markStickersSeen(): void {
    if (!this.isAttached()) return
    const target = Math.min(REWARD_SLOTS, this.grantedSlots())
    if (this.persisted!.stickers.seenThroughSlot >= target) return
    const draft = this.draft()
    draft.stickers.seenThroughSlot = target
    this.commit(draft)
  }

  // ----- reset -----------------------------------------------------------------------------------

  /**
   * Reset progress ONLY (the book and the XP behind it). Sound/music/difficulty/theme
   * are preferences, not progress, so they carry across — as does `settingsMeta`, because resetting the
   * stamps BACKWARDS would let a stale remote setting win the next merge (§5.6).
   *
   * NOTE it is now PER CHILD, and it bumps `sync.epoch`: without that, the next pull resurrects
   * everything, because no monotone join can express a deletion (§6.2c).
   */
  resetAll(): void {
    if (!this.isAttached()) {
      if (import.meta.env?.DEV) console.warn('[progress] resetAll while detached — dropped')
      return
    }
    const prev = this.persisted!
    // "Nulstil fremgang" means everything this child has built up on the device, so it takes the
    // practice ledger with it (Practice Loop PRD-01 W2) — otherwise a reset book still re-asks the
    // letters the previous run got wrong. Settings survive; a miss record is not a preference.
    practiceLedger.clear(prev.profileId)
    const next = defaultPersisted(prev.profileId, getDeviceId(), nowMs())
    next.settings = structuredClone(prev.settings)
    next.settingsMeta = structuredClone(prev.settingsMeta)
    next.sync = {
      ...next.sync,
      rev: prev.sync.rev,
      epoch: prev.sync.epoch + 1,
      syncedRev: prev.sync.syncedRev,
      serverRev: prev.sync.serverRev,
    }
    this.commit(next)
  }

  // ----- guest-book adoption ---------------------------------------------------------------------

  /**
   * Copy one profile's stored book onto another profile's key. The ONE sanctioned surface for this —
   * no caller may reach into `persisted` — and the only user is the guest→first-child adoption
   * (adult-login-visibility PRD §7).
   *
   * DELIBERATELY NOT a merge and deliberately NOT an attach. It refuses if the target already has a
   * book, so the destination is always empty and no CRDT join ever runs: the per-device G-Counter
   * ledger moves across INTACT, which is what makes `grantedSlots === Σ ledger.slots` hold by
   * construction and what stops `mergeLedger`'s per-device `max` from silently discarding the smaller
   * of two entries that share this device's id. The source key is left byte-identical.
   *
   * ORDERING IS LOAD-BEARING: run this BEFORE `profileStore.selectProfile()`. A `false` here then just
   * means the child starts fresh at `attach()`'s `defaultPersisted(...)` — the existing behaviour, and
   * a safe floor. Never block profile creation on it.
   */
  adoptDocument(fromProfileId: string, toProfileId: string): boolean {
    if (!fromProfileId || !toProfileId || fromProfileId === toProfileId) return false
    const fromKey = progressKeyFor(fromProfileId)
    const toKey = progressKeyFor(toProfileId)

    const doc = ((): PersistedProgress | null => {
      try {
        // 1. NEVER overwrite an existing book. This is also what keeps the copy outside the server's
        //    merge path: a child with a local book may well have a server row too.
        if (localStorage.getItem(toKey) !== null) return null
        const raw = localStorage.getItem(fromKey)
        return raw ? normalizePersisted(JSON.parse(raw)) : null
      } catch {
        // Private mode / quota / malformed — fail toward "no adoption", never a partial write.
        return null
      }
    })()
    if (!doc) return false

    // 2. Re-stamp the owner. `attach()` does this too, but the exposure is a push of the copied doc
    //    BEFORE anything attaches, so it is stamped here as well.
    doc.profileId = toProfileId

    // 3. Never-synced-and-dirty, so the child's first push is a first version the server stores
    //    verbatim. `rev` is KEPT: if `syncedRev >= rev` the document reads clean and is never pushed
    //    at all. `sync.epoch` is carried AS-IS — if the guest ever used "Nulstil fremgang", that epoch
    //    is load-bearing and normalising it to 0 would let a stale server state resurrect.
    doc.sync = {
      ...doc.sync,
      serverRev: 0,
      syncedRev: 0,
      originDevice: getDeviceId(),
    }

    // 4. A 422 from `progressInvariantViolations` is the one server error `progressSync` deliberately
    //    does NOT retry, which would strand the child syncing nothing with no visible symptom. Check
    //    before writing and refuse rather than hand over a document that can never be pushed.
    if (progressInvariantViolations(doc).length > 0) return false

    try {
      localStorage.setItem(toKey, JSON.stringify(doc))
    } catch {
      return false
    }
    return true
  }

  // ----- sync surface (used only by progressSync and legacyAdoption) -----------------------------

  exportPersisted(): PersistedProgress | null {
    return this.persisted ? structuredClone(this.persisted) : null
  }

  syncMeta(): SyncMeta | null {
    return this.persisted ? { ...this.persisted.sync } : null
  }

  /**
   * Merge a remote document into the LIVE state at call time. Because the merge is a proper CRDT join
   * (idempotent ∧ commutative ∧ associative), this needs NO lock and NO queue — it is safe mid-round
   * and even mid-ceremony (§6.2). That property is the whole reason the merge is shaped the way it is.
   */
  applyRemote(remote: PersistedProgress): MergeReport | null {
    if (!this.isAttached()) return null
    const { merged, report } = mergeProgress(this.persisted!, remote, {
      now: nowMs(),
      deviceId: getDeviceId(),
    })
    if (report.changed) this.commit(merged)
    return report
  }

  /**
   * Record that the server has acked up to `ackedRev`. MUST NOT bump `rev` — doing so leaves the
   * profile permanently dirty and push-loops forever.
   */
  markSynced(serverRev: number, ackedRev: number): void {
    if (!this.persisted) return
    this.persisted.sync = {
      ...this.persisted.sync,
      serverRev: Math.max(this.persisted.sync.serverRev, serverRev),
      syncedRev: Math.max(this.persisted.sync.syncedRev, ackedRev),
    }
    this.scheduleSave()
  }

  onCommit(cb: CommitListener): () => void {
    this.commitListeners.add(cb)
    return () => {
      this.commitListeners.delete(cb)
    }
  }
}

const zeroXpGrant = (section: SectionId): XpGrantResult => ({
  granted: 0,
  section,
  global: {
    xpBefore: 0,
    xpAfter: 0,
    levelBefore: 1,
    levelAfter: 1,
    leveledUp: false,
    xpIntoLevel: 0,
    xpToNextLevel: 0,
    xpForThisLevel: 0,
  },
  bloom: {
    xpBefore: 0,
    xpAfter: 0,
    stageBefore: 0,
    stageAfter: 0,
    stageAdvanced: false,
    fillBefore: 0,
    fillAfter: 0,
  },
})

// Map a gameId to the section its XP/bloom is attributed to. `<section>.<game>` for the five sections;
// the off-menu Memory boards fold into the alphabet / math worlds by content type.
//
// EXPORTED since Endless Play PRD-01: the in-game ceremony seam (`useTaskRun`/`useRewardCeremony`)
// tags its `rewardBus` event with the same section the XP was attributed to, and a second copy of this
// mapping in a hook is exactly how the two would drift.
export function sectionForGameId(gameId: string): SectionId {
  const head = gameId.split('.')[0]
  if ((SECTION_IDS as string[]).includes(head)) return head as SectionId
  if (gameId.startsWith('memory.numbers')) return 'math'
  if (gameId.startsWith('memory.letters')) return 'alphabet'
  return 'alphabet'
}

export const progressStore = new ProgressStore()

// DEV: expose for the headless verification harness.
// `import.meta.env?.` — optional, because src/services/progressStore.test.ts imports this module in
// plain Node (where `import.meta.env` is undefined).
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __progress?: ProgressStore }).__progress = progressStore
}

export { allRewards, totalRewardCount, SCHEMA_VERSION }
// Kept exported for the invariant assertions in tests and for progressSync's server-side mirror.
export { progressInvariantViolations, clampCelebratedCursor, ON_PATH }
