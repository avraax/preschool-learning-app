import React, { useState, useRef } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, closestCenter, DragEndEvent, DragOverlay, Active } from '@dnd-kit/core'
import { audioManager } from '../../../utils/audio'
import { DANISH_PHRASES, getRandomCorrectItemPhrase } from '../../../config/danish-phrases'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'

interface ColorHuntDemoProps {}

interface ColorItem {
  id: string
  color: string
  name: string
  x: number
  y: number
  colorHex: string
  isCollected: boolean
  originalX: number
  originalY: number
  isBouncing?: boolean
}

const ColorHuntDemo: React.FC<ColorHuntDemoProps> = () => {
  const [targetColor] = useState('rød')
  const [items, setItems] = useState<ColorItem[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const hasInitialized = useRef(false)

  // Enhanced red nuances challenge
  const initialItems: ColorItem[] = [
    { id: '1', color: 'rød', name: 'mørk rød æble', x: 15, y: 25, colorHex: '#DC2626', isCollected: false, originalX: 15, originalY: 25 },
    { id: '2', color: 'rød', name: 'lyserød blomst', x: 55, y: 35, colorHex: '#F87171', isCollected: false, originalX: 55, originalY: 35 },
    { id: '3', color: 'rød', name: 'rød tomat', x: 30, y: 55, colorHex: '#EF4444', isCollected: false, originalX: 30, originalY: 55 },
    { id: '4', color: 'rød', name: 'orange-rød peber', x: 75, y: 20, colorHex: '#F97316', isCollected: false, originalX: 75, originalY: 20 },
    { id: '5', color: 'rød', name: 'lyserød kage', x: 10, y: 75, colorHex: '#EC4899', isCollected: false, originalX: 10, originalY: 75 },
    { id: '6', color: 'rød', name: 'bordeaux vin', x: 20, y: 45, colorHex: '#991B1B', isCollected: false, originalX: 20, originalY: 45 },
    { id: '7', color: 'rød', name: 'rød jordbær', x: 65, y: 60, colorHex: '#EF4444', isCollected: false, originalX: 65, originalY: 60 },
    { id: '8', color: 'rød', name: 'crimson hjerte', x: 45, y: 25, colorHex: '#DC143C', isCollected: false, originalX: 45, originalY: 25 },
    // Non-red items as distractors
    { id: '9', color: 'gul', name: 'gul banan', x: 85, y: 45, colorHex: '#FDE047', isCollected: false, originalX: 85, originalY: 45 },
    { id: '10', color: 'blå', name: 'blå kop', x: 70, y: 80, colorHex: '#3B82F6', isCollected: false, originalX: 70, originalY: 80 },
    { id: '11', color: 'grøn', name: 'grøn blad', x: 40, y: 10, colorHex: '#10B981', isCollected: false, originalX: 40, originalY: 10 },
    { id: '12', color: 'lilla', name: 'lilla blomst', x: 85, y: 75, colorHex: '#A855F7', isCollected: false, originalX: 85, originalY: 75 }
  ]

  const targetArea = { x: 350, y: 150, width: 200, height: 200 }

  React.useEffect(() => {
    if (hasInitialized.current) return
    
    hasInitialized.current = true
    setItems(initialItems)
    
    // Play welcome audio with delay to avoid conflicts
    setTimeout(() => {
      audioManager.speak('Find alle røde ting og træk dem til cirklen!')
    }, 1000)
  }, [])

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    const item = items.find(i => i.id === active.id)
    if (!item || item.isCollected) return

    // Check if dropped on the target circle
    if (over && over.id === 'red-circle') {
      if (item.color === targetColor) {
        // Correct item - collect it
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, isCollected: true } : i
        ))
        
        const successPhrase = getRandomCorrectItemPhrase()
        await audioManager.speak(`${successPhrase}. ${item.name}`)
        
        // Check if all red items are collected
        const redItems = items.filter(i => i.color === targetColor)
        const collectedRedItems = items.filter(i => i.color === targetColor && i.isCollected).length
        
        if (collectedRedItems + 1 === redItems.length) {
          setTimeout(async () => {
            setShowFeedback(true)
            await audioManager.speak(DANISH_PHRASES.colorGames.allItemsFound)
            
            setTimeout(() => {
              setShowFeedback(false)
              restartGame()
            }, 3000)
          }, 500)
        }
      } else {
        // Wrong item - bounce back
        audioManager.speak(`Nej, ${item.name} er ikke rød. Prøv igen!`)
        
        // Trigger bounce animation
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, isBouncing: true } : i
        ))
        
        // Reset bounce state after animation
        setTimeout(() => {
          setItems(prev => prev.map(i => 
            i.id === item.id ? { ...i, isBouncing: false } : i
          ))
        }, 600)
      }
    }
  }

  const restartGame = async () => {
    setItems(initialItems.map(item => ({ ...item, isCollected: false, x: item.originalX, y: item.originalY })))
    await audioManager.speak('Nyt spil! Find alle røde ting!')
  }

  const startGame = async () => {
    await audioManager.speak('Find alle røde ting og træk dem til cirklen!')
  }

  const collectedRedItems = items.filter(i => i.color === targetColor && i.isCollected).length
  const totalRedItems = items.filter(i => i.color === targetColor).length
  const activeItem = items.find(i => i.id === activeId)

  return (
    <Box sx={{ 
      height: '100%', 
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#FFF5F5'
    }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Rød Nuancer - Saml alle røde ting
        </Typography>
        
        <Paper 
          elevation={3}
          sx={{ 
            display: 'inline-block',
            p: 2,
            bgcolor: 'white',
            border: '3px solid #333',
            mb: 2
          }}
        >
          <Typography variant="h6" sx={{ color: '#333', textAlign: 'center' }}>
            Samlede røde ting: {collectedRedItems}/{totalRedItems}
          </Typography>
        </Paper>
        
        <Button 
          variant="contained" 
          onClick={startGame}
          sx={{ mt: 2, mr: 2 }}
        >
          🔊 Hør opgaven
        </Button>
        
        <Button 
          variant="outlined" 
          onClick={restartGame}
          sx={{ mt: 2 }}
        >
          🔄 Start forfra
        </Button>
      </Box>

      {/* Game Area */}
      <Box 
        sx={{ 
          flex: 1,
          position: 'relative',
          bgcolor: 'white',
          borderRadius: 4,
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
          {/* Target circle */}
          <DroppableZone
            id="red-circle"
            style={{
              position: 'absolute',
              left: targetArea.x,
              top: targetArea.y,
              width: targetArea.width,
              height: targetArea.height,
              border: '3px dashed #DC2626',
              borderRadius: '50%',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              pointerEvents: 'none'
            }}
          >
            <Typography variant="h6" color="#DC2626" sx={{ textAlign: 'center', fontWeight: 700 }}>
              Træk røde ting hertil
            </Typography>
          </DroppableZone>

          {/* Draggable items */}
          {items.map((item) => (
            <DraggableItem
              key={item.id}
              id={item.id}
              disabled={item.isCollected || item.isBouncing}
              position={{ x: item.x, y: item.y }}
              data={item}
            >
              <Box
                sx={{
                  width: 70,
                  height: 70,
                  bgcolor: item.colorHex,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: item.isCollected ? 1 : 3,
                  border: item.isCollected ? '3px solid #10B981' : '2px solid white',
                  color: 'white',
                  fontWeight: 700,
                  opacity: item.isCollected ? 0.8 : 1,
                  transform: 'translate(-50%, -50%)',
                  transition: item.isBouncing ? 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'all 0.2s ease',
                  animation: item.isBouncing ? 'bounce-back 0.6s ease-out' : 'none'
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block' }}>
                    {item.name.split(' ')[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    {item.name.split(' ').slice(1).join(' ')}
                  </Typography>
                </Box>
              </Box>
            </DraggableItem>
          ))}

          {/* Drag overlay */}
          <DragOverlay>
            {activeItem ? (
              <Box
                sx={{
                  width: 70,
                  height: 70,
                  bgcolor: activeItem.colorHex,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: 5,
                  border: '2px solid white',
                  color: 'white',
                  fontWeight: 700,
                  transform: 'scale(1.1)',
                  cursor: 'grabbing'
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block' }}>
                    {activeItem.name.split(' ')[0]}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                    {activeItem.name.split(' ').slice(1).join(' ')}
                  </Typography>
                </Box>
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Success Feedback */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 100
              }}
            >
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  bgcolor: 'success.main',
                  color: 'white',
                  textAlign: 'center',
                  borderRadius: 4
                }}
              >
                <Typography variant="h2" sx={{ mb: 2 }}>
                  🎉
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  Fantastisk!
                </Typography>
                <Typography variant="h5" sx={{ mt: 1 }}>
                  Du fandt alle røde ting!
                </Typography>
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      {/* Info */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Træk de røde ting til cirklen. Forkerte farver hopper tilbage!
        </Typography>
      </Box>

      <style>
        {`
          @keyframes bounce-back {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(0.8); }
            100% { transform: translate(-50%, -50%) scale(1); }
          }
        `}
      </style>
    </Box>
  )
}

export default ColorHuntDemo