// Route depth + travel direction for the themed transition system (Liveliness PRD-02).
//
// The wipe overlay uses depth to decide the travel DIRECTION (going deeper = forward vector;
// coming back = the reverse), and it maps a route to a SectionId so the section's world can bloom.
// Kept tiny + pure so it can be imported anywhere (provider, overlay, PersistentWorld) with no deps.

import type { SectionId } from '../services/progressStore'

// 0 = home, 1 = section menu, 2 = game/browse (deeper).
export const routeDepth = (p: string): number => (p === '/' ? 0 : p.split('/').filter(Boolean).length)

export type TravelDirection = 'forward' | 'back'

// Going to an equal-or-deeper route is "forward" (into the app); shallower is "back".
export const directionFor = (from: string, to: string): TravelDirection =>
  routeDepth(to) >= routeDepth(from) ? 'forward' : 'back'

// Map a pathname to the SectionId whose world it belongs to (or null for home/off-section routes).
// NB the route is `/farver` but the SectionId is `colors` (gameIds are `colors.*`).
export const sectionForPath = (pathname: string): SectionId | null => {
  const head = pathname.split('/').filter(Boolean)[0]
  switch (head) {
    case 'alphabet':
      return 'alphabet'
    case 'math':
      return 'math'
    case 'farver':
      return 'colors'
    case 'english':
      return 'english'
    case 'ordleg':
      return 'ordleg'
    default:
      return null
  }
}
