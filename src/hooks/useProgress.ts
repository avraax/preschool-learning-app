import { useCallback, useSyncExternalStore } from 'react'
import {
  progressStore,
  type DifficultyLevel,
  type ProgressSettings,
  type ProgressState,
  type SectionId,
  type XpGrantResult,
} from '../services/progressStore'
import type { Reward, RewardChapter } from '../config/stickers'

// React interface to the progress store (Overhaul Foundation — System 1).
// Subscribes via useSyncExternalStore so any component re-renders when progress changes
// (reward earned, best beaten, setting toggled, reset). Reads are synchronous from the
// store's in-memory cache.

export interface UseProgress {
  state: ProgressState
  setSetting: <K extends keyof ProgressSettings>(key: K, value: ProgressSettings[K]) => void
  setDifficulty: (next: { global?: DifficultyLevel; section?: SectionId; level?: DifficultyLevel | null }) => void
  markStickersSeen: () => void
  resetAll: () => void
  // Progression. `state` re-renders on every grant (useSyncExternalStore), so these selectors always
  // reflect the latest snapshot.
  grantXp: (section: SectionId, amount: number) => XpGrantResult
  globalLevel: () => number
  xpProgress: () => {
    level: number
    xpIntoLevel: number
    xpToNextLevel: number
    xpForThisLevel: number
    fill: number
  }
  bloomFor: (section: SectionId) => { xp: number; stage: number; fill: number }
  markLevelCelebrated: (level: number) => void
  // The Reward Book (PRD-01 §7): the single source shared by the corner ring, the book, the home
  // shelf and the result meter — so those surfaces can never show different prizes.
  collectedCount: () => number
  nextReward: () => { reward: Reward; slot: number; chapter: RewardChapter } | null
  companionStage: () => number
}

const subscribe = (cb: () => void) => progressStore.subscribe(cb)
const getSnapshot = () => progressStore.get()

export const useProgress = (): UseProgress => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setSetting = useCallback(
    <K extends keyof ProgressSettings>(key: K, value: ProgressSettings[K]) =>
      progressStore.setSetting(key, value),
    [],
  )
  const setDifficulty = useCallback(
    (next: { global?: DifficultyLevel; section?: SectionId; level?: DifficultyLevel | null }) =>
      progressStore.setDifficulty(next),
    [],
  )
  const markStickersSeen = useCallback(() => progressStore.markStickersSeen(), [])
  const resetAll = useCallback(() => progressStore.resetAll(), [])

  const grantXp = useCallback(
    (section: SectionId, amount: number) => progressStore.grantXp(section, amount),
    [],
  )
  const globalLevel = useCallback(() => progressStore.globalLevel(), [])
  const xpProgress = useCallback(() => progressStore.xpProgressToNextLevel(), [])
  const bloomFor = useCallback((section: SectionId) => progressStore.bloomFor(section), [])
  const markLevelCelebrated = useCallback((level: number) => progressStore.markLevelCelebrated(level), [])
  const collectedCount = useCallback(() => progressStore.collectedCount(), [])
  const nextReward = useCallback(() => progressStore.nextReward(), [])
  const companionStage = useCallback(() => progressStore.companionStage(), [])

  return {
    state,
    setSetting,
    setDifficulty,
    markStickersSeen,
    resetAll,
    grantXp,
    globalLevel,
    xpProgress,
    bloomFor,
    markLevelCelebrated,
    collectedCount,
    nextReward,
    companionStage,
  }
}

export default useProgress
