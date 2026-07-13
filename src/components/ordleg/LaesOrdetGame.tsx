import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { OrdlegRepeatButton } from '../common/RepeatButton'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'

// Læs Ordet: the written Danish word is shown (no picture); the child reads it and
// taps the matching picture from 4 options. The word is NOT read aloud — the child must
// read it themselves (that's the whole point). Easiest level: short, familiar 2–3 letter
// words for a beginning reader who can't spell yet.
interface ReadingWord {
  word: string
  emoji: string
}

const READING_WORDS: ReadingWord[] = [
  { word: 'ko', emoji: '🐄' },
  { word: 'is', emoji: '🍦' },
  { word: 'æg', emoji: '🥚' },
  { word: 'kat', emoji: '🐱' },
  { word: 'sol', emoji: '☀️' },
  { word: 'hus', emoji: '🏠' },
  { word: 'bil', emoji: '🚗' },
  { word: 'bog', emoji: '📖' },
  { word: 'mus', emoji: '🐭' },
  { word: 'and', emoji: '🦆' },
  { word: 'sko', emoji: '👟' },
  { word: 'hat', emoji: '🎩' },
  { word: 'ost', emoji: '🧀' },
  { word: 'tog', emoji: '🚂' },
  { word: 'bus', emoji: '🚌' },
  { word: 'ræv', emoji: '🦊' },
  { word: 'ged', emoji: '🐐' },
  { word: 'haj', emoji: '🦈' },
  { word: 'abe', emoji: '🐒' },
  { word: 'ski', emoji: '🎿' }
]

// Let (Overhaul §5.7/Appendix A): restrict the PROMPT word to the shortest (2-letter) entries —
// gentler than Normal's 2–3-letter mix. Distractor pictures still draw from the full list (below)
// so the option pool never runs dry. Ordleg's floor never grows past 3 letters at any level.
const TWO_LETTER_WORDS = READING_WORDS.filter(w => w.word.length === 2)

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
      const level: DifficultyLevel = progressStore.difficultyFor('ordleg')
      // Let draws only 2-letter prompt words (gentler); Normal/Svær keep today's full 2–3-letter
      // pool — Svær's extra challenge is MORE distractor pictures below, never longer words.
      const pool = level === 'let' ? TWO_LETTER_WORDS : READING_WORDS
      const w = pool[Math.floor(Math.random() * pool.length)]
      return {
        ...toItem(w),
        // Word shown as text, no picture in the prompt — the child must read it.
        questionVisual: { emoji: '', word: w.word.toUpperCase() }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const level: DifficultyLevel = progressStore.difficultyFor('ordleg')
      // Svær: more distractor PICTURES (6 instead of 4) — the one difficulty axis left once word
      // length is fixed gentle at every level.
      const optionCount = level === 'svaer' ? 6 : 4
      const correctWord = READING_WORDS.find(w => w.word === correct.value) || READING_WORDS[0]
      const options: QuizItem[] = [toItem(correctWord)]
      const shuffled = [...READING_WORDS].sort(() => Math.random() - 0.5)
      for (const w of shuffled) {
        if (options.length >= optionCount) break
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
    // No "Gentag" button — there's nothing to repeat; the child reads the word silently.
    showRepeat: false,

    gameWelcomeType: 'laesordet',

    // Bounded round of 8 + shared reward flow (Overhaul Ordleg §1). The engine handles
    // everything: rounds, first-try/streak tracking, celebration tiers, wrong SFX, and the
    // RoundResultScreen → progressStore.recordRoundResult('ordleg.read', …).
    round: { length: 8, starThresholds: { three: 0, two: 2 } },
    gameId: 'ordleg.read',

    // The prompt word is NEVER spoken (reading it aloud would defeat the exercise), so both
    // the prompt and the repeat audio are no-ops. Tapping a picture still names the child's
    // choice; the correct/wrong cue still plays (handled by UnifiedQuizGame).
    speakQuizPrompt: async () => '',
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speak(String(item.value)),
    getRepeatAudio: async () => ''
  }

  return <UnifiedQuizGame config={config} />
}

export default LaesOrdetGame
