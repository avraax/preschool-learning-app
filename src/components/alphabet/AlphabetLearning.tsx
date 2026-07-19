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
import PromptFocus from '../common/PromptFocus'
import { useCelebration } from '../common/CelebrationEffect'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { LETTER_WORDS } from '../../config/letterWords'
import { letterArt } from '../../assets/games/alphabet'
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

// Example word + baked-art subject for the bloomed letter come from the shared LETTER_WORDS manifest.
// Only letters with a clear, child-friendly Danish word are included — Q/W/X/Å have none, so their
// bloom is glyph-only (PromptFocus renders the giant letter alone, no picture/word row).

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
      // Reinforce the sound↔word association on tap (PRD-14 W3 / audit §A3): for a child who already
      // knows every letter, the bare name is dead — speak "{bogstav} som {ord}" (e.g. "A som Abe")
      // instead. These exact strings already ship (the memory game's speakMatchedItem uses the same
      // LETTER_WORDS table for all 29 letters), so no new narration is introduced. Falls back to the
      // name-only read only if a letter ever lacks a LETTER_WORDS entry.
      const data = LETTER_WORDS[letter]
      await (data ? audio.speak(`${letter} som ${data.word}`) : audio.speakLetter(letter))
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
      promptStage={
        // Selected letter blooms large in the calm world (PRD-07): PromptFocus grounds it on a
        // light-pool + contact shadow (no frosted card). The giant glyph stays the lesson; the baked
        // soft-3D object rests where the emoji was (emoji is the art-gated fallback), with the word
        // beside it. Q/W/X/Å have no LETTER_WORDS entry → glyph-only bloom. chargeKey re-runs the
        // charge-in per selection (reduced-motion parity built into PromptFocus).
        (() => {
          const letter = DANISH_ALPHABET[currentIndex]
          const data = LETTER_WORDS[letter]
          const art = letterArt(letter)
          return (
            <PromptFocus
              accent={ALPHABET_ACCENT}
              chargeKey={currentIndex}
              subject={
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // PRD-18 W5: enlarge + vertically centre the bloom so the letter + picture fill the
                    // band above the grid (they used to sit small and high with a dead band). A bit more
                    // breathing room between the giant glyph and the picture+word row.
                    gap: { xs: 0.75, md: 1.5 },
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
                      // Bigger hero glyph (PRD-18 W5) — fills the focal band; phone-landscape keeps its
                      // tight vh-capped size so the ~85px stage there never overflows.
                      fontSize: 'clamp(3.25rem, 20vh, 9rem)',
                      transition: 'text-shadow 0.3s ease',
                      [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.9rem, 22vh, 2.8rem)' },
                    }}
                  >
                    {letter}
                  </Typography>
                  {data && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
                      {art && (
                        <Box
                          component="img"
                          src={art}
                          alt=""
                          aria-hidden
                          draggable={false}
                          sx={{
                            // Bigger baked picture beside the word (PRD-18 W5).
                            height: 'clamp(3rem, 14vh, 6.5rem)',
                            width: 'auto',
                            objectFit: 'contain',
                            userSelect: 'none',
                            pointerEvents: 'none',
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
                            [PHONE_LANDSCAPE]: { height: '2rem' },
                          }}
                        />
                      )}
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: muiTheme.scene.dark ? 'rgba(255,255,255,0.85)' : 'text.secondary',
                          fontSize: 'clamp(1.15rem, 4.2vh, 2.1rem)',
                          [PHONE_LANDSCAPE]: { fontSize: '0.95rem' },
                        }}
                      >
                        {data.word}
                      </Typography>
                    </Box>
                  )}
                </Box>
              }
            />
          )
        })()
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