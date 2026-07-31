import { useCallback } from 'react'
import { progressStore, type SectionId } from '../services/progressStore'
import { xpBus } from '../services/xpBus'

// Per-new-item browse XP. Each DISTINCTLY-explored item grants a small live XP (BROWSE_TASK_XP) and
// pings the corner reward ring, so the "Lær …" screens feed the same one track as the games.
//
// The anti-farm lives in the STORE (`progression.explored`, schema v3), not in a component-local ref:
// the old `useRef<Set<string>>` was recreated on every mount, so leaving a browse screen and coming
// back re-paid every item — a browse loop could mint rewards indefinitely. Persisting it means an
// item pays out ONCE EVER (until "Nulstil al fremgang").
//
// Rewards are not granted here; a browse-driven crossing is celebrated by the deferred ceremony the
// moment the child lands back on a menu (RewardWatcher).
//
// Returns `awardBrowseXp(key)` → true when the item was new (XP granted this call), false when it was
// already explored. Callers speak the item echo either way.
export function useBrowseXp(section: SectionId): (key: string) => boolean {
  return useCallback(
    (key: string): boolean => {
      if (!progressStore.markBrowsed(section, key)) return false
      const grant = progressStore.grantTaskXp('browse', { firstTry: false, section })
      xpBus.emit({ amount: grant.granted, leveledUp: grant.global.leveledUp })
      return true
    },
    [section],
  )
}

export default useBrowseXp
