import React, { useState, useEffect } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { audioManager } from '../../../utils/audio'
import { categoryThemes } from '../../../config/categoryThemes'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { DroppableZone } from '../../common/dnd/DroppableZone'

// Game interfaces
interface ColorDroplet {
  id: string
  color: string
  colorName: string
  hex: string
  emoji: string
  isUsed: boolean
}

interface TargetColor {
  color: string
  name: string
  hex: string
}

interface GameState {
  targetColor: TargetColor
  availableColors: ColorDroplet[]
  mixingZone: ColorDroplet[]
  gameResult: 'waiting' | 'success' | 'failure' | null
  attempts: number
}

const ColorMixTargetDemo: React.FC = () => {
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    targetColor: { color: 'lilla', name: 'lilla', hex: '#A855F7' },
    availableColors: [],
    mixingZone: [],
    gameResult: null,
    attempts: 0
  })
  const [_activeId, setActiveId] = useState<string | null>(null)
  const hasInitialized = React.useRef(false)

  // Primary colors for mixing (5 colors for more gameplay options)
  const primaryColors: ColorDroplet[] = [
    { id: 'red', color: 'rød', colorName: 'rød', hex: '#EF4444', emoji: '💧', isUsed: false },
    { id: 'blue', color: 'blå', colorName: 'blå', hex: '#3B82F6', emoji: '💧', isUsed: false },
    { id: 'yellow', color: 'gul', colorName: 'gul', hex: '#FDE047', emoji: '💧', isUsed: false },
    { id: 'white', color: 'hvid', colorName: 'hvid', hex: '#F8FAFC', emoji: '💧', isUsed: false },
    { id: 'black', color: 'sort', colorName: 'sort', hex: '#1F2937', emoji: '💧', isUsed: false }
  ]

  // Possible target colors
  const possibleTargets: TargetColor[] = [
    { color: 'lilla', name: 'lilla', hex: '#A855F7' },
    { color: 'orange', name: 'orange', hex: '#F97316' },
    { color: 'grøn', name: 'grøn', hex: '#10B981' },
    { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
    { color: 'grå', name: 'grå', hex: '#9CA3AF' },
    { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' }
  ]

  // Color mixing rules
  const mixingRules: Record<string, TargetColor> = {
    'rød+blå': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
    'blå+rød': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
    'rød+gul': { color: 'orange', name: 'orange', hex: '#F97316' },
    'gul+rød': { color: 'orange', name: 'orange', hex: '#F97316' },
    'blå+gul': { color: 'grøn', name: 'grøn', hex: '#10B981' },
    'gul+blå': { color: 'grøn', name: 'grøn', hex: '#10B981' },
    'rød+hvid': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
    'hvid+rød': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
    'sort+hvid': { color: 'grå', name: 'grå', hex: '#9CA3AF' },
    'hvid+sort': { color: 'grå', name: 'grå', hex: '#9CA3AF' },
    'blå+hvid': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
    'hvid+blå': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' }
  }

  // Initialize game
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    initializeGame()
  }, [])


  const initializeGame = () => {
    // Select random target color
    const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
    console.log('🎲 Random target selected:', randomTarget)
    
    // Reset game state
    setGameState({
      targetColor: randomTarget,
      availableColors: [...primaryColors],
      mixingZone: [],
      gameResult: null,
      attempts: 0
    })

    // Delayed welcome audio to prevent dual audio
    setTimeout(() => {
      try {
        audioManager.speak(`Lav ${randomTarget.name} ved at blande to farver!`)
          .catch(error => console.log('Audio error:', error))
      } catch (error) {
        console.log('Audio error:', error)
      }
    }, 1000)
  }

  const resetGame = () => {
    initializeGame()
  }

  const addToMixingZone = (droplet: ColorDroplet) => {
    if (gameState.mixingZone.length >= 2) return

    const updatedDroplet = { ...droplet, isUsed: true }
    const newMixingZone = [...gameState.mixingZone, updatedDroplet]
    const updatedAvailableColors = gameState.availableColors.map(color =>
      color.id === droplet.id ? updatedDroplet : color
    )

    setGameState(prev => ({
      ...prev,
      availableColors: updatedAvailableColors,
      mixingZone: newMixingZone
    }))

    // Speak color name
    try {
      audioManager.speak(droplet.colorName)
        .catch(error => console.log('Audio error:', error))
    } catch (error) {
      console.log('Audio error:', error)
    }

    // If we have two colors, try mixing
    if (newMixingZone.length === 2) {
      setTimeout(() => tryMixColors(newMixingZone), 500)
    }
  }

  const tryMixColors = (colorsToMix: ColorDroplet[]) => {
    const [color1, color2] = colorsToMix
    const combinationKey = `${color1.colorName}+${color2.colorName}`
    const mixResult = mixingRules[combinationKey]

    if (mixResult && mixResult.name === gameState.targetColor.name) {
      // Success!
      setGameState(prev => ({
        ...prev,
        gameResult: 'success',
        attempts: prev.attempts + 1
      }))

      setTimeout(() => {
        try {
          audioManager.speak(`Fantastisk! Du lavede ${mixResult.name}!`)
            .catch(error => console.log('Audio error:', error))
        } catch (error) {
          console.log('Audio error:', error)
        }
      }, 500)
    } else {
      // Wrong combination
      setGameState(prev => ({
        ...prev,
        gameResult: 'failure',
        attempts: prev.attempts + 1
      }))

      setTimeout(() => {
        try {
          audioManager.speak('Næsten! Prøv igen med andre farver.')
            .catch(error => console.log('Audio error:', error))
        } catch (error) {
          console.log('Audio error:', error)
        }
      }, 500)

      // Reset after 2 seconds
      setTimeout(() => {
        const clearedColors = gameState.availableColors.map(color => ({
          ...color,
          isUsed: false
        }))

        setGameState(prev => ({
          ...prev,
          availableColors: clearedColors,
          mixingZone: [],
          gameResult: null
        }))
      }, 2000)
    }
  }


  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || over.id !== 'mixing-zone') return

    const draggedColor = gameState.availableColors.find(color => color.id === active.id)
    if (draggedColor && !draggedColor.isUsed && gameState.mixingZone.length < 2) {
      addToMixingZone(draggedColor)
    }
  }

  return (
    <Box sx={{ 
      height: '100%', 
      background: '#F5F5F5',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      p: 2
    }}>
        {/* Target Display */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{
              width: { xs: 160, md: 200 },
              height: { xs: 160, md: 200 },
              borderRadius: '50%',
              backgroundColor: gameState.targetColor.hex,
              border: '3px solid white',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              mx: 'auto',
              mb: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Typography sx={{ fontSize: { xs: '2.5rem', md: '3rem' } }}>🎨</Typography>
            </Box>
          </motion.div>
          
        </Box>

        {/* Game Area */}
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 2
        }}>
          <DndContext 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
          >
            {/* Mixing Zone */}
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <DroppableZone
                id="mixing-zone"
                style={{
                  width: window.innerWidth < 768 ? 160 : 200,
                  height: window.innerWidth < 768 ? 160 : 200,
                  borderRadius: '50%',
                  border: '4px dashed #E65100',
                  backgroundColor: gameState.mixingZone.length === 2 
                    ? (() => {
                        const [color1, color2] = gameState.mixingZone
                        const combinationKey = `${color1.colorName}+${color2.colorName}`
                        const mixResult = mixingRules[combinationKey]
                        return mixResult ? mixResult.hex : `color-mix(in srgb, ${color1.hex} 50%, ${color2.hex} 50%)`
                      })()
                    : 'rgba(255, 255, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  position: 'relative',
                  transition: 'background-color 0.3s ease'
                }}
              >
                <AnimatePresence>
                  {gameState.mixingZone.map((color, index) => (
                    <motion.div
                      key={color.id}
                      initial={{ scale: 0, rotate: 0 }}
                      animate={{ scale: 1, rotate: 360 }}
                      style={{
                        position: 'absolute',
                        left: index === 0 ? '30%' : '60%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <Box sx={{
                        width: { xs: 50, md: 60 },
                        height: { xs: 50, md: 60 },
                        borderRadius: '50% 50% 50% 0',
                        transform: 'rotate(135deg)',
                        backgroundColor: color.hex,
                        border: '2px solid #000',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                      }} />
                    </motion.div>
                  ))}
                  
                  {gameState.gameResult === 'success' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1.2 }}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <Box sx={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        backgroundColor: gameState.targetColor.hex,
                        border: '4px solid white',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Typography sx={{ fontSize: '3rem' }}>🎉</Typography>
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </DroppableZone>
            </Box>

            {/* Available Colors */}
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: { xs: 1, md: 2 },
              maxWidth: '600px',
              mx: 'auto',
              px: 1
            }}>
              {gameState.availableColors.map((color) => (
                  <motion.div
                    key={color.id}
                    initial={{ scale: 0, y: 50 }}
                    animate={{ scale: color.isUsed ? 0.7 : 1, y: 0 }}
                    whileHover={{ scale: color.isUsed ? 0.7 : 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                  <Box 
                    component="div"
                    sx={{ 
                      position: 'relative !important',
                      left: 'auto !important',
                      top: 'auto !important',
                      '& > div': {
                        position: 'relative !important',
                        left: 'auto !important',
                        top: 'auto !important'
                      }
                    }}
                  >
                    <DraggableItem
                      id={color.id}
                      disabled={color.isUsed}
                      data={color}
                    >
                    <Box sx={{
                      width: { xs: '60px', md: '70px' },
                      height: { xs: '60px', md: '70px' },
                      borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(135deg)',
                      backgroundColor: color.hex,
                      border: '2px solid #000',
                      boxShadow: color.isUsed ? '0 2px 8px rgba(0,0,0,0.1)' : '0 4px 16px rgba(0,0,0,0.3)',
                      cursor: color.isUsed ? 'default' : 'grab',
                      opacity: color.isUsed ? 0.5 : 1,
                      transition: 'all 0.3s ease',
                      '&:active': {
                        cursor: 'grabbing'
                      }
                    }} />
                    </DraggableItem>
                  </Box>
                </motion.div>
              ))}
            </Box>
          </DndContext>

        </Box>

        {/* Control Area - Ny opgave button */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 6,
          mb: 1
        }}>
          <Button
            variant="contained"
            onClick={resetGame}
            sx={{
              backgroundColor: categoryThemes.colors.accentColor,
              color: 'white',
              fontSize: { xs: '0.9rem', md: '1rem' },
              py: 1.5,
              px: 3,
              '&:hover': {
                backgroundColor: categoryThemes.colors.hoverBorderColor
              }
            }}
          >
            🎯 Ny opgave
          </Button>
        </Box>

        {/* Success Message */}
        <AnimatePresence>
          {gameState.gameResult === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 1000
              }}
            >
              <Box sx={{
                backgroundColor: categoryThemes.colors.accentColor,
                color: 'white',
                padding: { xs: 3, md: 4 },
                borderRadius: 3,
                textAlign: 'center',
                boxShadow: '0 16px 64px rgba(0,0,0,0.3)',
                maxWidth: '400px',
                mx: 2
              }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}>
                  🎉 Fantastisk! 🎉
                </Typography>
                <Typography variant="body1" sx={{ fontSize: { xs: '1rem', md: '1.2rem' }, mb: 3 }}>
                  Du lavede {gameState.targetColor.name}!
                </Typography>
                <Button
                  variant="contained"
                  onClick={resetGame}
                  sx={{
                    backgroundColor: 'white',
                    color: categoryThemes.colors.accentColor,
                    fontWeight: 'bold',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    py: 1.5,
                    px: 4,
                    '&:hover': {
                      backgroundColor: '#f5f5f5'
                    }
                  }}
                >
                  🎯 Ny opgave
                </Button>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
    </Box>
  )
}

export default ColorMixTargetDemo