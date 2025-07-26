import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, Paper } from '@mui/material'
import { ArrowBack, Refresh } from '@mui/icons-material'
import { motion } from 'framer-motion'

const InlineStyleFlip: React.FC = () => {
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
          containerTransformStyle: containerStyle.transformStyle,
          frontTransform: frontStyle.transform,
          frontBackfaceVisibility: frontStyle.backfaceVisibility,
          backTransform: backStyle.transform,
          backBackfaceVisibility: backStyle.backfaceVisibility,
          isFlipped,
          rotation: isFlipped ? 180 : 0
        })
      }
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 100)
    return () => clearInterval(interval)
  }, [isFlipped])

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', p: 2 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <IconButton onClick={() => navigate('/flip-demo')} sx={{ mb: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.dark', mb: 1 }}>
            ⚛️ Inline Style Flip Demo
          </Typography>
          <Typography variant="body1" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            React state controlling inline style transforms
          </Typography>
        </Box>

        {/* Card Container */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
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
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <Box
              ref={containerRef}
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.6s ease-in-out',
                transform: `rotateY(${isFlipped ? 180 : 0}deg)`
              }}
            >
              {/* Front Face */}
              <Box
                ref={frontRef}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(0deg)',
                  borderRadius: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                  border: '3px solid #f5576c'
                }}
              >
                <Typography variant="h1" sx={{ color: 'white', fontSize: '4rem', mb: 1 }}>
                  123
                </Typography>
                <Typography variant="h6" sx={{ color: 'white', opacity: 0.9 }}>
                  Tal
                </Typography>
                <Box sx={{ position: 'absolute', fontSize: '2rem' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    style={{ position: 'absolute', top: -140, left: -90 }}
                  >
                    🌟
                  </motion.div>
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    style={{ position: 'absolute', top: -140, right: -90 }}
                  >
                    ✨
                  </motion.div>
                </Box>
              </Box>

              {/* Back Face */}
              <Box
                ref={backRef}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  borderRadius: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'white',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                  border: '3px solid #f093fb'
                }}
              >
                <Typography variant="h1" sx={{ fontSize: '4rem', color: '#f5576c', mb: 1 }}>
                  7
                </Typography>
                <Box sx={{ fontSize: '2rem', mb: 1 }}>
                  🎈🎈🎈🎈🎈🎈🎈
                </Box>
                <Typography variant="h6" sx={{ color: '#f093fb' }}>
                  Syv
                </Typography>
              </Box>
            </Box>
          </Box>
        </motion.div>

        {/* Controls */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="contained"
            onClick={() => setIsFlipped(!isFlipped)}
            startIcon={<Refresh />}
            sx={{ 
              mb: 4,
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #f5576c 0%, #f093fb 100%)'
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
              <li>Uses inline styles with React state</li>
              <li>Transform: <code>{`transform: \`rotateY(\${isFlipped ? 180 : 0}deg)\``}</code></li>
              <li>Direct style object application</li>
              <li>No CSS classes required</li>
              <li>Animated decorations using Framer Motion</li>
            </ul>
          </Typography>
        </Paper>
      </Container>
    </Box>
  )
}

export default InlineStyleFlip