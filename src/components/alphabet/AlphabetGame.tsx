import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetScoreChip } from '../common/ScoreChip'
import { AlphabetRepeatButton } from '../common/RepeatButton'

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Word-association mode: child sees an emoji + Danish word and picks the starting letter.
// Only letters with a clear, child-friendly Danish word are included (Q, W, X omitted).
const LETTER_WORDS: Record<string, { word: string; emoji: string }> = {
  'A': { word: 'Abe', emoji: '🐒' },
  'B': { word: 'Bil', emoji: '🚗' },
  'C': { word: 'Cykel', emoji: '🚲' },
  'D': { word: 'Drage', emoji: '🐉' },
  'E': { word: 'Elefant', emoji: '🐘' },
  'F': { word: 'Fisk', emoji: '🐟' },
  'G': { word: 'Giraf', emoji: '🦒' },
  'H': { word: 'Hund', emoji: '🐕' },
  'I': { word: 'Is', emoji: '🍦' },
  'J': { word: 'Jul', emoji: '🎄' },
  'K': { word: 'Kat', emoji: '🐱' },
  'L': { word: 'Løve', emoji: '🦁' },
  'M': { word: 'Mus', emoji: '🐭' },
  'N': { word: 'Næsehorn', emoji: '🦏' },
  'O': { word: 'Orm', emoji: '🪱' },
  'P': { word: 'Panda', emoji: '🐼' },
  'R': { word: 'Raket', emoji: '🚀' },
  'S': { word: 'Sol', emoji: '☀️' },
  'T': { word: 'Tog', emoji: '🚂' },
  'U': { word: 'Ugle', emoji: '🦉' },
  'V': { word: 'Vandmelon', emoji: '🍉' },
  'Y': { word: 'Yoghurt', emoji: '🥛' },
  'Z': { word: 'Zebra', emoji: '🦓' },
  'Æ': { word: 'Æble', emoji: '🍎' },
  'Ø': { word: 'Ørn', emoji: '🦅' },
  'Å': { word: 'Ål', emoji: '🐍' },
}
const WORD_LETTERS = Object.keys(LETTER_WORDS)

const AlphabetGame: React.FC = () => {
  // Configuration for alphabet quiz
  const alphabetConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'alphabet',

    // Content generation
    generateQuizItem: () => {
      // ~50% classic "hear the letter" rounds, ~50% word-association rounds
      const useWordMode = Math.random() < 0.5

      if (useWordMode) {
        const letter = WORD_LETTERS[Math.floor(Math.random() * WORD_LETTERS.length)]
        const { word, emoji } = LETTER_WORDS[letter]
        return {
          value: letter,
          display: letter,
          audioPrompt: `Hvad starter ${word} med?`,
          repeatWord: word,
          questionVisual: { emoji, word }
        }
      }

      const letter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
      return {
        value: letter,
        display: letter,
        audioPrompt: DANISH_PHRASES.gamePrompts.findLetter(letter),
        repeatWord: letter
      }
    },
    
    generateOptions: (correctAnswer: QuizItem) => {
      const options: QuizItem[] = [correctAnswer]
      
      while (options.length < 4) {
        const randomLetter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
        if (!options.find(opt => opt.value === randomLetter)) {
          options.push({
            value: randomLetter,
            display: randomLetter,
            audioPrompt: DANISH_PHRASES.gamePrompts.findLetter(randomLetter),
            repeatWord: randomLetter
          })
        }
      }
      
      return options.sort(() => Math.random() - 0.5)
    },
    
    // Display configuration
    title: 'Bogstav Quiz',
    emoji: '🎯',
    teacherCharacter: 'owl',
    theme: categoryThemes.alphabet,
    backRoute: '/alphabet',
    
    // Component configuration
    ScoreChipComponent: AlphabetScoreChip,
    RepeatButtonComponent: AlphabetRepeatButton,
    
    // Audio configuration
    gameWelcomeType: 'alphabet',
    
    // Audio methods
    speakQuizPrompt: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    },
    
    speakClickedItem: async (item: QuizItem, audio: any) => {
      return audio.speakLetter(item.value)
    },
    
    getRepeatAudio: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    }
  }

  return <UnifiedQuizGame config={alphabetConfig} />
}

export default AlphabetGame