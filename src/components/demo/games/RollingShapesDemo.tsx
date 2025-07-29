import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { audioManager } from '../../../utils/audio'

interface RollingShapesDemoProps {
  variation: 'A' | 'B' | 'C'
}

interface Shape {
  id: string
  type: 'circle' | 'square' | 'triangle'
  color: string
  name: string
}

const RollingShapesDemo: React.FC<RollingShapesDemoProps> = ({ variation }) => {
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [resultMessage, setResultMessage] = useState('')

  const shapes: Shape[] = [
    { id: '1', type: 'circle', color: '#EF4444', name: 'cirkel' },
    { id: '2', type: 'square', color: '#3B82F6', name: 'firkant' },
    { id: '3', type: 'triangle', color: '#10B981', name: 'trekant' }
  ]

  const handleShapeSelect = (shape: Shape) => {
    setSelectedShape(shape)
    audioManager.speak(shape.name)
  }

  const startRolling = () => {
    if (!selectedShape) return

    setIsRolling(true)
    setShowResult(false)

    setTimeout(() => {
      setIsRolling(false)
      setShowResult(true)
      
      if (selectedShape.type === 'circle') {
        setResultMessage(`${selectedShape.name} ruller let ned ad bakken!`)
        audioManager.speak(`${selectedShape.name} ruller let ned ad bakken!`)
      } else if (selectedShape.type === 'square') {
        setResultMessage(`${selectedShape.name} glider ned ad bakken!`)
        audioManager.speak(`${selectedShape.name} glider ned ad bakken!`)
      } else {
        setResultMessage(`${selectedShape.name} tumler ned ad bakken!`)
        audioManager.speak(`${selectedShape.name} tumler ned ad bakken!`)
      }
    }, 3000)
  }

  const reset = () => {
    setSelectedShape(null)
    setIsRolling(false)
    setShowResult(false)
  }

  const renderShape = (shape: Shape, size: number = 80) => {
    const shapeElement = (() => {
      switch (shape.type) {
        case 'circle':
          return (
            <circle
              cx={size/2}
              cy={size/2}
              r={size/2 - 4}
              fill={shape.color}
              stroke="#333"
              strokeWidth="3"
            />
          )
        case 'square':
          return (
            <rect
              width={size - 8}
              height={size - 8}
              x={4}
              y={4}
              fill={shape.color}
              stroke="#333"
              strokeWidth="3"
            />
          )
        case 'triangle':
          return (
            <path
              d={`M ${size/2} 4 L ${size-4} ${size-4} L 4 ${size-4} Z`}
              fill={shape.color}
              stroke="#333"
              strokeWidth="3"
            />
          )
        default:
          return null
      }
    })()

    return (
      <svg width={size} height={size}>
        {shapeElement}
      </svg>
    )
  }

  const getAnimationProps = (shapeType: string) => {
    switch (shapeType) {
      case 'circle':
        return {
          x: [0, 600],
          rotate: [0, 1080], // 3 full rotations
          transition: { duration: 3, ease: "easeInOut" as const }
        }
      case 'square':
        return {
          x: [0, 600],
          rotate: [0, 0], // No rotation
          transition: { duration: 3, ease: "linear" as const }
        }
      case 'triangle':
        return {
          x: [0, 600],
          rotate: [0, 720], // 2 rotations but irregular
          transition: { duration: 3, ease: "easeInOut" as const }
        }
      default:
        return {
          x: [0, 0],
          rotate: [0, 0],
          transition: { duration: 0, ease: "linear" as const }
        }
    }
  }

  const renderVariationA = () => (
    // Simple hill
    <Box sx={{ position: 'relative', height: 300 }}>
      {/* Hill/ramp */}
      <svg width="100%" height="200" style={{ position: 'absolute', bottom: 0 }}>
        <path
          d="M 0 150 L 700 100 L 700 200 L 0 200 Z"
          fill="#D4C5B0"
          stroke="#8B7355"
          strokeWidth="2"
        />
        {/* Grass on top */}
        <path
          d="M 0 150 L 700 100"
          stroke="#10B981"
          strokeWidth="8"
        />
      </svg>

      {/* Rolling shape */}
      {selectedShape && isRolling && (
        <motion.div
          style={{
            position: 'absolute',
            left: 50,
            bottom: 140,
            zIndex: 10
          }}
          animate={getAnimationProps(selectedShape.type)}
        >
          {renderShape(selectedShape, 60)}
        </motion.div>
      )}

      {/* Static shape at start */}
      {selectedShape && !isRolling && (
        <Box sx={{
          position: 'absolute',
          left: 50,
          bottom: 140,
          zIndex: 10
        }}>
          {renderShape(selectedShape, 60)}
        </Box>
      )}
    </Box>
  )

  const renderVariationB = () => (
    // Obstacle course
    <Box sx={{ position: 'relative', height: 300 }}>
      {/* Ground */}
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: 50,
        bgcolor: '#8B7355'
      }} />

      {/* Obstacles */}
      <Box sx={{ position: 'absolute', bottom: 50, left: 200, width: 20, height: 40, bgcolor: '#654321' }} />
      <Box sx={{ position: 'absolute', bottom: 50, left: 400, width: 30, height: 30, bgcolor: '#654321' }} />

      {/* Ramp */}
      <svg width="100%" height="150" style={{ position: 'absolute', bottom: 50 }}>
        <path
          d="M 0 100 L 150 20 L 600 60 L 700 50 L 700 150 L 0 150 Z"
          fill="#D4C5B0"
          stroke="#8B7355"
          strokeWidth="2"
        />
      </svg>

      {/* Rolling shape */}
      {selectedShape && isRolling && (
        <motion.div
          style={{
            position: 'absolute',
            left: 30,
            bottom: 180,
            zIndex: 10
          }}
          animate={{
            x: [0, 100, 200, 350, 450, 600],
            y: [0, 40, 50, 30, 40, 50],
            rotate: selectedShape.type === 'circle' ? [0, 1080] : 
                   selectedShape.type === 'triangle' ? [0, 720] : [0, 0],
            transition: { duration: 3, ease: "easeInOut" }
          }}
        >
          {renderShape(selectedShape, 50)}
        </motion.div>
      )}

      {/* Static shape */}
      {selectedShape && !isRolling && (
        <Box sx={{
          position: 'absolute',
          left: 30,
          bottom: 180,
          zIndex: 10
        }}>
          {renderShape(selectedShape, 50)}
        </Box>
      )}
    </Box>
  )

  const renderVariationC = () => (
    // Race track comparison
    <Box sx={{ position: 'relative', height: 300 }}>
      {/* Three lanes */}
      {[0, 1, 2].map((lane) => (
        <Box key={lane} sx={{
          position: 'absolute',
          top: 50 + lane * 80,
          left: 0,
          width: '100%',
          height: 60,
          bgcolor: lane % 2 === 0 ? '#E5E7EB' : '#F3F4F6',
          border: '2px solid #D1D5DB'
        }}>
          <Typography sx={{ 
            position: 'absolute', 
            left: 10, 
            top: 10,
            fontWeight: 700
          }}>
            Lane {lane + 1}
          </Typography>
        </Box>
      ))}

      {/* Finish line */}
      <Box sx={{
        position: 'absolute',
        right: 50,
        top: 50,
        width: 4,
        height: 240,
        background: 'repeating-linear-gradient(0deg, #000 0px, #000 20px, #FFF 20px, #FFF 40px)'
      }} />

      {/* All three shapes racing */}
      {isRolling && shapes.map((shape, index) => (
        <motion.div
          key={shape.id}
          style={{
            position: 'absolute',
            left: 30,
            top: 60 + index * 80,
            zIndex: 10
          }}
          animate={{
            x: shape.type === 'circle' ? [0, 600] :
               shape.type === 'square' ? [0, 500] :
               [0, 450],
            rotate: shape.type === 'circle' ? [0, 1080] :
                   shape.type === 'triangle' ? [0, 720] : [0, 0],
            transition: { 
              duration: shape.type === 'circle' ? 2.5 :
                       shape.type === 'square' ? 3.5 : 4,
              ease: "linear" as const
            }
          }}
        >
          {renderShape(shape, 40)}
        </motion.div>
      ))}

      {/* Selected shape indicator */}
      {selectedShape && !isRolling && (
        <Box sx={{
          position: 'absolute',
          left: 30,
          top: 60 + shapes.findIndex(s => s.id === selectedShape.id) * 80,
          zIndex: 10,
          border: '3px solid #EF4444',
          borderRadius: 1,
          p: 0.5
        }}>
          {renderShape(selectedShape, 40)}
        </Box>
      )}
    </Box>
  )

  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Rullende Former
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {variation === 'A' && 'Hvilken form ruller bedst ned ad bakken?'}
          {variation === 'B' && 'Se hvordan former bevæger sig over forhindringer'}
          {variation === 'C' && 'Hvem vinder løbet?'}
        </Typography>
      </Box>

      {/* Shape selector */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
        {shapes.map((shape) => (
          <motion.div
            key={shape.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Paper
              elevation={selectedShape?.id === shape.id ? 6 : 2}
              sx={{
                p: 2,
                cursor: 'pointer',
                border: selectedShape?.id === shape.id ? '3px solid #EF4444' : '1px solid #E0E0E0',
                textAlign: 'center'
              }}
              onClick={() => handleShapeSelect(shape)}
            >
              {renderShape(shape, 60)}
              <Typography variant="h6" sx={{ mt: 1 }}>
                {shape.name}
              </Typography>
            </Paper>
          </motion.div>
        ))}
      </Box>

      {/* Game area */}
      <Paper elevation={3} sx={{ bgcolor: '#87CEEB', overflow: 'hidden' }}>
        {variation === 'A' && renderVariationA()}
        {variation === 'B' && renderVariationB()}
        {variation === 'C' && renderVariationC()}
      </Paper>

      {/* Result message */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ textAlign: 'center', marginTop: 20 }}
          >
            <Paper elevation={4} sx={{ p: 3, bgcolor: 'success.light', color: 'success.contrastText' }}>
              <Typography variant="h6">
                {resultMessage}
              </Typography>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Button 
          variant="contained" 
          onClick={startRolling}
          disabled={!selectedShape || isRolling}
          sx={{ mr: 2 }}
        >
          {isRolling ? 'Ruller...' : 'Start Rullning'}
        </Button>
        <Button 
          variant="outlined" 
          onClick={reset}
          disabled={isRolling}
        >
          Prøv igen
        </Button>
      </Box>
    </Box>
  )
}

export default RollingShapesDemo