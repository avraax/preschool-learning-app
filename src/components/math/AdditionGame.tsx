import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Paper,
  AppBar,
  Toolbar
} from '@mui/material'
import {
  Add
} from '@mui/icons-material'
import { ArrowLeft } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'


const AdditionGame: React.FC = () => {
  const navigate = useNavigate()
  const [num1, setNum1] = useState<number | null>(null)
  const [num2, setNum2] = useState<number | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
  const [options, setOptions] = useState<number[]>([])
    
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: 'AdditionGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const hasInitialized = useRef(false)
  
  // Centralized game state management
  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Character and celebration management
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 AdditionGame: ${message}`, data)
    }
  }

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    // Initialize math teacher character
    mathTeacher.setCharacter('fox')
    mathTeacher.wave()
    
    // Check if audio is ready
    if (audio.isAudioReady) {
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])
  
  // Monitor audio readiness - only if not already initialized
  useEffect(() => {
    if (audio.isAudioReady && !audioInitialized && !hasInitialized.current) {
      hasInitialized.current = true
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady, audioInitialized])

  // Play welcome message and start game
  const playWelcomeAndStart = async () => {
    try {
      // Play the welcome message
      await audio.playGameWelcome('addition')
      
      // iOS-optimized delay - increased to prevent audio overlap
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => {
        setGameReady(true)
        generateNewProblem()
      }, delay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      setGameReady(true)
      generateNewProblem()
    }
  }


  // This problematic useEffect has been removed to prevent infinite loops
  // Audio is now handled by the centralized task-based game pattern

  const generateNewProblem = () => {
    // Generate two numbers that add up to max 10
    const firstNum = Math.floor(Math.random() * 6) + 1 // 1-6
    const maxSecondNum = Math.min(10 - firstNum, 6) // ensure sum ≤ 10
    const secondNum = Math.floor(Math.random() * maxSecondNum) + 1 // 1 to maxSecondNum
    
    setNum1(firstNum)
    setNum2(secondNum)
    const answer = firstNum + secondNum
    setCorrectAnswer(answer)
    
    // Generate 4 answer options
    const answerOptions = new Set([answer])
    
    // Generate 3 wrong answers
    while (answerOptions.size < 4) {
      const wrongAnswer = Math.floor(Math.random() * 10) + 1 // 1-10
      if (wrongAnswer !== answer) {
        answerOptions.add(wrongAnswer)
      }
    }
    
    setOptions(Array.from(answerOptions).sort(() => Math.random() - 0.5))
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // iOS-optimized delay
    const delay = isIOS() ? 100 : 500
    
    // Schedule delayed audio for the problem
    timeoutRef.current = setTimeout(() => {
      speakProblem(firstNum, secondNum)
    }, delay)
  }

  const speakProblem = async (a: number, b: number) => {
    try {
      // Update user interaction timestamp before playing (iOS fix)
      audio.updateUserInteraction()
      await audio.speakAdditionProblem(a, b, 'primary')
    } catch (error: any) {
      logError('Error speaking problem', {
        num1: a,
        num2: b,
        error: error?.toString()
      })
    }
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (correctAnswer === null) return
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    const isCorrect = selectedAnswer === correctAnswer
    
    // FIRST: Play the number immediately for fast feedback
    try {
      await audio.speakNumber(selectedAnswer)
    } catch (error) {
    }
    
    // IMMEDIATELY: Start visual celebration effects if correct
    if (isCorrect) {
      incrementScore()
      celebrate() // Start celebration visual immediately
      mathTeacher.wave()
    } else {
      mathTeacher.think()
    }
    
    // THEN: Use centralized celebration with standard timing
    setTimeout(async () => {
      try {
        await audio.playCelebrationWithStandardTiming({
          isCorrect,
          celebrate,
          stopCelebration,
          incrementScore: undefined, // Score already incremented above
          nextAction: isCorrect ? generateNewProblem : undefined,
          teacherCharacter: mathTeacher
        })
      } catch (error: any) {
        console.error('Error in centralized celebration:', error)
        logError('Error in centralized celebration', {
          selectedAnswer,
          correctAnswer,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150) // Very short delay between number audio and celebration audio
  }

  const repeatProblem = async () => {
    if (num1 === null || num2 === null) return
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    try {
      await speakProblem(num1, num2)
    } catch (error) {
      console.error('🎵 AdditionGame: Error repeating problem:', error)
    }
  }



  return (
    <Box 
      sx={{ 
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: categoryThemes.math.gradient
      }}
    >
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={() => navigate('/math')}
            color="primary"
            size="large"
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { 
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          
          <MathScoreChip
            score={score}
            disabled={isScoreNarrating}
            onClick={handleScoreClick}
          />
        </Toolbar>
      </AppBar>

      <Container 
        maxWidth="lg" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 },
          overflow: 'hidden'
        }}
      >
        {/* Game Title with Math Teacher */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <LottieCharacter
                character={mathTeacher.character}
                state={mathTeacher.state}
                size={80}
                onClick={mathTeacher.wave}
              />
              <Typography 
                variant="h3" 
                sx={{ 
                  color: 'primary.dark',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' }
                }}
              >
                <Add fontSize="large" /> Plus Opgaver
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🧮</Typography>
            </Box>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4, fontSize: { xs: '1rem', md: '1.25rem' } }}>
            Hvad bliver svaret? 🤔
          </Typography>
        </Box>

        {/* Problem Display - Compact */}
        {gameReady && num1 !== null && num2 !== null && options.length > 0 && (
          <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
            <Paper 
              elevation={8}
              sx={{ 
                maxWidth: 500,
                mx: 'auto',
                p: { xs: 2, md: 4 },
                borderRadius: 4,
                border: '2px solid',
                borderColor: 'primary.200',
                mb: 3
              }}
            >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 2, md: 3 }, mb: 3 }}>
              {/* First number */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h1" 
                  sx={{ 
                    fontSize: { xs: '3rem', md: '4rem' }, 
                    fontWeight: 700, 
                    color: 'primary.dark'
                  }}
                >
                  {num1}
                </Typography>
              </Box>

              {/* Plus sign */}
              <Add sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, color: 'secondary.main' }} />

              {/* Second number */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h1" 
                  sx={{ 
                    fontSize: { xs: '3rem', md: '4rem' }, 
                    fontWeight: 700, 
                    color: 'primary.dark'
                  }}
                >
                  {num2}
                </Typography>
              </Box>

              {/* Equals sign */}
              <Typography 
                variant="h1" 
                sx={{ 
                  fontSize: { xs: '2.5rem', md: '3rem' }, 
                  fontWeight: 700, 
                  color: 'text.secondary'
                }}
              >
                =
              </Typography>

              {/* Question mark */}
              <Typography 
                variant="h1" 
                sx={{ 
                  fontSize: { xs: '3rem', md: '4rem' }, 
                  fontWeight: 700, 
                  color: 'secondary.main'
                }}
              >
                ?
              </Typography>
            </Box>

            <MathRepeatButton
              onClick={repeatProblem}
              disabled={false}
            />
          </Paper>
        </Box>
        )}

        {/* Answer Options Grid - Flexible */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 0
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
              // Individual card aspect ratio and constraints
              '& > *': {
                aspectRatio: '4/3',
                minHeight: { xs: '80px', sm: '90px', md: '100px' },
                maxHeight: { xs: '120px', sm: '140px', md: '160px' },
                width: '100%'
              },
              // Orientation specific adjustments
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
          {gameReady && options.length > 0 ? options.map((option, index) => (
            <motion.div
              key={`${option}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ height: '100%' }}
            >
              <Card 
                onClick={() => handleAnswerClick(option)}
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: 'primary.200',
                  bgcolor: 'white',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  outline: 'none',
                  '&:focus': {
                    outline: 'none'
                  },
                  '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                      boxShadow: 12,
                      transform: 'translateY(-2px)'
                    }
                  }
                }}
              >
                <CardContent 
                  sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: { xs: 1.5, sm: 2, md: 2.5 },
                    textAlign: 'center'
                  }}
                >
                    <Typography 
                      variant="h1"
                      sx={{ 
                        fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                        fontWeight: 700,
                        color: 'primary.dark',
                        userSelect: 'none',
                        lineHeight: 1,
                        // Adjust font size in landscape
                        '@media (orientation: landscape)': {
                          fontSize: 'clamp(2rem, 6vw, 3.5rem)'
                        }
                      }}
                    >
                      {option}
                    </Typography>
                  </CardContent>
              </Card>
            </motion.div>
          )) : null}
          </Box>
        </Box>

      </Container>

      {/* Celebration Effect */}
      <CelebrationEffect
        show={showCelebration}
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default AdditionGame