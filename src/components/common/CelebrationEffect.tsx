import React, { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import { Box, SxProps, Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'

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
              {['⭐', '🌟', '✨', '🎊', '🎈', '🏆'][index]}
            </motion.div>
          ))}
        </Box>
      )}
    </AnimatePresence>
  )
}

export default CelebrationEffect

// Hook for managing celebration effects
export const useCelebration = () => {
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationIntensity, setCelebrationIntensity] = useState<'low' | 'medium' | 'high'>('medium')

  const celebrate = (intensity: 'low' | 'medium' | 'high' = 'medium') => {
    setCelebrationIntensity(intensity)
    setShowCelebration(true)
  }

  const stopCelebration = () => {
    setShowCelebration(false)
  }

  return {
    showCelebration,
    celebrationIntensity,
    celebrate,
    stopCelebration
  }
}