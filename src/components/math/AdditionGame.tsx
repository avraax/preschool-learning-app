import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Paper,
  AppBar,
  Toolbar
} from '@mui/material'
import {
  ArrowBack,
  VolumeUp,
  Add,
  Star
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { categoryThemes } from '../../config/categoryThemes'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'


const AdditionGame: React.FC = () => {
  const navigate = useNavigate()
  const [num1, setNum1] = useState(0)
  const [num2, setNum2] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState(0)
  const [options, setOptions] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Character and celebration management
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  useEffect(() => {
    generateNewProblem()
    
    // Initialize math teacher character
    mathTeacher.setCharacter('fox')
    mathTeacher.wave()
    
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
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
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [])

  // Speak the problem when numbers are set (after initial render and state updates)
  useEffect(() => {
    if (num1 && num2) {
      timeoutRef.current = setTimeout(() => {
        speakProblem(num1, num2)
      }, 800)
    }
  }, [num1, num2])

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
  }

  const speakProblem = async (a: number, b: number) => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    try {
      await audioManager.speakAdditionProblem(a, b, 'primary')
    } catch (error: any) {
      console.error('Error speaking problem:', error)
    } finally {
      setIsPlaying(false)
    }
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    if (selectedAnswer === correctAnswer) {
      // Correct answer - celebrate!
      setScore(score + 1)
      mathTeacher.celebrate()
      celebrate(score > 5 ? 'high' : 'medium')
      
      try {
        await audioManager.announceGameResult(true)
      } catch (error: any) {
        console.error('Error playing success sound:', error)
      }
      
      setTimeout(() => {
        stopCelebration()
        mathTeacher.point()
        generateNewProblem()
        setIsPlaying(false)
      }, 3000)
    } else {
      // Wrong answer - encourage
      mathTeacher.encourage()
      
      try {
        await audioManager.announceGameResult(false)
      } catch (error: any) {
        console.error('Error playing encouragement sound:', error)
      }
      
      setTimeout(() => {
        mathTeacher.think()
        setIsPlaying(false)
      }, 2000)
    }
  }

  const repeatProblem = () => {
    speakProblem(num1, num2)
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
              bgcolor: 'white', 
              boxShadow: 3,
              '&:hover': { boxShadow: 6 }
            }}
          >
            <ArrowBack />
          </IconButton>
          
          <Chip 
            icon={<Star />} 
            label={`Point: ${score}`} 
            color="primary" 
            onClick={() => audioManager.announceScore(score).catch(console.error)}
            sx={{ 
              fontSize: '1.1rem',
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

            <Button 
              onClick={repeatProblem}
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<VolumeUp />}
              disabled={isPlaying}
              sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
            >
              Hør igen 🎵
            </Button>
          </Paper>
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
          {options.map((option, index) => (
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
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                    boxShadow: 12,
                    transform: 'translateY(-2px)'
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

export default AdditionGame