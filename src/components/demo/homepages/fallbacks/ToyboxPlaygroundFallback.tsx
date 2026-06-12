import React, { useRef, useEffect } from 'react'
import { Box, Typography, Grid, Card, CardContent } from '@mui/material'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'

const ToyboxPlaygroundFallback: React.FC = () => {
  const navigate = useNavigate()

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

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 3
    }}>
      {/* Animated background toys */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 15% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 25% 70%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)
        `,
        zIndex: 0
      }} />

      {/* Floating toy emojis */}
      {['🧸', '⚽', '🎲', '🪀', '🎯', '🚂'].map((emoji, index) => (
        <motion.div
          key={emoji}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, -10, 0],
            rotate: [0, 10, -10, 0]
          }}
          transition={{
            duration: 4 + index,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            position: 'absolute',
            fontSize: '2rem',
            opacity: 0.3,
            top: `${20 + index * 10}%`,
            left: `${10 + index * 15}%`,
            zIndex: 0
          }}
        >
          {emoji}
        </motion.div>
      ))}

      {/* Main Content */}
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '800px' }}>
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.6 }}
        >
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
              🧸✨ Legetøjskassen
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              Leg og lær med magiske legetøj!
            </Typography>
          </Box>
        </motion.div>

        {/* Toy Cards Grid */}
        <Grid container spacing={3}>
          {toyOptions.map((toy) => (
            <Grid size={{ xs: 6, md: 3 }} key={toy.title}>
              <ToyCard
                {...toy}
                onClick={() => navigate(toy.route)}
              />
            </Grid>
          ))}
        </Grid>

        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
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
      </Box>
    </Box>
  )
}

export default ToyboxPlaygroundFallback