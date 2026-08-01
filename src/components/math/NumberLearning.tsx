import React, { useState, useEffect, useRef } from 'react'
import {
  Typography,
  Box
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Play, Square } from 'lucide-react'
import GameShell from '../common/GameShell'
import LearningGrid from '../common/LearningGrid'
import PromptFocus from '../common/PromptFocus'
import TactilePill from '../common/TactilePill'
import { useCelebration } from '../common/CelebrationEffect'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { NUMBER_BROWSE_RATE, NUMBER_STEP_MS } from '../../config/numberAutoplay'
import { FIRST_ITEM_EXTRA_MS } from '../../config/autoplayPace'
import { hexToRgba, relLuminance } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { useDifficulty } from '../../hooks/useDifficulty'
import { sfx } from '../../services/sfxClient'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Lær Tal — a calm 1–100 browse. Tapping a number speaks it; exploring distinct numbers earns a
// sticker at each milestone. Instant load: the grid is interactive from the first render and the
// welcome narrates over it.

const MATH_ACCENT = categoryThemes.math.accentColor

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

  // "Hør tallene" autoplay — the number sibling of Lær Alfabetet's "Hør alfabetet". Same mechanism:
  // an incrementing run token checked after every await (a tap, a re-press or unmount aborts the loop;
  // `mountedRef` alone can't see the first two), and the clips are paced on a fixed onset step rather
  // than awaited, because awaiting Azure's padded clips halves the pace (see autoplayPace.ts).
  // No grouping and no tempo change here — counting is one steady flow (owner decision).
  const [isRunning, setIsRunning] = useState(false)
  const runIdRef = useRef(0)
  const mountedRef = useRef(true)

  // Owns its own empty-dep effect (see game-development.md): folded into another effect's cleanup it
  // gets stranded false by StrictMode's mount→cleanup→remount.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      runIdRef.current += 1 // nothing may keep counting over the next screen
    }
  }, [])

  const { showCelebration, celebrationIntensity, celebrationDuration, stopCelebration } = useCelebration()

  // Per-new-item browse XP (Liveliness PRD-04) — replaces the old milestone sticker. Each newly
  // explored number feeds the shared cross-game level + ticks the header ring.
  const awardBrowseXp = useBrowseXp('math')

  // W3 (PRD-15): the range scales with the MANUAL difficulty level (authoritative, no adaptivity).
  // Let stays at his comfortable ~60 ceiling — 6 clean rows of big ≥44px tiles. Normal/Svær go to the
  // full 100 (owner ask); the smaller tiles at 100 are the accepted trade-off, and the 10-column
  // hundreds-chart keeps the tens aligned (base-10 pattern) at any size.
  const difficulty = useDifficulty('math')
  const maxNumber = difficulty === 'let' ? 60 : 100
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1)

  // If the adult lowers the difficulty mid-browse (Normal/Svær → Let), the range shrinks — keep the
  // highlighted cell in-bounds so the bloomed numeral never reads `undefined`.
  useEffect(() => {
    if (currentIndex > maxNumber - 1) setCurrentIndex(maxNumber - 1)
  }, [maxNumber, currentIndex])

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

  // Aborts any in-flight autoplay run. Bumping the token stops the LOOP (every await re-checks it);
  // cancelling the audio silences the number already in flight. Safe to call when nothing is running.
  const stopRun = () => {
    runIdRef.current += 1
    setIsRunning(false)
    audio.cancelCurrentAudio()
  }

  // Count 1→N out loud at a steady pace, driving `currentIndex` so the grid ring and the bloomed
  // numeral travel in step. Follows the VISIBLE range (so it ends at the difficulty's
  // ceiling — 100 at Normal/Svær, 60 at Let), because the highlight has to have a cell to land on.
  // No XP: one press would touch every number and mint the section's whole browse allowance.
  const playNumbers = async () => {
    // Claim this run and abort any previous one in the same move.
    const runId = ++runIdRef.current
    const alive = () => mountedRef.current && runIdRef.current === runId

    hasInteractedRef.current = true // a late welcome must not talk over the run
    sfx.play('tap')
    audio.updateUserInteraction() // iOS: refresh the gesture timestamp before playback
    audio.cancelCurrentAudio()
    setIsRunning(true)

    // Warm the clips at the SAME rate the run speaks them (the rate is part of the prebake key).
    audio.prefetchNumbers(numbers, NUMBER_BROWSE_RATE)

    for (let i = 0; i < numbers.length; i++) {
      if (!alive()) return
      setCurrentIndex(i)
      // Deliberately NOT awaited — the clip is ~1.3–1.7s but the number is spoken in ≤1.14s, so
      // awaiting it would sit through Azure's trailing silence. The next number cancels that tail.
      audio.speakNumber(numbers[i], NUMBER_BROWSE_RATE).catch((error) => {
        logError('Error speaking number', { number: numbers[i], error: error?.toString() })
      })
      // The pickup beat carries the cold audio-unlock cost; every number after it is on the beat.
      await wait(i === 0 ? NUMBER_STEP_MS + FIRST_ITEM_EXTRA_MS : NUMBER_STEP_MS)
      if (!alive()) return
    }

    setIsRunning(false) // stops on the last number: no loop, no celebration
  }

  const goToNumber = async (index: number) => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    if (audio.isPlaying) audio.cancelCurrentAudio()

    // A tap stops the autoplay run, then behaves exactly as it always has (incl. browse XP).
    stopRun()

    setCurrentIndex(index)

    const number = numbers[index]
    // Per-new-item browse XP (Liveliness PRD-04): first visit to this number feeds the level + ticks
    // the ring. We always still speak the number.
    awardBrowseXp(String(number))

    try {
      // Slightly faster for number counting — the shared rate the autoplay and the prebake use.
      await audio.speakNumber(number, NUMBER_BROWSE_RATE)
    } catch (error) {
      logError('Error speaking number', { number, error: error?.toString() })
    }
  }

  // The autoplay pill takes its accent from the ACTIVE skin (getCategoryTheme, never the static map)
  // and RepeatButton's legible-on-accent rule, so it matches the HUD family on every theme.
  const autoplayAccent = getCategoryTheme('math').accentColor
  const onAutoplayAccent = relLuminance(autoplayAccent) > 0.5 ? '#1F2937' : '#FFFFFF'

  // Deliberately NO `score` slot: the "N / 100" position counter, its tap-to-announce and the progress
  // bar beside it were removed — a browse has no score and no finish line, so a filling bar only implied
  // the child was working through a list. Matches Lær Alfabetet; the other two browses (Lær Engelsk, Lær
  // Farver) never had one. The header keeps the shared reward ring.
  return (
    <GameShell
      categoryId="math"
      title="Lær Tal"
      backRoute="/math"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        // Selected number blooms large + its counted objects (§6B). Games Visual Uplift (PRD-08
        // §3.7): the frosted PromptStage card is retired — the bloom now rests in PromptFocus's
        // in-world light-pool; its chargeKey gives the gentle charge-in on every new selection
        // (reduced-motion parity built in).
        <PromptFocus
          accent={MATH_ACCENT}
          chargeKey={currentIndex}
          subject={
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
                  // The numeral is now the ONLY thing in the bloom (the count cluster was removed), so
                  // it takes the space the stars/dots used to hold and reads as the hero of the screen.
                  fontSize: 'clamp(3rem, 19vh, 8rem)',
                  transition: 'text-shadow 0.3s ease',
                  [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.9rem, 22vh, 2.6rem)' },
                }}
              >
                {numbers[currentIndex]}
              </Typography>
            </Box>
          }
          repeat={
            // The floating pill slot the quizzes fill with "Hør igen" — empty here until now. Same
            // TactilePill material as RepeatButton so it reads as one HUD family. lucide icons only
            // (noEmoji.test.ts fails the build on a pictographic glyph in src/**).
            <TactilePill
              accent={autoplayAccent}
              onClick={isRunning ? stopRun : playNumbers}
              ariaLabel={isRunning ? 'Stop' : 'Hør tallene'}
              sx={{
                color: onAutoplayAccent,
                gap: 1,
                px: 3.5,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 700,
                [PHONE_LANDSCAPE]: { px: 2, py: 0.75, fontSize: '0.9rem', minHeight: 44 },
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                {isRunning ? <Square size={22} /> : <Play size={22} />}
              </Box>
              {isRunning ? 'Stop' : 'Hør tallene'}
            </TactilePill>
          }
        />
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
    </GameShell>
  )
}

export default NumberLearning
