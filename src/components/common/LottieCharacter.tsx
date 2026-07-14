import React from 'react'
import { Box, SxProps, Theme } from '@mui/material'

// Character types and states
export type CharacterType = 'bear' | 'owl' | 'fox' | 'rabbit'
export type CharacterState = 'idle' | 'wave' | 'celebrate' | 'encourage' | 'thinking' | 'point'

interface LottieCharacterProps {
  character: CharacterType
  state: CharacterState
  size?: number | string
  // Kept for API compatibility with older call sites; the component is emoji + CSS only.
  loop?: boolean
  autoplay?: boolean
  sx?: SxProps<Theme>
  onAnimationComplete?: () => void
  onClick?: () => void
  className?: string
}

// Animated-emoji mascot. This was historically a Lottie wrapper, but the Lottie branch was never
// wired up (no animation data) — it has always rendered an emoji with CSS keyframes. The Lottie
// dependency was removed in PRD-07 to trim dead weight from the first-paint bundle. The name and
// public API are unchanged so call sites don't need to move.
const LottieCharacter: React.FC<LottieCharacterProps> = ({
  character,
  state,
  size = 120,
  sx = {},
  onAnimationComplete,
  onClick,
  className = ''
}) => {
  // Character emoji mapping
  const characterEmojis: Record<CharacterType, string> = {
    bear: '🐻',
    owl: '🦉',
    fox: '🦊',
    rabbit: '🐰'
  }

  // State-based CSS animations
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

  return (
    <Box
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
