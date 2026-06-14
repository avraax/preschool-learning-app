import React from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { symbolImages, type SymbolOp } from '../../assets/symbols'

// Soft-3D math symbol tile (Game-Page Rework PRD §C). Renders the bundled operator art
// (`+ − = ? > < × ÷`) so equations read as a tactile "number sentence" instead of flat emoji /
// MUI icons. Decorative by default (aria-hidden) — the games narrate the maths via audio. If a
// glyph is somehow missing it falls back to the operator character so nothing renders blank.

interface SymbolTileProps {
  op: SymbolOp
  size?: number | string   // rendered glyph box (px or CSS length); default 64
  sx?: SxProps<Theme>
}

const SymbolTile: React.FC<SymbolTileProps> = ({ op, size = 64, sx }) => {
  const src = symbolImages[op]
  if (!src) {
    // Defensive fallback — should never happen since the registry covers every op.
    return (
      <Box
        component="span"
        aria-hidden
        sx={{ fontSize: size, fontWeight: 800, lineHeight: 1, color: 'text.secondary', ...sx }}
      >
        {op}
      </Box>
    )
  }
  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        userSelect: 'none',
        filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.22))',
        flex: '0 0 auto',
        ...sx,
      }}
    />
  )
}

export default SymbolTile
