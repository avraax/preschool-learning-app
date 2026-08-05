import React, { useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import type { ParallaxLayerSpec } from '../../../theme/tokens/types'
import { overscanCss, parallaxTravelX, parallaxTravelY, shouldPromoteLayer } from '../../../config/parallax'
import { registerParallaxTarget } from './parallaxTargets'
import { perfProfile } from '../../../config/perfProfile'

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
  //
  // The `transform` is written per frame by `useParallax` straight onto this element, via the
  // registration below — it used to be a `calc(var(--parallax-x) * depth)` in the stylesheet, which
  // made the transform un-compositable and invalidated the whole subtree on every write (the
  // measurement is in `parallaxTargets.ts`). The maths is unchanged: same depths, same amplitudes,
  // same sign handling for `offsetY` (`calc(x + -7%)` is INVALID CSS and drops the whole transform).

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

  // PROMOTION — "only promote what actually moves" (Performance PRD-01 W2.2). A full-bleed layer is a
  // ~22 MB compositing texture at dpr 2, and the far layer (depth 0.14) travels at most ~6px in total.
  // Below `PROMOTE_MIN_TRAVEL_PX` it gets NO transform and NO `will-change` — it is a static backdrop,
  // which is what it always looked like. The overscan is unchanged either way, so the box and therefore
  // the framing are pixel-identical; the threshold lives in `config/parallax.ts` beside the travel and
  // overscan derivation so those three can never disagree.
  //
  // `offsetY` is the exception: it is a STATIC art nudge, not drift, so a layer that carries one still
  // needs its transform even when it doesn't move.
  // "Flydende grafik" off → promote and translate every layer as before. Compositing ONLY: the
  // overscan is computed above either way, so the layer's box and the framing are identical.
  const promote = perfProfile().promoteOnlyMovingLayers ? shouldPromoteLayer(spec.depth) : true
  const needsStaticNudge = !promote && anchor === 'center' && !!spec.offsetY

  // Only a promoted layer registers with the driver; a de-promoted one is a static backdrop and its
  // (nudge-only) transform is plain CSS below.
  const elRef = useRef<HTMLDivElement>(null)
  const driftY = anchor === 'center'
  const offsetYPct = anchor === 'center' ? (spec.offsetY ?? 0) : 0
  useEffect(() => {
    const el = elRef.current
    if (!promote || !el) return
    return registerParallaxTarget({ el, depth: spec.depth, driftY, offsetYPct })
  }, [promote, spec.depth, driftY, offsetYPct])

  return (
    <Box
      ref={elRef}
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
        // A promoted layer's transform is owned by the driver (written on the element per frame), so
        // it must NOT also be declared here — an sx `transform` would fight the inline write on every
        // re-render. `will-change` stays: this one genuinely moves every frame.
        ...(promote
          ? { willChange: 'transform' }
          : needsStaticNudge
            ? { transform: `translate3d(0, ${spec.offsetY! < 0 ? '-' : ''}${Math.abs(spec.offsetY!)}%, 0)` }
            : {}),
        pointerEvents: 'none',
      }}
    />
  )
}

export default ParallaxLayer
