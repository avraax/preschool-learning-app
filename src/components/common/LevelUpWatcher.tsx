import React, { useEffect, useRef } from 'react'
import { useProgress } from '../../hooks/useProgress'
import { progressStore } from '../../services/progressStore'
import { levelUpBus } from '../../services/levelUpBus'

// Level-up SAFETY NET (Liveliness PRD-01 §6, layer 2). The primary trigger is the play context
// itself (RoundResultScreen / browse handler) emitting on `levelUpBus`. This watcher guarantees the
// ceremony still fires when that primary path never ran: a tab closed inside the 250ms write
// debounce, a reload before the overlay played, or a cross-tab grant. It subscribes via
// useProgress() and, when `globalLevel() > lastCelebratedLevel`, DEFERS briefly so the primary path
// wins the ordering, then re-checks and emits only if the level is still uncelebrated. Duplicate
// emits collapse inside the overlay, and `lastCelebratedLevel` (advanced on dismiss) makes this
// last-writer-wins safe — the tab that celebrated advances the cursor; the other stays quiet.

const GRACE_MS = 2500

const LevelUpWatcher: React.FC = () => {
  const { state } = useProgress()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const pending = progressStore.globalLevel() > state.progression.lastCelebratedLevel
    if (!pending) return
    if (timer.current) return // already scheduled for this pending window
    timer.current = setTimeout(() => {
      timer.current = null
      // Re-check against the LIVE store: if the primary path already celebrated + advanced the
      // cursor, stay quiet. Otherwise fire (the overlay collapses a duplicate if it's already up).
      const level = progressStore.globalLevel()
      if (level > progressStore.get().progression.lastCelebratedLevel) {
        levelUpBus.emit({ level, section: null })
      }
    }, GRACE_MS)
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [state.progression.globalXp, state.progression.lastCelebratedLevel])

  return null
}

export default LevelUpWatcher
