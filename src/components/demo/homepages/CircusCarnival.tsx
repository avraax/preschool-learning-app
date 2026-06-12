import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Fab, Grid, Card, CardContent } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'

// Circus Tent Component
const CircusTent = ({ children }: { children: React.ReactNode }) => {
  return (
    <Box sx={{
      position: 'relative',
      width: '300px',
      height: '250px',
      margin: '0 auto 20px',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '150px solid transparent',
        borderRight: '150px solid transparent',
        borderBottom: '200px solid #ff4757',
        zIndex: 1
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: '160px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '260px',
        height: '90px',
        background: '#ff3742',
        borderRadius: '0 0 130px 130px',
        zIndex: 1
      }
    }}>
      {/* Tent Stripes */}
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: `${20 + i * 30}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: `${280 - i * 40}px`,
            height: '20px',
            background: i % 2 === 0 ? '#ff6b7a' : '#ff4757',
            zIndex: 2
          }}
        />
      ))}
      
      {/* Content Area */}
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        textAlign: 'center'
      }}>
        {children}
      </Box>
    </Box>
  )
}

// Juggling Balls Component
const JugglingBalls = () => {
  const balls = [...Array(3)].map((_, i) => (
    <motion.div
      key={i}
      style={{
        position: 'absolute',
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: ['#ff6b6b', '#4ecdc4', '#45b7d1'][i],
        fontSize: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      animate={{
        x: [0, 100, 200, 100, 0],
        y: [0, -150, 0, -100, 0],
        rotate: [0, 360, 720, 1080, 1440]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        delay: i * 0.3,
        ease: "easeInOut"
      }}
    >
      {['🔴', '🔵', '🟡'][i]}
    </motion.div>
  ))

  return (
    <Box sx={{
      position: 'absolute',
      top: '20%',
      left: '10%',
      width: '200px',
      height: '200px'
    }}>
      {balls}
    </Box>
  )
}

// Ferris Wheel Component
const FerrisWheel = () => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: '15%',
        right: '10%',
        width: '150px',
        height: '150px',
        borderRadius: '50%',
        border: '8px solid #fdcb6e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
    >
      {/* Ferris Wheel Cars */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: '20px',
            height: '15px',
            background: '#ff7675',
            borderRadius: '4px',
            transform: `rotate(${i * 45}deg) translateY(-65px)`,
            fontSize: '1rem'
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        >
          🎪
        </motion.div>
      ))}
    </motion.div>
  )
}

// Circus Performer Cards
const CircusCard = ({ title, icon, description, onClick, color, delay }: any) => {
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#fdcb6e', '#fd79a8']
    })
  }

  const handleClick = () => {
    triggerConfetti()
    setTimeout(onClick, 300)
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 100, rotate: -10 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay, type: 'spring', bounce: 0.6 }}
      whileHover={{ 
        scale: 1.05, 
        rotate: 5,
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card
        onClick={handleClick}
        sx={{
          background: `linear-gradient(135deg, ${color}80, ${color}40)`,
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          border: '4px solid rgba(255,255,255,0.4)',
          cursor: 'pointer',
          minHeight: '200px',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-2px',
            left: '-2px',
            right: '-2px',
            bottom: '-2px',
            background: `linear-gradient(45deg, ${color}, transparent, ${color})`,
            borderRadius: '26px',
            zIndex: -1,
            opacity: isHovered ? 0.8 : 0,
            transition: 'opacity 0.3s ease'
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
          zIndex: 2
        }}>
          <motion.div
            animate={isHovered ? { 
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0]
            } : {}}
            transition={{ duration: 0.5 }}
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

export const CircusCarnival: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000)
    
    // Welcome confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#fdcb6e', '#fd79a8']
    })
    
    return () => clearTimeout(timer)
  }, [])

  const circusActs = [
    {
      title: 'Alfabet Akrobater',
      icon: '🤹‍♂️',
      description: 'Se bogstaverne hoppe og danse!',
      route: '/alphabet',
      color: '#ff6b6b',
      delay: 0.2
    },
    {
      title: 'Tal Tryllekunstnere',
      icon: '🎭',
      description: 'Tal der forsvinder og dukker op igen!',
      route: '/math',
      color: '#4ecdc4',
      delay: 0.4
    },
    {
      title: 'Farve Klovne',
      icon: '🤡',
      description: 'Morsomme klovne der leger med farver!',
      route: '/farver',
      color: '#fdcb6e',
      delay: 0.6
    },
    {
      title: 'Hukommelses Show',
      icon: '🎪',
      description: 'Det største mindespil under teltdugen!',
      route: '/memory',
      color: '#fd79a8',
      delay: 0.8
    }
  ]

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(135deg, #ff7675 0%, #fab1a0 50%, #fdcb6e 100%)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'url("data:image/svg+xml,%3Csvg width="20" height="20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23ffffff" fill-opacity="0.1"%3E%3Ccircle cx="3" cy="3" r="3"/%3E%3Ccircle cx="13" cy="13" r="3"/%3E%3C/g%3E%3C/svg%3E")',
        zIndex: 1
      }
    }}>
      {/* Animated Background Elements */}
      <JugglingBalls />
      <FerrisWheel />

      {/* Floating Balloons */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`balloon-${i}`}
          style={{
            position: 'absolute',
            left: `${10 + i * 15}%`,
            top: `${80 + Math.sin(i) * 10}%`,
            fontSize: '3rem',
            zIndex: 2
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, Math.sin(i) * 10, 0],
            rotate: [0, 5, -5, 0]
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          🎈
        </motion.div>
      ))}

      {/* Welcome Message */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, rotate: -45 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.3, rotate: 45 }}
            transition={{ type: 'spring', bounce: 0.8 }}
            style={{
              position: 'absolute',
              top: '25%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}
          >
            <CircusTent>
              <Typography
                variant="h4"
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 2,
                  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.7)'
                }}
              >
                Velkommen til Cirkusset!
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: 'clamp(1rem, 3vw, 1.3rem)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}
              >
                Det største læringsspektakel på jorden! 🎪
              </Typography>
            </CircusTent>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circus Acts */}
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
          {circusActs.map((act) => (
            <Grid size={{ xs: 6, md: 3 }} key={act.title}>
              <CircusCard
                {...act}
                onClick={() => navigate(act.route)}
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
            border: '3px solid rgba(255,255,255,0.4)',
            '&:hover': {
              background: 'rgba(255,255,255,0.3)',
              transform: 'scale(1.1) rotate(10deg)'
            }
          }}
        >
          🏠
        </Fab>
        <Fab
          onClick={() => setShowWelcome(!showWelcome)}
          sx={{
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(15px)',
            color: 'white',
            border: '3px solid rgba(255,255,255,0.4)',
            '&:hover': {
              background: 'rgba(255,255,255,0.3)',
              transform: 'scale(1.1) rotate(-10deg)'
            }
          }}
        >
          🎪
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
          border: '3px solid rgba(255,255,255,0.4)',
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

export default CircusCarnival