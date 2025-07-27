import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  IconButton,
  AppBar,
  Toolbar
} from '@mui/material'
import {
  Calculate,
  PlayArrow,
  School,
  Add,
  CompareArrows,
  Psychology
} from '@mui/icons-material'
import { ArrowLeft } from 'lucide-react'
import { DANISH_PHRASES } from '../../config/danish-phrases'

const MathSelection: React.FC = () => {
  const navigate = useNavigate()
  const exercises = [
    {
      id: 'numbers',
      title: 'Lær Tal',
      description: 'Lær alle tal fra 1 til 100',
      icon: <School sx={{ fontSize: '4rem' }} />,
      color: 'primary',
      emoji: '📚'
    },
    {
      id: 'counting',
      title: 'Tal Quiz',
      description: DANISH_PHRASES.descriptions.math.counting,
      icon: <Calculate sx={{ fontSize: '4rem' }} />,
      color: 'secondary',
      emoji: '🎯'
    },
    {
      id: 'addition',
      title: 'Plus Opgaver',
      description: 'Lær at lægge tal sammen (max 10)',
      icon: <Add sx={{ fontSize: '4rem' }} />,
      color: 'success',
      emoji: '➕'
    },
    {
      id: 'comparison',
      title: 'Sammenlign Tal',
      description: 'Lær større end, mindre end (1-10)',
      icon: <CompareArrows sx={{ fontSize: '4rem' }} />,
      color: 'warning',
      emoji: '⚖️'
    },
    {
      id: 'memory',
      title: 'Hukommelsesspil',
      description: DANISH_PHRASES.descriptions.math.memory,
      icon: <Psychology sx={{ fontSize: '4rem' }} />,
      color: 'info',
      emoji: '🧠'
    }
  ]

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        height: '100dvh',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f3e5f5 50%, #fff3e0 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* App Bar with Back Button */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={() => navigate('/')}
            color="primary"
            size="large"
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { 
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container 
        maxWidth="xl" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 }
        }}
      >
        {/* Title - More Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h2" 
              sx={{ 
                fontSize: { xs: '1.75rem', sm: '2.25rem', md: '3rem' },
                color: 'primary.dark',
                mb: 1,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Calculate fontSize="large" /> Matematik
            </Typography>
          </motion.div>
          <Typography 
            variant="h5" 
            color="primary.main" 
            sx={{ fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}
          >
            Vælg hvad du vil lære! 🧮
          </Typography>
        </Box>

        {/* Main Content - Top aligned */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Grid 
            container 
            spacing={{ xs: 2, md: 3 }} 
            sx={{ mb: { xs: 2, md: 3 } }}
          >
          {exercises.map((exercise, index) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={exercise.id}>
              <motion.div
                initial={{ opacity: 0, x: index === 0 ? -30 : index === 2 ? 30 : 0, y: index === 1 ? -30 : 0 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate(exercise.id === 'memory' ? '/learning/memory/numbers' : `/math/${exercise.id}`)}
                  sx={{ 
                    height: { xs: 180, sm: 200, md: 220 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: `${exercise.color}.200`,
                    '&:hover': {
                      borderColor: `${exercise.color}.main`,
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      p: { xs: 2, md: 3 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      textAlign: 'center'
                    }}
                  >
                    <Box>
                      <motion.div
                        animate={{ rotate: [0, 3, -3, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        {React.cloneElement(exercise.icon, {
                          sx: { 
                            fontSize: { xs: '2.5rem', md: '3.5rem' }, 
                            color: `${exercise.color}.main`, 
                            mb: 1 
                          }
                        })}
                      </motion.div>
                      <Typography 
                        variant="h4"
                        sx={{ 
                          fontSize: { xs: '1.25rem', md: '1.5rem' },
                          fontWeight: 700,
                          color: `${exercise.color}.dark`,
                          mb: 0.5
                        }}
                      >
                        {exercise.title}
                      </Typography>
                      <Typography 
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
                      >
                        {exercise.description}
                      </Typography>
                    </Box>

                    <Button
                      variant="contained"
                      color={exercise.color as any}
                      startIcon={<PlayArrow />}
                      fullWidth
                      sx={{ 
                        py: 1, 
                        px: 3,
                        borderRadius: 3,
                        fontSize: '1.1rem'
                      }}
                    >
                      Start
                    </Button>
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

export default MathSelection