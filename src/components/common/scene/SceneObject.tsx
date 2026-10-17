import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import type { AmbientMotion } from '../../../theme/tokens/types'
import { useLivingCard } from '../../../hooks/useLivingCard'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { softShadow, contactShadow, usePointerTilt } from '../../../theme/depth'
import { hexToRgba } from '../../../theme/tokens/helpers'
import { idleGlow } from '../../../theme/idleMotion'
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
  // "New in this release" (`src/config/newThisRelease.ts`): a warm halo behind the object that BREATHES
  // in brightness but never fades out — it is always there for the whole release. CSS keyframes
  // (`idleGlow`), so it costs nothing in JS; reduced motion → the same halo, static.
  isNew?: boolean
}

// The new-glow's range: dim → bright, never invisible (owner: it must not stop or fade away).
const NEW_GLOW = { from: 0.55, to: 1, durationS: 3.2 } as const

const SceneObject: React.FC<SceneObjectProps> = ({
  art,
  label,
  accent,
  size = 'clamp(96px, 15vh, 150px)',
  index = 0,
  frozen = false,
  attract = false,
  burstMotion,
  shadow = 'contact',
  rotate = 0,
  onActivate,
  sx,
  isNew = false,
}) => {
  const theme = useTheme()
  const dark = theme.scene.dark
  const { breatheSx, controls, bump, wiggle } = useLivingCard({ index, frozen })
  const reduce = useReducedMotion()
  const burstRef = useRef<ThemedBurstHandle>(null)
  const [pressed, setPressed] = useState(false)
  const tilt = usePointerTilt({ strength: 7, disabled: reduce })
  const newGlow = idleGlow(reduce || !isNew, NEW_GLOW)

  // Idle-attract: one-shot wiggle + gentle burst when the parent flags this object (motion only).
  useEffect(() => {
    if (!attract || reduce) return
    wiggle()
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [attract, reduce, wiggle])

  const handleClick = () => {
    // No sound here: `onActivate` starts the wipe, whose travel cue is the hop's one sound.
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
            {/* NEW-IN-THIS-RELEASE halo — warm gold, wider than the light-pool and behind it, so the
                object reads as "lit up" rather than recoloured. Opacity-only keyframes (compositor). */}
            {isNew && (
              <Box
                aria-hidden
                data-bl-new-glow=""
                {...newGlow.props}
                sx={[
                  {
                    position: 'absolute',
                    left: '50%',
                    top: '46%',
                    width: '185%',
                    height: '185%',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    // A near-white core + saturated gold rim: it has to stand out from the section's own
                    // accent light-pool, which on Farver og Krea is already a warm orange.
                    background: `radial-gradient(circle, ${hexToRgba('#FFFBE0', 0.95)} 0%, ${hexToRgba('#FFE066', 0.8)} 30%, ${hexToRgba('#FFC21F', 0.45)} 50%, ${hexToRgba('#FFC21F', 0)} 70%)`,
                    filter: 'blur(5px)',
                    opacity: reduce ? 0.85 : NEW_GLOW.to,
                    zIndex: 0,
                    pointerEvents: 'none',
                  },
                  newGlow.sx,
                ]}
              />
            )}
            {/* Grounding light-pool: a soft glow behind the object that SEATS it (a pool of light
                it rests in) and lifts it off busy or empty backdrops so it reads as the hero, not
                a pasted icon. Warm-white core → accent-tinted edge; brighter on dark worlds. */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: '50%',
                top: '48%',
                transform: 'translate(-50%, -50%)',
                width: '132%',
                height: '132%',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${hexToRgba('#FFFFFF', dark ? 0.32 : 0.5)} 0%, ${hexToRgba(accent, 0.18)} 36%, ${hexToRgba(accent, 0)} 66%)`,
                filter: 'blur(7px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
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
