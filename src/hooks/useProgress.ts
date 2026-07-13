import { useCallback, useSyncExternalStore } from 'react'
import {
  progressStore,
  type DifficultyLevel,
  type ProgressSettings,
  type ProgressState,
  type SectionId,
} from '../services/progressStore'

// React interface to the progress store (Overhaul Foundation — System 1).
// Subscribes via useSyncExternalStore so any component re-renders when progress changes
// (sticker earned, best beaten, setting toggled, reset). Reads are synchronous from the
// store's in-memory cache.

export interface UseProgress {
  state: ProgressState
  setSetting: <K extends keyof ProgressSettings>(key: K, value: ProgressSettings[K]) => void
  setDifficulty: (next: { global?: DifficultyLevel; section?: SectionId; level?: DifficultyLevel | null }) => void
  markStickersSeen: () => void
  resetAll: () => void
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

  return { state, setSetting, setDifficulty, markStickersSeen, resetAll }
}

export default useProgress
