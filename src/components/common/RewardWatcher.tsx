import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useProgress } from '../../hooks/useProgress'
import { progressStore } from '../../services/progressStore'
import { rewardBus } from '../../services/rewardBus'
import { routeKind } from './scene/routeKind'

// Reward-ceremony SAFETY NET, and since Endless Play PRD-01 W5 that is ALL it is. The primary trigger
// is the play context itself: `useTaskRun.thenContinue` in every game, `UnifiedMemoryGame`'s match
// branch, and `useBrowseXp` — each firing the ceremony IN PLACE, at the seam.
//
// What is left for this watcher is exactly four cases, all of them "the seam never got to run":
//   • a reload before the overlay played,
//   • a tab closed inside the 250ms write debounce,
//   • a cross-tab grant (or a CRDT merge that created the debt on this device),
//   • **the child tapping Back during the post-answer dwell** — the advance timer is cleared on
//     unmount, so that crossing lands here, on the next menu.
//
// **THE `game`-ROUTE GATE STAYS, and its meaning INVERTS**: it now means "on a game route the in-game
// seam owns the trigger." Removing it creates a real race — the seam fires `DWELL_FACT` 2000 /
// `DWELL_CORRECT()` 1100–1400 ms after the tap, so a watcher landing in the same window would
// sometimes open the ceremony mid-question instead of at the seam, non-deterministically per game.
// The gate removes that by construction.

// The grace was 2500ms because its job was to let `RoundResultScreen`'s direct emit win the ordering.
// On a menu this watcher is now the primary path, and 2.5s there is dead air; ~800ms is enough for a
// route transition to settle and for a cross-tab write to land.
const GRACE_MS = 800

const RewardWatcher: React.FC = () => {
  const { state } = useProgress()
  const location = useLocation()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // On a game route the in-game seam owns the trigger — see the header. Never race it from here.
    if (routeKind(location.pathname) === 'game') return
    const pending = progressStore.globalLevel() > state.progression.lastCelebratedLevel
    if (!pending) return
    if (timer.current) return // already scheduled for this pending window
    timer.current = setTimeout(() => {
      timer.current = null
      // Re-check against the LIVE store: if the primary path already celebrated + advanced the
      // cursor, stay quiet. Otherwise fire (the overlay collapses a duplicate if it's already up).
      const level = progressStore.globalLevel()
      if (level > progressStore.get().progression.lastCelebratedLevel) {
        rewardBus.emit({ level, section: null })
      }
    }, GRACE_MS)
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [state.progression.globalXp, state.progression.lastCelebratedLevel, location.pathname])

  return null
}

export default RewardWatcher
