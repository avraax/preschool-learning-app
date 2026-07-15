import React, { useState, useEffect, useRef } from 'react'
import {
  Typography,
  Box,
  LinearProgress
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { categoryThemes } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import LearningGrid from '../common/LearningGrid'
import PromptStage from '../common/PromptStage'
import { useCelebration } from '../common/CelebrationEffect'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { LETTER_WORDS } from '../../config/letterWords'
import { hexToRgba } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
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

// Example word + emoji for the bloomed letter (UI/UX Overhaul PRD §6B). Only letters with a clear,
// child-friendly Danish word are included — Q, W, X have none, so their bloom shows just the giant
// letter (the PromptStage hero gracefully supports an emoji-less state).

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

  const { showCelebration, celebrationIntensity, celebrationDuration, stopCelebration } = useCelebration()

  // Per-new-item browse XP (Liveliness PRD-04) — replaces the old milestone sticker. Each newly
  // explored letter feeds the shared cross-game level; the header ring ticks. No sticker here (they
  // became level-up trophies); a browse level-up is celebrated on returning to a menu.
  const awardBrowseXp = useBrowseXp('alphabet')

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

  const goToLetter = async (index: number) => {
    const letter = DANISH_ALPHABET[index]
    hasInteractedRef.current = true

    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()

    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()

    setCurrentIndex(index)

    // Per-new-item browse XP (Liveliness PRD-04): first visit to this letter feeds the level + ticks
    // the ring. We always still speak the letter (unlike the old milestone, which spoke a sticker).
    awardBrowseXp(letter)

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
      intro={false}
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
      promptStage={
        // Selected letter blooms large + its example word/emoji when the data has one (§6B).
        // PromptStage's own chargeKey gives the gentle charge-in on every new selection
        // (reduced-motion parity built in).
        <PromptStage accent={ALPHABET_ACCENT} chargeKey={currentIndex}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { xs: 0.5, md: 1 },
              width: '100%',
              height: '100%',
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                lineHeight: 1,
                color: muiTheme.scene.dark ? '#FFFFFF' : ALPHABET_ACCENT,
                textShadow: muiTheme.scene.dark
                  ? '0 2px 10px rgba(0,0,0,0.5)'
                  : audio.isPlaying
                    ? `0 0 24px ${hexToRgba(ALPHABET_ACCENT, 0.45)}`
                    : 'none',
                fontSize: 'clamp(2.75rem, 15vh, 6.5rem)',
                transition: 'text-shadow 0.3s ease',
                [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.9rem, 22vh, 2.6rem)' },
              }}
            >
              {DANISH_ALPHABET[currentIndex]}
            </Typography>
            {LETTER_WORDS[DANISH_ALPHABET[currentIndex]] && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1.25 } }}>
                <Typography sx={{ fontSize: 'clamp(1.4rem, 6vh, 2.4rem)', lineHeight: 1, [PHONE_LANDSCAPE]: { fontSize: '1.3rem' } }}>
                  {LETTER_WORDS[DANISH_ALPHABET[currentIndex]].emoji}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: muiTheme.scene.dark ? 'rgba(255,255,255,0.85)' : 'text.secondary',
                    fontSize: 'clamp(1rem, 3.5vh, 1.6rem)',
                    [PHONE_LANDSCAPE]: { fontSize: '0.9rem' },
                  }}
                >
                  {LETTER_WORDS[DANISH_ALPHABET[currentIndex]].word}
                </Typography>
              </Box>
            )}
          </Box>
        </PromptStage>
      }
    >
      {/* Alphabet Grid - Using Reusable Component */}
      <LearningGrid
        items={DANISH_ALPHABET}
        currentIndex={currentIndex}
        onItemClick={goToLetter}
        disabled={!gameReady}
        accent={ALPHABET_ACCENT}
      />
    </GameShell>
  )
}

export default AlphabetLearning