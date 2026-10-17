import React from 'react'
import { Box } from '@mui/material'
import { idleTwinkle } from '../../../theme/idleMotion'
import { useReducedMotion } from '../../../hooks/useReducedMotion'

// "NEW IN THIS RELEASE" — a small cluster of twinkling white stars tucked into the object's own
// top-right corner (owner, 2026-10-17, picked from a 28-variant in-app showcase: "the one on Ram
// Farven"). Which items get it is DATA in `src/config/newThisRelease.ts`; the stars are inline SVG
// shapes, never an emoji (CLAUDE.md).
//
// Second pass (owner review the same day): the first cut put three stars at the corners of the SQUARE
// art box, but every icon is baked at ~0.81 of its frame, so the stars floated in the air — on the
// submenu the right-hand one sat nearer the next tile than its own, and a row of four new tiles blurred
// into one band. Now ONE cluster (one big star, two small) sits on the drawing's corner, half over its
// edge, so each mark belongs to its icon. White alone vanished on a bright sky, so each star carries a
// thin gold rim plus a soft dark lift. `door` (front page) is a size up from `tile` (submenus).
//
// Drawn INSIDE SceneObject's square art box, so the cluster scales with the object and never pushes
// layout. Twinkle = CSS keyframes via `idleTwinkle`, staggered; reduced motion → static.

export type NewSparklesSize = 'door' | 'tile'

// Positions are % of the art box. The icon's drawing spans ~10%..90% of it, so its top-right corner is
// near (90%, 10%); the big star is centred just inside that, overlapping the edge.
const CLUSTER: Record<NewSparklesSize, ReadonlyArray<{ size: number; cx: number; cy: number; delayS: number }>> = {
  door: [
    { size: 34, cx: 84, cy: 14, delayS: 0 },
    { size: 15, cx: 101, cy: 32, delayS: 0.6 },
    { size: 12, cx: 66, cy: 0, delayS: 1.1 },
  ],
  tile: [
    { size: 30, cx: 85, cy: 15, delayS: 0 },
    { size: 13, cx: 100, cy: 32, delayS: 0.6 },
    { size: 10, cx: 69, cy: 2, delayS: 1.1 },
  ],
}

const STAR_PATH = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z'

const Star: React.FC<{ size: number; cx: number; cy: number; delayS: number; reduce: boolean }> = ({ size, cx, cy, delayS, reduce }) => {
  const twinkle = idleTwinkle(reduce, { delayS })
  return (
    <Box
      aria-hidden
      {...twinkle.props}
      sx={[
        {
          position: 'absolute',
          left: `${cx - size / 2}%`,
          top: `${cy - size / 2}%`,
          width: `${size}%`,
          height: `${size}%`,
          zIndex: 3,
          pointerEvents: 'none',
          // The dark lift is what makes white read on a bright sky; the white bloom keeps it a "shine".
          filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.35)) drop-shadow(0 0 2px rgba(255,255,255,0.8))',
        },
        twinkle.sx,
      ]}
    >
      <Box component="svg" viewBox="-2 -2 28 28" sx={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
        <path d={STAR_PATH} fill="#FFFFFF" stroke="#F2B600" strokeWidth="1.8" strokeLinejoin="round" />
      </Box>
    </Box>
  )
}

const NewSparkles: React.FC<{ size?: NewSparklesSize }> = ({ size = 'tile' }) => {
  const reduce = useReducedMotion()
  return (
    <Box aria-hidden data-bl-new-glow={size} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {CLUSTER[size].map((s) => (
        <Star key={`${s.cx}-${s.cy}`} {...s} reduce={reduce} />
      ))}
    </Box>
  )
}

export default NewSparkles
