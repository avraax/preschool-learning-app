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
  School,
  Star
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { difficultyManager } from '../../utils/difficulty'

interface AlphabetGameProps {
  onBack: () => void
}

const AlphabetGame: React.FC<AlphabetGameProps> = ({ onBack }) => {
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [showOptions, setShowOptions] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    generateNewQuestion()
    
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const generateNewQuestion = () => {
    const letter = difficultyManager.getRandomLetter()
    setCurrentLetter(letter)
    
    const availableLetters = difficultyManager.getAvailableLetters()
    const options = [letter]
    
    while (options.length < 4) {
      const randomLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)]
      if (!options.includes(randomLetter)) {
        options.push(randomLetter)
      }
    }
    
    setShowOptions(options.sort(() => Math.random() - 0.5))
    
    // Clear any existing timeout before setting a new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Stop any currently playing audio before starting new one
    audioManager.stopAll()
    
    timeoutRef.current = setTimeout(() => {
      audioManager.speakQuizPromptWithRepeat(`Find bogstavet ${letter}`, letter)
    }, 500)
  }

  const handleLetterClick = async (selectedLetter: string) => {
    // Stop any currently playing audio
    audioManager.stopAll()
    setIsPlaying(true)
    
    if (selectedLetter === currentLetter) {
      setScore(score + 1)
      await audioManager.announceGameResult(true)
      setTimeout(() => {
        generateNewQuestion()
        setIsPlaying(false)
      }, 2000)
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

  const repeatLetter = () => {
    // Stop any currently playing audio before speaking again
    audioManager.stopAll()
    audioManager.speakQuizPromptWithRepeat(`Find bogstavet ${currentLetter}`, currentLetter)
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #dbeafe 100%)'
      }}
    >
      {/* Navigation - Back Button Only */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
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
      </Box>

      <Container 
        maxWidth={false}
        sx={{ 
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 2, sm: 3, md: 4 }
        }}
      >
        {/* Audio Control */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <Button 
            onClick={repeatLetter}
            variant="contained"
            color="primary"
            size="large"
            startIcon={<VolumeUp />}
            sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
          >
            Hør igen 🎵
          </Button>
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
          {showOptions.map((letter, index) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${letter}-${index}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Card 
                  onClick={() => handleLetterClick(letter)}
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
                        color: 'primary.dark',
                        userSelect: 'none',
                        lineHeight: 1
                      }}
                    >
                      {letter}
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

export default AlphabetGame