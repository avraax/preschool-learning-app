import React from 'react'
import { Box } from '@mui/material'
import { KREA_ART } from '../../../assets/games/krea'

// Krea's own full-bleed art studio (Krea PRD-01 §2.3.13) — like Fyld Båden's harbour it paints the
// WHOLE screen and the persistent world is occluded underneath (`useOccludeWorld` in each game).
// ONE studio on every skin, like all game art: the owner's render (pass 3, N2), a honey-wood craft
// table seen FROM ABOVE filling the screen, so the paper, the crayons and every tool lie ON it in any
// layout. (The first studio was a wall seen straight on; it is kept as art-src/krea/backdrop-wall.jpg.)
//
// `position: absolute` against GameShell's isolated root (z -1), never `fixed` (PersistentWorld's note:
// Chrome blanks fixed layers during touch pans). Static — nothing moves, so nothing to pause.

export const StudioBackdrop: React.FC = () => (
  <Box
    aria-hidden
    data-krea-backdrop
    sx={{
      position: 'absolute',
      inset: 0,
      zIndex: -1,
      overflow: 'hidden',
      pointerEvents: 'none',
      // The wood's own colour, so a slow first paint is warm wood rather than a flash of white.
      backgroundColor: '#E9C68E',
      backgroundImage: `url(${KREA_ART.backdrop})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      backgroundPosition: '50% 60%',
    }}
  />
)

/**
 * The sheet of paper on the table. Sized by the RESERVED space it is given (a flex remainder), never
 * a tuned percentage: the parent decides the box, the paper fills it with a fixed aspect.
 */
export const Paper: React.FC<{
  children?: React.ReactNode
  aspect?: number
  /** The sheet itself — the "comes alive" motion runs on this element (`alive.ts`). */
  paperRef?: React.Ref<HTMLDivElement>
}> = ({ children, aspect = 4 / 3, paperRef }) => (
  <Box
    sx={{
      gridArea: 'paper',
      width: '100%',
      height: '100%',
      flex: '1 1 auto',
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      containerType: 'size',
    }}
  >
    <Box
      ref={paperRef}
      data-krea-paper
      sx={{
        position: 'relative',
        width: `min(100cqw, calc(100cqh * ${aspect}))`,
        aspectRatio: String(aspect),
        background: '#FFFEFB',
        borderRadius: '10px',
        boxShadow: '0 10px 24px rgba(80,50,20,0.28), 0 2px 4px rgba(80,50,20,0.2)',
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  </Box>
)
