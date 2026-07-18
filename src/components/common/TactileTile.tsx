import React, { useState } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { hexToRgba, tileSurface } from '../../theme/tokens/helpers'
import { softShadow, contactShadow, usePointerTilt } from '../../theme/depth'
import { useLivingCard } from '../../hooks/useLivingCard'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// TactileTile (Liveliness PRD-06 F1) — the shared soft-3D PRESSABLE, the game-board analogue of the
// shell's SceneObject. It merges the app's two weaker tile vocabularies (the "lifted plastic
// button" AnswerTile/memory-card and the "flat candy" swatches) into the shell's CLAY language,
// while KEEPING a clear press affordance (the pedagogy point — a pre-reader must see "I can press
// this"). It reuses the shell's depth helpers verbatim: softShadow / contactShadow / usePointerTilt
// (src/theme/depth.ts) and the flicker-safe nested-motion pattern from SceneObject.
//
// What makes it "clay, not a keyboard key": there is NO hard `0 8px 0` coloured lip and NO thick
// `3px` border. Depth comes from a SEPARATE grounded contact-shadow ellipse beneath the tile +
// a layered `softShadow()` drop-shadow on the surface — exactly the SceneObject recipe, adapted to
// a rounded rectangle. A very thin (1px) low-opacity accent edge is kept only for definition.
//
// Motion layers are nested so their transforms never fight (mirrors SceneObject):
//   outer Box (caller sizing) → framer feedback layer (pop/shake/hint-breathe) → surface Box
//   (CSS :active press-travel) → tilt layer (pointer-tilt) → children. The contact ellipse is a
//   separate sibling that shrinks on press. Reduced motion → everything static, but the surface +
//   contact shadow + content + feedback colour/ring all still render (the state still reads).

// 'selected' = the hear-before-commit "raised" state (PRD-14 W7): a tile the child has auditioned
// and can commit by tapping again. It reads as lifted/outlined (accent), NOT as correct/wrong
// feedback, and stays pressable (a second tap commits). Reduced-motion keeps the outline, drops the lift.
export type TactileTileState = 'idle' | 'correct' | 'wrong' | 'selected'

interface TactileTileProps {
  onActivate?: () => void                       // tap/press (AnswerTile's onClick)
  accent: string                                // section accent: surface tint, contact tint, rings
  state?: TactileTileState                       // feedback (mirrors AnswerTileState)
  hint?: boolean                                 // never-fail hint pulse; active only when state==='idle'
  disabled?: boolean                             // locked during the advance window
  variant?: 'tile' | 'card' | 'chip'            // radius defaults: quiz tile · memory face · small chip
  // Dense grids that must show many rows no-scroll (the 1–100 Lær Tal hundreds-chart): relax the
  // 44px touch floor + heavy padding so each tile fills its (necessarily short) grid row instead of
  // overflowing it and overlapping the row below. Owner-accepted trade-off for the full 100 on one
  // screen; the tap target stays as tall as the row allows.
  compact?: boolean
  interactive?: boolean                          // default true; false = pure display (no press/tilt)
  size?: number | string                         // optional; default fills the caller's grid cell (100%)
  index?: number                                 // phase offset for the optional idle-breathe
  breathe?: boolean                              // opt-in idle-breathe (OFF by default — answer grids don't breathe)
  children: React.ReactNode                      // content: glyph | baked-art <img> | equalizer | swatch
  sx?: SxProps<Theme>
  // Forwarded verbatim to the pressable element (e.g. data-answer-tile / data-tile-state for the
  // screenshot harness). Keeps the AnswerTile DOM contract stable through the refactor.
  domProps?: Record<string, unknown>
}

// A few white sparkle stars that pop out of a correct tile (calmer than AnswerTile's old 8 — the
// balanced-motion register). Positions are fixed (no per-render randomness).
const SPARKLES = [
  { left: '10%', top: '14%', size: 16, delay: 0 },
  { left: '84%', top: '20%', size: 18, delay: 0.06 },
  { left: '50%', top: '-4%', size: 20, delay: 0.03 },
  { left: '16%', top: '78%', size: 14, delay: 0.1 },
  { left: '86%', top: '74%', size: 15, delay: 0.08 },
]

const radiusFor = (variant: 'tile' | 'card' | 'chip'): string =>
  variant === 'chip' ? '16px' : variant === 'card' ? '20px' : '22px'

const TactileTile: React.FC<TactileTileProps> = ({
  onActivate,
  accent,
  state = 'idle',
  hint = false,
  disabled = false,
  variant = 'tile',
  compact = false,
  interactive = true,
  size = '100%',
  index = 0,
  breathe = false,
  children,
  sx,
  domProps,
}) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const success = theme.palette.success.main
  const error = theme.palette.error.main
  const [pressed, setPressed] = useState(false)
  const tilt = usePointerTilt({ strength: 6, disabled: reduce || !interactive })
  const { breatheSx } = useLivingCard({ index })

  // The hint cue only shows on an otherwise-idle tile (a correct/wrong feedback state always wins).
  const showHint = hint && state === 'idle'
  // A raised/auditioned ('selected') tile stays pressable so a second tap commits (PRD-14 W7).
  const canPress = interactive && !disabled && (state === 'idle' || state === 'selected')

  // Surface: soft matte, section-tinted (feedback states tint toward success/error). Reuses the
  // shell's `tileSurface` — the same white→faint-accent gradient the menus use.
  const surface =
    state === 'correct'
      ? `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(success, 0.16)} 100%)`
      : state === 'wrong'
        ? `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(error, 0.1)} 100%)`
        : tileSurface(accent, dark)

  // A hairline accent edge for definition only (NOT a frame). Feedback states tint it; the raised
  // 'selected' state gets a strong accent edge so the auditioned tile reads as "confirm this one".
  const edgeColor =
    state === 'correct'
      ? hexToRgba(success, 0.55)
      : state === 'wrong'
        ? hexToRgba(error, 0.5)
        : state === 'selected'
          ? hexToRgba(accent, dark ? 0.85 : 0.7)
          : hexToRgba(accent, showHint ? (dark ? 0.7 : 0.55) : dark ? 0.4 : 0.26)

  // Depth = grounded contact ellipse (sibling, below) + layered softShadow() on the surface. The
  // top inner-light highlight gives the clay read; a success/hint ring adds the feedback verdict.
  const innerHighlight = `inset 0 2px 3px ${hexToRgba('#FFFFFF', dark ? 0.3 : 0.6)}`
  const ring =
    state === 'correct'
      ? `0 0 0 5px ${hexToRgba(success, 0.45)}`
      : state === 'selected'
        ? `0 0 0 4px ${hexToRgba(accent, dark ? 0.6 : 0.5)}` // steady accent ring (no pulse)
        : showHint
          ? `0 0 0 5px ${hexToRgba(accent, dark ? 0.55 : 0.45)}`
          : null
  const boxShadow = [innerHighlight, ring].filter(Boolean).join(', ')

  // Contact-shadow tint follows the feedback so a correct tile casts a warm success cast.
  const contactTint = state === 'correct' ? success : state === 'wrong' ? error : accent

  // Framer feedback keyframes (balanced register: softer pop, shorter shake than the old tile).
  const animate = reduce
    ? undefined
    : state === 'wrong'
      ? { x: [0, -7, 7, -5, 5, 0] }
      : state === 'correct'
        ? { scale: [1, 1.08, 1] }
        : state === 'selected'
          ? { y: -6, scale: 1.04 } // sustained lift — the auditioned tile "rises" toward the child
          : showHint
            ? { scale: [1, 1.05, 1] }
            : { x: 0, y: 0, scale: 1 } // reset (incl. y so a deselect settles back down)

  const transition =
    state === 'wrong'
      ? { duration: 0.4 }
      : showHint && state === 'idle'
        ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
        : { duration: 0.3, ease: 'easeOut' as const }

  const clearPressed = () => setPressed(false)

  return (
    // Outer Box: caller sizing / grid cell. The breathe (CSS) is opt-in and lives here so it never
    // fights the framer feedback layer below.
    <Box sx={[{ position: 'relative', width: size, height: size }, ...(breathe && !reduce ? [breatheSx] : []), ...(Array.isArray(sx) ? sx : [sx])] as SxProps<Theme>}>
      {/* Grounded contact-shadow ellipse beneath the tile — shrinks on press (the tile settles). */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: '50%',
          bottom: '-6%',
          width: '86%',
          height: '18%',
          transform: `translateX(-50%) scale(${pressed && !reduce ? 0.84 : 1})`,
          background: contactShadow(contactTint, dark ? 1 : 0.9),
          filter: 'blur(6px)',
          transition: reduce ? 'none' : 'transform 0.22s ease',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Framer feedback layer — owns the pop/shake/hint transform. */}
      <Box
        component={motion.div}
        animate={animate}
        transition={transition}
        sx={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', perspective: '600px' }}
      >
        {/* Surface (the clay). Interactive → a real <button>; display-only → a plain box. Press-travel
            is CSS on THIS element (sinks toward the contact shadow); the tilt lives on the child. */}
        <Box
          component={interactive ? motion.button : 'div'}
          {...(interactive ? { type: 'button', onClick: onActivate, disabled } : {})}
          {...domProps}
          onPointerDown={interactive ? () => setPressed(true) : undefined}
          onPointerUp={interactive ? clearPressed : undefined}
          onPointerCancel={interactive ? clearPressed : undefined}
          onPointerLeave={
            interactive
              ? () => {
                  clearPressed()
                  tilt.handlers.onPointerLeave()
                }
              : undefined
          }
          onPointerMove={interactive ? tilt.handlers.onPointerMove : undefined}
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: compact ? '0' : '44px',
            m: 0,
            p: compact ? '2px' : { xs: 1, sm: 1.5, md: 2 },
            [PHONE_LANDSCAPE]: { p: compact ? '1px' : 0.5 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${edgeColor}`,
            borderRadius: radiusFor(variant),
            background: surface,
            boxShadow,
            filter: softShadow(dark ? 1.6 : 1.2),
            cursor: canPress ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
            transition:
              'transform 0.08s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease, border-color 0.2s ease',
            '&:focus-visible': { outline: '3px solid', outlineColor: accent, outlineOffset: '2px' },
            // Tactile press: the surface sinks toward the (shrinking) contact shadow. Only when idle
            // (feedback states hold their own transform via framer so the press doesn't fight it).
            ...(canPress ? { '&:active': { transform: 'translateY(4px)' } } : {}),
          }}
        >
          {/* Tilt layer (non-touch only; inert under reduced-motion / touch / display-only). */}
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: tilt.transform === 'none' ? undefined : tilt.transform,
              transition: reduce ? 'none' : 'transform 0.12s ease-out',
              pointerEvents: 'none',
            }}
          >
            {children}
          </Box>

          {/* Correct-answer sparkles (skipped under reduced motion). Non-interactive. */}
          {state === 'correct' && !reduce && (
            <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
              {SPARKLES.map((s, i) => (
                <Box
                  key={`sparkle-${i}`}
                  component={motion.div}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4] }}
                  transition={{ duration: 0.7, delay: s.delay, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    left: s.left,
                    top: s.top,
                    width: s.size,
                    height: s.size,
                    background:
                      'radial-gradient(circle, #ffffff 0%, rgba(255,247,214,0.95) 45%, rgba(255,210,120,0) 78%)',
                    clipPath:
                      'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
                    filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9))',
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default TactileTile
