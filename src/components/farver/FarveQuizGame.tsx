import React from 'react'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { ColorScoreChip } from '../common/ScoreChip'
import { ColorRepeatButton } from '../common/RepeatButton'
import { DANISH_OBJECTS, COLOR_SWATCH, HUE_ORDER } from '../../config/colorContent'

// Hvilken Farve? — show an object (emoji), the child taps the matching COLOR swatch.
// Tests object→color association (reasoning, non-reading) and adds tap variety to the section
// (the other color games are drag-based). Thin config over UnifiedQuizGame; the color tiles use
// the engine's `optionColor` swatch rendering. Educational color hexes come from colorContent.

interface QuizObject {
  color: string
  objectName: string
  objectNameDefinite: string
  emoji: string
}

// Flatten the shared object DB into a pool tagged with its (base) color.
const OBJECT_POOL: QuizObject[] = HUE_ORDER.flatMap((color) =>
  (DANISH_OBJECTS[color] ?? []).map((o) => ({
    color,
    objectName: o.objectName,
    objectNameDefinite: o.objectNameDefinite,
    emoji: o.emoji
  }))
)

// A color answer option carries its name (display) + true swatch hex (optionColor).
const toColorItem = (color: string): QuizItem => ({
  value: color,
  display: color,
  audioPrompt: color,
  repeatWord: color,
  optionColor: COLOR_SWATCH[color]
})

const FarveQuizGame: React.FC = () => {
  const config: UnifiedQuizConfig = {
    quizType: 'english', // generic tap-quiz behavior (distractors random); category styling via theme

    generateQuizItem: () => {
      const obj = OBJECT_POOL[Math.floor(Math.random() * OBJECT_POOL.length)]
      return {
        ...toColorItem(obj.color),
        // The spoken prompt asks the color of this object; the picture is the only visual cue.
        audioPrompt: `Hvilken farve er ${obj.objectNameDefinite}?`,
        questionVisual: { emoji: obj.emoji, word: '' }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const others = HUE_ORDER.filter((c) => c !== correct.value)
      // 3 random distractor colors + the correct one.
      const distractors = [...others].sort(() => Math.random() - 0.5).slice(0, 3)
      return [correct.value as string, ...distractors].map(toColorItem)
    },

    title: 'Hvilken Farve?',
    emoji: '🌈',
    teacherCharacter: 'fox',
    theme: categoryThemes.colors,
    backRoute: '/farver',

    ScoreChipComponent: ColorScoreChip,
    RepeatButtonComponent: ColorRepeatButton,

    gameWelcomeType: 'farvequiz',
    gameId: 'colors.quiz',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // Prompt asks for the object's color; tapping an option speaks that color name.
    speakQuizPrompt: async (item: QuizItem, audio: any) => audio.speak(item.audioPrompt),
    speakClickedItem: async (item: QuizItem, audio: any) => audio.speak(String(item.value)),
    getRepeatAudio: async (item: QuizItem, audio: any) => audio.speak(item.audioPrompt)
  }

  return <UnifiedQuizGame config={config} />
}

export default FarveQuizGame
