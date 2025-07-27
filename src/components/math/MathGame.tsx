import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  IconButton,
  Chip,
  AppBar,
  Toolbar
} from '@mui/material'
import { Volume2, Award, ArrowLeft } from 'lucide-react'
import { audioManager } from '../../utils/audio'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'

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
  const [score, setScore] = useState(0)
  
  // Determine game mode based on current route
  const gameMode: 'counting' | 'arithmetic' = location.pathname.includes('/counting') ? 'counting' : 'arithmetic'
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Character and celebration management
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  useEffect(() => {
    // Initial math teacher greeting
    mathTeacher.setCharacter('fox')
    mathTeacher.wave()
  }, [])

  // Remove useEffect that set gameMode from difficulty settings

  // Generate question when gameMode is set
  useEffect(() => {
    if (gameMode) {
      generateNewQuestion()
    }
    
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    // Listen for navigation events
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    
    // Cleanup function
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [gameMode])

  const generateNewQuestion = () => {
    if (gameMode === 'counting') {
      generateCountingQuestion()
    } else {
      generateArithmeticQuestion()
    }
  }

  const generateCountingQuestion = () => {
    // Clear any existing timeout first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Stop any currently playing audio
    audioManager.stopAll()
    
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
    
    // Schedule audio with proper cleanup
    timeoutRef.current = setTimeout(() => {
      audioManager.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findNumber(number), number.toString())
        .catch(error => {
          console.error('Error in scheduled audio:', error)
        })
      timeoutRef.current = null
    }, 500)
  }

  const generateArithmeticQuestion = () => {
    // Clear any existing timeout first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Stop any currently playing audio
    audioManager.stopAll()
    
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
    
    // Schedule audio with proper cleanup
    timeoutRef.current = setTimeout(async () => {
      try {
        const problemText = `${problem.num1} ${problem.operation} ${problem.num2} = ?`
        await audioManager.speakMathProblem(problemText)
      } catch (error) {
        console.error('Error in scheduled math problem audio:', error)
      }
      timeoutRef.current = null
    }, 500)
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (!currentProblem) return
    
    // iOS CRITICAL: Update user interaction immediately on click
    // This ensures fresh audio permission for subsequent audio calls
    audioManager.updateUserInteraction()
    
    // Clear any pending audio timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Stop any currently playing audio
    audioManager.stopAll()
    
    if (selectedAnswer === currentProblem.answer) {
      // Correct answer - celebrate!
      setScore(score + 1)
      mathTeacher.celebrate()
      celebrate(score > 5 ? 'high' : 'medium')
      
      try {
        await audioManager.announceGameResult(true)
        setTimeout(() => {
          stopCelebration()
          mathTeacher.point()
          generateNewQuestion()
        }, 3000)
      } catch (error) {
        console.error('Error playing success feedback:', error)
      }
    } else {
      // Wrong answer - encourage
      mathTeacher.encourage()
      try {
        await audioManager.announceGameResult(false)
        setTimeout(() => {
          mathTeacher.think()
        }, 1000)
      } catch (error) {
        console.error('Error playing wrong answer feedback:', error)
      }
    }
  }

  const repeatQuestion = () => {
    if (!currentProblem) return
    
    // iOS CRITICAL: Update user interaction for repeat button click
    audioManager.updateUserInteraction()
    
    // Clear any pending timeouts and stop current audio
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    audioManager.stopAll()
    
    if (gameMode === 'counting') {
      audioManager.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findNumber(currentProblem.answer), currentProblem.answer.toString())
        .catch(error => console.error('Error repeating counting question:', error))
    } else {
      const problemText = `${currentProblem.num1} ${currentProblem.operation} ${currentProblem.num2} = ?`
      audioManager.speakMathProblem(problemText)
        .catch(error => console.error('Error repeating math problem:', error))
    }
  }


  if (!currentProblem) return null

  return (
    <Box 
      sx={{ 
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #dbeafe 0%, #dcfce7 50%, #fef3c7 100%)'
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
          
          <Chip 
            icon={<Award size={20} />} 
            label={`${score} ⭐`} 
            color="secondary" 
            onClick={() => audioManager.announceScore(score).catch(console.error)}
            sx={{ 
              fontSize: '1.2rem',
              py: 1,
              fontWeight: 'bold',
              boxShadow: 2,
              cursor: 'pointer',
              '&:hover': { boxShadow: 4 }
            }}
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
                  color: 'secondary.dark',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' }
                }}
              >
                🔢 Quiz
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🧮</Typography>
            </Box>
          </motion.div>
          <Typography variant="h5" color="secondary.main" sx={{ mb: 4, fontSize: { xs: '1rem', md: '1.25rem' } }}>
            {gameMode === 'counting' ? DANISH_PHRASES.ui.clickNumber : DANISH_PHRASES.ui.findAnswer}
          </Typography>
        </Box>

        {/* Audio Control - Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <Button 
            onClick={repeatQuestion}
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<Volume2 size={24} />}
            sx={{ py: 2, px: 4, fontSize: '1.1rem', borderRadius: 3 }}
          >
            🎵 Gentag
          </Button>
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
          {showOptions.map((number, index) => (
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
          ))}
          </Box>
        </Box>

      </Container>
      
      {/* Celebration Effect */}
      <CelebrationEffect
        show={showCelebration}
        character="fox"
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default MathGame