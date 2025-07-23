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
  Calculate,
  PlayArrow,
  School,
  Add
} from '@mui/icons-material'

interface MathSelectionProps {
  onBack: () => void
  onSelectExercise: (exerciseType: 'counting' | 'numbers' | 'addition') => void
}

const MathSelection: React.FC<MathSelectionProps> = ({ onBack, onSelectExercise }) => {
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
      description: 'Find det rigtige tal du hører',
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
    }
  ]

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f3e5f5 50%, #fff3e0 100%)'
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
              <Calculate fontSize="large" /> Matematik
            </Typography>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4 }}>
            Vælg hvad du vil lære! 🧮
          </Typography>
        </Box>

        {/* Exercise Selection Grid */}
        <Grid 
          container 
          spacing={4} 
          sx={{ 
            maxWidth: '1000px',
            mx: 'auto',
            mb: 6
          }}
        >
          {exercises.map((exercise, index) => (
            <Grid size={{ xs: 12, md: 4 }} key={exercise.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  onClick={() => onSelectExercise(exercise.id as 'counting' | 'numbers' | 'addition')}
                  sx={{ 
                    minHeight: 250,
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
            <Typography sx={{ fontSize: '4rem' }}>🧮</Typography>
          </motion.div>
        </Box>
      </Container>
    </Box>
  )
}

export default MathSelection