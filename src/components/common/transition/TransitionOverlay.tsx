import React, { useRef } from 'react'
import { Box } from '@mui/material'
import { motion, type Easing, type TargetAndTransition } from 'framer-motion'
import { useTransitionContext } from './TransitionProvider'
import { useAmbientSprites } from '../../../hooks/useAmbientSprites'
import { wipeLeaf, wipeRocket, wipeSparkle } from '../../../theme/idleMotion'

// The OPAQUE wipe overlay (Liveliness PRD-02 §1-4). Rendered once in App's host Box, ABOVE pages
// (z1) and mascots (z6) but below the level-up overlay. It only exists while a wipe is in flight
// (renders null at idle → no permanent promoted layer, will-change cleared). The panel paints an
// opaque fill and animates transform / clip-path ONLY — never the page's opacity, never a
// backdrop-filter — so the persistent world is never re-composited underneath (the flicker rules).
//
// The PANEL is the single phase driver: its cover-complete commits the route swap; its
// reveal-complete returns to idle. The signature motif + the mascot usher ride along decoratively.
//
// The MOTIF's idle loops are CSS keyframe animations, not framer `repeat: Infinity` loops (Performance
// PRD-01 W5). They used to be three JS animation loops running DURING the wipe — i.e. during the single
// most timing-sensitive moment in the app, while a route is mounting and lazy chunks are resolving — so
// the decoration was competing for the main thread with the mount it exists to cover. The panel and the
// usher stay on framer: they are one-shot, they drive the phase via `onAnimationComplete`, and their
// geometry is per-variant.

const OVERLAY_Z = 50

const TransitionOverlay: React.FC = () => {
  const ctx = useTransitionContext()
  const phaseRef = useRef<'idle' | 'covering' | 'revealing'>('idle')
  // The signature motif rides on the skin's own baked ambient motes (de-emoji PRD-01 W5) — a star for
  // Rummet's warp, leaves for Dinosaurer's sweep, cloud puffs for Regnbue's iris. Sprites are plain
  // <img> transforms, so the panel stays opaque-paint-only (no backdrop-filter). No art → no motif.
  const sprites = useAmbientSprites()

  if (!ctx) return null
  const { phase, direction, descriptor, reducedFade, withUsher, usherUrl, onCoverComplete, onRevealComplete } = ctx
  phaseRef.current = phase

  if (phase === 'idle') return null

  const back = direction === 'back'
  const variant = reducedFade ? 'fade' : descriptor.variant
  const covering = phase === 'covering'

  // Per-variant geometry: `initial` at mount (cover start), `coverTo` (fully covering, the swap
  // point) and `revealTo` (uncovers along the travel direction). Transforms / clip-path only.
  let initial: TargetAndTransition
  let coverTo: TargetAndTransition
  let revealTo: TargetAndTransition
  let transformOrigin = 'center'

  switch (variant) {
    case 'wave': {
      // Rises from the bottom edge (forward) and recedes back the same way (tide out); back mirrors.
      const enterY = back ? '-100%' : '100%'
      initial = { y: enterY }
      coverTo = { y: '0%' }
      revealTo = { y: enterY }
      break
    }
    case 'leaves': {
      // Sweeps across and continues off the far edge.
      const enterX = back ? '100%' : '-100%'
      const exitX = back ? '-100%' : '100%'
      initial = { x: enterX }
      coverTo = { x: '0%' }
      revealTo = { x: exitX }
      break
    }
    case 'zoom': {
      // Warp: scales up from centre to cover (1.04 so a fractional-DPR seam can't peek), then the
      // field zooms through and out on reveal. Opacity is on the OPAQUE panel (allowed).
      if (!back) {
        initial = { scale: 0.15, opacity: 0 }
        coverTo = { scale: 1.04, opacity: 1 }
        revealTo = { scale: 2.8, opacity: 0 }
      } else {
        initial = { scale: 2.8, opacity: 0 }
        coverTo = { scale: 1.04, opacity: 1 }
        revealTo = { scale: 0.15, opacity: 0 }
      }
      break
    }
    case 'iris': {
      // An opaque rainbow circle grows from the bottom to cover, then irises open (shrinks away).
      transformOrigin = '50% 108%'
      const closed = 'circle(0% at 50% 108%)'
      const open = 'circle(150% at 50% 108%)'
      initial = { clipPath: closed }
      coverTo = { clipPath: open }
      revealTo = { clipPath: closed }
      break
    }
    case 'fade':
    default: {
      initial = { opacity: 0 }
      coverTo = { opacity: 1 }
      revealTo = { opacity: 0 }
      break
    }
  }

  const durationS = covering
    ? reducedFade
      ? 0.08
      : descriptor.coverMs / 1000
    : reducedFade
      ? 0.08
      : descriptor.revealMs / 1000

  const handleComplete = () => {
    if (phaseRef.current === 'covering') onCoverComplete()
    else if (phaseRef.current === 'revealing') onRevealComplete()
  }

  // Leading edge for the wave foam crest (top when rising up, bottom when coming down).
  const crestTop = !back

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: OVERLAY_Z,
        overflow: 'hidden',
        // Swallow taps while covered so a child can't double-navigate through the wipe.
        pointerEvents: 'auto',
        // Layer hints on the ROOT (framer manages the panel's own transform).
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        contain: 'layout paint style',
      }}
    >
      <Box
        component={motion.div}
        initial={initial}
        animate={covering ? coverTo : revealTo}
        transition={{ duration: durationS, ease: descriptor.ease as Easing }}
        onAnimationComplete={handleComplete}
        sx={{
          position: 'absolute',
          inset: 0,
          background: descriptor.color,
          transformOrigin,
          willChange: 'transform, clip-path, opacity',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Signature motif riding the opaque panel (skipped under the reduced fast-fade). */}
        {!reducedFade && descriptor.motif === 'wave' && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              [crestTop ? 'top' : 'bottom']: -6,
              height: 30,
              background:
                'radial-gradient(circle at 12px -6px, rgba(255,255,255,0.9) 12px, transparent 13px) repeat-x',
              backgroundSize: '30px 30px',
              filter: 'drop-shadow(0 2px 4px rgba(255,255,255,0.4))',
              opacity: 0.9,
            }}
          />
        )}
        {!reducedFade && descriptor.motif === 'rocket' && sprites.length > 0 && (
          <Box
            aria-hidden
            {...wipeRocket(reducedFade).props}
            sx={[{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }, wipeRocket(reducedFade).sx]}
          >
            <Box
              component="img"
              src={sprites[0]}
              alt=""
              draggable={false}
              sx={{
                width: 'clamp(3rem, 12vw, 6rem)',
                height: 'clamp(3rem, 12vw, 6rem)',
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
              }}
            />
          </Box>
        )}
        {!reducedFade && descriptor.motif === 'leaves' && sprites.length > 0 && (
          <Box aria-hidden sx={{ position: 'absolute', top: 0, bottom: 0, [back ? 'left' : 'right']: '6%', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
            {[0, 1, 2, 3].map((i) => (
              <Box
                key={i}
                component="img"
                src={sprites[i % sprites.length]}
                alt=""
                draggable={false}
                {...wipeLeaf(reducedFade, i).props}
                sx={[{
                  width: 'clamp(1.8rem, 5.5vw, 2.9rem)',
                  height: 'clamp(1.8rem, 5.5vw, 2.9rem)',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))',
                }, wipeLeaf(reducedFade, i).sx]}
              />
            ))}
          </Box>
        )}
        {!reducedFade && descriptor.motif === 'sparkle' && sprites.length > 0 && (
          <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {[
              { top: '18%', left: '22%', d: 1.1 },
              { top: '32%', left: '72%', d: 1.4 },
              { top: '58%', left: '38%', d: 1.2 },
              { top: '70%', left: '82%', d: 1.5 },
              { top: '46%', left: '58%', d: 1.3 },
            ].map((s, i) => (
              <Box
                key={i}
                component="img"
                src={sprites[i % sprites.length]}
                alt=""
                draggable={false}
                // A baked mote is softer than the ✨ glyph it replaces (Regnbue's is a white cloud puff
                // on a bright gradient), so it rides a little larger and never fades as far down.
                {...wipeSparkle(reducedFade, s.d).props}
                sx={[{
                  position: 'absolute',
                  top: s.top,
                  left: s.left,
                  width: 'clamp(1.9rem, 5.5vw, 3.2rem)',
                  height: 'clamp(1.9rem, 5.5vw, 3.2rem)',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))',
                }, wipeSparkle(reducedFade, s.d).sx]}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Mascot usher — leaps in from the menu mascot's corner during cover, then "leads" the child
          in by sliding off in the travel direction during reveal. Lives + dies with the overlay, so
          it never crosses a compositing boundary or survives the route swap (the flicker-safe rule). */}
      {withUsher && usherUrl && (
        <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: '16%', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <Box
            component={motion.img}
            src={usherUrl}
            alt=""
            draggable={false}
            initial={{ x: -180, y: 150, opacity: 0, rotate: -10, scale: 0.8 }}
            animate={
              covering
                ? { x: 0, y: 0, opacity: 1, rotate: [-10, 6, -4, 0], scale: 1 }
                : descriptor.direction === 'right'
                  ? { x: 360, opacity: 0, rotate: 8 }
                  : descriptor.direction === 'in'
                    ? { scale: 1.7, y: -140, opacity: 0 }
                    : { y: -360, opacity: 0, rotate: -6 }
            }
            transition={{ duration: durationS, ease: 'easeInOut' }}
            style={{
              width: 'clamp(96px, 22vw, 160px)',
              height: 'clamp(96px, 22vw, 160px)',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))',
            }}
          />
        </Box>
      )}
    </Box>
  )
}

export default TransitionOverlay
