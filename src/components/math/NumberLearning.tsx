import React, { useState, useEffect, useRef } from 'react'
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
  Toolbar,
  LinearProgress,
  Alert,
  Snackbar
} from '@mui/material'
import {
  ArrowBack,
  PlayArrow,
  Pause,
  Replay,
  School
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { deviceInfo } from '../../utils/deviceDetection'
import { iosAudioHelper } from '../../utils/iosAudioHelper'

interface NumberLearningProps {
  onBack: () => void
}

const NumberLearning: React.FC<NumberLearningProps> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const [showAudioError, setShowAudioError] = useState(false)
  const [audioRetryCount, setAudioRetryCount] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUserInteraction = useRef<number>(Date.now())

  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  useEffect(() => {
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      // Ensure iOS audio helper is stopped
      if (deviceInfo.isIOS) {
        iosAudioHelper.stopKeepAlive()
      }
    }
  }, [])

  // Track user interactions for iOS audio
  const updateUserInteraction = () => {
    lastUserInteraction.current = Date.now()
  }

  const speakCurrentNumber = async () => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    const currentNumber = numbers[currentIndex]
    
    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audioManager.speakNumber(currentNumber, 1.2)
      setAudioRetryCount(0) // Reset retry count on success
    } catch (error: any) {
      console.error('Error speaking number:', error)
      
      // iOS audio permission error handling
      if (deviceInfo.isIOS && error?.name === 'NotAllowedError') {
        // Check if it's been more than 6 seconds since last user interaction
        const timeSinceInteraction = Date.now() - lastUserInteraction.current
        
        if (timeSinceInteraction > 6000 && audioRetryCount < 1) {
          // Show error and pause auto-play for user to resume
          setIsAutoPlay(false)
          setShowAudioError(true)
          setAudioRetryCount(prev => prev + 1)
        }
      }
    } finally {
      setIsPlaying(false)
      
      // If auto-play is on, move to next number after a pause
      if (isAutoPlay && currentIndex < numbers.length - 1) {
        // Use shorter delay for iOS to avoid audio timeout
        const delay = deviceInfo.isIOS ? 600 : 1000
        timeoutRef.current = setTimeout(() => {
          setCurrentIndex(prev => prev + 1)
        }, delay)
      } else if (isAutoPlay && currentIndex === numbers.length - 1) {
        // Finished counting to 100
        setIsAutoPlay(false)
      }
    }
  }

  const startAutoPlay = () => {
    // Always reset to beginning when starting auto-play
    stopAutoPlay()
    setCurrentIndex(0)
    setIsAutoPlay(true)
    updateUserInteraction() // Track user interaction
    setShowAudioError(false)
    setAudioRetryCount(0)
    
    // Start iOS audio keep-alive
    if (deviceInfo.isIOS) {
      iosAudioHelper.startKeepAlive()
    }
  }

  const stopAutoPlay = () => {
    setIsAutoPlay(false)
    setIsPlaying(false)  // Also stop playing state
    audioManager.stopAll()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Stop iOS audio keep-alive
    if (deviceInfo.isIOS) {
      iosAudioHelper.stopKeepAlive()
    }
  }

  const goToNumber = async (index: number) => {
    // Cancel auto-play if it's running
    if (isAutoPlay) {
      stopAutoPlay()
    }
    
    updateUserInteraction() // Track user interaction
    setShowAudioError(false)
    
    setCurrentIndex(index)
    setIsPlaying(true)
    audioManager.stopAll()
    
    const number = numbers[index]
    
    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audioManager.speakNumber(number, 1.2)
      setAudioRetryCount(0) // Reset retry count on success
    } catch (error) {
      console.error('Error speaking number:', error)
    } finally {
      setIsPlaying(false)
    }
  }

  const restart = () => {
    stopAutoPlay()
    setCurrentIndex(0)
    updateUserInteraction() // Track user interaction
    setShowAudioError(false)
  }
  
  const resumeAutoPlay = () => {
    updateUserInteraction()
    setShowAudioError(false)
    setIsAutoPlay(true)
    // Trigger speech for current number
    speakCurrentNumber()
  }

  // Auto-play the current number when index changes and auto-play is on
  useEffect(() => {
    if (isAutoPlay) {
      speakCurrentNumber()
    }
  }, [currentIndex, isAutoPlay])

  const progress = ((currentIndex + 1) / numbers.length) * 100

  return (
    <Box 
      sx={{ 
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f3e5f5 50%, #fff3e0 100%)'
      }}
    >
      {/* App Bar with Back Button and Progress */}
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'secondary.dark', fontWeight: 600 }}>
              {currentIndex + 1} / {numbers.length}
            </Typography>
            <Box sx={{ width: 200, bgcolor: 'white', borderRadius: 1, p: 0.5 }}>
              <LinearProgress 
                variant="determinate" 
                value={progress} 
                color="secondary"
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Container 
        maxWidth="lg" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 1, md: 2 },
          overflow: 'hidden'
        }}
      >
        {/* Title - Very Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 } }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              color: 'secondary.dark',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5
            }}
          >
            <School sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} /> Lær Tal
          </Typography>
        </Box>

        {/* Current Number Display - Very Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                maxWidth: { xs: 120, md: 150 },
                mx: 'auto',
                p: { xs: 1, md: 1.5 },
                bgcolor: isPlaying ? 'secondary.50' : 'white',
                border: '2px solid',
                borderColor: isPlaying ? 'secondary.main' : 'primary.200',
                transition: 'all 0.3s ease'
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.5rem' },
                  fontWeight: 700,
                  color: 'primary.dark',
                  textAlign: 'center',
                  lineHeight: 1
                }}
              >
                {numbers[currentIndex]}
              </Typography>
            </Card>
          </motion.div>
        </Box>

        {/* Control Buttons - Very Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 1, md: 2 }, flexWrap: 'wrap' }}>
            {!isAutoPlay ? (
              <Button
                onClick={startAutoPlay}
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayArrow />}
                disabled={isPlaying}
                sx={{ py: { xs: 0.5, md: 1 }, px: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' }, minHeight: '44px' }}
              >
                Tæl Alle
              </Button>
            ) : (
              <Button
                onClick={stopAutoPlay}
                variant="contained"
                color="error"
                size="large"
                startIcon={<Pause />}
                sx={{ py: { xs: 0.5, md: 1 }, px: { xs: 2, md: 3 }, fontSize: { xs: '0.875rem', md: '1rem' }, minHeight: '44px' }}
              >
                Stop
              </Button>
            )}

            <Button
              onClick={restart}
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<Replay />}
              disabled={isPlaying || isAutoPlay}
              sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
            >
              Start Forfra
            </Button>
          </Box>
        </Box>

        {/* Numbers Grid - Flexible */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          overflow: 'hidden',
          minHeight: 0
        }}>
          <Grid 
            container 
            spacing={{ xs: 0.5, md: 1 }}
            sx={{ 
              maxWidth: '100%',
              width: 'fit-content',
              maxHeight: '100%',
              overflow: 'auto',
              pr: 1
            }}
          >
          {numbers.map((number, index) => (
            <Grid size={{ xs: 1.2, sm: 1, md: 0.8 }} key={number}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card 
                  onClick={() => goToNumber(index)}
                  sx={{ 
                    minHeight: { xs: 45, md: 50 },
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: index === currentIndex ? 'secondary.main' : 'primary.200',
                    bgcolor: index === currentIndex ? 'secondary.50' : 
                             index < currentIndex && isAutoPlay ? 'success.50' : 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: 1,
                      '&:last-child': { pb: 1 }
                    }}
                  >
                    <Typography 
                      variant="body1"
                      sx={{ 
                        fontWeight: 700,
                        color: index === currentIndex ? 'secondary.dark' : 'primary.dark',
                        fontSize: { xs: '0.8rem', sm: '1rem' }
                      }}
                    >
                      {number}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
          </Grid>
        </Box>
      </Container>
      
      {/* iOS Audio Error Snackbar */}
      <Snackbar
        open={showAudioError}
        autoHideDuration={null} // Don't auto-hide
        onClose={() => setShowAudioError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity="warning"
          sx={{ width: '100%' }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={resumeAutoPlay}
              sx={{ fontWeight: 'bold' }}
            >
              Fortsæt
            </Button>
          }
        >
          Lyd stoppet - tryk "Fortsæt" for at genoptage tælling
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default NumberLearning