import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Container,
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
import { DANISH_PHRASES } from '../../config/danish-phrases'
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
        await audioManager.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findLetter(letter), letter)
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
      await audioManager.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findLetter(currentLetter), currentLetter)
    } catch (error) {
      handleIOSAudioError(error)
    } finally {
      setIsPlaying(false)
    }
  }
  
  const handleIOSPromptAction = () => {
    hideIOSPrompt()
    repeatLetter()
    audioManager.speakQuizPromptWithRepeat(DANISH_PHRASES.gamePrompts.findLetter(currentLetter), currentLetter)
  }

  return (
    <Box 
      sx={{ 
        height: '100dvh',
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
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 0
        }}>
          <Box
            sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridAutoRows: 'auto',
              gap: { xs: '16px', sm: '20px', md: '24px' },
              width: '100%',
              maxWidth: { xs: '400px', sm: '500px', md: '600px' },
              justifyContent: 'center',
              alignItems: 'center',
              // Individual card aspect ratio and constraints
              '& > *': {
                aspectRatio: '4/3',
                minHeight: { xs: '80px', sm: '90px', md: '100px' },
                maxHeight: { xs: '120px', sm: '140px', md: '160px' },
                width: '100%'
              },
              // Orientation specific adjustments
              '@media (orientation: landscape)': {
                gridTemplateColumns: 'repeat(4, 1fr)',
                maxWidth: { xs: '600px', sm: '700px', md: '800px' },
                '& > *': {
                  aspectRatio: '4/3',
                  minHeight: { xs: '60px', sm: '70px', md: '80px' },
                  maxHeight: { xs: '100px', sm: '110px', md: '120px' }
                }
              }
            }}
          >
          {showOptions.map((letter, index) => (
            <motion.div
              key={`${letter}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{ height: '100%' }}
            >
              <Card 
                onClick={() => handleLetterClick(letter)}
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  border: '3px solid',
                  borderColor: 'primary.200',
                  bgcolor: 'white',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.50',
                    boxShadow: 12,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent 
                  sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: { xs: 1.5, sm: 2, md: 2.5 }
                  }}
                >
                  <Typography 
                    variant="h1"
                    sx={{ 
                      fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                      fontWeight: 700,
                      color: 'primary.dark',
                      userSelect: 'none',
                      lineHeight: 1,
                      // Adjust font size in landscape
                      '@media (orientation: landscape)': {
                        fontSize: 'clamp(2rem, 6vw, 3.5rem)'
                      }
                    }}
                  >
                    {letter}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          </Box>
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