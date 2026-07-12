import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Grid } from '@mui/material'
import { motion } from 'framer-motion'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import SymbolTile from '../common/SymbolTile'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { categoryThemes } from '../../config/categoryThemes'
import { MathRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { isIOS } from '../../utils/deviceDetection'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Sammenlign Tal — ONE consistent rule (Math Overhaul §3): two different quantities are shown and
// the child taps the bigger number's side. On a correct tap an animated krokodille >/< "mouth"
// springs open toward the chosen (bigger) number — "the mouth eats the bigger one" — reinforcing
// the symbol. Removed (vs the old game): the equality case, the largest/smallest/equal variance,
// and the long wrong-answer explanation path. No punishment: a wrong tap → gentle SFX + retry.

const OBJECT_TYPES = [
  { name: 'æble', emoji: '🍎', danishName: 'æbler' },
  { name: 'ballon', emoji: '🎈', danishName: 'balloner' },
  { name: 'stjerne', emoji: '⭐', danishName: 'stjerner' },
  { name: 'blomst', emoji: '🌸', danishName: 'blomster' },
  { name: 'bil', emoji: '🚗', danishName: 'biler' },
  { name: 'bold', emoji: '⚽', danishName: 'bolde' },
  { name: 'fugl', emoji: '🐦', danishName: 'fugle' },
  { name: 'fisk', emoji: '🐟', danishName: 'fisk' }
]

const DANISH_NUMBERS = [
  'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti',
  'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve'
]

// Shrink emoji visual aids as the count grows so up to 20 fit without scrolling
const getEmojiFontSize = (count: number): string => {
  if (count <= 10) return 'clamp(1.5rem, 3vw, 2rem)'
  if (count <= 15) return 'clamp(1.1rem, 2.4vw, 1.6rem)'
  return 'clamp(0.85rem, 2vw, 1.3rem)'
}

interface ComparisonProblem {
  leftNumber: number
  rightNumber: number
  leftObjects: typeof OBJECT_TYPES[0]
  rightObjects: typeof OBJECT_TYPES[0]
}

type Side = 'left' | 'right'
const COMPARE_PROMPT = 'Tryk på det største tal.'

const ComparisonGame: React.FC = () => {
  const reduce = useReducedMotion()
  const [currentProblem, setCurrentProblem] = useState<ComparisonProblem | null>(null)
  // Most-recently tapped side + whether it was correct (drives the side AnswerTile glow/shake).
  const [chosen, setChosen] = useState<{ side: Side; correct: boolean } | null>(null)
  // True while a correct answer is being processed/advancing (taps disabled). Wrong taps stay
  // re-enabled so the child can retry.
  const [locked, setLocked] = useState(false)
  // The krokodille mouth opens toward the bigger number only after a correct tap.
  const [mouthOpen, setMouthOpen] = useState(false)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({ componentId: 'ComparisonGame', autoInitialize: false })
  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame): the board reveals once via revealBoard regardless of
  // which path triggers it, and the welcome plays at most once.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  // True once the child taps → suppresses a (possibly late) welcome from talking over their play.
  const hasInteractedRef = useRef(false)

  // Centralized game state management
  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()

  // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 ComparisonGame: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the first problem immediately (tappable), no waiting on the welcome.
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenPrompt()
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
  // inside playWelcomeThenPrompt so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Instant load: render the first problem RIGHT AWAY without voicing the prompt yet — the welcome
  // narrates over the visible board and the spoken prompt follows it. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    generateNewProblem(false)
  }

  // Play the welcome over the already-visible board, then voice the prompt. Self-guards; skips the
  // trailing prompt if the child already started tapping.
  const playWelcomeThenPrompt = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('comparison')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (!hasInteractedRef.current) speakProblem()
  }

  // `voice=false` renders the board without voicing the prompt (used for the first problem, which
  // is voiced after the welcome instead).
  const generateNewProblem = (voice = true) => {
    // Two DIFFERENT numbers 1–20 (no equality — one clear rule: tap the bigger).
    const leftNum = Math.floor(Math.random() * 20) + 1
    let rightNum = Math.floor(Math.random() * 20) + 1
    while (rightNum === leftNum) {
      rightNum = Math.floor(Math.random() * 20) + 1
    }

    // Distinct object types for visual clarity.
    const leftObjectType = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)]
    let rightObjectType = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)]
    while (rightObjectType === leftObjectType) {
      rightObjectType = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)]
    }

    setCurrentProblem({
      leftNumber: leftNum,
      rightNumber: rightNum,
      leftObjects: leftObjectType,
      rightObjects: rightObjectType,
    })
    setChosen(null)
    setLocked(false)
    setMouthOpen(false)
    setGuideReaction(null)
    firstAttemptRef.current = true

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (!voice) return
    const delay = isIOS() ? 100 : 500
    timeoutRef.current = setTimeout(() => speakProblem(), delay)
  }

  const speakProblem = async () => {
    try {
      audio.updateUserInteraction()
      await audio.speak(COMPARE_PROMPT)
    } catch (error) {
      logError('Error speaking problem', { error: error?.toString() })
    }
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'math.comparison',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 } },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
    generateNewProblem()
  }

  const handleSideClick = async (side: Side) => {
    if (!currentProblem || locked) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    const biggerSide: Side =
      currentProblem.leftNumber > currentProblem.rightNumber ? 'left' : 'right'
    const isCorrect = side === biggerSide
    const tappedNumber = side === 'left' ? currentProblem.leftNumber : currentProblem.rightNumber

    setChosen({ side, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Echo the tapped number (identification). The win/lose narration (announceGameResult) stays
    // removed; success/fail is otherwise SFX + visuals only.
    try {
      await audio.speakNumber(tappedNumber)
    } catch {
      // ignore number audio errors
    }

    if (isCorrect) {
      setLocked(true)
      setMouthOpen(true) // krokodille opens toward the bigger number
      incrementScore()
      celebrateTier('micro')

      setTimeout(() => {
        stopCelebration()
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
    } else {
      // Gentle, non-punishing: break the first-try flag, soft SFX, the mouth stays shut, retry.
      firstAttemptRef.current = false
      sfx.play('wrong')
      setTimeout(() => setChosen(null), 900)
    }
  }

  const repeatProblem = async () => {
    if (!currentProblem) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakProblem()
    } catch (error) {
      logError('Error repeating problem', { error: error?.toString() })
    }
  }

  const sideState = (side: Side): AnswerTileState =>
    chosen && chosen.side === side ? (chosen.correct ? 'correct' : 'wrong') : 'idle'

  // The comparison symbol: > if left is bigger, < if right is bigger.
  const mouthOp: '>' | '<' | null = currentProblem
    ? currentProblem.leftNumber > currentProblem.rightNumber ? '>' : '<'
    : null

  const renderSide = (side: Side) => {
    if (!currentProblem) return null
    const num = side === 'left' ? currentProblem.leftNumber : currentProblem.rightNumber
    const obj = side === 'left' ? currentProblem.leftObjects : currentProblem.rightObjects
    return (
      <Box sx={{ minHeight: { xs: 180, md: 230 }, '@media (orientation: landscape)': { minHeight: { xs: 120, md: 150 } }, [PHONE_LANDSCAPE]: { minHeight: 96 } }}>
        <AnswerTile
          onClick={() => handleSideClick(side)}
          accent={categoryThemes.math.accentColor}
          state={sideState(side)}
          disabled={locked}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, width: '100%' }}>
            {/* Objects */}
            <Box sx={{
              minHeight: { xs: 56, md: 76 },
              maxHeight: { xs: 96, md: 120 },
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 0.75,
              overflow: 'hidden',
              '@media (orientation: landscape)': { minHeight: { xs: 36, md: 48 }, maxHeight: { xs: 56, md: 72 } },
              [PHONE_LANDSCAPE]: { minHeight: 26, maxHeight: 34 }
            }}>
              {Array.from({ length: num }, (_, i) => (
                <motion.span
                  key={i}
                  initial={reduce ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: reduce ? 0 : i * 0.05 }}
                  style={{ fontSize: getEmojiFontSize(num) }}
                >
                  {obj.emoji}
                </motion.span>
              ))}
            </Box>
            {/* Numeral */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '3rem', md: '4rem' },
                fontWeight: 700,
                color: categoryThemes.math.accentColor,
                lineHeight: 1,
                '@media (orientation: landscape)': { fontSize: { xs: '2rem', md: '2.8rem' } },
                [PHONE_LANDSCAPE]: { fontSize: '1.6rem' }
              }}
            >
              {num}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, '@media (orientation: landscape)': { fontSize: '0.7rem' } }}>
              {DANISH_NUMBERS[num]} {obj.danishName}
            </Typography>
          </Box>
        </AnswerTile>
      </Box>
    )
  }

  return (
    <GameShell
      categoryId="math"
      title="Sammenlign Tal"
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
      ) : currentProblem ? (
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 0,
        }}>
          {/* Prompt */}
          <Typography
            sx={{
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '1.05rem', md: '1.35rem' },
              color: (theme) => theme.scene.dark ? '#FFFFFF' : 'primary.main',
              textShadow: (theme) => theme.scene.dark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
              mb: { xs: 1.5, md: 2.5 },
              '@media (orientation: landscape)': { fontSize: { xs: '0.95rem', md: '1.15rem' }, mb: { xs: 0.5, md: 1 } },
            }}
          >
            Tryk på det største tal 👆
          </Typography>

          <Paper
            elevation={8}
            sx={{
              maxWidth: 820,
              width: '100%',
              p: { xs: 2, sm: 3, md: 3.5 },
              borderRadius: 4,
              border: '2px solid',
              borderColor: 'primary.200',
              '@media (orientation: landscape)': { maxWidth: '92%', p: { xs: 1.5, sm: 2, md: 2.5 } },
              [PHONE_LANDSCAPE]: { p: 1 }
            }}
          >
            <Grid container spacing={{ xs: 1, md: 2 }} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 5 }}>{renderSide('left')}</Grid>

              {/* Krokodille mouth: opens toward the bigger number after a correct tap. */}
              <Grid size={{ xs: 2 }}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}>
                  <Typography component="span" sx={{ fontSize: { xs: '1.8rem', md: '2.6rem' }, lineHeight: 1, [PHONE_LANDSCAPE]: { fontSize: '1.3rem' } }}>
                    🐊
                  </Typography>
                  <Box sx={{ height: { xs: 44, md: 64 }, display: 'flex', alignItems: 'center', justifyContent: 'center', [PHONE_LANDSCAPE]: { height: 32 } }}>
                    {mouthOpen && mouthOp && (
                      <Box
                        component={motion.div}
                        initial={reduce ? false : { scale: 0, rotate: mouthOp === '>' ? 30 : -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 12 }}
                      >
                        <SymbolTile op={mouthOp} sx={{ width: { xs: 44, md: 64 }, height: { xs: 44, md: 64 } }} />
                      </Box>
                    )}
                  </Box>
                </Box>
              </Grid>

              <Grid size={{ xs: 5 }}>{renderSide('right')}</Grid>
            </Grid>

            {/* Repeat button. */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 2, md: 3 }, '@media (orientation: landscape)': { mt: { xs: 1, md: 1.5 } }, [PHONE_LANDSCAPE]: { mt: 0.5 } }}>
              <MathRepeatButton onClick={repeatProblem} disabled={false} label="Hør igen" />
            </Box>
          </Paper>
        </Box>
      ) : null}
    </GameShell>
  )
}

export default ComparisonGame
