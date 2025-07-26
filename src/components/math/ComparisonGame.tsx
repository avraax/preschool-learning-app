import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, Chip, AppBar, Toolbar, Paper, Grid } from '@mui/material'
import { ArrowBack, Star, VolumeUp } from '@mui/icons-material'
import { motion } from 'framer-motion'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { audioManager } from '../../utils/audio'

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
  'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti'
]

interface ComparisonProblem {
  leftNumber: number
  rightNumber: number
  leftObjects: typeof OBJECT_TYPES[0]
  rightObjects: typeof OBJECT_TYPES[0]
  correctSymbol: '>' | '<' | '='
  questionType: 'largest' | 'smallest' | 'equal'
}

const ComparisonGame: React.FC = () => {
  const navigate = useNavigate()
  const [currentProblem, setCurrentProblem] = useState<ComparisonProblem | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showIOSPrompt, setShowIOSPrompt] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Character and celebration management
  const mathTeacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  useEffect(() => {
    generateNewProblem()
    
    // Initialize math teacher character
    mathTeacher.setCharacter('fox')
    mathTeacher.wave()
  }, [])

  const generateNewProblem = () => {
    // Generate numbers 1-10 for age 4-6 appropriateness
    const leftNum = Math.floor(Math.random() * 10) + 1
    let rightNum = Math.floor(Math.random() * 10) + 1
    
    // Randomly decide if we want equal numbers (25% chance)
    const wantEqual = Math.random() < 0.25
    
    if (wantEqual) {
      // Force equal numbers
      rightNum = leftNum
    } else {
      // Force different numbers
      while (rightNum === leftNum) {
        rightNum = Math.floor(Math.random() * 10) + 1
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
    setSelectedSymbol(null)
    setShowFeedback(false)
    
    // Speak the problem after a delay
    timeoutRef.current = setTimeout(() => {
      speakProblem(problem)
    }, 1000)
  }

  const speakProblem = async (problem: ComparisonProblem) => {
    if (isPlaying) return
    
    setIsPlaying(true)
    
    try {
      // Count left objects
      const leftText = `${DANISH_NUMBERS[problem.leftNumber]} ${problem.leftObjects.danishName}`
      await audioManager.speak(leftText)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Count right objects  
      const rightText = `${DANISH_NUMBERS[problem.rightNumber]} ${problem.rightObjects.danishName}`
      await audioManager.speak(rightText)
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Ask comparison question based on question type
      let questionText = ''
      if (problem.questionType === 'largest') {
        questionText = 'Hvilket tal er størst?'
      } else if (problem.questionType === 'smallest') {
        questionText = 'Hvilket tal er mindst?'
      } else {
        questionText = 'Er tallene ens?'
      }
      await audioManager.speak(questionText)
      
    } catch (error) {
      console.error('Error speaking problem:', error)
    } finally {
      setIsPlaying(false)
    }
  }

  const handleSymbolClick = async (symbol: '>' | '<' | '=') => {
    if (!currentProblem || isPlaying || showFeedback) return
    
    setSelectedSymbol(symbol)
    setShowFeedback(true)
    setIsPlaying(true)
    
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
    
    if (isCorrect) {
      // Correct answer - celebrate!
      setScore(score + 1)
      mathTeacher.celebrate()
      celebrate(score > 5 ? 'high' : 'medium')
      
      try {
        await audioManager.announceGameResult(true)
      } catch (error) {
        console.error('Error playing success sound:', error)
      }
      
      timeoutRef.current = setTimeout(() => {
        stopCelebration()
        mathTeacher.point()
        generateNewProblem()
        setIsPlaying(false)
      }, 3000)
      
    } else {
      // Wrong answer - encourage and teach
      mathTeacher.encourage()
      
      try {
        await audioManager.announceGameResult(false)
        
        // Provide teaching moment
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        let teachingText = ''
        
        if (currentProblem.questionType === 'equal') {
          if (currentProblem.correctSymbol === '=') {
            teachingText = `${DANISH_NUMBERS[currentProblem.leftNumber]} er lige med ${DANISH_NUMBERS[currentProblem.rightNumber]}`
          } else {
            teachingText = `${DANISH_NUMBERS[currentProblem.leftNumber]} er ikke lige med ${DANISH_NUMBERS[currentProblem.rightNumber]}`
          }
        } else if (currentProblem.questionType === 'largest') {
          if (currentProblem.leftNumber > currentProblem.rightNumber) {
            teachingText = `${DANISH_NUMBERS[currentProblem.leftNumber]} er størst`
          } else if (currentProblem.rightNumber > currentProblem.leftNumber) {
            teachingText = `${DANISH_NUMBERS[currentProblem.rightNumber]} er størst`
          } else {
            teachingText = `${DANISH_NUMBERS[currentProblem.leftNumber]} og ${DANISH_NUMBERS[currentProblem.rightNumber]} er ens`
          }
        } else if (currentProblem.questionType === 'smallest') {
          if (currentProblem.leftNumber < currentProblem.rightNumber) {
            teachingText = `${DANISH_NUMBERS[currentProblem.leftNumber]} er mindst`
          } else if (currentProblem.rightNumber < currentProblem.leftNumber) {
            teachingText = `${DANISH_NUMBERS[currentProblem.rightNumber]} er mindst`
          } else {
            teachingText = `${DANISH_NUMBERS[currentProblem.leftNumber]} og ${DANISH_NUMBERS[currentProblem.rightNumber]} er ens`
          }
        }
        
        await audioManager.speak(teachingText)
        
      } catch (error) {
        console.error('Error playing encouragement:', error)
      }
      
      timeoutRef.current = setTimeout(() => {
        mathTeacher.think()
        setShowFeedback(false)
        setSelectedSymbol(null)
        setIsPlaying(false)
      }, 4000)
    }
  }

  const repeatProblem = () => {
    if (currentProblem) {
      speakProblem(currentProblem)
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
        background: 'linear-gradient(135deg, #e1f5fe 0%, #f3e5f5 50%, #fff8e1 100%)'
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
                Sammenlign Tal
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🔢</Typography>
            </Box>
          </motion.div>
        </Box>

        {/* Problem Display */}
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
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              border: '2px solid',
              borderColor: 'primary.200',
              mb: 4
            }}
          >
            <Grid container spacing={4} alignItems="center">
              {/* Left Side */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  {/* Objects Display */}
                  <Box sx={{ mb: 2, minHeight: 100, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    {Array.from({ length: currentProblem.leftNumber }, (_, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        style={{ fontSize: '2rem' }}
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

              {/* Symbol Selection */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  {showFeedback && selectedSymbol ? (
                    <Box sx={{ mb: 2 }}>
                      <Typography 
                        variant="h1" 
                        sx={{ 
                          fontSize: { xs: '4rem', md: '6rem' }, 
                          fontWeight: 700,
                          color: selectedSymbol === currentProblem.correctSymbol ? 'success.main' : 'error.main'
                        }}
                      >
                        {selectedSymbol}
                      </Typography>
                      {selectedSymbol === currentProblem.correctSymbol && (
                        <Typography variant="h6" color="success.main">
                          Rigtig! 🎉
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {(['>', '<', '='] as const).map((symbol) => (
                        <Button
                          key={symbol}
                          variant="contained"
                          size="large"
                          onClick={() => handleSymbolClick(symbol)}
                          disabled={isPlaying || showFeedback}
                          sx={{
                            fontSize: { xs: '2rem', md: '3rem' },
                            fontWeight: 700,
                            py: 2,
                            px: 4,
                            borderRadius: 3,
                            boxShadow: 4,
                            '&:hover': {
                              boxShadow: 8,
                              transform: 'scale(1.05)'
                            }
                          }}
                        >
                          {symbol}
                        </Button>
                      ))}
                    </Box>
                  )}
                </Box>
              </Grid>

              {/* Right Side */}
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  {/* Objects Display */}
                  <Box sx={{ mb: 2, minHeight: 100, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    {Array.from({ length: currentProblem.rightNumber }, (_, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        style={{ fontSize: '2rem' }}
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
            </Box>
          </Paper>
        </Box>
      </Container>

      {/* iOS Audio Permission Prompt */}
      {showIOSPrompt && (
        <Box sx={{ position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 1000 }}>
          <Button
            onClick={() => setShowIOSPrompt(false)}
            variant="contained"
            color="info"
            size="large"
            fullWidth
            sx={{ py: 2, fontSize: '1.1rem' }}
          >
            Tryk for at høre opgaven 🔊
          </Button>
        </Box>
      )}
      
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

export default ComparisonGame