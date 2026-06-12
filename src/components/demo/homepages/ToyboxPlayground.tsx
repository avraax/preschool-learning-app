import React, { useRef, useState, useEffect, Suspense, lazy } from 'react'
import { Box, Typography, Fab, Grid, Card, CardContent, CircularProgress } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'

// 3D Components with safe error handling
const Safe3DRenderer = lazy(() => import('../shared/Safe3DRenderer'))
const ToyboxScene3D = lazy(() => import('../shared/ToyboxScene3D'))


// 2D Toy Cards for mobile/tablet
const ToyCard = ({ title, icon, description, onClick, color, delay }: any) => {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current, 
        { 
          scale: 0,
          rotation: -180,
          opacity: 0
        },
        { 
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: 0.8,
          delay: delay,
          ease: "back.out(1.7)"
        }
      )
    }
  }, [delay])

  const handleClick = () => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        scale: 1.1,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        onComplete: onClick
      })
    }
  }

  return (
    <Card
      ref={cardRef}
      onClick={handleClick}
      sx={{
        background: `linear-gradient(135deg, ${color}80, ${color}40)`,
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        border: '3px solid rgba(255,255,255,0.4)',
        cursor: 'pointer',
        minHeight: '200px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 15px 30px rgba(0,0,0,0.2)'
        }
      }}
    >
      <CardContent sx={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%'
      }}>
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
        <Typography
          variant="h5"
          sx={{
            color: 'white',
            fontWeight: 700,
            mb: 1,
            fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}
        >
          {description}
        </Typography>
      </CardContent>
    </Card>
  )
}

export const ToyboxPlayground: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [use3D, setUse3D] = useState(true) // Try 3D first, fallback if needed

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000)
    return () => clearTimeout(timer)
  }, [])


  const toyOptions = [
    {
      title: 'Bogstav Klodser',
      icon: '🔤',
      description: 'Byg ord med farverige klodser',
      route: '/alphabet',
      color: '#FF6B6B',
      delay: 0.2
    },
    {
      title: 'Tal Bolde',
      icon: '⚽',
      description: 'Kast og tæl med sjove bolde',
      route: '/math',
      color: '#4ECDC4',
      delay: 0.4
    },
    {
      title: 'Farve Paletter',
      icon: '🎨',
      description: 'Mal og bland farver sammen',
      route: '/farver',
      color: '#FFD700',
      delay: 0.6
    },
    {
      title: 'Puslespil Kasse',
      icon: '🧩',
      description: 'Løs gåder og træn hukommelsen',
      route: '/memory',
      color: '#96CEB4',
      delay: 0.8
    }
  ]

  return (
      <Box sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
      }}>
      {/* 3D Toybox Scene with Safe Fallback */}
      {use3D ? (
        <Suspense fallback={<Box sx={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)'
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ color: '#FFD700', mb: 2 }} size={60} />
            <Typography sx={{ color: 'white', fontSize: '1.5rem', fontWeight: 600 }}>
              🧸 Starter 3D Legetøjskassen...
            </Typography>
          </Box>
        </Box>}>
          <Safe3DRenderer
            loadingText="🧸 Starter 3D Legetøjskassen..."
            camera={{ position: [0, 2, 12], fov: 75 }}
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%' 
            }}
            fallback={
              <Box sx={{
                position: 'relative',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3
              }}>
                <Grid container spacing={3} maxWidth="800px">
                  {toyOptions.map((toy) => (
                    <Grid size={{ xs: 6, md: 3 }} key={toy.title}>
                      <ToyCard
                        {...toy}
                        onClick={() => navigate(toy.route)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            }
          >
            <ToyboxScene3D onNavigate={navigate} />
          </Safe3DRenderer>
        </Suspense>
      ) : (
        <Box sx={{
          position: 'relative',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3
        }}>
          <Grid container spacing={3} maxWidth="800px">
            {toyOptions.map((toy) => (
              <Grid size={{ xs: 6, md: 3 }} key={toy.title}>
                <ToyCard
                  {...toy}
                  onClick={() => navigate(toy.route)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

        {/* Welcome Message */}
        <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 45 }}
            transition={{ type: 'spring', bounce: 0.6 }}
            style={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}
          >
            <Box sx={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(25px)',
              borderRadius: '32px',
              border: '3px solid rgba(255,255,255,0.4)',
              p: 4,
              textAlign: 'center',
              maxWidth: '500px'
            }}>
              <Typography
                variant="h3"
                sx={{
                  fontSize: '3rem',
                  mb: 2
                }}
              >
                🧸✨
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
                Velkommen til Legetøjskassen!
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
                Leg og lær med magiske legetøj! 🎮
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
        zIndex: 30,
        display: 'flex',
        gap: 2
      }}>
        <Fab
          onClick={() => navigate('/demo/homepages')}
          sx={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            '&:hover': {
              background: 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1) rotate(10deg)'
            }
          }}
        >
          🏠
        </Fab>
        <Fab
          onClick={() => setShowWelcome(!showWelcome)}
          sx={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            '&:hover': {
              background: 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1) rotate(-10deg)'
            }
          }}
        >
          ℹ️
        </Fab>
        <Fab
          onClick={() => setUse3D(!use3D)}
          sx={{
            background: use3D ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: use3D ? '2px solid rgba(255,215,0,0.5)' : '2px solid rgba(255,255,255,0.3)',
            '&:hover': {
              background: use3D ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1) rotate(15deg)'
            }
          }}
        >
          {use3D ? '🧸' : '🃏'}
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
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(15px)',
          borderRadius: '16px',
          border: '2px solid rgba(255,255,255,0.3)',
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

export default ToyboxPlayground