import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { motion } from 'framer-motion'
import type { AmbientMotion } from '../../../theme/tokens/types'
import { useLivingCard } from '../../../hooks/useLivingCard'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { softShadow, contactShadow, usePointerTilt } from '../../../theme/depth'
import { sfx } from '../../../services/sfxClient'
import ThemedBurst, { type ThemedBurstHandle } from '../ThemedBurst'

// SceneObject (Liveliness PRD-05 W1.1) — the tactile soft-3D object that REPLACES the frosted
// <Card> as the tappable unit on home + section menus. It sits directly IN the world (no card
// frame, no glass, no border): a cut-out WebP object casting a soft contact-shadow ellipse, with
// a small reinforcement label. Depth is pure CSS (layered drop-shadows + the contact ellipse +
// an optional pointer-tilt) — no WebGL.
//
// The visual language, in one place (the "spec" is this component + PRD-05 §W1):
//   • Objects are cut-outs that REST in the scene — grounded by a warm, accent-tinted contact
//     ellipse, not floated on a rectangle.
//   • Idle = calm-alive (a gentle CSS breathe, phased by index). Delight is released on tap
//     (squash + themed particle burst + tick).
//   • Motion layers are nested so they never fight: caller positioning → CSS breathe →
//     framer squash → (perspective) pointer-tilt on the art. Matches LivingCard's flicker-safe
//     nesting.
//   • The LABEL is reinforcement only — a non-reader identifies the object by its ART; the label
//     never becomes the sole affordance.
//   • Reduced motion → everything static, but the art + contact shadow + label + audio all stay.

interface SceneObjectProps {
  art: string                  // webp url (section object or per-game icon)
  label: string                // Danish label (reinforcement only — never the sole affordance)
  accent: string               // section accent (label/ring/contact-shadow tint)
  size?: number | string       // object width; clamp-driven default
  index?: number               // phases the idle breathe
  frozen?: boolean             // pause breathe during a wipe / when not foreground
  attract?: boolean            // one-shot wiggle (idle-attract)
  burstMotion: AmbientMotion   // themed particle kind on tap
  shadow?: 'contact' | 'float' // soft grounded contact shadow vs floating
  rotate?: number              // small resting tilt (deg)
  onActivate: () => void
  sx?: SxProps<Theme>          // caller positioning (e.g. absolute left/top for seating)
}

const SceneObject: React.FC<SceneObjectProps> = ({
  art,
  label,
  accent,
  size = 'clamp(84px, 13vh, 132px)',
  index = 0,
  frozen = false,
  attract = false,
  burstMotion,
  shadow = 'contact',
  rotate = 0,
  onActivate,
  sx,
}) => {
  const { breatheSx, controls, bump, wiggle } = useLivingCard({ index, frozen })
  const reduce = useReducedMotion()
  const burstRef = useRef<ThemedBurstHandle>(null)
  const [pressed, setPressed] = useState(false)
  const tilt = usePointerTilt({ strength: 7, disabled: reduce })

  // Idle-attract: one-shot wiggle + gentle burst when the parent flags this object (motion only).
  useEffect(() => {
    if (!attract || reduce) return
    wiggle()
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [attract, reduce, wiggle])

  const handleClick = () => {
    // Audio (the tactile "felt" tick) is kept under reduced motion; squash + burst are skipped.
    sfx.play('card-pop')
    if (!reduce) {
      bump()
      burstRef.current?.fire()
    }
    onActivate()
  }

  const floating = shadow === 'float'

  return (
    // Caller layout/positioning on the outer box; breathe (CSS) and squash (framer) live on
    // SEPARATE nested boxes so their transforms never conflict.
    <Box sx={sx}>
      <Box sx={breatheSx}>
        <Box
          onClick={handleClick}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          {...tilt.handlers}
          onPointerLeave={() => {
            setPressed(false)
            tilt.handlers.onPointerLeave()
          }}
          role="button"
          aria-label={label}
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
        >
          {/* Object + its grounded contact shadow. The shadow sits UNDER the art and shrinks a
              touch on press (the object lifts toward the camera). */}
          <Box sx={{ position: 'relative', width: size, aspectRatio: '1 / 1' }}>
            {/* Soft contact-shadow ellipse — warm, accent-tinted, beneath the object. */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: '50%',
                bottom: floating ? '2%' : '-4%',
                width: floating ? '78%' : '84%',
                height: floating ? '20%' : '15%',
                transform: `translateX(-50%) scale(${pressed && !reduce ? 0.82 : 1})`,
                background: contactShadow(accent, floating ? 0.7 : 1),
                filter: `blur(${floating ? 9 : 5}px)`,
                transition: reduce ? 'none' : 'transform 0.28s ease',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            {/* Framer squash layer — object art only (never the shadow). */}
            <Box
              component={motion.div}
              animate={controls}
              sx={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                perspective: '600px',
              }}
            >
              <Box
                component="img"
                src={art}
                alt=""
                draggable={false}
                sx={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: `${tilt.transform === 'none' ? '' : tilt.transform} rotate(${rotate}deg)`,
                  transition: reduce ? 'none' : 'transform 0.12s ease-out',
                  filter: softShadow(floating ? 2.4 : 1.4),
                  pointerEvents: 'none',
                }}
              />
            </Box>
            {/* Tap / attract burst — rises out of the object and pops (shared ThemedBurst). */}
            <ThemedBurst ref={burstRef} motionKind={burstMotion} originTop="42%" />
          </Box>

          {/* Reinforcement label — a soft accent-tinted pill; art is the real affordance. */}
          <Typography
            aria-hidden
            sx={{
              fontWeight: 700,
              fontSize: 'clamp(0.8rem, 2vh, 1.05rem)',
              lineHeight: 1.1,
              color: accent,
              px: 1.25,
              py: 0.35,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.82)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
              maxWidth: 'min(40vw, 200px)',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default SceneObject
