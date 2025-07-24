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
  Add,
  Star
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'

interface AdditionGameProps {
  onBack: () => void
}

const AdditionGame: React.FC<AdditionGameProps> = ({ onBack }) => {
  const [num1, setNum1] = useState(0)
  const [num2, setNum2] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState(0)
  const [options, setOptions] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    generateNewProblem()
    
    // Cleanup function
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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
    
    // Speak the problem after a short delay
    setTimeout(() => {
      speakProblem(firstNum, secondNum)
    }, 500)
  }

  const speakProblem = async (a: number, b: number) => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    try {
      await audioManager.speakAdditionProblem(a, b, 'primary')
    } catch (error) {
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
      setScore(score + 1)
      try {
        await audioManager.announceGameResult(true)
      } catch (error) {
        console.error('Error playing success sound:', error)
      }
      
      setTimeout(() => {
        generateNewProblem()
        setIsPlaying(false)
      }, 2000)
    } else {
      try {
        await audioManager.announceGameResult(false)
      } catch (error) {
        console.error('Error playing encouragement sound:', error)
      }
      
      setTimeout(() => {
        setIsPlaying(false)
      }, 2000)
    }
  }

  const repeatProblem = () => {
    speakProblem(num1, num2)
  }

  // Render visual representation of numbers (finger counting style)
  const renderFingers = (count: number) => {
    const fingers = []
    for (let i = 0; i < count; i++) {
      fingers.push(
        <Typography key={i} sx={{ fontSize: '1.5rem', display: 'inline' }}>
          ✋
        </Typography>
      )
    }
    return fingers
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f3e5f5 50%, #fff3e0 100%)'
      }}
    >
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={onBack}
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
                color: 'primary.dark',
                fontWeight: 700,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Add fontSize="large" /> Plus Opgaver
            </Typography>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4 }}>
            Hvad bliver svaret?
          </Typography>
        </Box>

        {/* Problem Display */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
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
              {/* First number with visual */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h1" 
                  sx={{ 
                    fontSize: { xs: '3rem', md: '4rem' }, 
                    fontWeight: 700, 
                    color: 'primary.dark',
                    mb: 1
                  }}
                >
                  {num1}
                </Typography>
                <Box>{renderFingers(num1)}</Box>
              </Box>

              {/* Plus sign */}
              <Add sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, color: 'secondary.main' }} />

              {/* Second number with visual */}
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h1" 
                  sx={{ 
                    fontSize: { xs: '3rem', md: '4rem' }, 
                    fontWeight: 700, 
                    color: 'primary.dark',
                    mb: 1
                  }}
                >
                  {num2}
                </Typography>
                <Box>{renderFingers(num2)}</Box>
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

        {/* Answer Options Grid */}
        <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
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
                        lineHeight: 1,
                        mb: 1
                      }}
                    >
                      {option}
                    </Typography>
                    <Box>{renderFingers(option)}</Box>
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

export default AdditionGame