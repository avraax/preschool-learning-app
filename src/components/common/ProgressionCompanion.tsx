import React from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { LEVEL_UP_TAP, levelUpLine } from '../../config/danish-phrases'

// The child-facing growth display (Liveliness PRD-01): a filling XP ring wrapped around a small
// companion that grows in discrete stages, plus a level-number badge. Glanceable "I'm growing" for
// a pre-reader. Used on the home page (tappable → speaks the level) and, enlarged, inside the
// level-up ceremony. Token-driven (theme.scene.progressionCompanion) with a generic default so flat
// skins fall back gracefully. Reduced motion → renders statically (no growth pop / ring spring).

// Generic default companion (a plant that blooms) — theme-neutral, matches the "world bloom" idea.
export const COMPANION_DEFAULT_STAGES = ['🌱', '🌿', '🌷', '🌳', '🌟'] as const

// Companion grows one stage every ~3 levels, clamped to the available stages.
export const companionStageForLevel = (level: number, stageCount: number): number =>
  Math.max(0, Math.min(stageCount - 1, Math.floor((Math.max(1, level) - 1) / 3)))

interface ProgressionCompanionProps {
  size?: number
  // Overrides for the level-up ceremony (else read live from the store).
  level?: number
  fill?: number
  stage?: number
  showBadge?: boolean
  interactive?: boolean // tappable → speaks "Du er på trin {n}!" (home). Default true.
  // A one-shot growth pop (the ceremony sets this when the stage advances).
  celebrating?: boolean
  sx?: SxProps<Theme>
}

const ProgressionCompanion: React.FC<ProgressionCompanionProps> = ({
  size = 96,
  level: levelProp,
  fill: fillProp,
  stage: stageProp,
  showBadge = true,
  interactive = true,
  celebrating = false,
  sx = {},
}) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const { globalLevel, xpProgress } = useProgress()
  const audio = useSimplifiedAudioHook({ componentId: 'ProgressionCompanion', autoInitialize: false })

  const level = levelProp ?? globalLevel()
  const fill = Math.max(0, Math.min(1, fillProp ?? xpProgress().fill))

  const stages = theme.scene?.progressionCompanion?.stages ?? [...COMPANION_DEFAULT_STAGES]
  const stage = stageProp ?? companionStageForLevel(level, stages.length)
  const face = stages[Math.max(0, Math.min(stages.length - 1, stage))]

  const ringColor = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  const dark = theme.scene?.dark
  const trackColor = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'

  // SVG ring geometry.
  const stroke = Math.max(5, Math.round(size * 0.08))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * (1 - fill)

  const handleTap = () => {
    if (!interactive) return
    try {
      audio.updateUserInteraction()
      audio.speak(levelUpLine(LEVEL_UP_TAP, level)).catch(() => {})
    } catch {
      /* audio best-effort */
    }
  }

  return (
    <Box
      component={motion.div}
      onClick={interactive ? handleTap : undefined}
      initial={false}
      animate={reduce ? undefined : celebrating ? { scale: [1, 1.18, 1] } : undefined}
      transition={reduce ? undefined : { duration: 0.7, ease: 'easeOut' }}
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flex: '0 0 auto',
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...sx,
      }}
    >
      {/* XP ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: dash }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
        />
      </svg>

      {/* Companion face (emoji default; an <img> when the stage is an asset URL) */}
      <Box
        key={`stage-${stage}`}
        component={motion.div}
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 16 }}
        sx={{
          fontSize: size * 0.5,
          lineHeight: 1,
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.28))',
        }}
      >
        {typeof face === 'string' && /^(https?:|\/|data:)/.test(face) ? (
          <Box component="img" src={face} alt="" draggable={false} sx={{ width: size * 0.56, height: size * 0.56, objectFit: 'contain' }} />
        ) : (
          face
        )}
      </Box>

      {/* Level-number badge */}
      {showBadge && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -Math.round(size * 0.04),
            right: -Math.round(size * 0.04),
            minWidth: Math.round(size * 0.34),
            height: Math.round(size * 0.34),
            px: 0.5,
            borderRadius: '999px',
            bgcolor: ringColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
            fontSize: Math.round(size * 0.2),
            lineHeight: 1,
            border: '2px solid #fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {level}
        </Box>
      )}
    </Box>
  )
}

export default ProgressionCompanion
