import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  AppBar,
  Toolbar
} from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { isIOS } from '../../utils/deviceDetection'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { categoryThemes } from '../../config/categoryThemes'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { AlphabetScoreChip } from '../common/ScoreChip'
import { AlphabetRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 AlphabetGame: ${message}`, data)
  }
}

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

const AlphabetGame: React.FC = () => {
  const navigate = useNavigate()
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [showOptions, setShowOptions] = useState<string[]>([])
  
  // Component initialization - no logging needed in production
  
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: 'AlphabetGame',
    autoInitialize: false
  })
  
  // Centralized game state management
  const { score, incrementScore, handleScoreClick } = useGameState()
  
  // Character and celebration management
  const teacherCharacter = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const hasInitialized = useRef(false)
  
  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    // Initial teacher greeting
    teacherCharacter.setCharacter('owl')
    teacherCharacter.wave()
    
    // Check if audio is ready
    if (audio.isAudioReady) {
      setAudioInitialized(true)
      // Play welcome message and then generate first question
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

  // Play welcome message and start game
  const playWelcomeAndStart = async () => {
    try {
      // Play the welcome message and wait for it to complete
      await audio.playGameWelcome('alphabet')
      
      // Additional delay after welcome audio completes to ensure clean transition
      const additionalDelay = isIOS() ? 1500 : 2000  // Even longer delay for cleaner audio experience
      setTimeout(() => {
        setGameReady(true)
        generateNewQuestion()
      }, additionalDelay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      setGameReady(true)
      generateNewQuestion()
    }
  }
  
  // Generate new question
  const generateNewQuestion = useCallback(() => {
    // Generating new question
    
    // Pick a random letter from full Danish alphabet
    const letter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
    
    // Generated new letter
    
    setCurrentLetter(letter)
    
    // Create 4 options including the correct answer
    const options = [letter]
    
    while (options.length < 4) {
      const randomLetter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
      if (!options.includes(randomLetter)) {
        options.push(randomLetter)
      }
    }
    
    const shuffledOptions = options.sort(() => Math.random() - 0.5)
    
    // Generated quiz options
    
    setShowOptions(shuffledOptions)
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Shorter delay for quiz prompt since welcome audio has already completed with buffer
    const delay = isIOS() ? 200 : 300  // Even shorter delay for better user experience
    
    // Schedule delayed audio
    timeoutRef.current = setTimeout(async () => {
      try {
        // Update user interaction timestamp before playing (iOS fix)
        audio.updateUserInteraction()
        await audio.speakQuizPromptWithRepeat(
          DANISH_PHRASES.gamePrompts.findLetter(letter), 
          letter
        )
      } catch (error) {
        logError('Error playing quiz prompt', { 
          letter,
          error: error?.toString()
        })
      } finally {
        if (timeoutRef.current) {
          timeoutRef.current = null
        }
      }
    }, delay)
    
  }, [audio]) // Stable dependency - only recreate if audio changes

  const handleLetterClick = async (selectedLetter: string) => {
    // Only prevent clicks if game isn't ready
    if (!gameReady) {
      console.log(`🎵 AlphabetGame: Blocked click - gameReady: ${gameReady}`)
      return
    }
    
    const clickTime = Date.now()
    console.log(`🎵 AlphabetGame: Letter clicked at ${clickTime} - ${selectedLetter}`)
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    console.log(`🎵 AlphabetGame: Cancelling current audio for immediate letter pronunciation`)
    audio.cancelCurrentAudio()
    
    // FIRST: Play the clicked letter immediately for fast feedback
    try {
      const audioStartTime = Date.now()
      console.log(`🎵 AlphabetGame: Starting letter audio at ${audioStartTime} (${audioStartTime - clickTime}ms after click) - ${selectedLetter}`)
      
      await audio.speakLetter(selectedLetter)
      
      const audioEndTime = Date.now()
      console.log(`🎵 AlphabetGame: Letter audio completed at ${audioEndTime} (${audioEndTime - audioStartTime}ms duration) - ${selectedLetter}`)
    } catch (error) {
      console.log(`🎵 AlphabetGame: Error playing letter audio:`, error)
    }
    
    const isCorrect = selectedLetter === currentLetter
    
    // IMMEDIATELY: Start visual celebration effects if correct
    if (isCorrect) {
      incrementScore()
      celebrate() // Start celebration visual immediately
      teacherCharacter.wave()
    } else {
      teacherCharacter.think()
    }
    
    // THEN: Play celebration audio after a very short delay
    setTimeout(async () => {
      try {
        // Just play the audio feedback, visuals already started
        await audio.announceGameResult(isCorrect)
        
        // Auto-advance to next question after celebration
        setTimeout(() => {
          if (isCorrect) {
            stopCelebration() // Stop celebration after 2 seconds
            generateNewQuestion()
          }
        }, isIOS() ? 1500 : 2000) // 2 second celebration duration
        
      } catch (error) {
        logError('Error in game result audio', {
          selectedLetter,
          currentLetter,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150) // Very short delay between letter audio and celebration audio
  }

  const repeatLetter = async () => {
    const clickTime = Date.now()
    console.log(`🎵 AlphabetGame: Repeat button clicked at ${clickTime}`)
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    console.log(`🎵 AlphabetGame: Cancelling current audio for immediate repeat`)
    audio.cancelCurrentAudio()
    
    try {
      const audioStartTime = Date.now()
      console.log(`🎵 AlphabetGame: Starting repeat audio at ${audioStartTime} (${audioStartTime - clickTime}ms after click)`)
      
      await audio.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findLetter(currentLetter), currentLetter)
      
      const audioEndTime = Date.now()
      console.log(`🎵 AlphabetGame: Repeat audio completed at ${audioEndTime} (${audioEndTime - audioStartTime}ms duration)`)
    } catch (error) {
      console.error('🎵 AlphabetGame: Error repeating letter:', error)
    }
  }

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
      {/* App Bar with Back Button and Score */}
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
            <ArrowLeft size={24} />
          </IconButton>
          
          <AlphabetScoreChip
            score={score}
            disabled={false}
            onClick={handleScoreClick}
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
        {/* Game Title with Teacher Character */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <LottieCharacter
                character={teacherCharacter.character}
                state={teacherCharacter.state}
                size={80}
                onClick={teacherCharacter.wave}
              />
              <Typography 
                variant="h3" 
                sx={{ 
                  color: categoryThemes.alphabet.accentColor,
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  textShadow: '1px 1px 2px rgba(25, 118, 210, 0.2)'
                }}
              >
                Bogstav Quiz
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🎯</Typography>
            </Box>
          </motion.div>
        </Box>

        {/* Audio Control - Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <AlphabetRepeatButton
            onClick={repeatLetter}
            disabled={false}
          />
        </Box>

        {/* Answer Options Grid */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 0
        }}>
          <Box
            sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridAutoRows: 'auto',
              gap: { xs: '16px', sm: '20px', md: '24px' },
              width: '100%',
              maxWidth: { xs: '400px', sm: '500px', md: '600px' },
              justifyContent: 'center',
              alignItems: 'center',
              // Individual card aspect ratio and constraints
              '& > *': {
                aspectRatio: '4/3',
                minHeight: { xs: '80px', sm: '90px', md: '100px' },
                maxHeight: { xs: '120px', sm: '140px', md: '160px' },
                width: '100%'
              },
              // Orientation specific adjustments
              '@media (orientation: landscape)': {
                gridTemplateColumns: 'repeat(4, 1fr)',
                maxWidth: { xs: '600px', sm: '700px', md: '800px' },
                '& > *': {
                  aspectRatio: '4/3',
                  minHeight: { xs: '60px', sm: '70px', md: '80px' },
                  maxHeight: { xs: '100px', sm: '110px', md: '120px' }
                }
              }
            }}
          >
          {showOptions.map((letter, index) => (
            <motion.div
              key={`${letter}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ height: '100%' }}
            >
              <Card 
                onClick={() => handleLetterClick(letter)}
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: categoryThemes.alphabet.borderColor,
                  bgcolor: 'white',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  '&:hover': {
                    borderColor: categoryThemes.alphabet.hoverBorderColor,
                    bgcolor: '#E3F2FD',
                    boxShadow: `0 8px 32px ${categoryThemes.alphabet.accentColor}40`,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent 
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: { xs: 1.5, sm: 2, md: 2.5 }
                  }}
                >
                  <Typography 
                    variant="h1"
                    sx={{ 
                      fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                      fontWeight: 700,
                      color: categoryThemes.alphabet.accentColor,
                      userSelect: 'none',
                      lineHeight: 1,
                      // Adjust font size in landscape
                      '@media (orientation: landscape)': {
                        fontSize: 'clamp(2rem, 6vw, 3.5rem)'
                      }
                    }}
                  >
                    {letter}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          </Box>
        </Box>

      </Container>
      
      {/* Celebration Effect */}
      <CelebrationEffect
        show={showCelebration}
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default AlphabetGame