import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Container,
  Typography,
  Box,
  IconButton,
  AppBar,
  Toolbar,
  LinearProgress,
  Card
} from '@mui/material'
import {
  ArrowBack,
  School
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import LearningGrid from '../common/LearningGrid'


const NumberLearning: React.FC = () => {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  useEffect(() => {
    // Stop audio immediately when navigating away
    const handleBeforeUnload = () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    // Listen for navigation events
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    
    // Cleanup function to stop all audio and timeouts when component unmounts
    return () => {
      audioManager.stopAll()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [])




  const goToNumber = async (index: number) => {
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
            onClick={() => navigate('/math')}
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
            <Typography 
              variant="body2" 
              onClick={() => audioManager.announcePosition(currentIndex, numbers.length, 'tal').catch(console.error)}
              sx={{ 
                color: 'secondary.dark', 
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 1,
                '&:hover': { 
                  backgroundColor: 'secondary.50',
                  boxShadow: 1
                }
              }}
            >
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


        {/* Numbers Grid - Using Reusable Component */}
        <LearningGrid
          items={numbers}
          currentIndex={currentIndex}
          onItemClick={goToNumber}
        />
      </Container>
    </Box>
  )
}

export default NumberLearning