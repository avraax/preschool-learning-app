import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import ListenHero from '../common/ListenHero'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { shuffle } from '../../utils/shuffle'

// Comprehensive math settings for counting quiz. Difficulty (Overhaul §5.7/Appendix A) sets the
// range: Let 1–20, Normal 1–50, Svær 1–100. The manual adult-menu level stays authoritative.
const MAX_NUMBER_BY_LEVEL: Record<DifficultyLevel, number> = { let: 20, normal: 50, svaer: 100 }
const maxNumberForLevel = (level: DifficultyLevel): number => MAX_NUMBER_BY_LEVEL[level]

// Tal Quiz is a LISTEN-then-recognise task, at every n: the number lives ONLY in the spoken prompt
// ("Find tallet 37" + Hør igen) and the focal zone shows the shared ListenHero — no numeral, and no
// object row (owner ruling 2026-08-01). Both of those visuals handed the answer over:
//   - printing "37" above a tile row that CONTAINS 37 made the tap pure shape-matching;
//   - showing exactly n objects (the old PRD-05 "Hvor mange?" counting mode) is a second visible
//     copy of the answer — a child who can count just counts the pile instead of hearing the number.
// What makes the task real is Danish's inverted number word: "syvogtredive" is seven-and-thirty, so
// telling 37 from 73 by ear is the whole lesson — which is exactly what the digit-swap distractors
// below serve. Countable, solve-it-with-fingers work lives in Plus/Minus's ten-frames instead.
//
// Swap the tens/units digit of a two-digit number (23 → 32). Returns null for single-digit or
// palindromic numbers (11, 22, …) where the swap isn't a distinct confusable.
const swapDigits = (n: number): number | null => {
  if (n < 10) return null
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (tens === units) return null
  return units * 10 + tens
}

// A number as a quiz item. The prompt is always "Find tallet N" — spoken, never shown. (For OPTION
// tiles the prompt/repeat text is unused; only the target's matters.)
const makeNumberItem = (n: number): QuizItem => ({
  value: n,
  display: n,
  audioPrompt: DANISH_PHRASES.gamePrompts.findNumber(n),
  repeatWord: n.toString(),
})

// Tal Quiz hero: the shared "listen" card at every n — the number is spoken only, so the focal zone
// must not print it or depict it. The never-fail hint (2 wrong taps → the correct tile pulses) plus
// Hør igen keep it fair without showing the answer.
const renderListenHero = (_item: QuizItem, ctx: { speaking: boolean }): React.ReactNode => (
  <ListenHero accent={getCategoryTheme('math').accentColor} speaking={ctx.speaking} />
)

const MathGame: React.FC = () => {
  // Configuration for counting quiz
  const countingConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'counting',

    // Content generation
    generateQuizItem: () => {
      const maxNumber = maxNumberForLevel(progressStore.difficultyFor('math'))
      const number = Math.floor(Math.random() * maxNumber) + 1
      return makeNumberItem(number)
    },

    // Near-number distractors target real confusions — digit order (23↔32) and off-by-one/ten —
    // so a correct answer means something (vs the old purely-random options). Falls back to
    // random-in-range only when too few valid confusables exist (small/large edge numbers).
    generateOptions: (correctAnswer: QuizItem) => {
      const maxNumber = maxNumberForLevel(progressStore.difficultyFor('math'))
      const n = correctAnswer.value as number
      // Near-number distractors (PRD-14 W2 / audit §A2). For n≥10 keep the digit-order (23↔32) and
      // off-by-one/ten confusions — the real errors at that scale. Small counts (n<10) have no
      // meaningful digit-swap/±10 confusable, so a "3 vs 13" outlier taught nothing → bias them to
      // ±1/±2 so a correct count actually discriminates near neighbours. Random top-up still fills in.
      const confusables = (
        n < 10
          ? [n - 1, n + 1, n - 2, n + 2]
          : [swapDigits(n), n - 1, n + 1, n - 10, n + 10]
      ).filter((c): c is number => c !== null && c >= 1 && c <= maxNumber && c !== n)

      // Dedupe, shuffle, take up to 3 distinct confusables.
      const picks: number[] = []
      for (const c of shuffle(confusables)) {
        if (picks.length >= 3) break
        if (!picks.includes(c)) picks.push(c)
      }
      // Top up with random distinct numbers if fewer than 3 confusables were available.
      while (picks.length < 3) {
        const r = Math.floor(Math.random() * maxNumber) + 1
        if (r !== n && !picks.includes(r)) picks.push(r)
      }

      const options: QuizItem[] = [correctAnswer, ...picks.map(makeNumberItem)]
      return shuffle(options)
    },

    // Focal zone shows a "listen" card only — the number is spoken, never shown (see above).
    renderHero: renderListenHero,
    
    // Display configuration
    title: 'Tal Quiz',
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

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct number tile pulses.
    hintAfterNWrong: 2,

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