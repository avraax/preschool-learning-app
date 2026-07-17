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

// Dansk til Engelsk: show + speak a Danish word the child knows (with emoji); the child
// picks the English equivalent (text). Bridges from the native language.
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
        // Baked soft-3D picture (PRD-07 hero path) + the Danish caption `word.da` beneath it
        // (rendered small via the engine's `qv.word` path — keep `emoji` set so the caption uses
        // the small type size, not the big word-only size). `emoji` is the art-gated fallback.
        // The English word ANSWERS stay type (the lesson — never baked).
        questionVisual: { emoji: word.emoji, word: word.da, art: englishArt(englishArtId(word.en)) }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      const level = progressStore.difficultyFor('english')
      return pickWordsForLevel(correctWord, level).map(toWordItem)
    },

    title: 'Dansk til Engelsk',
    emoji: '🔁',
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

    // Prompt is the Danish word (Danish voice); tapping an option speaks the English word.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishTranslateGame
