import React from 'react'
import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { categoryThemes } from '../../config/categoryThemes'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import CountingAid from '../common/CountingAid'

// Hvad Mangler? — a sequence is shown with one element replaced by ❓; the child picks
// the missing element. Covers number patterns, skip-counting (2s/5s/10s) and simple
// repeating visual patterns. Early-logic + skip-counting in one game.

const PATTERN_EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '⭐', '❤️']

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// Build a numeric sequence with one slot blanked out.
const buildNumberSequence = (start: number, step: number, length: number) => {
  const full = Array.from({ length }, (_, i) => start + i * step)
  // Prefer blanking the last or a middle slot (not the first, which gives no context).
  const missingIndex = Math.random() < 0.5 ? length - 1 : randInt(1, length - 1)
  const missing = full[missingIndex]
  const display = full.map((n, i) => (i === missingIndex ? '❓' : String(n))).join('   ')
  return { missing, display }
}

const buildVisualPattern = () => {
  // Repeating pattern from 2-3 distinct emojis, e.g. ABAB? or ABCABC?
  const palette = shuffle(PATTERN_EMOJIS)
  const unit = palette.slice(0, Math.random() < 0.5 ? 2 : 3)
  const length = unit.length === 2 ? 5 : 6
  const full = Array.from({ length }, (_, i) => unit[i % unit.length])
  const missingIndex = Math.random() < 0.6 ? length - 1 : randInt(1, length - 1)
  const missing = full[missingIndex]
  const display = full.map((e, i) => (i === missingIndex ? '❓' : e)).join('  ')
  return { missing, display, pool: unit }
}

// Count-through scaffold (Math Overhaul §5). Renders the *visible* sequence so the child can see
// the step size / repeating unit — but NEVER reveals the ❓ blank (it stays a question mark).
// Numeric sequences → each visible number as a small ten-frame under its numeral. Visual patterns
// → the repeating emojis gently pulse so the unit stands out.
const SequenceAid: React.FC<{ display: string; accent: string }> = ({ display, accent }) => {
  const tokens = display.trim().split(/\s+/).filter(Boolean)
  const isNumeric = tokens.every((t) => t === '❓' || /^\d+$/.test(t))

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: { xs: 1, md: 1.5 },
        maxWidth: '100%',
      }}
    >
      {tokens.map((tok, i) => {
        const isBlank = tok === '❓'
        if (isNumeric) {
          return (
            <Box
              key={i}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, minWidth: 0 }}
            >
              <Typography
                sx={{
                  fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                  fontWeight: 700,
                  fontSize: 'clamp(1.1rem, 4vw, 1.8rem)',
                  color: isBlank ? accent : 'inherit',
                  lineHeight: 1,
                }}
              >
                {tok}
              </Typography>
              {!isBlank && (
                <CountingAid mode="value" value={Number(tok)} accent={accent} open />
              )}
            </Box>
          )
        }
        // Visual emoji pattern: pulse the visible emojis; the blank stays ❓.
        return (
          <Box
            key={i}
            component={motion.div}
            animate={isBlank ? undefined : { scale: [1, 1.14, 1] }}
            transition={isBlank ? undefined : { duration: 1.4, repeat: Infinity, delay: i * 0.18 }}
            sx={{ fontSize: 'clamp(1.6rem, 7vw, 2.6rem)', lineHeight: 1 }}
          >
            {tok}
          </Box>
        )
      })}
    </Box>
  )
}

const HvadManglerGame: React.FC = () => {
  const config: UnifiedQuizConfig = {
    quizType: 'counting',

    generateQuizItem: () => {
      const r = Math.random()
      let value: string | number
      let display: string

      if (r < 0.25) {
        // count by 1
        const seq = buildNumberSequence(randInt(1, 10), 1, 5)
        value = seq.missing
        display = seq.display
      } else if (r < 0.45) {
        // skip by 2
        const seq = buildNumberSequence(randInt(0, 3) * 2, 2, 5)
        value = seq.missing
        display = seq.display
      } else if (r < 0.6) {
        // skip by 5
        const seq = buildNumberSequence(5 * randInt(1, 3), 5, 5)
        value = seq.missing
        display = seq.display
      } else if (r < 0.72) {
        // skip by 10
        const seq = buildNumberSequence(10, 10, 5)
        value = seq.missing
        display = seq.display
      } else {
        // visual repeating pattern
        const seq = buildVisualPattern()
        value = seq.missing
        display = seq.missing
        return {
          value,
          display,
          audioPrompt: 'Hvad mangler?',
          repeatWord: '',
          questionVisual: { emoji: '', word: seq.display }
        }
      }

      return {
        value,
        display: value,
        audioPrompt: 'Hvad mangler?',
        repeatWord: '',
        questionVisual: { emoji: '', word: display }
      }
    },

    generateOptions: (correct: QuizItem) => {
      const options: QuizItem[] = [correct]

      if (typeof correct.value === 'number') {
        const base = correct.value
        const candidates = shuffle([base - 2, base - 1, base + 1, base + 2, base + 5, base + 10])
          .filter(n => n >= 0 && n !== base)
        for (const n of candidates) {
          if (options.length >= 4) break
          if (!options.find(o => o.value === n)) {
            options.push({ value: n, display: n, audioPrompt: '', repeatWord: '' })
          }
        }
      } else {
        const pool = shuffle(PATTERN_EMOJIS)
        for (const e of pool) {
          if (options.length >= 4) break
          if (!options.find(o => o.value === e)) {
            options.push({ value: e, display: e, audioPrompt: '', repeatWord: '' })
          }
        }
      }

      return shuffle(options)
    },

    title: 'Hvad Mangler?',
    emoji: '🧩',
    teacherCharacter: 'fox',
    theme: categoryThemes.math,
    backRoute: '/math',

    ScoreChipComponent: MathScoreChip,
    RepeatButtonComponent: MathRepeatButton,

    gameWelcomeType: 'patterns',

    // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
    gameId: 'math.patterns',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // Count-through scaffold over the visible sequence (never reveals the ❓ blank).
    aidContent: (item: QuizItem) =>
      item.questionVisual?.word
        ? <SequenceAid display={item.questionVisual.word} accent={categoryThemes.math.accentColor} />
        : null,

    speakQuizPrompt: async (_item: QuizItem, audio: any) => audio.speak('Hvad mangler?'),
    speakClickedItem: async (item: QuizItem, audio: any) =>
      typeof item.value === 'number' ? audio.speakNumber(item.value) : Promise.resolve(''),
    getRepeatAudio: async (_item: QuizItem, audio: any) => audio.speak('Hvad mangler?')
  }

  return <UnifiedQuizGame config={config} />
}

export default HvadManglerGame
