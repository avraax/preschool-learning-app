import React from 'react'
import { Box } from '@mui/material'

// Krea's own full-bleed art studio (Krea PRD-01 §2.3.13) — like Fyld Båden's harbour it paints the
// WHOLE screen and the persistent world is occluded underneath (`useOccludeWorld` in each game).
// ONE studio on every skin, like all game art.
//
// Until the owner's Batch A render lands this is a CSS stand-in with the same composition the prompt
// asks for: a warm cream wall, one daylight window upper left, and a honey-wood table filling the lower
// third. `position: absolute` against GameShell's isolated root (z -1), never `fixed` (PersistentWorld's
// note: Chrome blanks fixed layers during touch pans). Static — no motion at all, so nothing to pause.

/** Where the table top starts, as a share of the screen height — the paper sits on it. */
export const TABLE_TOP_PCT = 62

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
      backgroundColor: '#F4E9D8',
      backgroundImage: [
        // the table: honey wood with a lighter front edge and a few soft grain bands
        `linear-gradient(180deg, #D9A866 0%, #E2B57A ${100 - TABLE_TOP_PCT}%, #C48E4E 100%)`,
      ].join(','),
      backgroundSize: `100% ${100 - TABLE_TOP_PCT}%`,
      backgroundPosition: 'left bottom',
      backgroundRepeat: 'no-repeat',
    }}
  >
    {/* the wall's soft daylight falloff from the window side */}
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: `${TABLE_TOP_PCT}%`,
        background: 'radial-gradient(ellipse at 18% 20%, rgba(255,252,240,0.9) 0%, rgba(255,250,235,0) 60%)',
      }}
    />
    {/* the window, upper left */}
    <Box
      sx={{
        position: 'absolute',
        left: '6%',
        top: '8%',
        width: '22%',
        height: '34%',
        borderRadius: '18px',
        border: '10px solid #FFFDF7',
        boxShadow: '0 6px 18px rgba(90,60,30,0.18), inset 0 0 0 4px rgba(160,130,90,0.15)',
        background: 'linear-gradient(180deg, #CFEAFB 0%, #EAF6FD 70%, #F7FBF2 100%)',
      }}
    />
    {/* the table's front edge */}
    <Box
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${TABLE_TOP_PCT}%`,
        height: '10px',
        background: 'linear-gradient(180deg, rgba(255,235,200,0.9), rgba(150,100,50,0.35))',
      }}
    />
  </Box>
)

/**
 * The sheet of paper on the table. Sized by the RESERVED space it is given (a flex remainder), never
 * a tuned percentage: the parent decides the box, the paper fills it with a fixed aspect.
 */
export const Paper: React.FC<{ children?: React.ReactNode; aspect?: number }> = ({ children, aspect = 4 / 3 }) => (
  <Box
    sx={{
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
