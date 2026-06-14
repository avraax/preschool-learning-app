import React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// Tactile soft-3D answer tile (Game-Page Rework PRD §B) — replaces the flat white answer Card.
// Pure CSS: a soft top-light gradient over white (kept high-contrast for the glyph), a themed
// accent border + a coloured "edge/lip" beneath it (the 3D depth), a layered drop shadow that
// deepens on dark scenes, a pressed `:active` state, and a focus ring. Feedback states:
//   correct → green glow + a little sparkle pop
//   wrong   → a quick shake (framer-motion)
// The content glyph (number/letter/emoji/word) is passed as children — typography unchanged.
// Reduced motion → no shake/sparkle (the colour/glow still communicates the result).

export type AnswerTileState = 'idle' | 'correct' | 'wrong'

interface AnswerTileProps {
  onClick: () => void
  accent: string
  state?: AnswerTileState
  disabled?: boolean
  children: React.ReactNode
}

// A few sparkles that pop out of a correct tile. Positions are fixed (no per-render randomness).
const SPARKLES = [
  { left: '8%', top: '12%', size: 16, delay: 0 },
  { left: '82%', top: '18%', size: 20, delay: 0.06 },
  { left: '50%', top: '-6%', size: 22, delay: 0.03 },
  { left: '14%', top: '76%', size: 14, delay: 0.1 },
  { left: '86%', top: '72%', size: 16, delay: 0.08 },
]

const AnswerTile: React.FC<AnswerTileProps> = ({ onClick, accent, state = 'idle', disabled = false, children }) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const success = theme.palette.success.main
  const error = theme.palette.error.main

  const lip = darken(accent, 0.3) // coloured 3D rim under the tile
  const ambientShadow = dark ? '0 12px 28px rgba(0,0,0,0.5)' : '0 10px 22px rgba(0,0,0,0.15)'

  // Border + edge colour shift with the feedback state so correct/wrong read instantly.
  const borderColor =
    state === 'correct' ? success : state === 'wrong' ? error : hexToRgba(accent, dark ? 0.55 : 0.34)
  const edgeColor = state === 'correct' ? darken(success, 0.28) : state === 'wrong' ? darken(error, 0.25) : lip

  const restingShadow =
    state === 'correct'
      ? `0 0 0 4px ${hexToRgba(success, 0.45)}, 0 7px 0 ${edgeColor}, 0 14px 30px ${hexToRgba(success, 0.4)}`
      : `0 7px 0 ${edgeColor}, ${ambientShadow}`

  const surface =
    state === 'correct'
      ? `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(success, 0.16)} 100%)`
      : state === 'wrong'
        ? `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(error, 0.1)} 100%)`
        : 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)'

  const animate = reduce
    ? undefined
    : state === 'wrong'
      ? { x: [0, -9, 9, -7, 7, 0] }
      : state === 'correct'
        ? { scale: [1, 1.06, 1] }
        : { x: 0, scale: 1 }

  const transition = state === 'wrong' ? { duration: 0.45 } : { duration: 0.3, ease: 'easeOut' as const }

  return (
    <Box
      component={motion.button}
      type="button"
      onClick={onClick}
      disabled={disabled}
      animate={animate}
      transition={transition}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        p: { xs: 1.5, sm: 2, md: 2.5 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '3px solid',
        borderColor,
        borderRadius: '18px',
        background: surface,
        boxShadow: restingShadow,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'box-shadow 0.2s ease, transform 0.08s ease, border-color 0.2s ease',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: accent,
          outlineOffset: '2px',
        },
        // Tactile press: the tile sinks onto its edge (only when idle — feedback states hold
        // their own shadow so the press doesn't fight the glow/shake).
        ...(state === 'idle' && !disabled
          ? {
              '&:active': {
                transform: 'translateY(5px)',
                boxShadow: `0 2px 0 ${edgeColor}, ${dark ? '0 4px 10px rgba(0,0,0,0.5)' : '0 4px 8px rgba(0,0,0,0.18)'}`,
              },
              '@media (hover: hover) and (pointer: fine)': {
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 9px 0 ${edgeColor}, 0 14px 30px ${hexToRgba(accent, 0.34)}`,
                },
              },
            }
          : {}),
      }}
    >
      {children}

      {/* Sparkle pop on a correct answer (skipped under reduced motion). Non-interactive. */}
      {state === 'correct' && !reduce && (
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
          {SPARKLES.map((s, i) => (
            <Box
              key={i}
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
  )
}

export default AnswerTile
