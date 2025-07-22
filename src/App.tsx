import { useState } from 'react'
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
  Chip,
  Paper
} from '@mui/material'
import { 
  ArrowBack,
  School,
  Calculate,
  Settings,
  Star
} from '@mui/icons-material'
import AlphabetGame from './components/alphabet/AlphabetGame'
import MathGame from './components/math/MathGame'
import { DifficultyLevel, difficultyManager, difficultySettings } from './utils/difficulty'

type AppScreen = 'home' | 'difficulty' | 'alphabet' | 'math'

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home')
  const [currentDifficulty, setCurrentDifficulty] = useState<DifficultyLevel>(
    difficultyManager.getCurrentLevel()
  )

  const handleDifficultyChange = (level: DifficultyLevel) => {
    setCurrentDifficulty(level)
    difficultyManager.setLevel(level)
    setCurrentScreen('home')
  }

  const renderDifficultySelector = () => (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #dcfce7 0%, #fef3c7 50%, #fed7aa 100%)',
        py: 3
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 4 }}>
          <IconButton 
            onClick={() => setCurrentScreen('home')}
            color="success"
            size="large"
            sx={{ 
              bgcolor: 'white', 
              boxShadow: 3,
              '&:hover': { boxShadow: 6 }
            }}
          >
            <ArrowBack />
          </IconButton>
        </Box>

        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h2" 
              sx={{ 
                color: 'success.dark',
                mb: 2,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Settings fontSize="large" /> Vælg Sværhedsgrad
            </Typography>
          </motion.div>
          <Typography variant="h5" color="success.main" sx={{ mb: 3 }}>
            Vælg det niveau der passer til dit barn
          </Typography>
        </Box>

        <Grid container spacing={4} sx={{ maxWidth: '1000px', mx: 'auto' }}>
          {Object.entries(difficultySettings).map(([level, settings]) => (
            <Grid size={{ xs: 12, md: 4 }} key={level}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => handleDifficultyChange(level as DifficultyLevel)}
                  sx={{ 
                    minHeight: 300,
                    cursor: 'pointer',
                    border: currentDifficulty === level ? 3 : 1,
                    borderColor: currentDifficulty === level ? 'success.main' : 'grey.300',
                    bgcolor: currentDifficulty === level ? 'success.50' : 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'success.main',
                      boxShadow: 8
                    }
                  }}
                >
                  <CardContent sx={{ textAlign: 'center', p: 3 }}>
                    <Typography 
                      variant="h1" 
                      sx={{ 
                        fontSize: '4rem',
                        mb: 3,
                        lineHeight: 1
                      }}
                    >
                      {level === DifficultyLevel.BEGINNER && '🐣'}
                      {level === DifficultyLevel.INTERMEDIATE && '🐱'}
                      {level === DifficultyLevel.ADVANCED && '🦁'}
                    </Typography>
                    
                    <Typography 
                      variant="h4" 
                      color="success.dark"
                      sx={{ fontWeight: 700, mb: 2 }}
                    >
                      {settings.ageRange}
                    </Typography>
                    
                    <Typography 
                      variant="body1" 
                      color="text.secondary"
                      sx={{ mb: 3, lineHeight: 1.6 }}
                    >
                      {settings.description}
                    </Typography>
                    
                    <Paper 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'grey.50',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        📚 Bogstaver: <strong>{settings.alphabet.letters.length}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        🔢 Tal op til: <strong>{settings.math.maxNumber}</strong>
                      </Typography>
                    </Paper>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  )

  const renderHome = () => (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        height: '100vh',
        background: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Container 
        maxWidth="xl" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 }
        }}
      >
        {/* Header - More Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h1" 
              sx={{ 
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                fontWeight: 700,
                color: 'primary.dark',
                mb: 1,
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              🎈 Børnelæring 🌈
            </Typography>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Typography 
              variant="h5" 
              color="primary.main"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}
            >
              Lær alfabetet og tal på en sjov måde!
            </Typography>
          </motion.div>
        </Box>

        {/* Main Content - Single Row Layout */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
            {/* Alphabet Card - Prepared for subcategories */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setCurrentScreen('alphabet')}
                  sx={{ 
                    height: { xs: 200, sm: 240, md: 260 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'primary.200',
                    '&:hover': {
                      borderColor: 'primary.main',
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
                        <School sx={{ 
                          fontSize: { xs: '2.5rem', md: '3.5rem' }, 
                          color: 'primary.main', 
                          mb: 1 
                        }} />
                      </motion.div>
                      <Typography 
                        variant="h4" 
                        color="primary.dark" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '1.25rem', md: '1.5rem' }
                        }}
                      >
                        Alfabetet
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          fontSize: { xs: '0.875rem', md: '1rem' }
                        }}
                      >
                        Bogstaver A-Å
                      </Typography>
                    </Box>
                    <Button 
                      variant="contained" 
                      color="primary"
                      size="small"
                      sx={{ 
                        py: 1,
                        fontSize: { xs: '0.875rem', md: '1rem' }
                      }}
                    >
                      Start læring! 🚀
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Math Card - Prepared for subcategories */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setCurrentScreen('math')}
                  sx={{ 
                    height: { xs: 200, sm: 240, md: 260 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'secondary.200',
                    '&:hover': {
                      borderColor: 'secondary.main',
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
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Calculate sx={{ 
                          fontSize: { xs: '2.5rem', md: '3.5rem' }, 
                          color: 'secondary.main', 
                          mb: 1 
                        }} />
                      </motion.div>
                      <Typography 
                        variant="h4" 
                        color="secondary.dark" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '1.25rem', md: '1.5rem' }
                        }}
                      >
                        Tal og Regning
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          fontSize: { xs: '0.875rem', md: '1rem' }
                        }}
                      >
                        Tæl og regn 1-100
                      </Typography>
                    </Box>
                    <Button 
                      variant="contained" 
                      color="secondary"
                      size="small"
                      sx={{ 
                        py: 1,
                        fontSize: { xs: '0.875rem', md: '1rem' }
                      }}
                    >
                      Start regning! ✨
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Settings Card - Compact */}
            <Grid size={{ xs: 12, sm: 12, lg: 4 }}>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setCurrentScreen('difficulty')}
                  sx={{ 
                    height: { xs: 200, sm: 240, md: 260 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'success.200',
                    '&:hover': {
                      borderColor: 'success.main',
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
                      <Settings sx={{ 
                        fontSize: { xs: '2.5rem', md: '3.5rem' }, 
                        color: 'success.main', 
                        mb: 1 
                      }} />
                      <Typography 
                        variant="h4" 
                        color="success.dark" 
                        sx={{ 
                          mb: 1, 
                          fontWeight: 700,
                          fontSize: { xs: '1.25rem', md: '1.5rem' }
                        }}
                      >
                        Sværhedsgrad
                      </Typography>
                      <Chip 
                        label={difficultySettings[currentDifficulty].ageRange}
                        color="success"
                        variant="outlined"
                        size="small"
                        sx={{ 
                          fontWeight: 600,
                          mb: 2,
                          fontSize: { xs: '0.75rem', md: '0.875rem' }
                        }}
                      />
                    </Box>
                    <Button 
                      variant="outlined" 
                      color="success"
                      size="small"
                      sx={{ 
                        py: 1,
                        fontSize: { xs: '0.875rem', md: '1rem' }
                      }}
                    >
                      Skift niveau
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>

          {/* Bottom Decoration - Smaller */}
          <Box sx={{ textAlign: 'center', mt: 'auto', py: 2 }}>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Star sx={{ fontSize: { xs: '2.5rem', md: '3rem' }, color: 'warning.main' }} />
            </motion.div>
          </Box>
        </Box>
      </Container>
    </Box>
  )

  switch (currentScreen) {
    case 'difficulty':
      return renderDifficultySelector()
    case 'alphabet':
      return <AlphabetGame onBack={() => setCurrentScreen('home')} />
    case 'math':
      return <MathGame onBack={() => setCurrentScreen('home')} />
    default:
      return renderHome()
  }
}

export default App