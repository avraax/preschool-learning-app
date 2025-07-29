import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material'
import { ArrowLeft, Palette } from 'lucide-react'
import { audioManager } from '../../utils/audio'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'

const FarverSelection: React.FC = () => {
  const navigate = useNavigate()
  const encourageCharacter = useCharacterState('encourage')
  
  React.useEffect(() => {
    // Welcome message for color category
    audioManager.speak('Velkommen til farver! Vælg et spil.')
    
    // Character animation
    setTimeout(() => {
      encourageCharacter.encourage()
    }, 1000)
  }, [])

  const colorGames = [
    {
      id: 'farvejagt',
      title: 'Farvejagt',
      description: 'Find og saml alle objekter i den rigtige farve',
      emoji: '🎯',
      route: '/farver/jagt',
      gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FF6B9D 100%)'
    }
    // Future games will be added here
  ]

  return (
    <Box sx={{ 
      minHeight: 'calc(var(--vh, 1vh) * 100)',
      background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 50%, #FFCC80 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* App Bar */}
      <AppBar 
        position="static" 
        color="transparent" 
        elevation={0}
        sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <Toolbar>
          <IconButton 
            edge="start" 
            onClick={() => navigate('/')}
            sx={{ 
              mr: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ 
            flexGrow: 1,
            fontWeight: 700,
            color: '#E65100'
          }}>
            Farver
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Palette size={60} color="#FF6B00" />
              </motion.div>
              <Typography sx={{ fontSize: '4rem' }}>🎨</Typography>
              <LottieCharacter
                character={encourageCharacter.character}
                state={encourageCharacter.state}
                size={80}
                onClick={encourageCharacter.encourage}
              />
            </Box>
            <Typography 
              variant="h2" 
              sx={{ 
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                fontWeight: 700,
                color: '#E65100',
                mb: 1
              }}
            >
              Farver
            </Typography>
            <Typography 
              variant="h5" 
              color="text.secondary"
              sx={{ fontSize: { xs: '1rem', md: '1.5rem' } }}
            >
              Lær om farver gennem sjove spil!
            </Typography>
          </motion.div>
        </Box>

        {/* Games Grid */}
        <Grid container spacing={3} justifyContent="center">
          {colorGames.map((game, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={game.id}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => {
                    audioManager.speak(`Du valgte ${game.title}!`)
                    navigate(game.route)
                  }}
                  sx={{ 
                    height: 250,
                    cursor: 'pointer',
                    border: '3px solid',
                    borderColor: '#FFB74D',
                    background: game.gradient,
                    color: 'white',
                    '&:hover': {
                      borderColor: '#FF6B00',
                      boxShadow: 6,
                      transform: 'translateY(-4px)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  <CardContent sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    textAlign: 'center',
                    p: 3
                  }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: '4rem', mb: 1 }}>
                        {game.emoji}
                      </Typography>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          fontWeight: 700,
                          mb: 2,
                          textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
                        }}
                      >
                        {game.title}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontSize: '1.1rem',
                          opacity: 0.9,
                          lineHeight: 1.4
                        }}
                      >
                        {game.description}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Coming Soon Message */}
        <Box sx={{ textAlign: 'center', mt: 4, opacity: 0.7 }}>
          <Typography variant="body2" color="text.secondary">
            Flere farvespil kommer snart! 🌈
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

export default FarverSelection