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
  Replay,
  School
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { isIOS } from '../../utils/deviceDetection'
import { logAudioIssue, logIOSIssue } from '../../utils/remoteConsole'

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
    if (isPlaying) {
      logIOSIssue('Alphabet Auto-play', 'Already playing, skipping')
      return
    }
    
    const currentLetter = DANISH_ALPHABET[currentIndex]
    logIOSIssue('Alphabet Auto-play', `Starting to speak letter: ${currentLetter} (index: ${currentIndex})`)
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    // iOS-specific: Add longer initial pause to ensure audio stops
    if (isIOS()) {
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    try {
      await audioManager.speakLetter(currentLetter)
      logIOSIssue('Alphabet Auto-play', `Successfully spoke letter: ${currentLetter}`)
    } catch (error) {
      logAudioIssue('Alphabet Letter Speaking', error, { 
        currentLetter, 
        currentIndex, 
        isAutoPlay,
        isIOS: isIOS()
      })
    } finally {
      setIsPlaying(false)
      
      // If auto-play is on, move to next letter after a pause
      if (isAutoPlay && currentIndex < DANISH_ALPHABET.length - 1) {
        // iOS-specific: Use longer pause between letters
        const autoPlayPause = isIOS() ? 2000 : 1000
        
        logIOSIssue('Alphabet Auto-play', `Scheduling next letter in ${autoPlayPause}ms`)
        timeoutRef.current = setTimeout(() => {
          logIOSIssue('Alphabet Auto-play', `Moving to next letter (${currentIndex + 1})`)
          setCurrentIndex(prev => prev + 1)
        }, autoPlayPause)
      } else if (isAutoPlay && currentIndex === DANISH_ALPHABET.length - 1) {
        // Finished the alphabet
        logIOSIssue('Alphabet Auto-play', 'Finished alphabet, stopping auto-play')
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
    setIsPlaying(false)  // Also stop playing state
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
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
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

      <Container 
        maxWidth="lg" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 1, md: 2 },
          overflow: 'hidden'
        }}
      >
        {/* Title - Very Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 } }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              color: 'primary.dark',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5
            }}
          >
            <School sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} /> Lær Alfabetet
          </Typography>
        </Box>

        {/* Current Letter Display - Very Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                maxWidth: { xs: 120, md: 150 },
                mx: 'auto',
                p: { xs: 1, md: 1.5 },
                bgcolor: isPlaying ? 'secondary.50' : 'white',
                border: '2px solid',
                borderColor: isPlaying ? 'secondary.main' : 'primary.200',
                transition: 'all 0.3s ease'
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
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

        {/* Control Buttons - Very Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1, md: 2 }, flexWrap: 'wrap' }}>
            {!isAutoPlay ? (
              <Button
                onClick={startAutoPlay}
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayArrow />}
                disabled={isPlaying}
                sx={{ py: { xs: 0.5, md: 1 }, px: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' }, minHeight: '44px' }}
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
                sx={{ py: { xs: 0.5, md: 1 }, px: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' }, minHeight: '44px' }}
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
              disabled={isPlaying || isAutoPlay}
              sx={{ py: 2, px: 4 }}
            >
              Start Forfra
            </Button>
          </Box>
        </Box>

        {/* Alphabet Grid - Flexible */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          overflow: 'hidden',
          minHeight: 0
        }}>
          <Grid 
            container 
            spacing={{ xs: 0.5, md: 1 }}
            sx={{ 
              maxWidth: '100%',
              width: 'fit-content',
              maxHeight: '100%',
              overflow: 'auto'
            }}
          >
          {DANISH_ALPHABET.map((letter, index) => (
            <Grid size={{ xs: 2, sm: 1.5, md: 1.2 }} key={letter}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  onClick={() => goToLetter(index)}
                  sx={{ 
                    minHeight: { xs: 50, md: 60 },
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
      </Container>
    </Box>
  )
}

export default AlphabetLearning