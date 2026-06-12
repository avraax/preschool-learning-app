import React from 'react'
import { Box, Typography, Grid, Card, CardContent, CardActionArea } from '@mui/material'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

interface SpaceAdventureFallbackProps {
  onNavigate?: (route: string) => void
}

const SpaceAdventureFallback: React.FC<SpaceAdventureFallbackProps> = ({ onNavigate }) => {
  const navigate = useNavigate()
  
  const handleNavigate = (route: string) => {
    if (onNavigate) {
      onNavigate(route)
    } else {
      navigate(route)
    }
  }

  const navigationOptions = [
    {
      title: 'Bogstaver',
      icon: '📚',
      route: '/alphabet',
      color: '#FF6B6B',
      description: 'Lær alfabetet'
    },
    {
      title: 'Tal',
      icon: '🔢',
      route: '/math',
      color: '#4ECDC4',
      description: 'Øv matematik'
    },
    {
      title: 'Farver',
      icon: '🎨',
      route: '/farver',
      color: '#FFD700',
      description: 'Udforsk farver'
    },
    {
      title: 'Hukommelse',
      icon: '🧠',
      route: '/memory',
      color: '#96CEB4',
      description: 'Træn hukommelsen'
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const cardVariants = {
    hidden: { y: 50, opacity: 0, scale: 0.8 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 12
      }
    }
  }

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: 'radial-gradient(circle at center, #1a1a2e 0%, #16213e 50%, #0f0c29 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 3
    }}>
      {/* Animated stars background */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(2px 2px at 20px 30px, #fff, transparent),
          radial-gradient(2px 2px at 40px 70px, #fff, transparent),
          radial-gradient(1px 1px at 90px 40px, #fff, transparent),
          radial-gradient(1px 1px at 130px 80px, #fff, transparent),
          radial-gradient(2px 2px at 160px 30px, #fff, transparent)
        `,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 100px',
        animation: 'twinkle 4s linear infinite',
        zIndex: 0
      }} />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '800px' }}
      >
        {/* Welcome Header */}
        <motion.div variants={cardVariants}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: 'clamp(2rem, 6vw, 4rem)',
                fontWeight: 700,
                color: 'white',
                textShadow: '0 4px 8px rgba(0,0,0,0.5)',
                mb: 2
              }}
            >
              🚀 Rummet Eventyr
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              Vælg dit næste eventyr blandt stjernerne!
            </Typography>
          </Box>
        </motion.div>

        {/* Navigation Cards */}
        <Grid container spacing={3}>
          {navigationOptions.map((option) => (
            <Grid size={{ xs: 6, md: 3 }} key={option.title}>
              <motion.div variants={cardVariants}>
                <Card
                  sx={{
                    background: `linear-gradient(135deg, ${option.color}80, ${option.color}40)`,
                    backdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    minHeight: '180px',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    '&:hover': {
                      transform: 'scale(1.05) rotate(-2deg)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                    },
                    '&:active': {
                      transform: 'scale(0.98)'
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => handleNavigate(option.route)}
                    sx={{ height: '100%' }}
                  >
                    <CardContent sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      p: 3
                    }}>
                      <Typography
                        sx={{
                          fontSize: '3rem',
                          mb: 2,
                          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                        }}
                      >
                        {option.icon}
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          color: 'white',
                          fontWeight: 700,
                          mb: 1,
                          fontSize: 'clamp(1rem, 3vw, 1.3rem)',
                          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                        }}
                      >
                        {option.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: 'clamp(0.8rem, 2vw, 1rem)',
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}
                      >
                        {option.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Back Button */}
        <motion.div variants={cardVariants}>
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Typography
                onClick={() => navigate('/demo/homepages')}
                sx={{
                  display: 'inline-block',
                  px: 4,
                  py: 2,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  borderRadius: '50px',
                  fontWeight: 600,
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                🏠 Tilbage til Galleriet
              </Typography>
            </motion.div>
          </Box>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes twinkle {
          0% { opacity: 0.3; }
          50% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </Box>
  )
}

export default SpaceAdventureFallback