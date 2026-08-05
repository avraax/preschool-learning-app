import React from 'react'
import { Box } from '@mui/material'
import { Star, Heart } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import UnifiedQuizGame, { UnifiedQuizConfig, QuizItem, QUIZ_PROMPT_SLOT_ID } from '../common/UnifiedQuizGame'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { getCategoryTheme } from '../../config/categoryThemes'
import { MathRepeatButton } from '../common/RepeatButton'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { hexToRgba } from '../../theme/tokens/helpers'
import { idlePulse } from '../../theme/idleMotion'
import { HVAD_MANGLER_PROMPT, sequenceFactText } from '../../config/gamePhrases'
import { makeSequenceQuestion, sequenceDistractors } from '../../config/mathProblems'
import { progressStore } from '../../services/progressStore'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { shuffle } from '../../utils/shuffle'

// Hvad Mangler? — a sequence is shown with one element replaced by "?"; the child picks
// the missing element. Covers number patterns, skip-counting (2s/5s/10s) and simple
// repeating visual patterns. Early-logic + skip-counting in one game.

// Visual-pattern tokens (Liveliness PRD-12 §2B) — abstract colour/shape sequence pieces rendered as
// CSS clay pips (a tinted clay circle, or a filled clay star/heart), NOT emoji. The token is a stable
// id used for matching correct↔distractor; <ClayPip> owns the visual. The pattern lesson is the
// colour/shape sequence, which clay pips read more clearly than flat emoji (and need no baked art).
const PATTERN_TOKENS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'star', 'heart'] as const
type PatternToken = (typeof PATTERN_TOKENS)[number]

const PIP_COLOR: Record<PatternToken, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#FDE047',
  purple: '#A855F7',
  orange: '#F97316',
  star: '#FBBF24',
  heart: '#EF4444',
}

const isPatternToken = (t: string): t is PatternToken => (PATTERN_TOKENS as readonly string[]).includes(t)

// One clay pip — a colour circle, or a filled clay star/heart, at hero (in the focal zone) or tile
// (answer option) scale. Decorative (the pattern IS the lesson) → aria-hidden.
const ClayPip: React.FC<{ token: string; variant: 'hero' | 'tile' }> = ({ token, variant }) => {
  const color = isPatternToken(token) ? PIP_COLOR[token] : '#94A3B8'
  const dim = variant === 'hero' ? { xs: '2.4rem', md: '3.2rem' } : { xs: '3rem', md: '3.9rem' }
  const phoneDim = variant === 'hero' ? '1.5rem' : '2rem'
  const sizeSx = { width: dim, height: dim, [PHONE_LANDSCAPE]: { width: phoneDim, height: phoneDim } }

  if (token === 'star' || token === 'heart') {
    const Icon = token === 'star' ? Star : Heart
    return (
      <Box
        aria-hidden
        sx={[
          sizeSx,
          {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
            '& svg': { width: '100%', height: '100%' },
          },
        ]}
      >
        <Icon fill="currentColor" strokeWidth={0} />
      </Box>
    )
  }

  return (
    <Box
      aria-hidden
      sx={[
        sizeSx,
        {
          borderRadius: '50%',
          backgroundColor: color,
          backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%)',
          boxShadow: `0 6px 14px ${hexToRgba(color, 0.5)}, inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 7px rgba(0,0,0,0.14)`,
        },
      ]}
    />
  )
}

// Sequence generation moved to `src/config/mathProblems.ts` (Difficulty PRD-01 W2): the branch weights
// AND the START are now level-scaled and drawn from `sequenceSpecsForLevel`, so every sequence the game
// emits is one the prebake enumerator baked a read-back for. Before this, skip-10 always emitted the
// identical `10 20 30 40 50` — 30% of every Svær round — and no range moved with the level at all.
// This component keeps the VISUALS: the clay-pip tokens (which are React, not data) and the hero.

// Render a numeric sequence's display string, with the missing slot blanked to "?".
const numberDisplay = (numbers: number[], missingIndex: number): string =>
  numbers.map((n, i) => (i === missingIndex ? '?' : String(n))).join('   ')

// Build the visual repeating pattern's tokens from the pure question's shape (unit size + length).
const patternDisplay = (unitSize: number, length: number, missingIndex: number) => {
  const unit = shuffle([...PATTERN_TOKENS]).slice(0, unitSize)
  const full = Array.from({ length }, (_, i) => unit[i % unit.length])
  return { missing: full[missingIndex], display: full.map((e, i) => (i === missingIndex ? '?' : e)).join('  ') }
}

/**
 * The completed sequence, read aloud: "to, fire, seks, otte, ti". Used by BOTH the correct-answer fact
 * and the never-fail hint (Practice Loop PRD-01 W3) — the same function rather than two copies, so the
 * hint can never drift from the fact. A visual (pip) pattern has no natural spoken form, so it returns
 * '' and stays silent in both.
 */
const sequenceFact = async (item: QuizItem, audio: any): Promise<string> => {
  const tokens = (item.questionVisual?.word ?? '').split(/\s+/).filter(Boolean)
  const filled = tokens.map((t) => (t === '?' ? String(item.value) : t))
  if (filled.length > 0 && filled.every((t) => /^\d+$/.test(t))) {
    return audio.speak(sequenceFactText(filled.map(Number)))
  }
  return ''
}

const HvadManglerGame: React.FC = () => {
  const reduce = useReducedMotion()
  const blankPulse = idlePulse(reduce, { peak: 1.18, durationS: 1.1, as: 'span' })
  const muiTheme = useTheme()
  const category = getCategoryTheme('math')

  const config: UnifiedQuizConfig = {
    quizType: 'counting',

    generateQuizItem: () => {
      // Static, manual difficulty — read fresh per question. The pure generator owns the branch
      // weights AND the level-scaled random start (Let ≤10 · Normal ≤40 · Svær ≤60, every element ≤100).
      const q = makeSequenceQuestion(progressStore.difficultyFor('math'))

      if (q.kind === 'pattern') {
        const { missing, display } = patternDisplay(q.unitSize, q.length, q.missingIndex)
        return {
          value: missing,
          display: missing,
          // The correct option's tile renders a clay pip (PRD-12 §2B), not the id text.
          node: <ClayPip token={missing} variant="tile" />,
          audioPrompt: HVAD_MANGLER_PROMPT,
          repeatWord: '',
          questionVisual: { emoji: '', word: display }
        }
      }

      return {
        value: q.missing,
        display: q.missing,
        audioPrompt: HVAD_MANGLER_PROMPT,
        repeatWord: '',
        questionVisual: { emoji: '', word: numberDisplay(q.numbers, q.missingIndex) }
      }
    },

    generateOptions: (correct: QuizItem, optionCount: number) => {
      const options: QuizItem[] = [correct]

      if (typeof correct.value === 'number') {
        // Near-value distractors (PRD-14 W2 / audit §A6): ±1/±2 neighbours first so a wrong option is a
        // real sequence error, not a far +10 outlier; +5/+10 are the fallback tail so the tile count is
        // always met (5 tiles at Svær need one more than the four near neighbours can give).
        for (const n of sequenceDistractors(correct.value, optionCount - 1)) {
          options.push({ value: n, display: n, audioPrompt: '', repeatWord: '' })
        }
      } else {
        for (const tk of shuffle([...PATTERN_TOKENS])) {
          if (options.length >= optionCount) break
          if (!options.find(o => o.value === tk)) {
            options.push({ value: tk, display: tk, node: <ClayPip token={tk} variant="tile" />, audioPrompt: '', repeatWord: '' })
          }
        }
      }

      return shuffle(options)
    },

    title: 'Hvad Mangler?',
    teacherCharacter: 'fox',
    theme: category,
    backRoute: '/math',

    RepeatButtonComponent: MathRepeatButton,

    gameWelcomeType: 'patterns',

    // Bounded round + reward flow (Foundation §3). 8 questions; star thresholds come from the
    // difficulty spine (Difficulty PRD-01 W6).
    gameId: 'math.patterns',
    round: { length: 8 },

    // Never-fail hint (PRD-05 P1): after 2 wrong taps the correct tile pulses.
    hintAfterNWrong: 2,

    // The welcome ("Hvad mangler") already asks the question, so don't voice the identical first
    // prompt right after it — otherwise the title is heard twice on entry.
    skipFirstPrompt: true,

    // Answer by TAP or by DRAG onto the "?" (owner, 2026-08-03). This is the only config quiz that
    // opts in, because it is the only one whose PROMPT contains the slot the answer belongs in — the
    // others ask a question ("which letter does this start with?") and would need an invented drop
    // target. The engine wires the whole gesture; this config only has to make its blank the zone.
    dragToPromptSlot: true,

    // Focal hero (§6A/Phase 5): the sequence rendered as individual slots, the blank "?" one pulsing
    // so it reads as the thing to fill in. Visual-pattern slots render CSS clay pips (PRD-12 §2B); the
    // numeric slots + the blank stay type. The blank is also the DROP ZONE (see dragToPromptSlot):
    // `dropActive` rings it while a tile hovers.
    renderHero: (item: QuizItem, { dropActive }) => {
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
            const isBlank = token === '?'
            // A colour/shape token → a clay pip (never the id text).
            if (!isBlank && isPatternToken(token)) {
              return <ClayPip key={i} token={token} variant="hero" />
            }
            const slot = (
              <Box
                key={i}
                component="span"
                // The blank slot's "put something here" pulse — CSS keyframes, same 1.18 / 1.1s
                // (Performance PRD-01 W1). No framer transform on this element, so it can carry it.
                {...blankPulse.props}
                sx={[{
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
                }, isBlank ? blankPulse.sx : {}]}
              >
                {token}
              </Box>
            )
            // Only the blank is a drop target — the filled slots are already answered.
            if (!isBlank) return slot
            return (
              <DroppableZone
                key={i}
                id={QUIZ_PROMPT_SLOT_ID}
                // The cue is the accent ring: a white wash inside a dashed accent box reads as a
                // rendering glitch on the light skins.
                overColor="transparent"
                style={{
                  borderRadius: '20px',
                  outline: dropActive ? `4px solid ${category.accentColor}` : '4px solid transparent',
                  outlineOffset: '4px',
                  transition: 'outline-color 0.2s ease',
                }}
              >
                {slot}
              </DroppableZone>
            )
          })}
        </Box>
      )
    },

    speakQuizPrompt: async (_item: QuizItem, audio: any) => audio.speak(HVAD_MANGLER_PROMPT),
    speakClickedItem: async (item: QuizItem, audio: any) =>
      typeof item.value === 'number' ? audio.speakNumber(item.value) : Promise.resolve(''),
    getRepeatAudio: async (_item: QuizItem, audio: any) => audio.speak(HVAD_MANGLER_PROMPT),

    // Speak the fact (PRD-05 P2): on a correct answer, read the COMPLETED sequence aloud (the blank
    // filled with the answer) — e.g. "to, fire, seks, otte, ti" — reinforcing the pattern. Visual
    // (emoji) patterns have no natural spoken fact, so they stay silent (as before).
    speakCorrectFact: sequenceFact,

    // The never-fail hint speaks the SAME completed sequence (Practice Loop PRD-01 W3) — the one line
    // that names the answer here, already baked for every sequence. Deliberately the identical function,
    // not a copy: the two must never drift, and a visual pattern stays silent in both.
    speakHint: sequenceFact,
  }

  return <UnifiedQuizGame config={config} />
}

export default HvadManglerGame
