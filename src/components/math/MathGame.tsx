import React from 'react'
import { Box, Typography } from '@mui/material'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Comprehensive math settings for counting quiz. Normal (today) = 1–50, unchanged/regression-safe.
// Difficulty (Overhaul §5.7/Appendix A) widens the range: Let 1–20, Svær 1–100.
const MAX_NUMBER_BY_LEVEL: Record<DifficultyLevel, number> = { let: 20, normal: 50, svaer: 100 }
const maxNumberForLevel = (level: DifficultyLevel): number => MAX_NUMBER_BY_LEVEL[level]

// Swap the tens/units digit of a two-digit number (23 → 32). Returns null for single-digit or
// palindromic numbers (11, 22, …) where the swap isn't a distinct confusable.
const swapDigits = (n: number): number | null => {
  if (n < 10) return null
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (tens === units) return null
  return units * 10 + tens
}

const makeNumberItem = (n: number): QuizItem => ({
  value: n,
  display: n,
  audioPrompt: DANISH_PHRASES.gamePrompts.findNumber(n),
  repeatWord: n.toString(),
})

// Small rotating set of counting glyphs for the PromptStage hero's object count. Picked
// deterministically from the number itself (NOT Math.random) so a) the same question always
// renders the same icon and b) it never consumes the seeded RNG stream used for content
// generation (which would desync `?seed=` determinism and the Normal-mode regression guarantee).
const HERO_COUNT_EMOJI = ['⭐', '🔵', '🟢', '🍎', '🎈', '🐳']
const MAX_HERO_DOTS = 20 // cap so Svær's up-to-100 values stay a tidy, uncluttered row/grid.

// Tal Quiz hero (UI/UX Overhaul §6A): the numeral rendered huge PLUS a matching count of small
// themed objects, so the prompt is never audio-only. Numbers above the cap still show the full
// numeral — only the decorative object row is capped for tidiness.
const renderCountingHero = (item: QuizItem): React.ReactNode => {
  const n = item.value as number
  const accent = getCategoryTheme('math').accentColor
  const dotCount = Math.max(0, Math.min(n, MAX_HERO_DOTS))
  const icon = HERO_COUNT_EMOJI[n % HERO_COUNT_EMOJI.length]

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 0,
        gap: { xs: 0.5, md: 1 },
        overflow: 'hidden',
      }}
    >
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          lineHeight: 1,
          userSelect: 'none',
          color: accent,
          fontSize: 'clamp(2.4rem, 9vh, 4.75rem)',
          [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.4rem, 13vh, 2.3rem)' },
        }}
      >
        {n}
      </Typography>
      {dotCount > 0 && (
        <Box
          aria-hidden
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignContent: 'center',
            gap: '4px',
            maxWidth: '100%',
            minHeight: 0,
          }}
        >
          {Array.from({ length: dotCount }).map((_, i) => (
            <Box
              key={i}
              component="span"
              sx={{
                fontSize: 'clamp(0.75rem, 3vh, 1.4rem)',
                lineHeight: 1,
                [PHONE_LANDSCAPE]: { fontSize: 'clamp(0.55rem, 3vh, 0.9rem)' },
              }}
            >
              {icon}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

const MathGame: React.FC = () => {
  // Configuration for counting quiz
  const countingConfig: UnifiedQuizConfig = {
    // Quiz identification
    quizType: 'counting',

    // Content generation
    generateQuizItem: () => {
      const maxNumber = maxNumberForLevel(progressStore.difficultyFor('math'))
      const number = Math.floor(Math.random() * maxNumber) + 1
      return makeNumberItem(number)
    },

    // Near-number distractors target real confusions — digit order (23↔32) and off-by-one/ten —
    // so a correct answer means something (vs the old purely-random options). Falls back to
    // random-in-range only when too few valid confusables exist (small/large edge numbers).
    generateOptions: (correctAnswer: QuizItem) => {
      const maxNumber = maxNumberForLevel(progressStore.difficultyFor('math'))
      const n = correctAnswer.value as number
      const confusables = [swapDigits(n), n - 1, n + 1, n - 10, n + 10]
        .filter((c): c is number => c !== null && c >= 1 && c <= maxNumber && c !== n)

      // Dedupe, shuffle, take up to 3 distinct confusables.
      const picks: number[] = []
      for (const c of confusables.sort(() => Math.random() - 0.5)) {
        if (picks.length >= 3) break
        if (!picks.includes(c)) picks.push(c)
      }
      // Top up with random distinct numbers if fewer than 3 confusables were available.
      while (picks.length < 3) {
        const r = Math.floor(Math.random() * maxNumber) + 1
        if (r !== n && !picks.includes(r)) picks.push(r)
      }

      const options: QuizItem[] = [correctAnswer, ...picks.map(makeNumberItem)]
      return options.sort(() => Math.random() - 0.5)
    },

    // Hero subject (Overhaul §6A) — huge numeral + matching object count, replacing the old
    // audio-only void.
    renderHero: renderCountingHero,
    
    // Display configuration
    title: 'Tal Quiz',
    emoji: '🧮',
    teacherCharacter: 'fox',
    theme: categoryThemes.math,
    backRoute: '/math',
    
    // Component configuration
    ScoreChipComponent: MathScoreChip,
    RepeatButtonComponent: MathRepeatButton,
    
    // Audio configuration
    gameWelcomeType: 'math',

    // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
    gameId: 'math.counting',
    round: { length: 8, starThresholds: { three: 0, two: 2 } },

    // Audio methods
    speakQuizPrompt: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    },
    
    speakClickedItem: async (item: QuizItem, audio: any) => {
      return audio.speakNumber(item.value as number)
    },
    
    getRepeatAudio: async (item: QuizItem, audio: any) => {
      return audio.speakQuizPromptWithRepeat(item.audioPrompt, item.repeatWord)
    }
  }

  return <UnifiedQuizGame config={countingConfig} />
}

export default MathGame