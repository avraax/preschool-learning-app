import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { getCategoryTheme } from '../../config/categoryThemes'

interface Game {
  id: string
  title: string
  emoji: string
  route: string
  gradient: string
}

interface GameSelectionLayoutProps {
  categoryId: 'alphabet' | 'math' | 'colors'
  games: Game[]
}

const GameSelectionLayout: React.FC<GameSelectionLayoutProps> = ({ 
  categoryId, 
  games 
}) => {
  const navigate = useNavigate()
  const theme = getCategoryTheme(categoryId)
  
  return (
    <Box sx={{ 
      minHeight: 'calc(var(--vh, 1vh) * 100)',
      background: theme.gradient,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Compact App Bar */}
      <AppBar 
        position="static" 
        color="transparent" 
        elevation={0}
        sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '2rem' }}>
              {theme.icon}
            </Typography>
            <Typography variant="h6" component="div" sx={{ 
              fontWeight: 700,
              color: theme.accentColor
            }}>
              {theme.name}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content with Proper Spacing */}
      <Container 
        maxWidth="lg" 
        sx={{ 
          flex: 1, 
          py: { xs: 3, md: 4 },
          pb: { xs: 4, md: 5 }, // Extra bottom padding
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Games Grid */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Grid 
            container 
            spacing={{ xs: 2, md: 3 }} 
            justifyContent="center"
            sx={{ width: '100%' }}
          >
            {games.map((game, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={game.id}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    onClick={() => navigate(game.route)}
                    sx={{ 
                      height: { xs: 180, sm: 200, md: 220 },
                      cursor: 'pointer',
                      border: '3px solid',
                      borderColor: theme.borderColor,
                      background: game.gradient,
                      color: 'white',
                      '&:hover': {
                        borderColor: theme.hoverBorderColor,
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
                        <Typography sx={{ fontSize: { xs: '4rem', md: '6rem' }, mb: 2 }}>
                          {game.emoji}
                        </Typography>
                        <Typography 
                          variant="h4" 
                          sx={{ 
                            fontWeight: 700,
                            mb: 2,
                            textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                            fontSize: { xs: '1.25rem', md: '1.5rem' }
                          }}
                        >
                          {game.title}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}

export default GameSelectionLayout