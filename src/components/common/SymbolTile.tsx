import React from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { symbolImages, type SymbolOp } from '../../assets/symbols'
import { symbolInkScale } from '../../assets/symbols/symbolContentBox'

// Soft-3D math symbol tile (Game-Page Rework PRD §C). Renders the bundled operator art
// (`+ − = ? > < × ÷`) so equations read as a tactile "number sentence" instead of flat emoji /
// MUI icons. Decorative by default (aria-hidden) — the games narrate the maths via audio. If a
// glyph is somehow missing it falls back to the operator character so nothing renders blank.
//
// `size` is the rendered GLYPH's largest dimension, not the raw image box: every symbol render sits
// small and centred on a shared 160×87 canvas, so a plain `objectFit:'contain'` into a square box
// delivered only ~a quarter of what the caller asked for (a `<` measured 25×32px inside a 92px box).
// `symbolInkScale` corrects for the per-op ink box — see `assets/symbols/symbolContentBox.ts`.
//
// **A LAYOUT PROBE WILL OVER-REPORT THIS ELEMENT.** The correction is a `transform: scale()`, so the
// LAYOUT box stays `size` (which is what keeps a number-sentence row tightly spaced) while
// `getBoundingClientRect()` returns the *painted* box — the scaled transparent canvas, ~2.5–3× larger.
// A rect-overlap sweep therefore reports collisions with the neighbouring numerals that do not exist.
// To check spacing for real, derive the ink box: it is centred on the element rect and measures
// `rect.width × inkW/160` by `rect.width × inkH/160`. (Measured clean on Plus/Minus at 1024×768,
// 768×1024, 844×390 and 667×375.) The overhang is also why `pointer-events: none` below is load-bearing
// and not tidiness.

interface SymbolTileProps {
  op: SymbolOp
  // The glyph's box — keep it SQUARE (that's what the ink correction assumes; a short-and-wide box
  // would let the scaled ink spill past its top/bottom edge). px or CSS length; default 64.
  size?: number | string
  sx?: SxProps<Theme>
}

const SymbolTile: React.FC<SymbolTileProps> = ({ op, size = 64, sx }) => {
  const src = symbolImages[op]
  // Merge with the array form, never a spread — an `sx` prop may itself be an array or a function
  // (see .claude/rules/responsive-design.md).
  const callerSx = Array.isArray(sx) ? sx : [sx]
  if (!src) {
    // Defensive fallback — should never happen since the registry covers every op.
    return (
      <Box
        component="span"
        aria-hidden
        sx={[{ fontSize: size, fontWeight: 800, lineHeight: 1, color: 'text.secondary' }, ...callerSx]}
      >
        {op}
      </Box>
    )
  }
  // Blow the `contain`-fitted ink back up to the requested box. The shadow is divided by the same
  // factor so it still lands at the intended 3/6px on screen instead of being magnified with the art.
  const ink = symbolInkScale(op)
  return (
    <Box
      component="img"
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      sx={[
        {
          width: size,
          height: size,
          objectFit: 'contain',
          userSelect: 'none',
          // Decorative art, and the ink correction makes the element's PAINTED box ~2.5-3x its layout
          // box — the extra is the render's transparent canvas, measured overhanging 58px into each of
          // Sammenlign's answer tiles. It does NOT currently steal taps there (verified by hit-test:
          // `TactileTile`'s framer layer carries `z-index: 1`, so a neighbouring tile wins the paint
          // and hit order over this `z-index: auto` chain). So this is hygiene for the general case —
          // a neighbour that is NOT z-indexed would be covered by the overhang.
          pointerEvents: 'none',
          transform: ink === 1 ? undefined : `scale(${ink.toFixed(3)})`,
          transformOrigin: 'center',
          filter: `drop-shadow(0 ${(3 / ink).toFixed(2)}px ${(6 / ink).toFixed(2)}px rgba(0,0,0,0.22))`,
          flex: '0 0 auto',
        },
        ...callerSx,
      ]}
    />
  )
}

export default SymbolTile
