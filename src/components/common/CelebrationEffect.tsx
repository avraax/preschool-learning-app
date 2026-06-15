import React, { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import { Box, SxProps, Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx, type SfxCue } from '../../services/sfxClient'

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
  // Themed reward emojis: match the active world's ambient style (stars for space, bubbles for
  // ocean, leaves for dino, sparkles otherwise). Flat skins keep the classic celebration set.
  const celebrationEmojis = React.useMemo<string[]>(() => {
    if (!theme.scene.layers.length) return ['⭐', '🌟', '✨', '🎊', '🎈', '🏆']
    switch (theme.scene.ambient.motion) {
      case 'twinkle': return ['⭐', '🌟', '✨', '💫', '🌠', '🚀']
      case 'rise': return ['🫧', '✨', '🐠', '🌊', '⭐', '🐚']
      case 'fall': return ['🍃', '🍂', '✨', '🌿', '⭐', '🦋']
      case 'drift':
      default: return ['⭐', '🌟', '✨', '🌈', '🎈', '🎊']
    }
  }, [theme.scene])
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
          numberOfPieces: 200,
          recycle: false,
          gravity: 0.2
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


          {/* Floating Success Emojis */}
          {!reduceMotion && [...Array(6)].map((_, index) => (
            <motion.div
              key={index}
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
                fontSize: '2rem',
                pointerEvents: 'none'
              }}
            >
              {celebrationEmojis[index]}
            </motion.div>
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
export type CelebrationTier = 'micro' | 'streak' | 'round' | 'best' | 'sticker' | 'page'

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
}

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

  // Tiered celebration: sets the matching confetti + fires the tier's SFX cue.
  const celebrateTier = (tier: CelebrationTier) => {
    const t = TIER_MAP[tier]
    setCelebrationIntensity(t.intensity)
    setCelebrationDuration(t.duration)
    setShowCelebration(true)
    sfx.play(t.sfx)
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