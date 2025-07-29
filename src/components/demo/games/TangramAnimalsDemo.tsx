import React, { useState } from 'react'
import { Box, Typography, Button, Paper } from '@mui/material'
import { motion } from 'framer-motion'
import { audioManager } from '../../../utils/audio'

interface TangramPiece {
  id: string
  type: string
  color: string
  x: number
  y: number
  rotation: number
  placed: boolean
}

interface TangramAnimalsDemoProps {
  variation: 'A' | 'B' | 'C'
}

const TangramAnimalsDemo: React.FC<TangramAnimalsDemoProps> = ({ variation }) => {
  const [pieces, setPieces] = useState<TangramPiece[]>([])
  const [completed, setCompleted] = useState(false)
  const [showOutline, setShowOutline] = useState(true)

  const animalTemplates = {
    A: {
      name: 'Kat',
      emoji: '🐱',
      pieces: [
        { id: '1', type: 'large-triangle', color: '#F97316', x: 100, y: 100 },
        { id: '2', type: 'large-triangle', color: '#EF4444', x: 100, y: 200 },
        { id: '3', type: 'medium-triangle', color: '#10B981', x: 200, y: 100 },
        { id: '4', type: 'small-triangle', color: '#3B82F6', x: 200, y: 200 },
        { id: '5', type: 'parallelogram', color: '#8B5CF6', x: 300, y: 100 }
      ],
      outline: `M 350 150 L 380 120 L 420 120 L 450 150 L 450 200 L 420 230 L 380 230 L 360 210 L 350 200 Z`
    },
    B: {
      name: 'Fisk',
      emoji: '🐟',
      pieces: [
        { id: '1', type: 'large-triangle', color: '#06B6D4', x: 100, y: 150 },
        { id: '2', type: 'large-triangle', color: '#0EA5E9', x: 100, y: 250 },
        { id: '3', type: 'small-triangle', color: '#3B82F6', x: 200, y: 100 },
        { id: '4', type: 'parallelogram', color: '#6366F1', x: 200, y: 200 }
      ],
      outline: `M 400 200 L 480 170 L 520 200 L 480 230 L 450 240 L 420 230 L 400 200 Z`
    },
    C: {
      name: 'Fugl',
      emoji: '🐦',
      pieces: [
        { id: '1', type: 'large-triangle', color: '#F59E0B', x: 80, y: 100 },
        { id: '2', type: 'large-triangle', color: '#EF4444', x: 80, y: 200 },
        { id: '3', type: 'medium-triangle', color: '#10B981', x: 180, y: 100 },
        { id: '4', type: 'small-triangle', color: '#3B82F6', x: 180, y: 200 },
        { id: '5', type: 'small-triangle', color: '#8B5CF6', x: 280, y: 100 },
        { id: '6', type: 'parallelogram', color: '#EC4899', x: 280, y: 200 }
      ],
      outline: `M 400 180 L 440 140 L 480 140 L 520 180 L 500 220 L 460 240 L 420 220 L 400 180 Z`
    }
  }

  const currentAnimal = animalTemplates[variation]

  const initializePieces = () => {
    const initialPieces: TangramPiece[] = currentAnimal.pieces.map((piece, index) => ({
      ...piece,
      x: 50 + (index % 3) * 80,
      y: 350 + Math.floor(index / 3) * 80,
      rotation: 0,
      placed: false
    }))
    setPieces(initialPieces)
    setCompleted(false)
    setShowOutline(true)
  }

  React.useEffect(() => {
    initializePieces()
  }, [variation])

  const handlePieceDrag = (pieceId: string, x: number, y: number) => {
    setPieces(pieces.map(piece => 
      piece.id === pieceId ? { ...piece, x, y } : piece
    ))
    checkCompletion()
  }

  const handlePieceRotate = (pieceId: string) => {
    setPieces(pieces.map(piece =>
      piece.id === pieceId 
        ? { ...piece, rotation: (piece.rotation + 45) % 360 }
        : piece
    ))
    audioManager.playSuccessSound()
  }

  const checkCompletion = () => {
    const piecesInTarget = pieces.filter(piece => 
      piece.x > 370 && piece.x < 550 && piece.y > 120 && piece.y < 280
    )

    if (piecesInTarget.length === pieces.length && !completed) {
      setCompleted(true)
      setShowOutline(false)
      audioManager.speak(`Fantastisk! Du har lavet en ${currentAnimal.name}!`)
      
      // Play animal sound
      setTimeout(() => {
        if (variation === 'A') audioManager.speak('Miav!')
        else if (variation === 'B') audioManager.speak('Blub blub!')
        else audioManager.speak('Pip pip!')
      }, 1000)
    }
  }

  const renderTangramPiece = (piece: TangramPiece) => {
    const size = 60
    
    const getShapePath = (type: string) => {
      switch (type) {
        case 'large-triangle':
          return `M 0 0 L ${size} 0 L ${size/2} ${size} Z`
        case 'medium-triangle':
          return `M 0 0 L ${size*0.8} 0 L ${size*0.4} ${size*0.8} Z`
        case 'small-triangle':
          return `M 0 0 L ${size*0.6} 0 L ${size*0.3} ${size*0.6} Z`
        case 'parallelogram':
          return `M 0 ${size*0.3} L ${size*0.7} 0 L ${size} ${size*0.4} L ${size*0.3} ${size*0.7} Z`
        case 'square':
          return `M 0 0 L ${size*0.5} 0 L ${size*0.5} ${size*0.5} L 0 ${size*0.5} Z`
        default:
          return `M 0 0 L ${size} 0 L ${size} ${size} L 0 ${size} Z`
      }
    }

    return (
      <motion.div
        key={piece.id}
        drag
        dragMomentum={false}
        onDrag={(_, info) => handlePieceDrag(piece.id, piece.x + info.delta.x, piece.y + info.delta.y)}
        onDoubleClick={() => handlePieceRotate(piece.id)}
        whileHover={{ scale: 1.05 }}
        whileDrag={{ scale: 1.1, zIndex: 10 }}
        style={{
          position: 'absolute',
          left: piece.x,
          top: piece.y,
          cursor: 'grab',
          transform: `rotate(${piece.rotation}deg)`,
          transformOrigin: 'center center'
        }}
      >
        <svg width={size + 20} height={size + 20}>
          <path
            d={getShapePath(piece.type)}
            fill={piece.color}
            stroke="#333"
            strokeWidth="2"
            transform="translate(10, 10)"
          />
        </svg>
      </motion.div>
    )
  }

  const toggleOutline = () => {
    setShowOutline(!showOutline)
    audioManager.speak(showOutline ? 'Skjuler hjælpelinje' : 'Viser hjælpelinje')
  }

  return (
    <Box sx={{ height: '100%', p: 3, bgcolor: '#F5F5F5' }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>
          Tangram Dyr: {currentAnimal.name} {currentAnimal.emoji}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Træk brikkerne for at bygge dyret. Dobbeltklik for at rotere.
        </Typography>
        <Button 
          variant="outlined" 
          onClick={toggleOutline}
          sx={{ mt: 1 }}
        >
          {showOutline ? 'Skjul' : 'Vis'} hjælpelinje
        </Button>
      </Box>

      {/* Game Area */}
      <Box sx={{ 
        position: 'relative', 
        height: 500, 
        bgcolor: 'white', 
        borderRadius: 2,
        border: '2px solid #E0E0E0'
      }}>
        {/* Target silhouette */}
        <Box
          sx={{
            position: 'absolute',
            left: 370,
            top: 120,
            width: 180,
            height: 160,
            border: showOutline ? '3px dashed #9CA3AF' : 'none',
            borderRadius: 2,
            bgcolor: showOutline ? 'rgba(156, 163, 175, 0.1)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {showOutline && (
            <Typography variant="h3" sx={{ opacity: 0.3 }}>
              {currentAnimal.emoji}
            </Typography>
          )}
          
          {/* Animal outline path */}
          {showOutline && (
            <svg 
              width="180" 
              height="160" 
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              <path
                d={currentAnimal.outline}
                fill="none"
                stroke="#9CA3AF"
                strokeWidth="2"
                strokeDasharray="5,5"
                transform="translate(-350, -120)"
              />
            </svg>
          )}
        </Box>

        {/* Pieces area label */}
        <Box sx={{
          position: 'absolute',
          left: 20,
          top: 320,
          bgcolor: 'rgba(0,0,0,0.1)',
          p: 1,
          borderRadius: 1
        }}>
          <Typography variant="body2" color="text.secondary">
            Tangram brikker:
          </Typography>
        </Box>

        {/* Tangram pieces */}
        {pieces.map(piece => renderTangramPiece(piece))}

        {/* Success animation */}
        {completed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
                textAlign: 'center',
                borderRadius: 4
              }}
            >
              <Typography variant="h2" sx={{ mb: 2 }}>
                {currentAnimal.emoji}
              </Typography>
              <Typography variant="h4" sx={{ mb: 1 }}>
                Perfekt!
              </Typography>
              <Typography variant="h6">
                Du lavede en {currentAnimal.name}!
              </Typography>
            </Paper>
          </motion.div>
        )}
      </Box>

      {/* Instructions */}
      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          💡 Tip: Dobbeltklik på en brik for at rotere den
        </Typography>
        <Button 
          variant="contained" 
          onClick={initializePieces}
          color="secondary"
        >
          Start forfra
        </Button>
      </Box>
    </Box>
  )
}

export default TangramAnimalsDemo