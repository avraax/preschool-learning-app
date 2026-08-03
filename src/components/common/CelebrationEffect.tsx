import React, { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import { Box, SxProps, Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx, type SfxCue } from '../../services/sfxClient'
import { useAmbientSprites } from '../../hooks/useAmbientSprites'

interface CelebrationEffectProps {
  show: boolean
  onComplete?: () => void
  confettiColors?: string[]
  duration?: number
  sx?: SxProps<Theme>
  intensity?: 'low' | 'medium' | 'high'
}

const CelebrationEffect: React.FC<CelebrationEffectProps> = ({
  show,
  onComplete,
  confettiColors,
  duration = 3000,
  intensity = 'medium',
  sx = {}
}) => {
  const theme = useTheme()
  // Default confetti palette comes from the active theme; callers can still override.
  const effectiveConfettiColors = confettiColors ?? theme.decor.confettiColors
  // The flying particles are the active world's own baked ambient motes (de-emoji PRD-01 W5): stars
  // for Rummet, bubbles for Havet, leaves for Dinosaurer, cloud puffs for Regnbue — so a celebration
  // bursts in the art of the world it happens in. A skin with no world art shows paper confetti only
  // (there is no emoji fallback by design — D5).
  const sprites = useAmbientSprites()
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  // Honour the OS "reduce motion" setting: keep the reward (audio + score) but skip the
  // heavy confetti/flying-emoji animation.
  const reduceMotion = React.useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    []
  )

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (show) {
      if (!reduceMotion) setShowConfetti(true)
      const timer = setTimeout(() => {
        setShowConfetti(false)
        onComplete?.()
      }, duration)

      return () => clearTimeout(timer)
    } else {
      // Immediately stop confetti when show becomes false
      setShowConfetti(false)
    }
  }, [show, duration, onComplete])

  // Confetti configuration based on intensity
  const getConfettiConfig = () => {
    switch (intensity) {
      case 'low':
        return {
          numberOfPieces: 50,
          recycle: false,
          gravity: 0.3
        }
      case 'high':
        return {
          numberOfPieces: 320,
          recycle: false,
          gravity: 0.18
        }
      case 'medium':
      default:
        return {
          numberOfPieces: 100,
          recycle: false,
          gravity: 0.25
        }
    }
  }

  const confettiConfig = getConfettiConfig()

  return (
    <AnimatePresence>
      {show && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9999,
            ...sx
          }}
        >
          {/* Confetti Effect */}
          {showConfetti && (
            <Confetti
              width={windowDimensions.width}
              height={windowDimensions.height}
              colors={effectiveConfettiColors}
              {...confettiConfig}
            />
          )}


          {/* Floating success motes — the skin's baked ambient sprites, more of them for the bigger
              tiers. No art (unregistered skin) → the paper confetti carries the moment alone. */}
          {!reduceMotion && sprites.length > 0 &&
            [...Array(intensity === 'high' ? 12 : intensity === 'low' ? 4 : 7)].map((_, index) => (
              <motion.img
                key={index}
                src={sprites[index % sprites.length]}
                alt=""
                aria-hidden
                draggable={false}
                initial={{
                  x: Math.random() * windowDimensions.width,
                  y: windowDimensions.height + 50,
                  scale: 0
                }}
                animate={{
                  y: -50,
                  scale: [0, 1, 1, 0],
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 3,
                  delay: index * 0.2,
                  ease: "easeOut"
                }}
                style={{
                  position: 'absolute',
                  // Sized like the 2rem glyph it replaces, with a little per-mote variety.
                  width: `calc(clamp(30px, 6vw, 46px) * ${[1, 0.82, 1.14][index % 3]})`,
                  height: `calc(clamp(30px, 6vw, 46px) * ${[1, 0.82, 1.14][index % 3]})`,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.28))',
                  pointerEvents: 'none'
                }}
              />
            ))}
        </Box>
      )}
    </AnimatePresence>
  )
}

export default CelebrationEffect

// Escalating juice tiers (Overhaul Foundation — System 5). Each tier maps to a confetti
// intensity + duration and fires its matching SFX cue, so big moments feel bigger than the
// per-answer "micro" sparkle. Reduced-motion is handled inside CelebrationEffect (the SFX +
// score still land; the heavy animation is skipped).
export type CelebrationTier =
  | 'micro'
  | 'streak'
  | 'round'
  | 'best'
  | 'sticker'
  | 'page'
  | 'levelup'
  | 'levelup-mini'

const TIER_MAP: Record<
  CelebrationTier,
  { intensity: 'low' | 'medium' | 'high'; duration: number; sfx: SfxCue }
> = {
  micro: { intensity: 'low', duration: 1200, sfx: 'correct' },
  streak: { intensity: 'medium', duration: 1600, sfx: 'streak-up' },
  round: { intensity: 'high', duration: 2600, sfx: 'round-complete' },
  best: { intensity: 'high', duration: 2200, sfx: 'star' },
  sticker: { intensity: 'medium', duration: 2000, sfx: 'sticker-reveal' },
  page: { intensity: 'high', duration: 3400, sfx: 'page-complete' },
  // The biggest moment — a global level-up (Liveliness PRD-01). Longest, most confetti + fanfare.
  levelup: { intensity: 'high', duration: 3400, sfx: 'level-up' },
  // A level-up crossed MID-GAME (Liveliness PRD-04): a short, non-interrupting burst + fanfare that
  // never stops play. The BIG ceremony (`levelup`) is deferred to the result screen / next menu.
  'levelup-mini': { intensity: 'medium', duration: 1600, sfx: 'level-up' },
}

// FOUR OF THESE TIERS NOW HAVE NO CALL SITES: `round`, `best`, `sticker` (dead since the reveal moved
// into RewardOverlay) and, as of Reward Pacing PRD-01 D7, `levelup-mini` — the mid-game crossing is a
// soft `sfx.play('sticker-reveal')` in RewardRing now, not a confetti burst.
//
// DELIBERATELY NOT PRUNED here (PRD §7). `celebrateTier` is public API across every game, the map is
// the documentation of what tiers MEAN, and removing entries is a separate and wider cleanup that
// should be done in one pass with the call-site audit — not as a side effect of a pacing change.
// Recorded so the next person doesn't read the silence as "these are used somewhere".

// Hook for managing celebration effects
export const useCelebration = () => {
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationIntensity, setCelebrationIntensity] = useState<'low' | 'medium' | 'high'>('medium')
  const [celebrationDuration, setCelebrationDuration] = useState<number>(3000)

  const celebrate = (intensity: 'low' | 'medium' | 'high' = 'medium') => {
    setCelebrationIntensity(intensity)
    setCelebrationDuration(3000)
    setShowCelebration(true)
  }

  // Tiered celebration: sets the matching confetti + fires the tier's SFX cue. `sfxRate` lets a
  // caller ascend the pitch (e.g. streak chimes rising with the streak length).
  const celebrateTier = (tier: CelebrationTier, opts?: { sfxRate?: number }) => {
    const t = TIER_MAP[tier]
    setCelebrationIntensity(t.intensity)
    setCelebrationDuration(t.duration)
    setShowCelebration(true)
    sfx.play(t.sfx, opts?.sfxRate != null ? { rate: opts.sfxRate } : {})
  }

  const stopCelebration = () => {
    setShowCelebration(false)
  }

  return {
    showCelebration,
    celebrationIntensity,
    celebrationDuration,
    celebrate,
    celebrateTier,
    stopCelebration
  }
}