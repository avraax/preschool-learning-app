import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, AppBar, Toolbar, Chip } from '@mui/material'
import { ArrowBack, Star, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'

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

import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { audioManager } from '../../utils/audio'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { useGameEntryAudio } from '../../hooks/useGameEntryAudio'
import { entryAudioManager } from '../../utils/entryAudioManager'

// Danish alphabet (29 letters)
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

// Numbers 1-20 
const NUMBERS = Array.from({ length: 20 }, (_, i) => (i + 1).toString())

// Letter associations with Danish words and icons
const LETTER_ICONS: { [key: string]: { word: string; icon: string } } = {
  'A': { word: 'Ananas', icon: '🍍' },
  'B': { word: 'Bjørn', icon: '🐻' },
  'C': { word: 'Cykel', icon: '🚲' },
  'D': { word: 'Due', icon: '🦆' },
  'E': { word: 'Elefant', icon: '🐘' },
  'F': { word: 'Frø', icon: '🐸' },
  'G': { word: 'Giraf', icon: '🦒' },
  'H': { word: 'Hest', icon: '🐴' },
  'I': { word: 'Is', icon: '🍦' },
  'J': { word: 'Juletræ', icon: '🎄' },
  'K': { word: 'Kat', icon: '🐱' },
  'L': { word: 'Løve', icon: '🦁' },
  'M': { word: 'Mus', icon: '🐭' },
  'N': { word: 'Næsehorn', icon: '🦏' },
  'O': { word: 'Ost', icon: '🧀' },
  'P': { word: 'Papegøje', icon: '🦜' },
  'Q': { word: 'Quiz', icon: '❓' },
  'R': { word: 'Ræv', icon: '🦊' },
  'S': { word: 'Sol', icon: '☀️' },
  'T': { word: 'Tog', icon: '🚂' },
  'U': { word: 'Ugle', icon: '🦉' },
  'V': { word: 'Vind', icon: '💨' },
  'W': { word: 'Vand', icon: '🌊' },
  'X': { word: 'X', icon: '❌' },
  'Y': { word: 'Yacht', icon: '⛵' },
  'Z': { word: 'Zebra', icon: '🦓' },
  'Æ': { word: 'Æble', icon: '🍎' },
  'Ø': { word: 'Ø', icon: '🏝️' },
  'Å': { word: 'Å', icon: '🏞️' }
}


interface MemoryCard {
  id: string
  content: string
  isRevealed: boolean
  isMatched: boolean
  pairId: string
}

const MemoryGame: React.FC = () => {
  const navigate = useNavigate()
  const { type } = useParams<{ type: 'letters' | 'numbers' }>()
  const gameType = type as 'letters' | 'numbers' || 'letters'
  
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [revealedCards, setRevealedCards] = useState<MemoryCard[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [score, setScore] = useState(0)
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([])
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)
  const [isScoreNarrating, setIsScoreNarrating] = useState(false)
  
  // Character and celebration management
  const teacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  // Centralized entry audio
  useGameEntryAudio({ gameType: 'memory' })
  

  useEffect(() => {
    // Initialize teacher character
    teacher.setCharacter('owl')
    teacher.wave()
    
    // Register callback to start the game after entry audio completes
    entryAudioManager.onComplete('memory', () => {
      setEntryAudioComplete(true)
      // Memory game is ready - cards are already generated
    })
    
    // Generate cards immediately but don't show them until entry audio completes
    initializeGame()
  }, [gameType])

  const initializeGame = () => {
    // Generate 20 random items for pairs
    const sourceArray = gameType === 'letters' ? DANISH_ALPHABET : NUMBERS
    
    // Randomly select 20 items
    const shuffledSource = [...sourceArray].sort(() => Math.random() - 0.5)
    const selectedItems = shuffledSource.slice(0, 20)
    
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
    
    // Shuffle all 40 cards
    const shuffledCards = cardData.sort(() => Math.random() - 0.5)
    
    setCards(shuffledCards)
    setRevealedCards([])
    setMatchedPairs(0)
    setIsProcessing(false)
    setScore(0)
  }

  const handleCardClick = async (clickedCard: MemoryCard) => {
    // Handle matched cards differently - they should speak "X som word" when clicked
    if (clickedCard.isMatched && gameType === 'letters') {
      const letterData = LETTER_ICONS[clickedCard.content]
      if (letterData) {
        try {
          await audioManager.speak(`${clickedCard.content} som ${letterData.word}`)
        } catch (error: any) {
          // Ignore audio errors for matched card clicks
        }
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
        if (gameType === 'letters') {
          await audioManager.speak(clickedCard.content)
        } else {
          await audioManager.speakNumber(parseInt(clickedCard.content))
        }
      } catch (error: any) {
        // Check if this is a navigation interruption (expected)
        const isNavigationInterruption = error && 
          (error.message?.includes('interrupted by navigation') || 
           error.message?.includes('interrupted by user'))
        
        if (isNavigationInterruption) {
          return // Don't show prompts for expected interruptions
        }
        
        console.error('🎵 Audio error:', error)
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
        setScore(prev => prev + 1)

        // Silent match - no celebration until game complete
        teacher.celebrate()

        try {
          await audioManager.announceGameResult(true)
        } catch (error) {
          console.error('Error playing success sound:', error)
        }

        // Check if game is complete (all 20 pairs found)
        if (matchedPairs + 1 === 20) {
          celebrate('high')
          try {
            await audioManager.speak(DANISH_PHRASES.completion.memoryGameSuccess)
          } catch (error) {
            console.error('Error playing completion sound:', error)
          }
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


  const getGameTitle = () => {
    return gameType === 'letters' ? 'Hukommelsesspil - Bogstaver' : 'Hukommelsesspil - Tal'
  }

  const handleScoreClick = async () => {
    if (isScoreNarrating) return
    setIsScoreNarrating(true)
    try {
      await audioManager.announceScore(score)
    } catch (error) {
      // Ignore audio errors
    } finally {
      setIsScoreNarrating(false)
    }
  }



  return (
    <>
      <style>{flipStyles}</style>
      <Box 
        sx={{ 
          height: '100dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #f3e5f5 0%, #e8f5e8 50%, #fff3e0 100%)'
        }}
      >
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 1, minHeight: { xs: 56, sm: 60 } }}>
          <IconButton 
            onClick={() => navigate('/')}
            color="primary"
            size="medium"
            sx={{ 
              bgcolor: 'white', 
              boxShadow: 2,
              '&:hover': { boxShadow: 4 }
            }}
          >
            <ArrowBack />
          </IconButton>
          
          <Chip 
            icon={<Star />} 
            label={`Point: ${score}`} 
            color="primary" 
            onClick={handleScoreClick}
            disabled={isScoreNarrating}
            sx={{ 
              fontSize: '1rem',
              py: 0.5,
              fontWeight: 'bold',
              boxShadow: isScoreNarrating ? 0 : 1,
              cursor: isScoreNarrating ? 'default' : 'pointer',
              opacity: isScoreNarrating ? 0.6 : 1,
              '&:hover': { boxShadow: isScoreNarrating ? 0 : 2 }
            }}
          />
        </Toolbar>
      </AppBar>

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
        {/* Game Title with Teacher */}
        <Box sx={{ textAlign: 'center', mb: 0.5, flex: '0 0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 0.5 }}>
              <LottieCharacter
                character={teacher.character}
                state={teacher.state}
                size={45}
                onClick={teacher.wave}
              />
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'primary.dark',
                  fontWeight: 700,
                  fontSize: { xs: '1.1rem', md: '1.3rem' }
                }}
              >
                {getGameTitle()}
              </Typography>
              <Typography sx={{ fontSize: '1.2rem' }}>🧠</Typography>
            </Box>
            
            {/* Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
              <Button
                onClick={restartGame}
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
                sx={{ fontSize: '0.8rem', py: 0.5, px: 1.5 }}
              >
                Ny spil
              </Button>
            </Box>
          </motion.div>
        </Box>

        {/* Memory Cards Grid - 4x10 layout */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 0,
          overflow: 'hidden',
          p: { xs: 0.5, sm: 1, md: 1.5 },
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
            {entryAudioComplete && cards.length > 0 ? cards.map((card, index) => (
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
                        borderColor: '#9c27b0',
                        background: 'linear-gradient(135deg, #9c27b0 0%, #2196f3 100%)'
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
                            fontSize: 'clamp(1.2rem, 3.5vw, 2rem)',
                            fontWeight: 'bold',
                            color: 'white',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            fontFamily: 'Comic Sans MS, Arial'
                          }}>
                            {gameType === 'letters' ? 'ABC' : '123'}
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
                        borderColor: card.isMatched ? '#4caf50' : '#1976d2',
                        background: card.isMatched ? '#e8f5e8' : 'white'
                      }}
                    >
                      {gameType === 'letters' && LETTER_ICONS[card.content] ? (
                        <>
                          <div style={{ 
                            fontSize: 'clamp(1rem, 2.5vw, 1.8rem)',
                            fontWeight: 700,
                            color: card.isMatched ? '#2e7d32' : '#1976d2',
                            marginBottom: '2px',
                            lineHeight: 1
                          }}>
                            {card.content}
                          </div>
                          <div style={{ 
                            fontSize: 'clamp(1rem, 2.5vw, 1.6rem)', 
                            marginBottom: '1px', 
                            lineHeight: 1 
                          }}>
                            {LETTER_ICONS[card.content].icon}
                          </div>
                          <div style={{ 
                            fontSize: 'clamp(0.5rem, 1.2vw, 0.8rem)',
                            color: '#666',
                            fontWeight: 500,
                            lineHeight: 1,
                            display: window.innerWidth < 400 ? 'none' : 'block'
                          }}>
                            {LETTER_ICONS[card.content].word}
                          </div>
                        </>
                      ) : gameType === 'numbers' ? (
                        <div style={{ 
                          fontSize: 'clamp(1.2rem, 3vw, 2.5rem)',
                          fontWeight: 700,
                          color: card.isMatched ? '#2e7d32' : '#1976d2',
                          lineHeight: 1
                        }}>
                          {card.content}
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
                          fontWeight: 700,
                          color: card.isMatched ? '#2e7d32' : '#1976d2'
                        }}>
                          {card.content}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )) : null}
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

export default MemoryGame