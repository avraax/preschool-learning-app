import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, Fab, Card, CardContent, Grid } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// Fish Component with CSS animations
const Fish = ({ delay = 0, direction = 1, size = 1, color = '#FFD700', speed = 20 }: any) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        fontSize: `${2 * size}rem`,
        color: color,
        filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.5))',
        zIndex: 5
      }}
      animate={{
        x: direction > 0 ? ['0vw', '110vw'] : ['110vw', '0vw'],
        y: [
          `${Math.random() * 80 + 10}vh`,
          `${Math.random() * 80 + 10}vh`,
          `${Math.random() * 80 + 10}vh`
        ]
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        delay: delay,
        ease: 'linear'
      }}
    >
      {direction > 0 ? '🐠' : '🐟'}
    </motion.div>
  )
}

// Bubble Component
const Bubble = ({ delay = 0, size = 1 }: any) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${Math.random() * 100}vw`,
        bottom: '0vh',
        fontSize: `${size}rem`,
        zIndex: 3
      }}
      animate={{
        y: ['0vh', '-110vh'],
        x: [0, Math.sin(Date.now() * 0.001) * 50],
        scale: [size, size * 1.5, size * 0.5]
      }}
      transition={{
        duration: 8 + Math.random() * 4,
        repeat: Infinity,
        delay: delay,
        ease: 'easeOut'
      }}
    >
      💙
    </motion.div>
  )
}

// Coral Component
const Coral = ({ x, y, type }: any) => {
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
        rotate: [0, 10, -10, 0],
        scale: [1, 1.1, 1]
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {type}
    </motion.div>
  )
}

// Learning Card Component
const LearningCard = ({ title, icon, description, onClick, color }: any) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, rotate: 2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      <Card sx={{
        background: `linear-gradient(135deg, ${color}40, ${color}20)`,
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '2px solid rgba(255,255,255,0.3)',
        cursor: 'pointer',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          '&:before': {
            opacity: 1
          }
        },
        '&:before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(45deg, ${color}20, transparent)`,
          opacity: 0,
          transition: 'opacity 0.3s ease'
        }
      }}>
        <CardContent sx={{
          textAlign: 'center',
          position: 'relative',
          zIndex: 2
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
    </motion.div>
  )
}

export const UnderwaterWorld: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const backgroundRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const learningOptions = [
    {
      title: 'Bogstaver',
      icon: '🅰️',
      description: 'Lær alfabetet med havets venner',
      route: '/alphabet',
      color: '#74b9ff'
    },
    {
      title: 'Tal',
      icon: '🔢',
      description: 'Tæl med fisk og skaldyr',
      route: '/math',
      color: '#00cec9'
    },
    {
      title: 'Farver',
      icon: '🐙',
      description: 'Udforsk havets farver',
      route: '/farver',
      color: '#fd79a8'
    },
    {
      title: 'Hukommelse',
      icon: '🧠',
      description: 'Spil med havets skatte',
      route: '/memory',
      color: '#fdcb6e'
    }
  ]

  return (
    <Box
      ref={backgroundRef}
      sx={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
        background: 'linear-gradient(180deg, #74b9ff 0%, #0984e3 50%, #2d3436 100%)'
      }}
    >
      {/* Animated Sea Floor */}
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '200px',
        background: 'linear-gradient(180deg, transparent 0%, #2d3436 50%, #636e72 100%)',
        zIndex: 1
      }} />

      {/* Swimming Fish */}
      {[...Array(8)].map((_, i) => (
        <Fish
          key={`fish-${i}`}
          delay={i * 2}
          direction={i % 2 === 0 ? 1 : -1}
          size={0.8 + Math.random() * 0.6}
          color={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][i % 5]}
          speed={15 + Math.random() * 10}
        />
      ))}

      {/* Floating Bubbles */}
      {[...Array(15)].map((_, i) => (
        <Bubble
          key={`bubble-${i}`}
          delay={i * 0.8}
          size={0.5 + Math.random() * 1}
        />
      ))}

      {/* Coral Reef */}
      <Coral x={10} y={70} type="🪸" color="#FF6B6B" />
      <Coral x={85} y={75} type="🌿" color="#00b894" />
      <Coral x={15} y={80} type="🪸" color="#fd79a8" />
      <Coral x={75} y={85} type="🌿" color="#00cec9" />
      <Coral x={45} y={75} type="🪸" color="#fdcb6e" />

      {/* Welcome Message */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -100 }}
            style={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}
          >
            <Box sx={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(20px)',
              borderRadius: '32px',
              border: '3px solid rgba(255,255,255,0.3)',
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
                🌊
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
                Velkommen under Vandet!
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 'clamp(1rem, 3vw, 1.3rem)',
                  lineHeight: 1.5,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                Dyk ned i læringens dybe hav! 🐠
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Learning Navigation */}
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '800px',
        zIndex: 10
      }}>
        <Grid container spacing={3}>
          {learningOptions.map((option, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={option.title}>
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 + 1 }}
              >
                <LearningCard
                  {...option}
                  onClick={() => navigate(option.route)}
                />
              </motion.div>
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
      </Box>

      {/* Depth Indicator */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 30
      }}>
        <Box sx={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(15px)',
          borderRadius: '20px',
          border: '2px solid rgba(255,255,255,0.3)',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Typography sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: '1.1rem'
          }}>
            🌊 Dybde: 10m
          </Typography>
        </Box>
      </Box>

      {/* Age Rating */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        left: 20,
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

export default UnderwaterWorld