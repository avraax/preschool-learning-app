import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { EnglishScoreChip } from '../common/ScoreChip'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickDistractorWords, EnglishWord } from '../../config/englishVocab'

// Find det Engelske Ord: show a picture (emoji), the child picks the correct written
// English word from 4 text options. Early English reading.
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
        // Picture-only prompt; no word text under the emoji.
        questionVisual: { emoji: word.emoji, word: '' }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      return pickDistractorWords(correctWord, 4).map(toWordItem)
    },

    title: 'Find det Engelske Ord',
    emoji: '🔤',
    teacherCharacter: 'owl',
    theme: categoryThemes.english,
    backRoute: '/english',

    ScoreChipComponent: EnglishScoreChip,
    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishword',
    gameId: 'english.word',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // Speak the target English word as an audio hint alongside the picture.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishWordGame
