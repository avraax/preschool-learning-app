import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Container, Chip, AppBar, Toolbar, IconButton } from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCenter } from '@dnd-kit/core'
import { audioManager } from '../../utils/audio'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'

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
  const navigate = useNavigate()
  // Game state
  const [gameItems, setGameItems] = useState<GameItem[]>([])
  const [score, setScore] = useState(0)
  const [totalTarget, setTotalTarget] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [targetColor, setTargetColor] = useState<string>('rød')
  const [targetPhrase, setTargetPhrase] = useState<string>('Find alle røde ting')
  const hasInitialized = React.useRef(false)
  const previousColor = React.useRef<string>('')

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
    
    console.log('Generated game items:', {
      targetColor: target.color,
      totalItems: items.length,
      targetItems: items.filter(item => item.isTarget).length,
      itemBreakdown: items.map(item => ({
        id: item.id,
        colorName: item.colorName,
        isTarget: item.isTarget,
        emoji: item.emoji
      }))
    })
    
    return { items, targetCount: selectedTargets.length, targetColor: target.color, targetPhrase: target.phrase }
  }

  // Initialize game
  useEffect(() => {
    if (hasInitialized.current) return
    
    hasInitialized.current = true
    const { items, targetCount, targetColor: newTargetColor, targetPhrase: newTargetPhrase } = generateGameItems()
    
    setGameItems(items)
    setTotalTarget(targetCount)
    setTargetColor(newTargetColor)
    setTargetPhrase(newTargetPhrase)
    
    // Welcome message with delay - use the actual selected target
    setTimeout(() => {
      try {
        audioManager.speak(`Velkommen til farve jagt! ${newTargetPhrase} og træk dem til cirklen.`)
          .catch(error => {
            console.log('Audio error (welcome):', error)
            audioManager.reset?.()
          })
      } catch (error) {
        console.log('Audio error (welcome):', error)
        audioManager.reset?.()
      }
    }, 1000)
  }, [])

  // Check for game completion
  useEffect(() => {
    if (score > 0 && score === totalTarget && !isComplete) {
      setIsComplete(true)
      setTimeout(() => {
        try {
          audioManager.speak(`Fantastisk! Du fandt alle de ${targetColor} ting!`)
            .catch(error => {
              console.log('Audio error (completion):', error)
              audioManager.reset?.()
            })
        } catch (error) {
          console.log('Audio error (completion):', error)
          audioManager.reset?.()
        }
      }, 300)
    }
  }, [score, totalTarget, isComplete, targetColor])

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    console.log('=== DRAG END EVENT START ===')
    const { active, over } = event
    
    console.log('1. Event details:', {
      activeId: active.id,
      overId: over?.id,
      overData: over?.data?.current
    })
    
    setActiveId(null)

    const draggedItem = gameItems.find(item => item.id === active.id)
    
    console.log('2. Dragged item lookup:', {
      activeId: active.id,
      foundItem: draggedItem,
      itemExists: !!draggedItem,
      itemCollected: draggedItem?.collected
    })
    
    if (!draggedItem || draggedItem.collected) {
      console.log('3. EARLY RETURN - no item or already collected')
      return
    }

    // Debug logging for tracking game state issues
    console.log('3. Item validation passed - processing drop:', {
      itemId: draggedItem.id,
      itemColor: draggedItem.colorName,
      targetColor: targetColor,
      isTarget: draggedItem.isTarget,
      collected: draggedItem.collected,
      overZone: over?.id,
      colorMatch: draggedItem.colorName === targetColor
    })

    // Check if dropped on the target circle
    if (over && over.id === 'target-zone') {
      console.log('4. DROPPED ON TARGET ZONE - analyzing item:', {
        itemId: draggedItem.id,
        isTarget: draggedItem.isTarget,
        colorName: draggedItem.colorName,
        targetColor: targetColor,
        collected: draggedItem.collected,
        shouldBeCorrect: draggedItem.colorName === targetColor
      })
      
      if (draggedItem.isTarget) {
        console.log('5. ✅ CORRECT ITEM PATH - collecting item')
        
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
          console.log('6. Updated game items state (correct):', updated.find(item => item.id === active.id))
          return updated
        })
        
        setScore(prev => {
          const newScore = prev + 1
          console.log('7. Updated score:', newScore)
          return newScore
        })
        
        // Play success audio with enhanced error handling
        console.log('8. Playing success audio...')
        setTimeout(() => {
          try {
            audioManager.speak(`Flot! ${draggedItem.objectNameDefinite} er ${draggedItem.colorName}.`)
              .catch(error => {
                console.log('Audio error (correct item):', error)
                // Attempt to reset audio on error
                audioManager.reset?.()
              })
          } catch (error) {
            console.log('Audio error (correct item):', error)
            // Attempt to reset audio on error
            audioManager.reset?.()
          }
        }, 200)
      } else {
        console.log('5. ❌ WRONG ITEM PATH - bouncing back')
        
        // Wrong item - bounce it back to original position
        setGameItems(prev => {
          const updated = prev.map(item =>
            item.id === active.id ? { ...item, returning: true } : item
          )
          console.log('6. Updated game items state (wrong):', updated.find(item => item.id === active.id))
          return updated
        })
        
        // Play error audio with enhanced error handling
        console.log('7. Playing error audio...')
        setTimeout(() => {
          try {
            audioManager.speak(`Nej, ${draggedItem.objectNameDefinite} er ${draggedItem.colorName}, ikke ${targetColor}.`)
              .catch(error => {
                console.log('Audio error (wrong item):', error)
                // Attempt to reset audio on error
                audioManager.reset?.()
              })
          } catch (error) {
            console.log('Audio error (wrong item):', error)
            // Attempt to reset audio on error
            audioManager.reset?.()
          }
        }, 200)
        
        // Reset returning state after animation
        setTimeout(() => {
          setGameItems(prev => prev.map(item =>
            item.id === active.id ? { ...item, returning: false } : item
          ))
        }, 500)
      }
    } else {
      console.log('4. NOT DROPPED ON TARGET ZONE - dropped elsewhere')
      console.log('   Over zone:', over?.id || 'none')
    }
    console.log('=== DRAG END EVENT COMPLETE ===')
    // Items dropped outside target zone automatically return to original position
  }

  // Reset game with new random setup
  const resetGame = () => {
    const { items, targetCount, targetColor: newTargetColor, targetPhrase: newTargetPhrase } = generateGameItems()
    
    setGameItems(items)
    setTotalTarget(targetCount)
    setTargetColor(newTargetColor)
    setTargetPhrase(newTargetPhrase)
    setScore(0)
    setIsComplete(false)
    
    setTimeout(() => {
      try {
        audioManager.speak(`Nyt spil! ${newTargetPhrase} og træk dem til cirklen.`)
          .catch(error => {
            console.log('Audio error (reset):', error)
            audioManager.reset?.()
          })
      } catch (error) {
        console.log('Audio error (reset):', error)
        audioManager.reset?.()
      }
    }, 500)
  }

  const activeItem = gameItems.find(item => item.id === activeId)

  return (
    <Box sx={{ 
      minHeight: 'calc(var(--vh, 1vh) * 100)',
      background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 50%, #FFCC80 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* App Bar */}
      <AppBar 
        position="static" 
        color="transparent" 
        elevation={0}
        sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <Toolbar>
          <IconButton 
            edge="start" 
            onClick={() => navigate('/farver')}
            sx={{ 
              mr: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ 
            flexGrow: 1,
            fontWeight: 700,
            color: '#E65100'
          }}>
            Farvejagt
          </Typography>
        </Toolbar>
      </AppBar>

      <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 2 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: '#E65100' }}>
            Farvejagt
          </Typography>
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
            onClick={resetGame} 
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
          minHeight: 400
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
              disabled={item.collected || item.returning}
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

        {/* Completion message */}
        {isComplete && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: `${getTargetColorHex()}E6`, // Add transparency to target color
              color: 'white',
              padding: 3,
              borderRadius: 2,
              textAlign: 'center',
              zIndex: 20,
              animation: 'fadeIn 0.5s ease-in',
              boxShadow: 3
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              🎉 Fantastisk! 🎉
            </Typography>
            <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
              Du fandt alle de {targetColor} ting!
            </Typography>
            <Button
              variant="contained"
              onClick={resetGame}
              sx={{
                backgroundColor: 'white',
                color: getTargetColorHex(),
                fontWeight: 'bold',
                px: 3,
                py: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  transform: 'scale(1.05)'
                }
              }}
            >
              Nyt Spil 🚀
            </Button>
          </Box>
        )}
      </Box>

      {/* Instructions */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Træk alle de {targetColor} ting til cirklen i midten
        </Typography>
      </Box>

      {/* CSS animations */}
      <style>
        {`
          @keyframes shake {
            0%, 100% { transform: translate(-50%, -50%) translateX(0); }
            25% { transform: translate(-50%, -50%) translateX(-10px) rotate(-5deg); }
            75% { transform: translate(-50%, -50%) translateX(10px) rotate(5deg); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
        `}
      </style>
      </Container>
    </Box>
  )
}

export default FarvejagtGame