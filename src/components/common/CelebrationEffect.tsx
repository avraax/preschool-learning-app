import React, { useEffect, useState } from 'react'
import Confetti from 'react-confetti'
import { Box, SxProps, Theme } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import LottieCharacter, { CharacterType } from './LottieCharacter'

interface CelebrationEffectProps {
  show: boolean
  onComplete?: () => void
  character?: CharacterType
  confettiColors?: string[]
  duration?: number
  sx?: SxProps<Theme>
  intensity?: 'low' | 'medium' | 'high'
}

const CelebrationEffect: React.FC<CelebrationEffectProps> = ({
  show,
  onComplete,
  character = 'bear',
  confettiColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'],
  duration = 3000,
  intensity = 'medium',
  sx = {}
}) => {
  const [showConfetti, setShowConfetti] = useState(false)
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

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
      setShowConfetti(true)
      const timer = setTimeout(() => {
        setShowConfetti(false)
        onComplete?.()
      }, duration)

      return () => clearTimeout(timer)
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
              colors={confettiColors}
              {...confettiConfig}
            />
          )}

          {/* Celebrating Character */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 25
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto'
            }}
          >
            <LottieCharacter
              character={character}
              state="celebrate"
              size={150}
              loop={true}
              autoplay={true}
            />
          </motion.div>

          {/* Success Text Animation */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{
              position: 'absolute',
              top: '60%',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#4caf50',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              pointerEvents: 'none'
            }}
          >
            🎉 Rigtig godt! 🎉
          </motion.div>

          {/* Floating Success Emojis */}
          {[...Array(6)].map((_, index) => (
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