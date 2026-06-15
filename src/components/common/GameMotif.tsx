import React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import { hexToRgba } from '../../theme/tokens/helpers'

// Calm in-game backdrop for FLAT skins only (App-wide UI Uplift). A light CSS accent so a flat
// play screen still has a touch of section identity in the corners.
//
// Immersive skins NO LONGER use this: the active world is rendered once, app-wide, by
// <PersistentWorld/>, which keeps drifting behind the game and fades a dim/blur scrim over
// itself on game routes. So for immersive skins this renders nothing.
//
// Layering: sits at z-index:-1 inside a position:relative root, so it composites above the
// root's own (bright category-gradient) background and behind all in-flow content.

interface GameMotifProps {
  categoryId: string
}

const GameMotif: React.FC<GameMotifProps> = ({ categoryId }) => {
  const theme = useTheme()
  const immersive = theme.scene.layers.length > 0
  const accent = getCategoryTheme(categoryId).accentColor

  // Immersive skins get their dimmed world from <PersistentWorld/>; flat skins without a motif
  // keep today's plain look.
  if (immersive || !theme.materials.motif) return null

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        background: [
          'radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
          `radial-gradient(90% 70% at 100% 100%, ${hexToRgba(accent, 0.16)} 0%, ${hexToRgba(accent, 0)} 55%)`,
          'radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 60%)',
        ].join(', '),
      }}
    />
  )
}

export default GameMotif
