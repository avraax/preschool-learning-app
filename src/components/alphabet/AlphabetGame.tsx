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
import { useAudio } from '../../hooks/useAudio'
import { entryAudioManager } from '../../utils/entryAudioManager'
import { audioDebugSession } from '../../utils/remoteConsole'

// Enhanced logging - always log to console, also audioDebugSession if active
const logAlphabetGameDebug = (message: string, data?: any) => {
  // Always log to console for comprehensive debugging
  console.log(`🎵 AlphabetGame: ${message}`, data)
  
  // Also log to audioDebugSession if it's active
  if (audioDebugSession.isSessionActive()) {
    const isIOSDevice = isIOS()
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    const audioContextState = (window as any).AudioContext ? (() => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const state = ctx.state
        ctx.close()
        return state
      } catch {
        return 'unavailable'
      }
    })() : 'unavailable'
    
    audioDebugSession.addLog('ALPHABET_GAME', {
      message,
      data,
      context: {
        isIOS: isIOSDevice,
        isPWA,
        audioContextState,
        timestamp: new Date().toISOString()
      }
    })
  }
}

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

const AlphabetGame: React.FC = () => {
  const navigate = useNavigate()
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [showOptions, setShowOptions] = useState<string[]>([])
  
  // Initialize component - individual error logging only (no sessions)
  useEffect(() => {
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    if (isIOS() && isPWA) {
      logAlphabetGameDebug('AlphabetGame component initialized', {
        userAgent: navigator.userAgent,
        speechSynthesisVoices: window.speechSynthesis?.getVoices?.()?.length || 0,
        currentLetter,
        showOptionsLength: showOptions.length
      })
    }
  }, [])
  
  // Centralized audio system - consistent with working MathGame
  const audio = useAudio({ componentId: 'AlphabetGame', stopOnUnmount: false })
  
  // Centralized game state management
  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Character and celebration management
  const teacherCharacter = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  
  // Forward declaration for entry audio completion (same pattern as MathGame)
  const generateNewQuestionRef = useRef<(() => void) | null>(null)
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)
  
  useEffect(() => {
    logAlphabetGameDebug('Main useEffect running - setting up game initialization')
    
    // Initial teacher greeting
    teacherCharacter.setCharacter('owl')
    teacherCharacter.wave()
    
    // Set up entry audio completion callback (direct pattern like MathGame)
    const handleEntryComplete = () => {
      logAlphabetGameDebug('Entry audio completed, enabling interactions')
      setEntryAudioComplete(true)
      // Delay before generating first question to ensure proper audio sequencing
      setTimeout(() => {
        logAlphabetGameDebug('Calling generateNewQuestion after entry audio delay')
        generateNewQuestionRef.current?.()
      }, 500)
    }
    
    logAlphabetGameDebug('Registering entry audio completion callback')
    entryAudioManager.onComplete('alphabet', handleEntryComplete)
    
    // Schedule entry audio - no delay for iOS PWA to stay within user interaction window
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    const delay = isIOS() && isPWA ? 0 : 1000
    logAlphabetGameDebug(`Scheduling entry audio with ${delay}ms delay`, {
      isIOS: isIOS(),
      isPWA,
      reason: isIOS() && isPWA ? 'iOS PWA requires immediate audio' : 'Standard delay'
    })
    entryAudioManager.scheduleEntryAudio('alphabet', delay)
    
    
    // Cleanup function
    return () => {
      logAlphabetGameDebug('Cleaning up entry audio manager callback')
      entryAudioManager.removeCallback('alphabet', handleEntryComplete)
    }
  }, [])
  
  useEffect(() => {
    // Cleanup function for timeouts - audio cleanup handled by useAudio hook
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  // Generate new question - stable useCallback to prevent infinite loops
  const generateNewQuestion = useCallback(() => {
    logAlphabetGameDebug('generateNewQuestion called', {
      previousLetter: currentLetter,
      entryAudioComplete,
      audioIsPlaying: audio.isPlaying,
      timestamp: Date.now()
    })
    
    // Pick a random letter from full Danish alphabet
    const letter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
    
    logAlphabetGameDebug('Generated new letter', { 
      letter,
      letterIndex: DANISH_ALPHABET.indexOf(letter)
    })
    
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
    
    logAlphabetGameDebug('Generated quiz options', { 
      correctLetter: letter,
      allOptions: shuffledOptions,
      correctPosition: shuffledOptions.indexOf(letter)
    })
    
    setShowOptions(shuffledOptions)
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Schedule delayed audio (same pattern as MathGame)
    logAlphabetGameDebug('Scheduling quiz prompt audio', { 
      letter,
      delay: 500,
      prompt: DANISH_PHRASES.gamePrompts.findLetter(letter)
    })
    
    timeoutRef.current = setTimeout(async () => {
      try {
        logAlphabetGameDebug('About to play quiz prompt audio', { letter })
        await audio.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findLetter(letter), letter)
        logAlphabetGameDebug('Quiz prompt audio completed successfully', { letter })
      } catch (error) {
        logAlphabetGameDebug('Error playing question audio', { 
          letter,
          error: error?.toString(),
          errorName: error?.constructor?.name,
          errorMessage: (error as any)?.message
        })
        console.error('🎯 AlphabetGame: Error playing question audio:', error)
      } finally {
        timeoutRef.current = null
      }
    }, 500)
    
  }, [audio, currentLetter, entryAudioComplete]) // Stable dependency - only recreate if audio changes
  
  // Assign function to ref for useGameAudioSetup
  useEffect(() => {
    generateNewQuestionRef.current = generateNewQuestion
  }, [generateNewQuestion])

  const handleLetterClick = async (selectedLetter: string) => {
    logAlphabetGameDebug('handleLetterClick called', {
      selectedLetter,
      currentLetter,
      isCorrect: selectedLetter === currentLetter,
      audioIsPlaying: audio.isPlaying,
      score,
      timestamp: Date.now()
    })
    
    if (audio.isPlaying) {
      logAlphabetGameDebug('Audio is playing, ignoring click')
      return
    }
    
    const isCorrect = selectedLetter === currentLetter
    
    try {
      logAlphabetGameDebug('About to call handleCompleteGameResult', {
        isCorrect,
        currentScore: score,
        autoAdvanceDelay: isIOS() ? 1000 : 3000
      })
      
      // Use unified game result handler
      await audio.handleCompleteGameResult({
        isCorrect,
        character: teacherCharacter,
        celebrate,
        stopCelebration,
        incrementScore,
        currentScore: score,
        nextAction: isCorrect ? () => {
          logAlphabetGameDebug('Correct answer - generating new question')
          generateNewQuestion()
        } : () => {
          logAlphabetGameDebug('Incorrect answer - character thinking')
          teacherCharacter.think()
        },
        autoAdvanceDelay: isIOS() ? 1000 : 3000,
        isIOS: isIOS()
      })
      
      logAlphabetGameDebug('handleCompleteGameResult completed successfully')
      
    } catch (error) {
      logAlphabetGameDebug('Error in handleCompleteGameResult', {
        selectedLetter,
        currentLetter,
        isCorrect,
        error: error?.toString(),
        errorName: error?.constructor?.name,
        errorMessage: (error as any)?.message
      })
      console.error('🎯 AlphabetGame: Error in unified game result handler:', error)
    }
  }

  const repeatLetter = async () => {
    
    if (audio.isPlaying) {
      return
    }
    
    try {
      await audio.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findLetter(currentLetter), currentLetter)
    } catch (error) {
      console.error('🎯 AlphabetGame: Error repeating letter:', error)
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
            disabled={!entryAudioComplete || audio.isPlaying}
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