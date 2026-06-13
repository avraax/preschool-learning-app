import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Container,
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar,
  Paper
} from '@mui/material'
import { ArrowLeft } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { OrdlegRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// 2-3 letter child-friendly Danish words. Duplicates from the source list removed.
// Includes Æ, Ø, Å to practise the Danish-specific letters.
const SPELLING_WORDS: { word: string; emoji: string }[] = [
  { word: 'ko', emoji: '🐄' },
  { word: 'bi', emoji: '🐝' },
  { word: 'is', emoji: '🍦' },
  { word: 'os', emoji: '🧀' },
  { word: 'sol', emoji: '☀️' },
  { word: 'hus', emoji: '🏠' },
  { word: 'bil', emoji: '🚗' },
  { word: 'kat', emoji: '🐱' },
  { word: 'hej', emoji: '👋' },
  { word: 'hat', emoji: '🎩' },
  { word: 'mus', emoji: '🐭' },
  { word: 'bus', emoji: '🚌' },
  { word: 'ost', emoji: '🧀' },
  { word: 'fod', emoji: '🦶' },
  { word: 'bog', emoji: '📖' },
  { word: 'and', emoji: '🦆' },
  { word: 'arm', emoji: '💪' },
  { word: 'ben', emoji: '🦵' },
  { word: 'hul', emoji: '🕳️' },
  { word: 'sø', emoji: '🏞️' },
  { word: 'ål', emoji: '🐍' },
  { word: 'øl', emoji: '🍺' },
  // More easy 2-3 letter words
  { word: 'æg', emoji: '🥚' },
  { word: 'te', emoji: '🍵' },
  { word: 'ur', emoji: '⌚' },
  { word: 'sko', emoji: '👟' },
  { word: 'haj', emoji: '🦈' },
  { word: 'abe', emoji: '🐒' },
  { word: 'ræv', emoji: '🦊' },
  { word: 'ulv', emoji: '🐺' },
  { word: 'ged', emoji: '🐐' },
  { word: 'tog', emoji: '🚂' },
  { word: 'mor', emoji: '👩' },
  { word: 'far', emoji: '👨' },
  { word: 'bær', emoji: '🍓' },
  { word: 'løg', emoji: '🧅' },
  { word: 'ski', emoji: '🎿' },
]

const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Z', 'Æ', 'Ø', 'Å']

interface LetterTile {
  id: string
  letter: string
}

const SpellingGame: React.FC = () => {
  const navigate = useNavigate()

  // Current word and its uppercase letters
  const [current, setCurrent] = useState<{ word: string; emoji: string } | null>(null)
  const [targetLetters, setTargetLetters] = useState<string[]>([])
  const [filledCount, setFilledCount] = useState(0)
  const [tiles, setTiles] = useState<LetterTile[]>([])
  const [usedTileIds, setUsedTileIds] = useState<Set<string>>(new Set())
  const [shakeTileId, setShakeTileId] = useState<string | null>(null)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'SpellingGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const [audioInitialized, setAudioInitialized] = useState(false)
  const hasInitialized = useRef(false)
  const previousWord = useRef<string | null>(null)
  const isAdvancing = useRef(false)

  // Centralized game state management
  const { score, incrementScore, isScoreNarrating, handleScoreClick } = useGameState()

  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Character and celebration management
  const teacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 SpellingGame: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    teacher.setCharacter('owl')
    teacher.wave()

    if (audio.isAudioReady) {
      setAudioInitialized(true)
      playWelcomeAndStart()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !audioInitialized && !hasInitialized.current) {
      hasInitialized.current = true
      setAudioInitialized(true)
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady, audioInitialized])

  const playWelcomeAndStart = async () => {
    try {
      await audio.playGameWelcome('spelling')
      const delay = isIOS() ? 1000 : 1500
      setTimeout(() => {
        setGameReady(true)
        generateNewWord()
      }, delay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      setGameReady(true)
      generateNewWord()
    }
  }

  // Build a shuffled tile pool: the word's letters + a few distractor letters
  const buildTiles = (letters: string[]): LetterTile[] => {
    const wordLetterSet = new Set(letters)
    const distractorPool = DANISH_ALPHABET.filter(l => !wordLetterSet.has(l))
    const distractors: string[] = []
    const distractorCount = 3
    const shuffledPool = [...distractorPool].sort(() => Math.random() - 0.5)
    for (let i = 0; i < distractorCount && i < shuffledPool.length; i++) {
      distractors.push(shuffledPool[i])
    }

    const all = [...letters, ...distractors]
    return all
      .map((letter, index) => ({ id: `tile-${index}-${letter}`, letter }))
      .sort(() => Math.random() - 0.5)
  }

  const generateNewWord = () => {
    isAdvancing.current = false

    // Pick a word, avoiding an immediate repeat
    let candidates = SPELLING_WORDS.filter(w => w.word !== previousWord.current)
    if (candidates.length === 0) candidates = SPELLING_WORDS
    const next = candidates[Math.floor(Math.random() * candidates.length)]
    previousWord.current = next.word

    const letters = next.word.toUpperCase().split('')

    setCurrent(next)
    setTargetLetters(letters)
    setFilledCount(0)
    setUsedTileIds(new Set())
    setShakeTileId(null)
    setTiles(buildTiles(letters))

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const delay = isIOS() ? 200 : 500
    timeoutRef.current = setTimeout(() => {
      speakWord(next.word)
    }, delay)
  }

  const speakWord = async (word: string) => {
    try {
      audio.updateUserInteraction()
      await audio.speak(word)
    } catch (error) {
      logError('Error speaking word', { word, error: error?.toString() })
    }
  }

  const handleTileClick = async (tile: LetterTile) => {
    if (!gameReady || !current || isAdvancing.current) return
    if (usedTileIds.has(tile.id)) return

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    const expectedLetter = targetLetters[filledCount]

    if (tile.letter === expectedLetter) {
      // Correct letter: place it in the next slot
      const newFilled = filledCount + 1
      setUsedTileIds(prev => new Set(prev).add(tile.id))
      setFilledCount(newFilled)

      try {
        await audio.speakLetter(tile.letter)
      } catch (error) {
        // ignore letter audio errors
      }

      if (newFilled === targetLetters.length) {
        // Word complete
        completeWord()
      }
    } else {
      // Wrong letter: shake and leave it in the pool
      setShakeTileId(tile.id)
      teacher.think()
      setTimeout(() => setShakeTileId(null), 450)
    }
  }

  const completeWord = () => {
    if (!current || isAdvancing.current) return
    isAdvancing.current = true

    incrementScore()
    celebrate()
    teacher.wave()

    // Play the full word again, then advance to the next one
    setTimeout(async () => {
      try {
        await audio.speak(current.word)
      } catch (error) {
        // ignore
      }
      setTimeout(() => {
        stopCelebration()
        generateNewWord()
      }, isIOS() ? 1500 : 2000)
    }, 400)
  }

  const repeatWord = async () => {
    if (!current) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakWord(current.word)
    } catch (error) {
      console.error('🎵 SpellingGame: Error repeating word:', error)
    }
  }

  const theme = categoryThemes.ordleg
  const availableTiles = tiles.filter(t => !usedTileIds.has(t.id))

  return (
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: theme.gradient
      }}
    >
      {/* App Bar with Back Button and Score */}
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
          <IconButton
            onClick={() => navigate('/ordleg')}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>

          <OrdlegScoreChip
            score={score}
            disabled={isScoreNarrating}
            onClick={handleScoreClick}
          />
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: { xs: 1.5, md: 2 },
          overflow: 'hidden'
        }}
      >
        {/* Title with teacher */}
        <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <LottieCharacter
              character={teacher.character}
              state={teacher.state}
              size={64}
              onClick={teacher.wave}
            />
            <Typography
              variant="h4"
              sx={{
                color: theme.accentColor,
                fontWeight: 700,
                fontSize: { xs: '1.3rem', md: '1.75rem' }
              }}
            >
              ✏️ Stav Ordet
            </Typography>
          </Box>
        </Box>

        {gameReady && current && (
          <>
            {/* Word prompt: emoji + word + repeat */}
            <Box sx={{ textAlign: 'center', flex: '0 0 auto', mb: { xs: 1, md: 2 } }}>
              <motion.div
                key={current.word}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Typography
                  sx={{
                    fontSize: 'clamp(3rem, 14vh, 6rem)',
                    lineHeight: 1,
                    mb: 0.5
                  }}
                >
                  {current.emoji}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 'clamp(1.75rem, 7vw, 3rem)',
                    fontWeight: 700,
                    color: theme.accentColor,
                    letterSpacing: '0.1em',
                    userSelect: 'none'
                  }}
                >
                  {current.word.toUpperCase()}
                </Typography>
              </motion.div>
              <Box sx={{ mt: 1 }}>
                <OrdlegRepeatButton onClick={repeatWord} disabled={false} />
              </Box>
            </Box>

            {/* Letter slots */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: { xs: 1, md: 1.5 },
                flex: '0 0 auto',
                mb: { xs: 1.5, md: 2.5 }
              }}
            >
              {targetLetters.map((letter, index) => {
                const filled = index < filledCount
                return (
                  <Box
                    key={index}
                    sx={{
                      width: { xs: 56, sm: 64, md: 80 },
                      height: { xs: 56, sm: 64, md: 80 },
                      borderRadius: 2,
                      border: '3px dashed',
                      borderColor: filled ? 'success.main' : theme.borderColor,
                      bgcolor: filled ? 'success.light' : 'rgba(255,255,255,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Typography
                      sx={{
                            fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
                        fontWeight: 700,
                        color: filled ? 'white' : 'transparent',
                        userSelect: 'none'
                      }}
                    >
                      {filled ? letter : ''}
                    </Typography>
                  </Box>
                )
              })}
            </Box>

            {/* Scrambled letter tiles */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 0
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: { xs: 1.5, md: 2 },
                  maxWidth: 560
                }}
              >
                <AnimatePresence>
                  {availableTiles.map((tile) => (
                    <motion.div
                      key={tile.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={
                        shakeTileId === tile.id
                          ? { opacity: 1, scale: 1, x: [0, -10, 10, -10, 10, 0] }
                          : { opacity: 1, scale: 1, x: 0 }
                      }
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={shakeTileId === tile.id ? { duration: 0.45 } : { duration: 0.2 }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      <Paper
                        elevation={4}
                        onClick={() => handleTileClick(tile)}
                        sx={{
                          width: { xs: 56, sm: 64, md: 76 },
                          height: { xs: 56, sm: 64, md: 76 },
                          minWidth: 44,
                          minHeight: 44,
                          borderRadius: 2,
                          border: '3px solid',
                          borderColor: shakeTileId === tile.id ? 'error.main' : theme.borderColor,
                          bgcolor: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          userSelect: 'none',
                          '@media (hover: hover) and (pointer: fine)': {
                            '&:hover': {
                              borderColor: theme.hoverBorderColor,
                              boxShadow: 8
                            }
                          }
                        }}
                      >
                        <Typography
                          sx={{
                                    fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
                            fontWeight: 700,
                            color: theme.accentColor
                          }}
                        >
                          {tile.letter}
                        </Typography>
                      </Paper>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
            </Box>
          </>
        )}
      </Container>

      {/* Celebration Effect */}
      <CelebrationEffect
        show={showCelebration}
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default SpellingGame
