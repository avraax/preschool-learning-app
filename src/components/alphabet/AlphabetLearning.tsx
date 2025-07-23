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
  AppBar,
  Toolbar,
  LinearProgress
} from '@mui/material'
import {
  ArrowBack,
  PlayArrow,
  Pause,
  Replay
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'

interface AlphabetLearningProps {
  onBack: () => void
}

const DANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'
]

const AlphabetLearning: React.FC<AlphabetLearningProps> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const speakCurrentLetter = async () => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    const currentLetter = DANISH_ALPHABET[currentIndex]
    
    try {
      await audioManager.speakLetter(currentLetter)
    } catch (error) {
      console.error('Error speaking letter:', error)
    } finally {
      setIsPlaying(false)
      
      // If auto-play is on, move to next letter after a pause
      if (isAutoPlay && currentIndex < DANISH_ALPHABET.length - 1) {
        timeoutRef.current = setTimeout(() => {
          setCurrentIndex(prev => prev + 1)
        }, 1000)
      } else if (isAutoPlay && currentIndex === DANISH_ALPHABET.length - 1) {
        // Finished the alphabet
        setIsAutoPlay(false)
      }
    }
  }

  const startAutoPlay = () => {
    // Always reset to beginning when starting auto-play
    stopAutoPlay()
    setCurrentIndex(0)
    setIsAutoPlay(true)
  }

  const stopAutoPlay = () => {
    setIsAutoPlay(false)
    audioManager.stopAll()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  const goToLetter = async (index: number) => {
    // Cancel auto-play if it's running
    if (isAutoPlay) {
      stopAutoPlay()
    }
    
    setCurrentIndex(index)
    setIsPlaying(true)
    audioManager.stopAll()
    
    const letter = DANISH_ALPHABET[index]
    
    try {
      await audioManager.speakLetter(letter)
    } catch (error) {
      console.error('Error speaking letter:', error)
    } finally {
      setIsPlaying(false)
    }
  }

  const restart = () => {
    stopAutoPlay()
    setCurrentIndex(0)
  }


  // Auto-play the current letter when index changes and auto-play is on
  useEffect(() => {
    if (isAutoPlay) {
      speakCurrentLetter()
    }
  }, [currentIndex, isAutoPlay])

  const progress = ((currentIndex + 1) / DANISH_ALPHABET.length) * 100

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #dbeafe 100%)'
      }}
    >
      {/* App Bar with Back Button and Progress */}
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'primary.dark', fontWeight: 600 }}>
              {currentIndex + 1} / {DANISH_ALPHABET.length}
            </Typography>
            <Box sx={{ width: 200, bgcolor: 'white', borderRadius: 1, p: 0.5 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h2" 
            sx={{ 
              color: 'primary.dark',
              mb: 2,
              fontWeight: 700
            }}
          >
            Dansk Alfabet
          </Typography>
          <Typography variant="h6" color="primary.main" sx={{ mb: 1 }}>
            Lær alle bogstaver fra A til Å 📚
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Klik på et bogstav for at høre det! 👆
          </Typography>
        </Box>

        {/* Current Letter Display */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card
              sx={{
                maxWidth: 300,
                mx: 'auto',
                p: 4,
                bgcolor: isPlaying ? 'secondary.50' : 'white',
                border: '4px solid',
                borderColor: isPlaying ? 'secondary.main' : 'primary.200',
                transition: 'all 0.3s ease'
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: '8rem',
                  fontWeight: 700,
                  color: 'primary.dark',
                  textAlign: 'center',
                  lineHeight: 1
                }}
              >
                {DANISH_ALPHABET[currentIndex]}
              </Typography>
            </Card>
          </motion.div>
        </Box>

        {/* Control Buttons */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            {!isAutoPlay ? (
              <Button
                onClick={startAutoPlay}
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayArrow />}
                disabled={isPlaying}
                sx={{ py: 2, px: 4 }}
              >
                Afspil Alle
              </Button>
            ) : (
              <Button
                onClick={stopAutoPlay}
                variant="contained"
                color="error"
                size="large"
                startIcon={<Pause />}
                sx={{ py: 2, px: 4 }}
              >
                Stop
              </Button>
            )}


            <Button
              onClick={restart}
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<Replay />}
              disabled={isPlaying}
              sx={{ py: 2, px: 4 }}
            >
              Start Forfra
            </Button>
          </Box>
        </Box>

        {/* Alphabet Grid */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Grid 
            container 
            spacing={1} 
            sx={{ 
              maxWidth: '900px',
              width: 'fit-content'
            }}
          >
          {DANISH_ALPHABET.map((letter, index) => (
            <Grid size={{ xs: 2, sm: 1.5, md: 1.2 }} key={letter}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Card 
                  onClick={() => goToLetter(index)}
                  sx={{ 
                    minHeight: 60,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: index === currentIndex ? 'secondary.main' : 'primary.200',
                    bgcolor: index === currentIndex ? 'secondary.50' : 
                             index < currentIndex && isAutoPlay ? 'success.50' : 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: 1,
                      '&:last-child': { pb: 1 }
                    }}
                  >
                    <Typography 
                      variant="h5"
                      sx={{ 
                        fontWeight: 700,
                        color: index === currentIndex ? 'secondary.dark' : 'primary.dark',
                        fontSize: { xs: '1.2rem', sm: '1.5rem' }
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

        {/* Decorative Animation */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Typography sx={{ fontSize: '4rem' }}>🔤</Typography>
          </motion.div>
        </Box>
      </Container>
    </Box>
  )
}

export default AlphabetLearning