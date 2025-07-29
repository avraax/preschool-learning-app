import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Container, Chip } from '@mui/material'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, rectIntersection } from '@dnd-kit/core'
import { audioManager } from '../../../utils/audio'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'

// Game item interface
interface GameItem {
  id: string
  colorName: string
  label: string
  hex: string
  isTarget: boolean
  collected: boolean
  returning: boolean
  x: number
  y: number
}

const ColorHunt2Demo: React.FC = () => {
  // Game state
  const [gameItems, setGameItems] = useState<GameItem[]>([])
  const [score, setScore] = useState(0)
  const [totalRed, setTotalRed] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const hasInitialized = React.useRef(false)

  // Initialize game items with positions
  useEffect(() => {
    // Fix dual audio issue
    if (hasInitialized.current) return
    
    hasInitialized.current = true
    
    const items: GameItem[] = [
      // Red items (targets)
      { id: 'item-1', colorName: 'rød', label: 'Rød æble', hex: '#dc2626', isTarget: true, collected: false, returning: false, x: 10, y: 20 },
      { id: 'item-2', colorName: 'rød', label: 'Rød bil', hex: '#ef4444', isTarget: true, collected: false, returning: false, x: 80, y: 15 },
      { id: 'item-3', colorName: 'rød', label: 'Rød blomst', hex: '#f87171', isTarget: true, collected: false, returning: false, x: 15, y: 70 },
      { id: 'item-4', colorName: 'rød', label: 'Rød bold', hex: '#b91c1c', isTarget: true, collected: false, returning: false, x: 75, y: 75 },
      { id: 'item-5', colorName: 'rød', label: 'Rød hat', hex: '#991b1b', isTarget: true, collected: false, returning: false, x: 5, y: 45 },
      // Non-red items (distractors)
      { id: 'item-6', colorName: 'blå', label: 'Blå himmel', hex: '#3b82f6', isTarget: false, collected: false, returning: false, x: 85, y: 45 },
      { id: 'item-7', colorName: 'grøn', label: 'Grøn græs', hex: '#22c55e', isTarget: false, collected: false, returning: false, x: 30, y: 10 },
      { id: 'item-8', colorName: 'gul', label: 'Gul sol', hex: '#eab308', isTarget: false, collected: false, returning: false, x: 60, y: 10 },
      { id: 'item-9', colorName: 'lilla', label: 'Lilla druer', hex: '#a855f7', isTarget: false, collected: false, returning: false, x: 25, y: 80 },
      { id: 'item-10', colorName: 'orange', label: 'Orange frugt', hex: '#f97316', isTarget: false, collected: false, returning: false, x: 65, y: 85 },
    ]

    setGameItems(items)
    setTotalRed(items.filter(item => item.isTarget).length)
    
    // Welcome message with delay to avoid conflicts
    setTimeout(() => {
      audioManager.speak('Velkommen til farve jagt! Find alle de røde ting og træk dem til cirklen.')
    }, 1000)
  }, [])

  // Check for game completion
  useEffect(() => {
    if (score > 0 && score === totalRed && !isComplete) {
      setIsComplete(true)
      setTimeout(() => {
        audioManager.speak('Godt klaret! Du fandt alle de røde ting!')
      }, 300)
    }
  }, [score, totalRed, isComplete])

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    const draggedItem = gameItems.find(item => item.id === active.id)
    if (!draggedItem || draggedItem.collected) return

    // Check if dropped on the target circle
    if (over && over.id === 'target-zone') {
      if (draggedItem.isTarget) {
        // Correct item - collect it and move to center
        setGameItems(prev => prev.map(item =>
          item.id === active.id ? { 
            ...item, 
            collected: true,
            x: 50, // Move to center of circle
            y: 50
          } : item
        ))
        setScore(prev => prev + 1)
        audioManager.speak(`Flot! ${draggedItem.label} er rød.`)
      } else {
        // Wrong item - bounce it back to original position
        setGameItems(prev => prev.map(item =>
          item.id === active.id ? { ...item, returning: true } : item
        ))
        audioManager.speak(`Nej, ${draggedItem.label} er ${draggedItem.colorName}, ikke rød.`)
        
        // Reset returning state after animation
        setTimeout(() => {
          setGameItems(prev => prev.map(item =>
            item.id === active.id ? { ...item, returning: false } : item
          ))
        }, 500)
      }
    }
    // Items dropped outside target zone automatically return to original position
  }

  // Reset game
  const resetGame = () => {
    // Reset to original positions
    const items: GameItem[] = [
      { id: 'item-1', colorName: 'rød', label: 'Rød æble', hex: '#dc2626', isTarget: true, collected: false, returning: false, x: 10, y: 20 },
      { id: 'item-2', colorName: 'rød', label: 'Rød bil', hex: '#ef4444', isTarget: true, collected: false, returning: false, x: 80, y: 15 },
      { id: 'item-3', colorName: 'rød', label: 'Rød blomst', hex: '#f87171', isTarget: true, collected: false, returning: false, x: 15, y: 70 },
      { id: 'item-4', colorName: 'rød', label: 'Rød bold', hex: '#b91c1c', isTarget: true, collected: false, returning: false, x: 75, y: 75 },
      { id: 'item-5', colorName: 'rød', label: 'Rød hat', hex: '#991b1b', isTarget: true, collected: false, returning: false, x: 5, y: 45 },
      { id: 'item-6', colorName: 'blå', label: 'Blå himmel', hex: '#3b82f6', isTarget: false, collected: false, returning: false, x: 85, y: 45 },
      { id: 'item-7', colorName: 'grøn', label: 'Grøn græs', hex: '#22c55e', isTarget: false, collected: false, returning: false, x: 30, y: 10 },
      { id: 'item-8', colorName: 'gul', label: 'Gul sol', hex: '#eab308', isTarget: false, collected: false, returning: false, x: 60, y: 10 },
      { id: 'item-9', colorName: 'lilla', label: 'Lilla druer', hex: '#a855f7', isTarget: false, collected: false, returning: false, x: 25, y: 80 },
      { id: 'item-10', colorName: 'orange', label: 'Orange frugt', hex: '#f97316', isTarget: false, collected: false, returning: false, x: 65, y: 85 },
    ]
    
    setGameItems(items)
    setScore(0)
    setIsComplete(false)
    audioManager.speak('Nyt spil! Find alle de røde ting.')
  }

  const activeItem = gameItems.find(item => item.id === activeId)

  return (
    <Container sx={{ height: '100%', display: 'flex', flexDirection: 'column', py: 2 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
          Farve Jagt 2
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', mb: 2 }}>
          <Chip 
            label={`Score: ${score}/${totalRed}`} 
            color={isComplete ? 'success' : 'primary'}
            sx={{ fontSize: '1.1rem', py: 2 }}
          />
          <Button variant="contained" onClick={resetGame} size="small">
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
          collisionDetection={rectIntersection}
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
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <DroppableZone
              id="target-zone"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '4px dashed #dc2626',
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
              }}
            >
              <Typography 
                variant="body1" 
                sx={{ 
                  color: '#dc2626', 
                  fontWeight: 'bold',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}
              >
                Træk røde ting hertil
              </Typography>
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
                  variant="caption" 
                  sx={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    padding: '4px'
                  }}
                >
                  {item.label}
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
              backgroundColor: 'rgba(34, 197, 94, 0.9)',
              color: 'white',
              padding: 3,
              borderRadius: 2,
              textAlign: 'center',
              zIndex: 20,
              animation: 'fadeIn 0.5s ease-in'
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              🎉 Fantastisk! 🎉
            </Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>
              Du fandt alle de røde ting!
            </Typography>
          </Box>
        )}
      </Box>

      {/* Instructions */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Træk alle de røde ting til cirklen i midten
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
  )
}

export default ColorHunt2Demo