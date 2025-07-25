import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Button,
  Typography,
  Box,
  IconButton,
  AppBar,
  Toolbar,
  LinearProgress,
  Card
} from '@mui/material'
import {
  ArrowBack,
  PlayArrow,
  Pause,
  Replay,
  School
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import LearningGrid from '../common/LearningGrid'
import { isIOS, deviceInfo } from '../../utils/deviceDetection'
import { logAudioIssue, logIOSIssue } from '../../utils/remoteConsole'
import { iosAudioHelper } from '../../utils/iosAudioHelper'


const DANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'
]

const AlphabetLearning: React.FC = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const [audioRetryCount, setAudioRetryCount] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUserInteraction = useRef<number>(Date.now())

  // Track user interactions for iOS audio requirements
  const updateUserInteraction = () => {
    lastUserInteraction.current = Date.now()
  }

  useEffect(() => {
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      // Ensure iOS audio helper is stopped
      iosAudioHelper.stop()
    }

    // Track user interactions for iOS audio
    const userInteractionEvents = ['touchstart', 'touchend', 'click', 'keydown']
    userInteractionEvents.forEach(event => {
      document.addEventListener(event, updateUserInteraction, true)
    })

    // Listen for navigation events
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Clean up user interaction events
      userInteractionEvents.forEach(event => {
        document.removeEventListener(event, updateUserInteraction, true)
      })
      
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
      
      // Stop iOS audio helper
      iosAudioHelper.stop()
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
      setAudioRetryCount(0) // Reset retry count on success
    } catch (error: any) {
      console.error('Error speaking letter:', error)
      
      // Check if it's a navigation interruption (expected)
      const isNavigationInterruption = error instanceof Error && 
        (error.message.includes('interrupted by navigation') || 
         error.message.includes('interrupted by user'))
      
      if (isNavigationInterruption) {
        console.log('🎵 Letter speech interrupted by navigation (expected)')
        return // Don't show error or retry for navigation interruptions
      }
      
      // iOS audio permission error handling
      if (deviceInfo.isIOS && error?.message?.includes('not allowed by the user agent')) {
        // Check if it's been more than 6 seconds since last user interaction
        const timeSinceInteraction = Date.now() - lastUserInteraction.current
        
        if (timeSinceInteraction > 6000 && audioRetryCount < 2) {
          // iOS TTS failure during autoplay - retry after delay
          console.log(`🔄 iOS TTS retry ${audioRetryCount + 1} for letter ${currentLetter}`)
          setAudioRetryCount(prev => prev + 1)
          
          // Stop autoplay temporarily and retry after delay
          setIsPlaying(false)
          setTimeout(() => {
            // Retry the same letter
            setCurrentIndex(prev => prev) // Trigger re-render to retry
          }, 800)
          return
        } else if (audioRetryCount >= 2) {
          // Too many retries - pause autoplay
          console.log('🚨 Too many alphabet audio failures, pausing autoplay')
          setIsAutoPlay(false)
          setAudioRetryCount(0)
        }
      }
      
      logAudioIssue('Alphabet Letter Speaking', error, { 
        currentLetter, 
        currentIndex, 
        isAutoPlay,
        isIOS: isIOS(),
        timeSinceInteraction: Date.now() - lastUserInteraction.current,
        audioRetryCount
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
    updateUserInteraction() // Track user interaction
    setAudioRetryCount(0)
    
    // Start iOS audio keep-alive
    if (deviceInfo.isIOS) {
      iosAudioHelper.start()
    }
  }

  const stopAutoPlay = () => {
    setIsAutoPlay(false)
    setIsPlaying(false)  // Also stop playing state
    audioManager.stopAll()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Stop iOS audio keep-alive
    if (deviceInfo.isIOS) {
      iosAudioHelper.stop()
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
    updateUserInteraction() // Track user interaction
    
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
            onClick={() => navigate('/alphabet')}
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
              sx={{ py: { xs: 0.5, md: 1 }, px: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' }, minHeight: '44px' }}
            >
              Start Forfra
            </Button>
          </Box>
        </Box>

        {/* Alphabet Grid - Using Reusable Component */}
        <LearningGrid
          items={DANISH_ALPHABET}
          currentIndex={currentIndex}
          isAutoPlay={isAutoPlay}
          onItemClick={goToLetter}
        />
      </Container>
    </Box>
  )
}

export default AlphabetLearning