import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    const settings = difficultyManager.getCurrentSettings()
    if (settings.math.includeAddition || settings.math.includeSubtraction) {
      setGameMode('arithmetic')
    } else {
      setGameMode('counting')
    }
    generateNewQuestion()
  }, [])

  const generateNewQuestion = () => {
    if (gameMode === 'counting') {
      generateCountingQuestion()
    } else {
      generateArithmeticQuestion()
    }
  }

  const generateCountingQuestion = () => {
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
    
    setTimeout(() => {
      audioManager.speakSlowly(`Find tallet ${number}`)
    }, 500)
  }

  const generateArithmeticQuestion = () => {
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
    
    setTimeout(async () => {
      const problemText = `${problem.num1} ${problem.operation} ${problem.num2} = ?`
      await audioManager.speakMathProblem(problemText)
    }, 500)
  }

  const handleAnswerClick = async (selectedAnswer: number) => {
    if (isPlaying || !currentProblem) return
    
    setIsPlaying(true)
    
    if (selectedAnswer === currentProblem.answer) {
      setScore(score + 1)
      await audioManager.announceGameResult(true)
      setTimeout(() => {
        generateNewQuestion()
        setIsPlaying(false)
      }, 2000)
    } else {
      await audioManager.announceGameResult(false)
      setTimeout(() => {
        setIsPlaying(false)
      }, 2000)
    }
  }

  const repeatQuestion = () => {
    if (!currentProblem) return
    
    if (gameMode === 'counting') {
      audioManager.speakSlowly(`Tallet er ${currentProblem.answer}`)
    } else {
      const problemText = `${currentProblem.num1} ${currentProblem.operation} ${currentProblem.num2} = ?`
      audioManager.speakMathProblem(problemText)
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
            label={`Score: ${score}`}
            color="secondary"
            variant="filled"
            sx={{ 
              fontSize: '1.25rem',
              py: 3,
              px: 2,
              fontWeight: 700,
              bgcolor: 'white',
              color: 'secondary.dark',
              boxShadow: 3
            }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Game Title */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h2" 
              sx={{ 
                color: 'secondary.dark',
                mb: 2,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Calculate fontSize="large" /> Tal og Regning
            </Typography>
          </motion.div>
          <Typography variant="h5" color="secondary.main" sx={{ mb: 4 }}>
            {gameMode === 'counting' ? 'Klik på det tal du hører!' : 'Hvad er svaret?'}
          </Typography>

          {/* Problem Display Card */}
          <Paper 
            elevation={8}
            sx={{ 
              maxWidth: 500,
              mx: 'auto',
              p: 4,
              borderRadius: 4,
              border: '2px solid',
              borderColor: 'secondary.200'
            }}
          >
            {gameMode === 'counting' ? (
              <Box>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <VolumeUp 
                    sx={{ 
                      fontSize: '4rem', 
                      color: 'secondary.main',
                      mb: 2
                    }} 
                  />
                </motion.div>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                  {renderFingers(currentProblem.answer)}
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography 
                  variant="h3" 
                  color="secondary.dark"
                  sx={{ mb: 3, fontWeight: 700 }}
                >
                  {currentProblem.num1} {currentProblem.operation} {currentProblem.num2} = ?
                </Typography>
                <Box sx={{ 
                  mb: 3, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 2
                }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {renderFingers(currentProblem.num1)}
                  </Box>
                  <Typography variant="h4" color="secondary.main" sx={{ mx: 2 }}>
                    {currentProblem.operation}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {renderFingers(currentProblem.num2)}
                  </Box>
                </Box>
              </Box>
            )}
            
            <Button 
              onClick={repeatQuestion}
              variant="contained"
              color="success"
              size="large"
              startIcon={<VolumeUp />}
              sx={{ py: 2, px: 4 }}
            >
              Hør igen 🎵
            </Button>
          </Paper>
        </Box>

        {/* Answer Options Grid */}
        <Grid 
          container 
          spacing={3} 
          sx={{ 
            maxWidth: '800px',
            mx: 'auto',
            mb: 6
          }}
        >
          {showOptions.map((number, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={`${number}-${index}`}>
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
                    minHeight: { xs: 100, md: 120 },
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

        {/* Decorative Animation */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Typography sx={{ fontSize: '4rem' }}>🎯</Typography>
          </motion.div>
        </Box>
      </Container>
    </Box>
  )
}

export default MathGame