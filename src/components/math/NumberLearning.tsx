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
import { useAudio } from '../../hooks/useAudio'
import { categoryThemes } from '../../config/categoryThemes'
import LearningGrid from '../common/LearningGrid'
import { useGameEntryAudio } from '../../hooks/useGameEntryAudio'
import { entryAudioManager } from '../../utils/entryAudioManager'
import { MathRepeatButton } from '../common/RepeatButton'


const NumberLearning: React.FC = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  // Centralized audio system
  const audio = useAudio({ componentId: 'NumberLearning' })
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)
  const [hasPlayedEntryAudio, setHasPlayedEntryAudio] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Centralized entry audio
  useGameEntryAudio({ gameType: 'numberlearning' })

  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  useEffect(() => {
    // Register callback to enable interactions after entry audio completes
    entryAudioManager.onComplete('numberlearning', () => {
      setEntryAudioComplete(true)
      setHasPlayedEntryAudio(true)
    })
    
    // iOS fallback: if no entry audio after 3 seconds, allow interactions
    const fallbackTimeout = setTimeout(() => {
      if (!hasPlayedEntryAudio) {
        console.log('🎵 iOS fallback: Enabling interactions without entry audio')
        setEntryAudioComplete(true)
      }
    }, 3000)
    
    return () => clearTimeout(fallbackTimeout)
  }, [hasPlayedEntryAudio])

  useEffect(() => {
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audio.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    // Listen for navigation events
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audio.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [])




  const goToNumber = async (index: number) => {
    // iOS fallback: if entry audio hasn't played yet, play it now with user interaction
    if (!hasPlayedEntryAudio && entryAudioComplete) {
      try {
        console.log('🎵 iOS fallback: Playing entry audio on first interaction')
        await audio.speak('Lær Tal')
        setHasPlayedEntryAudio(true)
      } catch (error) {
        console.error('iOS fallback entry audio failed:', error)
      }
    }
    
    setCurrentIndex(index)
    audio.stopAll()
    
    const number = numbers[index]
    
    // No need to explicitly update user interaction here
    // The speakNumber method in AudioController already calls updateUserInteraction()
    
    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audio.speakNumber(number, 1.2)
    } catch (error) {
      console.error('Error speaking number:', error)
    }
  }

  // Repeat instructions for the current number
  const repeatInstructions = () => {
    if (!entryAudioComplete) return
    
    goToNumber(currentIndex)
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
              onClick={() => audio.announcePosition(currentIndex, numbers.length, 'tal').catch(console.error)}
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
            disabled={!entryAudioComplete || audio.isPlaying}
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
          disabled={!entryAudioComplete}
        />
      </Container>
    </Box>
  )
}

export default NumberLearning