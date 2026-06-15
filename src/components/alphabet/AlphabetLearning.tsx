import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Typography,
  Box,
  LinearProgress,
  Card
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { categoryThemes } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import LearningGrid from '../common/LearningGrid'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { progressStore, type StickerAward } from '../../services/progressStore'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 AlphabetLearning: ${message}`, data)
  }
}


const DANISH_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'
]

const ALPHABET_ACCENT = categoryThemes.alphabet.accentColor
// Award a sticker every N distinct letters tapped. 29 letters → awards at 9 / 18 / 27 (3 stickers),
// echoing the 9-per-album-page motif. Tunable constant (mirrors Lær Tal's EXPLORE_MILESTONE = 12).
const EXPLORE_MILESTONE = 9

const AlphabetLearning: React.FC = () => {
  const muiTheme = useTheme()
  const [currentIndex, setCurrentIndex] = useState(0)
  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'AlphabetLearning',
    autoInitialize: false
  })
  // Instant load: the grid is interactive from the first render; the welcome narrates over it.
  const [gameReady] = useState(true)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasInitialized = useRef(false)
  const welcomeTriggered = useRef(false)
  // True once the child taps → suppresses a (possibly late) welcome from talking over their play.
  const hasInteractedRef = useRef(false)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Session-local exploration tracking → milestone stickers.
  const exploredRef = useRef<Set<string>>(new Set())
  const milestoneRef = useRef(0)
  const [stickerAward, setStickerAward] = useState<StickerAward | null>(null)
  const stickerTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // The board is already interactive (gameReady starts true). Just narrate the welcome over it.
    if (audio.isAudioReady) {
      playWelcome()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (stickerTimer.current) {
        clearTimeout(stickerTimer.current)
        stickerTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When audio unlocks after mount, play the welcome (board already interactive). Guarded inside
  // playWelcome so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcome()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Narrate the welcome over the already-interactive board. Self-guards; skipped once the child
  // has started tapping.
  const playWelcome = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('alphabetlearning')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
  }

  // Award an exploration sticker when distinct-tap count crosses each milestone.
  const maybeAwardExploration = () => {
    const size = exploredRef.current.size
    const milestone = Math.floor(size / EXPLORE_MILESTONE)
    if (milestone > milestoneRef.current) {
      milestoneRef.current = milestone
      const award = progressStore.awardSticker()
      setStickerAward(award)
      celebrateTier('sticker')
      if (stickerTimer.current) clearTimeout(stickerTimer.current)
      stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
      // Speak the sticker name (browse has no other TTS competing here).
      try {
        audio.speak(`Nyt klistermærke! ${award.sticker.label}`).catch(() => {})
      } catch {
        /* ignore */
      }
    }
  }

  const goToLetter = async (index: number) => {
    const letter = DANISH_ALPHABET[index]
    hasInteractedRef.current = true

    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()

    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()

    setCurrentIndex(index)

    exploredRef.current.add(letter)
    maybeAwardExploration()

    try {
      await audio.speakLetter(letter)
    } catch (error) {
      logError('Error speaking letter', {
        letter,
        error: error?.toString()
      })
    }
  }


  const progress = ((currentIndex + 1) / DANISH_ALPHABET.length) * 100

  return (
    <GameShell
      categoryId="alphabet"
      title="Lær Alfabetet"
      backRoute="/alphabet"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      score={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="body2"
            onClick={async () => {
              // Critical iOS fix: Update user interaction timestamp BEFORE audio call
              audio.updateUserInteraction()
              try {
                await audio.announcePosition(currentIndex, DANISH_ALPHABET.length, 'bogstav')
              } catch (error) {
                logError('Error announcing position', { error: error?.toString() })
              }
            }}
            sx={{
              color: muiTheme.scene.dark ? '#FFFFFF' : 'primary.dark',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 1,
              '&:hover': {
                backgroundColor: 'primary.50',
                boxShadow: 1
              }
            }}
          >
            {currentIndex + 1} / {DANISH_ALPHABET.length}
          </Typography>
          <Box sx={{ width: { xs: 120, sm: 200 }, bgcolor: 'white', borderRadius: 1, p: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        </Box>
      }
    >
        {/* Current Letter Display - Enhanced Visual */}
        <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
          <motion.div
            key={currentIndex}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card
              sx={{
                maxWidth: { xs: 160, md: 200 },
                mx: 'auto',
                p: { xs: 2, md: 3 },
                background: 'white',
                border: '4px solid',
                borderColor: audio.isPlaying ? categoryThemes.alphabet.accentColor : categoryThemes.alphabet.borderColor,
                boxShadow: audio.isPlaying
                  ? `0 0 30px ${alpha(categoryThemes.alphabet.accentColor, 0.4)}, 0 8px 32px ${alpha(categoryThemes.alphabet.accentColor, 0.3)}`
                  : muiTheme.scene.dark
                    ? '0 12px 30px rgba(0,0,0,0.45)'
                    : '0 6px 18px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  bottom: -2,
                  background: categoryThemes.alphabet.gradient,
                  borderRadius: 'inherit',
                  opacity: 0.2,
                  zIndex: 0
                },
                '&::after': {
                  content: '"⭐"',
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  fontSize: '1.5rem',
                  color: categoryThemes.alphabet.accentColor,
                  animation: audio.isPlaying ? 'pulse 2s infinite' : 'none'
                }
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '3.5rem', md: '4.5rem' },
                  fontWeight: 700,
                  color: categoryThemes.alphabet.accentColor,
                  textAlign: 'center',
                  lineHeight: 1,
                  textShadow: `1px 1px 2px ${alpha(categoryThemes.alphabet.accentColor, 0.1)}`,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                {DANISH_ALPHABET[currentIndex]}
              </Typography>
            </Card>
          </motion.div>
        </Box>


      {/* Alphabet Grid - Using Reusable Component */}
      <LearningGrid
        items={DANISH_ALPHABET}
        currentIndex={currentIndex}
        onItemClick={goToLetter}
        disabled={!gameReady}
      />

      {/* Exploration-milestone sticker reveal. Auto-dismisses; tap to close early. */}
      {stickerAward && (
        <Box
          onClick={() => setStickerAward(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
        >
          <StickerReveal award={stickerAward} accent={ALPHABET_ACCENT} size={140} />
        </Box>
      )}

      {/* CSS Animation for pulse effect */}
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 0.7; }
          }
        `}
      </style>
    </GameShell>
  )
}

export default AlphabetLearning