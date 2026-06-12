import React, { useState, useEffect } from 'react'
import { Box, Typography, Fab, Card, CardContent } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring, animated } from 'react-spring'
import { useNavigate } from 'react-router-dom'

// Cloud Component with Glassmorphism
const FloatingCloud = ({ size = 1, x, y, delay = 0, children }: any) => {
  const cloudSpring = useSpring({
    from: { transform: 'translateY(0px)' },
    to: async (next) => {
      while (true) {
        await next({ transform: 'translateY(-20px)' })
        await next({ transform: 'translateY(0px)' })
        await next({ transform: 'translateY(10px)' })
        await next({ transform: 'translateY(0px)' })
      }
    },
    config: { duration: 4000 + Math.random() * 2000 },
    delay
  })

  return (
    <animated.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: `${3 * size}rem`,
        filter: 'drop-shadow(0 8px 32px rgba(31, 38, 135, 0.37))',
        zIndex: 2,
        ...cloudSpring,
        transform: 'translate(-50%, -50%)' + (cloudSpring.transform || '')
      }}
    >
      <Box sx={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(20px)',
        borderRadius: '50px',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '80px',
        minHeight: '60px'
      }}>
        {children || '☁️'}
      </Box>
    </animated.div>
  )
}

// Glass Learning Portal
const GlassPortal = ({ title, icon, description, onClick, position, color, delay }: any) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const hoverSpring = useSpring({
    transform: isHovered ? 'scale(1.05) translateY(-10px)' : 'scale(1) translateY(0px)',
    background: isHovered 
      ? `rgba(255, 255, 255, 0.25)` 
      : `rgba(255, 255, 255, 0.15)`,
    config: { tension: 300, friction: 20 }
  })

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
      initial={{ opacity: 0, scale: 0, y: 100 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        delay: delay || 0, 
        type: 'spring', 
        bounce: 0.6,
        duration: 1 
      }}
    >
      <animated.div
        style={hoverSpring}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        <Card sx={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(25px)',
          borderRadius: '30px',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          cursor: 'pointer',
          minWidth: '220px',
          minHeight: '200px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, ${color}30, transparent)`,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }
        }}>
          <CardContent sx={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            height: '100%',
            position: 'relative',
            zIndex: 2,
            p: 3
          }}>
            <motion.div
              animate={isHovered ? { 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              } : {}}
              transition={{ duration: 0.6 }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontSize: '4rem',
                  mb: 2,
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
                }}
              >
                {icon}
              </Typography>
            </motion.div>
            
            <Typography
              variant="h6"
              sx={{
                color: 'white',
                fontWeight: 700,
                mb: 1,
                fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(0.8rem, 2vw, 1rem)',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                lineHeight: 1.4
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

// Flying Birds
const FlyingBirds = () => {
  const birds = [...Array(5)].map((_, i) => (
    <motion.div
      key={i}
      style={{
        position: 'absolute',
        fontSize: '2rem',
        zIndex: 1
      }}
      animate={{
        x: ['-10vw', '110vw'],
        y: [
          `${20 + i * 10}vh`,
          `${15 + i * 10}vh`,
          `${25 + i * 10}vh`,
          `${20 + i * 10}vh`
        ]
      }}
      transition={{
        duration: 15 + i * 2,
        repeat: Infinity,
        delay: i * 3,
        ease: 'linear'
      }}
    >
      🕊️
    </motion.div>
  ))

  return <>{birds}</>
}

// Floating Rainbow
const FloatingRainbow = () => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '6rem',
        zIndex: 1
      }}
      animate={{
        scale: [1, 1.1, 1],
        rotate: [0, 5, -5, 0]
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      🌈
    </motion.div>
  )
}

export const CloudKingdom: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'sunset' | 'night'>('day')

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4500)
    return () => clearTimeout(timer)
  }, [])

  const backgrounds = {
    day: 'linear-gradient(135deg, #87CEEB 0%, #98CDF0 50%, #BFEFFF 100%)',
    sunset: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 50%, #FF8E53 100%)',
    night: 'linear-gradient(135deg, #2C3E50 0%, #3498DB 50%, #9B59B6 100%)'
  }

  const learningPortals = [
    {
      title: 'Alfabet Skyer',
      icon: '🔤',
      description: 'Flyv mellem bogstavskyer',
      route: '/alphabet',
      position: { x: 25, y: 45 },
      color: '#74b9ff',
      delay: 0.5
    },
    {
      title: 'Tal Stjerner',
      icon: '⭐',
      description: 'Tæl stjerner på himlen',
      route: '/math',
      position: { x: 75, y: 45 },
      color: '#00b894',
      delay: 0.8
    },
    {
      title: 'Regnbue Farver',
      icon: '🌈',
      description: 'Male med himlens farver',
      route: '/farver',
      position: { x: 25, y: 75 },
      color: '#fd79a8',
      delay: 1.1
    },
    {
      title: 'Drømme Palads',
      icon: '🏰',
      description: 'Udforsk hukommelsens slot',
      route: '/memory',
      position: { x: 75, y: 75 },
      color: '#fdcb6e',
      delay: 1.4
    }
  ]

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: backgrounds[timeOfDay],
      transition: 'background 2s ease'
    }}>
      {/* Background Clouds */}
      <FloatingCloud size={1.2} x={15} y={25} delay={0} />
      <FloatingCloud size={0.8} x={85} y={30} delay={500} />
      <FloatingCloud size={1.0} x={50} y={20} delay={300} />
      <FloatingCloud size={0.6} x={30} y={80} delay={700} />
      <FloatingCloud size={0.9} x={70} y={85} delay={400} />
      <FloatingCloud size={1.1} x={10} y={60} delay={600} />
      <FloatingCloud size={0.7} x={90} y={65} delay={200} />

      {/* Flying Elements */}
      <FlyingBirds />
      <FloatingRainbow />

      {/* Sun/Moon Toggle */}
      <motion.div
        style={{
          position: 'absolute',
          top: '10%',
          right: '10%',
          fontSize: '4rem',
          cursor: 'pointer',
          zIndex: 10
        }}
        whileHover={{ scale: 1.2, rotate: 10 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          const times: Array<'day' | 'sunset' | 'night'> = ['day', 'sunset', 'night']
          const currentIndex = times.indexOf(timeOfDay)
          setTimeOfDay(times[(currentIndex + 1) % times.length])
        }}
      >
        {timeOfDay === 'day' ? '☀️' : timeOfDay === 'sunset' ? '🌅' : '🌙'}
      </motion.div>

      {/* Welcome Message */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: -100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.3, y: 100 }}
            transition={{ type: 'spring', bounce: 0.8 }}
            style={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}
          >
            <Box sx={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(30px)',
              borderRadius: '40px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              p: 5,
              textAlign: 'center',
              maxWidth: '600px',
              boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)'
            }}>
              <Typography
                variant="h3"
                sx={{
                  fontSize: '3rem',
                  mb: 3
                }}
              >
                ☁️✨
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: 'white',
                  fontWeight: 700,
                  mb: 2,
                  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                Velkommen til Sky Kongeriget!
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: 'clamp(1rem, 3vw, 1.4rem)',
                  lineHeight: 1.6,
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}
              >
                Hvor drømme og læring flyver sammen blandt skyerne! ☁️
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Learning Portals */}
      {learningPortals.map((portal) => (
        <GlassPortal
          key={portal.title}
          {...portal}
          onClick={() => navigate(portal.route)}
        />
      ))}

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
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.3)',
              transform: 'scale(1.1) translateY(-2px)'
            }
          }}
        >
          🏠
        </Fab>
        <Fab
          onClick={() => setShowWelcome(!showWelcome)}
          sx={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.3)',
              transform: 'scale(1.1) translateY(-2px)'
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
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          px: 3,
          py: 1,
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)'
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

      {/* Weather Indicator */}
      <Box sx={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        zIndex: 30
      }}>
        <Box sx={{
          background: 'rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          px: 3,
          py: 1,
          boxShadow: '0 8px 32px rgba(31, 38, 135, 0.37)'
        }}>
          <Typography sx={{
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem'
          }}>
            {timeOfDay === 'day' ? '☀️ Solskin' : timeOfDay === 'sunset' ? '🌅 Solnedgang' : '🌙 Natt'}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default CloudKingdom