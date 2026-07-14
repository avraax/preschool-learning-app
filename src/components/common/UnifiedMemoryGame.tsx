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
import { darken, hexToRgba, tileSurface } from '../../theme/tokens/helpers'
import type { AmbientMotion } from '../../theme/tokens/types'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { SNAP } from '../../theme/motion'
import { devFx } from '../../utils/devHarness'
import GameShell from './GameShell'
import RoundResultScreen from './RoundResultScreen'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Structural CSS for the 3D card flip (UI/UX Overhaul PRD §6E). The rotateY animation itself is
// driven by Framer Motion (`SNAP` transition) on the `.flipper` element, not by a CSS class toggle —
// this file only needs the perspective root + the two absolutely-positioned, backface-hidden faces.
// Reduced motion drops the rotateY entirely (faces cross-fade via opacity instead — see the card
// render below), so no CSS transition/transform is declared here at all.
const flipStyles = `
  .flip-container {
    perspective: 1000px;
    width: 100%;
    height: 100%;
  }

  .card-face {
    backface-visibility: hidden;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    border: 3px solid;
  }
`

// Per-world card-back motif (UI/UX Overhaul PRD §6E) — replaces the old generic "ABC"/"123".
// Keyed by the active skin's ambient motion, the SAME signal Mascot.tsx / CelebrationEffect.tsx
// already use to flavor their own emoji sets — so a reskin (kid/ocean/space/dino) is what changes
// the card back, not the section (letters vs numbers stays signalled by the section accent color).
const WORLD_MOTIF: Record<AmbientMotion, string> = {
  twinkle: '🚀', // Rummet (space)
  rise: '🐚',    // Havet (ocean)
  fall: '🦕',    // Dinosaurer
  drift: '🌈',   // Regnbue (default/kid)
}

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
  theme: CategoryTheme     // card-back MOTIF is theme/world-driven now (see WORLD_MOTIF), not config

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
  // Bumps each board so card React keys never collide across boards. card.id is content-derived
  // (`${item}-1`) and the same letters/numbers reappear on a new board, so without this a reused
  // key could flip a stale card back over + skip the deal-in stagger. (card.id itself is left as-is
  // — the match logic keys off it; only the React key is namespaced.)
  const boardSeq = useRef(0)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Centralized game state management
  const { incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()
  
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

  // DEV screenshot harness (?fx=correct|wrong|hint|streak): nudge the mascot bus once per force so
  // the reaction is capturable. The matching VISUAL override (which cards look matched/revealed/
  // wrong) is DERIVED per-card at render time below (fxMatchedIds/fxRevealIds/fxWrongIds) — this
  // never mutates real game/round state. Memory has no genuine hint mechanic, so `hint` is mapped to
  // a plain face-up (flip) card — the remaining state worth capturing for this game.
  const forcedFx = devFx()
  useEffect(() => {
    if (!forcedFx || cards.length === 0) return
    if (forcedFx === 'correct') mascotBus.emit('correct')
    else if (forcedFx === 'wrong') mascotBus.emit('wrong')
    else if (forcedFx === 'streak') mascotBus.emit('streak')
    else mascotBus.emit('hint')
  }, [forcedFx, cards.length])

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
    
    boardSeq.current += 1 // fresh key namespace for this board's cards
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

        // Match juice (UI/UX Overhaul PRD §6E): both cards already pop + glow (poppedPairId scale +
        // the persistent success border/shadow from `isMatched`, computed at render time below) —
        // here we fire the distinct 'match' cue + the reactive mascot. A per-match full-screen
        // celebration is intentionally skipped (reserved for the streak/round crescendo moments below
        // and in RoundResultScreen) so a 20-pair board doesn't fire 20 confetti bursts.
        sfx.play('match')
        mascotBus.emit('correct')
        // One-shot match pop on the matched pair (skipped under reduced motion via the render guard).
        setPoppedPairId(firstCard.pairId)
        setTimeout(() => setPoppedPairId(null), 600)

        // Match-streak tracking → "Længste stime" record. Every 3rd in a row gets a streak burst,
        // but never on the final pair (the round result is the bigger moment).
        matchStreakRef.current += 1
        longestMatchStreakRef.current = Math.max(longestMatchStreakRef.current, matchStreakRef.current)
        const isFinalPair = newMatchedPairs === config.boardPairs
        if (matchStreakRef.current % 3 === 0 && !isFinalPair) {
          // celebrateTier fires the 'streak-up' SFX + medium confetti; the mascot joins in.
          celebrateTier('streak')
          mascotBus.emit('streak')
        }

        // Final pair → finish the round. Brief beat so the final pop/celebration registers
        // before the result screen replaces the board.
        if (isFinalPair) {
          setTimeout(() => finishRound(), 700)
        }

      } else {
        // No match - gentle wrong SFX + shake, then flip back. Never punishing, never ends the board.
        sfx.play('wrong')
        mascotBus.emit('wrong')
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

  // Depth language (AnswerTile reference — UI/UX Overhaul PRD §5.2/§6E) — fully token-driven,
  // correct on light + dark scenes. Formulas mirror AnswerTile's idle/correct/wrong states exactly
  // so Memory's cards read as the same "furniture" as every other tile in the app.
  const accent = config.theme.accentColor
  const dark = muiTheme.scene.dark
  const success = muiTheme.palette.success.main
  const errorColor = muiTheme.palette.error.main
  const lip = darken(accent, 0.3)                 // coloured 3D rim under a card
  const successEdge = darken(success, 0.28)
  const errorEdge = darken(errorColor, 0.25)
  const ambientShadow = dark ? '0 12px 28px rgba(0,0,0,0.5)' : '0 10px 22px rgba(0,0,0,0.15)'
  const idleBorder = hexToRgba(accent, dark ? 0.55 : 0.34)
  const restingShadow = `0 8px 0 ${lip}, ${ambientShadow}`
  const matchedShadow = `0 0 0 5px ${hexToRgba(success, 0.5)}, 0 8px 0 ${successEdge}, 0 16px 34px ${hexToRgba(success, 0.42)}`
  const wrongShadow = `0 8px 0 ${errorEdge}, ${ambientShadow}`
  // Section-tinted idle surface (was a hardcoded #FFF→#ECF1F8 — the exact bug §5.1 introduced
  // `tileSurface` to fix elsewhere; Memory's face-up cards had never been migrated to it).
  const faceUpSurface = tileSurface(accent, dark)
  const matchedSurface = `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(success, 0.16)} 100%)`
  const wrongSurface = `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(errorColor, 0.1)} 100%)`
  // Per-world card-back motif (differs per skin, not per section — see WORLD_MOTIF above).
  const motif = WORLD_MOTIF[muiTheme.scene.ambient.motion]

  // DEV screenshot harness (?fx=): derive which card ids should render in the forced state, purely
  // for display — real cards/score/round state is never touched. `correct`/`streak` force the first
  // pair matched (pop+glow); `wrong` forces the first mismatching pair face-up + shaking; `hint`
  // (no real hint mechanic in Memory) forces a single plain face-up card to demo the flip itself.
  const fxMatchedIds = new Set<string>()
  const fxRevealIds = new Set<string>()
  const fxWrongIds = new Set<string>()
  if (forcedFx && cards.length >= 2) {
    if (forcedFx === 'correct' || forcedFx === 'streak') {
      const first = cards[0]
      cards.forEach((c) => { if (c.pairId === first.pairId) fxMatchedIds.add(c.id) })
    } else if (forcedFx === 'wrong') {
      const a = cards[0]
      const b = cards.find((c) => c.pairId !== a.pairId)
      fxRevealIds.add(a.id)
      if (b) {
        fxRevealIds.add(b.id)
        fxWrongIds.add(a.id)
        fxWrongIds.add(b.id)
      }
    } else if (forcedFx === 'hint') {
      fxRevealIds.add(cards[0].id)
    }
  }

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
              // DEV ?fx= overrides (no-op in prod / without the param — see fx*Ids above).
              const fxMatched = fxMatchedIds.has(card.id)
              const fxWrong = fxWrongIds.has(card.id)
              const isMatched = card.isMatched || fxMatched
              const isFaceUp = card.isRevealed || card.isMatched || fxRevealIds.has(card.id) || fxMatched
              const isWrong = wrongPairIds.includes(card.id) || fxWrong
              // One-shot match pop (skipped under reduced motion — colour/glow still communicates).
              const pop = !reduce && (poppedPairId === card.pairId || fxMatched)

              return (
                <motion.div
                  key={`b${boardSeq.current}-${card.id}`}
                  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: 1,
                    scale: pop ? [1, 1.08, 1] : 1,
                    x: (!reduce && isWrong) ? [0, -10, 10, -10, 10, 0] : 0
                  }}
                  transition={{
                    delay: reduce ? 0 : index * 0.02,
                    duration: reduce ? 0 : 0.5,
                    scale: { duration: 0.4, delay: 0 },
                    x: { duration: 0.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
                  }}
                  whileHover={{ scale: isMatched ? 1 : 1.05 }}
                  whileTap={{ scale: isMatched ? 1 : 0.95 }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <div className="flip-container" style={{ height: '100%' }}>
                    {/* The rotateY flip itself (crisp 3D via `SNAP`). Reduced motion: no rotation at
                        all (parent stays flat) — the two faces cross-fade via opacity instead, so the
                        state change still reads without any transform animation. */}
                    <motion.div
                      className="flipper"
                      onClick={() => handleCardClick(card)}
                      style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        cursor: 'pointer',
                        transformStyle: reduce ? 'flat' : 'preserve-3d',
                      }}
                      animate={reduce ? undefined : { rotateY: isFaceUp ? 180 : 0 }}
                      transition={reduce ? undefined : SNAP}
                    >
                      {/* Card back — the per-world motif (idle/rest state). */}
                      <motion.div
                        className="card-face card-motif"
                        style={{
                          transform: reduce ? 'none' : 'rotateY(0deg)',
                          zIndex: 2,
                          borderColor: idleBorder,
                          background: config.theme.gradient,
                          boxShadow: restingShadow
                        }}
                        animate={reduce ? { opacity: isFaceUp ? 0 : 1 } : undefined}
                        transition={reduce ? { duration: 0.25, ease: 'easeInOut' } : undefined}
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
                          {/* World motif glyph (Rummet 🚀 / Havet 🐚 / Dinosaurer 🦕 / Regnbue 🌈) */}
                          <div aria-hidden style={{
                            position: 'relative',
                            fontSize: 'clamp(1.7rem, 5vw, 2.8rem)',
                            lineHeight: 1,
                            filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.35))'
                          }}>
                            {motif}
                          </div>
                          {/* Corner accents — same motif, small + faint */}
                          <div aria-hidden style={{ position: 'absolute', top: 8, left: 8, fontSize: '0.75rem', opacity: 0.5 }}>{motif}</div>
                          <div aria-hidden style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.75rem', opacity: 0.5 }}>{motif}</div>
                          <div aria-hidden style={{ position: 'absolute', bottom: 8, left: 8, fontSize: '0.75rem', opacity: 0.5 }}>{motif}</div>
                          <div aria-hidden style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '0.75rem', opacity: 0.5 }}>{motif}</div>
                        </div>
                      </motion.div>

                      {/* Card front — the content revealed on flip (letter/number + icon/word). */}
                      <motion.div
                        className="card-face card-content"
                        style={{
                          transform: reduce ? 'none' : 'rotateY(180deg)',
                          borderColor: isMatched ? success : isWrong ? errorColor : idleBorder,
                          background: isMatched ? matchedSurface : isWrong ? wrongSurface : faceUpSurface,
                          boxShadow: isMatched ? matchedShadow : isWrong ? wrongShadow : restingShadow,
                          padding: '4px'
                        }}
                        animate={reduce ? { opacity: isFaceUp ? 1 : 0 } : undefined}
                        transition={reduce ? { duration: 0.25, ease: 'easeInOut' } : undefined}
                      >
                        {/* Primary content */}
                        <div style={{
                          fontSize: config.gameType === 'numbers' ? 'clamp(1.4rem, 3vw, 2.2rem)' : 'clamp(1.6rem, 3.5vw, 2.2rem)',
                          fontWeight: 700,
                          color: isMatched ? successEdge : accent,
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
                              color: isMatched ? successEdge : accent,
                              fontWeight: 600,
                              textAlign: 'center',
                              lineHeight: 1
                            }}
                            className="memory-card-secondary-text"
                          >
                            {displayData.secondary}
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
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