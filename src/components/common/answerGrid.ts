import type { SxProps, Theme } from '@mui/material'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// The answer-tile grid, sized to the TILE COUNT (Difficulty PRD-01 W3).
//
// Option count became a shared difficulty axis — 3 / 4 / 5, and 6 for Læs Ordet (its tiles are
// pictures) — so the grid can no longer be the hardcoded `repeat(2)` portrait / `repeat(4)` landscape
// pair it was when every quiz showed exactly 4. Both `UnifiedQuizGame` and the hand-rolled
// `MathOperationGame` read this, so their answer zones can't drift apart.
//
// Column choice rule: **never leave a row holding a single tile.** 5 can't tile evenly, so portrait
// splits it 3+2 (2 cols would give 2+2+1); 6 goes 3+3 rather than one 6-across row so the pictures stay
// large. 4 is byte-identical to what shipped before.
//
// Widths are per-count because a wide `maxWidth` with few columns stretches each tile past its
// `maxHeight` cap and breaks the 4:3 face. Verified by measurement at 1024×768, 844×390 and 667×375
// (the no-scroll root CLIPS rather than scrolls, so an overflow is silent).
interface GridShape {
  portrait: number
  landscape: number
  maxWidthPortrait: { xs: number; sm: number; md: number }
  maxWidthLandscape: { xs: number; sm: number; md: number }
  /** Fixed tile height in phone landscape (≤480px tall) — aspect-driven tiles blow that budget. */
  phoneTileHeight: number
}

const SHAPES: Record<number, GridShape> = {
  3: {
    portrait: 3,
    landscape: 3,
    maxWidthPortrait: { xs: 340, sm: 420, md: 500 },
    maxWidthLandscape: { xs: 480, sm: 560, md: 640 },
    phoneTileHeight: 84,
  },
  4: {
    portrait: 2,
    landscape: 4,
    maxWidthPortrait: { xs: 400, sm: 500, md: 600 },
    maxWidthLandscape: { xs: 600, sm: 700, md: 800 },
    phoneTileHeight: 84,
  },
  5: {
    portrait: 3,
    landscape: 5,
    maxWidthPortrait: { xs: 400, sm: 500, md: 600 },
    maxWidthLandscape: { xs: 720, sm: 840, md: 960 },
    phoneTileHeight: 84,
  },
  6: {
    portrait: 3,
    landscape: 3,
    maxWidthPortrait: { xs: 400, sm: 500, md: 600 },
    maxWidthLandscape: { xs: 600, sm: 700, md: 800 },
    // Two rows on a ≤480px-tall phone → each tile has to give up ~20px (still well over the 44px
    // touch minimum).
    phoneTileHeight: 64,
  },
}

/** Nearest known shape — an unexpected count falls back to the 4-tile grid rather than collapsing. */
const shapeFor = (count: number): GridShape => SHAPES[count] ?? SHAPES[4]

/**
 * The grid `sx` for `count` answer tiles. Tile aspect/min/max heights are unchanged from the
 * pre-PRD grid; only the column count and the width envelope respond to the count.
 */
export const answerGridSx = (count: number): SxProps<Theme> => {
  const s = shapeFor(count)
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${s.portrait}, 1fr)`,
    gridAutoRows: 'auto',
    gap: { xs: '16px', sm: '20px', md: '24px' },
    width: '100%',
    maxWidth: { xs: `${s.maxWidthPortrait.xs}px`, sm: `${s.maxWidthPortrait.sm}px`, md: `${s.maxWidthPortrait.md}px` },
    justifyContent: 'center',
    alignItems: 'center',
    '& > *': {
      aspectRatio: '4/3',
      minHeight: { xs: '80px', sm: '90px', md: '100px' },
      maxHeight: { xs: '120px', sm: '140px', md: '160px' },
      width: '100%',
    },
    '@media (orientation: landscape)': {
      gridTemplateColumns: `repeat(${s.landscape}, 1fr)`,
      maxWidth: {
        xs: `${s.maxWidthLandscape.xs}px`,
        sm: `${s.maxWidthLandscape.sm}px`,
        md: `${s.maxWidthLandscape.md}px`,
      },
      '& > *': {
        aspectRatio: '4/3',
        minHeight: { xs: '60px', sm: '70px', md: '80px' },
        maxHeight: { xs: '100px', sm: '110px', md: '120px' },
      },
    },
    // Phone landscape: aspect-driven tiles (150px wide → 112px tall) blew the ≤480px height budget —
    // fix the tile height instead of the aspect.
    [PHONE_LANDSCAPE]: {
      gap: '10px',
      maxWidth: '680px',
      '& > *': {
        aspectRatio: 'auto',
        height: `${s.phoneTileHeight}px`,
        minHeight: `${s.phoneTileHeight}px`,
        maxHeight: `${s.phoneTileHeight}px`,
      },
    },
  }
}

export default answerGridSx
