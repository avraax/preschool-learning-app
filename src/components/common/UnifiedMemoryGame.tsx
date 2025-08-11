import React, { useState, useEffect, useRef } from 'react'
import { Container, Box } from '@mui/material'
import { motion } from 'framer-motion'
import { CategoryTheme } from '../../config/categoryThemes'
import { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { useGameState } from '../../hooks/useGameState'
import GameHeader from '../common/GameHeader'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Working CSS for card flip animation
const flipStyles = `
  .flip-container {
    perspective: 1000px;
    width: 100%;
    height: 100%;
  }

  .flipper {
    transition: transform 0.6s;
    transform-style: preserve-3d;
    position: relative;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .flipper.flipped {
    transform: rotateY(180deg);
  }

  .card-face {
    backface-visibility: hidden;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    border: 3px solid;
  }

  .card-front {
    transform: rotateY(0deg);
    z-index: 2;
  }

  .card-back {
    transform: rotateY(180deg);
  }

  .memory-card-text {
    color: #1976d2 !important;
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
    100% { transform: scale(1); opacity: 1; }
  }
`

// Memory card interface
export interface MemoryCard {
  id: string
  content: string
  isRevealed: boolean
  isMatched: boolean
  pairId: string
}

// Display data interface for different memory game types
export interface MemoryItemDisplay {
  primary: string           // Main display content (letter, number, etc.)
  secondary?: string        // Optional secondary content (word for letters)
  icon?: string            // Optional icon/emoji
  backDisplay?: string     // Optional back of card text
}

// Configuration interface for unified memory games
export interface UnifiedMemoryConfig {
  // Game identification
  gameType: 'letters' | 'numbers' | 'colors' | 'shapes'
  
  // Content generation
  generateItems: () => string[]              // Generate 20 items for pairs
  getDisplayData: (item: string) => MemoryItemDisplay
  
  // Audio configuration
  speakItem: (item: string, audio: any) => Promise<string>
  speakMatchedItem?: (item: string, audio: any) => Promise<string>
  
  // UI configuration
  title: string
  instructions: string
  backPath: string
  theme: CategoryTheme
  cardBackIcon: string     // Icon to show on card backs (ABC, 123, etc.)
  
  // Component overrides
  ScoreComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  RestartButtonComponent: React.ComponentType<any>
}

interface UnifiedMemoryGameProps {
  config: UnifiedMemoryConfig
}

const UnifiedMemoryGame: React.FC<UnifiedMemoryGameProps> = ({ config }) => {
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [revealedCards, setRevealedCards] = useState<MemoryCard[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([])
    
  // Centralized game state management
  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: `UnifiedMemoryGame-${config.gameType}`,
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  
  // Character and celebration management
  const teacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 UnifiedMemoryGame: ${message}`, data)
    }
  }
  
  const hasInitialized = useRef(false)

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    // Initialize teacher character
    teacher.setCharacter('owl')
    teacher.wave()
    
    // Check if audio is ready
    if (audio.isAudioReady) {
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
    
    // Generate cards immediately but don't show them until entry audio completes
    initializeGame()
  }, [config.gameType])
  
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
      // Play the welcome message
      await audio.playGameWelcome('memory')
      
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

  const initializeGame = () => {
    // Generate 20 random items for pairs using config
    const sourceItems = config.generateItems()
    
    // Randomly select 20 items (or all if less than 20)
    const shuffledSource = [...sourceItems].sort(() => Math.random() - 0.5)
    const selectedItems = shuffledSource.slice(0, Math.min(20, sourceItems.length))
    
    // Create pairs (each item appears twice)
    const cardData: MemoryCard[] = []
    selectedItems.forEach((item, index) => {
      const pairId = `pair-${index}`
      
      // First card of the pair
      cardData.push({
        id: `${item}-1`,
        content: item,
        isRevealed: false,
        isMatched: false,
        pairId
      })
      
      // Second card of the pair
      cardData.push({
        id: `${item}-2`,
        content: item,
        isRevealed: false,
        isMatched: false,
        pairId
      })
    })
    
    // Shuffle all cards
    const shuffledCards = cardData.sort(() => Math.random() - 0.5)
    
    setCards(shuffledCards)
    setRevealedCards([])
    setMatchedPairs(0)
    setIsProcessing(false)
    resetScore()
  }

  const handleCardClick = async (clickedCard: MemoryCard) => {
    const cardClickDebugInfo = {
      cardId: clickedCard.id,
      cardContent: clickedCard.content,
      isMatched: clickedCard.isMatched,
      isRevealed: clickedCard.isRevealed,
      gameType: config.gameType,
      isProcessing,
      revealedCardsCount: revealedCards.length,
      matchedPairs,
      score,
      audioIsPlaying: audio.isPlaying,
      // Technical details
      isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
      isPWA: window.matchMedia('(display-mode: standalone)').matches,
      documentFocus: document.hasFocus(),
      documentVisible: !document.hidden,
      userAgent: navigator.userAgent.substring(0, 100),
      timestamp: Date.now(),
      timeSincePageLoad: performance.now()
    }
    
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    // Handle matched cards - they should speak with special audio if available
    if (clickedCard.isMatched && config.speakMatchedItem) {
      try {
        await config.speakMatchedItem(clickedCard.content, audio)
      } catch (error: any) {
        const errorDetails = {
          cardContent: clickedCard.content,
          error: error?.toString(),
          errorMessage: error?.message,
          gameType: config.gameType,
          isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
          isPWA: window.matchMedia('(display-mode: standalone)').matches
        }
        console.error('🎵 UnifiedMemoryGame: Matched card audio failed', errorDetails)
      }
      return
    }
    
    // Prevent clicks during processing or if card is already revealed/matched
    if (isProcessing || clickedCard.isRevealed || clickedCard.isMatched || revealedCards.length >= 2) {
      return
    }

    // Reveal the clicked card
    const updatedCards = cards.map(card =>
      card.id === clickedCard.id ? { ...card, isRevealed: true } : card
    )
    setCards(updatedCards)

    const newRevealedCards = [...revealedCards, { ...clickedCard, isRevealed: true }]
    setRevealedCards(newRevealedCards)

    // Play audio for the revealed card with enhanced iOS handling
    const playCardAudio = async () => {
      try {
        
        await config.speakItem(clickedCard.content, audio)
        
      } catch (error: any) {
        // Check if this is a navigation interruption (expected)
        const isNavigationInterruption = error && 
          (error.message?.includes('interrupted by navigation') || 
           error.message?.includes('interrupted by user'))
        
        if (isNavigationInterruption) {
          return // Don't show prompts for expected interruptions
        }
        
        const audioErrorDetails = {
          cardContent: clickedCard.content,
          gameType: config.gameType,
          error: error?.toString(),
          errorMessage: error?.message,
          errorStack: error?.stack?.split('\n').slice(0, 3).join(' | '),
          isIOS: navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad'),
          isPWA: window.matchMedia('(display-mode: standalone)').matches,
          documentFocus: document.hasFocus(),
          documentVisible: !document.hidden,
          timestamp: Date.now()
        }
        
        console.error('🎵 UnifiedMemoryGame: Card reveal audio failed', audioErrorDetails)
      }
    }
    
    // Start audio playback but don't wait for it to prevent blocking the game
    playCardAudio()

    // If this is the second card, check for match
    if (newRevealedCards.length === 2) {
      setIsProcessing(true)
      
      const [firstCard, secondCard] = newRevealedCards
      const isMatch = firstCard.content === secondCard.content

      // Wait a moment to let user see both cards
      await new Promise(resolve => setTimeout(resolve, 1000))

      if (isMatch) {
        // Match found!
        const matchedCards = cards.map(card =>
          card.pairId === firstCard.pairId ? { ...card, isMatched: true, isRevealed: true } : card
        )
        setCards(matchedCards)
        setMatchedPairs(prev => prev + 1)
        incrementScore()

        // Play match success using centralized pattern
        await audio.handleCompleteGameResult({
          isCorrect: true,
          character: teacher,
          celebrate: () => {}, // Don't start new celebration for each match
          stopCelebration: () => {},
          incrementScore: () => {}, // Already incremented above
          currentScore: score,
          nextAction: () => {
            teacher.wave()
          },
          autoAdvanceDelay: 500 // Quick transition for matches
        })

        // Check if game is complete (all 20 pairs found)
        if (matchedPairs + 1 === 20) {
          // Use centralized game completion handler
          await audio.handleGameCompletion({
            character: teacher,
            celebrate: celebrate,
            stopCelebration: stopCelebration,
            resetAction: () => {
              restartGame()
            },
            completionMessage: DANISH_PHRASES.completion.memoryGameSuccess,
            autoResetDelay: 3000
          })
        }

      } else {
        // No match - show shake animation
        setWrongPairIds(newRevealedCards.map(c => c.id))
        
        // Wait for shake animation
        await new Promise(resolve => setTimeout(resolve, 600))
        
        // Reset wrong pair indicator
        setWrongPairIds([])
        
        // Wait a bit more before flipping back
        await new Promise(resolve => setTimeout(resolve, 400))
        
        const resetCards = cards.map(card =>
          newRevealedCards.some(revealed => revealed.id === card.id) && !card.isMatched
            ? { ...card, isRevealed: false }
            : card
        )
        setCards(resetCards)

        teacher.think()
      }

      // Reset revealed cards for next turn
      setRevealedCards([])
      setIsProcessing(false)
    }
  }

  const restartGame = () => {
    teacher.wave()
    initializeGame()
  }

  // Repeat game instructions
  const repeatInstructions = () => {
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    if (!gameReady) return
    
    try {
      audio.speak(config.instructions).catch(() => {})
    } catch (error) {
      // Ignore audio errors
    }
  }

  const ScoreComponent = config.ScoreComponent
  const RepeatButtonComponent = config.RepeatButtonComponent  
  const RestartButtonComponent = config.RestartButtonComponent

  return (
    <>
      <style>{flipStyles}</style>
      <Box 
        sx={{ 
          height: '100dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: config.theme.gradient
        }}
      >
      <GameHeader
        title={config.title}
        titleIcon="🧠"
        character={teacher}
        categoryTheme={config.theme}
        backPath={config.backPath}
        scoreComponent={
          <ScoreComponent
            score={score}
            disabled={isScoreNarrating}
            onClick={handleScoreClick}
          />
        }
      />

      <Container 
        maxWidth="xl" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 0.5, md: 1 },
          overflow: 'hidden'
        }}
      >
        {/* Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: { xs: 1, md: 2 }, flex: '0 0 auto' }}>
          <RestartButtonComponent
            onClick={restartGame}
            size="small"
          />
          <RepeatButtonComponent
            onClick={repeatInstructions}
            disabled={false}
            size="small"
            label="🎵 Hör igen"
          />
        </Box>

        {/* Memory Cards Grid - 4x10 layout */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 0,
          overflow: 'hidden',
          p: { xs: 0.5, sm: 1, md: 1 },
          width: '100%'
        }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { 
              xs: 'repeat(5, 1fr)',   // Mobile portrait: 5 columns
              sm: 'repeat(8, 1fr)',   // Tablet: 8 columns
              md: 'repeat(10, 1fr)'   // Desktop: 10 columns
            },
            gridAutoRows: 'auto',
            gap: { xs: '6px', sm: '8px', md: '10px', lg: '12px' },
            width: '100%',
            maxWidth: { md: '1000px', lg: '1200px' },
            justifyContent: 'center',
            // Individual card aspect ratio and constraints
            '& > *': {
              aspectRatio: '3/4',  // Traditional card proportions
              minHeight: { xs: '60px', sm: '70px', md: '80px' },
              maxHeight: { xs: '100px', sm: '120px', md: '140px' },
              width: '100%'
            },
            // Orientation specific adjustments
            '@media (orientation: landscape)': {
              gridTemplateColumns: { 
                xs: 'repeat(8, 1fr)',   // Landscape mobile: 8 columns
                sm: 'repeat(10, 1fr)',  // Landscape tablet: 10 columns
                md: 'repeat(10, 1fr)'   // Landscape desktop: 10 columns
              },
              '& > *': {
                aspectRatio: '3/4',
                minHeight: { xs: '50px', sm: '60px', md: '70px' },
                maxHeight: { xs: '80px', sm: '90px', md: '100px' }
              }
            }
          }}>
            {gameReady && cards.length > 0 ? cards.map((card, index) => {
              const displayData = config.getDisplayData(card.content)
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1,
                    x: wrongPairIds.includes(card.id) ? [0, -10, 10, -10, 10, 0] : 0
                  }}
                  transition={{ 
                    delay: index * 0.02, 
                    duration: 0.5,
                    x: { duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
                  }}
                  whileHover={{ scale: card.isMatched ? 1 : 1.05 }}
                  whileTap={{ scale: card.isMatched ? 1 : 0.95 }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <div 
                    className="flip-container" 
                    style={{ 
                      height: '100%'
                    }}
                  >
                    <div 
                      className={`flipper ${card.isRevealed || card.isMatched ? 'flipped' : ''}`}
                      onClick={() => handleCardClick(card)}
                    >
                      {/* Card Front (Back side - what shows when not flipped) */}
                      <div 
                        className="card-face card-front"
                        style={{
                          borderColor: config.theme.accentColor,
                          background: config.theme.gradient
                        }}
                      >
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column'
                        }}>
                          {/* Pattern overlay */}
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: 0.1,
                            background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
                          }} />
                          {/* Central content */}
                          <div style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <div style={{
                              fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                              fontWeight: 'bold',
                              color: 'white',
                              textShadow: '0 0 8px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)',
                              fontFamily: 'Comic Sans MS, Arial',
                              letterSpacing: '1px',
                              WebkitTextStroke: '0.5px rgba(0,0,0,0.3)'
                            }}>
                              {config.cardBackIcon}
                            </div>
                          </div>
                          {/* Corner stars */}
                          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: '1rem' }}>⭐</div>
                          <div style={{ position: 'absolute', top: 8, right: 8, fontSize: '1rem' }}>⭐</div>
                          <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: '1rem' }}>⭐</div>
                          <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '1rem' }}>⭐</div>
                        </div>
                      </div>

                      {/* Card Back (Content side - what shows when flipped) */}
                      <div 
                        className="card-face card-back"
                        style={{
                          borderColor: card.isMatched ? '#4caf50' : config.theme.accentColor,
                          background: card.isMatched ? '#e8f5e8' : 'white',
                          padding: '4px'
                        }}
                      >
                        {/* Primary content */}
                        <div style={{ 
                          fontSize: config.gameType === 'numbers' ? 'clamp(1.4rem, 3vw, 2.2rem)' : 'clamp(1.6rem, 3.5vw, 2.2rem)',
                          fontWeight: 700,
                          color: card.isMatched ? '#2e7d32' : config.theme.accentColor,
                          marginBottom: displayData.icon ? '2px' : '0px',
                          lineHeight: 0.9
                        }}>
                          {displayData.primary}
                        </div>
                        
                        {/* Optional icon */}
                        {displayData.icon && (
                          <div style={{ 
                            fontSize: 'clamp(1rem, 2.5vw, 1.6rem)', 
                            lineHeight: 1,
                            marginBottom: '3px'
                          }}>
                            {displayData.icon}
                          </div>
                        )}

                        {/* Optional secondary content */}
                        {displayData.secondary && (
                          <div 
                            style={{
                              fontSize: 'clamp(0.7rem, 1.8vw, 1rem)',
                              color: card.isMatched ? '#2e7d32' : '#333',
                              fontWeight: 600,
                              textAlign: 'center',
                              lineHeight: 1,
                              fontFamily: 'Comic Sans MS, Arial'
                            }}
                            className="memory-card-secondary-text"
                          >
                            {displayData.secondary}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            }) : null}
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
    </>
  )
}

export default UnifiedMemoryGame