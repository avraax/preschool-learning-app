import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
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
  AppBar,
  Toolbar
} from '@mui/material'
import { Volume2, Award, ArrowLeft } from 'lucide-react'
import { audioManager } from '../../utils/audio'
import { useIOSAudioFix } from '../../hooks/useIOSAudioFix'
import { isIOS } from '../../utils/deviceDetection'
import IOSAudioPrompt from '../common/IOSAudioPrompt'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'

// Full Danish alphabet including special characters
const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å']

const AlphabetGame: React.FC = () => {
  const navigate = useNavigate()
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [showOptions, setShowOptions] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { showIOSPrompt, checkIOSAudioPermission, handleIOSAudioError, hideIOSPrompt } = useIOSAudioFix()
  
  // Character and celebration management
  const teacherCharacter = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()
  
  useEffect(() => {
    // Initial teacher greeting
    teacherCharacter.setCharacter('owl')
    teacherCharacter.wave()
  }, [])

  useEffect(() => {
    generateNewQuestion()
    
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

  const generateNewQuestion = () => {
    // Pick a random letter from full Danish alphabet
    const letter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
    setCurrentLetter(letter)
    
    // Create 4 options including the correct answer
    const options = [letter]
    
    while (options.length < 4) {
      const randomLetter = DANISH_ALPHABET[Math.floor(Math.random() * DANISH_ALPHABET.length)]
      if (!options.includes(randomLetter)) {
        options.push(randomLetter)
      }
    }
    
    setShowOptions(options.sort(() => Math.random() - 0.5))
    
    // Clear any existing timeout before setting a new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Stop any currently playing audio before starting new one
    audioManager.stopAll()
    
    timeoutRef.current = setTimeout(async () => {
      // For iOS, don't auto-play audio immediately - wait for user interaction
      if (isIOS() && !checkIOSAudioPermission()) {
        // Just show the visual question without audio for now
        console.log('🍎 iOS: Waiting for user interaction before speaking question')
        return
      }
      
      setIsPlaying(true)
      try {
        await audioManager.speakQuizPromptWithRepeat(`Find bogstavet ${letter}`, letter)
      } catch (error) {
        console.error('❌ Audio error in quiz:', error)
        handleIOSAudioError(error)
      } finally {
        setIsPlaying(false)
      }
    }, 500)
  }

  const handleLetterClick = async (selectedLetter: string) => {
    if (isPlaying) return
    
    // Stop any currently playing audio
    audioManager.stopAll()
    hideIOSPrompt() // Hide prompt on interaction
    
    setIsPlaying(true)
    try {
      if (selectedLetter === currentLetter) {
        // Correct answer - celebrate!
        setScore(score + 1)
        teacherCharacter.celebrate()
        celebrate(score > 5 ? 'high' : 'medium')
        
        await audioManager.announceGameResult(true)
        setTimeout(() => {
          stopCelebration()
          teacherCharacter.point()
          generateNewQuestion()
        }, 3000)
      } else {
        // Wrong answer - encourage
        teacherCharacter.encourage()
        await audioManager.announceGameResult(false)
        setTimeout(() => {
          teacherCharacter.think()
        }, 1000)
      }
    } catch (error) {
      console.error('Error playing feedback:', error)
      handleIOSAudioError(error)
    } finally {
      setIsPlaying(false)
    }
  }

  const repeatLetter = async () => {
    if (isPlaying) return
    
    // Stop any currently playing audio before speaking again
    audioManager.stopAll()
    hideIOSPrompt() // Hide prompt on interaction
    
    if (!checkIOSAudioPermission()) return
    
    setIsPlaying(true)
    try {
      await audioManager.speakQuizPromptWithRepeat(`Find bogstavet ${currentLetter}`, currentLetter)
    } catch (error) {
      handleIOSAudioError(error)
    } finally {
      setIsPlaying(false)
    }
  }
  
  const handleIOSPromptAction = () => {
    hideIOSPrompt()
    repeatLetter()
    audioManager.speakQuizPromptWithRepeat(`Find bogstavet ${currentLetter}`, currentLetter)
  }

  return (
    <Box 
      sx={{ 
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #f3e8ff 0%, #fce7f3 50%, #dbeafe 100%)'
      }}
    >
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton 
            onClick={() => navigate('/alphabet')}
            color="primary"
            size="large"
            sx={{ 
              bgcolor: 'white', 
              boxShadow: 3,
              '&:hover': { boxShadow: 6 }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          
          <Chip 
            icon={<Award size={20} />} 
            label={`${score} ⭐`} 
            color="primary" 
            onClick={() => audioManager.announceScore(score).catch(console.error)}
            sx={{ 
              fontSize: '1.2rem',
              py: 1,
              fontWeight: 'bold',
              boxShadow: 2,
              cursor: 'pointer',
              '&:hover': { boxShadow: 4 }
            }}
          />
        </Toolbar>
      </AppBar>

      <Container 
        maxWidth="lg" 
        sx={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 2, md: 3 },
          overflow: 'hidden'
        }}
      >
        {/* Game Title with Teacher Character */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
              <LottieCharacter
                character={teacherCharacter.character}
                state={teacherCharacter.state}
                size={80}
                onClick={teacherCharacter.wave}
              />
              <Typography 
                variant="h3" 
                sx={{ 
                  color: 'primary.dark',
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '2rem' }
                }}
              >
                🔤 Quiz
              </Typography>
              <Typography sx={{ fontSize: '2.5rem' }}>🎯</Typography>
            </Box>
          </motion.div>
          <Typography variant="h5" color="primary.main" sx={{ mb: 4, fontSize: { xs: '1rem', md: '1.25rem' } }}>
            Klik på bogstavet! 👆
          </Typography>
        </Box>

        {/* Audio Control - Compact */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <Button 
            onClick={repeatLetter}
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Volume2 size={24} />}
            sx={{ py: 2, px: 4, fontSize: '1.1rem', borderRadius: 3 }}
          >
            🎵 Gentag
          </Button>
        </Box>

        {/* Answer Options Grid */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Grid 
            container 
            spacing={{ xs: 2, sm: 3 }} 
            sx={{ 
              maxWidth: { xs: '100%', sm: '600px', md: '800px' },
              width: 'fit-content'
            }}
          >
          {showOptions.map((letter, index) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${letter}-${index}`}>
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
                    minHeight: { xs: 80, sm: 100, md: 120 },
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
        </Box>

      </Container>
      
      {/* iOS Audio Permission Prompt */}
      <IOSAudioPrompt 
        open={showIOSPrompt}
        onAction={handleIOSPromptAction}
        message="Tryk for at høre bogstavet"
      />
      
      {/* Celebration Effect */}
      <CelebrationEffect
        show={showCelebration}
        character="owl"
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default AlphabetGame