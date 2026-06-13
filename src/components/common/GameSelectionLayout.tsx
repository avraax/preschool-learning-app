import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
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
  categoryId: 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
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
      height: '100dvh',
      overflow: 'hidden',
      background: theme.gradient,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Compact App Bar */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', flex: '0 0 auto' }}
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

      {/* Main Content — fills remaining height, never scrolls */}
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          minHeight: 0,
          py: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Games grid: rows divide available height so any game count fits without scrolling */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gridAutoRows: 'minmax(0, 1fr)',
            gap: { xs: 1.5, md: 2.5 },
            alignContent: 'center',
            '@media (orientation: landscape)': {
              gridTemplateColumns: games.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'
            }
          }}
        >
          {games.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ height: '100%', minHeight: 0 }}
            >
              <Card
                onClick={() => navigate(game.route)}
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: theme.borderColor,
                  background: game.gradient,
                  color: 'white',
                  borderRadius: '16px',
                  '@media (hover: hover) and (pointer: fine)': {
                    '&:hover': {
                      borderColor: theme.hoverBorderColor,
                      boxShadow: 6,
                      transform: 'translateY(-4px)'
                    }
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                <CardContent sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: { xs: 0.5, md: 1 },
                  p: { xs: 1.5, md: 2 },
                  '&:last-child': { pb: { xs: 1.5, md: 2 } }
                }}>
                  <Typography sx={{
                    fontSize: 'clamp(2rem, 9vh, 4.5rem)',
                    lineHeight: 1
                  }}>
                    {game.emoji}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                      fontSize: 'clamp(0.95rem, 3.2vh, 1.5rem)',
                      lineHeight: 1.1
                    }}
                  >
                    {game.title}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

export default GameSelectionLayout
