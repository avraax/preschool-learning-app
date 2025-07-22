import React, { useState, useEffect } from 'react'
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
  Paper,
  AppBar,
  Toolbar
} from '@mui/material'
import {
  ArrowBack,
  VolumeUp,
  School,
  Star
} from '@mui/icons-material'
import { audioManager } from '../../utils/audio'
import { difficultyManager } from '../../utils/difficulty'

interface AlphabetGameProps {
  onBack: () => void
}

const AlphabetGame: React.FC<AlphabetGameProps> = ({ onBack }) => {
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [showOptions, setShowOptions] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    generateNewQuestion()
  }, [])

  const generateNewQuestion = () => {
    const letter = difficultyManager.getRandomLetter()
    setCurrentLetter(letter)
    
    const availableLetters = difficultyManager.getAvailableLetters()
    const options = [letter]
    
    while (options.length < 4) {
      const randomLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)]
      if (!options.includes(randomLetter)) {
        options.push(randomLetter)
      }
    }
    
    setShowOptions(options.sort(() => Math.random() - 0.5))
    
    setTimeout(() => {
      audioManager.speakSlowly(`Find bogstavet ${letter}`)
    }, 500)
  }

  const handleLetterClick = async (selectedLetter: string) => {
    if (isPlaying) return
    
    setIsPlaying(true)
    
    if (selectedLetter === currentLetter) {
      setScore(score + 1)
      await audioManager.announceGameResult(true)
      setTimeout(() => {
        generateNewQuestion()
        setIsPlaying(false)
      }, 2000)
    } else {
      await audioManager.announceGameResult(false)
      setTimeout(() => {
        setIsPlaying(false)
      }, 2000)
    }
  }

  const repeatLetter = () => {
    audioManager.speakSlowly(`Bogstavet er ${currentLetter}`)
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #dbeafe 100%)'
      }}
    >
      {/* App Bar with Back Button and Score */}
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
          
          <Chip 
            icon={<Star />}
            label={`Score: ${score}`}
            color="primary"
            variant="filled"
            sx={{ 
              fontSize: '1.25rem',
              py: 3,
              px: 2,
              fontWeight: 700,
              bgcolor: 'white',
              color: 'primary.dark',
              boxShadow: 3
            }}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Game Title */}
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
              <School fontSize="large" /> Alfabetet
            </Typography>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4 }}>
            Klik på det bogstav du hører!
          </Typography>

          {/* Audio Control Card */}
          <Paper 
            elevation={8}
            sx={{ 
              maxWidth: 400,
              mx: 'auto',
              p: 4,
              borderRadius: 4,
              border: '2px solid',
              borderColor: 'primary.200'
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <VolumeUp 
                sx={{ 
                  fontSize: '5rem', 
                  color: 'primary.main',
                  mb: 2
                }} 
              />
            </motion.div>
            <Button 
              onClick={repeatLetter}
              variant="contained"
              color="secondary"
              size="large"
              startIcon={<VolumeUp />}
              sx={{ py: 2, px: 4 }}
            >
              Hør igen 🎵
            </Button>
          </Paper>
        </Box>

        {/* Answer Options Grid */}
        <Grid 
          container 
          spacing={3} 
          sx={{ 
            maxWidth: '800px',
            mx: 'auto',
            mb: 6
          }}
        >
          {showOptions.map((letter, index) => (
            <Grid size={{ xs: 6, md: 3 }} key={`${letter}-${index}`}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Card 
                  onClick={() => handleLetterClick(letter)}
                  sx={{ 
                    minHeight: { xs: 100, md: 120 },
                    cursor: 'pointer',
                    border: '3px solid',
                    borderColor: 'primary.200',
                    bgcolor: 'white',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'primary.50',
                      boxShadow: 12
                    }
                  }}
                >
                  <CardContent 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: 2
                    }}
                  >
                    <Typography 
                      variant="h1"
                      sx={{ 
                        fontSize: { xs: '3rem', md: '4rem' },
                        fontWeight: 700,
                        color: 'primary.dark',
                        userSelect: 'none',
                        lineHeight: 1
                      }}
                    >
                      {letter}
                    </Typography>
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
            <Typography sx={{ fontSize: '4rem' }}>🎈</Typography>
          </motion.div>
        </Box>
      </Container>
    </Box>
  )
}

export default AlphabetGame