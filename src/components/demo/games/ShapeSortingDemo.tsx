import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { audioManager } from '../../../utils/audio'

interface FallingShape {
  id: string
  type: 'circle' | 'square' | 'triangle'
  color: string
  x: number
  y: number
  speed: number
}

interface ShapeSortingDemoProps {
  variation: 'A' | 'B' | 'C'
}

const ShapeSortingDemo: React.FC<ShapeSortingDemoProps> = ({ variation }) => {
  const [fallingShapes, setFallingShapes] = useState<FallingShape[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [draggedShape, setDraggedShape] = useState<FallingShape | null>(null)

  const shapeTypes = ['circle', 'square', 'triangle']
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899']

  const bins = {
    circle: { x: 100, y: 400, color: '#FEE2E2' },
    square: { x: 300, y: 400, color: '#DBEAFE' },
    triangle: { x: 500, y: 400, color: '#D1FAE5' }
  }

  const spawnShape = () => {
    if (!isPlaying) return

    const newShape: FallingShape = {
      id: Date.now().toString(),
      type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)] as any,
      color: colors[Math.floor(Math.random() * colors.length)],
      x: Math.random() * 500 + 50,
      y: -50,
      speed: variation === 'A' ? 2 : variation === 'B' ? 3 : 4
    }

    setFallingShapes(prev => [...prev, newShape])
  }

  const updateShapes = () => {
    if (!isPlaying) return

    setFallingShapes(prev => 
      prev.map(shape => ({ ...shape, y: shape.y + shape.speed }))
        .filter(shape => shape.y < 500) // Remove shapes that fell off screen
    )
  }

  useEffect(() => {
    if (!isPlaying) return

    const spawnInterval = setInterval(spawnShape, variation === 'A' ? 2000 : variation === 'B' ? 1500 : 1000)
    const updateInterval = setInterval(updateShapes, 50)

    return () => {
      clearInterval(spawnInterval)
      clearInterval(updateInterval)
    }
  }, [isPlaying, variation])

  const handleShapeDrop = (shape: FallingShape, binType: string) => {
    if (shape.type === binType) {
      setScore(score + 1)
      audioManager.playSuccessSound()
      audioManager.speak('Rigtig!')
    } else {
      audioManager.speak('Prøv igen!')
    }

    setFallingShapes(prev => prev.filter(s => s.id !== shape.id))
  }

  const startGame = () => {
    setIsPlaying(true)
    setScore(0)
    setFallingShapes([])
    audioManager.speak('Sorter formerne i de rigtige kasser!')
  }

  const stopGame = () => {
    setIsPlaying(false)
    setFallingShapes([])
  }

  const renderShape = (shape: FallingShape, size: number = 40) => {
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
      <svg width={size} height={size}>
        {shapeElement}
      </svg>
    )
  }

  const renderBin = (type: string, bin: any) => {
    const binSize = 80
    
    return (
      <Box
        key={type}
        sx={{
          position: 'absolute',
          left: bin.x,
          top: bin.y,
          width: binSize,
          height: binSize,
          bgcolor: bin.color,
          border: '3px solid #333',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (draggedShape) {
            handleShapeDrop(draggedShape, type)
            setDraggedShape(null)
          }
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Reference shape */}
        {renderShape({ 
          id: 'ref', 
          type: type as any, 
          color: '#666', 
          x: 0, 
          y: 0, 
          speed: 0 
        }, 50)}
        <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
          {type === 'circle' ? 'Cirkler' : type === 'square' ? 'Firkanter' : 'Trekanter'}
        </Typography>
      </Box>
    )
  }

  const renderVariationA = () => (
    // Simple falling shapes
    <Box sx={{ position: 'relative', height: 500, bgcolor: '#E5E7EB', overflow: 'hidden' }}>
      {/* Bins */}
      {Object.entries(bins).map(([type, bin]) => renderBin(type, bin))}

      {/* Falling shapes */}
      <AnimatePresence>
        {fallingShapes.map((shape) => (
          <motion.div
            key={shape.id}
            drag
            dragMomentum={false}
            onDragStart={() => setDraggedShape(shape)}
            onDragEnd={() => setDraggedShape(null)}
            initial={{ x: shape.x, y: shape.y }}
            animate={{ x: shape.x, y: shape.y }}
            exit={{ scale: 0 }}
            whileDrag={{ scale: 1.2, zIndex: 10 }}
            style={{
              position: 'absolute',
              cursor: 'grab'
            }}
          >
            {renderShape(shape)}
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  )

  const renderVariationB = () => (
    // Conveyor belt
    <Box sx={{ position: 'relative', height: 500, bgcolor: '#F3F4F6', overflow: 'hidden' }}>
      {/* Conveyor belt */}
      <Box sx={{
        position: 'absolute',
        top: 200,
        left: 0,
        width: '100%',
        height: 80,
        bgcolor: '#6B7280',
        border: '3px solid #374151'
      }}>
        <Box sx={{
          width: '100%',
          height: '100%',
          background: 'repeating-linear-gradient(90deg, #6B7280 0px, #6B7280 20px, #9CA3AF 20px, #9CA3AF 40px)',
          animation: 'conveyor 2s linear infinite'
        }} />
      </Box>

      {/* Bins at the end */}
      {Object.entries(bins).map(([type, bin], index) => 
        renderBin(type, { ...bin, x: 50 + index * 120, y: 350 })
      )}

      {/* Shapes on conveyor */}
      <AnimatePresence>
        {fallingShapes.map((shape) => (
          <motion.div
            key={shape.id}
            drag
            dragConstraints={{ left: 0, right: 600, top: 0, bottom: 500 }}
            onDragStart={() => setDraggedShape(shape)}
            onDragEnd={() => setDraggedShape(null)}
            initial={{ x: shape.x, y: 230 }}
            animate={{ x: shape.x + (isPlaying ? 100 : 0), y: 230 }}
            exit={{ scale: 0 }}
            whileDrag={{ scale: 1.2, zIndex: 10 }}
            style={{
              position: 'absolute',
              cursor: 'grab'
            }}
          >
            {renderShape(shape)}
          </motion.div>
        ))}
      </AnimatePresence>

      <style>
        {`
          @keyframes conveyor {
            0% { background-position: 0 0; }
            100% { background-position: 40px 0; }
          }
        `}
      </style>
    </Box>
  )

  const renderVariationC = () => (
    // Random spawn points
    <Box sx={{ position: 'relative', height: 500, bgcolor: '#FEF3C7', overflow: 'hidden' }}>
      {/* Central sorting area */}
      <Box sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 200,
        height: 200,
        border: '3px dashed #F59E0B',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Typography variant="h6" color="text.secondary">
          Sorting Zone
        </Typography>
      </Box>

      {/* Bins around the edges */}
      {Object.entries(bins).map(([type, bin], index) => {
        const positions = [
          { x: 50, y: 50 },   // Top left
          { x: 450, y: 50 },  // Top right
          { x: 250, y: 400 }  // Bottom center
        ]
        return renderBin(type, { ...bin, ...positions[index] })
      })}

      {/* Random shapes */}
      <AnimatePresence>
        {fallingShapes.map((shape) => (
          <motion.div
            key={shape.id}
            drag
            dragMomentum={false}
            onDragStart={() => setDraggedShape(shape)}
            onDragEnd={() => setDraggedShape(null)}
            initial={{ x: shape.x, y: shape.y, scale: 0 }}
            animate={{ x: shape.x, y: shape.y, scale: 1 }}
            exit={{ scale: 0 }}
            whileDrag={{ scale: 1.3, zIndex: 10 }}
            style={{
              position: 'absolute',
              cursor: 'grab'
            }}
          >
            {renderShape(shape)}
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  )

  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Form Sortering
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
          <Typography variant="h6">
            Score: {score}
          </Typography>
          <Button 
            variant="contained"
            onClick={isPlaying ? stopGame : startGame}
            color={isPlaying ? "secondary" : "primary"}
          >
            {isPlaying ? 'Stop' : 'Start Spil'}
          </Button>
        </Box>
      </Box>

      {/* Game Area */}
      <Paper elevation={3}>
        {variation === 'A' && renderVariationA()}
        {variation === 'B' && renderVariationB()}
        {variation === 'C' && renderVariationC()}
      </Paper>

      {/* Instructions */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {variation === 'A' && 'Træk de faldende former til de rigtige kasser'}
          {variation === 'B' && 'Træk formerne fra transportbåndet til de rigtige kasser'}
          {variation === 'C' && 'Sorter formerne i de rigtige kasser rundt om kanten'}
        </Typography>
      </Box>
    </Box>
  )
}

export default ShapeSortingDemo