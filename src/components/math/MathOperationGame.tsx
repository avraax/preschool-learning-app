import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Typography, Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { getCategoryTheme } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import PromptStage from '../common/PromptStage'
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
import { useDifficulty } from '../../hooks/useDifficulty'
import { isIOS } from '../../utils/deviceDetection'
import { devFx } from '../../utils/devHarness'
import { POP, DWELL_CORRECT, motionOr } from '../../theme/motion'
import { darken, hexToRgba, tileSurface } from '../../theme/tokens/helpers'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Unified addition/subtraction game. Behaviour and difficulty ranges are preserved
// exactly from the previous AdditionGame/SubtractionGame for 'normal'; only the operator,
// problem generation, spoken prompt, title and welcome differ by `operation`.
//
// UI/UX Overhaul PRD §6B: the equation card is promoted INTO a PromptStage (bigger, glossy
// operator/number tiles, subtle idle bob via PromptStage's own float). On a correct answer the
// "?" flips to the revealed answer with a motion.POP before the unified DWELL_CORRECT auto-advance.
interface MathOperationGameProps {
  operation: 'addition' | 'subtraction'
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
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
  // True until the first wrong tile is tapped for the current problem (gates streak/star).
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)
  // Live current problem (so it can be voiced after the welcome) + interaction guard (so a late
  // welcome never talks over active play).
  const problemRef = useRef<{ a: number; b: number } | null>(null)
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

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (guideReactionTimer.current) {
        clearTimeout(guideReactionTimer.current)
        guideReactionTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // New problem → first attempt fresh again.
    firstAttemptRef.current = true

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
        // Normal (TODAY, unchanged): two numbers that add up to max 20.
        firstNum = randInt(1, 10) // 1-10
        const maxSecondNum = Math.min(20 - firstNum, 10) // ensure sum ≤ 20
        secondNum = randInt(1, maxSecondNum) // 1 to maxSecondNum
      }
      answer = firstNum + secondNum
    } else {
      if (level === 'let') {
        // Let: minuend ≤10, no borrow (kept single-digit so there's no "10 minus x" crossing).
        firstNum = randInt(1, 9)
        secondNum = randInt(1, firstNum)
      } else if (level === 'svaer') {
        // Svær: minuend ≤20.
        firstNum = randInt(1, 20)
        secondNum = randInt(1, firstNum)
      } else {
        // Normal (TODAY, unchanged): subtraction with a non-negative result.
        firstNum = randInt(1, 10) // 1-10
        secondNum = randInt(1, firstNum) // 1 to firstNum
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
    const hi = isAddition ? 20 : (level === 'svaer' ? 20 : 10)
    const confusables = (isAddition
      ? [answer - 1, answer + 1, answer - 2, answer + 2]
      : [answer - 1, answer + 1, answer + 2, firstNum, secondNum]
    ).filter((c) => c >= lo && c <= hi && c !== answer)

    const picks: number[] = []
    for (const c of confusables.sort(() => Math.random() - 0.5)) {
      if (picks.length >= 3) break
      if (!picks.includes(c)) picks.push(c)
    }
    while (picks.length < 3) {
      const r = randInt(lo, hi)
      if (r !== answer && !picks.includes(r)) picks.push(r)
    }

    setOptions([answer, ...picks].sort(() => Math.random() - 0.5))

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
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    const isCorrect = selectedAnswer === correctAnswer

    // Mark the tapped tile + cue the corner guide, clearing the reaction a beat later.
    setFeedback({ value: selectedAnswer, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Echo the tapped number (identification). The win/lose narration (announceGameResult) stays
    // removed; success/fail is otherwise SFX + visuals only.
    try {
      await audio.speakNumber(selectedAnswer)
    } catch {
      // ignore number audio errors
    }

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
      setTimeout(() => {
        stopCelebration()

        // Bounded round: record the completed question, fire streak milestones, end or advance.
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
          celebrateTier('streak')
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
      { starThresholds: { three: 0, two: 2 } },
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

  // Big number styling inside the glossy "number sentence" card (readable on any scene).
  const numberSx = {
    fontSize: { xs: '3rem', md: '4.2rem' },
    fontWeight: 800,
    color: muiTheme.scene.dark ? '#FFFFFF' : category.accentColor,
    lineHeight: 1,
    userSelect: 'none' as const,
    textShadow: muiTheme.scene.dark ? '0 2px 10px rgba(0,0,0,0.55)' : 'none',
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
          <PromptStage
            accent={category.accentColor}
            chargeKey={`${num1}-${num2}-${round.state.index}`}
            repeat={
              showEquation ? (
                <MathRepeatButton onClick={repeatProblem} disabled={false} size={phoneLandscape ? 'small' : 'large'} />
              ) : undefined
            }
          >
            {showEquation && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1.25, md: 2 },
                  background: tileSurface(category.accentColor, muiTheme.scene.dark),
                  borderRadius: 4,
                  border: `2px solid ${category.borderColor}`,
                  px: { xs: 2.5, md: 4 },
                  py: { xs: 1.5, md: 2.5 },
                  boxShadow: muiTheme.customShadows.pop,
                  '@media (orientation: landscape)': { py: { xs: 1, md: 1.5 } },
                  [PHONE_LANDSCAPE]: { py: 0.25, px: 1, gap: 0.5 },
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
            )}
          </PromptStage>
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
      {/* Answer options — fills the answer zone beneath the PromptStage equation. */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
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
              key={`${option}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              style={{ height: '100%' }}
            >
              <AnswerTile
                onClick={() => handleAnswerClick(option)}
                accent={category.accentColor}
                state={(effectiveFeedback && effectiveFeedback.value === option ? (effectiveFeedback.correct ? 'correct' : 'wrong') : 'idle') as AnswerTileState}
              >
                <Typography
                  variant="h1"
                  component="span"
                  sx={{
                    fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                    fontWeight: 700,
                    color: category.accentColor,
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
