import React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { getCategoryTheme } from '../../config/categoryThemes'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { hexToRgba } from '../../theme/tokens/helpers'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Hvad Mangler? — a sequence is shown with one element replaced by ❓; the child picks
// the missing element. Covers number patterns, skip-counting (2s/5s/10s) and simple
// repeating visual patterns. Early-logic + skip-counting in one game.

const PATTERN_EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠', '⭐', '❤️']

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5)
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// Static, manual difficulty (UI/UX Overhaul PRD §5.7/Appendix A) — cumulative branch weights for
// {count-by-1, skip2, skip5, skip10}; the visual repeating pattern takes the remainder. 'normal'
// reproduces today's exact weights (0.25/0.20/0.15/0.12, remainder 0.28) unchanged.
const SEQUENCE_WEIGHTS: Record<DifficultyLevel, [number, number, number, number]> = {
  let: [0.55, 0.15, 0.05, 0.05], // count-by-1 weighted
  normal: [0.25, 0.2, 0.15, 0.12], // TODAY — mixed skip 2/5/10
  svaer: [0.1, 0.15, 0.3, 0.3], // skip 5/10 weighted
}

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

const HvadManglerGame: React.FC = () => {
  const reduce = useReducedMotion()
  const muiTheme = useTheme()
  const category = getCategoryTheme('math')

  const config: UnifiedQuizConfig = {
    quizType: 'counting',

    generateQuizItem: () => {
      // Static, manual difficulty (PRD §5.7/Appendix A) — read fresh per question. 'normal'
      // reproduces today's exact cutoffs (0.25/0.45/0.6/0.72) unchanged.
      const level = progressStore.difficultyFor('math')
      const [wBy1, wSkip2, wSkip5, wSkip10] = SEQUENCE_WEIGHTS[level]
      const cut1 = wBy1
      const cut2 = cut1 + wSkip2
      const cut3 = cut2 + wSkip5
      const cut4 = cut3 + wSkip10

      const r = Math.random()
      let value: string | number
      let display: string

      if (r < cut1) {
        // count by 1
        const seq = buildNumberSequence(randInt(1, 10), 1, 5)
        value = seq.missing
        display = seq.display
      } else if (r < cut2) {
        // skip by 2
        const seq = buildNumberSequence(randInt(0, 3) * 2, 2, 5)
        value = seq.missing
        display = seq.display
      } else if (r < cut3) {
        // skip by 5
        const seq = buildNumberSequence(5 * randInt(1, 3), 5, 5)
        value = seq.missing
        display = seq.display
      } else if (r < cut4) {
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
    theme: category,
    backRoute: '/math',

    ScoreChipComponent: MathScoreChip,
    RepeatButtonComponent: MathRepeatButton,

    gameWelcomeType: 'patterns',

    // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
    gameId: 'math.patterns',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // The welcome ("Hvad mangler") already asks the question, so don't voice the identical first
    // prompt right after it — otherwise the title is heard twice on entry.
    skipFirstPrompt: true,

    // PromptStage hero (§6A/Phase 5): the sequence rendered as individual slots, the blank "❓"
    // one pulsing so it reads as the thing to fill in (not just more sequence text).
    renderHero: (item: QuizItem) => {
      const tokens = (item.questionVisual?.word ?? '').split(/\s+/).filter(Boolean)
      if (tokens.length === 0) return null
      return (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, md: 2 },
            px: 1,
          }}
        >
          {tokens.map((token, i) => {
            const isBlank = token === '❓'
            return (
              <Box
                key={i}
                component={motion.span}
                animate={isBlank && !reduce ? { scale: [1, 1.18, 1] } : undefined}
                transition={isBlank && !reduce ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : undefined}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: { xs: '2.1rem', md: '3rem' },
                  lineHeight: 1,
                  fontWeight: 800,
                  userSelect: 'none',
                  fontSize: 'clamp(1.8rem, 7vh, 3.4rem)',
                  color: category.accentColor,
                  ...(isBlank && {
                    borderRadius: '16px',
                    border: `3px dashed ${hexToRgba(category.accentColor, muiTheme.scene.dark ? 0.7 : 0.55)}`,
                    bgcolor: hexToRgba(category.accentColor, 0.16),
                    textShadow: `0 0 16px ${hexToRgba(category.accentColor, 0.6)}`,
                    px: 0.5,
                  }),
                  // Phone landscape's PromptStage slot is short and shares its space with a
                  // (not phone-compact-aware) large RepeatButton, so the hero shrinks further here
                  // than the vh-clamp alone would give it, keeping the sequence clear of the frame.
                  [PHONE_LANDSCAPE]: {
                    fontSize: '1.05rem',
                    minWidth: '1.2rem',
                    ...(isBlank && {
                      border: `2px dashed ${hexToRgba(category.accentColor, muiTheme.scene.dark ? 0.7 : 0.55)}`,
                      px: 0.25,
                    }),
                  },
                }}
              >
                {token}
              </Box>
            )
          })}
        </Box>
      )
    },

    speakQuizPrompt: async (_item: QuizItem, audio: any) => audio.speak('Hvad mangler?'),
    speakClickedItem: async (item: QuizItem, audio: any) =>
      typeof item.value === 'number' ? audio.speakNumber(item.value) : Promise.resolve(''),
    getRepeatAudio: async (_item: QuizItem, audio: any) => audio.speak('Hvad mangler?')
  }

  return <UnifiedQuizGame config={config} />
}

export default HvadManglerGame
