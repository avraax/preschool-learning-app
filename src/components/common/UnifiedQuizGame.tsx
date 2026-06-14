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
import { useTheme } from '@mui/material/styles'
import { ArrowLeft } from 'lucide-react'
import { isIOS } from '../../utils/deviceDetection'
import { CategoryTheme } from '../../config/categoryThemes'
import { sectionIconImages } from '../../assets/themes/icons'
import GameMotif from './GameMotif'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { useGameState } from '../../hooks/useGameState'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 UnifiedQuizGame: ${message}`, data)
  }
}

// Quiz item interface for flexible content
export interface QuizItem {
  value: string | number      // The actual value (letter, number, or expression)
  display: string | number    // What to show on screen
  audioPrompt: string         // The full prompt text
  repeatWord: string          // Word to repeat in prompt
  // Optional visual question shown in the prompt area (e.g. word-association mode:
  // show an emoji + word and ask which letter it starts with). When present, the
  // quiz renders this above the answer grid instead of relying on audio alone.
  questionVisual?: { emoji: string; word: string }
}

// Configuration interface for the unified quiz
export interface UnifiedQuizConfig {
  // Quiz identification
  quizType: 'alphabet' | 'counting' | 'arithmetic' | 'english' | 'ordleg'
  
  // Content generation
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem) => QuizItem[]
  
  // Display configuration
  title: string                // "Bogstav Quiz" or "Tal Quiz"
  emoji: string               // "🎯" or "🧮"
  teacherCharacter: 'owl' | 'fox'
  theme: CategoryTheme
  backRoute: string
  
  // Component configuration
  ScoreChipComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  
  // Audio configuration
  gameWelcomeType: string     // 'alphabet' or 'math'
  
  // Audio methods (flexible to handle different prompt types)
  speakQuizPrompt: (item: QuizItem, audio: any) => Promise<string>
  speakClickedItem: (item: QuizItem, audio: any) => Promise<string>
  getRepeatAudio: (item: QuizItem, audio: any) => Promise<string>
}

interface UnifiedQuizGameProps {
  config: UnifiedQuizConfig
}

const UnifiedQuizGame: React.FC<UnifiedQuizGameProps> = ({ config }) => {
  const navigate = useNavigate()
  const muiTheme = useTheme()
  const [currentItem, setCurrentItem] = useState<QuizItem | null>(null)
  const [showOptions, setShowOptions] = useState<QuizItem[]>([])
  
  // Component initialization - no logging needed in production
  
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: `UnifiedQuizGame-${config.quizType}`,
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
  const hasInitialized = useRef(false)
  // Guards the actual start (welcome + first question) so it runs exactly once regardless of
  // which path triggers it (audio-ready-at-mount, audio-unlocked-later, or the resilience
  // fallback below).
  const startedRef = useRef(false)
  // Guards the welcome audio so it plays at most once even if audio unlocks after mount.
  const welcomeTriggered = useRef(false)
  
  // Generate new question using config
  const generateNewQuestion = useCallback(() => {
    // Generating new question
    
    // Generate quiz item using config
    const quizItem = config.generateQuizItem()
    
    // Generated new item
    
    setCurrentItem(quizItem)
    
    // Generate options using config
    const options = config.generateOptions(quizItem)
    
    // Generated quiz options
    
    setShowOptions(options)
    
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
        await config.speakQuizPrompt(quizItem, audio)
      } catch (error) {
        logError('Error playing quiz prompt', { 
          item: quizItem,
          error: error?.toString()
        })
      } finally {
        if (timeoutRef.current) {
          timeoutRef.current = null
        }
      }
    }, delay)
    
  }, [audio, config]) // Stable dependencies
  
  // Reveal the playable cards (first question). Idempotent — safe to call from any start path.
  const beginGame = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewQuestion()
  }, [generateNewQuestion])

  // Play welcome message then reveal the cards. Self-guards (ref) so the welcome plays at most
  // once even if audio readiness flips more than once.
  const playWelcomeAndStart = useCallback(async () => {
    if (welcomeTriggered.current) return
    welcomeTriggered.current = true
    try {
      // Play the welcome message and wait for it to complete
      await audio.playGameWelcome(config.gameWelcomeType)

      // Additional delay after welcome audio completes to ensure clean transition
      const additionalDelay = isIOS() ? 1500 : 2000  // Even longer delay for cleaner audio experience
      setTimeout(() => beginGame(), additionalDelay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      beginGame()
    }
  }, [audio, config.gameWelcomeType, beginGame])

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Initial teacher greeting
    teacherCharacter.setCharacter(config.teacherCharacter)
    teacherCharacter.wave()

    // Play the welcome immediately if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeAndStart()
    }

    // Resilience: browsers block the AudioContext until a user gesture, so isAudioReady may
    // never flip on a fresh/deep-linked load. Reveal the playable cards after a short delay so
    // the child is never stranded on an empty screen; the welcome line still plays if/when
    // audio unlocks (beginGame + playWelcomeAndStart are ref-guarded, so this never
    // double-starts).
    const fallback = setTimeout(() => beginGame(), 2500)

    return () => {
      clearTimeout(fallback)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [audio.isAudioReady, config.teacherCharacter, teacherCharacter, playWelcomeAndStart, beginGame])

  // When audio unlocks after mount, play the welcome (unless it/the game already started).
  // Ref-guarded so the effect performs no setState.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current && !startedRef.current) {
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady, playWelcomeAndStart])

  const handleItemClick = async (selectedItem: QuizItem) => {
    // Only prevent clicks if game isn't ready
    if (!gameReady || !currentItem) {
      return
    }
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    // FIRST: Play the clicked item immediately for fast feedback
    try {
      await config.speakClickedItem(selectedItem, audio)
    } catch (error) {
    }
    
    const isCorrect = selectedItem.value === currentItem.value
    
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
          selectedItem: selectedItem.display,
          currentItem: currentItem.display,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150) // Very short delay between item audio and celebration audio
  }

  const repeatItem = async () => {
    if (!currentItem) return
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    try {
      await config.getRepeatAudio(currentItem, audio)
    } catch (error) {
      console.error('🎵 UnifiedQuizGame: Error repeating item:', error)
    }
  }

  const ScoreChip = config.ScoreChipComponent
  const RepeatButton = config.RepeatButtonComponent

  return (
    <Box
      sx={{
        position: 'relative',
        isolation: 'isolate',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: config.theme.gradient
      }}
    >
      {/* Calm P4 motif (light from above + faint themed corner) behind the game content. */}
      <GameMotif categoryId={config.theme.id} />

      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={() => navigate(config.backRoute)}
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
          
          <ScoreChip
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
                  fontFamily: muiTheme.titleFontFamily,
                  // Dark worlds (e.g. Rummet) → light title + soft glow, matching menus/home.
                  color: muiTheme.scene.dark ? '#FFFFFF' : config.theme.accentColor,
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' },
                  textShadow: muiTheme.scene.dark
                    ? '0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'
                    : `1px 1px 2px ${config.theme.accentColor}33`
                }}
              >
                {config.title}
              </Typography>
              {/* Soft-3D section icon (theme-constant) replaces the flat trailing emoji. */}
              <Box
                component="img"
                src={sectionIconImages[config.theme.id as keyof typeof sectionIconImages]}
                alt=""
                draggable={false}
                sx={{
                  width: 52,
                  height: 52,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.22))',
                  userSelect: 'none'
                }}
              />
            </Box>
          </motion.div>
        </Box>

        {/* Visual Question - shown for word-association style rounds */}
        {currentItem?.questionVisual && (
          <Box sx={{ textAlign: 'center', mb: { xs: 1.5, md: 2 }, flex: '0 0 auto' }}>
            <motion.div
              key={`${currentItem.value}-${currentItem.questionVisual.word}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              {currentItem.questionVisual.emoji && (
                <Typography
                  sx={{
                    fontSize: 'clamp(3rem, 12vw, 5rem)',
                    lineHeight: 1,
                    mb: 0.5,
                    '@media (orientation: landscape)': {
                      fontSize: 'clamp(2.5rem, 8vh, 4rem)'
                    }
                  }}
                >
                  {currentItem.questionVisual.emoji}
                </Typography>
              )}
              {currentItem.questionVisual.word && (
                <Typography
                  sx={{
                    fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
                    fontWeight: 700,
                    color: config.theme.accentColor,
                    userSelect: 'none'
                  }}
                >
                  {currentItem.questionVisual.word}
                </Typography>
              )}
            </motion.div>
          </Box>
        )}

        {/* Audio Control - Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <RepeatButton
            onClick={repeatItem}
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
          {showOptions.map((item, index) => (
            <motion.div
              key={`${item.value}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ height: '100%' }}
            >
              <Card 
                onClick={() => handleItemClick(item)}
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: config.theme.borderColor,
                  bgcolor: 'white',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '16px',
                  // Themed elevation so the white card floats over the world (deeper on dark scenes).
                  boxShadow: muiTheme.scene.dark
                    ? '0 12px 30px rgba(0,0,0,0.45)'
                    : '0 6px 18px rgba(0,0,0,0.12)',
                  outline: 'none',
                  '&:focus-visible': {
                    outline: '3px solid',
                    outlineColor: config.theme.accentColor
                  },
                  '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': {
                      borderColor: config.theme.hoverBorderColor,
                      bgcolor: config.quizType === 'alphabet'
                        ? '#E3F2FD'
                        : config.quizType === 'english'
                          ? '#E8F5E9'
                          : config.quizType === 'ordleg' ? '#E0F2F1' : 'secondary.50',
                      boxShadow: `0 8px 32px ${config.theme.accentColor}40`,
                      transform: 'translateY(-2px)'
                    }
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
                      // Words (multi-character strings) render smaller so they fit the card;
                      // single glyphs (letters/numbers/emoji) stay large.
                      fontSize: (typeof item.display === 'string' && item.display.length > 2)
                        ? 'clamp(1.1rem, 4.5vw, 2rem)'
                        : 'clamp(2.5rem, 8vw, 4.5rem)',
                      fontWeight: 700,
                      color: config.theme.accentColor,
                      userSelect: 'none',
                      lineHeight: 1.1,
                      textAlign: 'center',
                      px: 1,
                      // Adjust font size in landscape
                      '@media (orientation: landscape)': {
                        fontSize: (typeof item.display === 'string' && item.display.length > 2)
                          ? 'clamp(1rem, 3.5vw, 1.75rem)'
                          : 'clamp(2rem, 6vw, 3.5rem)'
                      }
                    }}
                  >
                    {item.display}
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

export default UnifiedQuizGame