import React from 'react'
import { Box } from '@mui/material'
import type { ParallaxLayerSpec } from '../../../theme/tokens/types'

// One parallax scene layer (Theme Worlds PRD §5.3). Renders a single full-bleed image,
// offset by `var(--parallax-x/y) * depth` (set by useParallax on the parent). A constant
// scale(1.06) overscan hides the layer edges as it drifts. Decorative only.

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
        // scale overscan must exceed the max travel (strength * depth) so edges never show.
        transform: `translate3d(calc(var(--parallax-x, 0px) * ${spec.depth}), calc(var(--parallax-y, 0px) * ${spec.depth}), 0) scale(1.12)`,
        willChange: 'transform',
        pointerEvents: 'none',
      }}
    />
  )
}

export default ParallaxLayer
