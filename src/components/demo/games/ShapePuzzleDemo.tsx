import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion } from 'framer-motion'
import { useAudio } from '../../../hooks/useAudio'

interface Shape {
  id: string
  type: string
  color: string
  x: number
  y: number
  rotation: number
}

interface ShapePuzzleDemoProps {
  variation: 'A' | 'B' | 'C'
}

const ShapePuzzleDemo: React.FC<ShapePuzzleDemoProps> = ({ variation }) => {
  // Centralized audio system
  const audio = useAudio({ componentId: 'ShapePuzzleDemo' })
  
  const [shapes, setShapes] = useState<Shape[]>([])
  const [completed, setCompleted] = useState(false)

  const puzzleTemplates = {
    A: { // House
      title: 'Byg et Hus',
      shapes: [
        { id: '1', type: 'square', color: '#FDE047', x: 100, y: 200 }, // Base
        { id: '2', type: 'triangle', color: '#EF4444', x: 60, y: 100 }, // Roof
        { id: '3', type: 'rectangle', color: '#8B4513', x: 80, y: 150 }, // Door
        { id: '4', type: 'square', color: '#60A5FA', x: 40, y: 120 } // Window
      ],
      target: { width: 200, height: 200, x: 300, y: 150 }
    },
    B: { // Robot
      title: 'Byg en Robot',
      shapes: [
        { id: '1', type: 'rectangle', color: '#9CA3AF', x: 100, y: 200 }, // Body
        { id: '2', type: 'square', color: '#D1D5DB', x: 60, y: 100 }, // Head
        { id: '3', type: 'circle', color: '#EF4444', x: 40, y: 150 }, // Left eye
        { id: '4', type: 'circle', color: '#EF4444', x: 80, y: 150 }, // Right eye
        { id: '5', type: 'rectangle', color: '#6B7280', x: 120, y: 250 } // Legs
      ],
      target: { width: 200, height: 250, x: 350, y: 125 }
    },
    C: { // Tree
      title: 'Byg et Træ',
      shapes: [
        { id: '1', type: 'rectangle', color: '#8B4513', x: 100, y: 200 }, // Trunk
        { id: '2', type: 'circle', color: '#10B981', x: 60, y: 100 }, // Crown
        { id: '3', type: 'triangle', color: '#10B981', x: 80, y: 120 }, // Branch
        { id: '4', type: 'triangle', color: '#10B981', x: 40, y: 120 }, // Branch
        { id: '5', type: 'circle', color: '#FDE047', x: 120, y: 80 }, // Sun
        { id: '6', type: 'rectangle', color: '#3B82F6', x: 20, y: 250 } // Ground
      ],
      target: { width: 250, height: 300, x: 300, y: 100 }
    }
  }

  const currentPuzzle = puzzleTemplates[variation]

  const initializeShapes = () => {
    const initialShapes: Shape[] = currentPuzzle.shapes.map((shape, index) => ({
      ...shape,
      x: 80 + (index % 3) * 80,
      y: 350 + Math.floor(index / 3) * 80,
      rotation: 0
    }))
    setShapes(initialShapes)
    setCompleted(false)
  }

  React.useEffect(() => {
    initializeShapes()
  }, [variation])

  const handleShapeDrag = (shapeId: string, x: number, y: number) => {
    setShapes(shapes.map(shape => 
      shape.id === shapeId ? { ...shape, x, y } : shape
    ))
  }

  const handleShapeRotate = (shapeId: string) => {
    setShapes(shapes.map(shape =>
      shape.id === shapeId 
        ? { ...shape, rotation: (shape.rotation + 90) % 360 }
        : shape
    ))
    audio.playSuccessSound()
  }

  const checkCompletion = () => {
    const shapesInTarget = shapes.filter(shape => 
      shape.x > currentPuzzle.target.x - 50 &&
      shape.x < currentPuzzle.target.x + currentPuzzle.target.width + 50 &&
      shape.y > currentPuzzle.target.y - 50 &&
      shape.y < currentPuzzle.target.y + currentPuzzle.target.height + 50
    )

    if (shapesInTarget.length === shapes.length && !completed) {
      setCompleted(true)
      audio.speak('Fantastisk! Du har bygget det!')
    }
  }

  React.useEffect(() => {
    checkCompletion()
  }, [shapes])

  const renderShape = (shape: Shape) => {
    const size = 60
    
    const shapeElement = (() => {
      switch (shape.type) {
        case 'circle':
          return (
            <circle
              cx={size/2}
              cy={size/2}
              r={size/2 - 2}
              fill={shape.color}
              stroke="#333"
              strokeWidth="2"
            />
          )
        case 'square':
          return (
            <rect
              width={size - 4}
              height={size - 4}
              x={2}
              y={2}
              fill={shape.color}
              stroke="#333"
              strokeWidth="2"
            />
          )
        case 'rectangle':
          return (
            <rect
              width={size - 4}
              height={(size - 4) * 0.6}
              x={2}
              y={2 + (size - 4) * 0.2}
              fill={shape.color}
              stroke="#333"
              strokeWidth="2"
            />
          )
        case 'triangle':
          return (
            <path
              d={`M ${size/2} 2 L ${size-2} ${size-2} L 2 ${size-2} Z`}
              fill={shape.color}
              stroke="#333"
              strokeWidth="2"
            />
          )
        default:
          return null
      }
    })()

    return (
      <motion.div
        key={shape.id}
        drag
        dragMomentum={false}
        onDrag={(_, info) => handleShapeDrag(shape.id, shape.x + info.delta.x, shape.y + info.delta.y)}
        onDoubleClick={() => handleShapeRotate(shape.id)}
        whileHover={{ scale: 1.05 }}
        whileDrag={{ scale: 1.1, zIndex: 10 }}
        style={{
          position: 'absolute',
          left: shape.x,
          top: shape.y,
          cursor: 'grab',
          transform: `rotate(${shape.rotation}deg)`,
          transformOrigin: 'center center'
        }}
      >
        <Box
          sx={{
            width: size,
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width={size} height={size}>
            {shapeElement}
          </svg>
        </Box>
      </motion.div>
    )
  }

  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          {currentPuzzle.title}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Træk formerne til det stiplede område. Dobbeltklik for at rotere.
        </Typography>
      </Box>

      {/* Game Area */}
      <Box sx={{ 
        position: 'relative', 
        height: 500, 
        bgcolor: 'white', 
        borderRadius: 2,
        border: '2px solid #E0E0E0'
      }}>
        {/* Target area */}
        <Box
          sx={{
            position: 'absolute',
            left: currentPuzzle.target.x,
            top: currentPuzzle.target.y,
            width: currentPuzzle.target.width,
            height: currentPuzzle.target.height,
            border: '3px dashed #9CA3AF',
            borderRadius: 2,
            bgcolor: 'rgba(156, 163, 175, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="h6" color="text.secondary">
            Byg her
          </Typography>
        </Box>

        {/* Shapes */}
        {shapes.map(shape => renderShape(shape))}

        {/* Success overlay */}
        {completed && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 20
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
              <Typography variant="h3" sx={{ mb: 2 }}>
                Godt klaret! 🎉
              </Typography>
              <Typography variant="h6">
                Du har bygget {currentPuzzle.title.toLowerCase()}!
              </Typography>
            </Paper>
          </motion.div>
        )}
      </Box>

      {/* Instructions */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          💡 Tip: Dobbeltklik på en form for at rotere den
        </Typography>
        <Button 
          variant="contained" 
          onClick={initializeShapes}
          sx={{ mt: 2 }}
          color="secondary"
        >
          Start forfra
        </Button>
      </Box>
    </Box>
  )
}

export default ShapePuzzleDemo