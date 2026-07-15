import React from 'react'
import { Box } from '@mui/material'
import { gameIconImages } from '../../assets/themes/icons'

// Unified tile-icon language (Liveliness PRD-02 §5, re-keyed by PRD-05 W4.1). Home section cards
// use soft-3D icon art; section-menu tiles used flat emoji — a visible inconsistency. This renders
// a soft-3D per-game asset from the registry WHEN one exists, else the emoji styled IDENTICALLY
// (same soft drop shadow + size clamp + no-select) so the polish matches immediately.
//
// The registry (`gameIconImages`, in src/assets/themes/icons) is keyed COLLISION-FREE by
// `<section>.<id>` — the bare game.id collides (alphabet.memory10 vs math.memory10). Callers pass
// BOTH `section` and `id`; this builds the key. Richer per-game art lands incrementally by adding
// entries to `gameIconImages` (batch B2) — any missing key falls back to the emoji, so partial
// population is safe.

interface GameTileIconProps {
  section: string
  id: string
  fallbackEmoji: string
}

const GameTileIcon: React.FC<GameTileIconProps> = ({ section, id, fallbackEmoji }) => {
  const art = gameIconImages[`${section}.${id}`]

  if (art) {
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

  return (
    <Box
      aria-hidden
      sx={{
        fontSize: 'clamp(1.8rem, 5vh, 2.8rem)',
        lineHeight: 1,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.22))',
        userSelect: 'none',
      }}
    >
      {fallbackEmoji}
    </Box>
  )
}

export default GameTileIcon
