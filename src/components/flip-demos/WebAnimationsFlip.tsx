import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, Paper } from '@mui/material'
import { ArrowBack, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'

const WebAnimationsFlip: React.FC = () => {
  const navigate = useNavigate()
  const [isFlipped, setIsFlipped] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const cardRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)

  // Flip animation using Web Animations API
  const flipCard = () => {
    if (!cardRef.current) return

    const newFlipState = !isFlipped
    setIsFlipped(newFlipState)

    // Cancel any existing animation
    if (animationRef.current) {
      animationRef.current.cancel()
    }

    // Create keyframes for the flip
    const keyframes = [
      { transform: `rotateY(${isFlipped ? 180 : 0}deg)` },
      { transform: `rotateY(${newFlipState ? 180 : 0}deg)` }
    ]

    // Animate using Web Animations API
    animationRef.current = cardRef.current.animate(keyframes, {
      duration: 600,
      easing: 'ease-in-out',
      fill: 'forwards'
    })

    // Update debug info during animation
    animationRef.current.onfinish = () => {
      updateDebugInfo()
    }
  }

  // Update debug info
  const updateDebugInfo = () => {
    if (cardRef.current) {
      const style = getComputedStyle(cardRef.current)
      setDebugInfo({
        transform: style.transform,
        animationPlayState: animationRef.current?.playState || 'idle',
        animationProgress: animationRef.current?.effect?.getComputedTiming().progress || 0,
        isFlipped,
        supportsWebAnimations: 'animate' in Element.prototype
      })
    }
  }

  useEffect(() => {
    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 100)
    return () => {
      clearInterval(interval)
      if (animationRef.current) {
        animationRef.current.cancel()
      }
    }
  }, [isFlipped])

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', p: 2 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <IconButton onClick={() => navigate('/flip-demo')} sx={{ mb: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.dark', mb: 1 }}>
            🎭 Web Animations API Demo
          </Typography>
          <Typography variant="body1" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            Using the Web Animations API for smooth flips
          </Typography>
        </Box>

        {/* Card Container */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
        >
          <Box
            sx={{
              perspective: '1000px',
              width: 200,
              height: 300,
              margin: '0 auto',
              cursor: 'pointer'
            }}
            onClick={flipCard}
          >
            <Box
              ref={cardRef}
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Front Face */}
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                  borderRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                  border: '3px solid #00f2fe',
                  overflow: 'hidden'
                }}
              >
                {/* Animated background bubbles */}
                <Box sx={{ position: 'absolute', inset: 0 }}>
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      style={{
                        position: 'absolute',
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.3)',
                        left: `${20 + i * 15}%`,
                        bottom: -40
                      }}
                      animate={{
                        y: [-40, -320],
                        scale: [1, 0.5]
                      }}
                      transition={{
                        duration: 3 + i,
                        repeat: Infinity,
                        delay: i * 0.5
                      }}
                    />
                  ))}
                </Box>
                <Typography variant="h1" sx={{ color: 'white', fontSize: '4rem', mb: 1, zIndex: 1 }}>
                  🌊
                </Typography>
                <Typography variant="h4" sx={{ color: 'white', zIndex: 1 }}>
                  Vand
                </Typography>
              </Box>

              {/* Back Face */}
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'white',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
                  border: '3px solid #4facfe'
                }}
              >
                <Typography variant="h1" sx={{ fontSize: '4rem', color: '#00f2fe', mb: 1 }}>
                  W
                </Typography>
                <Typography variant="h2" sx={{ fontSize: '3rem', mb: 1 }}>
                  💧
                </Typography>
                <Typography variant="h6" sx={{ color: '#4facfe' }}>
                  Water
                </Typography>
              </Box>
            </Box>
          </Box>
        </motion.div>

        {/* Controls */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="contained"
            onClick={flipCard}
            startIcon={<Refresh />}
            sx={{ 
              mb: 4,
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)'
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
              <li>Uses Web Animations API: <code>element.animate()</code></li>
              <li>Keyframe-based animation with fill mode</li>
              <li>No CSS transitions needed</li>
              <li>Full control over animation timing</li>
              <li>Animated bubble effects in background</li>
            </ul>
          </Typography>
        </Paper>
      </Container>
    </Box>
  )
}

export default WebAnimationsFlip