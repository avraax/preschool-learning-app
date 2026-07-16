import React from 'react'
import { Box } from '@mui/material'
import type { ParallaxLayerSpec } from '../../../theme/tokens/types'

// One parallax scene layer (Theme Worlds PRD §5.3). Renders a single full-bleed image,
// offset by `var(--parallax-x/y) * depth` (set by useParallax on the parent). A constant
// scale(1.12) overscan hides the layer edges as it drifts. Decorative only.
//
// Anchored strips (top/bottom) pin their edge to that side of the viewport and therefore do NOT
// translate vertically — otherwise the pinned edge lifts off as it drifts and exposes a 1px gap
// of the transparent base (a flickering white line along the bottom). They still drift sideways.

interface ParallaxLayerProps {
  spec: ParallaxLayerSpec
  url: string
  index: number // paint order (back→front)
}

const ParallaxLayer: React.FC<ParallaxLayerProps> = ({ spec, url, index }) => {
  const anchor = spec.anchor ?? 'center'
  const backgroundPosition =
    anchor === 'bottom' ? 'center bottom' : anchor === 'top' ? 'center top' : 'center center'
  // Far/center layers fill (cover); bottom/top strips keep aspect and hug their edge.
  const backgroundSize = anchor === 'center' ? 'cover' : '100% auto'
  const transformOrigin = anchor === 'bottom' ? 'center bottom' : anchor === 'top' ? 'center top' : 'center'

  // Horizontal drift for every layer; vertical drift only for center layers (anchored strips
  // stay pinned to their edge so they never expose a gap there). A static `offsetY` (% of the
  // layer height, − = up) is added so independently-generated layers can be lined up.
  const tx = `calc(var(--parallax-x, 0px) * ${spec.depth})`
  const drift = anchor === 'center' ? `calc(var(--parallax-y, 0px) * ${spec.depth})` : '0px'
  // NB: format the sign explicitly — `calc(x + -7%)` is INVALID CSS (drops the whole transform);
  // it must be `calc(x - 7%)`.
  const ty = spec.offsetY
    ? `calc(${drift} ${spec.offsetY < 0 ? '-' : '+'} ${Math.abs(spec.offsetY)}%)`
    : drift

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: index,
        opacity: spec.opacity ?? 1,
        backgroundImage: `url(${url})`,
        backgroundSize,
        backgroundPosition,
        backgroundRepeat: 'no-repeat',
        transformOrigin,
        // scale overscan must exceed the max horizontal travel (strength * depth) so edges never show.
        transform: `translate3d(${tx}, ${ty}, 0) scale(1.12)`,
        willChange: 'transform',
        pointerEvents: 'none',
      }}
    />
  )
}

export default ParallaxLayer
