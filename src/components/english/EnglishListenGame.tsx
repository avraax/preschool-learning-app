import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { EnglishScoreChip } from '../common/ScoreChip'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickDistractorWords, EnglishWord } from '../../config/englishVocab'

// Lyt og Find: the app speaks an English word (en-GB); the child taps the matching
// picture from 4 options. Pure listening comprehension.
const EnglishListenGame: React.FC = () => {
  const toPictureItem = (w: EnglishWord): QuizItem => ({
    value: w.en,
    display: w.emoji,
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
      return pickDistractorWords(correctWord, 4).map(toPictureItem)
    },

    title: 'Lyt og Find',
    emoji: '👂',
    teacherCharacter: 'owl',
    theme: categoryThemes.english,
    backRoute: '/english',

    ScoreChipComponent: EnglishScoreChip,
    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishlisten',
    gameId: 'english.listen',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // The target word is spoken in British English; tapping a picture also speaks
    // its English word for reinforcement.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishListenGame
