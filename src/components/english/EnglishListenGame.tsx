import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { EnglishScoreChip } from '../common/ScoreChip'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickDistractorWords, englishThemes, EnglishWord } from '../../config/englishVocab'
import { englishArt, englishArtId } from '../../assets/games/english'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { shuffle } from '../../utils/shuffle'

// Difficulty-aware distractor pool (Overhaul §6A/Appendix A). Normal is untouched — today's fully
// random `pickDistractorWords` across all mixed themes (regression-safe). Svær biases toward
// SAME-theme words (harder to tell apart — e.g. cow vs horse, not cow vs apple); Let biases toward
// a DIFFERENT theme (maximally distinct/easy). The shared quiz grid is fixed at 4 tiles, so this
// raises difficulty via word choice rather than distractor COUNT.
const themeMatesOf = (word: EnglishWord): EnglishWord[] => {
  const theme = englishThemes.find(t => t.words.some(w => w.en === word.en))
  return (theme ? theme.words : quizEnglishWords).filter(w => w.en !== word.en)
}

const pickWordsForLevel = (correct: EnglishWord, level: DifficultyLevel): EnglishWord[] => {
  if (level === 'normal') return pickDistractorWords(correct, 4)

  const sameTheme = themeMatesOf(correct)
  const biasPool =
    level === 'svaer'
      ? sameTheme
      : quizEnglishWords.filter(w => w.en !== correct.en && !sameTheme.some(s => s.en === w.en))

  const picks: EnglishWord[] = []
  for (const w of shuffle(biasPool)) {
    if (picks.length >= 3) break
    picks.push(w)
  }
  // Top up from the general pool if a theme was too small to fill 3 distractors.
  if (picks.length < 3) {
    for (const w of pickDistractorWords(correct, 4)) {
      if (picks.length >= 3) break
      if (w.en !== correct.en && !picks.some(p => p.en === w.en)) picks.push(w)
    }
  }
  return shuffle([correct, ...picks])
}

// Lyt og Find: the app speaks an English word (en-US Ava); the child taps the matching
// picture from 4 options. Pure listening comprehension.
const EnglishListenGame: React.FC = () => {
  // The ANSWER tiles are the pictures (the child taps the one matching the spoken word). Baked
  // soft-3D art via `QuizItem.art` (PRD-10 answer-tile path); `display` emoji is the art-gated
  // fallback (still live for the not-yet-baked greetings/body/family — PRD-12 Phase B). The listen
  // PROMPT is never given a picture (would reveal the answer — §0.7), so no `questionVisual` here.
  const toPictureItem = (w: EnglishWord): QuizItem => ({
    value: w.en,
    display: w.emoji,
    art: englishArt(englishArtId(w.en)),
    audioPrompt: w.en,
    repeatWord: w.en
  })

  const config: UnifiedQuizConfig = {
    quizType: 'english',

    generateQuizItem: () => {
      const word = quizEnglishWords[Math.floor(Math.random() * quizEnglishWords.length)]
      return toPictureItem(word)
    },

    generateOptions: (correct: QuizItem) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      const level = progressStore.difficultyFor('english')
      return pickWordsForLevel(correctWord, level).map(toPictureItem)
    },

    title: 'Lyt og Find',
    teacherCharacter: 'owl',
    theme: getCategoryTheme('english'),
    backRoute: '/english',

    ScoreChipComponent: EnglishScoreChip,
    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishlisten',
    gameId: 'english.listen',
    round: { length: 8, starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('english') },

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
