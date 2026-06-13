import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { EnglishScoreChip } from '../common/ScoreChip'
import { EnglishRepeatButton } from '../common/RepeatButton'
import { quizEnglishWords, pickDistractorWords, EnglishWord } from '../../config/englishVocab'

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
        questionVisual: { emoji: word.emoji, word: word.da }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const correctWord = quizEnglishWords.find(w => w.en === correct.value) || quizEnglishWords[0]
      return pickDistractorWords(correctWord, 4).map(toWordItem)
    },

    title: 'Dansk til Engelsk',
    emoji: '🔁',
    teacherCharacter: 'owl',
    theme: categoryThemes.english,
    backRoute: '/english',

    ScoreChipComponent: EnglishScoreChip,
    RepeatButtonComponent: EnglishRepeatButton,

    gameWelcomeType: 'englishtranslate',

    // Prompt is the Danish word (Danish voice); tapping an option speaks the English word.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt)),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speakEnglish(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speak(String(item.audioPrompt))
  }

  return <UnifiedQuizGame config={config} />
}

export default EnglishTranslateGame
