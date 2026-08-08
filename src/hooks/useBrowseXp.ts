import { useCallback, useEffect, useRef } from 'react'
import { progressStore, type SectionId } from '../services/progressStore'
import { xpBus } from '../services/xpBus'
import { useRewardCeremony } from './useRewardCeremony'

// Per-new-item browse XP. Each DISTINCTLY-explored item grants a small live XP (BROWSE_TASK_XP) and
// pings the corner reward ring, so the "Lær …" screens feed the same one track as the games.
//
// The anti-farm lives in the STORE (`progression.explored`, schema v3), not in a component-local ref:
// the old `useRef<Set<string>>` was recreated on every mount, so leaving a browse screen and coming
// back re-paid every item — a browse loop could mint rewards indefinitely. Persisting it means an
// item pays out ONCE EVER (until "Nulstil al fremgang").
//
// Rewards are still not granted here — that stays the ceremony's job — but the ceremony now fires
// FROM here (Endless Play PRD-01 W5) rather than waiting for the child to leave for a menu. That is
// what makes "immediately, in-game" true on a browse too, and it is what leaves `RewardWatcher`
// genuinely net-only.
//
// Returns `awardBrowseXp(key)` → true when the item was new (XP granted this call), false when it was
// already explored. Callers speak the item echo either way.

/**
 * A beat before the ceremony opens, so the item's own spoken echo isn't cut off by the reward line.
 * A browse tap speaks immediately and there is no dwell here to hide behind, unlike a game's seam.
 */
const ECHO_BEAT_MS = 900

export function useBrowseXp(section: SectionId): (key: string) => boolean {
  const ceremony = useRewardCeremony()
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    },
    [],
  )

  return useCallback(
    (key: string): boolean => {
      if (!progressStore.markBrowsed(section, key)) return false
      const grant = progressStore.grantTaskXp('browse', { firstTry: false, section })
      xpBus.emit({ amount: grant.granted, leveledUp: grant.global.leveledUp })
      // `celebrateIfOwed` is a no-op unless this tap actually crossed a slot, so this costs one timer
      // per new item and nothing else.
      const t = setTimeout(() => {
        timers.current = timers.current.filter((x) => x !== t)
        void ceremony.celebrateIfOwed(section)
      }, ECHO_BEAT_MS)
      timers.current.push(t)
      return true
    },
    [section, ceremony],
  )
}

export default useBrowseXp
