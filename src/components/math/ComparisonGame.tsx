import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Paper, Grid } from '@mui/material'
import { motion } from 'framer-motion'
import GameShell from '../common/GameShell'
import AnswerTile from '../common/AnswerTile'
import SymbolTile from '../common/SymbolTile'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCharacterState } from '../common/LottieCharacter'
import { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { categoryThemes } from '../../config/categoryThemes'
import { MathRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Object types for visual counting
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
  correctSymbol: '>' | '<' | '='
  questionType: 'largest' | 'smallest' | 'equal'
}

const ComparisonGame: React.FC = () => {
  const [currentProblem, setCurrentProblem] = useState<ComparisonProblem | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  // Most-recently tapped symbol + whether it was correct (drives the AnswerTile glow/shake).
  const [feedback, setFeedback] = useState<{ symbol: string; correct: boolean } | null>(null)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'ComparisonGame',
    autoInitialize: false
  })
  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame): the board reveals once via beginGame regardless
  // of which path triggers it, and the welcome plays at most once — so a child is never stranded
  // on an empty screen when audio isn't unlocked at mount.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)

  // Centralized game state management
  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()

  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  // Kept for the centralized celebration timing helper; the teacher figure is no longer
  // rendered — the corner GameGuide reacts instead.
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 ComparisonGame: ${message}`, data)
    }
  }

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Check if audio is ready
    if (audio.isAudioReady) {
      playWelcomeAndStart()
    }

    // Resilience: reveal the first problem after a short delay even if audio never unlocks;
    // the welcome still plays if/when it does (both starters are ref-guarded).
    const fallback = setTimeout(() => beginGame(), 2500)

    return () => {
      clearTimeout(fallback)
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

  // When audio unlocks after mount, play the welcome (unless it/the game already started).
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current && !startedRef.current) {
      playWelcomeAndStart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Reveal the first problem. Idempotent — safe from any start path.
  const beginGame = () => {
    if (startedRef.current) return
    startedRef.current = true
    generateNewProblem()
  }

  // Play welcome message and start game
  const playWelcomeAndStart = async () => {
    if (welcomeTriggered.current) return
    welcomeTriggered.current = true
    try {
      // Play the welcome message
      await audio.playGameWelcome('comparison')

      // iOS-optimized delay - increased to prevent audio overlap
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => beginGame(), delay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      beginGame()
    }
  }

  const generateNewProblem = () => {
    // Generate numbers 1-20 (introduces Danish teen numbers)
    const leftNum = Math.floor(Math.random() * 20) + 1
    let rightNum = Math.floor(Math.random() * 20) + 1

    // Randomly decide if we want equal numbers (25% chance)
    const wantEqual = Math.random() < 0.25

    if (wantEqual) {
      // Force equal numbers
      rightNum = leftNum
    } else {
      // Force different numbers
      while (rightNum === leftNum) {
        rightNum = Math.floor(Math.random() * 20) + 1
      }
    }

    // Select random object types for each side
    const leftObjectType = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)]
    let rightObjectType = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)]

    // Ensure different object types for visual clarity
    while (rightObjectType === leftObjectType) {
      rightObjectType = OBJECT_TYPES[Math.floor(Math.random() * OBJECT_TYPES.length)]
    }

    // Determine correct symbol and question type
    let correctSymbol: '>' | '<' | '='
    let questionType: 'largest' | 'smallest' | 'equal'

    if (leftNum > rightNum) {
      correctSymbol = '>'
      // Randomly ask for largest or smallest
      questionType = Math.random() < 0.5 ? 'largest' : 'smallest'
    } else if (leftNum < rightNum) {
      correctSymbol = '<'
      // Randomly ask for largest or smallest
      questionType = Math.random() < 0.5 ? 'largest' : 'smallest'
    } else {
      correctSymbol = '='
      questionType = 'equal'
    }

    const problem: ComparisonProblem = {
      leftNumber: leftNum,
      rightNumber: rightNum,
      leftObjects: leftObjectType,
      rightObjects: rightObjectType,
      correctSymbol,
      questionType
    }

    setCurrentProblem(problem)
    setShowFeedback(false)
    setFeedback(null)
    setGuideReaction(null)

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // iOS-optimized delay
    const delay = isIOS() ? 100 : 500

    // Schedule delayed audio for the problem
    timeoutRef.current = setTimeout(() => {
      speakProblem(problem)
    }, delay)
  }

  const speakProblem = async (problem: ComparisonProblem) => {
    try {
      // Update user interaction timestamp before playing (iOS fix)
      audio.updateUserInteraction()
      // Use consolidated comparison problem speaking method
      await audio.speakComparisonProblem(
        problem.leftNumber,
        problem.rightNumber,
        problem.leftObjects.danishName,
        problem.rightObjects.danishName,
        problem.questionType
      )
    } catch (error) {
      logError('Error speaking problem', {
        leftNumber: problem.leftNumber,
        rightNumber: problem.rightNumber,
        questionType: problem.questionType,
        error: error?.toString()
      })
    }
  }

  const handleSymbolClick = async (symbol: '>' | '<' | '=') => {
    if (!currentProblem || showFeedback) {
      return
    }

    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()

    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()

    setShowFeedback(true)

    // FIRST: Speak the symbol immediately for fast feedback
    try {
      const symbolName = symbol === '>' ? 'større end' : symbol === '<' ? 'mindre end' : 'lig med'
      await audio.speak(symbolName)
    } catch {
      // ignore symbol audio errors
    }

    // Determine if the answer is correct based on question type
    let isCorrect = false

    if (currentProblem.questionType === 'equal') {
      // For "Er tallene ens?", only "=" is correct for equal numbers
      isCorrect = symbol === currentProblem.correctSymbol
    } else if (currentProblem.questionType === 'largest') {
      // For "Hvilket tal er størst?", we need to select the symbol that points to the larger number
      if (currentProblem.leftNumber > currentProblem.rightNumber) {
        isCorrect = symbol === '>' // Left is larger, so > is correct
      } else if (currentProblem.rightNumber > currentProblem.leftNumber) {
        isCorrect = symbol === '<' // Right is larger, so < is correct
      } else {
        isCorrect = symbol === '=' // They are equal
      }
    } else if (currentProblem.questionType === 'smallest') {
      // For "Hvilket tal er mindst?", we need to select the symbol that points to the smaller number
      if (currentProblem.leftNumber < currentProblem.rightNumber) {
        isCorrect = symbol === '<' // Left is smaller, so < is correct (left < right)
      } else if (currentProblem.rightNumber < currentProblem.leftNumber) {
        isCorrect = symbol === '>' // Right is smaller, so > is correct (left > right)
      } else {
        isCorrect = symbol === '=' // They are equal
      }
    }

    // Mark the tapped symbol tile + cue the corner guide, clearing the reaction a beat later.
    setFeedback({ symbol, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Generate teaching explanation for wrong answers
    let explanation = ''
    if (!isCorrect) {
      if (currentProblem.questionType === 'equal') {
        if (currentProblem.correctSymbol === '=') {
          explanation = `${DANISH_NUMBERS[currentProblem.leftNumber]} er lige med ${DANISH_NUMBERS[currentProblem.rightNumber]}`
        } else {
          explanation = `${DANISH_NUMBERS[currentProblem.leftNumber]} er ikke lige med ${DANISH_NUMBERS[currentProblem.rightNumber]}`
        }
      } else if (currentProblem.questionType === 'largest') {
        if (currentProblem.leftNumber > currentProblem.rightNumber) {
          explanation = `${DANISH_NUMBERS[currentProblem.leftNumber]} er størst`
        } else if (currentProblem.rightNumber > currentProblem.leftNumber) {
          explanation = `${DANISH_NUMBERS[currentProblem.rightNumber]} er størst`
        } else {
          explanation = `${DANISH_NUMBERS[currentProblem.leftNumber]} og ${DANISH_NUMBERS[currentProblem.rightNumber]} er ens`
        }
      } else if (currentProblem.questionType === 'smallest') {
        if (currentProblem.leftNumber < currentProblem.rightNumber) {
          explanation = `${DANISH_NUMBERS[currentProblem.leftNumber]} er mindst`
        } else if (currentProblem.rightNumber < currentProblem.leftNumber) {
          explanation = `${DANISH_NUMBERS[currentProblem.rightNumber]} er mindst`
        } else {
          explanation = `${DANISH_NUMBERS[currentProblem.leftNumber]} og ${DANISH_NUMBERS[currentProblem.rightNumber]} er ens`
        }
      }
    }

    // IMMEDIATELY: Start visual celebration effects if correct
    if (isCorrect) {
      incrementScore()
      celebrate() // Start celebration visual immediately
    }

    // THEN: Use centralized celebration with standard timing
    setTimeout(async () => {
      try {
        await audio.playCelebrationWithStandardTiming({
          isCorrect,
          celebrate,
          stopCelebration,
          incrementScore: undefined, // Score already incremented above
          nextAction: isCorrect ? generateNewProblem : undefined, // Don't reset UI immediately for wrong answers
          teacherCharacter: mathTeacher
        })

        // For wrong answers, speak the teaching explanation, then reset UI to allow retry
        if (!isCorrect) {
          try {
            if (explanation) {
              await audio.speak(explanation)
            }
          } catch {
            // ignore explanation audio errors
          }
          setTimeout(() => {
            setShowFeedback(false)
            setFeedback(null)
          }, 1200) // brief pause after the explanation before allowing retry
        }

      } catch (error) {
        logError('Error in centralized celebration', {
          symbol,
          currentProblem: currentProblem?.questionType,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150) // Very short delay between symbol audio and celebration audio
  }

  const repeatProblem = async () => {
    if (!currentProblem) return

    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()

    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()

    try {
      await speakProblem(currentProblem)
    } catch (error) {
      logError('Error repeating problem', { error: error?.toString() })
    }
  }

  return (
    <GameShell
      categoryId="math"
      title="Sammenlign Tal"
      backRoute="/math"
      guideReaction={guideReaction}
      score={<MathScoreChip score={score} disabled={isScoreNarrating} onClick={handleScoreClick} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, onComplete: stopCelebration }}
    >
      {/* Problem Display - Only show when currentProblem exists */}
      {currentProblem && (
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 0
        }}>
          {/* Numbers and Objects Display */}
          <Paper
            elevation={8}
            sx={{
              maxWidth: 800,
              width: '100%',
              p: { xs: 2, sm: 3, md: 4 },
              borderRadius: 4,
              border: '2px solid',
              borderColor: 'primary.200',
              mb: 4,
              // Landscape adjustments
              '@media (orientation: landscape)': {
                maxWidth: '90%',
                p: { xs: 1.5, sm: 2, md: 3 }
              }
            }}
          >
            <Grid container spacing={{ xs: 2, md: 4 }} sx={{ alignItems: 'center' }}>
              {/* Left Side */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  {/* Objects Display */}
                  <Box sx={{
                    mb: 2,
                    minHeight: { xs: 80, md: 100 },
                    maxHeight: { xs: 120, md: 150 },
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1,
                    overflow: 'hidden',
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 60, md: 80 },
                      maxHeight: { xs: 100, md: 120 }
                    }
                  }}>
                    {Array.from({ length: currentProblem.leftNumber }, (_, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        style={{ fontSize: getEmojiFontSize(currentProblem.leftNumber) }}
                      >
                        {currentProblem.leftObjects.emoji}
                      </motion.span>
                    ))}
                  </Box>
                  {/* Number */}
                  <Typography
                    variant="h1"
                    sx={{
                      fontSize: { xs: '4rem', md: '5rem' },
                      fontWeight: 700,
                      color: 'primary.dark'
                    }}
                  >
                    {currentProblem.leftNumber}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {DANISH_NUMBERS[currentProblem.leftNumber]} {currentProblem.leftObjects.danishName}
                  </Typography>
                </Box>
              </Grid>

              {/* Symbol Selection — soft-3D symbol tiles with correct/wrong feedback */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: { xs: 1.5, md: 2 },
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {(['>', '<', '='] as const).map((symbol) => (
                    <Box
                      key={symbol}
                      sx={{
                        width: { xs: 92, md: 116 },
                        height: { xs: 64, md: 78 },
                        '@media (orientation: landscape)': { height: { xs: 52, md: 64 } }
                      }}
                    >
                      <AnswerTile
                        onClick={() => handleSymbolClick(symbol)}
                        accent={categoryThemes.math.accentColor}
                        disabled={showFeedback}
                        state={feedback && feedback.symbol === symbol ? (feedback.correct ? 'correct' : 'wrong') : 'idle'}
                      >
                        <SymbolTile op={symbol} sx={{ width: { xs: 40, md: 50 }, height: { xs: 40, md: 50 } }} />
                      </AnswerTile>
                    </Box>
                  ))}
                </Box>
              </Grid>

              {/* Right Side */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  {/* Objects Display */}
                  <Box sx={{
                    mb: 2,
                    minHeight: { xs: 80, md: 100 },
                    maxHeight: { xs: 120, md: 150 },
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 1,
                    overflow: 'hidden',
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 60, md: 80 },
                      maxHeight: { xs: 100, md: 120 }
                    }
                  }}>
                    {Array.from({ length: currentProblem.rightNumber }, (_, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        style={{ fontSize: getEmojiFontSize(currentProblem.rightNumber) }}
                      >
                        {currentProblem.rightObjects.emoji}
                      </motion.span>
                    ))}
                  </Box>
                  {/* Number */}
                  <Typography
                    variant="h1"
                    sx={{
                      fontSize: { xs: '4rem', md: '5rem' },
                      fontWeight: 700,
                      color: 'primary.dark'
                    }}
                  >
                    {currentProblem.rightNumber}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {DANISH_NUMBERS[currentProblem.rightNumber]} {currentProblem.rightObjects.danishName}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Repeat Button */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <MathRepeatButton
                onClick={repeatProblem}
                disabled={false}
                label="Hør igen"
              />
            </Box>
          </Paper>
        </Box>
      )}
    </GameShell>
  )
}

export default ComparisonGame
