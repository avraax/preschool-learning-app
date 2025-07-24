import { useState, useEffect } from 'react'
import { logIOSIssue } from './utils/remoteConsole'
import { deviceInfo } from './utils/deviceDetection'
import { motion } from 'framer-motion'
import { 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Typography, 
  Box
} from '@mui/material'
import { 
  School,
  Calculate,
  Star
} from '@mui/icons-material'
import AlphabetGame from './components/alphabet/AlphabetGame'
import AlphabetSelection from './components/alphabet/AlphabetSelection'
import AlphabetLearning from './components/alphabet/AlphabetLearning'
import MathGame from './components/math/MathGame'
import MathSelection from './components/math/MathSelection'
import NumberLearning from './components/math/NumberLearning'
import AdditionGame from './components/math/AdditionGame'

type AppScreen = 'home' | 'alphabet-selection' | 'alphabet-quiz' | 'alphabet-learn' | 'math-selection' | 'math-counting' | 'math-numbers' | 'math-addition'

function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home')

  useEffect(() => {
    // Initialize remote console and log device info
    console.log('🎈 Børnelæring App Starting')
    console.log('📱 Device Info:', deviceInfo)
    
    // Log any iOS-specific initialization
    if (deviceInfo.isIOS) {
      logIOSIssue('App Initialization', 'iOS device detected, enhanced debugging active')
    }
  }, [])


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
            <Grid size={{ xs: 12, sm: 6, lg: 6 }}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setCurrentScreen('alphabet-selection')}
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
                        Bogstaver & Ord
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          fontSize: { xs: '0.875rem', md: '1rem' }
                        }}
                      >
                        Lær & øv bogstaver
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
            <Grid size={{ xs: 12, sm: 6, lg: 6 }}>
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => setCurrentScreen('math-selection')}
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
    case 'alphabet-selection':
      return (
        <AlphabetSelection 
          onBack={() => setCurrentScreen('home')}
          onSelectExercise={(exerciseType) => {
            if (exerciseType === 'quiz') {
              setCurrentScreen('alphabet-quiz')
            } else if (exerciseType === 'learn') {
              setCurrentScreen('alphabet-learn')
            }
          }}
        />
      )
    case 'alphabet-quiz':
      return <AlphabetGame onBack={() => setCurrentScreen('alphabet-selection')} />
    case 'alphabet-learn':
      return <AlphabetLearning onBack={() => setCurrentScreen('alphabet-selection')} />
    case 'math-selection':
      return (
        <MathSelection 
          onBack={() => setCurrentScreen('home')}
          onSelectExercise={(exerciseType) => {
            if (exerciseType === 'counting') {
              setCurrentScreen('math-counting')
            } else if (exerciseType === 'numbers') {
              setCurrentScreen('math-numbers')
            } else if (exerciseType === 'addition') {
              setCurrentScreen('math-addition')
            }
          }}
        />
      )
    case 'math-counting':
      return <MathGame onBack={() => setCurrentScreen('math-selection')} />
    case 'math-numbers':
      return <NumberLearning onBack={() => setCurrentScreen('math-selection')} />
    case 'math-addition':
      return <AdditionGame onBack={() => setCurrentScreen('math-selection')} />
    default:
      return renderHome()
  }
}

export default App