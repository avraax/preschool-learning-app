import React from 'react'
import { Box } from '@mui/material'
import { idleTwinkle } from '../../../theme/idleMotion'
import { useReducedMotion } from '../../../hooks/useReducedMotion'

// "NEW IN THIS RELEASE" — three small white stars twinkling at the object's top corners (owner,
// 2026-10-17, picked from a 28-variant in-app showcase: "the one on Ram Farven"). It replaced a soft
// gold halo the owner rejected as smudged and too wide. Which items get it is DATA in
// `src/config/newThisRelease.ts`; the stars are inline SVG shapes, never an emoji (CLAUDE.md).
//
// Drawn INSIDE SceneObject's square art box, so the stars scale with the object and never push layout.
// Twinkle = CSS keyframes via `idleTwinkle` (staggered so the three never pulse together); reduced
// motion → the same stars, static.

const STARS = [
  { size: '26%', top: '-6%', left: '78%', delayS: 0 },
  { size: '16%', top: '18%', left: '96%', delayS: 0.6 },
  { size: '14%', top: '-2%', left: '-4%', delayS: 1.1 },
] as const

const STAR_PATH = 'M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z'

const Star: React.FC<(typeof STARS)[number] & { reduce: boolean }> = ({ size, top, left, delayS, reduce }) => {
  const twinkle = idleTwinkle(reduce, { delayS })
  return (
    <Box
      aria-hidden
      {...twinkle.props}
      sx={[
        {
          position: 'absolute',
          top,
          left,
          width: size,
          height: size,
          zIndex: 3,
          pointerEvents: 'none',
          // A white star needs an edge to read on a bright sky: a white bloom plus a faint dark lift.
          filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
        },
        twinkle.sx,
      ]}
    >
      <Box component="svg" viewBox="0 0 24 24" sx={{ display: 'block', width: '100%', height: '100%' }}>
        <path d={STAR_PATH} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.2" />
      </Box>
    </Box>
  )
}

const NewSparkles: React.FC = () => {
  const reduce = useReducedMotion()
  return (
    <Box aria-hidden data-bl-new-glow="" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {STARS.map((s) => (
        <Star key={s.left} {...s} reduce={reduce} />
      ))}
    </Box>
  )
}

export default NewSparkles
