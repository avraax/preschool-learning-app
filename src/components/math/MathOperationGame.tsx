import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Typography, Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { DANISH_PHRASES, getDanishNumberText } from '../../config/danish-phrases'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import PromptFocus from '../common/PromptFocus'
import SymbolTile from '../common/SymbolTile'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import RoundResultScreen from '../common/RoundResultScreen'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useDifficulty } from '../../hooks/useDifficulty'
import { isIOS } from '../../utils/deviceDetection'
import { devFx } from '../../utils/devHarness'
import { POP, DWELL_CORRECT, motionOr } from '../../theme/motion'
import { darken, hexToRgba, tileSurface } from '../../theme/tokens/helpers'
import { softShadow } from '../../theme/depth'
import { shuffle } from '../../utils/shuffle'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Unified addition/subtraction game. Behaviour and difficulty ranges are preserved
// exactly from the previous AdditionGame/SubtractionGame for 'normal'; only the operator,
// problem generation, spoken prompt, title and welcome differ by `operation`.
//
// Games Visual Uplift (PRD-08 §3.3): the equation "number sentence" now rests as CLAY in
// PromptFocus's in-world light-pool — the frosted PromptStage card (border + backdrop-filter) is
// retired. On a correct answer the "?" flips to the revealed answer with a motion.POP before the
// unified DWELL_CORRECT auto-advance — that bespoke reveal is preserved exactly; only its container
// material changed.
interface MathOperationGameProps {
  operation: 'addition' | 'subtraction'
}

// W1 (PRD-15) — concrete quantity layer: a ten-frame the child can actually COUNT so a finger-counter
// can *solve* the number sentence instead of guessing (he adds to 20 on his fingers; a symbol-only
// board gave him nothing to count). Pure CSS dots, NO art.
//   Addition a+b: `a` dots in tint A then `b` dots in tint B, filled continuously across one or two
//     ten-frames so crossing-ten is legible (the first frame fills to 10, the second begins).
//   Subtraction a−b: `a` dots with the last `b` faded + struck through ("take away"); the remaining
//     filled dots = the answer.
// Two ten-frames sit side by side (10 cols × 2 rows) so it stays SHORT (2 rows) under the equation and
// never scrolls. Reduced motion → static (no per-dot pop-in). Tints are two guaranteed-distinct,
// skin-aware section accents (token contract §2: every skin gives the 5 sections readable accents).
type ConcreteOp = MathOperationGameProps['operation']
const TenFrameLayer: React.FC<{ op: ConcreteOp; a: number; b: number; reduce: boolean; dark: boolean }> = ({
  op,
  a,
  b,
  reduce,
  dark,
}) => {
  const tintA = getCategoryTheme('math').accentColor
  const tintB = getCategoryTheme('alphabet').accentColor
  const total = op === 'addition' ? a + b : a
  const capacity = total <= 10 ? 10 : 20
  type Fill = 'empty' | 'a' | 'b' | 'remain' | 'removed'
  const cells: Fill[] = Array.from({ length: capacity }, (_, i) => {
    if (op === 'addition') return i < a ? 'a' : i < a + b ? 'b' : 'empty'
    return i < a - b ? 'remain' : i < a ? 'removed' : 'empty'
  })
  const frames = capacity === 20 ? [cells.slice(0, 10), cells.slice(10, 20)] : [cells]

  const cellSx = {
    width: { xs: 14, md: 19 },
    height: { xs: 14, md: 19 },
    borderRadius: '4px',
    border: `1.5px solid ${hexToRgba(tintA, dark ? 0.45 : 0.22)}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    '@media (orientation: landscape)': { width: { xs: 13, md: 19 }, height: { xs: 13, md: 19 } },
    [PHONE_LANDSCAPE]: { width: 9, height: 9, borderRadius: '2px' },
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, md: 1.5 }, [PHONE_LANDSCAPE]: { gap: 0.5 } }}>
      {frames.map((frame, fi) => (
        <Box
          key={fi}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, auto)',
            gridAutoRows: 'auto',
            gap: { xs: '2px', md: '3px' },
            [PHONE_LANDSCAPE]: { gap: '1px' },
          }}
        >
          {frame.map((c, i) => {
            const filled = c !== 'empty'
            const removed = c === 'removed'
            const color = c === 'b' ? tintB : tintA
            return (
              <Box key={i} sx={cellSx}>
                {filled && (
                  <Box
                    component={motion.div}
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: removed ? 0.32 : 1 }}
                    transition={reduce ? undefined : { delay: (fi * 10 + i) * 0.03, type: 'spring', stiffness: 500, damping: 24 }}
                    sx={{ width: '68%', height: '68%', borderRadius: '50%', bgcolor: color }}
                  />
                )}
                {removed && (
                  <Box
                    sx={{
                      position: 'absolute',
                      width: '118%',
                      height: 2,
                      bgcolor: tintA,
                      transform: 'rotate(-45deg)',
                      borderRadius: 2,
                    }}
                  />
                )}
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

const MathOperationGame: React.FC<MathOperationGameProps> = ({ operation }) => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const category = getCategoryTheme('math')
  // Phone landscape's PromptStage slot is short (~26-34% of an already-short body) — the repeat
  // button shrinks there so the equation keeps its full height instead of being squeezed/clipped.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))
  const isAddition = operation === 'addition'
  const title = isAddition ? 'Plus Opgaver' : 'Minus Opgaver'
  const operator = isAddition ? '+' : '-'
  const gameId = isAddition ? 'math.addition' : 'math.subtraction'

  const [num1, setNum1] = useState<number | null>(null)
  const [num2, setNum2] = useState<number | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
  const [options, setOptions] = useState<number[]>([])
  // Feedback for the most-recently tapped answer + the corner guide reaction.
  const [feedback, setFeedback] = useState<{ value: number; correct: boolean } | null>(null)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  // The equation's "?" flips to the revealed answer (motion.POP) once the tapped tile is correct.
  const [revealAnswer, setRevealAnswer] = useState(false)

  const audio = useSimplifiedAudioHook({
    componentId: isAddition ? 'AdditionGame' : 'SubtractionGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const hasInitialized = useRef(false)
  // Guards the actual start (runs once regardless of which path triggers it) and the welcome
  // (plays at most once even if audio unlocks after mount). Mirrors UnifiedQuizGame's resilient
  // start so a child is never stranded on an empty board when audio isn't unlocked at mount.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)

  const { incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()

  // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 }, gameId })
  // True until the first wrong tile is tapped for the current problem (gates streak/star).
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // The post-correct celebration/advance timer (PRD-02 P1/P4) — tracked so it's cleared on unmount
  // (no ghost prompt on the next screen) and never runs twice.
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Advance-lock (PRD-02 P1/P2): set synchronously on a correct tap so a rapid double-tap can't
  // double-record the round and a tap during the celebration dwell can't poison the earned
  // first-try. A ref so it's readable synchronously within the same event-loop tick.
  const isAdvancingRef = useRef(false)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)
  // False after unmount (PRD-02 P4): the advance timer is scheduled after the `await speakNumber`
  // echo, so this flag stops the post-await continuation from scheduling a ghost prompt if the child
  // navigates away during the echo. Owned by its own effect so StrictMode's dev remount restores it.
  const mountedRef = useRef(true)
  // Live current problem (so it can be voiced after the welcome) + interaction guard (so a late
  // welcome never talks over active play).
  const problemRef = useRef<{ a: number; b: number } | null>(null)
  // Per-problem key namespace so option tiles never reuse a motion.div across problems (which would
  // skip the enter animation on a shared value at the same index). Mirrors SpellingGame's wordSeq.
  const optionSeq = useRef(0)
  const hasInteractedRef = useRef(false)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 ${isAddition ? 'AdditionGame' : 'SubtractionGame'}: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the playable board immediately (tappable), no waiting on the welcome.
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenProblem()
    }

    // Empty-dep effect → this cleanup runs once, on unmount: clear every pending timer so no
    // prompt/advance callback fires after the component is gone (ghost TTS on the next screen).
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current)
        advanceTimerRef.current = null
      }
      if (guideReactionTimer.current) {
        clearTimeout(guideReactionTimer.current)
        guideReactionTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Owns the mounted flag (PRD-02 P4, StrictMode-safe): true on (re)mount, false on unmount.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // When audio unlocks after mount, play the welcome (board already visible). Interaction-guarded
  // inside playWelcomeThenProblem so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenProblem()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Instant load: render the playable board RIGHT AWAY without voicing the first problem yet — the
  // welcome narrates over the visible board and the spoken problem follows it. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewProblem(false)
  }

  // Play the welcome over the already-visible board, then voice the first problem. Self-guards;
  // skips the trailing problem if the child already started tapping.
  const playWelcomeThenProblem = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome(operation)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (problemRef.current && !hasInteractedRef.current) {
      speakProblem(problemRef.current.a, problemRef.current.b)
    }
  }

  // `voice=false` renders the board without voicing the problem (used for the first problem, which
  // is voiced after the welcome instead).
  const generateNewProblem = (voice = true) => {
    // Clear the previous answer's feedback + guide reaction before the new problem appears.
    setFeedback(null)
    setGuideReaction(null)
    setRevealAnswer(false)
    // New problem → first attempt fresh again and the advance-lock releases (tiles tappable again).
    firstAttemptRef.current = true
    isAdvancingRef.current = false

    // Static, manual difficulty (UI/UX Overhaul PRD §5.7/Appendix A) — read fresh per problem.
    // 'normal' reproduces today's exact ranges unchanged.
    const level = progressStore.difficultyFor('math')
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

    let firstNum: number
    let secondNum: number
    let answer: number

    if (isAddition) {
      if (level === 'let') {
        // Let: sums ≤10.
        firstNum = randInt(1, 9)
        secondNum = randInt(1, Math.max(1, 10 - firstNum))
      } else if (level === 'svaer') {
        // Svær: sums ≤20, biased so almost every problem carries (crosses the ten).
        firstNum = randInt(2, 10)
        secondNum = randInt(Math.max(1, 10 - firstNum), 10)
      } else {
        // Normal (PRD-05 P3): sums ≤20 (matches "adds to 20"), but both addends ≥2 so the floor
        // isn't trivial (+1 / tiny sums). The child adds to 20 on fingers, so this is his level.
        firstNum = randInt(2, 10)
        const maxSecondNum = Math.min(20 - firstNum, 10) // ensure sum ≤ 20
        secondNum = randInt(2, Math.max(2, maxSecondNum))
      }
      answer = firstNum + secondNum
    } else {
      if (level === 'let') {
        // Let: minuend ≤10, no borrow (kept single-digit so there's no "10 minus x" crossing).
        firstNum = randInt(1, 9)
        secondNum = randInt(1, firstNum)
      } else if (level === 'svaer') {
        // Svær: two-digit minuend (11–20) so it's clearly harder than Normal.
        firstNum = randInt(11, 20)
        secondNum = randInt(1, firstNum - 1)
      } else {
        // Normal (PRD-05 P3): minuend up to 20 (was ≤10 — the harder range used to be gated behind
        // Svær). Result ≥1 so there's always a real subtraction to do.
        firstNum = randInt(2, 20)
        secondNum = randInt(1, firstNum - 1)
      }
      answer = firstNum - secondNum // non-negative
    }

    setNum1(firstNum)
    setNum2(secondNum)
    setCorrectAnswer(answer)
    problemRef.current = { a: firstNum, b: secondNum }

    // Near-answer distractors (off-by-one/two + the operands) clamped to the valid result range,
    // so wrong options are plausible confusions rather than random noise. Top up with random
    // in-range values only if too few distinct confusables exist.
    const lo = isAddition ? 1 : 0
    // Subtraction results now reach 19 on Normal/Svær (P3), so distractors must span up to 20 there
    // (only Let stays single-digit). Otherwise a right answer like 15 could get ≤10 distractors,
    // making it trivially obvious.
    const hi = isAddition ? 20 : (level === 'let' ? 10 : 20)
    const confusables = (isAddition
      ? [answer - 1, answer + 1, answer - 2, answer + 2]
      : [answer - 1, answer + 1, answer + 2, firstNum, secondNum]
    ).filter((c) => c >= lo && c <= hi && c !== answer)

    const picks: number[] = []
    for (const c of shuffle(confusables)) {
      if (picks.length >= 3) break
      if (!picks.includes(c)) picks.push(c)
    }
    while (picks.length < 3) {
      const r = randInt(lo, hi)
      if (r !== answer && !picks.includes(r)) picks.push(r)
    }

    optionSeq.current += 1 // fresh key namespace for this problem's option tiles
    setOptions(shuffle([answer, ...picks]))

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!voice) return

    const delay = isIOS() ? 100 : 500
    timeoutRef.current = setTimeout(() => {
      speakProblem(firstNum, secondNum)
    }, delay)
  }

  const speakProblem = async (a: number, b: number) => {
    try {
      audio.updateUserInteraction()
      if (isAddition) {
        await audio.speakAdditionProblem(a, b, 'primary')
      } else {
        await audio.speakSubtractionProblem(a, b, 'primary')
      }
    } catch (error: any) {
      logError('Error speaking problem', { num1: a, num2: b, error: error?.toString() })
    }
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (correctAnswer === null) return
    // Advance-lock (PRD-02 P1/P2): ignore every tap once a correct answer is resolving — blocks the
    // double-tap double-record and the celebration-tap star theft.
    if (isAdvancingRef.current) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    // Every tap is felt: a soft tick synced to the press (separate SFX channel, never TTS) —
    // matching UnifiedQuizGame so the interaction language is consistent app-wide.
    sfx.play('tap')

    const isCorrect = selectedAnswer === correctAnswer

    // Engage the advance-lock SYNCHRONOUSLY on a correct tap (before the await below) so a second
    // tap fired in the same tick is already blocked by the guard above.
    if (isCorrect) isAdvancingRef.current = true

    // Mark the tapped tile + cue the corner guide, clearing the reaction a beat later.
    setFeedback({ value: selectedAnswer, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Speak the completed FACT on a correct tap ("tre plus fire er syv") — the reinforcement moment
    // (PRD-05 P2). A wrong tap just echoes the tapped number (identification). Single audio channel,
    // so the fact REPLACES the number echo, never stacks. The win/lose narration stays removed.
    try {
      if (isCorrect && correctAnswer !== null && num1 !== null && num2 !== null) {
        const op = isAddition ? DANISH_PHRASES.math.plus : DANISH_PHRASES.math.minus
        await audio.speak(
          `${getDanishNumberText(num1)} ${op} ${getDanishNumberText(num2)} er ${getDanishNumberText(correctAnswer)}`,
        )
      } else {
        await audio.speakNumber(selectedAnswer)
      }
    } catch {
      // ignore number audio errors
    }

    // Navigated away during the echo → don't score/celebrate/schedule the advance (PRD-02 P4).
    if (!mountedRef.current) return

    if (isCorrect) {
      incrementScore()
      celebrateTier('micro') // light per-answer sparkle + soft "correct" SFX
      setRevealAnswer(true) // the equation's "?" flips to the answer (motion.POP)
    } else {
      // Wrong answers don't advance/punish (retry-until-right preserved); they only break this
      // problem's first-try flag (round streak/star accounting) + a gentle SFX.
      firstAttemptRef.current = false
      sfx.play('wrong')
    }

    // Auto-advance after a short celebration window (correct only; wrong stays for retry).
    if (isCorrect) {
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        stopCelebration()

        // Bounded round: record the completed question, fire streak milestones, end or advance.
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
          celebrateTier('streak')
          mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
        }
        if (r.done) {
          finishRound(r.firstTryCorrect, r.longestStreak)
        } else {
          generateNewProblem()
        }
      }, DWELL_CORRECT()) // unified celebration/advance dwell
    }
  }

  // Round ended → record to the progress store (stars/bests/stickers) and show the result hero.
  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      gameId,
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('math') },
    )
    setRoundOutcome(outcome)
  }

  // "Spil igen" → reset round + score and start a fresh round.
  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
    generateNewProblem()
  }

  const repeatProblem = async () => {
    if (num1 === null || num2 === null) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakProblem(num1, num2)
    } catch (error) {
      logError('Error repeating problem', { error: error?.toString() })
    }
  }

  const showEquation = gameReady && num1 !== null && num2 !== null && options.length > 0

  // DEV screenshot harness (?fx=correct|wrong): the forced equation-flip/tile state is DERIVED
  // (no setState-in-effect) so it's persistent and capturable — mirrors UnifiedQuizGame's
  // `tileStateFor`. No-op in production.
  const forcedFx = devFx()
  const fxWrongValue = forcedFx === 'wrong' ? options.find((o) => o !== correctAnswer) : undefined
  const effectiveRevealAnswer = revealAnswer || (forcedFx === 'correct' && showEquation && correctAnswer !== null)
  const effectiveFeedback: { value: number; correct: boolean } | null =
    forcedFx === 'correct' && showEquation && correctAnswer !== null
      ? { value: correctAnswer, correct: true }
      : forcedFx === 'wrong' && showEquation && fxWrongValue !== undefined
        ? { value: fxWrongValue, correct: false }
        : feedback

  // Big number styling inside the glossy "number sentence" card. The card is `tileSurface` — its top
  // stop is opaque #FFFFFF on EVERY skin, so the numbers sit on white regardless of scene. The old
  // `scene.dark ? '#FFFFFF'` branch was therefore white-on-white on dark skins; `onTileColor` is the
  // correct always-dark-on-white label (a no-op for accents that already read).
  const numberSx = {
    fontSize: { xs: '3rem', md: '4.2rem' },
    fontWeight: 800,
    color: category.onTileColor,
    lineHeight: 1,
    userSelect: 'none' as const,
    textShadow: 'none',
    '@media (orientation: landscape)': { fontSize: { xs: '2.4rem', md: '3.4rem' } },
    [PHONE_LANDSCAPE]: { fontSize: '1.3rem' },
  }
  const symbolSx = {
    width: { xs: 56, md: 80 },
    height: { xs: 56, md: 80 },
    '@media (orientation: landscape)': { width: { xs: 44, md: 64 }, height: { xs: 44, md: 64 } },
    [PHONE_LANDSCAPE]: { width: 26, height: 26 },
  }

  // Live difficulty: regenerate the current problem when the level changes in the adult menu
  // (no refresh). Skips the result screen + the initial mount.
  const difficultyLevel = useDifficulty('math')
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (roundOutcome || !gameReady) return
    generateNewProblem()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell
      categoryId="math"
      title={title}
      backRoute="/math"
      guideReaction={guideReaction}
      score={<MathScoreChip answered={round.state.index} total={round.length} disabled={isScoreNarrating} onClick={handleScoreClick} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        roundOutcome ? undefined : (
          <PromptFocus
            accent={category.accentColor}
            chargeKey={`${num1}-${num2}-${round.state.index}`}
            repeat={
              showEquation ? (
                <MathRepeatButton onClick={repeatProblem} disabled={false} size={phoneLandscape ? 'small' : 'large'} />
              ) : undefined
            }
            subject={
              showEquation ? (
              // The equation "number sentence" now rests as CLAY on PromptFocus's light-pool (no
              // frosted card / no backdrop-filter). Re-materialed (PRD-08 §3.3): the hard 2px border
              // + customShadows.pop are gone — the clay tileSurface keeps a 1px hairline for
              // definition, a grounded softShadow() drop-shadow, and an inner-light top highlight,
              // matching the TactileTile chip material. The SymbolTile operators + big numerals stay.
              <Box
                sx={{
                  // W1: the clay tile is now a COLUMN — the number sentence on top, the concrete
                  // ten-frame the child counts beneath it (the concrete→abstract bridge).
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1, md: 1.5 },
                  background: tileSurface(category.accentColor, muiTheme.scene.dark),
                  borderRadius: 4,
                  border: `1px solid ${hexToRgba(category.accentColor, muiTheme.scene.dark ? 0.4 : 0.26)}`,
                  px: { xs: 2.5, md: 4 },
                  py: { xs: 1.5, md: 2.5 },
                  filter: softShadow(muiTheme.scene.dark ? 1.6 : 1.2),
                  boxShadow: `inset 0 2px 3px ${hexToRgba('#FFFFFF', muiTheme.scene.dark ? 0.3 : 0.6)}`,
                  '@media (orientation: landscape)': { py: { xs: 1, md: 1.5 } },
                  [PHONE_LANDSCAPE]: { py: 0.25, px: 1, gap: 0.4 },
                }}
              >
                {/* Number sentence (unchanged): num1 op num2 = ?→answer POP */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: { xs: 1.25, md: 2 },
                    [PHONE_LANDSCAPE]: { gap: 0.5 },
                  }}
                >
                <Typography variant="h1" component="span" sx={numberSx}>{num1}</Typography>
                <SymbolTile op={operator} sx={symbolSx} />
                <Typography variant="h1" component="span" sx={numberSx}>{num2}</Typography>
                <SymbolTile op="=" sx={symbolSx} />

                {/* The "?" flips to the revealed answer with a motion.POP once correct (reduced
                    motion: instant swap — the colour/glow + SFX still land). */}
                <Box sx={{ ...symbolSx, position: 'relative' }}>
                  <AnimatePresence mode="wait" initial={false}>
                    {effectiveRevealAnswer && correctAnswer !== null ? (
                      <motion.div
                        key="answer"
                        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={motionOr(POP, reduce)}
                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: hexToRgba(muiTheme.palette.success.main, 0.2),
                            border: `3px solid ${muiTheme.palette.success.main}`,
                            boxShadow: muiTheme.customShadows.pop,
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 800,
                              lineHeight: 1,
                              color: darken(muiTheme.palette.success.main, 0.2),
                              fontSize: { xs: '1.7rem', md: '2.4rem' },
                              [PHONE_LANDSCAPE]: { fontSize: '0.85rem' },
                            }}
                          >
                            {correctAnswer}
                          </Typography>
                        </Box>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="question"
                        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={motionOr(POP, reduce)}
                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <SymbolTile op="?" sx={{ width: '100%', height: '100%' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>
                </Box>

                {/* W1 concrete quantity layer — countable dots so a finger-counter can SOLVE, not
                    guess. Keyed on the problem so the pop-in replays each question. */}
                <TenFrameLayer
                  key={`tf-${num1}-${num2}`}
                  op={operation}
                  a={num1!}
                  b={num2!}
                  reduce={reduce}
                  dark={muiTheme.scene.dark}
                />
              </Box>
              ) : null
            }
          />
        )
      }
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="math"
          backRoute="/math"
          onReplay={handleReplay}
        />
      ) : (
      <>
      {/* Answer options — rise to the TOP of the answer zone beneath the equation (PRD-14 W1) so the
          tiles sit close under the prompt instead of hugging the bottom edge (kills the dead mid-band).
          Phone-landscape keeps its centred tiles (tight 30/70 split preserved). */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pt: { xs: 1, md: 2 },
        minHeight: 0,
        [PHONE_LANDSCAPE]: { alignItems: 'center', pt: 0 },
      }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridAutoRows: 'auto',
            gap: { xs: '16px', sm: '20px', md: '24px' },
            width: '100%',
            maxWidth: { xs: '400px', sm: '500px', md: '600px' },
            justifyContent: 'center',
            alignItems: 'center',
            '& > *': {
              aspectRatio: '4/3',
              minHeight: { xs: '80px', sm: '90px', md: '100px' },
              maxHeight: { xs: '120px', sm: '140px', md: '160px' },
              width: '100%'
            },
            '@media (orientation: landscape)': {
              gridTemplateColumns: 'repeat(4, 1fr)',
              maxWidth: { xs: '600px', sm: '700px', md: '800px' },
              '& > *': {
                aspectRatio: '4/3',
                minHeight: { xs: '60px', sm: '70px', md: '80px' },
                maxHeight: { xs: '100px', sm: '110px', md: '120px' }
              }
            },
            // Phone landscape: fixed tile height instead of aspect-driven (see UnifiedQuizGame).
            [PHONE_LANDSCAPE]: {
              gap: '10px',
              maxWidth: '680px',
              '& > *': { aspectRatio: 'auto', height: '84px', minHeight: '84px', maxHeight: '84px' }
            }
          }}
        >
          {showEquation ? options.map((option, index) => (
            <motion.div
              key={`o${optionSeq.current}-${option}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              style={{ height: '100%' }}
            >
              <AnswerTile
                onClick={() => handleAnswerClick(option)}
                accent={category.accentColor}
                state={(effectiveFeedback && effectiveFeedback.value === option ? (effectiveFeedback.correct ? 'correct' : 'wrong') : 'idle') as AnswerTileState}
                // Tiles visibly stop responding once a correct answer is resolving (PRD-02). The
                // correct tap's setRevealAnswer/setFeedback re-render reads the just-set ref.
                disabled={isAdvancingRef.current}
              >
                <Typography
                  variant="h1"
                  component="span"
                  sx={{
                    fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                    fontWeight: 700,
                    // Readable-on-white answer-tile numeral (onTileColor) — see CategoryTheme.onTileColor.
                    color: category.onTileColor,
                    userSelect: 'none',
                    lineHeight: 1,
                    '@media (orientation: landscape)': { fontSize: 'clamp(2rem, 6vw, 3.5rem)' },
                    [PHONE_LANDSCAPE]: { fontSize: '2rem' }
                  }}
                >
                  {option}
                </Typography>
              </AnswerTile>
            </motion.div>
          )) : null}
        </Box>
      </Box>
      </>
      )}
    </GameShell>
  )
}

export default MathOperationGame
