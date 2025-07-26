import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, Paper } from '@mui/material'
import { ArrowBack, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'

const AbsolutePositionFlip: React.FC = () => {
  const navigate = useNavigate()
  const [isFlipped, setIsFlipped] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  // Update debug info
  useEffect(() => {
    const updateDebugInfo = () => {
      if (containerRef.current && frontRef.current && backRef.current) {
        const containerStyle = getComputedStyle(containerRef.current)
        const frontStyle = getComputedStyle(frontRef.current)
        const backStyle = getComputedStyle(backRef.current)
        
        setDebugInfo({
          containerTransform: containerStyle.transform,
          frontZIndex: frontStyle.zIndex,
          frontTransform: frontStyle.transform,
          frontOpacity: frontStyle.opacity,
          backZIndex: backStyle.zIndex,
          backTransform: backStyle.transform,
          backOpacity: backStyle.opacity,
          isFlipped,
          technique: 'z-index switching with rotation'
        })
      }
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 100)
    return () => clearInterval(interval)
  }, [isFlipped])

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', p: 2 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <IconButton onClick={() => navigate('/flip-demo')} sx={{ mb: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.dark', mb: 1 }}>
            🎈 Absolute Position Demo
          </Typography>
          <Typography variant="body1" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            Z-index manipulation with layered approach
          </Typography>
        </Box>

        {/* Floating balloons background */}
        <Box sx={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                fontSize: '3rem',
                left: `${10 + i * 20}%`,
                bottom: -100
              }}
              animate={{
                y: [-100, -window.innerHeight - 100],
                x: [0, (i % 2 ? 1 : -1) * 50, 0]
              }}
              transition={{
                duration: 10 + i * 2,
                repeat: Infinity,
                delay: i * 2,
                ease: "linear"
              }}
            >
              🎈
            </motion.div>
          ))}
        </Box>

        {/* Card Container */}
        <Box
          ref={containerRef}
          sx={{
            width: 200,
            height: 300,
            margin: '0 auto',
            cursor: 'pointer',
            position: 'relative',
            transform: 'rotateY(0deg)',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease-in-out'
          }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front Face */}
          <Box
            ref={frontRef}
            sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              border: '3px solid #fed6e3',
              zIndex: isFlipped ? 1 : 2,
              transform: `rotateY(${isFlipped ? -180 : 0}deg)`,
              opacity: isFlipped ? 0 : 1,
              transition: 'all 0.6s ease-in-out',
              backfaceVisibility: 'hidden'
            }}
          >
            <motion.div
              animate={{ 
                y: [0, -20, 0],
                rotate: [-5, 5, -5]
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity
              }}
            >
              <Typography variant="h1" sx={{ fontSize: '5rem' }}>
                🎈
              </Typography>
            </motion.div>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
              Ballon
            </Typography>
          </Box>

          {/* Back Face */}
          <Box
            ref={backRef}
            sx={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              background: 'white',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              border: '3px solid #a8edea',
              zIndex: isFlipped ? 2 : 1,
              transform: `rotateY(${isFlipped ? 0 : 180}deg)`,
              opacity: isFlipped ? 1 : 0,
              transition: 'all 0.6s ease-in-out',
              backfaceVisibility: 'hidden'
            }}
          >
            <Typography variant="h1" sx={{ fontSize: '4rem', color: '#fed6e3', mb: 1 }}>
              B
            </Typography>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 360]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity
              }}
            >
              <Typography variant="h2" sx={{ fontSize: '3rem', mb: 1 }}>
                🐻
              </Typography>
            </motion.div>
            <Typography variant="h6" sx={{ color: '#a8edea', fontWeight: 'bold' }}>
              Bjørn
            </Typography>
          </Box>
        </Box>

        {/* Cloud decorations */}
        <Box sx={{ position: 'relative', mt: 4 }}>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                fontSize: '2rem',
                top: -50,
                left: `${20 + i * 30}%`
              }}
              animate={{
                x: [0, 20, 0]
              }}
              transition={{
                duration: 4 + i,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              ☁️
            </motion.div>
          ))}
        </Box>

        {/* Controls */}
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Button
            variant="contained"
            onClick={() => setIsFlipped(!isFlipped)}
            startIcon={<Refresh />}
            sx={{ 
              mb: 4,
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #fed6e3 0%, #a8edea 100%)'
              }
            }}
          >
            Flip Card
          </Button>
        </Box>

        {/* Debug Info */}
        <Paper sx={{ p: 2, mt: 4, bgcolor: 'grey.100' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>🐛 Debug Info</Typography>
          <Box component="pre" sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </Box>
        </Paper>

        {/* Implementation Details */}
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>📝 Implementation</Typography>
          <Typography variant="body2" component="div">
            <ul>
              <li>Two absolutely positioned layers</li>
              <li>Z-index switching: front becomes back, back becomes front</li>
              <li>Opacity transition for smooth appearance</li>
              <li>Rotation combined with z-index manipulation</li>
              <li>Floating balloons and cloud animations</li>
              <li>Works as fallback if 3D transforms fail</li>
            </ul>
          </Typography>
        </Paper>
      </Container>
    </Box>
  )
}

export default AbsolutePositionFlip