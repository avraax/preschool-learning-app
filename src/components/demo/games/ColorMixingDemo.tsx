import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { audioManager } from '../../../utils/audio'

interface ColorMixingDemoProps {
  variation: 'A' | 'B' | 'C'
}

interface ColorDrop {
  id: string
  color: string
  colorName: string
  x: number
  y: number
  used: boolean
}

const ColorMixingDemo: React.FC<ColorMixingDemoProps> = ({ variation }) => {
  const [availableColors, setAvailableColors] = useState<ColorDrop[]>([])
  const [mixingArea, setMixingArea] = useState<ColorDrop[]>([])
  const [targetColor, setTargetColor] = useState<{ color: string, name: string } | null>(null)
  const [result, setResult] = useState<{ color: string, name: string } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdColors, setCreatedColors] = useState<{ color: string, name: string }[]>([])

  const primaryColors = [
    { color: '#EF4444', name: 'rød' },
    { color: '#3B82F6', name: 'blå' },
    { color: '#FDE047', name: 'gul' }
  ]

  const mixingRules: Record<string, { color: string, name: string }> = {
    'rød+blå': { color: '#A855F7', name: 'lilla' },
    'blå+rød': { color: '#A855F7', name: 'lilla' },
    'rød+gul': { color: '#F97316', name: 'orange' },
    'gul+rød': { color: '#F97316', name: 'orange' },
    'blå+gul': { color: '#10B981', name: 'grøn' },
    'gul+blå': { color: '#10B981', name: 'grøn' }
  }

  const possibleTargets = [
    { color: '#A855F7', name: 'lilla' },
    { color: '#F97316', name: 'orange' },
    { color: '#10B981', name: 'grøn' }
  ]

  React.useEffect(() => {
    initializeGame()
  }, [variation])

  const initializeGame = () => {
    // Reset game state
    setMixingArea([])
    setResult(null)
    setShowSuccess(false)
    setCreatedColors([])
    
    // Set up available colors
    const colors: ColorDrop[] = primaryColors.map((color, index) => ({
      id: `color-${index}`,
      color: color.color,
      colorName: color.name,
      x: 100 + index * 150,
      y: 350,
      used: false
    }))
    setAvailableColors(colors)

    if (variation === 'A') {
      // Target-based mode
      const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
      setTargetColor(randomTarget)
      audioManager.speak(`Lav ${randomTarget.name} ved at blande to farver!`)
    } else {
      // Freestyle mode
      setTargetColor(null)
      audioManager.speak('Bland farverne og se hvad du kan lave!')
    }
  }

  const handleColorDrop = (colorId: string, x: number, y: number) => {
    const color = availableColors.find(c => c.id === colorId)
    if (!color || color.used) return

    // Check if dropped in mixing area (center area)
    const mixingAreaBounds = { x: 200, y: 150, width: 300, height: 150 }
    const inMixingArea = x > mixingAreaBounds.x && 
                        x < mixingAreaBounds.x + mixingAreaBounds.width &&
                        y > mixingAreaBounds.y && 
                        y < mixingAreaBounds.y + mixingAreaBounds.height

    if (inMixingArea && mixingArea.length < 2) {
      // Add to mixing area
      const newMixingColor: ColorDrop = {
        ...color,
        x: 250 + mixingArea.length * 100,
        y: 200,
        used: true
      }
      
      setMixingArea([...mixingArea, newMixingColor])
      setAvailableColors(availableColors.map(c => 
        c.id === colorId ? { ...c, used: true } : c
      ))
      
      audioManager.speak(color.colorName)
      
      // If two colors in mixing area, try to mix
      if (mixingArea.length === 1) {
        setTimeout(() => tryMixing([...mixingArea, newMixingColor]), 500)
      }
    }
  }

  const tryMixing = (colors: ColorDrop[]) => {
    if (colors.length !== 2) return

    const key1 = `${colors[0].colorName}+${colors[1].colorName}`
    const key2 = `${colors[1].colorName}+${colors[0].colorName}`
    const mixResult = mixingRules[key1] || mixingRules[key2]

    if (mixResult) {
      setResult(mixResult)
      audioManager.speak(`${colors[0].colorName} og ${colors[1].colorName} bliver til ${mixResult.name}!`)
      
      if (variation === 'A') {
        // Target-based mode
        if (targetColor && mixResult.color === targetColor.color) {
          setTimeout(() => {
            setShowSuccess(true)
            audioManager.playSuccessSound()
            audioManager.speak('Perfekt! Du fandt den rigtige farve!')
            
            setTimeout(() => {
              initializeGame() // Start new round
            }, 3000)
          }, 1000)
        } else {
          setTimeout(() => {
            resetMixing()
            audioManager.speak('Prøv igen med andre farver!')
          }, 2000)
        }
      } else {
        // Freestyle mode - add to created colors collection
        setTimeout(() => {
          if (!createdColors.some(c => c.color === mixResult.color)) {
            setCreatedColors(prev => [...prev, mixResult])
            audioManager.playSuccessSound()
          }
          
          setTimeout(() => {
            resetMixing()
          }, 1500)
        }, 1000)
      }
    }
  }

  const resetMixing = () => {
    setMixingArea([])
    setResult(null)
    setAvailableColors(availableColors.map(c => ({ ...c, used: false })))
  }

  const getVariationStyle = () => {
    switch (variation) {
      case 'A': // Target-based mixing
        return {
          dropStyle: { borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)' },
          containerBg: '#FFF',
          title: 'Farveblanding - Find målet'
        }
      case 'B': // Freestyle 3-color mixing
        return {
          dropStyle: { borderRadius: '40% 60% 60% 40% / 60% 40% 60% 40%' },
          containerBg: '#F8F9FA',
          title: 'Fri farveblanding'
        }
      default:
        return { dropStyle: {}, containerBg: '#FFF', title: 'Farvemiks' }
    }
  }

  const style = getVariationStyle()

  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          {style.title}
        </Typography>
        
        {/* Target color display for variation A */}
        {variation === 'A' && targetColor && (
          <Paper elevation={4} sx={{ display: 'inline-block', p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Mål: Lav denne farve
            </Typography>
            <Box
              sx={{
                width: 80,
                height: 80,
                bgcolor: targetColor.color,
                borderRadius: 2,
                mx: 'auto',
                border: '3px solid #333'
              }}
            />
            <Typography variant="h6" sx={{ mt: 1, fontWeight: 700 }}>
              {targetColor.name}
            </Typography>
          </Paper>
        )}
        
        {/* Created colors collection for variation B */}
        {variation === 'B' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Dine blandede farver: {createdColors.length}/3
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
              {createdColors.map((color, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 50,
                    height: 50,
                    bgcolor: color.color,
                    borderRadius: 2,
                    border: '2px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}
                >
                  {color.name}
                </Box>
              ))}
              {/* Empty slots */}
              {Array.from({ length: 3 - createdColors.length }).map((_, index) => (
                <Box
                  key={`empty-${index}`}
                  sx={{
                    width: 50,
                    height: 50,
                    border: '2px dashed #9CA3AF',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9CA3AF',
                    fontSize: '1.5rem'
                  }}
                >
                  ?
                </Box>
              ))}
            </Box>
            {createdColors.length === 3 && (
              <Typography variant="h6" color="success.main" sx={{ mt: 1, fontWeight: 700 }}>
                🎉 Du har lavet alle 3 mulige farver!
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* Game area */}
      <Paper
        elevation={4}
        sx={{
          height: 400,
          bgcolor: style.containerBg,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Mixing area */}
        <Box
          sx={{
            position: 'absolute',
            left: 200,
            top: 150,
            width: 300,
            height: 150,
            border: '3px dashed #9CA3AF',
            borderRadius: 4,
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1
          }}
        >
          {mixingArea.length === 0 && !result && (
            <Typography variant="h6" sx={{ 
              color: 'text.secondary',
              textAlign: 'center'
            }}>
              Træk to farver hertil
            </Typography>
          )}
        </Box>

        {/* Available colors */}
        {availableColors.map((color) => (
          <motion.div
            key={color.id}
            drag={!color.used}
            dragConstraints={{ left: 0, right: 600, top: 0, bottom: 350 }}
            onDrag={(_, info) => {
              // Update position during drag
              setAvailableColors(availableColors.map(c => 
                c.id === color.id ? { ...c, x: info.point.x, y: info.point.y } : c
              ))
            }}
            onDragEnd={(_, info) => handleColorDrop(color.id, info.point.x, info.point.y)}
            initial={{ scale: 0 }}
            animate={{ 
              scale: color.used ? 0 : 1,
              x: color.x - 350,
              y: color.y - 200
            }}
            whileHover={{ scale: color.used ? 0 : 1.05 }}
            whileDrag={{ scale: 1.2, zIndex: 10 }}
            style={{
              position: 'absolute',
              cursor: color.used ? 'default' : 'grab'
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                bgcolor: color.color,
                ...style.dropStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                fontWeight: 700
              }}
            >
              {variation === 'A' && '💧'}
              {variation === 'B' && '🎨'}
            </Box>
          </motion.div>
        ))}

        {/* Colors in mixing area */}
        {mixingArea.map((color) => (
          <motion.div
            key={`mixing-${color.id}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute',
              left: color.x - 350,
              top: color.y - 200
            }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                bgcolor: color.color,
                ...style.dropStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem'
              }}
            >
              {variation === 'A' && '💧'}
              {variation === 'B' && '🎨'}
            </Box>
          </motion.div>
        ))}

        {/* Mix result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: 1.5, rotate: 360 }}
              exit={{ scale: 0 }}
              style={{
                position: 'absolute',
                zIndex: 20
              }}
            >
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  bgcolor: result.color,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: 'white',
                  boxShadow: 6,
                  border: '4px solid white'
                }}
              >
                <Typography variant="h4">✨</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {result.name}
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success celebration */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              style={{
                position: 'absolute',
                zIndex: 30,
                background: 'linear-gradient(45deg, #10B981, #34D399)',
                borderRadius: 20,
                padding: 20,
                color: 'white',
                textAlign: 'center'
              }}
            >
              <Typography variant="h3" sx={{ mb: 1 }}>🎉</Typography>
              <Typography variant="h4">Perfekt!</Typography>
            </motion.div>
          )}
        </AnimatePresence>
      </Paper>

      {/* Controls */}
      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Button variant="contained" onClick={resetMixing} color="secondary" sx={{ mr: 2 }}>
          Ryd blanding
        </Button>
        <Button variant="contained" onClick={initializeGame} color="primary">
          Ny opgave
        </Button>
      </Box>
    </Box>
  )
}

export default ColorMixingDemo