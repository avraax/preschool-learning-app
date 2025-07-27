import React, { useEffect } from 'react'
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
  ArrowLeft,
  BookOpen,
  Brain,
  Play,
  Star
} from 'lucide-react'

// Import all page components
import AlphabetGame from './components/alphabet/AlphabetGame'
import AlphabetSelection from './components/alphabet/AlphabetSelection'
import AlphabetLearning from './components/alphabet/AlphabetLearning'
import MathGame from './components/math/MathGame'
import MathSelection from './components/math/MathSelection'
import NumberLearning from './components/math/NumberLearning'
import AdditionGame from './components/math/AdditionGame'
import ComparisonGame from './components/math/ComparisonGame'
import MemoryGame from './components/learning/MemoryGame'
import ErrorDashboard from './components/admin/ErrorDashboard'
import UpdateBanner from './components/common/UpdateBanner'

// Flip Demo Components
import FlipDemoSelection from './components/flip-demos/FlipDemoSelection'
import CSSClassFlip from './components/flip-demos/CSSClassFlip'
import InlineStyleFlip from './components/flip-demos/InlineStyleFlip'
import WebAnimationsFlip from './components/flip-demos/WebAnimationsFlip'
import OpacityScaleFlip from './components/flip-demos/OpacityScaleFlip'
import AbsolutePositionFlip from './components/flip-demos/AbsolutePositionFlip'
import LottieCharacter, { useCharacterState } from './components/common/LottieCharacter'
import { useUpdateChecker } from './hooks/useUpdateChecker'

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
  const welcomeCharacter = useCharacterState('wave')
  
  React.useEffect(() => {
    // Welcome animation sequence
    const timer = setTimeout(() => {
      welcomeCharacter.wave()
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Box 
      sx={{ 
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
        {/* Header with Welcome Character */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <Typography 
                variant="h1" 
                sx={{ 
                  fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                  fontWeight: 700,
                  color: 'primary.dark',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                🎈 Børnelæring 🌈
              </Typography>
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <LottieCharacter
                  character={welcomeCharacter.character}
                  state={welcomeCharacter.state}
                  size={80}
                  onClick={welcomeCharacter.wave}
                />
              </motion.div>
            </Box>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <Play size={20} color="#1976d2" />
              <Typography 
                variant="h5" 
                color="primary.main"
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } }}
              >
                Lær med sjove spil!
              </Typography>
              <BookOpen size={20} color="#1976d2" />
            </Box>
          </motion.div>
        </Box>

        {/* Main Content */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          minHeight: 0
        }}>
          <Grid 
            container 
            spacing={{ xs: 2, md: 3 }} 
            sx={{ 
              mb: { xs: 2, md: 3 },
              height: { xs: 'auto', md: '60%' },
              maxHeight: { xs: '500px', md: '600px' }
            }}
          >
            {/* Alphabet Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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
                    height: '100%',
                    minHeight: { xs: 180, sm: 220, md: 240 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'primary.200',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      borderColor: 'primary.main',
                      boxShadow: 6
                    },
                    // Orientation specific adjustments
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 160, sm: 180, md: 200 }
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      p: { xs: 2, md: 3 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        right: { xs: 16, md: 24 },
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 0,
                        height: 0,
                        borderTop: '12px solid transparent',
                        borderBottom: '12px solid transparent',
                        borderLeft: '16px solid #1976d2',
                        opacity: 0.5
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                      <motion.div
                        animate={{ rotate: [0, 3, -3, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <BookOpen size={48} color="#1976d2" />
                      </motion.div>
                      <Typography sx={{ fontSize: '3.5rem' }}>🔤</Typography>
                      <LottieCharacter
                        character="owl"
                        state="thinking"
                        size={60}
                        loop={true}
                      />
                    </Box>
                    <Typography 
                      variant="h4" 
                      color="primary.dark" 
                      sx={{ 
                        mb: 1, 
                        fontWeight: 700,
                        fontSize: { xs: '1.5rem', md: '1.75rem' }
                      }}
                    >
                      Alfabetet
                    </Typography>
                    <Typography 
                      variant="body1" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: { xs: '0.875rem', md: '1rem' },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5
                      }}
                    >
                      3 øvelser <Typography component="span" sx={{ fontSize: '1.2rem' }}>→</Typography>
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            {/* Math Card */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
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
                    height: '100%',
                    minHeight: { xs: 180, sm: 220, md: 240 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'secondary.200',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': {
                      borderColor: 'secondary.main',
                      boxShadow: 6
                    },
                    // Orientation specific adjustments
                    '@media (orientation: landscape)': {
                      minHeight: { xs: 160, sm: 180, md: 200 }
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      p: { xs: 2, md: 3 },
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        right: { xs: 16, md: 24 },
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 0,
                        height: 0,
                        borderTop: '12px solid transparent',
                        borderBottom: '12px solid transparent',
                        borderLeft: '16px solid #9c27b0',
                        opacity: 0.5
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
                      <motion.div
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Brain size={48} color="#9c27b0" />
                      </motion.div>
                      <Typography sx={{ fontSize: '3.5rem' }}>🧮</Typography>
                      <LottieCharacter
                        character="fox"
                        state="thinking"
                        size={60}
                        loop={true}
                      />
                    </Box>
                    <Typography 
                      variant="h4" 
                      color="secondary.dark" 
                      sx={{ 
                        mb: 1, 
                        fontWeight: 700,
                        fontSize: { xs: '1.5rem', md: '1.75rem' }
                      }}
                    >
                      Tal og Regning
                    </Typography>
                    <Typography 
                      variant="body1" 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: { xs: '0.875rem', md: '1rem' },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5
                      }}
                    >
                      5 øvelser <Typography component="span" sx={{ fontSize: '1.2rem' }}>→</Typography>
                    </Typography>
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
              <Star size={48} color="#ff9800" />
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
  const sadCharacter = useCharacterState('encourage')
  
  React.useEffect(() => {
    sadCharacter.encourage()
  }, [])

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
        <Box sx={{ mb: 3 }}>
          <LottieCharacter
            character={sadCharacter.character}
            state={sadCharacter.state}
            size={120}
            onClick={sadCharacter.encourage}
          />
        </Box>
        <Typography variant="h1" sx={{ fontSize: '4rem', mb: 2 }}>🎈</Typography>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Hovsa! 🤔
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary', fontSize: '1.2rem' }}>
          Denne side findes ikke 🔍
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          startIcon={<ArrowLeft size={24} />}
          onClick={() => navigate('/')}
          sx={{ py: 1.5, px: 3, fontSize: '1.1rem', borderRadius: 3 }}
        >
          🏠 Hjem
        </Button>
      </Container>
    </Box>
  )
}

function App() {
  // Initialize update checker
  const updateStatus = useUpdateChecker()
  
  // DEV MODE: Set to true to test update banner styling
  // This allows you to see and adjust the UpdateBanner without waiting for a real update
  const DEV_SHOW_UPDATE_BANNER = false // Change to true to test the banner
  const DEV_SHOW_APPLYING_STATE = false // Change to true to test the "applying" state
  
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
      {/* Update Button - shown in lower right when update available */}
      <UpdateBanner
        show={updateStatus.updateAvailable || DEV_SHOW_UPDATE_BANNER}
        onUpdate={DEV_SHOW_UPDATE_BANNER ? () => {
          console.log('🧪 DEV MODE: Update button clicked!')
          console.log('🧪 DEV MODE: This is just a test - no actual update will happen')
        } : updateStatus.applyUpdate}
        isApplying={DEV_SHOW_APPLYING_STATE}
      />
      
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
        <Route path="/math/comparison" element={<ComparisonGame />} />
        
        {/* Learning Routes */}
        <Route path="/learning/memory/:type" element={<MemoryGame />} />
        
        {/* Admin Routes */}
        <Route path="/admin/errors" element={<ErrorDashboard />} />
        
        {/* Legacy redirect for old admin access */}
        <Route path="/admin" element={<Navigate to="/admin/errors" replace />} />
        
        {/* Flip Demo Routes */}
        <Route path="/flip-demo" element={<FlipDemoSelection />} />
        <Route path="/flip-demo/css-class" element={<CSSClassFlip />} />
        <Route path="/flip-demo/inline-style" element={<InlineStyleFlip />} />
        <Route path="/flip-demo/web-animations" element={<WebAnimationsFlip />} />
        <Route path="/flip-demo/opacity-scale" element={<OpacityScaleFlip />} />
        <Route path="/flip-demo/absolute-positioning" element={<AbsolutePositionFlip />} />
        
        {/* 404 Not Found */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      
      {/* Update Banner - shown globally */}
    </>
  )
}

export default App