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
import StickerReveal from '../common/StickerReveal'
import { useCelebration } from '../common/CelebrationEffect'
import { progressStore, type StickerAward } from '../../services/progressStore'
import { levelUpBus } from '../../services/levelUpBus'
import { stickerSetForSection } from '../../config/stickers'
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
// Award a sticker every N distinct letters tapped. 29 letters → awards at 9 / 18 / 27 (3 stickers),
// echoing the 9-per-album-page motif. Tunable constant (mirrors Lær Tal's EXPLORE_MILESTONE = 12).
const EXPLORE_MILESTONE = 9

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

  // Award an exploration sticker when distinct-tap count crosses each milestone. Returns true when
  // it spoke the sticker line, so the caller skips the letter echo (they'd otherwise cancel each
  // other nondeterministically — PRD-06 §3).
  const maybeAwardExploration = (): boolean => {
    const size = exploredRef.current.size
    const milestone = Math.floor(size / EXPLORE_MILESTONE)
    if (milestone > milestoneRef.current) {
      milestoneRef.current = milestone
      // Browse XP (Liveliness PRD-01): a flat grant at the same distinct-tap milestone (distinct-tap
      // gating is the anti-farm — re-tapping one tile earns nothing). Fire the level-up ceremony if
      // it crossed a level; the app-root watcher is the safety net.
      const xp = progressStore.grantXp('alphabet', 6, 'browse-milestone')
      if (xp.global.leveledUp) levelUpBus.emit({ level: xp.global.levelAfter, section: xp.section })
      const award = progressStore.awardSticker(stickerSetForSection('alphabet'))
      setStickerAward(award)
      celebrateTier('sticker')
      if (stickerTimer.current) clearTimeout(stickerTimer.current)
      stickerTimer.current = setTimeout(() => setStickerAward(null), 3600)
      // Speak the sticker name (browse has no other TTS competing here). Duplicate = shiny, not
      // "new" — match the StickerReveal banner (PRD-09 P2).
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

  const goToLetter = async (index: number) => {
    const letter = DANISH_ALPHABET[index]
    hasInteractedRef.current = true

    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()

    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()

    setCurrentIndex(index)

    exploredRef.current.add(letter)
    // On a milestone tap the sticker line is the reward audio — don't also speak the letter.
    if (maybeAwardExploration()) return

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
    </GameShell>
  )
}

export default AlphabetLearning