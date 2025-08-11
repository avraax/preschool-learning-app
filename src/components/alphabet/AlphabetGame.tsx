import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { AlphabetScoreChip } from '../common/ScoreChip'
import { AlphabetRepeatButton } from '../common/RepeatButton'

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

const AlphabetGame: React.FC = () => {
  // Configuration for alphabet quiz
  const alphabetConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'alphabet',
    
    // Content generation
    generateQuizItem: () => {
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