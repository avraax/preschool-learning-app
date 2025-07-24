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
  LinearProgress
} from '@mui/material'
import {
  ArrowBack,
  PlayArrow,
  Pause,
  Replay,
  School
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'

interface NumberLearningProps {
  onBack: () => void
}

const NumberLearning: React.FC<NumberLearningProps> = ({ onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  useEffect(() => {
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const speakCurrentNumber = async () => {
    if (isPlaying) return
    
    setIsPlaying(true)
    audioManager.stopAll()
    
    const currentNumber = numbers[currentIndex]
    
    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audioManager.speakNumber(currentNumber, 1.2)
    } catch (error) {
      console.error('Error speaking number:', error)
    } finally {
      setIsPlaying(false)
      
      // If auto-play is on, move to next number after a pause
      if (isAutoPlay && currentIndex < numbers.length - 1) {
        timeoutRef.current = setTimeout(() => {
          setCurrentIndex(prev => prev + 1)
        }, 1000)
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
  }

  const stopAutoPlay = () => {
    setIsAutoPlay(false)
    audioManager.stopAll()
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }

  const goToNumber = async (index: number) => {
    // Cancel auto-play if it's running
    if (isAutoPlay) {
      stopAutoPlay()
    }
    
    setCurrentIndex(index)
    setIsPlaying(true)
    audioManager.stopAll()
    
    const number = numbers[index]
    
    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audioManager.speakNumber(number, 1.2)
    } catch (error) {
      console.error('Error speaking number:', error)
    } finally {
      setIsPlaying(false)
    }
  }

  const restart = () => {
    stopAutoPlay()
    setCurrentIndex(0)
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
        minHeight: '100vh', 
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

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography 
              variant="h3" 
              sx={{ 
                color: 'secondary.dark',
                fontWeight: 700,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <School fontSize="large" /> Lær Tal
            </Typography>
          </motion.div>
          <Typography variant="h5" color="secondary.main" sx={{ mb: 1 }}>
            Lær alle tal fra 1 til 100
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Klik på et tal for at høre det! 👆
          </Typography>
        </Box>

        {/* Current Number Display */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card
              sx={{
                maxWidth: { xs: 250, md: 300 },
                mx: 'auto',
                p: { xs: 3, md: 4 },
                bgcolor: isPlaying ? 'secondary.50' : 'white',
                border: '4px solid',
                borderColor: isPlaying ? 'secondary.main' : 'primary.200',
                transition: 'all 0.3s ease'
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '6rem', md: '8rem' },
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

        {/* Control Buttons */}
        <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            {!isAutoPlay ? (
              <Button
                onClick={startAutoPlay}
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlayArrow />}
                disabled={isPlaying}
                sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
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
                sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
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
              disabled={isPlaying}
              sx={{ py: 2, px: 4, fontSize: '1.1rem' }}
            >
              Start Forfra
            </Button>
          </Box>
        </Box>

        {/* Numbers Grid */}
        <Box sx={{ display: 'flex', justifyContent: 'center', flex: 1, overflow: 'auto' }}>
          <Grid 
            container 
            spacing={1} 
            sx={{ 
              maxWidth: { xs: '100%', sm: '900px', md: '1000px' },
              width: 'fit-content',
              height: 'fit-content'
            }}
          >
          {numbers.map((number, index) => (
            <Grid size={{ xs: 1.2, sm: 1, md: 0.8 }} key={number}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Card 
                  onClick={() => goToNumber(index)}
                  sx={{ 
                    minHeight: 50,
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
    </Box>
  )
}

export default NumberLearning