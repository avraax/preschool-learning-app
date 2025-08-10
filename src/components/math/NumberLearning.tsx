import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
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
  School
} from '@mui/icons-material'
import { categoryThemes } from '../../config/categoryThemes'
import LearningGrid from '../common/LearningGrid'
import { MathRepeatButton } from '../common/RepeatButton'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'


const NumberLearning: React.FC = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: 'NumberLearning',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitialized = useRef(false)
  
  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)
  
  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 NumberLearning: ${message}`, data)
    }
  }

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    // Check if audio is ready
    if (audio.isAudioReady) {
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])
  
  // Monitor audio readiness - only if not already initialized
  useEffect(() => {
    if (audio.isAudioReady && !audioInitialized && !hasInitialized.current) {
      hasInitialized.current = true
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady, audioInitialized])

  // Play welcome message and start learning
  const playWelcomeAndStart = async () => {
    try {
      // Play the welcome message
      await audio.playGameWelcome('numberlearning')
      
      // iOS-optimized delay - increased to prevent audio overlap
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => {
        setGameReady(true)
      }, delay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      setGameReady(true)
    }
  }





  const goToNumber = async (index: number) => {
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    if (audio.isPlaying) {
      // Cancel current audio and immediately play new number
      audio.cancelCurrentAudio()
    }
    
    setCurrentIndex(index)
    
    const number = numbers[index]
    
    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audio.speakNumber(number, 1.2)
    } catch (error) {
      logError('Error speaking number', {
        number,
        error: error?.toString()
      })
    }
  }

  // Repeat instructions for the current number
  const repeatInstructions = async () => {
    if (!gameReady) return
    
    await goToNumber(currentIndex)
  }

  const progress = ((currentIndex + 1) / numbers.length) * 100

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
      {/* App Bar with Back Button and Progress */}
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography 
              variant="body2" 
              onClick={async () => {
                // Critical iOS fix: Update user interaction timestamp BEFORE audio call
                audio.updateUserInteraction()
                try {
                  await audio.announcePosition(currentIndex, numbers.length, 'tal')
                } catch (error) {
                  logError('Error announcing position', { error: error?.toString() })
                }
              }}
              sx={{ 
                color: 'secondary.dark', 
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 1,
                '&:hover': { 
                  backgroundColor: 'secondary.50',
                  boxShadow: 1
                }
              }}
            >
              {currentIndex + 1} / {numbers.length}
            </Typography>
            <Box sx={{ width: 200, bgcolor: 'white', borderRadius: 1, p: 0.5 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                color="secondary"
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
              color: 'secondary.dark',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5
            }}
          >
            <School sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} /> Lær Tal
          </Typography>
        </Box>

        {/* Repeat Button */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 } }}>
          <MathRepeatButton 
            onClick={repeatInstructions}
            disabled={!gameReady || audio.isPlaying}
            label="🎵 Hør igen"
          />
        </Box>

        {/* Current Number Display - Very Compact */}
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
                bgcolor: audio.isPlaying ? 'secondary.50' : 'white',
                border: '2px solid',
                borderColor: audio.isPlaying ? 'secondary.main' : 'primary.200',
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
                {numbers[currentIndex]}
              </Typography>
            </Card>
          </motion.div>
        </Box>


        {/* Numbers Grid - Using Reusable Component */}
        <LearningGrid
          items={numbers}
          currentIndex={currentIndex}
          onItemClick={goToNumber}
          disabled={!gameReady}
        />
      </Container>
    </Box>
  )
}

export default NumberLearning