import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { EnglishScoreChip } from '../common/ScoreChip'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickWordsForLevel, EnglishWord } from '../../config/englishVocab'
import { progressStore } from '../../services/progressStore'
import { ENGLISH_QUIZ } from '../../config/difficulty'

// Difficulty (PRD-01 §4.4) is a table + ONE shared helper now: `pickWordsForLevel` in
// src/config/englishVocab.ts, driven by `ENGLISH_QUIZ[level]`. All three English quizzes share it — the
// per-game copies of this function were byte-identical, so a fix to one would silently have missed the
// others. Tiles 3/4/5; distractor theme different / random / same. The word POOL stays identical at every
// level (the deliberate beginner floor), and the three games' distinct skills are untouched.

// Dansk til Engelsk: show + speak a Danish word the child knows (Danish text + Danish voice, NO
// picture); the child picks the English equivalent (text). Bridges from the native language.
//
// Liveliness PRD-17 W1 — differentiation: this game DROPS the baked picture that Find det Engelske
// Ord keeps. Find is a picture→English recognition task; this is a Danish-word→English translation
// task (no picture crutch) — a genuinely harder, distinct skill. The only shared surface is the W7
// audition (hear each English tile before committing), which keeps it winnable for a pre-reader.
const EnglishTranslateGame: React.FC = () => {
  const toWordItem = (w: EnglishWord): QuizItem => ({
    value: w.en,
    display: w.en,
    // audioPrompt / repeatWord hold the Danish word (spoken in Danish on the prompt side).
    audioPrompt: w.da,
    repeatWord: w.da
  })

  const config: UnifiedQuizConfig = {
    quizType: 'english',

    generateQuizItem: () => {
      const word = quizEnglishWords[Math.floor(Math.random() * quizEnglishWords.length)]
      return {
        ...toWordItem(word),
        // W1 (PRD-17): NO picture — the prompt is the Danish word ALONE. With no `art`/`emoji` the
        // engine's renderHero renders `qv.word` as the BIG word-only prompt (not a small caption), so
        // the child hears+reads the Danish word and must translate. This is the differentiator from
        // Find det Engelske Ord (which keeps its picture). The English word ANSWERS stay type.
        questionVisual: { word: word.da }
      }
    },

    generateOptions: (correct: QuizItem, optionCount: number) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      const { theme } = ENGLISH_QUIZ[progressStore.difficultyFor('english')]
      return pickWordsForLevel(correctWord, theme, optionCount).map(toWordItem)
    },

    title: 'Dansk til Engelsk',
    teacherCharacter: 'owl',
    theme: getCategoryTheme('english'),
    backRoute: '/english',

    ScoreChipComponent: EnglishScoreChip,
    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishtranslate',
    gameId: 'english.translate',
    // Star thresholds come from the difficulty spine (Difficulty PRD-01 W6).
    round: { length: 8 },

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct word tile pulses.
    hintAfterNWrong: 2,

    // SINGLE TAP commits (owner decision, 2026-07-31). This game previously opted into the
    // `previewBeforeCommit` two-tap audition (PRD-14 W7): tap 1 spoke the tile's English word, tap 2
    // committed. In real play with a 5-year-old that read as a broken game — the first tap looked
    // ignored, so he kept tapping. The prompt already speaks the target word, so a single tap keeps
    // this a genuine print-recognition task. The engine still supports `previewBeforeCommit` if the
    // audition is ever wanted back; no game opts in today.

    // Prompt is the Danish word (Danish voice); tapping an option speaks the English word.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishTranslateGame
