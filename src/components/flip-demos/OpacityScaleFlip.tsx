import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Box, Typography, Button, IconButton, Paper } from '@mui/material'
import { ArrowBack, Refresh } from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'

const OpacityScaleFlip: React.FC = () => {
  const navigate = useNavigate()
  const [isFlipped, setIsFlipped] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)

  // Update debug info
  useEffect(() => {
    const updateDebugInfo = () => {
      if (frontRef.current && backRef.current) {
        const frontStyle = getComputedStyle(frontRef.current)
        const backStyle = getComputedStyle(backRef.current)
        
        setDebugInfo({
          frontOpacity: frontStyle.opacity,
          frontScale: frontStyle.transform,
          frontVisibility: frontStyle.visibility,
          backOpacity: backStyle.opacity,
          backScale: backStyle.transform,
          backVisibility: backStyle.visibility,
          isFlipped,
          animationMethod: 'opacity + scale transition'
        })
      }
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 100)
    return () => clearInterval(interval)
  }, [isFlipped])

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)', p: 2 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <IconButton onClick={() => navigate('/flip-demo')} sx={{ mb: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 'bold', color: 'primary.dark', mb: 1 }}>
            ✨ Opacity & Scale Demo
          </Typography>
          <Typography variant="body1" sx={{ textAlign: 'center', color: 'text.secondary' }}>
            Simple transition without 3D transforms
          </Typography>
        </Box>

        {/* Card Container */}
        <Box
          sx={{
            width: 200,
            height: 300,
            margin: '0 auto',
            cursor: 'pointer',
            position: 'relative'
          }}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <AnimatePresence mode="wait">
            {!isFlipped ? (
              /* Front Face */
              <motion.div
                key="front"
                ref={frontRef}
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                transition={{ duration: 0.3, type: "spring" }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  border: '3px solid #fa709a'
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Typography variant="h1" sx={{ fontSize: '4rem', mb: 1 }}>
                    ✨
                  </Typography>
                </motion.div>
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                  Magi
                </Typography>
                {/* Sparkles */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    style={{
                      position: 'absolute',
                      fontSize: '1.5rem'
                    }}
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 0
                    }}
                    animate={{
                      x: (i % 2 ? 1 : -1) * (30 + i * 10),
                      y: -50 - i * 20,
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                  >
                    ⭐
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              /* Back Face */
              <motion.div
                key="back"
                ref={backRef}
                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                transition={{ duration: 0.3, type: "spring" }}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  background: 'white',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  border: '3px solid #fee140'
                }}
              >
                <Typography variant="h1" sx={{ fontSize: '4rem', color: '#fa709a', mb: 1 }}>
                  M
                </Typography>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Typography variant="h2" sx={{ fontSize: '3rem', mb: 1 }}>
                    🐭
                  </Typography>
                </motion.div>
                <Typography variant="h6" sx={{ color: '#fee140', fontWeight: 'bold' }}>
                  Mus
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Decorative elements */}
        <Box sx={{ position: 'relative', height: 100 }}>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              style={{
                position: 'absolute',
                left: `${10 + i * 10}%`,
                bottom: 0,
                fontSize: '2rem'
              }}
              animate={{
                y: [0, -20, 0],
                rotate: [0, 360]
              }}
              transition={{
                duration: 2 + i * 0.2,
                repeat: Infinity,
                delay: i * 0.1
              }}
            >
              🌟
            </motion.div>
          ))}
        </Box>

        {/* Controls */}
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="contained"
            onClick={() => setIsFlipped(!isFlipped)}
            startIcon={<Refresh />}
            sx={{ 
              mb: 4,
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #fee140 0%, #fa709a 100%)'
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
              <li>No 3D transforms - uses opacity and scale only</li>
              <li>AnimatePresence for smooth enter/exit transitions</li>
              <li>Simple fallback approach for older browsers</li>
              <li>Additional rotation for playful effect</li>
              <li>Animated decorations and sparkles</li>
            </ul>
          </Typography>
        </Paper>
      </Container>
    </Box>
  )
}

export default OpacityScaleFlip