import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
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
import { audioManager } from '../../utils/audio'
import { categoryThemes } from '../../config/categoryThemes'
import LearningGrid from '../common/LearningGrid'
import { useGameEntryAudio } from '../../hooks/useGameEntryAudio'
import { entryAudioManager } from '../../utils/entryAudioManager'


const DANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'
]

const AlphabetLearning: React.FC = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Centralized entry audio
  useGameEntryAudio({ gameType: 'alphabetlearning' })

  useEffect(() => {
    // Register callback to enable interactions after entry audio completes
    entryAudioManager.onComplete('alphabetlearning', () => {
      setEntryAudioComplete(true)
    })
  }, [])

  useEffect(() => {
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }


    // Listen for navigation events
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [])



  const goToLetter = async (index: number) => {
    setCurrentIndex(index)
    setIsPlaying(true)
    audioManager.stopAll()
    
    const letter = DANISH_ALPHABET[index]
    
    try {
      // Start audio debug session on first audio attempt
      const { audioDebugSession } = await import('../../utils/remoteConsole')
      if (!audioDebugSession.isSessionActive()) {
        audioDebugSession.startSession('iPad Audio Debug - Alphabet Learning')
      }
      
      await audioManager.speakLetter(letter)
      
      // End session after successful audio
      audioDebugSession.endSession('Audio completed successfully')
    } catch (error) {
      console.error('Error speaking letter:', error)
      
      // End session with error context
      const { audioDebugSession } = await import('../../utils/remoteConsole')
      audioDebugSession.endSession('Audio failed with error')
    } finally {
      setIsPlaying(false)
    }
  }


  const progress = ((currentIndex + 1) / DANISH_ALPHABET.length) * 100

  return (
    <Box 
      sx={{ 
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: categoryThemes.alphabet.gradient
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
              bgcolor: 'rgba(255, 255, 255, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { 
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <ArrowBack />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography 
              variant="body2" 
              onClick={() => audioManager.announcePosition(currentIndex, DANISH_ALPHABET.length, 'bogstav').catch(console.error)}
              sx={{ 
                color: 'primary.dark', 
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 1,
                '&:hover': { 
                  backgroundColor: 'primary.50',
                  boxShadow: 1
                }
              }}
            >
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
        {/* Title - More Space */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 } }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontSize: { xs: '1.5rem', md: '2rem' },
              color: 'primary.dark',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5
            }}
          >
            <School sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }} /> Lær Alfabetet
          </Typography>
        </Box>

        {/* Current Letter Display - Enhanced Visual */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                maxWidth: { xs: 160, md: 200 },
                mx: 'auto',
                p: { xs: 2, md: 3 },
                background: 'white',
                border: '4px solid',
                borderColor: isPlaying ? categoryThemes.alphabet.accentColor : categoryThemes.alphabet.borderColor,
                boxShadow: isPlaying 
                  ? '0 0 30px rgba(25, 118, 210, 0.4), 0 8px 32px rgba(25, 118, 210, 0.3)'
                  : '0 4px 20px rgba(25, 118, 210, 0.2), 0 8px 32px rgba(25, 118, 210, 0.15)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  bottom: -2,
                  background: categoryThemes.alphabet.gradient,
                  borderRadius: 'inherit',
                  opacity: 0.2,
                  zIndex: 0
                },
                '&::after': {
                  content: '"⭐"',
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  fontSize: '1.5rem',
                  color: categoryThemes.alphabet.accentColor,
                  animation: isPlaying ? 'pulse 2s infinite' : 'none'
                }
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '3.5rem', md: '4.5rem' },
                  fontWeight: 700,
                  color: categoryThemes.alphabet.accentColor,
                  textAlign: 'center',
                  lineHeight: 1,
                  textShadow: '1px 1px 2px rgba(25, 118, 210, 0.1)',
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {DANISH_ALPHABET[currentIndex]}
              </Typography>
            </Card>
          </motion.div>
        </Box>


        {/* Alphabet Grid - Using Reusable Component */}
        <LearningGrid
          items={DANISH_ALPHABET}
          currentIndex={currentIndex}
          onItemClick={goToLetter}
          disabled={!entryAudioComplete}
        />
      </Container>
      
      {/* CSS Animation for pulse effect */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0.7; }
          }
        `}
      </style>
    </Box>
  )
}

export default AlphabetLearning