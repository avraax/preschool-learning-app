import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { logIOSIssue } from './utils/remoteConsole'
import { deviceInfo } from './utils/deviceDetection'
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

// Import all page components
import AlphabetGame from './components/alphabet/AlphabetGame'
import AlphabetSelection from './components/alphabet/AlphabetSelection'
import AlphabetLearning from './components/alphabet/AlphabetLearning'
import MathGame from './components/math/MathGame'
import MathSelection from './components/math/MathSelection'
import NumberLearning from './components/math/NumberLearning'
import AdditionGame from './components/math/AdditionGame'
import ErrorDashboard from './components/admin/ErrorDashboard'
import PWAInstallPrompt from './components/common/PWAInstallPrompt'
import PWAUpdateNotification from './components/common/PWAUpdateNotification'
import UpdateButton from './components/common/UpdateButton'

// Admin redirect component for query parameter support
const AdminRedirectChecker = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate()
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('admin') === 'errors') {
      navigate('/admin/errors', { replace: true })
    }
  }, [navigate])
  
  return <>{children}</>
}

// Home Page Component
const HomePage = () => {
  const navigate = useNavigate()
  return (
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
        {/* Header */}
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

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
            {/* Alphabet Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 6 }}>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate('/alphabet')}
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

            {/* Math Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 6 }}>
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  onClick={() => navigate('/math')}
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

          {/* Bottom Decoration */}
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
}

// 404 Not Found Component
const NotFoundPage = () => {
  const navigate = useNavigate()
  return (
    <Box 
      sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)'
      }}
    >
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>🎈</Typography>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Siden blev ikke fundet
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
          Siden du leder efter eksisterer ikke.
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          onClick={() => navigate('/')}
        >
          Gå til forsiden 🏠
        </Button>
      </Container>
    </Box>
  )
}

function App() {
  useEffect(() => {
    // Initialize remote console and log device info
    console.log('🎈 Børnelæring App Starting')
    console.log('📱 Device Info:', deviceInfo)
    
    // Log any iOS-specific initialization
    if (deviceInfo.isIOS) {
      logIOSIssue('App Initialization', 'iOS device detected, enhanced debugging active')
    }
  }, [])

  return (
    <>
      <Routes>
        {/* Home Routes */}
        <Route path="/" element={
          <AdminRedirectChecker>
            <HomePage />
          </AdminRedirectChecker>
        } />
        
        {/* Alphabet Routes */}
        <Route path="/alphabet" element={<AlphabetSelection />} />
        <Route path="/alphabet/learn" element={<AlphabetLearning />} />
        <Route path="/alphabet/quiz" element={<AlphabetGame />} />
        
        {/* Math Routes */}
        <Route path="/math" element={<MathSelection />} />
        <Route path="/math/counting" element={<MathGame />} />
        <Route path="/math/numbers" element={<NumberLearning />} />
        <Route path="/math/addition" element={<AdditionGame />} />
        
        {/* Admin Routes */}
        <Route path="/admin/errors" element={<ErrorDashboard />} />
        
        {/* Legacy redirect for old admin access */}
        <Route path="/admin" element={<Navigate to="/admin/errors" replace />} />
        
        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      
      {/* PWA Components - shown globally */}
      <PWAInstallPrompt />
      <PWAUpdateNotification />
      <UpdateButton />
    </>
  )
}

export default App