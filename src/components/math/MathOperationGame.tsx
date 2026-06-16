import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Typography, Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { categoryThemes } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import SymbolTile from '../common/SymbolTile'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import RoundResultScreen from '../common/RoundResultScreen'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { isIOS } from '../../utils/deviceDetection'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Unified addition/subtraction game. Behaviour and difficulty ranges are preserved
// exactly from the previous AdditionGame/SubtractionGame; only the operator,
// problem generation, spoken prompt, title and welcome differ by `operation`.
interface MathOperationGameProps {
  operation: 'addition' | 'subtraction'
}

const MathOperationGame: React.FC<MathOperationGameProps> = ({ operation }) => {
  const muiTheme = useTheme()
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

  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()

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
    // New problem → first attempt fresh again.
    firstAttemptRef.current = true

    let firstNum: number
    let secondNum: number
    let answer: number

    if (isAddition) {
      // Two numbers that add up to max 20
      firstNum = Math.floor(Math.random() * 10) + 1 // 1-10
      const maxSecondNum = Math.min(20 - firstNum, 10) // ensure sum ≤ 20
      secondNum = Math.floor(Math.random() * maxSecondNum) + 1 // 1 to maxSecondNum
      answer = firstNum + secondNum
    } else {
      // Subtraction with a non-negative result
      firstNum = Math.floor(Math.random() * 10) + 1 // 1-10
      secondNum = Math.floor(Math.random() * firstNum) + 1 // 1 to firstNum
      answer = firstNum - secondNum // 0-9
    }

    setNum1(firstNum)
    setNum2(secondNum)
    setCorrectAnswer(answer)
    problemRef.current = { a: firstNum, b: secondNum }

    // Near-answer distractors (off-by-one/two + the operands) clamped to the valid result range,
    // so wrong options are plausible confusions rather than random noise. Top up with random
    // in-range values only if too few distinct confusables exist.
    const lo = isAddition ? 1 : 0
    const hi = isAddition ? 20 : 10
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
      const r = Math.floor(Math.random() * (hi - lo + 1)) + lo
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

    try {
      await audio.speakNumber(selectedAnswer)
    } catch {
      // ignore number audio errors
    }

    if (isCorrect) {
      incrementScore()
      celebrateTier('micro') // light per-answer sparkle + soft "correct" SFX
    } else {
      // Wrong answers don't advance/punish (retry-until-right preserved); they only break this
      // problem's first-try flag (round streak/star accounting) + a gentle SFX.
      firstAttemptRef.current = false
      sfx.play('wrong')
    }

    setTimeout(async () => {
      try {
        await audio.announceGameResult(isCorrect)

        setTimeout(() => {
          if (!isCorrect) return
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
        }, isIOS() ? 1500 : 2000)
      } catch (error: any) {
        logError('Error in game result audio', {
          selectedAnswer,
          correctAnswer,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150)
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

  // Big number styling inside the white "number sentence" card (readable on any scene).
  const numberSx = {
    fontSize: { xs: '2.6rem', md: '3.6rem' },
    fontWeight: 700,
    color: 'primary.dark',
    lineHeight: 1,
    userSelect: 'none' as const,
    '@media (orientation: landscape)': { fontSize: { xs: '2.2rem', md: '3rem' } },
  }
  const symbolSx = { width: { xs: 48, md: 68 }, height: { xs: 48, md: 68 } }

  return (
    <GameShell
      categoryId="math"
      title={title}
      backRoute="/math"
      guideReaction={guideReaction}
      score={<MathScoreChip score={score} disabled={isScoreNarrating} onClick={handleScoreClick} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
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
      {/* Question + soft-3D number sentence + repeat button — a clean flex column so the
          equation never overlaps the question text (the old layout bug). */}
      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: { xs: 1.5, md: 2 },
          mb: { xs: 2, md: 3 },
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: muiTheme.scene.dark ? '#FFFFFF' : 'primary.main',
            fontSize: { xs: '1rem', md: '1.25rem' },
            textShadow: muiTheme.scene.dark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          Hvad bliver svaret? 🤔
        </Typography>

        {showEquation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: { xs: 1.25, md: 2 },
                bgcolor: 'rgba(255,255,255,0.96)',
                borderRadius: 4,
                border: '2px solid',
                borderColor: 'primary.100',
                px: { xs: 2.5, md: 4 },
                py: { xs: 1.5, md: 2.5 },
                boxShadow: muiTheme.scene.dark
                  ? '0 12px 30px rgba(0,0,0,0.45)'
                  : '0 8px 24px rgba(0,0,0,0.14)',
                '@media (orientation: landscape)': { py: { xs: 1, md: 1.5 } },
              }}
            >
              <Typography variant="h1" component="span" sx={numberSx}>{num1}</Typography>
              <SymbolTile op={operator} sx={symbolSx} />
              <Typography variant="h1" component="span" sx={numberSx}>{num2}</Typography>
              <SymbolTile op="=" sx={symbolSx} />
              <SymbolTile op="?" sx={symbolSx} />
            </Box>

            <MathRepeatButton onClick={repeatProblem} disabled={false} />
          </motion.div>
        )}
      </Box>

      {/* Answer options — non-greedy so it groups under the equation (shell centres the group). */}
      <Box sx={{ flex: '0 1 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
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
                accent={categoryThemes.math.accentColor}
                state={(feedback && feedback.value === option ? (feedback.correct ? 'correct' : 'wrong') : 'idle') as AnswerTileState}
              >
                <Typography
                  variant="h1"
                  component="span"
                  sx={{
                    fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                    fontWeight: 700,
                    color: categoryThemes.math.accentColor,
                    userSelect: 'none',
                    lineHeight: 1,
                    '@media (orientation: landscape)': { fontSize: 'clamp(2rem, 6vw, 3.5rem)' }
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
