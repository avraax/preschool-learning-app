import { useSyncExternalStore } from 'react'
import { progressStore, type DifficultyLevel, type SectionId } from '../services/progressStore'

// Live effective difficulty for a section (UI/UX Overhaul §5.7). Subscribes to the progress store
// so the component RE-RENDERS the moment the level changes in the adult menu — global or a
// per-section override — no page refresh needed. The snapshot is a primitive string, so React
// bails out of re-rendering when an unrelated progress change fires (only this section's level
// matters). Games pair this with an effect that regenerates the current question/board on change,
// so a mid-game tweak takes effect immediately.
export function useDifficulty(section: SectionId): DifficultyLevel {
  return useSyncExternalStore(
    (cb) => progressStore.subscribe(cb),
    () => progressStore.difficultyFor(section),
  )
}

export default useDifficulty
