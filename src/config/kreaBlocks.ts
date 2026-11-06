// Byggeklodser's content (Krea PRD-03 §3) — PURE data, no React, no three.js, so the game, the guards and
// the prebake enumerator all read ONE source. W2 holds the three free islands; the 36 models join in W3.
//
// Explicit `.ts` extension on imports: this module is in `shared-narration-clips.js`'s plain-Node graph.

/** The three free islands (§2.1.3): same rules, different clay ground and sky. Islands come first. */
export const BLOCK_ISLAND_IDS = ['graes', 'sne', 'strand'] as const
export type BlockIslandId = (typeof BLOCK_ISLAND_IDS)[number]

export interface BlockIslandDef {
  id: BlockIslandId
  /** The picker card's label (never spoken). */
  name: string
  /**
   * Colours: the picker card's code-drawn island, the island's underside and grid, and the sky gradient
   * shown while the owner's painted sky loads (the renders: `src/assets/games/krea/blocks/`).
   */
  top: string
  side: string
  soil: string
  grid: string
  sky: readonly [top: string, mid: string, bottom: string]
  /**
   * Where the painted sky is anchored when `cover` crops it (a 16:9 render on a 4:3 iPad loses its sides):
   * the beach's sun sits in the upper-left corner and was cut in half at centre.
   */
  skyAnchor: 'center' | 'left'
}

export const BLOCK_ISLANDS: readonly BlockIslandDef[] = [
  { id: 'graes', name: 'Græs', top: '#7CB85A', side: '#5E9A43', soil: '#A67C52', grid: '#2F5A1F', sky: ['#9FD6F5', '#D4EEFB', '#EAF6FD'], skyAnchor: 'center' },
  { id: 'sne', name: 'Sne', top: '#F3F7FB', side: '#D9E4EF', soil: '#8FA3B8', grid: '#6E86A0', sky: ['#B7C9E2', '#DCE7F3', '#F2F6FB'], skyAnchor: 'center' },
  { id: 'strand', name: 'Strand', top: '#EED7A4', side: '#DDBF85', soil: '#B08A55', grid: '#8A6A3A', sky: ['#7FCBEA', '#BFE6F5', '#FFF1D6'], skyAnchor: 'left' },
]

export const islandById = (id: string): BlockIslandDef | undefined => BLOCK_ISLANDS.find((i) => i.id === id)

/** Free islands' picker/deep-link/session ids are prefixed, so they never collide with a model's (W3). */
export const FREE_ISLAND_PREFIX = 'fri-'
export const islandItemId = (id: BlockIslandId): string => `${FREE_ISLAND_PREFIX}${id}`

/** The picker's shelf heading for the islands (read, never spoken). */
export const FREE_ISLANDS_LABEL = 'Frie øer'
