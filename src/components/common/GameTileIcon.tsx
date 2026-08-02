import React from 'react'
import { Box } from '@mui/material'
import { gameIconImages } from '../../assets/themes/icons/games'

// Unified tile-icon language (Liveliness PRD-02 §5, re-keyed by PRD-05 W4.1). Home section cards
// and section-menu tiles both render the same soft-3D icon art.
//
// The registry (`gameIconImages`, in src/assets/themes/icons) is keyed COLLISION-FREE by
// `<section>.<id>` — the bare game.id collides (alphabet.memory vs math.memory). Callers pass
// BOTH `section` and `id`; this builds the key.
//
// There is NO emoji fallback any more (de-emoji PRD-01 W4 / D5): all 24 keys resolve, so the
// fallback was dead, and a missing render must leave a hole rather than a flat OS glyph —
// the hole is visible in review, an emoji silently ships. `gameIcons.test.ts` asserts coverage.

interface GameTileIconProps {
  section: string
  id: string
}

const GameTileIcon: React.FC<GameTileIconProps> = ({ section, id }) => {
  const art = gameIconImages[`${section}.${id}`]
  if (!art) return null

  return (
    <Box
      component="img"
      src={art}
      alt=""
      draggable={false}
      sx={{
        display: 'block',
        width: 'clamp(2.4rem, 6vh, 3.4rem)',
        height: 'clamp(2.4rem, 6vh, 3.4rem)',
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))',
        userSelect: 'none',
      }}
    />
  )
}

export default GameTileIcon
