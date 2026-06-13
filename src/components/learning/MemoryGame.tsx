import React from 'react'
import { useParams } from 'react-router-dom'
import UnifiedMemoryGame, { UnifiedMemoryConfig, MemoryItemDisplay } from '../common/UnifiedMemoryGame'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetScoreChip, MathScoreChip } from '../common/ScoreChip'
import { AlphabetRestartButton, MathRestartButton } from '../common/RestartButton'
import { AlphabetRepeatButton, MathRepeatButton } from '../common/RepeatButton'

// Danish alphabet (29 letters)
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Numbers 1-20 
const NUMBERS = Array.from({ length: 20 }, (_, i) => (i + 1).toString())

// Letter associations with Danish words and icons
const LETTER_ICONS: { [key: string]: { word: string; icon: string } } = {
  'A': { word: 'Ananas', icon: '🍍' },
  'B': { word: 'Bjørn', icon: '🐻' },
  'C': { word: 'Cykel', icon: '🚲' },
  'D': { word: 'Due', icon: '🦆' },
  'E': { word: 'Elefant', icon: '🐘' },
  'F': { word: 'Frø', icon: '🐸' },
  'G': { word: 'Giraf', icon: '🦒' },
  'H': { word: 'Hest', icon: '🐴' },
  'I': { word: 'Is', icon: '🍦' },
  'J': { word: 'Juletræ', icon: '🎄' },
  'K': { word: 'Kat', icon: '🐱' },
  'L': { word: 'Løve', icon: '🦁' },
  'M': { word: 'Mus', icon: '🐭' },
  'N': { word: 'Næsehorn', icon: '🦏' },
  'O': { word: 'Ost', icon: '🧀' },
  'P': { word: 'Papegøje', icon: '🦜' },
  'Q': { word: 'Quiz', icon: '❓' },
  'R': { word: 'Ræv', icon: '🦊' },
  'S': { word: 'Sol', icon: '☀️' },
  'T': { word: 'Tog', icon: '🚂' },
  'U': { word: 'Ugle', icon: '🦉' },
  'V': { word: 'Vind', icon: '💨' },
  'W': { word: 'Wienerbrød', icon: '🥐' },
  'X': { word: 'X', icon: '❌' },
  'Y': { word: 'Yacht', icon: '⛵' },
  'Z': { word: 'Zebra', icon: '🦓' },
  'Æ': { word: 'Æble', icon: '🍎' },
  'Ø': { word: 'Ø', icon: '🏝️' },
  'Å': { word: 'Å', icon: '🏞️' }
}

const MemoryGame: React.FC = () => {
  const { type } = useParams<{ type: 'letters' | 'numbers' }>()
  const gameType = type as 'letters' | 'numbers' || 'letters'
  
  // Configuration for letters memory game
  const lettersConfig: UnifiedMemoryConfig = {
    gameType: 'letters',
    
    generateItems: () => {
      // Randomly select 20 letters from the Danish alphabet
      const shuffledAlphabet = [...DANISH_ALPHABET].sort(() => Math.random() - 0.5)
      return shuffledAlphabet.slice(0, 20)
    },
    
    getDisplayData: (letter: string): MemoryItemDisplay => {
      const letterData = LETTER_ICONS[letter]
      return {
        primary: letter,
        secondary: letterData?.word,
        icon: letterData?.icon
      }
    },
    
    speakItem: async (letter: string, audio: any) => {
      return audio.speak(letter)
    },
    
    speakMatchedItem: async (letter: string, audio: any) => {
      const letterData = LETTER_ICONS[letter]
      if (letterData) {
        return audio.speak(`${letter} som ${letterData.word}`)
      }
      return audio.speak(letter)
    },
    
    title: 'Hukommelsesspil - Bogstaver',
    instructions: 'Find ens bogstaver ved at klikke på kortene',
    backPath: '/alphabet',
    theme: categoryThemes.alphabet,
    cardBackIcon: 'ABC',
    
    ScoreComponent: AlphabetScoreChip,
    RepeatButtonComponent: AlphabetRepeatButton,
    RestartButtonComponent: AlphabetRestartButton
  }
  
  // Configuration for numbers memory game
  const numbersConfig: UnifiedMemoryConfig = {
    gameType: 'numbers',
    
    generateItems: () => {
      // Use all numbers 1-20
      return [...NUMBERS]
    },
    
    getDisplayData: (number: string): MemoryItemDisplay => {
      return {
        primary: number
      }
    },
    
    speakItem: async (number: string, audio: any) => {
      return audio.speakNumber(parseInt(number))
    },
    
    title: 'Hukommelsesspil - Tal',
    instructions: 'Find ens tal ved at klikke på kortene',
    backPath: '/math',
    theme: categoryThemes.math,
    cardBackIcon: '123',
    
    ScoreComponent: MathScoreChip,
    RepeatButtonComponent: MathRepeatButton,
    RestartButtonComponent: MathRestartButton
  }

  // Select configuration based on game type
  const config = gameType === 'letters' ? lettersConfig : numbersConfig

  return <UnifiedMemoryGame config={config} />
}

export default MemoryGame