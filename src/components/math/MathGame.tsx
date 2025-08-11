import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'

// Comprehensive math settings for counting quiz
const MAX_NUMBER = 30  // Tal Quiz numbers from 1-30

const MathGame: React.FC = () => {
  // Configuration for counting quiz
  const countingConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'counting',
    
    // Content generation
    generateQuizItem: () => {
      const number = Math.floor(Math.random() * MAX_NUMBER) + 1
      return {
        value: number,
        display: number,
        audioPrompt: DANISH_PHRASES.gamePrompts.findNumber(number),
        repeatWord: number.toString()
      }
    },
    
    generateOptions: (correctAnswer: QuizItem) => {
      const options: QuizItem[] = [correctAnswer]
      
      while (options.length < 4) {
        const randomNum = Math.floor(Math.random() * MAX_NUMBER) + 1
        if (!options.find(opt => opt.value === randomNum)) {
          options.push({
            value: randomNum,
            display: randomNum,
            audioPrompt: DANISH_PHRASES.gamePrompts.findNumber(randomNum),
            repeatWord: randomNum.toString()
          })
        }
      }
      
      return options.sort(() => Math.random() - 0.5)
    },
    
    // Display configuration
    title: 'Tal Quiz',
    emoji: '🧮',
    teacherCharacter: 'fox',
    theme: categoryThemes.math,
    backRoute: '/math',
    
    // Component configuration
    ScoreChipComponent: MathScoreChip,
    RepeatButtonComponent: MathRepeatButton,
    
    // Audio configuration
    gameWelcomeType: 'math',
    
    // Audio methods
    speakQuizPrompt: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    },
    
    speakClickedItem: async (item: QuizItem, audio: any) => {
      return audio.speakNumber(item.value as number)
    },
    
    getRepeatAudio: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    }
  }

  return <UnifiedQuizGame config={countingConfig} />
}

export default MathGame