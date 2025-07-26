import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, Paper } from '@mui/material'
import { ArrowBack, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'

// CSS styles for the flip animation
const styles = `
  .flip-container {
    perspective: 1000px;
    width: 200px;
    height: 300px;
    margin: 0 auto;
  }

  .flipper {
    transition: transform 0.6s;
    transform-style: preserve-3d;
    position: relative;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .flipper.flipped {
    transform: rotateY(180deg);
  }

  .card-face {
    backface-visibility: hidden;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    border: 3px solid;
  }

  .card-front {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    transform: rotateY(0deg);
    z-index: 2;
    border-color: #667eea;
  }

  .card-back {
    background: white;
    transform: rotateY(180deg);
    border-color: #764ba2;
  }
`

const CSSClassFlip: React.FC = () => {
  const navigate = useNavigate()
  const [isFlipped, setIsFlipped] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})

  // Update debug info
  useEffect(() => {
    const updateDebugInfo = () => {
      const flipper = document.querySelector('.flipper')
      const front = document.querySelector('.card-front')
      const back = document.querySelector('.card-back')
      
      if (flipper && front && back) {
        const flipperStyle = getComputedStyle(flipper)
        const frontStyle = getComputedStyle(front)
        const backStyle = getComputedStyle(back)
        
        setDebugInfo({
          flipperTransform: flipperStyle.transform,
          flipperTransformStyle: flipperStyle.transformStyle,
          frontTransform: frontStyle.transform,
          frontBackfaceVisibility: frontStyle.backfaceVisibility,
          backTransform: backStyle.transform,
          backBackfaceVisibility: backStyle.backfaceVisibility,
          isFlipped
        })
      }
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 100)
    return () => clearInterval(interval)
  }, [isFlipped])

  return (
    <>
      <style>{styles}</style>
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f3e5f5 0%, #e8f5e8 100%)', p: 2 }}>
        <Container maxWidth="md">
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <IconButton onClick={() => navigate('/flip-demo')} sx={{ mb: 2 }}>
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.dark', mb: 1 }}>
              🎨 CSS Class Flip Demo
            </Typography>
            <Typography variant="body1" sx={{ textAlign: 'center', color: 'text.secondary' }}>
              Pure CSS class-based flip animation
            </Typography>
          </Box>

          {/* Card */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <div className="flip-container">
              <div 
                className={`flipper ${isFlipped ? 'flipped' : ''}`}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front */}
                <div className="card-face card-front">
                  <Typography variant="h1" sx={{ color: 'white', fontSize: '4rem', mb: 1 }}>
                    ABC
                  </Typography>
                  <Typography variant="h6" sx={{ color: 'white', opacity: 0.9 }}>
                    Bogstaver
                  </Typography>
                  <Box sx={{ position: 'absolute', top: 10, left: 10 }}>⭐</Box>
                  <Box sx={{ position: 'absolute', top: 10, right: 10 }}>⭐</Box>
                  <Box sx={{ position: 'absolute', bottom: 10, left: 10 }}>⭐</Box>
                  <Box sx={{ position: 'absolute', bottom: 10, right: 10 }}>⭐</Box>
                </div>
                {/* Back */}
                <div className="card-face card-back">
                  <Typography variant="h1" sx={{ fontSize: '3rem', color: '#764ba2', mb: 1 }}>
                    A
                  </Typography>
                  <Typography variant="h2" sx={{ fontSize: '3rem', mb: 1 }}>
                    🍍
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#764ba2' }}>
                    Ananas
                  </Typography>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Controls */}
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <Button
              variant="contained"
              onClick={() => setIsFlipped(!isFlipped)}
              startIcon={<Refresh />}
              sx={{ mb: 4 }}
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
                <li>Uses CSS classes: <code>.flipper</code> and <code>.flipper.flipped</code></li>
                <li>Transform: <code>rotateY(180deg)</code> on flipped state</li>
                <li>Transition: <code>transform 0.6s</code></li>
                <li>3D preserved with: <code>transform-style: preserve-3d</code></li>
                <li>Hidden backs with: <code>backface-visibility: hidden</code></li>
              </ul>
            </Typography>
          </Paper>
        </Container>
      </Box>
    </>
  )
}

export default CSSClassFlip