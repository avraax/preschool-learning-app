import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { OrdlegRepeatButton } from '../common/RepeatButton'

// Læs Ordet: the written Danish word is shown (no picture); the child reads it and
// taps the matching picture from 4 options. Whole-word reading practice for a child
// who already reads simple words. The word is also spoken (read-along reinforcement).
interface ReadingWord {
  word: string
  emoji: string
}

const READING_WORDS: ReadingWord[] = [
  { word: 'kat', emoji: '🐱' },
  { word: 'hund', emoji: '🐕' },
  { word: 'sol', emoji: '☀️' },
  { word: 'hus', emoji: '🏠' },
  { word: 'bil', emoji: '🚗' },
  { word: 'fisk', emoji: '🐟' },
  { word: 'ko', emoji: '🐄' },
  { word: 'bog', emoji: '📖' },
  { word: 'æble', emoji: '🍎' },
  { word: 'banan', emoji: '🍌' },
  { word: 'hest', emoji: '🐴' },
  { word: 'mus', emoji: '🐭' },
  { word: 'and', emoji: '🦆' },
  { word: 'gris', emoji: '🐷' },
  { word: 'kage', emoji: '🍰' },
  { word: 'bold', emoji: '⚽' },
  { word: 'sko', emoji: '👟' },
  { word: 'hat', emoji: '🎩' },
  { word: 'blomst', emoji: '🌸' },
  { word: 'måne', emoji: '🌙' },
  { word: 'træ', emoji: '🌳' },
  { word: 'tog', emoji: '🚂' },
  { word: 'fugl', emoji: '🐦' },
  { word: 'is', emoji: '🍦' },
  { word: 'ost', emoji: '🧀' },
  { word: 'løve', emoji: '🦁' }
]

const LaesOrdetGame: React.FC = () => {
  const toItem = (w: ReadingWord): QuizItem => ({
    value: w.word,
    display: w.emoji,
    audioPrompt: w.word,
    repeatWord: w.word
  })

  const config: UnifiedQuizConfig = {
    quizType: 'ordleg',

    generateQuizItem: () => {
      const w = READING_WORDS[Math.floor(Math.random() * READING_WORDS.length)]
      return {
        ...toItem(w),
        // Word shown as text, no picture in the prompt — the child must read it.
        questionVisual: { emoji: '', word: w.word.toUpperCase() }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const correctWord = READING_WORDS.find(w => w.word === correct.value) || READING_WORDS[0]
      const options: QuizItem[] = [toItem(correctWord)]
      const shuffled = [...READING_WORDS].sort(() => Math.random() - 0.5)
      for (const w of shuffled) {
        if (options.length >= 4) break
        if (!options.find(o => o.value === w.word)) options.push(toItem(w))
      }
      return options.sort(() => Math.random() - 0.5)
    },

    title: 'Læs Ordet',
    emoji: '📖',
    teacherCharacter: 'owl',
    theme: categoryThemes.ordleg,
    backRoute: '/ordleg',

    ScoreChipComponent: OrdlegScoreChip,
    RepeatButtonComponent: OrdlegRepeatButton,

    gameWelcomeType: 'laesordet',

    // Read-along: the word is spoken in Danish; tapping a picture speaks its word.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speak(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt))
  }

  return <UnifiedQuizGame config={config} />
}

export default LaesOrdetGame
