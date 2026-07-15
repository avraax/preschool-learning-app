import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useProgress } from '../../hooks/useProgress'
import { progressStore } from '../../services/progressStore'
import { levelUpBus } from '../../services/levelUpBus'
import { routeKind } from './scene/routeKind'

// Level-up SAFETY NET (Liveliness PRD-01 §6 + PRD-04 §5). The primary trigger is the play context
// itself (RoundResultScreen emitting on `levelUpBus`). This watcher guarantees the ceremony still
// fires when that primary path never ran: a tab closed inside the 250ms write debounce, a reload
// before the overlay played, a cross-tab grant, OR a level crossed MID-GAME (which now only fires a
// small in-game flourish and defers the big ceremony) — it lands the moment the child reaches a safe
// surface (a menu). It subscribes via useProgress() and, when `globalLevel() > lastCelebratedLevel`,
// DEFERS briefly so the primary path wins the ordering, then re-checks and emits only if still
// uncelebrated. Duplicate emits collapse inside the overlay, and `lastCelebratedLevel` (advanced on
// dismiss) makes this last-writer-wins safe.
//
// PRD-04 gating: the big full-screen ceremony must NOT interrupt play, so it never fires on a `game`
// route. On a game surface the mid-game flourish already ran; the deferred ceremony waits for a
// `menu` route (RoundResultScreen, itself a game route, emits directly when it lands).

const GRACE_MS = 2500

const LevelUpWatcher: React.FC = () => {
  const { state } = useProgress()
  const location = useLocation()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Never schedule the big ceremony while on a game/browse route — it would interrupt play. The
    // deferred ceremony fires on a safe menu surface (or via RoundResultScreen's direct emit).
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
        levelUpBus.emit({ level, section: null })
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

export default LevelUpWatcher
