// Persistent single-profile progress (Overhaul Foundation — System 1).
//
// One localStorage key, an in-memory cache hydrated on boot, debounced writes, and a tiny
// subscribe model so React (useProgress) re-renders on change. Mirrors the discipline of
// ttsClient / ThemeProvider: all storage access is wrapped in try/catch and degrades to
// in-memory-only on private-mode / quota errors (the game still works, it just doesn't persist).
//
// Schema is VERSIONED (`version` field). Unknown/old shapes are normalised forward or reset —
// reading bad data never throws.

import {
  allStickers,
  findSet,
  setForStickerId,
  stickerPool,
  totalStickerCount,
  type Sticker,
} from '../config/stickers'

const STORAGE_KEY = 'bornelaering-progress'
const SCHEMA_VERSION = 1 as const

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

export interface ProgressState {
  version: typeof SCHEMA_VERSION
  stickers: {
    collected: Record<string, { count: number; firstAt: number }>
    // Ids first collected but not yet seen in the album — drive the "nyt!" badge. Cleared when
    // the album is opened (markStickersSeen).
    newIds: string[]
  }
  perGame: Record<string, PerGameStats>
  totals: {
    totalStars: number
    totalStickers: number
  }
  settings: ProgressSettings
}

export interface StickerAward {
  sticker: Sticker
  setId: string
  setTitle: string
  isNew: boolean // first time ever collected
  isShiny: boolean // a duplicate (album full for this pool) → sparkle variant
  count: number // total owned of this sticker after the award
}

export interface RoundResultInput {
  correct: number // first-try-correct count in the round
  total: number // round length
  longestStreak: number // longest first-try streak in the round
}

export interface RoundResultOptions {
  starThresholds?: { three: number; two: number } // MISTAKES allowed; default 3★=0, 2★≤2
  stickerSetId?: string // bias the award toward one set; else global pool
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
  stickers: StickerAward[] // round sticker + optional best-bonus sticker
  pageCompleted: { id: string; title: string; emoji: string } | null
  totals: { totalStars: number; totalStickers: number }
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
  settings: { sfxEnabled: true, musicEnabled: true, musicDefaultOn: true, difficulty: { global: 'normal' } },
})

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

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
  // Recompute derived totals defensively so the album count always matches reality.
  state.totals.totalStickers = Object.keys(state.stickers.collected).length
  return state
}

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

  // ----- sticker awarding -----
  // Mutates the given (already-cloned) draft. Returns the award + the set that JUST became
  // complete because of it (else null).
  private grantSticker(
    draft: ProgressState,
    setId?: string,
  ): { award: StickerAward; completedSetId: string | null } {
    const biasedPool = stickerPool(setId)
    let uncollected = biasedPool.filter((s) => !draft.stickers.collected[s.id])
    // PRD-09 P3: if this section's page is already full, fall back to the global uncollected pool
    // so awards keep filling OTHER pages (the album stays completable) instead of endlessly
    // handing out shiny duplicates from one finished set.
    if (setId && uncollected.length === 0) {
      uncollected = stickerPool().filter((s) => !draft.stickers.collected[s.id])
    }
    const isNew = uncollected.length > 0
    // New → next uncollected (biased first, else global); nothing left anywhere → a section-
    // flavoured shiny duplicate.
    const sticker = isNew ? pick(uncollected) : pick(biasedPool)
    const set = setForStickerId(sticker.id) ?? findSet(setId ?? '')

    const existing = draft.stickers.collected[sticker.id]
    const wasSetComplete = set ? set.stickers.every((s) => !!draft.stickers.collected[s.id]) : true

    if (existing) {
      draft.stickers.collected[sticker.id] = { ...existing, count: existing.count + 1 }
    } else {
      draft.stickers.collected[sticker.id] = { count: 1, firstAt: Date.now() }
      // First-ever collect → flag as "new" until the album is opened.
      if (!draft.stickers.newIds.includes(sticker.id)) draft.stickers.newIds.push(sticker.id)
    }
    draft.totals.totalStickers = Object.keys(draft.stickers.collected).length

    const nowSetComplete = set
      ? set.stickers.every((s) => !!draft.stickers.collected[s.id])
      : false
    const completedSetId = set && !wasSetComplete && nowSetComplete ? set.id : null

    return {
      award: {
        sticker,
        setId: set?.id ?? '',
        setTitle: set?.title ?? '',
        isNew,
        isShiny: !isNew,
        count: draft.stickers.collected[sticker.id].count,
      },
      completedSetId,
    }
  }

  // Public single-award entry (used by free-exploration milestone rewards). Persists + notifies.
  awardSticker(setId?: string): StickerAward {
    const draft = structuredCloneState(this.state)
    const { award } = this.grantSticker(draft, setId)
    this.commit(draft)
    return award
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

    // 1 sticker per completed round, + a bonus sticker on a new personal best.
    const stickers: StickerAward[] = []
    let pageCompleted: RoundOutcome['pageCompleted'] = null

    const roundGrant = this.grantSticker(draft, options.stickerSetId)
    stickers.push(roundGrant.award)
    if (roundGrant.completedSetId) pageCompleted = setSummary(roundGrant.completedSetId)

    if (anyNewBest) {
      const bonusGrant = this.grantSticker(draft, options.stickerSetId)
      stickers.push(bonusGrant.award)
      if (!pageCompleted && bonusGrant.completedSetId)
        pageCompleted = setSummary(bonusGrant.completedSetId)
    }

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
      stickers,
      pageCompleted,
      totals: { totalStars: draft.totals.totalStars, totalStickers: draft.totals.totalStickers },
    }
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

  // PRD-09 P5: reset progress ONLY (stickers, per-game bests, lifetime stars) — the gate text
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

function setSummary(setId: string): { id: string; title: string; emoji: string } | null {
  const set = findSet(setId)
  return set ? { id: set.id, title: set.title, emoji: set.emoji } : null
}

export const progressStore = new ProgressStore()

// DEV: expose for the headless verification harness (e.g. asserting live difficulty changes).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __progress?: ProgressStore }).__progress = progressStore
}

// Convenience re-exports used around the album UI.
export { allStickers, totalStickerCount }
