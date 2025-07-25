import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Grid,
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
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'

// Comprehensive math settings for all ages
const MAX_NUMBER = 50
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
      audioManager.speakQuizPromptWithRepeat(`Find tallet ${number}`, number.toString())
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
    
    // Clear any pending timeouts and stop current audio
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    audioManager.stopAll()
    
    if (gameMode === 'counting') {
      audioManager.speakQuizPromptWithRepeat(`Find tallet ${currentProblem.answer}`, currentProblem.answer.toString())
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
        height: '100vh',
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
              bgcolor: 'white', 
              boxShadow: 3,
              '&:hover': { boxShadow: 6 }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          
          <Chip 
            icon={<Award size={20} />} 
            label={`${score} ⭐`} 
            color="secondary" 
            sx={{ 
              fontSize: '1.2rem',
              py: 1,
              fontWeight: 'bold',
              boxShadow: 2
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
            {gameMode === 'counting' ? 'Klik på tallet! 👆' : 'Find svaret! 🤔'}
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
          <Grid 
            container 
            spacing={{ xs: 2, sm: 3 }} 
            sx={{ 
              maxWidth: { xs: '100%', sm: '600px', md: '800px' },
              width: 'fit-content'
            }}
          >
          {showOptions.map((number, index) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${number}-${index}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Card 
                  onClick={() => handleAnswerClick(number)}
                  sx={{ 
                    minHeight: { xs: 80, sm: 100, md: 120 },
                    cursor: 'pointer',
                    border: '3px solid',
                    borderColor: 'secondary.200',
                    bgcolor: 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'secondary.main',
                      bgcolor: 'secondary.50',
                      boxShadow: 12
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: 2
                    }}
                  >
                    <Typography 
                      variant="h1"
                      sx={{ 
                        fontSize: { xs: '3rem', md: '4rem' },
                        fontWeight: 700,
                        color: 'secondary.dark',
                        userSelect: 'none',
                        lineHeight: 1
                      }}
                    >
                      {number}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
          </Grid>
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