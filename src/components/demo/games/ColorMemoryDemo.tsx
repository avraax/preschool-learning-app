import React, { useState, useEffect } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { motion } from 'framer-motion'
import { useAudio } from '../../../hooks/useAudio'

// Working CSS for card flip animation (same as main memory game)
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
`

interface ColorMemoryCard {
  id: string
  content: string
  color: string
  colorName: string
  isRevealed: boolean
  isMatched: boolean
  pairId: string
}

interface ColorMemoryDemoProps {}

const ColorMemoryDemo: React.FC<ColorMemoryDemoProps> = () => {
  // Centralized audio system
  const audio = useAudio({ componentId: 'ColorMemoryDemo' })
  
  const [cards, setCards] = useState<ColorMemoryCard[]>([])
  const [revealedCards, setRevealedCards] = useState<ColorMemoryCard[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [score, setScore] = useState(0)
  const [wrongPairIds, setWrongPairIds] = useState<string[]>([])

  // 20 different colors for 40 cards (20 pairs)
  const colorData = [
    { color: '#EF4444', name: 'rød' },
    { color: '#F97316', name: 'orange' },
    { color: '#FDE047', name: 'gul' },
    { color: '#84CC16', name: 'lime' },
    { color: '#10B981', name: 'grøn' },
    { color: '#06B6D4', name: 'turkis' },
    { color: '#3B82F6', name: 'blå' },
    { color: '#6366F1', name: 'indigo' },
    { color: '#8B5CF6', name: 'lilla' },
    { color: '#EC4899', name: 'lyserød' },
    { color: '#F59E0B', name: 'gylden' },
    { color: '#14B8A6', name: 'teal' },
    { color: '#DC2626', name: 'mørk rød' },
    { color: '#EA580C', name: 'mørk orange' },
    { color: '#CA8A04', name: 'mørk gul' },
    { color: '#16A34A', name: 'mørk grøn' },
    { color: '#0891B2', name: 'mørk turkis' },
    { color: '#1D4ED8', name: 'mørk blå' },
    { color: '#7C3AED', name: 'mørk lilla' },
    { color: '#BE185D', name: 'mørk rosa' }
  ]

  useEffect(() => {
    // Add styles to document
    const styleElement = document.createElement('style')
    styleElement.innerHTML = flipStyles
    document.head.appendChild(styleElement)

    initializeGame()

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  const initializeGame = () => {
    // Create 40 cards (20 pairs) - exactly like main memory game
    const cardData: ColorMemoryCard[] = []
    
    colorData.forEach((colorInfo, index) => {
      const pairId = `pair-${index}`
      
      // First card of the pair
      cardData.push({
        id: `${colorInfo.name}-1`,
        content: colorInfo.name,
        color: colorInfo.color,
        colorName: colorInfo.name,
        isRevealed: false,
        isMatched: false,
        pairId
      })
      
      // Second card of the pair
      cardData.push({
        id: `${colorInfo.name}-2`,
        content: colorInfo.name,
        color: colorInfo.color,
        colorName: colorInfo.name,
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
    setWrongPairIds([])
  }

  const handleCardClick = async (clickedCard: ColorMemoryCard) => {
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

    // Play audio for the revealed card
    try {
      await audio.speak(clickedCard.colorName)
    } catch (error) {
      console.error('Audio error:', error)
    }

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

        try {
          await audio.playSuccessSound()
          await audio.speakGameCompletionCelebration()
        } catch (error) {
          console.error('Error playing success sound:', error)
        }

        // Check if game is complete (all 20 pairs found)
        if (matchedPairs + 1 === 20) {
          try {
            await audio.speakSpecificGameCompletion('memory')
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

        try {
          await audio.speak('Prøv igen!')
        } catch (error) {
          console.error('Error playing try again sound:', error)
        }
      }

      // Reset revealed cards for next turn
      setRevealedCards([])
      setIsProcessing(false)
    }
  }

  return (
    <>
      <style>{flipStyles}</style>
      <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
            Farve Hukommelse
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
            <Typography variant="h6">
              Match: {matchedPairs}/20
            </Typography>
            <Typography variant="h6">
              Point: {score}
            </Typography>
          </Box>
        </Box>

        {/* Game grid - 4x10 layout like main memory game */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 0,
          overflow: 'hidden',
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
            {cards.map((card, index) => (
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
                  style={{ height: '100%' }}
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
                            🎨
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
                        background: card.isMatched ? '#e8f5e8' : card.color
                      }}
                    >
                      {/* Color square with white border */}
                      <Box sx={{ 
                        width: '80%', 
                        height: '80%', 
                        bgcolor: card.color,
                        borderRadius: 2,
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Typography sx={{ 
                          fontSize: 'clamp(0.6rem, 1.5vw, 1rem)',
                          color: 'white',
                          fontWeight: 700,
                          textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                          textAlign: 'center',
                          lineHeight: 1
                        }}>
                          {card.colorName}
                        </Typography>
                      </Box>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </Box>
        </Box>

        {/* Game complete message */}
        {matchedPairs === 20 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Typography variant="h4" color="success.main" sx={{ mb: 2 }}>
                🎉 Tillykke! Alle par fundet! 🎉
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
                Du fandt alle {matchedPairs} par!
              </Typography>
            </motion.div>
          </Box>
        )}

        {/* Controls */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button variant="contained" onClick={initializeGame} color="primary">
            Ny spil
          </Button>
        </Box>
      </Box>
    </>
  )
}

export default ColorMemoryDemo