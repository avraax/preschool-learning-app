import React, { useState, useEffect, useRef } from 'react'
import {
  Typography,
  Box
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Play, Square } from 'lucide-react'
import { categoryThemes, getCategoryTheme } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import LearningGrid from '../common/LearningGrid'
import PromptFocus from '../common/PromptFocus'
import TactilePill from '../common/TactilePill'
import { useCelebration } from '../common/CelebrationEffect'
import { useBrowseXp } from '../../hooks/useBrowseXp'
import { LETTER_WORDS, letterPhrase } from '../../config/letterWords'
import { ALPHABET_GROUPS, DANISH_ALPHABET, LETTER_STEP_MS, GROUP_PAUSE_MS } from '../../config/alphabetGroups'
import { FIRST_ITEM_EXTRA_MS } from '../../config/autoplayPace'
import { letterArt } from '../../assets/games/alphabet'
import { hexToRgba, relLuminance } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { sfx } from '../../services/sfxClient'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 AlphabetLearning: ${message}`, data)
  }
}


const ALPHABET_ACCENT = categoryThemes.alphabet.accentColor

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Example word + baked-art subject for the bloomed letter come from the shared LETTER_WORDS manifest.
// All 29 letters carry a word + picture now (Q/W/X/Å were added on owner request), so every letter
// blooms with the picture/word row; the glyph-only fallback below only triggers if a letter ever loses
// its LETTER_WORDS entry. Q/W/X stay DISPLAY-ONLY — Bogstav Quiz never asks them (see WORD_LETTERS).

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

  // "Hør alfabetet" autoplay (PRD alfabet-autoplay). The run is a plain await-loop modelled on
  // SpeakWordGame's runSpellingSequence, but it needs TWO guards, not one: `mountedRef` for unmount
  // and an incrementing `runIdRef` so a letter tap or a re-press aborts the loop. The audio
  // controller has no queue (new audio cancels current), so a tap already silences the in-flight
  // letter — the run token is what stops the LOOP from carrying on and talking over it.
  const [isRunning, setIsRunning] = useState(false)
  const runIdRef = useRef(0)
  const mountedRef = useRef(true)

  // Owns its own empty-dep effect (see game-development.md): folded into another effect's cleanup it
  // gets stranded false by StrictMode's mount→cleanup→remount.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      runIdRef.current += 1 // nothing may keep speaking over the next screen
    }
  }, [])

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

  // Aborts any in-flight autoplay run. Bumping the token stops the LOOP (every await re-checks it);
  // cancelling the audio silences the letter already in flight, so "Stop" is immediate rather than
  // trailing one more letter name. Safe to call when nothing is running.
  const stopRun = () => {
    runIdRef.current += 1
    setIsRunning(false)
    audio.cancelCurrentAudio()
  }

  // Speak A→Å at a fixed tempo, grouped the way the alphabet is recited, driving `currentIndex` so
  // the grid ring and the bloom travel in step (the highlight leads each letter's sound). No XP: a
  // 38s run touching all 29 letters would mint the whole section's browse allowance in one press.
  const playAlphabet = async () => {
    // Claim this run and abort any previous one in the same move.
    const runId = ++runIdRef.current
    const alive = () => mountedRef.current && runIdRef.current === runId

    hasInteractedRef.current = true // a late welcome must not talk over the run
    sfx.play('tap')
    audio.updateUserInteraction() // iOS: refresh the gesture timestamp before playback
    audio.cancelCurrentAudio()
    setIsRunning(true)

    // Warm all 29 clips up front. On a timed run the per-clip first fetch is taken out of the
    // letter's SPEAKING time, not out of the pause, so without this the step has to be padded by
    // ~250ms of dead air per letter (or it cuts the longest names off — measured on W).
    audio.prefetchLetters(DANISH_ALPHABET)

    for (let g = 0; g < ALPHABET_GROUPS.length; g++) {
      for (const letter of ALPHABET_GROUPS[g]) {
        if (!alive()) return
        setCurrentIndex(DANISH_ALPHABET.indexOf(letter))
        // The bare letter NAME here — not the browse tap's "{bogstav} som {ord}". The lesson of this
        // button is the SEQUENCE, and 29 example words would bury it (and take ~3 minutes).
        //
        // Deliberately NOT awaited (this is the one place the run departs from runSpellingSequence):
        // the clip is 1.25–1.73s but the NAME is over in ≤1.04s, so awaiting it means sitting through
        // Azure's trailing silence and the letters land ~1.7s apart — the plod the owner rejected. We
        // pace on LETTER_STEP_MS and let the next letter cancel the previous clip's dead tail.
        audio.speakLetter(letter).catch((error) => {
          logError('Error speaking letter', { letter, error: error?.toString() })
        })
        // The pickup beat carries the cold audio-unlock cost; every letter after it is on the beat.
        await wait(letter === 'A' ? LETTER_STEP_MS + FIRST_ITEM_EXTRA_MS : LETTER_STEP_MS)
        if (!alive()) return
      }
      // The audible phrasing: one extra breath after the group, on top of that letter's step.
      if (g < ALPHABET_GROUPS.length - 1) {
        await wait(GROUP_PAUSE_MS)
        if (!alive()) return
      }
    }

    setIsRunning(false) // stops on Å: no loop, no celebration
  }

  const goToLetter = async (index: number) => {
    const letter = DANISH_ALPHABET[index]
    hasInteractedRef.current = true

    // A tap stops the autoplay run, then behaves exactly as it always has (incl. browse XP).
    stopRun()

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
      // `letterPhrase` is the single builder for this line — it carries the per-letter pronunciation
      // fixes (Z respelled 'zet'; I comma-isolated so Azure reads the letter name, not the pronoun)
      // and is shared with the prebake enumerator so the clip keys can't drift.
      const data = LETTER_WORDS[letter]
      await (data ? audio.speak(letterPhrase(letter, data.word)) : audio.speakLetter(letter))
    } catch (error) {
      logError('Error speaking letter', {
        letter,
        error: error?.toString()
      })
    }
  }


  // The autoplay pill takes its accent from the ACTIVE skin (getCategoryTheme, never the static map)
  // and RepeatButton's legible-on-accent rule, so it matches the HUD family on every theme.
  const autoplayAccent = getCategoryTheme('alphabet').accentColor
  const onAutoplayAccent = relLuminance(autoplayAccent) > 0.5 ? '#1F2937' : '#FFFFFF'

  // Deliberately NO `score` slot: the "18 / 29" position counter, its tap-to-announce and the progress
  // bar beside it were removed — a browse has no score and no finish line, so a filling bar only
  // implied the child was working through a list. The header keeps the shared reward ring.
  return (
    <GameShell
      categoryId="alphabet"
      title="Lær Alfabetet"
      backRoute="/alphabet"
      dense
      guide={false}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
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
                    // band above the grid (they used to sit small and high with a dead band). Trimmed
                    // back a notch by the autoplay PRD: the focal band now also carries the "Hør
                    // alfabetet" pill, and W5's sizes overflowed the subject zone into it (measured:
                    // the picture ran 30px UNDER the pill on a 1024×768 iPad). Still well above the
                    // pre-W5 sizes — the vh caps below are the levers if the band ever changes.
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
                      // Big hero glyph (PRD-18 W5, trimmed to share the band with the pill);
                      // phone-landscape keeps its own tight vh-capped size so the short stage there
                      // never overflows.
                      fontSize: 'clamp(2.6rem, 13vh, 7rem)',
                      transition: 'text-shadow 0.3s ease',
                      [PHONE_LANDSCAPE]: { fontSize: 'clamp(1.2rem, 12vh, 1.6rem)' },
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
                            // Baked picture beside the word (PRD-18 W5, trimmed for the pill).
                            height: 'clamp(2.25rem, 7.5vh, 5rem)',
                            width: 'auto',
                            objectFit: 'contain',
                            userSelect: 'none',
                            pointerEvents: 'none',
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.18))',
                            [PHONE_LANDSCAPE]: { height: '1.3rem' },
                          }}
                        />
                      )}
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: muiTheme.scene.dark ? 'rgba(255,255,255,0.85)' : 'text.secondary',
                          fontSize: 'clamp(1.05rem, 3.6vh, 1.8rem)',
                          [PHONE_LANDSCAPE]: { fontSize: '0.75rem' },
                        }}
                      >
                        {data.word}
                      </Typography>
                    </Box>
                  )}
                </Box>
              }
              repeat={
                // The floating pill slot the quizzes fill with "Hør igen" — empty here until now.
                // Same TactilePill material as RepeatButton, so it reads as one HUD family. lucide
                // icons only (noEmoji.test.ts fails the build on a pictographic glyph in src/**).
                <TactilePill
                  accent={autoplayAccent}
                  onClick={isRunning ? stopRun : playAlphabet}
                  ariaLabel={isRunning ? 'Stop' : 'Hør alfabetet'}
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
                  {isRunning ? 'Stop' : 'Hør alfabetet'}
                </TactilePill>
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