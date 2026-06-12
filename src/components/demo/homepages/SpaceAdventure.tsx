import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Box, Typography, Fab, CircularProgress } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// 3D Components with safe error handling
const Safe3DRenderer = lazy(() => import('../shared/Safe3DRenderer'))
const SpaceScene3D = lazy(() => import('../shared/SpaceScene3D'))

// 2D Fallback component
const SpaceAdventureFallback = lazy(() => import('./fallbacks/SpaceAdventureFallback'))

export const SpaceAdventure: React.FC = () => {
  const navigate = useNavigate()
  const [showInstructions, setShowInstructions] = useState(true)
  const [use3D, setUse3D] = useState(true) // Try 3D first, fallback if needed

  useEffect(() => {
    const timer = setTimeout(() => setShowInstructions(false), 5000)
    return () => clearTimeout(timer)
  }, [])


  return (
      <Box sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
        background: 'radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)'
      }}>
        {/* 3D Space Scene with Safe Fallback */}
        {use3D ? (
          <Suspense fallback={<Box sx={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)'
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#FFD700', mb: 2 }} size={60} />
              <Typography sx={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>
                🚀 Starter 3D Rumrejsen...
              </Typography>
            </Box>
          </Box>}>
            <Safe3DRenderer
              loadingText="🚀 Starter 3D Rumrejsen..."
              camera={{ position: [0, 0, 10], fov: 75 }}
              style={{ 
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%' 
              }}
              fallback={
                <Suspense fallback={<Box sx={{
                  height: '100vh',
                  width: '100vw',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)'
                }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress sx={{ color: '#FFD700', mb: 2 }} size={60} />
                    <Typography sx={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>
                      🚀 Starter 2D Rumrejsen...
                    </Typography>
                  </Box>
                </Box>}>
                  <SpaceAdventureFallback onNavigate={navigate} />
                </Suspense>
              }
            >
              <SpaceScene3D onNavigate={navigate} />
            </Safe3DRenderer>
          </Suspense>
        ) : (
          <Suspense fallback={<Box sx={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)'
          }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#FFD700', mb: 2 }} size={60} />
              <Typography sx={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>
                🚀 Starter 2D Rumrejsen...
              </Typography>
            </Box>
          </Box>}>
            <SpaceAdventureFallback onNavigate={navigate} />
          </Suspense>
        )}

        {/* Welcome Overlay */}
        <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10
            }}
          >
            <Box sx={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '2px solid rgba(255,255,255,0.2)',
              p: 4,
              textAlign: 'center',
              maxWidth: '400px'
            }}>
              <Typography
                variant="h4"
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 2,
                  fontSize: 'clamp(1.5rem, 4vw, 2rem)'
                }}
              >
                🚀 Velkommen til Rummet!
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 'clamp(1rem, 3vw, 1.2rem)',
                  lineHeight: 1.5
                }}
              >
                Klik på planeterne og teksterne for at udforske læringsspil!
                Træk for at se rundt i rummet.
              </Typography>
            </Box>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Navigation Controls */}
        <Box sx={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 20,
        display: 'flex',
        gap: 2
      }}>
        <Fab
          onClick={() => navigate('/demo/homepages')}
          sx={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.2)',
            '&:hover': {
              background: 'rgba(255,255,255,0.2)',
              transform: 'scale(1.1)'
            }
          }}
        >
          🏠
        </Fab>
        <Fab
          onClick={() => setShowInstructions(!showInstructions)}
          sx={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.2)',
            '&:hover': {
              background: 'rgba(255,255,255,0.2)',
              transform: 'scale(1.1)'
            }
          }}
        >
          ℹ️
        </Fab>
        <Fab
          onClick={() => setUse3D(!use3D)}
          sx={{
            background: use3D ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            border: use3D ? '2px solid rgba(255,215,0,0.5)' : '2px solid rgba(255,255,255,0.2)',
            '&:hover': {
              background: use3D ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.2)',
              transform: 'scale(1.1)'
            }
          }}
        >
          {use3D ? '🌌' : '🖼️'}
        </Fab>
        </Box>

        {/* Age Rating */}
        <Box sx={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 20
      }}>
        <Box sx={{
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '2px solid rgba(255,255,255,0.2)',
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

        {/* Loading Protection */}
        <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: -1
      }}>
        <Typography sx={{
          color: 'white',
          fontSize: '2rem',
          fontWeight: 700
        }}>
          🚀 Indlæser Rummet...
        </Typography>
        </Box>
    </Box>
  )
}

export default SpaceAdventure