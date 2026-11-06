/**
 * Whether Byggeklodser (`krea.blocks`, Krea PRD-03 §2.7) is reachable — its tile, its route, its deep
 * link and its usage event. Staging only until the owner releases it; release is deleting this gate and
 * the `kreaRelease.test.ts` exception that names it.
 *
 * The old `kreaGate.ts`/`boatGate.ts` shape and for the same reason: `BL_TIER` defaults to `'production'`
 * under `npm run dev`, so a tier-only gate would hide the game from the owner's own dev machine.
 */
export const showsBlocks = (tier: 'staging' | 'production', isDev: boolean, isHarness: boolean): boolean =>
  tier === 'staging' || isDev || isHarness

export const BLOCKS_GAME_ID = 'krea.blocks'
export const BLOCKS_ROUTE = '/krea/klodser'

/** Whether a menu tile is listed: everything, except Byggeklodser while the gate is shut. */
export const gameShown = (gameId: string, blocksShown: boolean): boolean => blocksShown || gameId !== BLOCKS_GAME_ID
