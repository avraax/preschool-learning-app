import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import CountingAid from '../common/CountingAid'

// Comprehensive math settings for counting quiz
const MAX_NUMBER = 50  // Tal Quiz numbers from 1-50

// Swap the tens/units digit of a two-digit number (23 → 32). Returns null for single-digit or
// palindromic numbers (11, 22, …) where the swap isn't a distinct confusable.
const swapDigits = (n: number): number | null => {
  if (n < 10) return null
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (tens === units) return null
  return units * 10 + tens
}

const makeNumberItem = (n: number): QuizItem => ({
  value: n,
  display: n,
  audioPrompt: DANISH_PHRASES.gamePrompts.findNumber(n),
  repeatWord: n.toString(),
})

const MathGame: React.FC = () => {
  // Configuration for counting quiz
  const countingConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'counting',
    
    // Content generation
    generateQuizItem: () => {
      const number = Math.floor(Math.random() * MAX_NUMBER) + 1
      return makeNumberItem(number)
    },

    // Near-number distractors target real confusions — digit order (23↔32) and off-by-one/ten —
    // so a correct answer means something (vs the old purely-random options). Falls back to
    // random-in-range only when too few valid confusables exist (small/large edge numbers).
    generateOptions: (correctAnswer: QuizItem) => {
      const n = correctAnswer.value as number
      const confusables = [swapDigits(n), n - 1, n + 1, n - 10, n + 10]
        .filter((c): c is number => c !== null && c >= 1 && c <= MAX_NUMBER && c !== n)

      // Dedupe, shuffle, take up to 3 distinct confusables.
      const picks: number[] = []
      for (const c of confusables.sort(() => Math.random() - 0.5)) {
        if (picks.length >= 3) break
        if (!picks.includes(c)) picks.push(c)
      }
      // Top up with random distinct numbers if fewer than 3 confusables were available.
      while (picks.length < 3) {
        const r = Math.floor(Math.random() * MAX_NUMBER) + 1
        if (r !== n && !picks.includes(r)) picks.push(r)
      }

      const options: QuizItem[] = [correctAnswer, ...picks.map(makeNumberItem)]
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

    // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
    gameId: 'math.counting',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // Counting aid: show the TARGET number as a stacked ten-frame so he can map quantity → glyph.
    aidContent: (item: QuizItem) => (
      <CountingAid mode="value" value={item.value as number} accent={categoryThemes.math.accentColor} open />
    ),

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