import React, { useState, useEffect, useRef } from 'react'
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
  Toolbar
} from '@mui/material'
import {
  ArrowBack,
  VolumeUp,
  Calculate,
  Star
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { difficultyManager } from '../../utils/difficulty'

interface MathGameProps {
  onBack: () => void
}

interface MathProblem {
  num1: number
  num2: number
  operation: '+' | '-'
  answer: number
}

const MathGame: React.FC<MathGameProps> = ({ onBack }) => {
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null)
  const [showOptions, setShowOptions] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [gameMode, setGameMode] = useState<'counting' | 'arithmetic'>('counting')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const settings = difficultyManager.getCurrentSettings()
    const mode = (settings.math.includeAddition || settings.math.includeSubtraction) ? 'arithmetic' : 'counting'
    setGameMode(mode)
  }, [])

  // Generate question when gameMode is set
  useEffect(() => {
    if (gameMode) {
      generateNewQuestion()
    }
    
    // Cleanup function
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
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
    
    const number = difficultyManager.getRandomNumber()
    const options = [number]
    
    while (options.length < 4) {
      const randomNum = difficultyManager.getRandomNumber()
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
    
    const problem = difficultyManager.generateMathProblem()
    setCurrentProblem(problem)
    
    const options = [problem.answer]
    const maxNumber = difficultyManager.getCurrentSettings().math.maxNumber
    
    while (options.length < 4) {
      const randomNum = Math.floor(Math.random() * maxNumber) + 1
      if (!options.includes(randomNum)) {
        options.push(randomNum)
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
    setIsPlaying(true)
    
    if (selectedAnswer === currentProblem.answer) {
      setScore(score + 1)
      try {
        await audioManager.announceGameResult(true)
        setTimeout(() => {
          generateNewQuestion()
          setIsPlaying(false)
        }, 2000)
      } catch (error) {
        console.error('Error playing success feedback:', error)
        setIsPlaying(false)
      }
    } else {
      // For wrong answers, allow immediate new clicks
      try {
        await audioManager.announceGameResult(false)
      } catch (error) {
        console.error('Error playing wrong answer feedback:', error)
      }
      // Don't block further clicks - just reset isPlaying immediately
      setIsPlaying(false)
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

  const renderFingers = (number: number) => {
    const fingers = []
    for (let i = 0; i < Math.min(number, 10); i++) {
      fingers.push(
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          style={{ fontSize: '2rem', margin: '0 2px' }}
        >
          ✋
        </motion.span>
      )
    }
    return fingers
  }

  if (!currentProblem) return null

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #dbeafe 0%, #dcfce7 50%, #fef3c7 100%)'
      }}
    >
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={onBack}
            color="secondary"
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
            color="secondary" 
            sx={{ 
              fontSize: '1.1rem',
              py: 1,
              fontWeight: 'bold',
              boxShadow: 2
            }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Game Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h3" 
              sx={{ 
                color: 'secondary.dark',
                fontWeight: 700,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Calculate fontSize="large" /> Tal Quiz
            </Typography>
          </motion.div>
          <Typography variant="h5" color="secondary.main" sx={{ mb: 4 }}>
            {gameMode === 'counting' ? 'Klik på det tal du hører!' : 'Hvad er svaret?'}
          </Typography>
        </Box>

        {/* Audio Control */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <Button 
            onClick={repeatQuestion}
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<VolumeUp />}
            sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
          >
            Hør igen 🎵
          </Button>
        </Box>

        {/* Answer Options Grid */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
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
    </Box>
  )
}

export default MathGame