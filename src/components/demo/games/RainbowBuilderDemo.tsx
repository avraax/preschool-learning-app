import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { audioManager } from '../../../utils/audio'

interface RainbowColor {
  id: string
  color: string
  name: string
  inRainbow: boolean
  rainbowPosition: number | null
}

interface RainbowBuilderDemoProps {}

const RainbowBuilderDemo: React.FC<RainbowBuilderDemoProps> = () => {
  const [availableColors, setAvailableColors] = useState<RainbowColor[]>([])
  const [rainbowColors, setRainbowColors] = useState<(RainbowColor | null)[]>(Array(8).fill(null))
  const [showCelebration, setShowCelebration] = useState(false)

  const colorPalette: Omit<RainbowColor, 'id' | 'inRainbow' | 'rainbowPosition'>[] = [
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
    { color: '#14B8A6', name: 'teal' }
  ]

  React.useEffect(() => {
    initializeGame()
  }, [])

  const initializeGame = () => {
    const colors: RainbowColor[] = colorPalette.map((color, index) => ({
      ...color,
      id: `color-${index}`,
      inRainbow: false,
      rainbowPosition: null
    }))
    
    setAvailableColors(colors)
    setRainbowColors(Array(8).fill(null))
    setShowCelebration(false)
    
    audioManager.speak('Byg din egen regnbue! Klik på farver for at tilføje dem.')
  }

  const handleColorClick = (colorId: string) => {
    const color = availableColors.find(c => c.id === colorId)
    if (!color || color.inRainbow) return

    // Find next empty slot in rainbow
    const nextEmptySlot = rainbowColors.findIndex(slot => slot === null)
    if (nextEmptySlot === -1) return // Rainbow is full
    
    const newRainbowColors = [...rainbowColors]
    newRainbowColors[nextEmptySlot] = { ...color, inRainbow: true, rainbowPosition: nextEmptySlot }
    setRainbowColors(newRainbowColors)
    
    // Update available colors
    setAvailableColors(availableColors.map(c => 
      c.id === colorId ? { ...c, inRainbow: true, rainbowPosition: nextEmptySlot } : c
    ))
    
    audioManager.speak(color.name)
    
    // Check if rainbow is full (all 8 slots filled)
    const filledSlots = newRainbowColors.filter(c => c !== null).length
    if (filledSlots === 8) {
      setTimeout(() => {
        setShowCelebration(true)
        audioManager.playSuccessSound()
        audioManager.speak('Fantastisk! Du har lavet en smuk regnbue!')
        
        // Reset after celebration
        setTimeout(() => {
          initializeGame()
        }, 4000)
      }, 500)
    }
  }

  const handleRainbowColorClick = (position: number) => {
    const colorInPosition = rainbowColors[position]
    if (!colorInPosition) return

    // Remove color from rainbow
    const newRainbowColors = [...rainbowColors]
    newRainbowColors[position] = null
    setRainbowColors(newRainbowColors)
    
    // Return color to available colors
    setAvailableColors(availableColors.map(c => 
      c.id === colorInPosition.id ? { ...c, inRainbow: false, rainbowPosition: null } : c
    ))
    
    audioManager.speak(`${colorInPosition.name} fjernet`)
  }

  const renderRainbow = () => (
    // Horizontal rainbow bands - single simple variation
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 3, height: 350, justifyContent: 'center' }}>
      {rainbowColors.map((color, index) => (
        <motion.div
          key={index}
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <Box
            sx={{
              height: 35,
              bgcolor: color ? color.color : '#E5E7EB',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '2px solid',
              borderColor: color ? 'white' : '#D1D5DB',
              opacity: color ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }}
            onClick={() => handleRainbowColorClick(index)}
          >
            <Typography variant="body2" sx={{ 
              color: color ? 'white' : '#9CA3AF',
              fontWeight: 700,
              textShadow: color ? '1px 1px 2px rgba(0,0,0,0.5)' : 'none'
            }}>
              {color ? color.name : `Band ${index + 1}`}
            </Typography>
          </Box>
        </motion.div>
      ))}
    </Box>
  )



  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Byg din Regnbue
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Klik på farver for at bygge din regnbue. Klik på regnbuen for at fjerne farver.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {rainbowColors.filter(c => c !== null).length}/8 farver brugt
        </Typography>
      </Box>

      {/* Rainbow area */}
      <Paper elevation={3} sx={{ bgcolor: 'white', mb: 3, overflow: 'hidden' }}>
        {renderRainbow()}
      </Paper>

      {/* Available colors */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1 }}>
        {availableColors.map((color) => (
          <motion.div
            key={color.id}
            whileHover={{ scale: color.inRainbow ? 1 : 1.05 }}
            whileTap={{ scale: color.inRainbow ? 1 : 0.95 }}
            style={{ cursor: color.inRainbow ? 'default' : 'pointer' }}
            onClick={() => !color.inRainbow && handleColorClick(color.id)}
          >
            <Paper
              elevation={color.inRainbow ? 1 : 3}
              sx={{
                width: 60,
                height: 60,
                bgcolor: color.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
                opacity: color.inRainbow ? 0.5 : 1,
                transition: 'opacity 0.3s ease',
                border: '2px solid white'
              }}
            >
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'white', 
                  fontWeight: 700,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  fontSize: '0.7rem',
                  textAlign: 'center'
                }}
              >
                {color.name}
              </Typography>
            </Paper>
          </motion.div>
        ))}
      </Box>

      {/* Celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FECA57)',
              backgroundSize: '400% 400%',
              animation: 'rainbowGradient 2s ease infinite',
              borderRadius: 20,
              padding: 30,
              color: 'white',
              textAlign: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            }}
          >
            <Typography variant="h2" sx={{ mb: 2 }}>🌈</Typography>
            <Typography variant="h3" sx={{ mb: 2, fontWeight: 700 }}>
              Fantastisk!
            </Typography>
            <Typography variant="h5">
              Du lavede en smuk regnbue!
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Button variant="contained" onClick={initializeGame} color="primary">
          Start forfra
        </Button>
      </Box>

      <style>
        {`
          @keyframes rainbowGradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
      </style>
    </Box>
  )
}

export default RainbowBuilderDemo