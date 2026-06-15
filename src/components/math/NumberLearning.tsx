import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Typography,
  Box,
  LinearProgress,
  Card
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import GameShell from '../common/GameShell'
import LearningGrid from '../common/LearningGrid'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { categoryThemes } from '../../config/categoryThemes'
import { progressStore, type StickerAward } from '../../services/progressStore'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Tal — a calm 1–100 browse. Tapping a number speaks it; exploring distinct numbers earns a
// sticker at each milestone. Instant load: the grid is interactive from the first render and the
// welcome narrates over it.

const MATH_ACCENT = categoryThemes.math.accentColor
const EXPLORE_MILESTONE = 12 // award a sticker every N distinct numbers tapped

const NumberLearning: React.FC = () => {
  const muiTheme = useTheme()
  const [currentIndex, setCurrentIndex] = useState(0)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'NumberLearning',
    autoInitialize: false
  })
  // Instant load: the grid is interactive from the first render; the welcome narrates over it.
  const [gameReady] = useState(true)
  const hasInitialized = useRef(false)
  const welcomeTriggered = useRef(false)
  // True once the child taps → suppresses a (possibly late) welcome from talking over their play.
  const hasInteractedRef = useRef(false)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Session-local exploration tracking → milestone stickers.
  const exploredRef = useRef<Set<number>>(new Set())
  const milestoneRef = useRef(0)
  const [stickerAward, setStickerAward] = useState<StickerAward | null>(null)
  const stickerTimer = useRef<NodeJS.Timeout | null>(null)

  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1)

  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 NumberLearning: ${message}`, data)
    }
  }

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // The board is already interactive (gameReady starts true). Just narrate the welcome over it.
    if (audio.isAudioReady) {
      playWelcome()
    }

    return () => {
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
      await audio.playGameWelcome('numberlearning')
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

  const goToNumber = async (index: number) => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    if (audio.isPlaying) audio.cancelCurrentAudio()

    setCurrentIndex(index)

    const number = numbers[index]
    exploredRef.current.add(number)
    maybeAwardExploration()

    try {
      // Slightly faster for number counting.
      await audio.speakNumber(number, 1.2)
    } catch (error) {
      logError('Error speaking number', { number, error: error?.toString() })
    }
  }

  const progress = ((currentIndex + 1) / numbers.length) * 100

  return (
    <GameShell
      categoryId="math"
      title="Lær Tal"
      backRoute="/math"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      score={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          <Typography
            variant="body2"
            onClick={async () => {
              audio.updateUserInteraction()
              try {
                await audio.announcePosition(currentIndex, numbers.length, 'tal')
              } catch (error) {
                logError('Error announcing position', { error: error?.toString() })
              }
            }}
            sx={{
              color: muiTheme.scene.dark ? '#FFFFFF' : 'secondary.dark',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 1,
              '&:hover': { backgroundColor: 'secondary.50', boxShadow: 1 }
            }}
          >
            {currentIndex + 1} / {numbers.length}
          </Typography>
          <Box sx={{ width: { xs: 120, sm: 200 }, bgcolor: 'white', borderRadius: 1, p: 0.5 }}>
            <LinearProgress variant="determinate" value={progress} color="secondary" sx={{ height: 8, borderRadius: 1 }} />
          </Box>
        </Box>
      }
    >
      {/* Current Number Display */}
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
              bgcolor: audio.isPlaying ? 'secondary.50' : 'white',
              border: '2px solid',
              borderColor: audio.isPlaying ? 'secondary.main' : 'primary.200',
              transition: 'all 0.3s ease',
              boxShadow: muiTheme.scene.dark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.12)'
            }}
          >
            <Typography
              variant="h1"
              sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' }, fontWeight: 700, color: 'primary.dark', textAlign: 'center', lineHeight: 1 }}
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
          <StickerReveal award={stickerAward} accent={MATH_ACCENT} size={140} />
        </Box>
      )}
    </GameShell>
  )
}

export default NumberLearning
