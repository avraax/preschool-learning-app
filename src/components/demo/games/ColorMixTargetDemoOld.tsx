import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useAudio } from '../../../hooks/useAudio'

interface ColorMixTargetDemoProps {}

interface ColorDrop {
  id: string
  color: string
  colorName: string
  x: number
  y: number
  used: boolean
}

const ColorMixTargetDemoOld: React.FC<ColorMixTargetDemoProps> = () => {
  // Centralized audio system
  const audio = useAudio({ componentId: 'ColorMixTargetDemoOld' })
  
  const [availableColors, setAvailableColors] = useState<ColorDrop[]>([])
  const [mixingArea, setMixingArea] = useState<ColorDrop[]>([])
  const [targetColor, setTargetColor] = useState<{ color: string, name: string } | null>(null)
  const [result, setResult] = useState<{ color: string, name: string } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

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
  }, [])

  const initializeGame = () => {
    // Reset game state
    setMixingArea([])
    setResult(null)
    setShowSuccess(false)
    
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

    // Set random target
    const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
    setTargetColor(randomTarget)
    audio.speak(`Lav ${randomTarget.name} ved at blande to farver!`)
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
      
      audio.speak(color.colorName)
      
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
      audio.speak(`${colors[0].colorName} og ${colors[1].colorName} bliver til ${mixResult.name}!`)
      
      // Check if target achieved
      if (targetColor && mixResult.color === targetColor.color) {
        setTimeout(() => {
          setShowSuccess(true)
          audio.playSuccessSound()
          audio.speak('Perfekt! Du fandt den rigtige farve!')
          
          setTimeout(() => {
            initializeGame() // Start new round
          }, 3000)
        }, 1000)
      } else {
        setTimeout(() => {
          resetMixing()
          audio.speak('Prøv igen med andre farver!')
        }, 2000)
      }
    }
  }

  const resetMixing = () => {
    setMixingArea([])
    setResult(null)
    setAvailableColors(availableColors.map(c => ({ ...c, used: false })))
  }

  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Farvejagt - Find målet
        </Typography>
        
        {/* Target color display */}
        {targetColor && (
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
      </Box>

      {/* Game area */}
      <Paper
        elevation={4}
        sx={{
          height: 400,
          bgcolor: '#FFF',
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
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(45deg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem',
                fontWeight: 700
              }}
            >
              💧
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
                borderRadius: '50% 50% 50% 0',
                transform: 'rotate(45deg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '2rem'
              }}
            >
              💧
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

export default ColorMixTargetDemoOld