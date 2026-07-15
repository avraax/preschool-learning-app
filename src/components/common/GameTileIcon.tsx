import React from 'react'
import { Box } from '@mui/material'

// Unified tile-icon language (Liveliness PRD-02 §5). Home section cards use soft-3D icon art;
// section-menu tiles used flat emoji — a visible inconsistency. This renders a soft-3D per-game
// asset from the registry WHEN one exists, else the emoji styled IDENTICALLY (same soft drop
// shadow + size clamp + no-select) so the polish matches immediately. Richer per-game art can land
// incrementally by adding entries to GAME_ICON_IMAGES (assets under src/assets/themes/icons).

// gameId → soft-3D icon asset URL. Empty for now (emoji fallback); populate incrementally.
const GAME_ICON_IMAGES: Record<string, string> = {}

interface GameTileIconProps {
  id: string
  fallbackEmoji: string
}

const GameTileIcon: React.FC<GameTileIconProps> = ({ id, fallbackEmoji }) => {
  const art = GAME_ICON_IMAGES[id]

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
