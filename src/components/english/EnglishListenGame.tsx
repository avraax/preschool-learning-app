import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickWordsForLevel, EnglishWord } from '../../config/englishVocab'
import { ENGLISH_ROUND, englishPromptPool, englishWordKey } from '../../config/promptPools'
import { usePromptBag } from '../../hooks/usePromptBag'
import { englishArt, englishArtId } from '../../assets/games/english'
import { progressStore } from '../../services/progressStore'
import { ENGLISH_QUIZ } from '../../config/difficulty'

// Difficulty (PRD-01 §4.4) is a table + ONE shared helper now: `pickWordsForLevel` in
// src/config/englishVocab.ts, driven by `ENGLISH_QUIZ[level]`. All three English quizzes share it — the
// per-game copies of this function were byte-identical, so a fix to one would silently have missed the
// others. Tiles 3/4/5; distractor theme different / random / same. The word POOL stays identical at every
// level (the deliberate beginner floor), and the three games' distinct skills are untouched.

// Lyt og Find: the app speaks an English word (en-US Ava); the child taps the matching
// picture from 4 options. Pure listening comprehension.
const EnglishListenGame: React.FC = () => {
  // The ANSWER tiles are the pictures (the child taps the one matching the spoken word). Baked
  // soft-3D art via `QuizItem.art` (PRD-10 answer-tile path) — every English word is baked now
  // (PRD-12), so the picture always resolves; `display` is only the never-hit text fallback. The
  // listen PROMPT is never given a picture (would reveal the answer — §0.7), so no `questionVisual`.
  const toPictureItem = (w: EnglishWord): QuizItem => ({
    value: w.en,
    display: w.en,
    art: englishArt(englishArtId(w.en)),
    audioPrompt: w.en,
    repeatWord: w.en
  })

  // Prompt words come from a BAG, not a random pick (Practice Loop PRD-01 W1) — 8 of 74 words sampled
  // with replacement repeated ~30% of rounds. One shuffled pass = 8 distinct words.
  // `gameId` also wires W2's re-ask + front-load (order only — never the level).
  const wordBag = usePromptBag<EnglishWord>({
    key: englishWordKey,
    window: ENGLISH_ROUND,
    gameId: 'english.listen',
  })

  const config: UnifiedQuizConfig = {
    quizType: 'english',

    generateQuizItem: () => toPictureItem(wordBag.draw(englishPromptPool())),

    generateOptions: (correct: QuizItem, optionCount: number) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      const { theme } = ENGLISH_QUIZ[progressStore.difficultyFor('english')]
      return pickWordsForLevel(correctWord, theme, optionCount).map(toPictureItem)
    },

    title: 'Lyt og Find',
    teacherCharacter: 'owl',
    theme: getCategoryTheme('english'),
    backRoute: '/english',

    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishlisten',
    gameId: 'english.listen',
    // Star thresholds come from the difficulty spine (Difficulty PRD-01 W6). ONE round length: the
    // bag's no-repeat window reads the same constant (Practice Loop PRD-01 W1).
    round: { length: ENGLISH_ROUND },

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct picture tile pulses.
    hintAfterNWrong: 2,

    // The target word is spoken in English (en-US Ava); tapping a picture also speaks
    // its English word for reinforcement.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishListenGame
