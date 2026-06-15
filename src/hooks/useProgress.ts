import { useCallback, useSyncExternalStore } from 'react'
import {
  progressStore,
  type ProgressSettings,
  type ProgressState,
} from '../services/progressStore'

// React interface to the progress store (Overhaul Foundation — System 1).
// Subscribes via useSyncExternalStore so any component re-renders when progress changes
// (sticker earned, best beaten, setting toggled, reset). Reads are synchronous from the
// store's in-memory cache.

export interface UseProgress {
  state: ProgressState
  setSetting: <K extends keyof ProgressSettings>(key: K, value: ProgressSettings[K]) => void
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
  const resetAll = useCallback(() => progressStore.resetAll(), [])

  return { state, setSetting, resetAll }
}

export default useProgress
