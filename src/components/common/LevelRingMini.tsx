import React, { useEffect, useRef, useState } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion'
import { useProgress } from '../../hooks/useProgress'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { xpBus } from '../../services/xpBus'
import { useCelebration } from './CelebrationEffect'
import CelebrationEffect from './CelebrationEffect'

// Compact live XP indicator (Liveliness PRD-04): a small filling ring + level number, shown in the
// in-game header (GameShell) and on the section menus so cross-game progress is visible EVERYWHERE.
// It reads the live value from the progress store (useProgress), so switching from one game to
// another keeps the SAME ring climbing. Transient flourish is driven by `xpBus`:
//   • ring "tick"/"pop" on every grant,
//   • a small "+N" flyer that floats up into the ring,
//   • (in-game only, `flourish`) a non-interrupting level-up burst when a grant crosses a level.
// Reduced motion → the ring updates statically (no spring, no flyer, no pop) but the number is live.
// Borrows the ring geometry from ProgressionCompanion; number-only (pre-reader) — no words.

interface LevelRingMiniProps {
  size?: number
  // In-game instance: fire the non-interrupting confetti + fanfare on a mid-game level-up. Menu
  // instances leave this false — the big ceremony (LevelUpOverlay) owns the celebration there.
  flourish?: boolean
  // Phone-landscape: shrink and hide the "+N" flyer so it never fights the title/score row.
  compact?: boolean
  sx?: SxProps<Theme>
}

interface Flyer {
  id: number
  amount: number
}

const LevelRingMini: React.FC<LevelRingMiniProps> = ({ size = 46, flourish = false, compact = false, sx = {} }) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const { globalLevel, xpProgress } = useProgress()
  const controls = useAnimationControls()
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const level = globalLevel()
  const fill = Math.max(0, Math.min(1, xpProgress().fill))

  const [flyers, setFlyers] = useState<Flyer[]>([])
  const flyerId = useRef(0)

  // Ring geometry (mirrors ProgressionCompanion).
  const stroke = Math.max(4, Math.round(size * 0.1))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * (1 - fill)

  const ringColor = theme.scene?.progressionCompanion?.ringColor ?? theme.palette.primary.main
  const dark = theme.scene?.dark
  const trackColor = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)'

  // React to every live grant: tick/pop the ring, spawn a "+N" flyer, and (in-game) burst on a
  // level-up. Reads live-store fill on re-render, so the animation just needs the transient beats.
  useEffect(() => {
    return xpBus.subscribe(({ amount, leveledUp }) => {
      if (!reduce) {
        controls.start({
          scale: leveledUp ? [1, 1.35, 1] : [1, 1.14, 1],
          transition: { duration: leveledUp ? 0.55 : 0.35, ease: 'easeOut' },
        })
        if (amount > 0 && !compact) {
          const id = ++flyerId.current
          setFlyers((f) => [...f, { id, amount }])
          setTimeout(() => setFlyers((f) => f.filter((x) => x.id !== id)), 1000)
        }
      }
      // Non-interrupting mid-game level-up burst (in-game only). The big ceremony is deferred.
      if (leveledUp && flourish) celebrateTier('levelup-mini')
    })
  }, [controls, reduce, compact, flourish, celebrateTier])

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        ...sx,
      }}
      aria-hidden
    >
      <Box
        component={motion.div}
        animate={controls}
        sx={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
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
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
          />
        </svg>
        {/* Level number (pre-reader: the only text). */}
        <Box
          sx={{
            position: 'relative',
            fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
            fontWeight: 800,
            fontSize: Math.round(size * 0.42),
            lineHeight: 1,
            color: dark ? '#FFFFFF' : ringColor,
            textShadow: dark ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 2px rgba(255,255,255,0.6)',
          }}
        >
          {level}
        </Box>
      </Box>

      {/* "+N" flyers — float up into the ring on each grant. */}
      <AnimatePresence>
        {flyers.map((f) => (
          <Box
            key={f.id}
            component={motion.div}
            initial={{ opacity: 0, y: size * 0.55, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: -size * 0.15, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut', times: [0, 0.25, 0.7, 1] }}
            sx={{
              position: 'absolute',
              left: '50%',
              top: 0,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 800,
              fontSize: Math.round(size * 0.4),
              color: ringColor,
              textShadow: '0 1px 4px rgba(0,0,0,0.35), 0 0 8px rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap',
              zIndex: 5,
            }}
          >
            +{f.amount}
          </Box>
        ))}
      </AnimatePresence>

      {/* Non-interrupting mid-game level-up burst (in-game only). */}
      {flourish && (
        <CelebrationEffect
          show={showCelebration}
          intensity={celebrationIntensity}
          duration={celebrationDuration}
          onComplete={stopCelebration}
        />
      )}
    </Box>
  )
}

export default LevelRingMini
