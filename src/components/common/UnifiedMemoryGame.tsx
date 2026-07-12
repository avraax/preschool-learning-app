import React, { useState, useEffect, useRef } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'
import { motion } from 'framer-motion'
import { CategoryTheme } from '../../config/categoryThemes'
import { useCharacterState } from '../common/LottieCharacter'
import { useCelebration } from '../common/CelebrationEffect'
import { useGameState } from '../../hooks/useGameState'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import GameShell from './GameShell'
import RoundResultScreen from './RoundResultScreen'
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
  gameId: string                             // stable per-board id, e.g. 'memory.letters.10'
  boardPairs: number                         // 10 | 20 — pairs on the board (one board = one round)
  starThresholds: { three: number; two: number }  // in MISTAKES (= mismatched turns)

  // Content generation
  generateItems: () => string[]              // pool of items; engine slices boardPairs for pairs
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
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [revealedCards, setRevealedCards] = useState<MemoryCard[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([])
  // pairId of the pair that just matched → drives a one-shot match pop on those two cards.
  const [poppedPairId, setPoppedPairId] = useState<string | null>(null)

  // Bounded round (one board = one round). No useRound: Memory always finds every pair, so the
  // only skill signal is how many mismatched turns it took. Tracked in refs (async match logic).
  const mismatchesRef = useRef(0)
  const matchStreakRef = useRef(0)
  const longestMatchStreakRef = useRef(0)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Centralized game state management
  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: `UnifiedMemoryGame-${config.gameType}`,
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)

  // Character and celebration management
  const teacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 UnifiedMemoryGame: ${message}`, data)
    }
  }

  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame): the board reveals once via beginGame regardless
  // of which path triggers it, and the welcome plays at most once — so the cards are never
  // stranded hidden when audio isn't unlocked at mount.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  // True once the child flips a card → suppresses a (possibly late) welcome from talking over play.
  const hasInteractedRef = useRef(false)

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Initialize teacher character
    teacher.setCharacter('owl')
    teacher.wave()

    // Instant load: generate + show the cards immediately (no waiting on the welcome).
    initializeGame()
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcome()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.gameType])

  // When audio unlocks after mount, play the welcome (board already visible). Interaction-guarded
  // inside playWelcome so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcome()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Reveal the cards. Idempotent — safe from any start path.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
  }

  // Narrate the welcome over the already-visible board. Self-guards; skipped once the child has
  // started flipping cards. (Memory has no per-question prompt.)
  const playWelcome = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('memory')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
  }

  const initializeGame = () => {
    // Generate the item pool using config
    const sourceItems = config.generateItems()

    // Select boardPairs items (or all if fewer) for this board's pairs
    const shuffledSource = [...sourceItems].sort(() => Math.random() - 0.5)
    const selectedItems = shuffledSource.slice(0, Math.min(config.boardPairs, sourceItems.length))
    
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
    setPoppedPairId(null)
    setWrongPairIds([])
    // Fresh board → fresh round counters.
    mismatchesRef.current = 0
    matchStreakRef.current = 0
    longestMatchStreakRef.current = 0
    resetScore()
  }

  const handleCardClick = async (clickedCard: MemoryCard) => {
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true
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

    // Light whoosh as the card flips up (separate SFX channel — never fights narration).
    sfx.play('flip')

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
        // Match found! Mark the pair matched, count it, pop the two cards.
        const matchedCards = cards.map(card =>
          card.pairId === firstCard.pairId ? { ...card, isMatched: true, isRevealed: true } : card
        )
        setCards(matchedCards)
        const newMatchedPairs = matchedPairs + 1
        setMatchedPairs(newMatchedPairs)
        incrementScore()
        teacher.wave()

        // micro tier fires the bright `correct` SFX + a small sparkle (no extra sfx.play).
        celebrateTier('micro')
        // One-shot match pop on the matched pair (skipped under reduced motion via the render guard).
        setPoppedPairId(firstCard.pairId)
        setTimeout(() => setPoppedPairId(null), 600)

        // Match-streak tracking → "Længste stime" record. Every 3rd in a row gets a streak burst,
        // but never on the final pair (the round result is the bigger moment).
        matchStreakRef.current += 1
        longestMatchStreakRef.current = Math.max(longestMatchStreakRef.current, matchStreakRef.current)
        const isFinalPair = newMatchedPairs === config.boardPairs
        if (matchStreakRef.current % 3 === 0 && !isFinalPair) {
          celebrateTier('streak')
        }

        // Final pair → finish the round. Brief beat so the final pop/celebration registers
        // before the result screen replaces the board.
        if (isFinalPair) {
          setTimeout(() => finishRound(), 700)
        }

      } else {
        // No match - gentle wrong SFX + shake, then flip back. Never punishing, never ends the board.
        sfx.play('wrong')
        mismatchesRef.current += 1
        matchStreakRef.current = 0
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

  // Record the round once on the final match. correct = boardPairs (the board always completes),
  // total = boardPairs + mismatches → progressStore derives mistakes = mismatches, so stars scale
  // with mismatched turns; longestStreak feeds the "Længste stime" record. (Zero Foundation change.)
  const finishRound = () => {
    const outcome = progressStore.recordRoundResult(
      config.gameId,
      {
        correct: config.boardPairs,
        total: config.boardPairs + mismatchesRef.current,
        longestStreak: longestMatchStreakRef.current,
      },
      { starThresholds: config.starThresholds },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    initializeGame()
  }

  const restartGame = () => {
    teacher.wave()
    stopCelebration()
    setRoundOutcome(null)
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

  // Depth language (AnswerTile reference) — fully token-driven, correct on light + dark scenes.
  const accent = config.theme.accentColor
  const dark = muiTheme.scene.dark
  const success = muiTheme.palette.success.main
  const lip = darken(accent, 0.3)                 // coloured 3D rim under a card
  const successEdge = darken(success, 0.28)
  const ambientShadow = dark ? '0 12px 28px rgba(0,0,0,0.5)' : '0 10px 22px rgba(0,0,0,0.15)'
  const idleBorder = hexToRgba(accent, dark ? 0.55 : 0.34)
  const restingShadow = `0 7px 0 ${lip}, ${ambientShadow}`
  const matchedShadow = `0 0 0 4px ${hexToRgba(success, 0.45)}, 0 7px 0 ${successEdge}, 0 14px 30px ${hexToRgba(success, 0.4)}`
  const faceUpSurface = 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)'
  const matchedSurface = `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(success, 0.16)} 100%)`

  // Grid columns derive from board size so both boards fill the viewport with no scroll.
  const gridCols = config.boardPairs === 10
    ? { xs: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(5, 1fr)' }
    : { xs: 'repeat(5, 1fr)', sm: 'repeat(8, 1fr)', md: 'repeat(10, 1fr)' }
  const gridColsLandscape = config.boardPairs === 10
    ? { xs: 'repeat(5, 1fr)', sm: 'repeat(7, 1fr)', md: 'repeat(7, 1fr)' }
    : { xs: 'repeat(8, 1fr)', sm: 'repeat(10, 1fr)', md: 'repeat(10, 1fr)' }
  const gridMaxWidth = config.boardPairs === 10
    ? { md: '640px', lg: '760px' }
    : { md: '1000px', lg: '1200px' }

  return (
    <GameShell
      categoryId={config.theme.id}
      title={config.title}
      backRoute={config.backPath}
      dense
      guide={false}
      score={
        <ScoreComponent
          score={score}
          disabled={isScoreNarrating}
          onClick={handleScoreClick}
          customLabel={`Par: ${matchedPairs}/${config.boardPairs}`}
        />
      }
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
        <style>{flipStyles}</style>
        {roundOutcome ? (
          <RoundResultScreen
            outcome={roundOutcome}
            categoryId={config.theme.id}
            backRoute={config.backPath}
            onReplay={handleReplay}
          />
        ) : (
          <>
        {/* Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: { xs: 1, md: 2 }, flex: '0 0 auto', [PHONE_LANDSCAPE]: { mb: 0.5 } }}>
          <RestartButtonComponent
            onClick={restartGame}
            size="small"
          />
          <RepeatButtonComponent
            onClick={repeatInstructions}
            disabled={false}
            size="small"
            label="Hør igen"
          />
        </Box>

        {/* Memory Cards Grid — columns derive from board size */}
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
            gridTemplateColumns: gridCols,
            gridAutoRows: 'auto',
            gap: { xs: '6px', sm: '8px', md: '10px', lg: '12px' },
            width: '100%',
            maxWidth: gridMaxWidth,
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
              gridTemplateColumns: gridColsLandscape,
              '& > *': {
                aspectRatio: '3/4',
                minHeight: { xs: '50px', sm: '60px', md: '70px' },
                maxHeight: { xs: '80px', sm: '90px', md: '100px' }
              }
            },
            // Phone landscape: many narrow columns so 2 (10-pair) / 3 (20-pair) rows fit
            // inside a ≤480px-tall viewport without clipping.
            [PHONE_LANDSCAPE]: {
              gridTemplateColumns: config.boardPairs === 10 ? 'repeat(10, 1fr)' : 'repeat(14, 1fr)',
              gap: '5px',
              '& > *': {
                aspectRatio: '3/4',
                minHeight: '48px',
                maxHeight: config.boardPairs === 10 ? '86px' : '62px'
              }
            },
            // Phone portrait: the 20-pair board (5 cols × 8 rows) overflowed — 6 columns.
            ...(config.boardPairs === 20 && {
              [PHONE_PORTRAIT]: {
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '5px',
                '& > *': { aspectRatio: '3/4', minHeight: '48px', maxHeight: '84px' }
              }
            })
          }}>
            {gameReady && cards.length > 0 ? cards.map((card, index) => {
              const displayData = config.getDisplayData(card.content)
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    // One-shot match pop (skipped under reduced motion — colour/glow still reads).
                    scale: (!reduce && poppedPairId === card.pairId) ? [1, 1.08, 1] : 1,
                    x: wrongPairIds.includes(card.id) ? [0, -10, 10, -10, 10, 0] : 0
                  }}
                  transition={{
                    delay: index * 0.02,
                    duration: 0.5,
                    scale: { duration: 0.4, delay: 0 },
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
                          borderColor: idleBorder,
                          background: config.theme.gradient,
                          boxShadow: restingShadow
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
                          borderColor: card.isMatched ? success : idleBorder,
                          background: card.isMatched ? matchedSurface : faceUpSurface,
                          boxShadow: card.isMatched ? matchedShadow : restingShadow,
                          padding: '4px'
                        }}
                      >
                        {/* Primary content */}
                        <div style={{
                          fontSize: config.gameType === 'numbers' ? 'clamp(1.4rem, 3vw, 2.2rem)' : 'clamp(1.6rem, 3.5vw, 2.2rem)',
                          fontWeight: 700,
                          color: card.isMatched ? successEdge : accent,
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
                              color: card.isMatched ? successEdge : accent,
                              fontWeight: 600,
                              textAlign: 'center',
                              lineHeight: 1
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
          </>
        )}
    </GameShell>
  )
}

export default UnifiedMemoryGame