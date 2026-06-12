import React, { useState, useEffect } from 'react'
import { Box, Typography, Fab, Grid, Card, CardContent, Slider } from '@mui/material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// Audio Visualizer Component
const AudioVisualizer = ({ isPlaying }: any) => {
  const bars = [...Array(20)].map((_, i) => (
    <motion.div
      key={i}
      style={{
        width: '8px',
        background: `linear-gradient(to top, #FF6B6B, #4ECDC4, #45B7D1)`,
        borderRadius: '4px 4px 0 0',
        margin: '0 2px'
      }}
      animate={isPlaying ? {
        height: [20, Math.random() * 100 + 20, 20],
        opacity: [0.5, 1, 0.5]
      } : { height: 20, opacity: 0.3 }}
      transition={{
        duration: 0.5 + Math.random() * 0.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay: i * 0.1
      }}
    />
  ))

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'end',
      height: '120px',
      padding: '20px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '16px',
      backdropFilter: 'blur(10px)',
      border: '2px solid rgba(255,255,255,0.2)'
    }}>
      {bars}
    </Box>
  )
}

// Musical Note Component
const MusicalNote = ({ note, x, y, delay, color }: any) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: '3rem',
        color: color,
        zIndex: 3,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
      }}
      animate={{
        y: [0, -30, 0],
        x: [0, Math.sin(Date.now() * 0.001) * 20, 0],
        rotate: [0, 10, -10, 0],
        scale: [1, 1.2, 1]
      }}
      transition={{
        duration: 3 + Math.random() * 2,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    >
      {note}
    </motion.div>
  )
}

// Stage Lights Component
const StageLight = ({ color, delay }: any) => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: '10%',
        left: `${Math.random() * 80 + 10}%`,
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}80, transparent)`,
        zIndex: 1
      }}
      animate={{
        scale: [0.5, 1.5, 0.5],
        opacity: [0.3, 0.8, 0.3],
        rotate: [0, 180, 360]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    />
  )
}

// Music Instrument Card
const InstrumentCard = ({ title, icon, description, onClick, color, delay, sound }: any) => {
  const [isPressed, setIsPressed] = useState(false)

  const playSound = () => {
    setIsPressed(true)
    setTimeout(() => setIsPressed(false), 300)
    
    // Create a simple audio tone
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime)
    oscillator.type = sound.type
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
    
    setTimeout(onClick, 500)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 100, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', bounce: 0.6 }}
      whileHover={{ 
        scale: 1.05, 
        rotate: 3,
        transition: { duration: 0.3 }
      }}
      whileTap={{ scale: 0.95 }}
    >
      <Card
        onClick={playSound}
        sx={{
          background: `linear-gradient(135deg, ${color}80, ${color}40)`,
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          border: isPressed ? '4px solid white' : '4px solid rgba(255,255,255,0.4)',
          cursor: 'pointer',
          minHeight: '200px',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          transform: isPressed ? 'scale(0.95)' : 'scale(1)',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 50% 50%, ${color}60, transparent)`,
            opacity: isPressed ? 1 : 0,
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
          zIndex: 2,
          p: 3
        }}>
          <motion.div
            animate={isPressed ? { 
              scale: [1, 1.3, 1],
              rotate: [0, 360, 0]
            } : {
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: isPressed ? 0.5 : 2, repeat: isPressed ? 1 : Infinity }}
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

// Disco Ball Component
const DiscoBall = () => {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: '5%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'conic-gradient(from 0deg, #FFD700, #C0C0C0, #FFD700, #C0C0C0)',
        zIndex: 10,
        filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))'
      }}
      animate={{
        rotate: 360
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'linear'
      }}
    >
      {/* Disco ball squares */}
      {[...Array(16)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            background: i % 2 === 0 ? '#FFD700' : '#C0C0C0',
            left: `${(i % 4) * 25}%`,
            top: `${Math.floor(i / 4) * 25}%`
          }}
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [0.8, 1.2, 0.8]
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.1
          }}
        />
      ))}
    </motion.div>
  )
}

export const MusicFestival: React.FC = () => {
  const navigate = useNavigate()
  const [showWelcome, setShowWelcome] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(70)

  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  const musicalInstruments = [
    {
      title: 'Alfabet Sang',
      icon: '🎤',
      description: 'Syng bogstaverne sammen!',
      route: '/alphabet',
      color: '#fd79a8',
      delay: 0.2,
      sound: { frequency: 261.63, type: 'sine' as OscillatorType } // C4
    },
    {
      title: 'Tal Rytmer',
      icon: '🥁',
      description: 'Bank tallene i takt!',
      route: '/math',
      color: '#74b9ff',
      delay: 0.4,
      sound: { frequency: 329.63, type: 'square' as OscillatorType } // E4
    },
    {
      title: 'Farve Melodi',
      icon: '🎹',
      description: 'Spil regnbuens toner!',
      route: '/farver',
      color: '#fdcb6e',
      delay: 0.6,
      sound: { frequency: 392.00, type: 'triangle' as OscillatorType } // G4
    },
    {
      title: 'Hukommelses Harmonier',
      icon: '🎺',
      description: 'Husk de skjulte melodier!',
      route: '/memory',
      color: '#00b894',
      delay: 0.8,
      sound: { frequency: 523.25, type: 'sawtooth' as OscillatorType } // C5
    }
  ]

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        zIndex: 1
      }
    }}>
      {/* Stage Lights */}
      <StageLight color="#FF6B6B" delay={0} />
      <StageLight color="#4ECDC4" delay={0.5} />
      <StageLight color="#45B7D1" delay={1} />
      <StageLight color="#FFD700" delay={1.5} />

      {/* Disco Ball */}
      <DiscoBall />

      {/* Musical Notes */}
      <MusicalNote note="🎵" x={15} y={30} delay={0} color="#FFD700" />
      <MusicalNote note="🎶" x={85} y={35} delay={0.5} color="#FF6B6B" />
      <MusicalNote note="🎼" x={25} y={70} delay={1} color="#4ECDC4" />
      <MusicalNote note="🎹" x={75} y={75} delay={1.5} color="#96CEB4" />
      <MusicalNote note="🎸" x={50} y={25} delay={2} color="#FD79A8" />

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
              top: '25%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20
            }}
          >
            <Box sx={{
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(25px)',
              borderRadius: '32px',
              border: '3px solid rgba(255,255,255,0.3)',
              p: 5,
              textAlign: 'center',
              maxWidth: '600px',
              position: 'relative'
            }}>
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Typography
                  variant="h3"
                  sx={{
                    fontSize: '4rem',
                    mb: 3
                  }}
                >
                  🎵🎪🎵
                </Typography>
              </motion.div>
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
                Velkommen til Musik Festivalen!
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: 'clamp(1rem, 3vw, 1.4rem)',
                  lineHeight: 1.6,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                Hvor læring danser til musikkens rytme! 🎶
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Controls */}
      <Box sx={{
        position: 'absolute',
        top: '15%',
        right: '5%',
        zIndex: 15
      }}>
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, type: 'spring' }}
        >
          <Box sx={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '2px solid rgba(255,255,255,0.3)',
            p: 3,
            minWidth: '200px'
          }}>
            <Typography
              variant="h6"
              sx={{
                color: 'white',
                fontWeight: 700,
                mb: 2,
                textAlign: 'center',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              🎚️ Musik Kontrol
            </Typography>
            
            <AudioVisualizer isPlaying={isPlaying} volume={volume} />
            
            <Box sx={{ mt: 2 }}>
              <Fab
                onClick={() => setIsPlaying(!isPlaying)}
                sx={{
                  background: isPlaying ? '#FF6B6B' : '#4ECDC4',
                  color: 'white',
                  mr: 2,
                  '&:hover': {
                    transform: 'scale(1.1)',
                    background: isPlaying ? '#FF5252' : '#26C6DA'
                  }
                }}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </Fab>
              
              <Typography
                variant="caption"
                sx={{ color: 'white', display: 'block', mt: 1 }}
              >
                Lydstyrke: {volume}%
              </Typography>
              <Slider
                value={volume}
                onChange={(_, value) => setVolume(value as number)}
                sx={{
                  color: '#FFD700',
                  '& .MuiSlider-thumb': {
                    background: '#FFD700'
                  }
                }}
              />
            </Box>
          </Box>
        </motion.div>
      </Box>

      {/* Musical Instruments */}
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
          {musicalInstruments.map((instrument) => (
            <Grid size={{ xs: 6, md: 3 }} key={instrument.title}>
              <InstrumentCard
                {...instrument}
                onClick={() => navigate(instrument.route)}
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
          🎵
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

      {/* Festival Status */}
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
            🎪 Festival i gang!
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

export default MusicFestival