import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  AppBar,
  Toolbar
} from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { isIOS } from '../../utils/deviceDetection'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { MathRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Comprehensive math settings for all ages
const MAX_NUMBER = 30  // Tal Quiz numbers from 1-30
const MAX_ADDITION_NUMBER = 10

interface MathProblem {
  num1: number
  num2: number
  operation: '+' | '-'
  answer: number
}

const MathGame: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null)
  const [showOptions, setShowOptions] = useState<number[]>([])
  
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: 'MathGame',
    autoInitialize: false
  })
  
  // Centralized game state management
  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Determine game mode based on current route
  const gameMode: 'counting' | 'arithmetic' = location.pathname.includes('/counting') ? 'counting' : 'arithmetic'
  
  // Character and celebration management
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  const [audioInitialized, setAudioInitialized] = useState(false)
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    // Initial math teacher greeting
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
      await audio.playGameWelcome('math')
      
      // iOS-optimized delay - increased to prevent audio overlap
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => {
        generateNewQuestion()
      }, delay)
    } catch (error) {
      console.error('Error playing welcome:', error)
      // Still start the game even if audio fails
      generateNewQuestion()
    }
  }

  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  

  const generateNewQuestion = () => {
    if (gameMode === 'counting') {
      generateCountingQuestion()
    } else {
      generateArithmeticQuestion()
    }
  }
  

  const generateCountingQuestion = () => {
    
    // Generate a random number from 1 to MAX_NUMBER
    const number = Math.floor(Math.random() * MAX_NUMBER) + 1
    const options = [number]
    
    while (options.length < 4) {
      const randomNum = Math.floor(Math.random() * MAX_NUMBER) + 1
      if (!options.includes(randomNum)) {
        options.push(randomNum)
      }
    }
    
    setShowOptions(options.sort(() => Math.random() - 0.5))
    setCurrentProblem({ num1: number, num2: 0, operation: '+', answer: number })
    
    // Schedule delayed audio for the number
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Shorter delay for better user experience
    const delay = isIOS() ? 200 : 300
    
    timeoutRef.current = setTimeout(async () => {
      try {
        // Update user interaction timestamp before playing (iOS fix)
        audio.updateUserInteraction()
        await audio.speakQuizPromptWithRepeat(
          DANISH_PHRASES.gamePrompts.findNumber(number), 
          number.toString()
        )
      } catch (error) {
        console.error('Error playing counting question audio:', error)
      } finally {
        if (timeoutRef.current) {
          timeoutRef.current = null
        }
      }
    }, delay)
  }

  const generateArithmeticQuestion = () => {
    // Generate addition problem with reasonable range
    const num1 = Math.floor(Math.random() * MAX_ADDITION_NUMBER) + 1
    const num2 = Math.floor(Math.random() * MAX_ADDITION_NUMBER) + 1
    const answer = num1 + num2
    const problem = { num1, num2, operation: '+' as const, answer }
    setCurrentProblem(problem)
    
    const options = [problem.answer]
    
    // Generate reasonable wrong answers around the correct answer
    while (options.length < 4) {
      const variation = Math.floor(Math.random() * 10) + 1 // 1-10
      const wrongAnswer = Math.random() < 0.5 ? answer + variation : Math.max(1, answer - variation)
      if (!options.includes(wrongAnswer) && wrongAnswer <= 20) {
        options.push(wrongAnswer)
      }
    }
    
    setShowOptions(options.sort(() => Math.random() - 0.5))
    
    // Schedule delayed audio for the problem
    const problemText = `${problem.num1} ${problem.operation} ${problem.num2} = ?`
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Shorter delay for better user experience
    const delay = isIOS() ? 200 : 300
    
    timeoutRef.current = setTimeout(async () => {
      try {
        // Update user interaction timestamp before playing (iOS fix)
        audio.updateUserInteraction()
        await audio.speakMathProblem(problemText)
      } catch (error) {
        console.error('Error playing arithmetic question audio:', error)
      } finally {
        if (timeoutRef.current) {
          timeoutRef.current = null
        }
      }
    }, delay)
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (!currentProblem) return
    
    const clickTime = Date.now()
    console.log(`🎵 MathGame: Answer clicked at ${clickTime} - ${selectedAnswer}`)
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    console.log(`🎵 MathGame: Cancelling current audio for immediate response`)
    audio.cancelCurrentAudio()
    
    const isCorrect = selectedAnswer === currentProblem.answer
    
    // FIRST: Play the number immediately for fast feedback
    try {
      const audioStartTime = Date.now()
      console.log(`🎵 MathGame: Starting number audio at ${audioStartTime} (${audioStartTime - clickTime}ms after click) - ${selectedAnswer}`)
      
      await audio.speakNumber(selectedAnswer)
      
      const audioEndTime = Date.now()
      console.log(`🎵 MathGame: Number audio completed at ${audioEndTime} (${audioEndTime - audioStartTime}ms duration) - ${selectedAnswer}`)
    } catch (error) {
      console.log(`🎵 MathGame: Error playing number audio:`, error)
    }
    
    // IMMEDIATELY: Start visual celebration effects if correct
    if (isCorrect) {
      incrementScore()
      celebrate() // Start celebration visual immediately
      mathTeacher.wave()
    } else {
      mathTeacher.think()
    }
    
    // THEN: Play celebration audio after a very short delay
    setTimeout(async () => {
      try {
        // Just play the audio feedback, visuals already started
        await audio.announceGameResult(isCorrect)
        
        // Auto-advance to next question after celebration
        setTimeout(() => {
          if (isCorrect) {
            stopCelebration() // Stop celebration after 2 seconds
            generateNewQuestion()
          }
        }, isIOS() ? 1500 : 2000) // 2 second celebration duration
        
      } catch (error) {
        console.error('Error in game result audio:', error)
      }
    }, 150) // Very short delay between number audio and celebration audio
  }

  const repeatQuestion = async () => {
    if (!currentProblem) return
    
    const clickTime = Date.now()
    console.log(`🎵 MathGame: Repeat button clicked at ${clickTime}`)
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    console.log(`🎵 MathGame: Cancelling current audio for immediate repeat`)
    audio.cancelCurrentAudio()
    
    try {
      const audioStartTime = Date.now()
      console.log(`🎵 MathGame: Starting repeat audio at ${audioStartTime} (${audioStartTime - clickTime}ms after click)`)
      
      if (gameMode === 'counting') {
        await audio.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findNumber(currentProblem.answer), currentProblem.answer.toString())
      } else {
        const problemText = `${currentProblem.num1} ${currentProblem.operation} ${currentProblem.num2} = ?`
        await audio.speakMathProblem(problemText)
      }
      
      const audioEndTime = Date.now()
      console.log(`🎵 MathGame: Repeat audio completed at ${audioEndTime} (${audioEndTime - audioStartTime}ms duration)`)
    } catch (error) {
      console.error('🎵 MathGame: Error repeating question:', error)
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
            color="secondary"
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
            format="stars"
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
                  color: categoryThemes.math.accentColor,
                  textShadow: '1px 1px 2px rgba(156, 39, 176, 0.2)',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' }
                }}
              >
                Tal Quiz
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🧮</Typography>
            </Box>
          </motion.div>
        </Box>

        {/* Audio Control - Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <MathRepeatButton
            onClick={repeatQuestion}
            disabled={false}
          />
        </Box>

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
          {showOptions.length > 0 ? showOptions.map((number, index) => (
            <motion.div
              key={`${number}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ height: '100%' }}
            >
              <Card 
                onClick={() => handleAnswerClick(number)}
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: 'secondary.200',
                  bgcolor: 'white',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  '&:hover': {
                    borderColor: 'secondary.main',
                    bgcolor: 'secondary.50',
                    boxShadow: 12,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent 
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: { xs: 1.5, sm: 2, md: 2.5 }
                  }}
                >
                  <Typography 
                    variant="h1"
                    sx={{ 
                      fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                      fontWeight: 700,
                      color: 'secondary.dark',
                      userSelect: 'none',
                      lineHeight: 1,
                      // Adjust font size in landscape
                      '@media (orientation: landscape)': {
                        fontSize: 'clamp(2rem, 6vw, 3.5rem)'
                      }
                    }}
                  >
                    {number}
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

export default MathGame