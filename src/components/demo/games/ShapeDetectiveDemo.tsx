import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion } from 'framer-motion'
import { useAudio } from '../../../hooks/useAudio'

interface ShapeDetectiveDemoProps {
  variation: 'A' | 'B' | 'C'
}

interface ShapeItem {
  id: string
  shape: string
  x: number
  y: number
  found: boolean
}

const ShapeDetectiveDemo: React.FC<ShapeDetectiveDemoProps> = ({ variation }) => {
  // Centralized audio system
  const audio = useAudio({ componentId: 'ShapeDetectiveDemo' })
  
  const [targetShape, setTargetShape] = useState('cirkel')
  const [foundShapes, setFoundShapes] = useState<string[]>([])
  const [showFeedback, setShowFeedback] = useState(false)

  const scenes = {
    A: {
      title: 'Køkken',
      background: '#FFF5EB',
      items: [
        { id: '1', shape: 'cirkel', x: 20, y: 30, found: false }, // Plate
        { id: '2', shape: 'rektangel', x: 60, y: 20, found: false }, // Cutting board
        { id: '3', shape: 'trekant', x: 35, y: 60, found: false }, // Sandwich
        { id: '4', shape: 'cirkel', x: 80, y: 40, found: false }, // Clock
        { id: '5', shape: 'firkant', x: 15, y: 70, found: false }, // Window
        { id: '6', shape: 'oval', x: 70, y: 75, found: false } // Egg
      ]
    },
    B: {
      title: 'Legeplads',
      background: '#E6F7FF',
      items: [
        { id: '1', shape: 'cirkel', x: 25, y: 35, found: false }, // Ball
        { id: '2', shape: 'rektangel', x: 60, y: 30, found: false }, // Slide
        { id: '3', shape: 'trekant', x: 45, y: 15, found: false }, // Roof
        { id: '4', shape: 'firkant', x: 85, y: 60, found: false }, // Sandbox
        { id: '5', shape: 'cirkel', x: 10, y: 65, found: false }, // Tire swing
        { id: '6', shape: 'oval', x: 30, y: 80, found: false } // Pond
      ]
    },
    C: {
      title: 'Klasseværelse',
      background: '#F3E5F5',
      items: [
        { id: '1', shape: 'rektangel', x: 40, y: 20, found: false }, // Blackboard
        { id: '2', shape: 'cirkel', x: 80, y: 15, found: false }, // Clock
        { id: '3', shape: 'firkant', x: 20, y: 50, found: false }, // Book
        { id: '4', shape: 'trekant', x: 70, y: 60, found: false }, // Ruler
        { id: '5', shape: 'oval', x: 50, y: 75, found: false }, // Eraser
        { id: '6', shape: 'rektangel', x: 15, y: 80, found: false } // Table
      ]
    }
  }

  const shapeNames = ['cirkel', 'firkant', 'trekant', 'rektangel', 'oval']
  const currentScene = scenes[variation]

  const handleShapeClick = (item: ShapeItem) => {
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    if (item.shape === targetShape && !foundShapes.includes(item.id)) {
      setFoundShapes([...foundShapes, item.id])
      audio.playSuccessSound()
      
      const remainingShapes = currentScene.items.filter(i => 
        i.shape === targetShape && !foundShapes.includes(i.id) && i.id !== item.id
      )
      
      if (remainingShapes.length === 0) {
        setShowFeedback(true)
        setTimeout(() => {
          setShowFeedback(false)
          const nextShape = shapeNames[Math.floor(Math.random() * shapeNames.length)]
          setTargetShape(nextShape)
          setFoundShapes([])
          audio.speak(`Find alle ${nextShape}er!`)
        }, 2000)
      }
    }
  }

  const startGame = () => {
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    audio.speak(`Find alle ${targetShape}er!`)
  }

  const renderShape = (item: ShapeItem) => {
    const isFound = foundShapes.includes(item.id)
    const size = 50
    
    const shapeProps = {
      fill: isFound ? '#10B981' : '#E0E0E0',
      stroke: '#333',
      strokeWidth: 2,
      style: { cursor: 'pointer' }
    }

    switch (item.shape) {
      case 'cirkel':
        return (
          <circle
            cx={size/2}
            cy={size/2}
            r={size/2 - 2}
            {...shapeProps}
          />
        )
      case 'firkant':
        return (
          <rect
            width={size - 4}
            height={size - 4}
            x={2}
            y={2}
            {...shapeProps}
          />
        )
      case 'trekant':
        return (
          <path
            d={`M ${size/2} 2 L ${size-2} ${size-2} L 2 ${size-2} Z`}
            {...shapeProps}
          />
        )
      case 'rektangel':
        return (
          <rect
            width={size - 4}
            height={(size - 4) * 0.6}
            x={2}
            y={2 + (size - 4) * 0.2}
            {...shapeProps}
          />
        )
      case 'oval':
        return (
          <ellipse
            cx={size/2}
            cy={size/2}
            rx={(size/2) - 2}
            ry={(size/2) * 0.7}
            {...shapeProps}
          />
        )
      default:
        return null
    }
  }

  return (
    <Box sx={{ 
      height: '100%', 
      p: 3,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: currentScene.background
    }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Form-detektiv i {currentScene.title}
        </Typography>
        
        <Paper 
          elevation={3}
          sx={{ 
            display: 'inline-block',
            p: 2,
            bgcolor: 'primary.main',
            color: 'white'
          }}
        >
          <Typography variant="h5">
            Find alle {targetShape}er!
          </Typography>
        </Paper>
        
        <Button 
          variant="contained" 
          onClick={startGame}
          sx={{ mt: 2, ml: 2 }}
        >
          🔊 Hør opgaven
        </Button>
      </Box>

      {/* Game Area */}
      <Box sx={{ 
        flex: 1,
        position: 'relative',
        bgcolor: 'white',
        borderRadius: 4,
        boxShadow: 3,
        overflow: 'hidden',
        minHeight: 400
      }}>
        {currentScene.items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ scale: 0 }}
            animate={{ 
              scale: foundShapes.includes(item.id) ? 0 : 1,
              rotate: foundShapes.includes(item.id) ? 360 : 0
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{
              position: 'absolute',
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer'
            }}
            onClick={() => handleShapeClick(item)}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: item.shape === targetShape ? '3px solid #EF4444' : 'none',
                borderRadius: 2,
                bgcolor: 'rgba(255, 255, 255, 0.9)'
              }}
            >
              <svg width="60" height="60">
                {renderShape(item)}
              </svg>
            </Box>
          </motion.div>
        ))}

        {/* Success Feedback */}
        {showFeedback && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <Paper
              elevation={6}
              sx={{
                p: 4,
                bgcolor: 'success.main',
                color: 'white',
                textAlign: 'center'
              }}
            >
              <Typography variant="h3">
                Perfekt! 🎉
              </Typography>
            </Paper>
          </motion.div>
        )}
      </Box>

      {/* Shape reference */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Du leder efter:
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paper elevation={2} sx={{ p: 1, bgcolor: 'white' }}>
            <svg width="40" height="40">
              {renderShape({ id: 'reference', shape: targetShape, x: 0, y: 0, found: false } as ShapeItem)}
            </svg>
          </Paper>
        </Box>
      </Box>
    </Box>
  )
}

export default ShapeDetectiveDemo