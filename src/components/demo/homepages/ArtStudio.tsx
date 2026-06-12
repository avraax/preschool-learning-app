import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Fab, Grid, Card, CardContent, IconButton } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// Paint Brush Component
const PaintBrush = ({ color, size, onColorSelect }: any) => {
  return (
    <motion.div
      whileHover={{ scale: 1.2, rotate: 10 }}
      whileTap={{ scale: 0.9 }}
      onClick={() => onColorSelect(color)}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        border: '3px solid white',
        cursor: 'pointer',
        margin: '5px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        position: 'relative'
      }}
    >
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          position: 'absolute',
          top: '-5px',
          left: '-5px',
          right: '-5px',
          bottom: '-5px',
          borderRadius: '50%',
          border: `2px solid ${color}`,
          opacity: 0.5
        }}
      />
    </motion.div>
  )
}

// Canvas Drawing Component
const DrawingCanvas = ({ selectedColor, onClear }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 8
      }
    }
  }, [])

  const startDrawing = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setLastPosition({ x, y })
      setIsDrawing(true)
    }
  }

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      ctx.strokeStyle = selectedColor
      ctx.beginPath()
      ctx.moveTo(lastPosition.x, lastPosition.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      
      setLastPosition({ x, y })
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    onClear()
  }

  return (
    <Box sx={{
      position: 'relative',
      display: 'inline-block',
      border: '8px solid #8B4513',
      borderRadius: '12px',
      background: '#FFF8DC',
      boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
    }}>
      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{
          cursor: 'crosshair',
          display: 'block',
          borderRadius: '4px'
        }}
      />
      <IconButton
        onClick={clearCanvas}
        sx={{
          position: 'absolute',
          top: 5,
          right: 5,
          background: 'rgba(255,255,255,0.8)',
          '&:hover': { background: 'rgba(255,255,255,0.9)' }
        }}
      >
        🗑️
      </IconButton>
    </Box>
  )
}

// Art Project Card
const ArtProjectCard = ({ title, icon, description, onClick, color, delay }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 80, rotate: -10 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay, type: 'spring', bounce: 0.6 }}
      whileHover={{ 
        scale: 1.05, 
        rotate: 2,
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.95 }}
    >
      <Card
        onClick={onClick}
        sx={{
          background: `linear-gradient(135deg, ${color}80, ${color}40)`,
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          border: '4px solid rgba(255,255,255,0.5)',
          cursor: 'pointer',
          minHeight: '180px',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 30% 30%, ${color}60, transparent)`,
            opacity: 0.5
          }
        }}
      >
        <CardContent sx={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          position: 'relative',
          zIndex: 2,
          p: 3
        }}>
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Typography
              variant="h2"
              sx={{
                fontSize: '4rem',
                mb: 2,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
              }}
            >
              {icon}
            </Typography>
          </motion.div>
          
          <Typography
            variant="h6"
            sx={{
              color: 'white',
              fontWeight: 700,
              mb: 1,
              fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            {title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 'clamp(0.8rem, 2vw, 1rem)',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              lineHeight: 1.4
            }}
          >
            {description}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Floating Art Supplies
const FloatingSupply = ({ emoji, x, y, delay }: any) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: '3rem',
        zIndex: 2
      }}
      animate={{
        y: [0, -20, 0],
        rotate: [0, 10, -10, 0],
        scale: [1, 1.1, 1]
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    >
      {emoji}
    </motion.div>
  )
}

export const ArtStudio: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [selectedColor, setSelectedColor] = useState('#FF6B6B')
  const [showCanvas, setShowCanvas] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const paintColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#FFB6C1', '#98FB98', '#F0E68C', '#FFA07A'
  ]

  const artProjects = [
    {
      title: 'Bogstav Malerier',
      icon: '🎨',
      description: 'Mal smukke bogstaver og ord',
      route: '/alphabet',
      color: '#fd79a8',
      delay: 0.2
    },
    {
      title: 'Tal Tegninger',
      icon: '✏️',
      description: 'Tegn tal og geometriske former',
      route: '/math',
      color: '#74b9ff',
      delay: 0.4
    },
    {
      title: 'Farve Palet',
      icon: '🖌️',
      description: 'Udforsk og blend alle farver',
      route: '/farver',
      color: '#fdcb6e',
      delay: 0.6
    },
    {
      title: 'Kreativt Galleri',
      icon: '🖼️',
      description: 'Udstil dine kunstværker',
      route: '/memory',
      color: '#00b894',
      delay: 0.8
    }
  ]

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(135deg, #fd79a8 0%, #fdcb6e 50%, #e17055 100%)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'url("data:image/svg+xml,%3Csvg width="40" height="40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Cpath d="M20 20c0-11.046-8.954-20-20-20v40c11.046 0 20-8.954 20-20z"/%3E%3C/g%3E%3C/svg%3E")',
        zIndex: 1
      }
    }}>
      {/* Floating Art Supplies */}
      <FloatingSupply emoji="🖍️" x={10} y={20} delay={0} />
      <FloatingSupply emoji="✂️" x={85} y={25} delay={0.5} />
      <FloatingSupply emoji="📐" x={15} y={70} delay={1} />
      <FloatingSupply emoji="🖊️" x={80} y={75} delay={1.5} />
      <FloatingSupply emoji="📏" x={50} y={15} delay={2} />

      {/* Welcome Message */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.3, rotate: 30 }}
            transition={{ type: 'spring', bounce: 0.8 }}
            style={{
              position: 'absolute',
              top: '25%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}
          >
            <Box sx={{
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(25px)',
              borderRadius: '32px',
              border: '3px solid rgba(255,255,255,0.4)',
              p: 5,
              textAlign: 'center',
              maxWidth: '500px',
              position: 'relative'
            }}>
              <Typography
                variant="h3"
                sx={{
                  fontSize: '3rem',
                  mb: 3
                }}
              >
                🎨✨
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 2,
                  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
              >
                Velkommen til Kunst Studiet!
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: 'clamp(1rem, 3vw, 1.3rem)',
                  lineHeight: 1.5,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                Hvor kreativitet og læring mødes på lærredet! 🖌️
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paint Palette */}
      <Box sx={{
        position: 'absolute',
        top: '15%',
        right: '5%',
        zIndex: 10
      }}>
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, type: 'spring' }}
        >
          <Box sx={{
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '50px',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
          }}>
            <Typography
              variant="h6"
              sx={{
                color: '#333',
                fontWeight: 700,
                mb: 2,
                textAlign: 'center'
              }}
            >
              Vælg din farve! 🎨
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1
            }}>
              {paintColors.map((color) => (
                <PaintBrush
                  key={color}
                  color={color}
                  size={40}
                  onColorSelect={setSelectedColor}
                />
              ))}
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: '#666',
                mt: 1,
                textAlign: 'center'
              }}
            >
              Valgt: 
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: selectedColor,
                  ml: 1,
                  verticalAlign: 'middle'
                }}
              />
            </Typography>
          </Box>
        </motion.div>
      </Box>

      {/* Drawing Canvas */}
      {showCanvas && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '30%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15
          }}
        >
          <DrawingCanvas 
            selectedColor={selectedColor}
            onClear={() => {}}
          />
        </motion.div>
      )}

      {/* Art Projects */}
      <Box sx={{
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '1000px',
        zIndex: 15
      }}>
        <Grid container spacing={3}>
          {artProjects.map((project) => (
            <Grid size={{ xs: 6, md: 3 }} key={project.title}>
              <ArtProjectCard
                {...project}
                onClick={() => navigate(project.route)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Navigation Controls */}
      <Box sx={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 30,
        display: 'flex',
        gap: 2
      }}>
        <Fab
          onClick={() => navigate('/demo/homepages')}
          sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.4)',
            '&:hover': {
              background: 'rgba(255,255,255,0.3)',
              transform: 'scale(1.1) rotate(10deg)'
            }
          }}
        >
          🏠
        </Fab>
        <Fab
          onClick={() => setShowCanvas(!showCanvas)}
          sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.4)',
            '&:hover': {
              background: 'rgba(255,255,255,0.3)',
              transform: 'scale(1.1)'
            }
          }}
        >
          🖌️
        </Fab>
        <Fab
          onClick={() => setShowWelcome(!showWelcome)}
          sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.4)',
            '&:hover': {
              background: 'rgba(255,255,255,0.3)',
              transform: 'scale(1.1) rotate(-10deg)'
            }
          }}
        >
          ℹ️
        </Fab>
      </Box>

      {/* Age Rating */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 30
      }}>
        <Box sx={{
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(15px)',
          borderRadius: '16px',
          border: '2px solid rgba(255,255,255,0.4)',
          px: 3,
          py: 1
        }}>
          <Typography sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem'
          }}>
            👶 4-6 år
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default ArtStudio