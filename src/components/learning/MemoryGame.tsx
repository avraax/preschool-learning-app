import React from 'react'
import { useParams } from 'react-router-dom'
import UnifiedMemoryGame, { UnifiedMemoryConfig, MemoryItemDisplay } from '../common/UnifiedMemoryGame'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetRestartButton, MathRestartButton } from '../common/RestartButton'
import { AlphabetRepeatButton, MathRepeatButton } from '../common/RepeatButton'
import { shuffle } from '../../utils/shuffle'
import { MEMORY_BOARD, memoryStarThresholds } from '../../config/difficulty'
import { useDifficulty } from '../../hooks/useDifficulty'
import { LETTER_WORDS, letterPhrase } from '../../config/letterWords'
import { letterArt } from '../../assets/games/alphabet'
import { countingObjectForNumber, artForObject } from '../../config/countingObjects'

// Danish alphabet (29 letters)
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Numbers 1-20
const NUMBERS = Array.from({ length: 20 }, (_, i) => (i + 1).toString())

// Letter → word/subject is the SHARED canonical manifest (`LETTER_WORDS`, src/config/letterWords.ts)
// — the same table Bogstav Quiz + Lær Alfabetet use — so a letter shows the same object and speaks
// the same word everywhere (PRD-07 §6.1 consolidation; the old divergent inline LETTER_ICONS is
// gone). Q/W/X/Å have no entry → their memory cards are glyph-only (owner decision — glyph-only).

const MemoryGame: React.FC = () => {
  const { type } = useParams<{ type: 'letters' | 'numbers' }>()
  const gameType = type as 'letters' | 'numbers' || 'letters'
  // **The LEVEL owns the board** (Difficulty PRD-01 W5): Let 6 pairs · Normal 10 · Svær 15. The board
  // size used to BE the game's identity — two tiles per section, one of them literally titled
  // "Hukommelse 20 (svær)", which was the only place a difficulty was ever named in the child UI. Both
  // tiles collapsed into one, `:size` is gone from the route, and the Sværhedsgrad panel drives it.
  //
  // ONE `gameId` per type (not per board size), so a level change can't fragment the child's bests —
  // the same reason XP is difficulty-independent.
  const level = useDifficulty(gameType === 'letters' ? 'alphabet' : 'math')
  const boardPairs = MEMORY_BOARD[level].pairs
  // Star thresholds are in MISTAKES (= mismatched turns), scaled to the board by the shared helper:
  // ~0.9 mismatches per pair for 3★ / ~1.8 for 2★ (the reachable curve PRD-05 P3 tuned on the 10-pair
  // board — `{9, 18}` — now expressed once so 6 and 15 pairs inherit it), plus the spine's Svær
  // tolerance on top so the bigger board doesn't cost stars.
  const starThresholds = memoryStarThresholds(boardPairs, level)

  // Configuration for letters memory game
  const lettersConfig: UnifiedMemoryConfig = {
    gameType: 'letters',
    gameId: 'memory.letters',
    boardPairs,
    starThresholds,

    generateItems: () => {
      // Shuffle the full alphabet; the engine slices boardPairs items for the board.
      return shuffle(DANISH_ALPHABET)
    },
    
    getDisplayData: (letter: string): MemoryItemDisplay => {
      const letterData = LETTER_WORDS[letter]
      return {
        primary: letter,
        secondary: letterData?.word,
        iconArt: letterArt(letter)
      }
    },

    speakItem: async (letter: string, audio: any) => {
      return audio.speak(letter)
    },

    speakMatchedItem: async (letter: string, audio: any) => {
      const letterData = LETTER_WORDS[letter]
      if (letterData) {
        // Shared builder — carries the per-letter pronunciation fixes (Z → 'zet', I comma-isolated).
        return audio.speak(letterPhrase(letter, letterData.word))
      }
      return audio.speak(letter)
    },
    
    title: 'Hukommelsesspil - Bogstaver',
    instructions: 'Find ens bogstaver ved at klikke på kortene',
    backPath: '/alphabet',
    theme: categoryThemes.alphabet,

    RepeatButtonComponent: AlphabetRepeatButton,
    RestartButtonComponent: AlphabetRestartButton
  }
  
  // Configuration for numbers memory game
  const numbersConfig: UnifiedMemoryConfig = {
    gameType: 'numbers',
    gameId: 'memory.numbers',
    boardPairs,
    starThresholds,

    generateItems: () => {
      // Shuffle 1–20; the engine slices boardPairs (random 10, or all 20).
      return shuffle(NUMBERS)
    },
    
    getDisplayData: (number: string): MemoryItemDisplay => {
      // Count cluster (PRD-08 §3.6, owner-locked): the matched front reinforces count ↔ numeral with
      // exactly `n` copies of the shared counting object (same set as Tal Quiz / Sammenlign / Lær Tal,
      // rotated by n % 8). Art-gated — `iconArt` is undefined until the WebP lands, so the cluster is
      // suppressed and the card stays numeral-only (today's look). The numeral stays the primary read.
      const n = parseInt(number, 10)
      const obj = countingObjectForNumber(n)
      return {
        primary: number,
        iconArt: artForObject(obj),
        iconCount: n,
      }
    },
    
    speakItem: async (number: string, audio: any) => {
      return audio.speakNumber(parseInt(number))
    },
    
    title: 'Hukommelsesspil - Tal',
    instructions: 'Find ens tal ved at klikke på kortene',
    backPath: '/math',
    theme: categoryThemes.math,

    RepeatButtonComponent: MathRepeatButton,
    RestartButtonComponent: MathRestartButton
  }

  // Select configuration based on game type
  const config = gameType === 'letters' ? lettersConfig : numbersConfig

  return <UnifiedMemoryGame config={config} />
}

export default MemoryGame