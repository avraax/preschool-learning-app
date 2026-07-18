import React from 'react'
import { Box, Typography } from '@mui/material'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem } from '../common/UnifiedQuizGame'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { progressStore, type DifficultyLevel } from '../../services/progressStore'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { shuffle } from '../../utils/shuffle'
import { countingObjectForNumber, artForObject } from '../../config/countingObjects'

// Comprehensive math settings for counting quiz. Difficulty (Overhaul §5.7/Appendix A) sets the
// range: Let 1–20, Normal 1–50, Svær 1–100. The manual adult-menu level stays authoritative.
const MAX_NUMBER_BY_LEVEL: Record<DifficultyLevel, number> = { let: 20, normal: 50, svaer: 100 }
const maxNumberForLevel = (level: DifficultyLevel): number => MAX_NUMBER_BY_LEVEL[level]

// Count-the-objects mode (PRD-05 P3): for n ≤ 20 the prompt HIDES the numeral, shows exactly n
// objects and asks the child "Hvor mange?" — so counting actually happens (a child who counts to
// 70 finds "find the giant 37" trivial symbol-matching). For n > 20 (only reachable on Normal/Svær)
// the numeral is shown and the task stays numeral recognition ("Find tallet 37"), with NO object
// row so the shown quantity can never contradict the numeral (the old capped-dots bug).
const COUNT_OBJECTS_MAX = 20
const isCountingMode = (n: number): boolean => n <= COUNT_OBJECTS_MAX

// Swap the tens/units digit of a two-digit number (23 → 32). Returns null for single-digit or
// palindromic numbers (11, 22, …) where the swap isn't a distinct confusable.
const swapDigits = (n: number): number | null => {
  if (n < 10) return null
  const tens = Math.floor(n / 10)
  const units = n % 10
  if (tens === units) return null
  return units * 10 + tens
}

// A number as a quiz item. In counting mode (n ≤ 20) the spoken prompt is "Hvor mange?" — it must
// NOT say the number (that would give away the answer to count). In numeral mode it's "Find tallet
// N". (For OPTION tiles the prompt/repeat text is unused, so the mode only matters for the target.)
const makeNumberItem = (n: number): QuizItem => ({
  value: n,
  display: n,
  audioPrompt: isCountingMode(n) ? 'Hvor mange?' : DANISH_PHRASES.gamePrompts.findNumber(n),
  repeatWord: isCountingMode(n) ? '' : n.toString(),
})

// The counting object is picked from the SHARED section set (src/config/countingObjects.ts) the same
// deterministic way everywhere — `countingObjectForNumber(n)` rotates by `n % 8` (NOT Math.random) so
// a) the same question always renders the same object and b) it never consumes the seeded RNG stream
// used for content generation (which would desync `?seed=`). Baked soft-3D WebP (PRD-08) when the art
// has landed; the object's emoji is the art-gated fallback.

// Object size shrinks as the pile grows so up to 20 stay tidy inside the hero. One clamp used for
// both the emoji fallback (fontSize) and the baked <img> (height) so the two look identical in scale.
const heroObjectFontSize = (n: number): string =>
  n <= 8 ? 'clamp(1.3rem, 5vh, 2.2rem)' : n <= 14 ? 'clamp(1rem, 4vh, 1.7rem)' : 'clamp(0.8rem, 3.2vh, 1.3rem)'
const HERO_OBJECT_PHONE_SIZE = 'clamp(0.6rem, 8vh, 1rem)'

// Tal Quiz hero (UI/UX Overhaul §6A / PRD-05 P3):
//   counting mode (n ≤ 20) → EXACTLY n objects, numeral HIDDEN — the child counts them.
//   numeral mode  (n > 20) → the numeral alone (no misleading object row) — numeral recognition.
const renderCountingHero = (item: QuizItem): React.ReactNode => {
  const n = item.value as number
  const accent = getCategoryTheme('math').accentColor

  if (!isCountingMode(n)) {
    return (
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          lineHeight: 1,
          userSelect: 'none',
          color: accent,
          fontSize: 'clamp(2.4rem, 12vh, 5.5rem)',
          [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.6rem, 14vh, 2.6rem)' },
        }}
      >
        {n}
      </Typography>
    )
  }

  const obj = countingObjectForNumber(n)
  const art = artForObject(obj)
  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
        alignItems: 'center',
        gap: { xs: '4px', md: '6px' },
        width: '100%',
        maxWidth: 520,
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {art
        ? Array.from({ length: n }).map((_, i) => (
            <Box
              key={i}
              component="img"
              src={art}
              alt=""
              draggable={false}
              sx={{
                height: heroObjectFontSize(n),
                width: 'auto',
                objectFit: 'contain',
                userSelect: 'none',
                pointerEvents: 'none',
                flex: '0 0 auto',
                [PHONE_LANDSCAPE]: { height: HERO_OBJECT_PHONE_SIZE },
              }}
            />
          ))
        : null}
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
      for (const c of shuffle(confusables)) {
        if (picks.length >= 3) break
        if (!picks.includes(c)) picks.push(c)
      }
      // Top up with random distinct numbers if fewer than 3 confusables were available.
      while (picks.length < 3) {
        const r = Math.floor(Math.random() * maxNumber) + 1
        if (r !== n && !picks.includes(r)) picks.push(r)
      }

      const options: QuizItem[] = [correctAnswer, ...picks.map(makeNumberItem)]
      return shuffle(options)
    },

    // Hero subject (Overhaul §6A) — huge numeral + matching object count, replacing the old
    // audio-only void.
    renderHero: renderCountingHero,
    
    // Display configuration
    title: 'Tal Quiz',
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
    round: { length: 8, starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('math') },

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct number tile pulses.
    hintAfterNWrong: 2,

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