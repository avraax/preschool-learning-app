import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { EnglishScoreChip } from '../common/ScoreChip'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickDistractorWords, englishThemes, EnglishWord } from '../../config/englishVocab'
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

    generateOptions: (correct: QuizItem) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      const level = progressStore.difficultyFor('english')
      return pickWordsForLevel(correctWord, level).map(toWordItem)
    },

    title: 'Dansk til Engelsk',
    teacherCharacter: 'owl',
    theme: getCategoryTheme('english'),
    backRoute: '/english',

    ScoreChipComponent: EnglishScoreChip,
    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishtranslate',
    gameId: 'english.translate',
    round: { length: 8, starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('english') },

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct word tile pulses.
    hintAfterNWrong: 2,

    // Hear-before-commit (PRD-14 W7): the answer tiles are WRITTEN English words a pre-reader can't
    // read, so the first tap auditions the tile's English word (raises it) and only a second tap
    // commits — the child hears the Danish prompt, then hears each English candidate before choosing.
    previewBeforeCommit: true,

    // Prompt is the Danish word (Danish voice); tapping an option speaks the English word.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishTranslateGame
