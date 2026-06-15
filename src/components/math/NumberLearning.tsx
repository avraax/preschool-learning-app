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
import RoundResultScreen from '../common/RoundResultScreen'
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { categoryThemes } from '../../config/categoryThemes'
import { DANISH_PHRASES } from '../../config/danish-phrases'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome, type StickerAward } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Lær Tal — a calm 1–100 browse PLUS a "Find tallet" challenge (Math Overhaul §4). Browsing speaks
// the number and can reveal a ten-frame ("Tæl med mig"); exploring distinct numbers earns stickers
// at milestones. The challenge runs a bounded 8-question round (tap the spoken number on the grid)
// that ends on the shared RoundResultScreen.

const MATH_ACCENT = categoryThemes.math.accentColor
const EXPLORE_MILESTONE = 12 // award a sticker every N distinct numbers tapped in browse

const NumberLearning: React.FC = () => {
  const muiTheme = useTheme()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<'browse' | 'challenge'>('browse')

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'NumberLearning',
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

  // Challenge round state.
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
  const [target, setTarget] = useState<number | null>(null)
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

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

  const browseToNumber = async (index: number) => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    if (audio.isPlaying) audio.cancelCurrentAudio()

    setCurrentIndex(index)

    const number = numbers[index]
    exploredRef.current.add(number)
    maybeAwardExploration()

    try {
      // Use faster speed for number counting (1.2 instead of default 0.8)
      await audio.speakNumber(number, 1.2)
    } catch (error) {
      logError('Error speaking number', { number, error: error?.toString() })
    }
  }

  // ----- challenge -----
  const speakTarget = async (n: number) => {
    try {
      audio.updateUserInteraction()
      await audio.speak(DANISH_PHRASES.gamePrompts.findNumber(n))
    } catch (error) {
      logError('Error speaking target', { n, error: error?.toString() })
    }
  }

  const nextTarget = () => {
    const n = numbers[Math.floor(Math.random() * numbers.length)]
    firstAttemptRef.current = true
    setTarget(n)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => speakTarget(n), isIOS() ? 150 : 400)
  }

  const startChallenge = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    setMode('challenge')
    setCurrentIndex(-1)
    nextTarget()
  }

  const stopChallenge = () => {
    stopCelebration()
    setRoundOutcome(null)
    setTarget(null)
    round.reset()
    setMode('browse')
    setCurrentIndex(0)
  }

  const handleChallengeTap = async (index: number) => {
    if (target === null) return
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    const tapped = numbers[index]

    if (tapped === target) {
      celebrateTier('micro')
      try {
        await audio.speakNumber(tapped, 1.2)
      } catch {
        /* ignore */
      }
      const r = round.completeQuestion(firstAttemptRef.current)
      if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
      if (r.done) {
        const outcome = progressStore.recordRoundResult(
          'math.numbers',
          { correct: r.firstTryCorrect, total: round.length, longestStreak: r.longestStreak },
          { starThresholds: { three: 0, two: 2 } },
        )
        setRoundOutcome(outcome)
      } else {
        nextTarget()
      }
    } else {
      firstAttemptRef.current = false
      sfx.play('wrong')
      try {
        await audio.speakNumber(tapped, 1.2)
      } catch {
        /* ignore */
      }
    }
  }

  const handleGridClick = (index: number) => {
    if (mode === 'challenge') handleChallengeTap(index)
    else browseToNumber(index)
  }

  const progress = ((currentIndex + 1) / numbers.length) * 100
  const displayNumber = mode === 'challenge' ? target : numbers[currentIndex]

  // Header chip: a small pill that toggles browse ↔ challenge.
  const ModeToggle = (
    <Box
      component="button"
      type="button"
      onClick={mode === 'browse' ? startChallenge : stopChallenge}
      sx={{
        minHeight: 44,
        px: { xs: 1.5, md: 2 },
        borderRadius: '999px',
        cursor: 'pointer',
        fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
        fontWeight: 700,
        fontSize: 'clamp(0.8rem, 2.4vw, 1rem)',
        color: '#FFFFFF',
        background: `linear-gradient(180deg, ${MATH_ACCENT} 0%, ${darken(MATH_ACCENT, 0.3)} 100%)`,
        border: '3px solid',
        borderColor: MATH_ACCENT,
        boxShadow: `0 4px 0 ${darken(MATH_ACCENT, 0.3)}, 0 6px 14px ${hexToRgba(MATH_ACCENT, 0.4)}`,
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        '&:active': { transform: 'translateY(3px)', boxShadow: `0 1px 0 ${darken(MATH_ACCENT, 0.3)}` },
      }}
    >
      {mode === 'browse' ? 'Find tallet 🔎' : 'Stop 🏠'}
    </Box>
  )

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
          {mode === 'browse' ? (
            <>
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
              <Box sx={{ width: { xs: 90, sm: 160 }, bgcolor: 'white', borderRadius: 1, p: 0.5, display: { xs: 'none', sm: 'block' } }}>
                <LinearProgress variant="determinate" value={progress} color="secondary" sx={{ height: 8, borderRadius: 1 }} />
              </Box>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: muiTheme.scene.dark ? '#FFFFFF' : 'secondary.dark', fontWeight: 700 }}>
              {round.state.index} / {round.length}
            </Typography>
          )}
          {ModeToggle}
        </Box>
      }
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="math"
          backRoute="/math"
          onReplay={startChallenge}
        />
      ) : (
        <>
          {/* Current Number / challenge target card */}
          <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 0.75, md: 1 } }}>
            <motion.div
              key={`${mode}-${displayNumber}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                sx={{
                  maxWidth: { xs: 130, md: 170 },
                  mx: 'auto',
                  p: { xs: 1, md: 1.5 },
                  bgcolor: audio.isPlaying ? 'secondary.50' : 'white',
                  border: '2px solid',
                  borderColor: audio.isPlaying ? 'secondary.main' : 'primary.200',
                  transition: 'all 0.3s ease',
                  boxShadow: muiTheme.scene.dark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.12)'
                }}
              >
                {mode === 'challenge' && (
                  <Typography sx={{ fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif', fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.85rem' }, color: 'text.secondary', lineHeight: 1 }}>
                    Find tallet
                  </Typography>
                )}
                <Typography
                  variant="h1"
                  sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' }, fontWeight: 700, color: 'primary.dark', textAlign: 'center', lineHeight: 1 }}
                >
                  {displayNumber ?? '?'}
                </Typography>
              </Card>
            </motion.div>
          </Box>

          {/* Numbers Grid - Using Reusable Component */}
          <LearningGrid
            items={numbers}
            currentIndex={currentIndex}
            onItemClick={handleGridClick}
            disabled={!gameReady}
          />
        </>
      )}

      {/* Exploration-milestone sticker reveal (browse). Auto-dismisses; tap to close early. */}
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
