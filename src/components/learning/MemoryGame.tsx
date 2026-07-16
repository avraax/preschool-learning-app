import React from 'react'
import { useParams } from 'react-router-dom'
import UnifiedMemoryGame, { UnifiedMemoryConfig, MemoryItemDisplay } from '../common/UnifiedMemoryGame'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetScoreChip, MathScoreChip } from '../common/ScoreChip'
import { AlphabetRestartButton, MathRestartButton } from '../common/RestartButton'
import { stickerSetForSection } from '../../config/stickers'
import { AlphabetRepeatButton, MathRepeatButton } from '../common/RepeatButton'
import { shuffle } from '../../utils/shuffle'
import { LETTER_WORDS } from '../../config/letterWords'
import { letterArt } from '../../assets/games/alphabet'

// Danish alphabet (29 letters)
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Numbers 1-20
const NUMBERS = Array.from({ length: 20 }, (_, i) => (i + 1).toString())

// Letter → word/subject is the SHARED canonical manifest (`LETTER_WORDS`, src/config/letterWords.ts)
// — the same table Bogstav Quiz + Lær Alfabetet use — so a letter shows the same object and speaks
// the same word everywhere (PRD-07 §6.1 consolidation; the old divergent inline LETTER_ICONS is
// gone). Q/W/X/Å have no entry → their memory cards are glyph-only (owner decision — glyph-only).

const MemoryGame: React.FC = () => {
  const { type, size } = useParams<{ type: 'letters' | 'numbers'; size: '10' | '20' }>()
  const gameType = type as 'letters' | 'numbers' || 'letters'
  // Static-difficulty: the board size is the game's identity (two separate routes), not a picker.
  // Old bookmarks without :size (or anything invalid) default to the 20-pair stretch board.
  const boardPairs = size === '10' ? 10 : 20
  // Star thresholds are in MISTAKES (= mismatched turns). Tunable constants; static difficulty.
  // Retuned (PRD-05 P3) so a strong-but-imperfect child can actually reach 3★ — the old
  // {10:6, 20:14} demanded near-perfect recall and left a flat reward curve on the games he plays
  // most. Now 3★ tolerates ~1 mismatch per pair (10-pair) / ~0.9 (20-pair).
  const starThresholds = boardPairs === 10 ? { three: 9, two: 18 } : { three: 18, two: 34 }

  // Configuration for letters memory game
  const lettersConfig: UnifiedMemoryConfig = {
    gameType: 'letters',
    gameId: `memory.letters.${boardPairs}`,
    boardPairs,
    starThresholds,
    stickerSetId: stickerSetForSection('alphabet'),

    generateItems: () => {
      // Shuffle the full alphabet; the engine slices boardPairs items for the board.
      return shuffle(DANISH_ALPHABET)
    },
    
    getDisplayData: (letter: string): MemoryItemDisplay => {
      const letterData = LETTER_WORDS[letter]
      return {
        primary: letter,
        secondary: letterData?.word,
        icon: letterData?.emoji,
        iconArt: letterArt(letter)
      }
    },

    speakItem: async (letter: string, audio: any) => {
      return audio.speak(letter)
    },

    speakMatchedItem: async (letter: string, audio: any) => {
      const letterData = LETTER_WORDS[letter]
      if (letterData) {
        return audio.speak(`${letter} som ${letterData.word}`)
      }
      return audio.speak(letter)
    },
    
    title: 'Hukommelsesspil - Bogstaver',
    instructions: 'Find ens bogstaver ved at klikke på kortene',
    backPath: '/alphabet',
    theme: categoryThemes.alphabet,

    ScoreComponent: AlphabetScoreChip,
    RepeatButtonComponent: AlphabetRepeatButton,
    RestartButtonComponent: AlphabetRestartButton
  }
  
  // Configuration for numbers memory game
  const numbersConfig: UnifiedMemoryConfig = {
    gameType: 'numbers',
    gameId: `memory.numbers.${boardPairs}`,
    boardPairs,
    starThresholds,
    stickerSetId: stickerSetForSection('math'),

    generateItems: () => {
      // Shuffle 1–20; the engine slices boardPairs (random 10, or all 20).
      return shuffle(NUMBERS)
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

    ScoreComponent: MathScoreChip,
    RepeatButtonComponent: MathRepeatButton,
    RestartButtonComponent: MathRestartButton
  }

  // Select configuration based on game type
  const config = gameType === 'letters' ? lettersConfig : numbersConfig

  return <UnifiedMemoryGame config={config} />
}

export default MemoryGame