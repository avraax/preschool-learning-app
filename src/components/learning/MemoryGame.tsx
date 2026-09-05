import React from 'react'
import { useParams } from 'react-router-dom'
import UnifiedMemoryGame, { UnifiedMemoryConfig, MemoryItemDisplay } from '../common/UnifiedMemoryGame'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetRestartButton, MathRestartButton } from '../common/RestartButton'
import { AlphabetRepeatButton, MathRepeatButton } from '../common/RepeatButton'
import { MEMORY_BOARD } from '../../config/difficulty'
import { useDifficulty } from '../../hooks/useDifficulty'
import { LETTER_WORDS, letterPhrase } from '../../config/letterWords'
import { letterArt } from '../../assets/games/alphabet'
import { countingObjectForNumber, artForObject } from '../../config/countingObjects'
import { MEMORY_LETTERS_INSTRUCTION, MEMORY_NUMBERS_INSTRUCTION } from '../../config/gamePhrases'

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

  // Configuration for letters memory game
  const lettersConfig: UnifiedMemoryConfig = {
    gameType: 'letters',
    gameId: 'memory.letters',
    boardPairs,

    // The POOL. The engine's `boardBag` owns the shuffle and the cycle now (Endless Play PRD-01 W6) —
    // a shuffle here would be a second, redundant one and the bag would still deal the same pass.
    generateItems: () => DANISH_ALPHABET,

    getDisplayData: (letter: string): MemoryItemDisplay => {
      const letterData = LETTER_WORDS[letter]
      return {
        primary: letter,
        secondary: letterData?.word,
        iconArt: letterArt(letter)
      }
    },

    // `speakLetter`, NOT `speak` — it routes through `DANISH_LETTER_NAMES`, which is the text the
    // prebake actually baked. The map is glyph-first but LOWERCASE (`A → 'a'`), with real respellings
    // for the two that need them (`X → 'eks'`, `Z → 'zæt'`). A cache key is the exact string, so the
    // raw uppercase glyph this used to pass matched NOTHING: 0 of 1886 clips. Every card tap therefore
    // reached live Azure, which reads a lone capital as a CHARACTER — measured on the owner's iPad as
    // "Stort bogstav X" — in whatever voice the fallback chain produced rather than prebaked Christel.
    speakItem: async (letter: string, audio: any) => {
      return audio.speakLetter(letter)
    },

    speakMatchedItem: async (letter: string, audio: any) => {
      const letterData = LETTER_WORDS[letter]
      if (letterData) {
        // Shared builder — carries the per-letter pronunciation fixes (Z → 'zet', I comma-isolated).
        return audio.speak(letterPhrase(letter, letterData.word))
      }
      // No word for this letter — Q/W/X/Å are glyph-only cards by design, so this fallback is the
      // ONLY thing they ever speak. Same bug as `speakItem` above, and the one the owner actually
      // heard: X has no entry here, so a matched X spoke the raw glyph.
      return audio.speakLetter(letter)
    },
    
    title: 'Hukommelsesspil - Bogstaver',
    instructions: MEMORY_LETTERS_INSTRUCTION,
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

    // The POOL — see the letters config above; the engine's `boardBag` owns the shuffle and the cycle.
    generateItems: () => NUMBERS,

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
    instructions: MEMORY_NUMBERS_INSTRUCTION,
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