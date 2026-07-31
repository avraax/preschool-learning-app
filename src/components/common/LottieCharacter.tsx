import React from 'react'

// Character types and states
export type CharacterType = 'bear' | 'owl' | 'fox' | 'rabbit'
export type CharacterState = 'idle' | 'wave' | 'celebrate' | 'encourage' | 'thinking' | 'point'

// Was historically a Lottie wrapper; the Lottie branch was never wired up, so it only ever rendered
// an ANIMAL EMOJI with CSS keyframes — and de-emoji PRD-01 W2 deletes exactly that (D5: render
// nothing rather than a flat glyph). Its single render site was the 404 page. What survives is the
// state machine below, which UnifiedMemoryGame uses for its teacher's mood without rendering a glyph.

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
