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
  Toolbar,
  Alert
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

// 🚀 SIMPLIFIED AUDIO SYSTEM IMPORTS
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Enhanced logging for simplified audio testing
const logSimplifiedAlphabet = (message: string, data?: any) => {
  console.log(`🎵 AlphabetGameSimplified: ${message}`, data)
}

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

const AlphabetGameSimplified: React.FC = () => {
  const navigate = useNavigate()
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [showOptions, setShowOptions] = useState<string[]>([])
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  
  // 🚀 SIMPLIFIED AUDIO SYSTEM - Replace useAudio with useSimplifiedAudioHook
  const audio = useSimplifiedAudioHook({ 
    componentId: 'AlphabetGameSimplified',
    autoInitialize: false // We'll initialize manually for better control
  })
  
  // Get the audio context for additional control (removed - not used)
  
  // Centralized game state management
  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Character and celebration management
  const teacherCharacter = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Initialize component
  useEffect(() => {
    logSimplifiedAlphabet('Component initialized', {
      isIOS: isIOS(),
      isPWA: window.matchMedia('(display-mode: standalone)').matches,
      audioReady: audio.isAudioReady,
      needsUserAction: audio.needsUserAction
    })
    
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
  
  // Monitor audio readiness
  useEffect(() => {
    if (audio.isAudioReady && !audioInitialized) {
      logSimplifiedAlphabet('Audio became ready, initializing game')
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady, audioInitialized])
  
  // Play welcome message and start game
  const playWelcomeAndStart = async () => {
    logSimplifiedAlphabet('Playing welcome message')
    
    try {
      // Play the welcome message
      await audio.playGameWelcome('alphabet')
      logSimplifiedAlphabet('Welcome message completed')
      
      // Wait a bit then generate first question
      setTimeout(() => {
        setGameReady(true)
        generateNewQuestion()
      }, 500)
    } catch (error) {
      logSimplifiedAlphabet('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      setGameReady(true)
      generateNewQuestion()
    }
  }
  
  // Generate new question
  const generateNewQuestion = useCallback(() => {
    logSimplifiedAlphabet('Generating new question', {
      previousLetter: currentLetter,
      audioReady: audio.isAudioReady
    })
    
    // Pick a random letter from full Danish alphabet
    const letter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
    
    logSimplifiedAlphabet('Generated new letter', { letter })
    
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
    
    logSimplifiedAlphabet('Generated quiz options', { 
      correctLetter: letter,
      allOptions: shuffledOptions
    })
    
    setShowOptions(shuffledOptions)
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Schedule delayed audio
    if (audio.isAudioReady) {
      timeoutRef.current = setTimeout(async () => {
        try {
          logSimplifiedAlphabet('Playing quiz prompt', { letter })
          await audio.speakQuizPromptWithRepeat(
            DANISH_PHRASES.gamePrompts.findLetter(letter), 
            letter
          )
          logSimplifiedAlphabet('Quiz prompt completed')
        } catch (error) {
          logSimplifiedAlphabet('Error playing quiz prompt', { 
            letter,
            error: error?.toString()
          })
        } finally {
          timeoutRef.current = null
        }
      }, 500)
    }
    
  }, [audio, currentLetter])
  
  const handleLetterClick = async (selectedLetter: string) => {
    logSimplifiedAlphabet('Letter clicked', {
      selectedLetter,
      currentLetter,
      isCorrect: selectedLetter === currentLetter,
      audioReady: audio.isAudioReady,
      audioPlaying: audio.isPlaying
    })
    
    // 🚀 SIMPLIFIED: Update user interaction for iOS
    audio.updateUserInteraction()
    
    if (audio.isPlaying) {
      logSimplifiedAlphabet('Audio is playing, ignoring click')
      return
    }
    
    const isCorrect = selectedLetter === currentLetter
    
    try {
      if (isCorrect) {
        // Success
        incrementScore()
        teacherCharacter.celebrate()
        const celebrationInt = score > 5 ? 'high' : 'medium'
        celebrate(celebrationInt)
        
        if (audio.isAudioReady) {
          await audio.announceGameResult(true)
        }
        
        // Generate new question after delay
        setTimeout(() => {
          stopCelebration()
          teacherCharacter.wave()
          generateNewQuestion()
        }, isIOS() ? 1000 : 2000)
        
      } else {
        // Incorrect
        teacherCharacter.think()
        
        if (audio.isAudioReady) {
          await audio.announceGameResult(false)
        }
      }
      
      logSimplifiedAlphabet('Letter click handled successfully')
      
    } catch (error) {
      logSimplifiedAlphabet('Error handling letter click', {
        error: error?.toString()
      })
    }
  }
  
  const repeatLetter = async () => {
    // 🚀 SIMPLIFIED: Update user interaction for iOS
    audio.updateUserInteraction()
    
    if (audio.isPlaying || !audio.isAudioReady) {
      return
    }
    
    try {
      await audio.speakQuizPromptWithRepeat(
        DANISH_PHRASES.gamePrompts.findLetter(currentLetter), 
        currentLetter
      )
    } catch (error) {
      logSimplifiedAlphabet('Error repeating letter', { error: error?.toString() })
    }
  }
  
  // Manual audio initialization for iOS
  const handleInitializeAudio = async () => {
    logSimplifiedAlphabet('Manual audio initialization clicked')
    
    try {
      const success = await audio.initializeAudio()
      logSimplifiedAlphabet('Audio initialization result', { success })
      
      if (success) {
        // Start the game after successful initialization
        playWelcomeAndStart()
      }
    } catch (error) {
      logSimplifiedAlphabet('Audio initialization error', { error: error?.toString() })
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
            disabled={isScoreNarrating}
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
        {/* 🚀 SIMPLIFIED: Audio initialization prompt for iOS */}
        {!audio.isAudioReady && audio.needsUserAction && (
          <Box sx={{ mb: 2 }}>
            <Alert 
              severity="info" 
              action={
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    iOS Safari kræver handling
                  </Typography>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleInitializeAudio}
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}
                  >
                    Aktivér Lyd
                  </motion.button>
                </Box>
              }
            >
              <Typography variant="body2">
                Tryk på knappen for at aktivere dansk tale og lyd i spillet
              </Typography>
            </Alert>
          </Box>
        )}
        
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
                Bogstav Quiz (Simplified)
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🎯</Typography>
            </Box>
          </motion.div>
        </Box>

        {/* Audio Control - Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <AlphabetRepeatButton
            onClick={repeatLetter}
            disabled={!gameReady || !audio.isAudioReady || audio.isPlaying}
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

        {/* 🚀 SIMPLIFIED: Audio status indicator */}
        {process.env.NODE_ENV === 'development' && (
          <Box sx={{ 
            position: 'fixed', 
            bottom: 16, 
            right: 16, 
            bgcolor: 'rgba(0,0,0,0.7)', 
            color: 'white',
            p: 1,
            borderRadius: 1,
            fontSize: '0.75rem'
          }}>
            <Typography variant="caption">
              Audio: {audio.isAudioReady ? '✅' : '❌'} | 
              Playing: {audio.isPlaying ? '🔊' : '🔇'} |
              iOS: {isIOS() ? 'Yes' : 'No'}
            </Typography>
          </Box>
        )}

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

export default AlphabetGameSimplified