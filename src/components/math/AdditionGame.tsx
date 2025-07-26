import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Paper,
  AppBar,
  Toolbar,
  Snackbar,
  Alert
} from '@mui/material'
import {
  ArrowBack,
  VolumeUp,
  Add,
  Star,
  TouchApp
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { isIOS } from '../../utils/deviceDetection'
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
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInteractionRef = useRef<number>(Date.now())
  
  // Character and celebration management
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  useEffect(() => {
    generateNewProblem()
    
    // Initialize math teacher character
    mathTeacher.setCharacter('fox')
    mathTeacher.wave()
    
    // Track user interactions for iOS
    const updateInteraction = () => {
      lastInteractionRef.current = Date.now()
    }
    
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    document.addEventListener('click', updateInteraction)
    document.addEventListener('touchstart', updateInteraction)
    
    // Listen for navigation events
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    
    // Cleanup function
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      document.removeEventListener('click', updateInteraction)
      document.removeEventListener('touchstart', updateInteraction)
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
      // Check if iOS needs user interaction
      if (isIOS() && Date.now() - lastInteractionRef.current > 5000) {
        setShowIOSPrompt(true)
        setIsPlaying(false)
        return
      }
      
      await audioManager.speakAdditionProblem(a, b, 'primary')
    } catch (error: any) {
      console.error('Error speaking problem:', error)
      // Show iOS prompt if it's a permission error
      if (isIOS() && error?.name === 'NotAllowedError') {
        setShowIOSPrompt(true)
      }
    } finally {
      setIsPlaying(false)
    }
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    setShowIOSPrompt(false) // Hide prompt on interaction
    
    if (selectedAnswer === correctAnswer) {
      // Correct answer - celebrate!
      setScore(score + 1)
      mathTeacher.celebrate()
      celebrate(score > 5 ? 'high' : 'medium')
      
      try {
        await audioManager.announceGameResult(true)
      } catch (error: any) {
        console.error('Error playing success sound:', error)
        // Show iOS prompt if it's a permission error
        if (isIOS() && error?.name === 'NotAllowedError') {
          setShowIOSPrompt(true)
        }
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
        // Show iOS prompt if it's a permission error
        if (isIOS() && error?.name === 'NotAllowedError') {
          setShowIOSPrompt(true)
        }
      }
      
      setTimeout(() => {
        mathTeacher.think()
        setIsPlaying(false)
      }, 2000)
    }
  }

  const repeatProblem = () => {
    setShowIOSPrompt(false) // Hide prompt on interaction
    speakProblem(num1, num2)
  }

  const handleIOSPromptClick = () => {
    setShowIOSPrompt(false)
    lastInteractionRef.current = Date.now()
    speakProblem(num1, num2)
  }


  return (
    <Box 
      sx={{ 
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f3e5f5 50%, #fff3e0 100%)'
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
          <Grid 
            container 
            spacing={{ xs: 2, sm: 3 }} 
            sx={{ 
              maxWidth: { xs: '100%', sm: '600px', md: '800px' },
              width: 'fit-content'
            }}
          >
          {options.map((option, index) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${option}-${index}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Card 
                  onClick={() => handleAnswerClick(option)}
                  sx={{ 
                    minHeight: { xs: 80, sm: 100, md: 120 },
                    cursor: 'pointer',
                    border: '3px solid',
                    borderColor: 'primary.200',
                    bgcolor: 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                      boxShadow: 12
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
                      p: 2,
                      textAlign: 'center'
                    }}
                  >
                    <Typography 
                      variant="h1"
                      sx={{ 
                        fontSize: { xs: '3rem', md: '4rem' },
                        fontWeight: 700,
                        color: 'primary.dark',
                        userSelect: 'none',
                        lineHeight: 1
                      }}
                    >
                      {option}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
          </Grid>
        </Box>

      </Container>

      {/* iOS Audio Permission Prompt */}
      <Snackbar
        open={showIOSPrompt}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 4 }}
      >
        <Alert
          severity="info"
          icon={<TouchApp />}
          action={
            <Button color="inherit" size="small" onClick={handleIOSPromptClick}>
              Tryk her for lyd
            </Button>
          }
          sx={{ 
            width: '100%',
            fontSize: '1.1rem',
            alignItems: 'center'
          }}
        >
          Tryk for at høre opgaven 🔊
        </Alert>
      </Snackbar>
      
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