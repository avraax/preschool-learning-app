import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import ListenHero from '../common/ListenHero'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import { MathRepeatButton } from '../common/RepeatButton'
import { progressStore } from '../../services/progressStore'
import { numberDistractors, pickQuizNumber } from '../../config/mathProblems'
import { numberHintLine } from '../../config/hintLines'
import { shuffle } from '../../utils/shuffle'

// Tal Quiz is a LISTEN-then-recognise task, at every n: the number lives ONLY in the spoken prompt
// ("Find tallet 37" + Hør igen) and the focal zone shows the shared ListenHero — no numeral, and no
// object row (owner ruling 2026-08-01). Both of those visuals handed the answer over:
//   - printing "37" above a tile row that CONTAINS 37 made the tap pure shape-matching;
//   - showing exactly n objects (the old PRD-05 "Hvor mange?" counting mode) is a second visible
//     copy of the answer — a child who can count just counts the pile instead of hearing the number.
// What makes the task real is Danish's inverted number word: "syvogtredive" is seven-and-thirty, so
// telling 37 from 73 by ear is the whole lesson — which is exactly what the digit-swap distractors
// serve.
//
// Difficulty (PRD-01 §4.1) is a table + pure generators in src/config/{difficulty,mathProblems}.ts.
// TWO independent axes — the RANGE and the distractor policy:
//   Let    1–20  · 3 tiles · distractors ≥10 away in both digits
//   Normal 1–50  · 4 tiles · digit-swap + ±1/±10
//   Svær   1–100 · 5 tiles · the digit-swap ALWAYS present when one exists
// The range split is not arbitrary: Danish only inverts from 21 ("enogtyve"), so Let deliberately
// stays below the inverted form entirely. See the MATH_COUNTING doc comment.

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
const renderListenHero = (
  item: QuizItem,
  ctx: { speaking: boolean; narrationHealthy: boolean },
): React.ReactNode => (
  <ListenHero
    accent={getCategoryTheme('math').accentColor}
    speaking={ctx.speaking}
    // DEGRADED MODE (Practice Loop PRD-01 W4). With narration dead this board is a speaker and an
    // equalizer and nothing else — literally unanswerable — so it prints the numeral. That is the
    // giveaway the owner REMOVED (a printed numeral above a tile row containing it makes the tap pure
    // shape-matching), deliberately re-created for this state only: a solvable board beats an
    // unanswerable one, and the alternative is a child tapping at random until an adult notices.
    // This is the WHOLE of degraded mode now: it hangs off `ctx.narrationHealthy` here, never off a
    // config flag (Endless Play PRD-01 W3 deleted `audioOnly` with the personal bests it fed).
    reveal={ctx.narrationHealthy ? undefined : String(item.value)}
  />
)

const MathGame: React.FC = () => {
  // Configuration for counting quiz
  const countingConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'counting',

    // Content generation — the range comes from the difficulty table (Let 1–20 / Normal 1–50 / Svær 1–100).
    generateQuizItem: () => makeNumberItem(pickQuizNumber(progressStore.difficultyFor('math'))),

    // The distractor POLICY is this game's difficulty axis (see the note above the component), so it
    // lives in `numberDistractors` — one pure function, sampled by difficulty.test.ts, returning
    // exactly `optionCount - 1` distinct in-range numbers at every level.
    generateOptions: (correctAnswer: QuizItem, optionCount: number) => {
      const level = progressStore.difficultyFor('math')
      const picks = numberDistractors(correctAnswer.value as number, level, optionCount - 1)
      return shuffle([correctAnswer, ...picks.map(makeNumberItem)])
    },

    // Focal zone shows a "listen" card only — the number is spoken, never shown (see above).
    renderHero: renderListenHero,
    
    // Display configuration
    title: 'Tal Quiz',
    teacherCharacter: 'fox',
    theme: categoryThemes.math,
    backRoute: '/math',
    
    // Component configuration
    RepeatButtonComponent: MathRepeatButton,
    
    // Audio configuration
    gameWelcomeType: 'math',

    gameId: 'math.counting',
    // The `taskXp` normaliser (Endless Play PRD-01 W2) — play itself is endless.
    tasksInRound: 8,

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct number tile pulses — and the prompt is
    // SPOKEN again (Practice Loop PRD-01 W3). On a listen-only board the prompt IS the fact: a child who
    // has guessed twice has usually mis-heard "syvogtredive", and the one thing that helps is hearing it
    // again. No new narration ("Find tallet N" is baked for the whole 1–100 range).
    hintAfterNWrong: 2,
    speakHint: async (item: QuizItem, audio: any) =>
      audio.speak(numberHintLine(item.value as number)),

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