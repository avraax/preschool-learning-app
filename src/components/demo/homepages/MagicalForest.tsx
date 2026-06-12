import React, { useState, useEffect } from 'react'
import { Box, Typography, Fab, Card, CardContent } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring, animated } from 'react-spring'
import { useNavigate } from 'react-router-dom'

// Floating Animal Component
const FloatingAnimal = ({ emoji, x, y, delay = 0, speed = 2000 }: any) => {
  const floatAnimation = useSpring({
    from: { transform: 'translateY(0px) rotate(0deg)' },
    to: async (next) => {
      while (true) {
        await next({ transform: 'translateY(-20px) rotate(5deg)' })
        await next({ transform: 'translateY(0px) rotate(-5deg)' })
        await next({ transform: 'translateY(10px) rotate(0deg)' })
        await next({ transform: 'translateY(0px) rotate(0deg)' })
      }
    },
    config: { duration: speed },
    delay
  })

  return (
    <animated.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: '3rem',
        zIndex: 5,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
        cursor: 'pointer',
        ...floatAnimation
      }}
    >
      {emoji}
    </animated.div>
  )
}

// Tree Component with Spring Animation
const AnimatedTree = ({ x, y, size = 1, delay = 0 }: any) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const treeSpring = useSpring({
    transform: isHovered ? 'scale(1.2) rotate(5deg)' : 'scale(1) rotate(0deg)',
    config: { tension: 300, friction: 10 }
  })

  const leavesSpring = useSpring({
    from: { transform: 'rotate(0deg)' },
    to: async (next) => {
      while (true) {
        await next({ transform: 'rotate(2deg)' })
        await next({ transform: 'rotate(-2deg)' })
      }
    },
    config: { duration: 3000 + Math.random() * 2000 },
    delay
  })

  return (
    <animated.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: `${3 * size}rem`,
        zIndex: 3,
        cursor: 'pointer',
        ...treeSpring
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <animated.div style={leavesSpring}>
        🌳
      </animated.div>
    </animated.div>
  )
}

// Learning Portal Component
const LearningPortal = ({ title, icon, description, onClick, position, color }: any) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const portalSpring = useSpring({
    transform: isHovered ? 'scale(1.1) translateY(-10px)' : 'scale(1) translateY(0px)',
    boxShadow: isHovered 
      ? '0 20px 40px rgba(0,0,0,0.3), 0 0 30px rgba(255,255,255,0.2)' 
      : '0 10px 20px rgba(0,0,0,0.2)',
    config: { tension: 400, friction: 25 }
  })

  const glowSpring = useSpring({
    from: { opacity: 0.5 },
    to: async (next) => {
      while (true) {
        await next({ opacity: 1 })
        await next({ opacity: 0.5 })
      }
    },
    config: { duration: 2000 }
  })

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: position.delay || 0, type: 'spring', bounce: 0.5 }}
    >
      <animated.div
        style={portalSpring}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        <Card sx={{
          background: `linear-gradient(135deg, ${color}60, ${color}30)`,
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '3px solid rgba(255,255,255,0.4)',
          cursor: 'pointer',
          minWidth: '200px',
          minHeight: '180px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Glow Effect */}
          <animated.div
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              right: -2,
              bottom: -2,
              background: `linear-gradient(45deg, ${color}, transparent, ${color})`,
              borderRadius: '26px',
              zIndex: -1,
              ...glowSpring
            }}
          />
          
          <CardContent sx={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: '100%',
            position: 'relative',
            zIndex: 2
          }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: '4rem',
                mb: 1,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
              }}
            >
              {icon}
            </Typography>
            <Typography
              variant="h6"
              sx={{
                color: 'white',
                fontWeight: 700,
                mb: 1,
                fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(0.8rem, 2vw, 1rem)',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}
            >
              {description}
            </Typography>
          </CardContent>
        </Card>
      </animated.div>
    </motion.div>
  )
}

// Particle System for magical effects
const MagicalParticles = () => {
  const particles = [...Array(20)].map((_, i) => {
    const delay = i * 200
    const x = Math.random() * 100
    const y = Math.random() * 100
    
    return (
      <motion.div
        key={i}
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          fontSize: '1rem',
          zIndex: 1
        }}
        animate={{
          y: [0, -100, 0],
          opacity: [0, 1, 0],
          scale: [0, 1, 0]
        }}
        transition={{
          duration: 3 + Math.random() * 2,
          repeat: Infinity,
          delay: delay / 1000,
          ease: 'easeOut'
        }}
      >
        ✨
      </motion.div>
    )
  })

  return <>{particles}</>
}

export const MagicalForest: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [currentTime, setCurrentTime] = useState('dag')

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4500)
    return () => clearTimeout(timer)
  }, [])

  const learningPortals = [
    {
      title: 'Alfabet Eventyr',
      icon: '📖',
      description: 'Lær bogstaver med skovens dyr',
      route: '/alphabet',
      position: { x: 25, y: 40, delay: 0.5 },
      color: '#74b9ff'
    },
    {
      title: 'Tal Træer',
      icon: '🔢',
      description: 'Tæl blade og grene',
      route: '/math',
      position: { x: 75, y: 40, delay: 0.8 },
      color: '#00b894'
    },
    {
      title: 'Farve Blomster',
      icon: '🌺',
      description: 'Udforsk naturens farver',
      route: '/farver',
      position: { x: 25, y: 70, delay: 1.1 },
      color: '#fd79a8'
    },
    {
      title: 'Hukommelses Hule',
      icon: '🧠',
      description: 'Find skovens skjulte skatte',
      route: '/memory',
      position: { x: 75, y: 70, delay: 1.4 },
      color: '#fdcb6e'
    }
  ]

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: currentTime === 'dag' 
        ? 'linear-gradient(180deg, #87CEEB 0%, #98FB98 30%, #228B22 70%, #006400 100%)'
        : 'linear-gradient(180deg, #191970 0%, #483D8B 30%, #2F4F4F 70%, #000000 100%)'
    }}>
      {/* Magical Particles */}
      <MagicalParticles />

      {/* Animated Trees */}
      <AnimatedTree x={5} y={60} size={1.2} delay={0} />
      <AnimatedTree x={15} y={50} size={0.8} delay={500} />
      <AnimatedTree x={85} y={55} size={1.0} delay={300} />
      <AnimatedTree x={95} y={65} size={0.9} delay={700} />
      <AnimatedTree x={50} y={75} size={1.1} delay={200} />

      {/* Floating Forest Animals */}
      <FloatingAnimal emoji="🦉" x={10} y={25} delay={0} speed={2500} />
      <FloatingAnimal emoji="🐿️" x={85} y={30} delay={500} speed={2200} />
      <FloatingAnimal emoji="🦋" x={20} y={45} delay={300} speed={1800} />
      <FloatingAnimal emoji="🐰" x={70} y={80} delay={700} speed={2800} />
      <FloatingAnimal emoji="🦔" x={40} y={85} delay={400} speed={2400} />
      <FloatingAnimal emoji="🐝" x={60} y={20} delay={600} speed={1500} />

      {/* Welcome Message */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: -100 }}
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
              maxWidth: '500px',
              position: 'relative'
            }}>
              {/* Magical border effect */}
              <Box sx={{
                position: 'absolute',
                top: -3,
                left: -3,
                right: -3,
                bottom: -3,
                background: 'linear-gradient(45deg, #FFD700, #FF69B4, #00CED1, #FFD700)',
                borderRadius: '35px',
                zIndex: -1,
                animation: 'borderGlow 2s linear infinite',
                '@keyframes borderGlow': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' }
                }
              }} />
              
              <Typography
                variant="h3"
                sx={{
                  fontSize: '3rem',
                  mb: 2
                }}
              >
                🌲✨
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
                Velkommen til den Magiske Skov!
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
                Hvor læring og magi mødes i naturens hjem! 🦋
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Learning Portals */}
      {learningPortals.map((portal) => (
        <LearningPortal
          key={portal.title}
          {...portal}
          onClick={() => navigate(portal.route)}
        />
      ))}

      {/* Day/Night Toggle */}
      <Box sx={{
        position: 'absolute',
        top: 20,
        right: 100,
        zIndex: 30
      }}>
        <Fab
          onClick={() => setCurrentTime(currentTime === 'dag' ? 'nat' : 'dag')}
          sx={{
            background: currentTime === 'dag' 
              ? 'linear-gradient(135deg, #FFD700, #FFA500)'
              : 'linear-gradient(135deg, #191970, #483D8B)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            '&:hover': {
              transform: 'scale(1.1) rotate(180deg)',
              transition: 'transform 0.5s ease'
            }
          }}
        >
          {currentTime === 'dag' ? '☀️' : '🌙'}
        </Fab>
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

export default MagicalForest