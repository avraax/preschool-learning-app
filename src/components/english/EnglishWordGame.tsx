import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickWordsForLevel, EnglishWord } from '../../config/englishVocab'
import { englishArt, englishArtId } from '../../assets/games/english'
import { progressStore } from '../../services/progressStore'
import { ENGLISH_QUIZ } from '../../config/difficulty'

// Difficulty (PRD-01 §4.4) is a table + ONE shared helper now: `pickWordsForLevel` in
// src/config/englishVocab.ts, driven by `ENGLISH_QUIZ[level]`. All three English quizzes share it — the
// per-game copies of this function were byte-identical, so a fix to one would silently have missed the
// others. Tiles 3/4/5; distractor theme different / random / same. The word POOL stays identical at every
// level (the deliberate beginner floor), and the three games' distinct skills are untouched.

// Find det Engelske Ord: show a baked picture, the child picks the correct written English word
// from 4 text options. Early English reading (meaning→print recognition).
//
// Liveliness PRD-17 W1 — differentiation: this game KEEPS its picture prompt; the sibling Dansk til
// Engelsk drops it and prompts with a Danish word instead. So Find = picture→English (recognition),
// Translate = Danish-word→English (translation) — two distinct skills. Both are winnable by a
// pre-reader because the PROMPT speaks the target word (here also alongside the picture), so the child
// matches sound + picture to print; the old two-tap tile audition was removed (see below).
const EnglishWordGame: React.FC = () => {
  const toWordItem = (w: EnglishWord): QuizItem => ({
    value: w.en,
    display: w.en,
    audioPrompt: w.en,
    repeatWord: w.en
  })

  const config: UnifiedQuizConfig = {
    quizType: 'english',

    generateQuizItem: () => {
      const word = quizEnglishWords[Math.floor(Math.random() * quizEnglishWords.length)]
      return {
        ...toWordItem(word),
        // Picture-only prompt; no word text under it. Baked soft-3D picture via `questionVisual.art`
        // (PRD-07 hero path) — every English word is baked now (PRD-12). The English word ANSWERS
        // stay type (the lesson — never baked).
        questionVisual: { word: '', art: englishArt(englishArtId(word.en)) }
      }
    },

    generateOptions: (correct: QuizItem, optionCount: number) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      const { theme } = ENGLISH_QUIZ[progressStore.difficultyFor('english')]
      return pickWordsForLevel(correctWord, theme, optionCount).map(toWordItem)
    },

    title: 'Find det Engelske Ord',
    teacherCharacter: 'owl',
    theme: getCategoryTheme('english'),
    backRoute: '/english',

    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishword',
    gameId: 'english.word',
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

    // Speak the target English word as an audio hint alongside the picture.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishWordGame
