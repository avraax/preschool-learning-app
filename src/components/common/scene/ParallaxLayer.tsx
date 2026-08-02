import React from 'react'
import { Box } from '@mui/material'
import type { ParallaxLayerSpec } from '../../../theme/tokens/types'
import { overscanCss, parallaxTravelX, parallaxTravelY } from '../../../config/parallax'

// One parallax scene layer (Theme Worlds PRD §5.3). Renders a single full-bleed image, offset by
// `var(--parallax-x/y) * depth` (set by useParallax on the parent). Decorative only.
//
// OVERSCAN — the layer's box is bled PAST every edge it can drift away from, and the bleed is sized
// from the layer's own maximum travel (`PARALLAX_MAX_* × depth`), never from a fixed number. It used
// to be a constant `scale(1.12)`, i.e. 6% of the viewport: plenty on a 872px-tall iPad (52px vs the
// near layer's 27px of drift) and NOT ENOUGH on a phone in landscape (23px vs 27px) or in portrait
// horizontally (22px vs 36px). Where it fell short the layer slid off its own edge and the layer
// BEHIND showed through — the blue sky flickering in and out along the bottom of the home screen.
// The 6% floor is kept so large screens frame exactly as they did before.
//
// Anchored strips (top/bottom) pin their edge to that side of the viewport and therefore do NOT
// translate vertically and get NO bleed on that side — otherwise the pinned edge lifts off as it
// drifts and exposes a gap of whatever is behind. They still drift sideways.

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

  // `offsetY` slides the art off one edge on top of the drift, so that edge needs the nudge added to
  // its bleed (a % of the container, matching the transform's unit). Only meaningful for center
  // layers — an anchored strip's offset would lift it off the very edge it exists to cover, which is
  // why the near/ground layers carry no offset.
  const nudge = anchor === 'center' ? (spec.offsetY ?? 0) : 0
  const bleedX = overscanCss(parallaxTravelX(spec.depth))
  const bleedY = anchor === 'center' ? overscanCss(parallaxTravelY(spec.depth)) : '0px'
  const vertical = (side: 'top' | 'bottom') => {
    if (anchor === side) return '0px' // pinned: this edge IS the viewport edge
    const extra = side === 'top' ? Math.max(0, nudge) : Math.max(0, -nudge)
    return extra ? `calc(${bleedY} + ${extra}%)` : bleedY
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        top: `calc(${vertical('top')} * -1)`,
        bottom: `calc(${vertical('bottom')} * -1)`,
        left: `calc(${bleedX} * -1)`,
        right: `calc(${bleedX} * -1)`,
        zIndex: index,
        opacity: spec.opacity ?? 1,
        backgroundImage: `url(${url})`,
        backgroundSize,
        backgroundPosition,
        backgroundRepeat: 'no-repeat',
        transform: `translate3d(${tx}, ${ty}, 0)`,
        willChange: 'transform',
        pointerEvents: 'none',
      }}
    />
  )
}

export default ParallaxLayer
