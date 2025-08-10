import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Container, Chip } from '@mui/material'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCenter } from '@dnd-kit/core'
import { categoryThemes } from '../../config/categoryThemes'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { ColorRepeatButton } from '../common/RepeatButton'
import { ColorScoreChip } from '../common/ScoreChip'
import { useGameState } from '../../hooks/useGameState'
import GameHeader from '../common/GameHeader'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Game item interface
interface GameItem {
  id: string
  colorName: string
  objectName: string
  objectNameDefinite: string
  emoji: string
  hex: string
  isTarget: boolean
  collected: boolean
  returning: boolean
  x: number
  y: number
}

// Danish object database
const DANISH_OBJECTS = {
  rød: [
    { objectName: 'æble', objectNameDefinite: 'æblet', emoji: '🍎', hex: '#dc2626' },
    { objectName: 'bil', objectNameDefinite: 'bilen', emoji: '🚗', hex: '#ef4444' },
    { objectName: 'rose', objectNameDefinite: 'rosen', emoji: '🌹', hex: '#f87171' },
    { objectName: 'bold', objectNameDefinite: 'bolden', emoji: '⚽', hex: '#b91c1c' },
    { objectName: 'jordbær', objectNameDefinite: 'jordbæret', emoji: '🍓', hex: '#991b1b' },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', emoji: '❤️', hex: '#dc2626' },
    { objectName: 'hat', objectNameDefinite: 'hatten', emoji: '👒', hex: '#ef4444' }
  ],
  blå: [
    { objectName: 'hav', objectNameDefinite: 'havet', emoji: '🌊', hex: '#3b82f6' },
    { objectName: 'lastbil', objectNameDefinite: 'lastbilen', emoji: '🚙', hex: '#2563eb' },
    { objectName: 'hval', objectNameDefinite: 'hvalen', emoji: '🐳', hex: '#1d4ed8' },
    { objectName: 'skjorte', objectNameDefinite: 'skjorten', emoji: '👔', hex: '#1e40af' },
    { objectName: 'blåbær', objectNameDefinite: 'blåbæret', emoji: '🫐', hex: '#3730a3' },
    { objectName: 'himmel', objectNameDefinite: 'himlen', emoji: '☁️', hex: '#60a5fa' }
  ],
  grøn: [
    { objectName: 'blad', objectNameDefinite: 'bladet', emoji: '🌿', hex: '#22c55e' },
    { objectName: 'agurk', objectNameDefinite: 'agurken', emoji: '🥒', hex: '#16a34a' },
    { objectName: 'skildpadde', objectNameDefinite: 'skildpadden', emoji: '🐢', hex: '#15803d' },
    { objectName: 'kløver', objectNameDefinite: 'kløveren', emoji: '🍀', hex: '#166534' },
    { objectName: 'træ', objectNameDefinite: 'træet', emoji: '🌳', hex: '#14532d' },
    { objectName: 'salat', objectNameDefinite: 'salaten', emoji: '🥬', hex: '#22c55e' }
  ],
  gul: [
    { objectName: 'sol', objectNameDefinite: 'solen', emoji: '☀️', hex: '#eab308' },
    { objectName: 'banan', objectNameDefinite: 'bananen', emoji: '🍌', hex: '#facc15' },
    { objectName: 'majs', objectNameDefinite: 'majsen', emoji: '🌽', hex: '#fde047' },
    { objectName: 'stjerne', objectNameDefinite: 'stjernen', emoji: '⭐', hex: '#f59e0b' },
    { objectName: 'smør', objectNameDefinite: 'smørret', emoji: '🧈', hex: '#fbbf24' },
    { objectName: 'kylling', objectNameDefinite: 'kyllingen', emoji: '🐥', hex: '#f97316' }
  ],
  lilla: [
    { objectName: 'druer', objectNameDefinite: 'druerne', emoji: '🍇', hex: '#a855f7' },
    { objectName: 'aubergine', objectNameDefinite: 'auberginen', emoji: '🍆', hex: '#9333ea' },
    { objectName: 'krystal', objectNameDefinite: 'krystallet', emoji: '🔮', hex: '#7c3aed' },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', emoji: '💜', hex: '#8b5cf6' },
    { objectName: 'blomst', objectNameDefinite: 'blomsten', emoji: '🌸', hex: '#a855f7' }
  ],
  orange: [
    { objectName: 'appelsin', objectNameDefinite: 'appelsinen', emoji: '🍊', hex: '#f97316' },
    { objectName: 'græskar', objectNameDefinite: 'græskaret', emoji: '🎃', hex: '#ea580c' },
    { objectName: 'ræv', objectNameDefinite: 'ræven', emoji: '🦊', hex: '#dc2626' },
    { objectName: 'gulerod', objectNameDefinite: 'guleroden', emoji: '🥕', hex: '#f97316' },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', emoji: '🧡', hex: '#fb923c' },
    { objectName: 'fersken', objectNameDefinite: 'ferskenen', emoji: '🍑', hex: '#fdba74' }
  ]
}

// Color target options
const COLOR_TARGETS = [
  { color: 'rød', phrase: 'Find alle røde ting' },
  { color: 'blå', phrase: 'Find alle blå ting' },
  { color: 'grøn', phrase: 'Find alle grønne ting' },
  { color: 'gul', phrase: 'Find alle gule ting' },
  { color: 'lilla', phrase: 'Find alle lilla ting' },
  { color: 'orange', phrase: 'Find alle orange ting' }
]

const FarvejagtGame: React.FC = () => {
  // Game state
  const [gameItems, setGameItems] = useState<GameItem[]>([])
  const [totalTarget, setTotalTarget] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [_activeId, setActiveId] = useState<string | null>(null)
  const [targetColor, setTargetColor] = useState<string>('rød')
  const [, setTargetPhrase] = useState<string>('Find alle røde ting')
  
  // Centralized game state management
  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()
  
  // Simplified audio system
  const audio = useSimplifiedAudioHook({ 
    componentId: 'FarvejagtGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  
  // Character and celebration management
  const colorHunter = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  const hasInitialized = React.useRef(false)
  const previousColor = React.useRef<string>('')
  
  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 FarvejagtGame: ${message}`, data)
    }
  }
  
  // Game initialization function
  const initializeGame = () => {
    const { items, targetCount, targetColor: newTargetColor, targetPhrase: newTargetPhrase } = generateGameItems()
    
    setGameItems(items)
    setTotalTarget(targetCount)
    setTargetColor(newTargetColor)
    setTargetPhrase(newTargetPhrase)
    
    // Speak the target phrase after setup with iOS optimization
    const delay = isIOS() ? 100 : 300
    setTimeout(async () => {
      try {
        audio.updateUserInteraction()
        await audio.speakColorHuntInstructions(newTargetPhrase)
      } catch (error) {
        logError('Error speaking color hunt instructions', {
          phrase: newTargetPhrase,
          error: error?.toString()
        })
      }
    }, delay)
  }

  // Get target color hex for UI elements
  const getTargetColorHex = () => {
    const colorObjects = DANISH_OBJECTS[targetColor as keyof typeof DANISH_OBJECTS]
    return colorObjects?.[0]?.hex || '#dc2626'
  }

  // Random position generator avoiding center area
  const generateRandomPositions = (itemCount: number) => {
    const positions: Array<{x: number, y: number}> = []
    const centerX = 50, centerY = 50, centerRadius = 25
    const minDistance = 12
    
    for (let i = 0; i < itemCount; i++) {
      let attempts = 0
      let position: {x: number, y: number}
      
      do {
        // Generate random position with edge buffer
        position = {
          x: Math.random() * 80 + 10, // 10-90% range
          y: Math.random() * 80 + 10  // 10-90% range
        }
        attempts++
      } while (
        attempts < 50 && (
          // Avoid center circle
          Math.sqrt((position.x - centerX) ** 2 + (position.y - centerY) ** 2) < centerRadius ||
          // Avoid other items
          positions.some(pos => 
            Math.sqrt((position.x - pos.x) ** 2 + (position.y - pos.y) ** 2) < minDistance
          )
        )
      )
      
      positions.push(position)
    }
    return positions
  }

  // Select random target color (avoid consecutive repeats)  
  const selectRandomTarget = () => {
    let availableTargets = COLOR_TARGETS.filter(target => target.color !== previousColor.current)
    if (availableTargets.length === 0) availableTargets = COLOR_TARGETS
    
    const selected = availableTargets[Math.floor(Math.random() * availableTargets.length)]
    previousColor.current = selected.color
    return selected
  }

  // Generate random game items
  const generateGameItems = () => {
    const target = selectRandomTarget()
    
    // Get target objects (3-4 items)
    const targetObjects = DANISH_OBJECTS[target.color as keyof typeof DANISH_OBJECTS]
    const selectedTargets = targetObjects
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(4, targetObjects.length))
    
    // Get distractor objects (4-6 items from other colors)
    const distractorObjects: any[] = []
    const otherColors = Object.keys(DANISH_OBJECTS).filter(color => color !== target.color)
    
    otherColors.forEach(color => {
      const colorObjects = DANISH_OBJECTS[color as keyof typeof DANISH_OBJECTS]
      const selected = colorObjects
        .sort(() => Math.random() - 0.5)
        .slice(0, 1) // 1 item per other color
      distractorObjects.push(...selected.map(obj => ({ ...obj, colorName: color })))
    })
    
    // Combine and randomize positions
    const allObjects = [
      ...selectedTargets.map(obj => ({ ...obj, colorName: target.color, isTarget: true })),
      ...distractorObjects.map(obj => ({ ...obj, isTarget: false }))
    ]
    
    const positions = generateRandomPositions(allObjects.length)
    
    const items: GameItem[] = allObjects.map((obj, index) => ({
      id: `item-${index + 1}`,
      colorName: obj.colorName,
      objectName: obj.objectName,
      objectNameDefinite: obj.objectNameDefinite,
      emoji: obj.emoji,
      hex: obj.hex,
      isTarget: obj.isTarget,
      collected: false,
      returning: false,
      x: positions[index].x,
      y: positions[index].y
    }))
    
    
    return { items, targetCount: selectedTargets.length, targetColor: target.color, targetPhrase: target.phrase }
  }

  // Initialize game character
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    
    // Initialize character
    colorHunter.setCharacter('fox')
    colorHunter.wave()
    
    // Check if audio is ready
    if (audio.isAudioReady) {
      setAudioInitialized(true)
      playWelcomeAndStart()
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
      // Play the welcome message
      await audio.playGameWelcome('farvejagt')
      
      // iOS-optimized delay - increased to prevent audio overlap
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => {
        setGameReady(true)
        initializeGame()
      }, delay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      setGameReady(true)
      initializeGame()
    }
  }

  // Check for game completion and trigger celebration
  useEffect(() => {
    if (score > 0 && score === totalTarget && !isComplete) {
      setIsComplete(true)
      
      // Start celebration
      colorHunter.celebrate()
      celebrate(score > 5 ? 'high' : 'medium')
      
      // Use centralized game completion handler
      audio.handleGameCompletion({
        character: colorHunter,
        celebrate: celebrate,
        stopCelebration: stopCelebration,
        resetAction: () => {
          resetGame(true) // Automatic restart - no "Nyt spil!" prefix
        },
        completionMessage: 'Fantastisk! Du fandt alle farverne!',
        autoResetDelay: 3000
      })
    }
  }, [score, totalTarget, isComplete, targetColor, colorHunter, celebrate, stopCelebration])

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    // Cancel any ongoing audio for immediate interaction feedback
    audio.cancelCurrentAudio()
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    // Update user interaction for iOS audio compatibility
    audio.updateUserInteraction()
    
    setActiveId(null)

    const draggedItem = gameItems.find(item => item.id === active.id)
    
    
    if (!draggedItem || draggedItem.collected) {
      return
    }


    // Check if dropped on the target circle
    if (over && over.id === 'target-zone') {
      
      if (draggedItem.isTarget) {
        
        // Correct item - collect it and move to center
        setGameItems(prev => {
          const updated = prev.map(item =>
            item.id === active.id ? { 
              ...item, 
              collected: true,
              x: 50, // Move to center of circle
              y: 50
            } : item
          )
          return updated
        })
        
        incrementScore()
        
        // Play success audio using centralized pattern
        colorHunter.celebrate()
        audio.handleCompleteGameResult({
          isCorrect: true,
          character: colorHunter,
          celebrate: () => {}, // Don't start new celebration for each item
          stopCelebration: () => {},
          incrementScore: () => {}, // Already incremented above
          currentScore: score,
          nextAction: () => {
            colorHunter.wave()
          },
          explanation: `${draggedItem.objectNameDefinite} er ${draggedItem.colorName}`,
          autoAdvanceDelay: 500 // Quick transition for item collection
        })
      } else {
        
        // Wrong item - bounce it back to original position
        setGameItems(prev => {
          const updated = prev.map(item =>
            item.id === active.id ? { ...item, returning: true } : item
          )
          return updated
        })
        
        // Play error audio using centralized pattern
        colorHunter.think()
        audio.handleCompleteGameResult({
          isCorrect: false,
          character: colorHunter,
          celebrate: () => {},
          stopCelebration: () => {},
          incrementScore: () => {},
          currentScore: score,
          nextAction: () => {
            colorHunter.wave()
          },
          // correctAnswer should be number for math games, not applicable here
          explanation: `${draggedItem.objectNameDefinite} er ${draggedItem.colorName}`,
          autoAdvanceDelay: 500
        })
        
        // Reset returning state after animation
        setTimeout(() => {
          setGameItems(prev => prev.map(item =>
            item.id === active.id ? { ...item, returning: false } : item
          ))
        }, 500)
      }
    } else {
    }
    // Items dropped outside target zone automatically return to original position
  }

  // Repeat current game instructions
  const repeatInstructions = () => {
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    if (!gameReady || !targetColor) return
    
    try {
      const targetPhrase = COLOR_TARGETS.find(target => target.color === targetColor)?.phrase || 'Find alle røde ting'
      audio.speakColorHuntInstructions(targetPhrase)
        .catch(() => {})
    } catch (error) {
      // Ignore audio errors
    }
  }

  // Reset game with new random setup
  const resetGame = (isAutomatic = true) => {
    // Critical iOS fix: Update user interaction for manual resets
    if (!isAutomatic) {
      audio.updateUserInteraction()
    }
    
    const { items, targetCount, targetColor: newTargetColor, targetPhrase: newTargetPhrase } = generateGameItems()
    
    setGameItems(items)
    setTotalTarget(targetCount)
    setTargetColor(newTargetColor)
    setTargetPhrase(newTargetPhrase)
    resetScore()
    setIsComplete(false)
    
    setTimeout(() => {
      try {
        // For automatic restarts (after completion), don't say "Nyt spil!"
        // For manual restarts (button click), include "Nyt spil!"
        if (isAutomatic) {
          audio.speakColorHuntInstructions(newTargetPhrase)
            .catch(() => {})
        } else {
          audio.speakNewColorHuntGame()
            .catch(() => {})
          // Then speak the specific instructions
          setTimeout(() => {
            audio.speakColorHuntInstructions(newTargetPhrase)
              .catch(() => {})
          }, 1000)
        }
      } catch (error) {
        // Ignore audio errors on reset
      }
    }, 500)
  }

  // const activeItem = gameItems.find(item => item.id === activeId)

  return (
    <Box sx={{ 
      height: '100dvh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: categoryThemes.colors.gradient
    }}>
      <GameHeader
        title="Farvejagt"
        titleIcon="🎨"
        gameIcon="🎯"
        character={colorHunter}
        categoryTheme={categoryThemes.colors}
        backPath="/farver"
        scoreComponent={
          <ColorScoreChip
            score={score}
            disabled={isScoreNarrating}
            onClick={handleScoreClick}
          />
        }
      />

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
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', mb: 2 }}>
          <Chip 
            label={`${targetColor} ting: ${score}/${totalTarget}`} 
            sx={{ 
              fontSize: '1.1rem', 
              py: 2, 
              textTransform: 'capitalize',
              backgroundColor: getTargetColorHex(),
              color: 'white',
              fontWeight: 'bold'
            }}
          />
          <Button 
            variant="contained" 
            onClick={() => resetGame(false)} // Manual restart - include "Nyt spil!" prefix
            size="small"
            sx={{
              backgroundColor: '#6b7280',
              color: 'white',
              '&:hover': {
                backgroundColor: '#4b5563'
              }
            }}
          >
            Start forfra
          </Button>
        </Box>
        
        {/* Repeat Instructions Button */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <ColorRepeatButton 
            onClick={repeatInstructions}
            disabled={false}
            label="🎵 Hör igen"
          />
        </Box>

        {/* Game area */}
        <Box 
          sx={{ 
            flex: 1,
            position: 'relative',
            backgroundColor: '#fef3c7',
            borderRadius: 3,
            boxShadow: 3,
            overflow: 'hidden',
            minHeight: 0
          }}
        >
        <DndContext 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          collisionDetection={closestCenter}
        >
          {/* Target drop zone */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 180,
              height: 180,
              pointerEvents: 'auto',
              zIndex: 0,
            }}
          >
            <DroppableZone
              id="target-zone"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: `4px dashed ${getTargetColorHex()}`,
                backgroundColor: `${getTargetColorHex()}1A`, // 10% opacity
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
              }}
            >
            </DroppableZone>
          </div>

          {/* Game items */}
          {gameItems.map((item) => (
            <DraggableItem
              key={item.id}
              id={item.id}
              disabled={!gameReady || item.collected || item.returning}
              position={{ x: item.x, y: item.y }}
              data={item}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  backgroundColor: item.hex,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: item.collected ? 1 : 3,
                  border: item.collected ? '3px solid #4ade80' : '2px solid white',
                  opacity: item.collected ? 0.7 : 1,
                  transform: 'translate(-50%, -50%)',
                  transition: 'all 0.3s ease',
                  animation: item.returning ? 'shake 0.5s' : undefined,
                  cursor: item.collected ? 'default' : 'grab',
                  '&:hover': {
                    transform: !item.collected && !item.returning ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%)',
                  }
                }}
              >
                <Typography 
                  sx={{ 
                    fontSize: '2.5rem',
                    lineHeight: 1,
                    userSelect: 'none'
                  }}
                >
                  {item.emoji}
                </Typography>
              </Box>
            </DraggableItem>
          ))}

          {/* Drag overlay - disabled to avoid duplicates */}
          <DragOverlay>
            {null}
          </DragOverlay>
        </DndContext>

        </Box>

        {/* CSS animations */}
      <style>
        {`
          @keyframes shake {
            0%, 100% { transform: translate(-50%, -50%) translateX(0); }
            25% { transform: translate(-50%, -50%) translateX(-10px) rotate(-5deg); }
            75% { transform: translate(-50%, -50%) translateX(10px) rotate(5deg); }
          }
        `}
        </style>
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

export default FarvejagtGame