// Where the app's persistent menu furniture sits, and the pure check that keeps earned bloom
// scenery from being seated underneath it.
//
// Bloom scenery (`theme.scene.bloomScenery`) is drawn INSIDE the world layer, i.e. behind every
// page. That is correct — nothing collectible lives in the world — but it means a badly placed
// sprite doesn't overlap the furniture, it hides behind it: Regnbue's stage-1 flower was seated at
// 12%/82%, which is exactly where the home mascot stands, so it read as a flower growing out of the
// bear. Same collision in Havet (coral behind the octopus) and Dinosaurer (fern behind the dino).
//
// The rectangles below are MEASURED worst cases across REFERENCE_VIEWPORTS (the furniture is sized
// in px, so its share of the screen changes a lot between an iPad and a phone). Re-measure with the
// `ui-screenshot` skill if the layout of the home screen changes; `bloomAnchors.test.ts` fails the
// build when an anchor lands in one of them.

// NB explicit `.ts` — this module is reachable from a `node --test` guard, and Node's ESM resolver
// rejects extensionless relative imports (Vite/tsc accept both).
import { parallaxTravelX, parallaxTravelY } from './parallax.ts'

/** Fractions of the viewport, 0..1. */
export interface Rect {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface Viewport {
  name: string
  w: number
  h: number
}

// iPad-first, phones supported (see .claude/rules/responsive-design.md). The wide one is the
// owner's own window; the two phone entries are the sizes that guard file names.
export const REFERENCE_VIEWPORTS: Viewport[] = [
  { name: 'iPad landscape 1024x768', w: 1024, h: 768 },
  { name: 'iPad portrait 768x1024', w: 768, h: 1024 },
  { name: 'wide 1254x872', w: 1254, h: 872 },
  { name: 'phone landscape 844x390', w: 844, h: 390 },
  { name: 'phone portrait 390x844', w: 390, h: 844 },
]

export const MENU_FURNITURE: Array<{ id: string; rect: Rect }> = [
  // ThemeMascot — bottom-left on home AND on every section menu (bigger on home).
  { id: 'mascot', rect: { x0: 0, x1: 0.27, y0: 0.73, y1: 1 } },
  // The "Min Bog" shelf on home (bottom-centre).
  { id: 'min-bog-shelf', rect: { x0: 0.16, x1: 0.76, y0: 0.88, y1: 1 } },
  // The "Til de voksne" corner button (bottom-right).
  { id: 'adult-corner', rect: { x0: 0.85, x1: 1, y0: 0.85, y1: 1 } },
  // RewardRing (top-right on home and on section menus).
  { id: 'reward-ring', rect: { x0: 0.85, x1: 1, y0: 0, y1: 0.17 } },
  // Logo + "Børnelæring" title (top-left).
  { id: 'title', rect: { x0: 0, x1: 0.35, y0: 0, y1: 0.15 } },
]

// Bloom sprites are laid out as a square centred on their anchor. The px cap is the authored size;
// the vmin term keeps a sprite from eating a fifth of a phone screen.
export const BLOOM_SPRITE_PX = 64
export const BLOOM_SPRITE_VMIN = 12

/** The rendered edge length of a bloom sprite, in px, for a given viewport. */
export const bloomSpriteSize = (scale: number, vp: Viewport): number =>
  Math.min(BLOOM_SPRITE_PX * scale, (BLOOM_SPRITE_VMIN * scale * Math.min(vp.w, vp.h)) / 100)

export interface BloomAnchor {
  xPct: number
  yPct: number
  scale: number
  depth: number
}

/**
 * The area a bloom sprite can occupy — its box at rest, grown by how far the parallax can push it.
 * Returned as fractions of the viewport so it can be compared with MENU_FURNITURE.
 */
export const bloomSpriteBox = (sprite: BloomAnchor, vp: Viewport): Rect => {
  const size = bloomSpriteSize(sprite.scale, vp)
  const halfW = size / 2 + parallaxTravelX(sprite.depth)
  const halfH = size / 2 + parallaxTravelY(sprite.depth)
  const cx = (sprite.xPct / 100) * vp.w
  const cy = (sprite.yPct / 100) * vp.h
  return {
    x0: (cx - halfW) / vp.w,
    x1: (cx + halfW) / vp.w,
    y0: (cy - halfH) / vp.h,
    y1: (cy + halfH) / vp.h,
  }
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

/** Ids of the furniture a bloom sprite would hide behind on this viewport (empty = clear). */
export const bloomAnchorConflicts = (sprite: BloomAnchor, vp: Viewport): string[] => {
  const box = bloomSpriteBox(sprite, vp)
  return MENU_FURNITURE.filter((f) => overlaps(box, f.rect)).map((f) => f.id)
}
