import { useCallback, useRef } from 'react'
import { progressStore, type SectionId } from '../services/progressStore'
import { xpBus } from '../services/xpBus'

// Per-new-item browse XP (Liveliness PRD-04). Replaces the old lump "+6 every Nth tap" browse
// milestone: each DISTINCTLY-explored item now grants a small live XP (the weighted 'browse' amount)
// and pings the header ring, so the "Lær …" screens feed the same cross-game level as the games.
// Re-tapping an item earns nothing (the Set is the anti-farm — earning always needs a NEW item).
//
// Stickers are NO LONGER granted here (they became level-up trophies); a browse-driven level-up is
// celebrated by the deferred ceremony the moment the child lands back on a menu (LevelUpWatcher).
//
// Returns `awardBrowseXp(key)` → true when the item was new (XP granted this call), false when it
// was already explored. Callers still speak the item echo either way (unlike the old handler, which
// suppressed the echo on a milestone so its sticker line could speak).
export function useBrowseXp(section: SectionId): (key: string) => boolean {
  const explored = useRef<Set<string>>(new Set())
  return useCallback(
    (key: string): boolean => {
      if (explored.current.has(key)) return false
      explored.current.add(key)
      const grant = progressStore.grantTaskXp('browse', { firstTry: false, section })
      xpBus.emit({ amount: grant.granted, leveledUp: grant.global.leveledUp })
      return true
    },
    [section],
  )
}

export default useBrowseXp
