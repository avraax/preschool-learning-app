import React, { useState, useEffect, useRef } from 'react'
import {
  Typography,
  Box,
  LinearProgress
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import GameShell from '../common/GameShell'
import LearningGrid from '../common/LearningGrid'
import PromptStage from '../common/PromptStage'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { categoryThemes } from '../../config/categoryThemes'
import { progressStore, type StickerAward } from '../../services/progressStore'
import { levelUpBus } from '../../services/levelUpBus'
import { stickerSetForSection } from '../../config/stickers'
import { hexToRgba } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Tal — a calm 1–100 browse. Tapping a number speaks it; exploring distinct numbers earns a
// sticker at each milestone. Instant load: the grid is interactive from the first render and the
// welcome narrates over it.

const MATH_ACCENT = categoryThemes.math.accentColor
const EXPLORE_MILESTONE = 12 // award a sticker every N distinct numbers tapped

// Count-reinforcement cluster for the bloomed number (UI/UX Overhaul PRD §6B — mirrors Tal Quiz's
// counted-objects idea so the numeral isn't the only channel). Chunky recognisable stars at small
// counts; crisp small dots once the count gets dense (emoji glyphs turn to mush under ~12px, dots
// stay legible) — always renders exactly `n` items so the visual count is real, up to 100.
const ObjectCount: React.FC<{ n: number; accent: string }> = ({ n, accent }) => {
  const useDots = n > 30
  const size = n <= 10 ? 30 : n <= 20 ? 24 : n <= 30 ? 18 : n <= 60 ? 10 : 7
  return (
    <Box
      aria-hidden
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        alignContent: 'center',
        gap: useDots ? '3px' : '5px',
        maxWidth: '92%',
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: n }).map((_, i) =>
        useDots ? (
          <Box
            key={i}
            sx={{ width: size, height: size, borderRadius: '50%', bgcolor: accent, opacity: 0.85, flex: '0 0 auto' }}
          />
        ) : (
          <Box key={i} component="span" sx={{ fontSize: `${size}px`, lineHeight: 1, flex: '0 0 auto', userSelect: 'none' }}>
            ⭐
          </Box>
        )
      )}
    </Box>
  )
}

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

  // Award an exploration sticker when distinct-tap count crosses each milestone. Returns true when
  // it spoke the sticker line, so the caller skips the number echo (PRD-06 §3).
  const maybeAwardExploration = (): boolean => {
    const size = exploredRef.current.size
    const milestone = Math.floor(size / EXPLORE_MILESTONE)
    if (milestone > milestoneRef.current) {
      milestoneRef.current = milestone
      // Browse XP (Liveliness PRD-01): flat grant at each distinct-tap milestone (distinct-tap gate
      // is the anti-farm). Fire the level-up ceremony on a crossing; the app-root watcher backs it.
      const xp = progressStore.grantXp('math', 6, 'browse-milestone')
      if (xp.global.leveledUp) levelUpBus.emit({ level: xp.global.levelAfter, section: xp.section })
      const award = progressStore.awardSticker(stickerSetForSection('math'))
      setStickerAward(award)
      celebrateTier('sticker')
      if (stickerTimer.current) clearTimeout(stickerTimer.current)
      stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
      // Speak the sticker name (browse has no other TTS competing here). A duplicate is a shiny,
      // not a "new" one — match the StickerReveal banner (PRD-09 P2).
      try {
        audio
          .speak(
            award.isNew
              ? `Nyt klistermærke! ${award.sticker.label}`
              : `Skinnende! ${award.sticker.label}`,
          )
          .catch(() => {})
      } catch {
        /* ignore */
      }
      return true
    }
    return false
  }

  const goToNumber = async (index: number) => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    if (audio.isPlaying) audio.cancelCurrentAudio()

    setCurrentIndex(index)

    const number = numbers[index]
    exploredRef.current.add(number)
    // On a milestone tap the sticker line is the reward audio — don't also speak the number.
    if (maybeAwardExploration()) return

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
      promptStage={
        // Selected number blooms large + its counted objects (§6B) — PromptStage's own chargeKey
        // gives the gentle charge-in on every new selection (reduced-motion parity built in).
        <PromptStage accent={MATH_ACCENT} chargeKey={currentIndex}>
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
                color: muiTheme.scene.dark ? '#FFFFFF' : MATH_ACCENT,
                textShadow: muiTheme.scene.dark
                  ? '0 2px 10px rgba(0,0,0,0.5)'
                  : audio.isPlaying
                    ? `0 0 24px ${hexToRgba(MATH_ACCENT, 0.45)}`
                    : 'none',
                fontSize: 'clamp(2.75rem, 15vh, 6.5rem)',
                transition: 'text-shadow 0.3s ease',
                [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.9rem, 24vh, 2.6rem)' },
              }}
            >
              {numbers[currentIndex]}
            </Typography>
            <ObjectCount n={numbers[currentIndex]} accent={MATH_ACCENT} />
          </Box>
        </PromptStage>
      }
    >
      {/* Numbers Grid - Using Reusable Component */}
      <LearningGrid
        items={numbers}
        currentIndex={currentIndex}
        onItemClick={goToNumber}
        disabled={!gameReady}
        accent={MATH_ACCENT}
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
