import React from 'react'
import { motion } from 'framer-motion'
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
  ArrowBack,
  Quiz,
  School,
  PlayArrow
} from '@mui/icons-material'

interface AlphabetSelectionProps {
  onBack: () => void
  onSelectExercise: (exerciseType: 'quiz' | 'learn') => void
}

const AlphabetSelection: React.FC<AlphabetSelectionProps> = ({ onBack, onSelectExercise }) => {
  const exercises = [
    {
      id: 'learn',
      title: 'Lær Alfabetet',
      description: 'Lær alle bogstaver fra A til Å',
      icon: <School sx={{ fontSize: '4rem' }} />,
      color: 'primary',
      emoji: '📚'
    },
    {
      id: 'quiz',
      title: 'Bogstav Quiz',
      description: 'Find det rigtige bogstav du hører',
      icon: <Quiz sx={{ fontSize: '4rem' }} />,
      color: 'secondary',
      emoji: '🎯'
    }
  ]

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #dbeafe 100%)'
      }}
    >
      {/* App Bar with Back Button */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={onBack}
            color="primary"
            size="large"
            sx={{ 
              bgcolor: 'white', 
              boxShadow: 3,
              '&:hover': { boxShadow: 6 }
            }}
          >
            <ArrowBack />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Title */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h2" 
              sx={{ 
                color: 'primary.dark',
                mb: 2,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <School fontSize="large" /> Bogstaver & Ord
            </Typography>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4 }}>
            Vælg hvad du vil øve! 🎈
          </Typography>
        </Box>

        {/* Exercise Selection Grid */}
        <Grid 
          container 
          spacing={4} 
          sx={{ 
            maxWidth: '800px',
            mx: 'auto',
            mb: 6
          }}
        >
          {exercises.map((exercise, index) => (
            <Grid size={{ xs: 12, md: 6 }} key={exercise.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  onClick={() => onSelectExercise(exercise.id as 'quiz' | 'learn')}
                  sx={{ 
                    minHeight: 200,
                    cursor: 'pointer',
                    border: '3px solid',
                    borderColor: `${exercise.color}.200`,
                    bgcolor: 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: `${exercise.color}.main`,
                      bgcolor: `${exercise.color}.50`,
                      boxShadow: 12
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: 3,
                      textAlign: 'center'
                    }}
                  >
                    <Box sx={{ mb: 2 }}>
                      <Typography sx={{ fontSize: '3rem', mb: 1 }}>
                        {exercise.emoji}
                      </Typography>
                      {exercise.icon}
                    </Box>
                    
                    <Typography 
                      variant="h4"
                      sx={{ 
                        fontWeight: 700,
                        color: `${exercise.color}.dark`,
                        mb: 1
                      }}
                    >
                      {exercise.title}
                    </Typography>
                    
                    <Typography 
                      variant="body1"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {exercise.description}
                    </Typography>

                    <Button
                      variant="contained"
                      color={exercise.color as 'primary' | 'secondary'}
                      startIcon={<PlayArrow />}
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

        {/* Decorative Animation */}
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Typography sx={{ fontSize: '4rem' }}>📖</Typography>
          </motion.div>
        </Box>
      </Container>
    </Box>
  )
}

export default AlphabetSelection