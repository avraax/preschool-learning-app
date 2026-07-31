// Persistent single-profile progress (Overhaul Foundation — System 1).
//
// One localStorage key, an in-memory cache hydrated on boot, debounced writes, and a tiny
// subscribe model so React (useProgress) re-renders on change. Mirrors the discipline of
// ttsClient / ThemeProvider: all storage access is wrapped in try/catch and degrades to
// in-memory-only on private-mode / quota errors (the game still works, it just doesn't persist).
//
// Schema is VERSIONED (`version` field). Unknown/old shapes are normalised forward or reset —
// reading bad data never throws.

// Explicit `.ts` extensions: src/services/progressStore.test.ts imports this module in plain Node
// (which won't resolve extensionless relative specifiers). Vite/tsc accept them
// (allowImportingTsExtensions), and it keeps this file testable outside a browser.
import {
  REWARD_PATH,
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
  roundXp,
  taskXp,
  BROWSE_TASK_XP,
  CHAPTER_SIZE,
  REWARD_SLOTS,
  chapterOfSlot,
  collectedFromLevel,
  companionStageForCollected,
} from '../config/progression.ts'

const STORAGE_KEY = 'bornelaering-progress'
// v3 (Reward Book PRD-01 D8): trin and the sticker album collapsed into ONE track (trin ≡ slot), the
// 63-sticker pool became a 45-reward ordered path, and `progression.explored` was added. A v2 blob's
// random-pool sticker set can't be mapped onto the deterministic path, so — as with the v1→v2 bump —
// normalize() hard-resets on a version mismatch. `resetAll()`-style settings preservation is handled
// there too, so sound/music/difficulty survive.
const SCHEMA_VERSION = 3 as const

export interface PerGameStats {
  bestStreak: number // longest correct-in-a-row (first try) ever
  bestStars: number // best round star rating (1–3)
  bestCount: number // most first-try-correct in one round
  roundsCompleted: number
  lifetimeCorrect: number
}

// Static, manual difficulty (UI/UX Overhaul PRD §5.7) — NO adaptivity. `normal` == today's tuning.
export type DifficultyLevel = 'let' | 'normal' | 'svaer'
export type SectionId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'

export interface DifficultySetting {
  global: DifficultyLevel
  perSection?: Partial<Record<SectionId, DifficultyLevel>>
}

export interface ProgressSettings {
  sfxEnabled: boolean
  musicEnabled: boolean
  // Marker: whether the "music on by default" flip has been applied to this profile. Lets us turn
  // music on once for profiles saved before the default changed, while still respecting a later
  // explicit user "off".
  musicDefaultOn?: boolean
  difficulty: DifficultySetting
}

const DIFFICULTY_LEVELS: DifficultyLevel[] = ['let', 'normal', 'svaer']
const isLevel = (v: unknown): v is DifficultyLevel =>
  typeof v === 'string' && (DIFFICULTY_LEVELS as string[]).includes(v)

// Canonical section list (note: colors is `colors`, route is `/farver`).
const SECTION_IDS: SectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

// ----- Progression (Reward Book PRD-01) ------------------------------------------------------
// One play feeds BOTH layers: the amount adds to the cross-game `globalXp` AND to the attributed
// section's `bloom`. The level and the bloom stage/fill are DERIVED from XP (see
// src/config/progression.ts) so they can never desync — and the COLLECTED COUNT is derived from the
// level (`collectedFromLevel`), which is what makes the ring and the book literally the same track.
// The only stored cursors are `lastCelebratedLevel` (fires the ceremony exactly once, reload/
// cross-tab safe) and `explored` (browse keys that already paid out).
export interface SectionBloom {
  xp: number
  updatedAt: number
}

export interface ProgressionState {
  globalXp: number // lifetime global XP (monotonic)
  lastCelebratedLevel: number // highest level the ceremony has already fired for
  bloom: Record<SectionId, SectionBloom>
  // Browse items that have ALREADY paid out their one-time XP, per section. Persisted (v3) because
  // the old component-local useRef made browse XP re-farmable on every re-entry.
  explored: Record<SectionId, string[]>
  updatedAt: number
}

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

const defaultBloom = (): SectionBloom => ({ xp: 0, updatedAt: 0 })
const defaultProgression = (): ProgressionState => ({
  globalXp: 0,
  // Everyone STARTS at level 1 (an empty book), so it's already "reached" — celebrating it would
  // fire a bogus ceremony on first load. The first real crossing (1→2, i.e. reward slot 1) is the
  // first celebration.
  lastCelebratedLevel: 1,
  bloom: Object.fromEntries(SECTION_IDS.map((s) => [s, defaultBloom()])) as Record<
    SectionId,
    SectionBloom
  >,
  explored: Object.fromEntries(SECTION_IDS.map((s) => [s, [] as string[]])) as Record<
    SectionId,
    string[]
  >,
  updatedAt: 0,
})

export interface ProgressState {
  version: typeof SCHEMA_VERSION
  stickers: {
    collected: Record<string, { count: number; firstAt: number }>
    // Ids first collected but not yet seen in the book — drive the "nyt!" badge. Cleared when
    // the book is opened (markStickersSeen).
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

// One reward handed over by a ceremony. Deterministic: `slot` came straight off the path, never a
// random pick — the ring had been showing this exact object while it filled.
export interface RewardGrant {
  reward: Reward
  slot: number // 0-based index into REWARD_PATH
  chapter: RewardChapter
  chapterIndex: number // 0..4
  slotInChapter: number // 0..8 (drives the ceremony's 9-dot strip)
  chapterCompleted: boolean // this grant filled the last empty slot of its chapter
  bookCompleted: boolean // this grant filled slot 45 for the first time
  gold: boolean // past the end of the path → a shiny duplicate (the gold pass)
  isNew: boolean // first time ever collected
  count: number // total owned of this reward after the grant
}

export interface RoundResultInput {
  correct: number // first-try-correct count in the round
  total: number // round length
  longestStreak: number // longest first-try streak in the round
}

export interface RoundResultOptions {
  starThresholds?: { three: number; two: number } // MISTAKES allowed; default 3★=0, 2★≤2
}

export interface RoundOutcome {
  gameId: string
  correct: number
  total: number
  mistakes: number
  stars: number // 1–3, always ≥1 (no failure state)
  longestStreak: number
  previousBests: { streak: number; stars: number; count: number }
  newBests: { streak: boolean; stars: boolean; count: boolean }
  anyNewBest: boolean
  totals: { totalStars: number; totalStickers: number }
  xp: XpGrantResult // round-END bonus XP, folded into the same atomic round commit
}

const DEFAULT_THRESHOLDS = { three: 0, two: 2 }

const emptyGameStats = (): PerGameStats => ({
  bestStreak: 0,
  bestStars: 0,
  bestCount: 0,
  roundsCompleted: 0,
  lifetimeCorrect: 0,
})

const defaultState = (): ProgressState => ({
  version: SCHEMA_VERSION,
  stickers: { collected: {}, newIds: [] },
  perGame: {},
  totals: { totalStars: 0, totalStickers: 0 },
  progression: defaultProgression(),
  settings: { sfxEnabled: true, musicEnabled: true, musicDefaultOn: true, difficulty: { global: 'normal' } },
})

// Forward-safe normaliser: keep any known good data, fill missing slices, drop the rest.
const normalize = (raw: unknown): ProgressState => {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<ProgressState>
  if (r.version !== SCHEMA_VERSION) return base // unknown/old → reset (never crash)

  const state = base
  if (r.stickers && typeof r.stickers === 'object' && r.stickers.collected) {
    for (const [id, v] of Object.entries(r.stickers.collected)) {
      if (v && typeof v.count === 'number') {
        state.stickers.collected[id] = {
          count: Math.max(1, Math.floor(v.count)),
          firstAt: typeof v.firstAt === 'number' ? v.firstAt : Date.now(),
        }
      }
    }
    if (Array.isArray(r.stickers.newIds)) {
      state.stickers.newIds = r.stickers.newIds.filter(
        (id): id is string => typeof id === 'string' && !!state.stickers.collected[id],
      )
    }
  }
  if (r.perGame && typeof r.perGame === 'object') {
    for (const [id, v] of Object.entries(r.perGame)) {
      if (v && typeof v === 'object') {
        state.perGame[id] = { ...emptyGameStats(), ...v }
      }
    }
  }
  if (r.totals && typeof r.totals === 'object') {
    state.totals.totalStars = Number(r.totals.totalStars) || 0
    state.totals.totalStickers = Number(r.totals.totalStickers) || 0
  }
  if (r.settings && typeof r.settings === 'object') {
    state.settings.sfxEnabled = r.settings.sfxEnabled !== false
    // Music defaults ON. Profiles saved before this flip (no `musicDefaultOn` marker) get it
    // turned on once; profiles that already carry the marker keep the user's explicit choice.
    state.settings.musicEnabled =
      r.settings.musicDefaultOn === true ? r.settings.musicEnabled !== false : true
    state.settings.musicDefaultOn = true
    const d = (r.settings as Partial<ProgressSettings>).difficulty
    if (d && typeof d === 'object') {
      state.settings.difficulty.global = isLevel(d.global) ? d.global : 'normal'
      if (d.perSection && typeof d.perSection === 'object') {
        const per: Partial<Record<SectionId, DifficultyLevel>> = {}
        for (const [k, v] of Object.entries(d.perSection)) {
          if (isLevel(v)) per[k as SectionId] = v
        }
        if (Object.keys(per).length) state.settings.difficulty.perSection = per
      }
    }
  }
  // Progression slice (v3). Fill each numeric field defensively (same style as perGame/settings);
  // missing sections fall back to defaultBloom(), unknown section keys are ignored.
  if (r.progression && typeof r.progression === 'object') {
    const p = r.progression as Partial<ProgressionState>
    const num = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0))
    state.progression.globalXp = num(p.globalXp)
    // Keep the default (1) when the field is absent so an older/partial blob can't reset the cursor
    // to 0 and re-celebrate the starting level.
    if (p.lastCelebratedLevel != null) state.progression.lastCelebratedLevel = num(p.lastCelebratedLevel)
    state.progression.updatedAt = num(p.updatedAt)
    if (p.bloom && typeof p.bloom === 'object') {
      const rawBloom = p.bloom as Record<string, unknown>
      for (const s of SECTION_IDS) {
        const bl = rawBloom[s]
        if (bl && typeof bl === 'object') {
          const b = bl as Partial<SectionBloom>
          state.progression.bloom[s] = { xp: num(b.xp), updatedAt: num(b.updatedAt) }
        }
      }
    }
    if (p.explored && typeof p.explored === 'object') {
      const rawExplored = p.explored as Record<string, unknown>
      for (const s of SECTION_IDS) {
        const list = rawExplored[s]
        if (Array.isArray(list)) {
          state.progression.explored[s] = list.filter((k): k is string => typeof k === 'string')
        }
      }
    }
  }
  // Drop ids that are no longer on the path (e.g. a reward renamed in a later data edit) so the
  // "{n} / 45" count can never exceed the book, then recompute the derived total.
  for (const id of Object.keys(state.stickers.collected)) {
    if (!ON_PATH.has(id)) delete state.stickers.collected[id]
  }
  state.stickers.newIds = state.stickers.newIds.filter((id) => !!state.stickers.collected[id])
  state.totals.totalStickers = Object.keys(state.stickers.collected).length
  return state
}

// Ids that actually exist on the reward path — the guard for the pruning above.
const ON_PATH = new Set(allRewards().map((r) => r.id))

type Listener = () => void

class ProgressStore {
  private state: ProgressState
  private listeners = new Set<Listener>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.state = this.hydrate()
    this.installLifecycleHooks()
  }

  private hydrate(): ProgressState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return normalize(JSON.parse(raw))
    } catch {
      /* private mode / malformed → in-memory default */
    }
    return defaultState()
  }

  // Reliability + multi-tab (PRD-08 §P2):
  //  • Flush the debounced write synchronously when the tab is backgrounded/closed, so earning a
  //    sticker and immediately swiping the PWA away (within the 250ms debounce) can't lose it.
  //  • Re-hydrate from a `storage` event when ANOTHER tab writes, so the two tabs don't silently
  //    clobber each other's whole blob. This is a single-child app, so last-writer-wins is fine —
  //    re-hydration just means the tab that saved most recently defines the shared state, and the
  //    other tab catches up instead of overwriting it with older data on its next change.
  private installLifecycleHooks(): void {
    if (typeof window === 'undefined') return
    const flush = () => this.flush()
    // pagehide fires on real close/navigation-away (incl. iOS PWA swipe-away, where the tab may
    // never get a later event); visibilitychange:hidden covers backgrounding/app-switch.
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush()
    })
    window.addEventListener('storage', (e) => this.onStorage(e))
  }

  // Another tab wrote our key → adopt its state in memory and notify React. We do NOT re-save
  // (the write already came from storage), avoiding a ping-pong between tabs.
  private onStorage(e: StorageEvent): void {
    if (e.key !== STORAGE_KEY || e.newValue == null) return
    try {
      this.state = normalize(JSON.parse(e.newValue))
      this.listeners.forEach((l) => l())
    } catch {
      /* malformed cross-tab write — keep our own state */
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
      } catch {
        /* quota / private mode — keep running on the in-memory copy */
      }
    }, 250)
  }

  // Write immediately, bypassing the debounce. No-op when nothing is pending (a tab switch with
  // no unsaved change shouldn't touch localStorage). Public so a lifecycle/test path can force it.
  flush(): void {
    if (!this.saveTimer) return // nothing dirty since the last write
    clearTimeout(this.saveTimer)
    this.saveTimer = null
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch {
      /* quota / private mode — keep running on the in-memory copy */
    }
  }

  // Replace the state reference (so useSyncExternalStore detects the change), persist, notify.
  private commit(next: ProgressState): void {
    this.state = next
    this.scheduleSave()
    this.listeners.forEach((l) => l())
  }

  // ----- reads -----
  get(): ProgressState {
    return this.state
  }

  getGame(gameId: string): PerGameStats {
    return this.state.perGame[gameId] ?? emptyGameStats()
  }

  // Effective (static) difficulty for a section: per-section override falls back to global.
  difficultyFor(section: SectionId): DifficultyLevel {
    const d = this.state.settings.difficulty
    return d.perSection?.[section] ?? d.global
  }

  // Set the global level and/or a per-section override (pass `null` value to clear an override).
  setDifficulty(next: { global?: DifficultyLevel; section?: SectionId; level?: DifficultyLevel | null }): void {
    const draft = structuredCloneState(this.state)
    const d = draft.settings.difficulty
    if (next.global) d.global = next.global
    if (next.section) {
      const per = { ...(d.perSection ?? {}) }
      if (next.level == null) delete per[next.section]
      else per[next.section] = next.level
      d.perSection = Object.keys(per).length ? per : undefined
    }
    this.commit(draft)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ----- reward awarding (deterministic — Reward Book PRD-01 §7) -----
  // Award the reward at ONE 0-based slot index. Mutates the given (already-cloned) draft.
  //
  // There is NO randomness anywhere in here: the slot index comes from the level cursor and the
  // reward comes straight off REWARD_PATH, which is exactly why the corner ring can show the prize
  // BEFORE it's earned. Past the end of the path (slot ≥ 45) the **gold pass** wraps deterministically
  // — slot 46 is a gold duplicate of slot 1 — so late play is still a path, not a random duplicate.
  private grantSlot(draft: ProgressState, slotIndex0: number): RewardGrant {
    const slot = Math.max(0, Math.floor(slotIndex0))
    const gold = slot >= REWARD_SLOTS
    const pathIndex = gold ? (slot - REWARD_SLOTS) % REWARD_SLOTS : slot
    const reward = rewardAt(pathIndex) ?? REWARD_PATH[0]
    const chapter = chapterForRewardId(reward.id) ?? chapterAt(pathIndex)!
    const chapterIndex = chapterOfSlot(pathIndex)

    const existing = draft.stickers.collected[reward.id]
    const isNew = !existing
    const wasChapterComplete = chapter.rewards.every((r) => !!draft.stickers.collected[r.id])
    const wasBookComplete = REWARD_PATH.every((r) => !!draft.stickers.collected[r.id])

    if (existing) {
      draft.stickers.collected[reward.id] = { ...existing, count: existing.count + 1 }
    } else {
      draft.stickers.collected[reward.id] = { count: 1, firstAt: Date.now() }
      // First-ever collect → flag as "new" until the book is opened.
      if (!draft.stickers.newIds.includes(reward.id)) draft.stickers.newIds.push(reward.id)
    }
    draft.totals.totalStickers = Object.keys(draft.stickers.collected).length

    const nowChapterComplete = chapter.rewards.every((r) => !!draft.stickers.collected[r.id])
    const nowBookComplete = draft.totals.totalStickers >= REWARD_SLOTS

    return {
      reward,
      slot: pathIndex,
      chapter,
      chapterIndex,
      slotInChapter: pathIndex - chapterIndex * CHAPTER_SIZE,
      chapterCompleted: !wasChapterComplete && nowChapterComplete,
      bookCompleted: !wasBookComplete && nowBookComplete,
      gold,
      isNew,
      count: draft.stickers.collected[reward.id].count,
    }
  }

  // How many slots have been HANDED OVER in total, duplicates included — i.e. the position of the
  // cursor along the (endless, gold-pass-wrapping) path. Every grantSlot() adds exactly 1 to some
  // reward's count, so the sum of counts IS that total; no extra stored field is needed.
  //
  // This, not `collectedCount()`, is what the owed calculation must compare against: the book
  // saturates at 45 distinct rewards while the level keeps climbing, so using the distinct count
  // would report an ever-growing debt and dump a fistful of gold duplicates on every ceremony.
  private grantedSlots(): number {
    let n = 0
    for (const v of Object.values(this.state.stickers.collected)) n += v.count
    return n
  }

  // How many rewards the level cursor says are OWED but not yet handed over. Normally 0 or 1; can be
  // 2 when one round crosses two fast-tier slots, or more after a browse binge.
  private owedRewards(): number {
    return Math.max(0, collectedFromLevel(this.globalLevel()) - this.grantedSlots())
  }

  // Hand over EVERY owed slot in ONE commit (called once per ceremony, by RewardOverlay). Returns
  // them in path order so the ceremony can headline the first and trail the rest.
  grantPendingRewards(): RewardGrant[] {
    const owed = this.owedRewards()
    if (owed <= 0) return []
    const draft = structuredCloneState(this.state)
    const grants: RewardGrant[] = []
    const start = this.grantedSlots() // read BEFORE mutating; the draft isn't live yet
    for (let i = 0; i < owed; i++) grants.push(this.grantSlot(draft, start + i))
    this.commit(draft)
    return grants
  }

  // How many rewards are in the book right now — DISTINCT ids, so a gold duplicate doesn't inflate
  // the "{n} / 45" the child reads. Below 45 there are no duplicates yet (grantSlot walks distinct
  // indices 0..44), so this equals `grantedSlots()` for the whole first pass through the book.
  collectedCount(): number {
    return Object.keys(this.state.stickers.collected).length
  }

  // The reward the corner ring is filling toward and the book previews as a silhouette — the SINGLE
  // source for the ring, the book, the home shelf and the result meter. `null` once the book is full
  // (surfaces then show a gold ✨ instead of a silhouette).
  nextReward(): { reward: Reward; slot: number; chapter: RewardChapter } | null {
    const slot = this.grantedSlots()
    if (slot >= REWARD_SLOTS) return null
    const reward = rewardAt(slot)
    if (!reward) return null
    return { reward, slot, chapter: chapterForRewardId(reward.id) ?? chapterAt(slot)! }
  }

  // The companion's growth stage (0..4) — the 5 chapters ARE the 5 stages.
  companionStage(): number {
    return companionStageForCollected(this.collectedCount())
  }

  // Record that a browse item paid out its one-time XP. Returns true ONLY the first time ever for
  // this (section, key) — persisted, so leaving and re-entering a browse screen can't re-farm XP.
  markBrowsed(section: SectionId, key: string): boolean {
    const list = this.state.progression.explored[section] ?? []
    if (list.includes(key)) return false
    const draft = structuredCloneState(this.state)
    draft.progression.explored[section] = [...list, key]
    this.commit(draft)
    return true
  }

  // ----- the main round path -----
  recordRoundResult(
    gameId: string,
    input: RoundResultInput,
    options: RoundResultOptions = {},
  ): RoundOutcome {
    const thresholds = options.starThresholds ?? DEFAULT_THRESHOLDS
    const mistakes = Math.max(0, input.total - input.correct)
    const stars = mistakes <= thresholds.three ? 3 : mistakes <= thresholds.two ? 2 : 1

    const draft = structuredCloneState(this.state)
    const prev = draft.perGame[gameId] ?? emptyGameStats()

    const previousBests = {
      streak: prev.bestStreak,
      stars: prev.bestStars,
      count: prev.bestCount,
    }
    const newBests = {
      streak: input.longestStreak > prev.bestStreak,
      stars: stars > prev.bestStars,
      count: input.correct > prev.bestCount,
    }
    const anyNewBest = newBests.streak || newBests.stars || newBests.count

    draft.perGame[gameId] = {
      bestStreak: Math.max(prev.bestStreak, input.longestStreak),
      bestStars: Math.max(prev.bestStars, stars),
      bestCount: Math.max(prev.bestCount, input.correct),
      roundsCompleted: prev.roundsCompleted + 1,
      lifetimeCorrect: prev.lifetimeCorrect + input.correct,
    }
    draft.totals.totalStars += stars

    // Rewards are NOT granted here. A round's XP moves the ring, and the reward is handed over by the
    // ceremony (grantPendingRewards) — one track, one grant point. Fold the round-END BONUS XP into
    // the SAME draft/commit: bonuses ONLY (perfect-round / new-best) — the per-task portion was
    // already granted live during play. Computed from round STRUCTURE only, never the difficulty
    // setting (fairness). One play feeds both the global level and the section's bloom.
    const xp = this.applyXp(draft, sectionForGameId(gameId), roundXp({ mistakes, anyNewBest }))

    this.commit(draft)

    return {
      gameId,
      correct: input.correct,
      total: input.total,
      mistakes,
      stars,
      longestStreak: input.longestStreak,
      previousBests,
      newBests,
      anyNewBest,
      totals: { totalStars: draft.totals.totalStars, totalStickers: draft.totals.totalStickers },
      xp,
    }
  }

  // ----- progression (XP / level / bloom) -----
  // Mutates the given (already-cloned) draft's progression slice and returns the before/after report.
  // Global level + bloom stage/fill are derived from the curve (never stored), so this can't desync.
  private applyXp(draft: ProgressState, section: SectionId, amount: number): XpGrantResult {
    const amt = Math.max(0, Math.floor(amount))
    const now = Date.now()
    const p = draft.progression

    const xpBefore = p.globalXp
    const before = levelFromXp(xpBefore)
    p.globalXp = xpBefore + amt
    const after = levelFromXp(p.globalXp)

    const bloomBefore = (p.bloom[section] ?? defaultBloom()).xp
    const bloomAfter = bloomBefore + amt
    p.bloom[section] = { xp: bloomAfter, updatedAt: now }
    p.updatedAt = now

    return {
      granted: amt,
      section,
      global: {
        xpBefore,
        xpAfter: p.globalXp,
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

  // Feed BOTH layers in one commit. Kept for the DEV seed harness (?rewards=n) — normal play goes
  // through grantTaskXp / recordRoundResult, which own their own amounts.
  grantXp(section: SectionId, amount: number): XpGrantResult {
    const draft = structuredCloneState(this.state)
    const result = this.applyXp(draft, section, amount)
    this.commit(draft)
    return result
  }

  // Live per-task XP. Called once per COMPLETED TASK in any game (a question answered, a pair
  // matched, a color board finished, a new browse item explored). "A round is a round" (Reward Book
  // §5): the amount is REWARD_XP / tasksInRound + a first-try bonus, so ANY completed round is worth
  // ≈ one reward regardless of how it's subdivided. NEVER difficulty-dependent (fairness). Feeds both
  // the global level and the section's bloom in one commit and returns the grant so the caller can
  // fire the "+X" flyer / mid-game flourish (via `XpGrantResult.global.leveledUp`).
  //
  // `tasksInRound` defaults to 8 (the standard round length). For `gameId === 'browse'` the caller
  // passes the real section (browse screens know it) and the flat BROWSE_TASK_XP applies, since a
  // browse screen has no round to normalise against; every other id derives its section.
  grantTaskXp(
    gameId: string,
    opts: { firstTry: boolean; tasksInRound?: number; section?: SectionId },
  ): XpGrantResult {
    const draft = structuredCloneState(this.state)
    const isBrowse = gameId === 'browse'
    const section = isBrowse ? opts.section ?? 'alphabet' : sectionForGameId(gameId)
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
    const xp = (this.state.progression.bloom[section] ?? defaultBloom()).xp
    return { xp, stage: bloomStage(xp), fill: bloomFill(xp) }
  }

  // Advance the celebrated-level cursor (idempotent; only moves forward). Called by the level-up
  // overlay AFTER the ceremony plays, so "XP recorded" and "ceremony shown" stay decoupled — that's
  // what makes reload / cross-tab correct (last-writer-wins: the tab that celebrated advances it).
  markLevelCelebrated(level: number): void {
    const lvl = Math.max(0, Math.floor(level))
    if (lvl <= this.state.progression.lastCelebratedLevel) return
    const draft = structuredCloneState(this.state)
    draft.progression.lastCelebratedLevel = lvl
    this.commit(draft)
  }

  // Clear the "new sticker" flags (called when the album is opened, so the "nyt!" badges
  // don't linger on a second visit).
  markStickersSeen(): void {
    if (this.state.stickers.newIds.length === 0) return
    const draft = structuredCloneState(this.state)
    draft.stickers.newIds = []
    this.commit(draft)
  }

  // ----- settings + reset -----
  setSetting<K extends keyof ProgressSettings>(key: K, value: ProgressSettings[K]): void {
    const draft = structuredCloneState(this.state)
    draft.settings[key] = value
    this.commit(draft)
  }

  // PRD-09 P5: reset progress ONLY (the book, per-game bests, lifetime stars) — the gate text
  // promises "alle klistermærker, rekorder og stjerner". Sound/music/difficulty are device
  // preferences, not progress, so they're carried across (the less-surprising choice).
  resetAll(): void {
    const next = defaultState()
    next.settings = structuredCloneState(this.state).settings
    this.commit(next)
  }
}

// Shallow-ish clone sufficient for our nested writes (we always create new nested objects above).
function structuredCloneState(s: ProgressState): ProgressState {
  return {
    version: SCHEMA_VERSION,
    stickers: { collected: { ...s.stickers.collected }, newIds: [...s.stickers.newIds] },
    perGame: { ...s.perGame },
    totals: { ...s.totals },
    progression: {
      globalXp: s.progression.globalXp,
      lastCelebratedLevel: s.progression.lastCelebratedLevel,
      bloom: Object.fromEntries(
        SECTION_IDS.map((id) => [id, { ...(s.progression.bloom[id] ?? defaultBloom()) }]),
      ) as Record<SectionId, SectionBloom>,
      explored: Object.fromEntries(
        SECTION_IDS.map((id) => [id, [...(s.progression.explored[id] ?? [])]]),
      ) as Record<SectionId, string[]>,
      updatedAt: s.progression.updatedAt,
    },
    settings: {
      ...s.settings,
      difficulty: {
        global: s.settings.difficulty.global,
        ...(s.settings.difficulty.perSection
          ? { perSection: { ...s.settings.difficulty.perSection } }
          : {}),
      },
    },
  }
}

// Map a gameId to the section its XP/bloom is attributed to. `<section>.<game>` for the five
// sections; the off-menu Memory boards (`memory.letters.*` / `memory.numbers.*`) fold into the
// alphabet / math worlds by content type. Global XP counts regardless — this only picks the bloom.
function sectionForGameId(gameId: string): SectionId {
  const head = gameId.split('.')[0]
  if ((SECTION_IDS as string[]).includes(head)) return head as SectionId
  if (gameId.startsWith('memory.numbers')) return 'math'
  if (gameId.startsWith('memory.letters')) return 'alphabet'
  return 'alphabet'
}

export const progressStore = new ProgressStore()

// DEV: expose for the headless verification harness (e.g. asserting live difficulty changes).
// `import.meta.env?.` — optional, because src/services/progressStore.test.ts imports this module in
// plain Node (where `import.meta.env` is undefined); the localStorage/window accesses above are
// already guarded by try/catch and `typeof window`.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __progress?: ProgressStore }).__progress = progressStore
}

// Convenience re-exports used around the book UI.
export { allRewards, totalRewardCount }
