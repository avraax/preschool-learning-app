import React, { useEffect, useRef } from 'react'
import Lottie, { LottieRefCurrentProps } from 'lottie-react'
import { Box, SxProps, Theme } from '@mui/material'
import { useInView } from 'react-intersection-observer'

// Character types and states
export type CharacterType = 'bear' | 'owl' | 'fox' | 'rabbit'
export type CharacterState = 'idle' | 'wave' | 'celebrate' | 'encourage' | 'thinking' | 'point'

// Animation data - In a real app, these would be imported from Lottie JSON files
// For now, we'll use placeholders and simple CSS animations as fallback
const getAnimationData = (_character: CharacterType, _state: CharacterState) => {
  // This would normally return the actual Lottie JSON data
  // For demo purposes, we'll return null and use CSS fallback
  return null
}

interface LottieCharacterProps {
  character: CharacterType
  state: CharacterState
  size?: number | string
  loop?: boolean
  autoplay?: boolean
  sx?: SxProps<Theme>
  onAnimationComplete?: () => void
  onClick?: () => void
  className?: string
}

const LottieCharacter: React.FC<LottieCharacterProps> = ({
  character,
  state,
  size = 120,
  loop = false,
  autoplay = true,
  sx = {},
  onAnimationComplete,
  onClick,
  className = ''
}) => {
  const lottieRef = useRef<LottieRefCurrentProps>(null)
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  })

  const animationData = getAnimationData(character, state)

  useEffect(() => {
    if (inView && autoplay && lottieRef.current) {
      lottieRef.current.play()
    } else if (!inView && lottieRef.current) {
      lottieRef.current.pause()
    }
  }, [inView, autoplay])

  // Character emoji mapping for fallback
  const characterEmojis: Record<CharacterType, string> = {
    bear: '🐻',
    owl: '🦉',
    fox: '🦊',
    rabbit: '🐰'
  }

  // State-based CSS animations for fallback
  const getStateAnimation = (state: CharacterState): string => {
    switch (state) {
      case 'wave':
        return 'wave 1s ease-in-out'
      case 'celebrate':
        return 'celebrate 0.6s ease-in-out'
      case 'encourage':
        return 'encourage 0.8s ease-in-out'
      case 'thinking':
        return 'thinking 2s ease-in-out infinite'
      case 'point':
        return 'point 0.5s ease-in-out'
      case 'idle':
      default:
        return 'breathe 3s ease-in-out infinite'
    }
  }

  // If we have Lottie animation data, use it
  if (animationData) {
    return (
      <Box
        ref={ref}
        sx={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...sx
        }}
        className={className}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop={loop}
          autoplay={autoplay && inView}
          onComplete={onAnimationComplete}
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
    )
  }

  // Fallback to animated emoji with CSS animations
  return (
    <Box
      ref={ref}
      sx={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: typeof size === 'number' ? `${size * 0.6}px` : '72px',
        animation: getStateAnimation(state),
        transformOrigin: 'center center',
        '@keyframes breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' }
        },
        '@keyframes wave': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(15deg)' },
          '75%': { transform: 'rotate(-15deg)' }
        },
        '@keyframes celebrate': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
          '25%': { transform: 'scale(1.2) rotate(5deg)' },
          '75%': { transform: 'scale(1.1) rotate(-5deg)' }
        },
        '@keyframes encourage': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        '@keyframes thinking': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(3deg)' },
          '75%': { transform: 'rotate(-3deg)' }
        },
        '@keyframes point': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1) translateX(5px)' },
          '100%': { transform: 'scale(1)' }
        },
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.2s ease',
        '&:hover': {
          transform: 'scale(1.05)'
        },
        ...sx
      }}
      className={className}
      onClick={onClick || onAnimationComplete}
    >
      {characterEmojis[character]}
    </Box>
  )
}

export default LottieCharacter

// Hook for character state management
export const useCharacterState = (initialState: CharacterState = 'idle') => {
  const [state, setState] = React.useState<CharacterState>(initialState)
  const [character, setCharacter] = React.useState<CharacterType>('bear')

  const playAnimation = (newState: CharacterState, duration?: number) => {
    setState(newState)
    if (duration) {
      setTimeout(() => setState('idle'), duration)
    }
  }

  const celebrate = () => playAnimation('celebrate', 1500)
  const encourage = () => playAnimation('encourage', 1000)
  const wave = () => playAnimation('wave', 1000)
  const think = () => playAnimation('thinking')
  const point = () => playAnimation('point', 500)

  return {
    state,
    character,
    setCharacter,
    playAnimation,
    celebrate,
    encourage,
    wave,
    think,
    point,
    idle: () => setState('idle')
  }
}