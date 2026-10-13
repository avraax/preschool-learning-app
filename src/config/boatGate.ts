/**
 * Whether Fyld Båden (`math.boat`) is reachable — its tile AND its route (Harbour PRD-01 §2.3.19).
 *
 * Staging only until the owner approves the vertical slice and the finished game; release is deleting
 * this gate. PURE and truth-tabled for the same reason as `showsDevTools` (`adultSettingsIa.ts`):
 * `BL_TIER` alone is not enough, because it defaults to `'production'` under `npm run dev`, so a
 * tier-only gate would hide the game from the owner's own dev machine.
 */
export const showsBoatGame = (tier: 'staging' | 'production', isDev: boolean, isHarness: boolean): boolean =>
  tier === 'staging' || isDev || isHarness

/** The tile id the gate filters out of Tal og Regning's menu on production. */
export const BOAT_TILE_ID = 'boat'
export const BOAT_ROUTE = '/math/boat'
