import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Mic, MicOff } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import GameShell from '../common/GameShell'
import PromptStage from '../common/PromptStage'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { mascotBus } from '../../services/mascotBus'
import { CHARGE, POP } from '../../theme/motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { isIOS } from '../../utils/deviceDetection'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { useSpeechInput, SpeechResult } from '../../hooks/useSpeechInput'

type Phase = 'idle' | 'recording' | 'processing' | 'spelling' | 'retry'

const MIN_PRESS_MS = 350 // ignore accidental taps
const MAX_PRESS_MS = 5000 // safety cap (single words need 3-5s; caps STT cost)

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// First word only: split on whitespace, strip punctuation the STT might add.
// Keeps Danish letters (incl. æ/ø/å) and hyphens.
const extractFirstWord = (transcript: string): string => {
  const first = (transcript || '').trim().split(/\s+/)[0] || ''
  return first.replace(/[^a-zA-ZæøåÆØÅ-]/g, '')
}

// Equalizer bar count + stagger — mirrors the Quiz Feel Kit's "Lyt og Find" wonder card so the
// live-waveform language reads the same wherever the app shows "listening" audio (UI/UX Overhaul
// PRD §6D). Idle/reduced-motion → a flat, still row (no transform loop).
const WAVE_BAR_KEYFRAMES = [0.35, 1, 0.5, 0.9, 0.35]

// BIG animated mic + live-waveform equalizer (§6D). Persistent across idle/recording/processing/
// retry — it never remounts mid-gesture (only its `phase`-driven animate targets change), so the
// hold-to-talk pointer capture that started the recording is never lost. Reduced motion → static
// mic (no pulse, no bar animation); the phase colour/opacity state still communicates the mode.
interface MicHeroProps {
  phase: Phase
  supported: boolean
  isBusy: boolean
  accent: string
  dark: boolean
  reduce: boolean
  onPressStart: (e: React.PointerEvent) => void
  onPressEnd: (e?: React.PointerEvent) => void
}

const MicHero: React.FC<MicHeroProps> = ({ phase, supported, isBusy, accent, dark, reduce, onPressStart, onPressEnd }) => {
  const recording = phase === 'recording'

  if (!supported) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <MicOff size={72} color={accent} />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 0.75, md: 1.25 },
        width: '100%',
        height: '100%',
      }}
    >
      <motion.div
        animate={reduce ? undefined : recording ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={reduce ? undefined : recording ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        style={{ display: 'inline-block' }}
      >
        <Box
          role="button"
          aria-label="Sig et ord"
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerLeave={onPressEnd}
          onPointerCancel={onPressEnd}
          sx={{
            width: 'clamp(88px, 24vh, 168px)',
            height: 'clamp(88px, 24vh, 168px)',
            // Phone landscape's whole stage is only ~85px tall (30% of a ~390px-tall body) — the
            // waveform row is dropped there (below) so the mic alone owns the budget; measured via
            // --measure to confirm it clears the frame (was overflowing top+bottom at 96px).
            [PHONE_LANDSCAPE]: { width: 'clamp(52px, 16vh, 72px)', height: 'clamp(52px, 16vh, 72px)' },
            borderRadius: '50%',
            mx: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isBusy ? 'default' : 'pointer',
            userSelect: 'none',
            touchAction: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            background: recording
              ? `radial-gradient(circle at 50% 40%, #FF8A80 0%, ${accent} 100%)`
              : `linear-gradient(160deg, ${accent} 0%, ${darken(accent, 0.28)} 100%)`,
            border: '6px solid white',
            boxShadow: recording
              ? `0 0 0 10px ${hexToRgba(accent, 0.3)}, 0 8px 24px rgba(0,0,0,0.25)`
              : '0 8px 24px rgba(0,0,0,0.25)',
            opacity: isBusy ? 0.6 : 1,
            pointerEvents: isBusy ? 'none' : 'auto',
            transition: 'background 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <Mic size={44} color="white" />
        </Box>
      </motion.div>

      {/* Live waveform — animated equalizer while recording; still row otherwise/reduced motion.
          Hidden on phone landscape: the ~85px stage there is already fully spent on the mic circle
          alone (measured via --measure — the row was overflowing the frame at any smaller size). */}
      <Box
        aria-hidden
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '5px',
          height: 26,
          [PHONE_LANDSCAPE]: { display: 'none' },
        }}
      >
        {WAVE_BAR_KEYFRAMES.map((_, i) => (
          <Box
            key={i}
            component={motion.div}
            animate={recording && !reduce ? { scaleY: WAVE_BAR_KEYFRAMES } : { scaleY: 0.35 }}
            transition={
              recording && !reduce
                ? { duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
            sx={{
              width: 7,
              height: 26,
              [PHONE_LANDSCAPE]: { width: 4, height: 16 },
              borderRadius: 3,
              transformOrigin: 'bottom',
              bgcolor: recording ? '#FF8A80' : hexToRgba(accent, dark ? 0.55 : 0.4),
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

// PROMINENT spell-out banner (§6D) — replaces the old small letter-reveal boxes. Each recognized
// letter pops in with `motion.POP`; the whole word is spoken via the existing per-letter audio in
// `runSpellingSequence` (unchanged). Reduced motion → letters still appear (opacity only, instant).
interface SpellBannerProps {
  word: string
  letters: string[]
  revealCount: number
  accent: string
  dark: boolean
  reduce: boolean
}

const SpellBanner: React.FC<SpellBannerProps> = ({ word, letters, revealCount, accent, dark, reduce }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 1, md: 1.75 }, width: '100%', [PHONE_LANDSCAPE]: { gap: 0.4 } }}>
    <Typography
      sx={{
        fontSize: 'clamp(1.8rem, 8vh, 3.6rem)',
        fontWeight: 800,
        letterSpacing: '0.08em',
        lineHeight: 1,
        color: dark ? '#FFFFFF' : accent,
        textShadow: dark ? '0 2px 10px rgba(0,0,0,0.5)' : 'none',
        [PHONE_LANDSCAPE]: { fontSize: '1.15rem' },
      }}
    >
      {word.toUpperCase()}
    </Typography>
    <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 }, flexWrap: 'wrap', justifyContent: 'center', [PHONE_LANDSCAPE]: { gap: 0.5 } }}>
      {letters.map((letter, index) => {
        const revealed = index < revealCount
        return (
          <motion.div
            key={`${word}-${index}`}
            initial={reduce ? false : { opacity: 0, scale: 0.5 }}
            animate={
              reduce
                ? { opacity: revealed ? 1 : 0.3 }
                : { opacity: revealed ? 1 : 0.3, scale: revealed ? 1 : 0.88 }
            }
            transition={reduce ? { duration: 0 } : POP}
          >
            <Box
              sx={{
                width: { xs: 56, sm: 64, md: 84 },
                height: { xs: 56, sm: 64, md: 84 },
                // Phone-landscape stage budget is only ~80px total; the mic-hero fix above showed
                // this size class needs real margin, not a razor-edge fit — shrunk accordingly.
                [PHONE_LANDSCAPE]: { width: 36, height: 36 },
                borderRadius: '16px',
                border: '3px solid',
                borderColor: revealed ? accent : hexToRgba(accent, dark ? 0.55 : 0.34),
                background: revealed ? 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)' : 'rgba(255,255,255,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: revealed
                  ? `0 6px 0 ${darken(accent, 0.28)}, ${dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`
                  : 'none',
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.8rem' },
                  fontWeight: 700,
                  color: accent,
                  [PHONE_LANDSCAPE]: { fontSize: '1.05rem' },
                }}
              >
                {letter}
              </Typography>
            </Box>
          </motion.div>
        )
      })}
    </Box>
  </Box>
)

const SpeakWordGame: React.FC = () => {
  const muiTheme = useTheme()
  const theme = categoryThemes.ordleg
  const reduce = useReducedMotion()
  const audio = useSimplifiedAudioHook({ componentId: 'SpeakWordGame', autoInitialize: false })
  const speech = useSpeechInput()

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // In-round word count + bounded round (Overhaul Ordleg §3). Open-ended: a "question" = one
  // recognized word; there is NO target word and NO STT grading.
  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
  const firstTryRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const [phase, setPhaseState] = useState<Phase>('idle')
  const [recognizedWord, setRecognizedWord] = useState('')
  const [revealCount, setRevealCount] = useState(0)
  const [micFailed, setMicFailed] = useState(false)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  // Cue the corner guide, clearing the reaction a beat later so it settles + re-fires.
  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  const phaseRef = useRef<Phase>('idle')
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }

  const pressStartRef = useRef(0)
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null)
  const startPromiseRef = useRef<Promise<void> | null>(null)
  const endingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      speech.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const supported = speech.isSupported && !micFailed

  const clearMaxTimer = () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
  }

  const handlePressStart = (e: React.PointerEvent) => {
    // Suppress the iOS long-press callout menu and keep the gesture for getUserMedia.
    e.preventDefault()
    if (phaseRef.current !== 'idle') return
    if (!speech.isSupported) {
      setMicFailed(true)
      return
    }

    // Stop any playback before recording so TTS doesn't feed into the mic.
    audio.updateUserInteraction()
    audio.stopAll()

    endingRef.current = false
    pressStartRef.current = Date.now()
    setPhase('recording')
    // The mascot "listens" while recording (§6D) — a distinct cue from the correct/wrong reaction
    // fired later in handleResult.
    mascotBus.emit('hint')

    // getUserMedia must be invoked synchronously inside this gesture handler.
    const startPromise = speech.start().catch(err => {
      if (mountedRef.current) {
        setMicFailed(true)
        setPhase('idle')
      }
      throw err
    })
    startPromiseRef.current = startPromise
    startPromise.catch(() => { /* handled above */ })

    clearMaxTimer()
    maxTimerRef.current = setTimeout(() => {
      handlePressEnd()
    }, MAX_PRESS_MS)
  }

  const handlePressEnd = async (e?: React.PointerEvent) => {
    if (e) e.preventDefault()
    if (phaseRef.current !== 'recording') return
    if (endingRef.current) return
    endingRef.current = true
    clearMaxTimer()

    const duration = Date.now() - pressStartRef.current

    // Make sure capture actually started before we try to stop it.
    try {
      await startPromiseRef.current
    } catch {
      // getUserMedia failed — fallback already shown.
      endingRef.current = false
      return
    }

    if (duration < MIN_PRESS_MS) {
      // Accidental tap — quietly reset.
      speech.cancel()
      setPhase('idle')
      endingRef.current = false
      return
    }

    setPhase('processing')
    let result: SpeechResult | null
    try {
      result = await speech.stopAndRecognize()
    } catch {
      result = null
    }
    if (!mountedRef.current) return
    await handleResult(result)
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'ordleg.mic',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 } },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
    firstTryRef.current = true
    setPhase('idle')
    endingRef.current = false
  }

  const handleResult = async (result: SpeechResult | null) => {
    const word = extractFirstWord(result?.transcript ?? '')

    if (!word) {
      // Friendly retry — no failure feeling. Stay on the SAME question (don't advance/count); this
      // is the only thing that breaks "first try".
      firstTryRef.current = false
      setPhase('retry')
      reactGuide('think')
      try {
        await audio.speak('Det hørte jeg ikke helt. Prøv igen!')
      } catch { /* ignore */ }
      if (!mountedRef.current) return
      setPhase('idle')
      endingRef.current = false
      return
    }

    setRecognizedWord(word)
    setRevealCount(0)
    setPhase('spelling')
    reactGuide('cheer')
    incrementScore()

    await runSpellingSequence(word)

    if (!mountedRef.current) return

    // One recognized word = one completed question. Advance the round (or finish it).
    const r = round.completeQuestion(firstTryRef.current)
    if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
    if (r.done) {
      finishRound(r.firstTryCorrect, r.longestStreak)
    } else {
      firstTryRef.current = true // fresh question
      setPhase('idle')
    }
    endingRef.current = false
  }

  const runSpellingSequence = async (word: string) => {
    const upper = word.toUpperCase()
    const letters = upper.split('')

    // Read the whole word back.
    try {
      await audio.speak(word)
    } catch { /* ignore */ }
    await wait(400)
    if (!mountedRef.current) return

    // Spell it out one letter at a time with the Danish letter sound.
    for (let i = 0; i < letters.length; i++) {
      if (!mountedRef.current) return
      setRevealCount(i + 1)
      try {
        await audio.speakLetter(letters[i])
      } catch { /* ignore */ }
      await wait(180)
    }

    await wait(250)
    if (!mountedRef.current) return

    // Celebrate and say the whole word again.
    celebrateTier('micro')
    try {
      await audio.speak(word)
    } catch { /* ignore */ }

    await wait(isIOS() ? 1500 : 2000)
    if (!mountedRef.current) return
    stopCelebration()
  }

  const isBusy = phase === 'processing' || phase === 'spelling'
  const letters = recognizedWord.toUpperCase().split('')

  return (
    <GameShell
      categoryId="ordleg"
      title="Sig et Ord"
      backRoute="/ordleg"
      dense
      guideReaction={guideReaction}
      score={<OrdlegScoreChip answered={score} total={8} disabled={isScoreNarrating} onClick={handleScoreClick} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        roundOutcome ? undefined : (
          <PromptStage accent={theme.accentColor}>
            <MicHero
              phase={phase}
              supported={supported}
              isBusy={isBusy}
              accent={theme.accentColor}
              dark={muiTheme.scene.dark}
              reduce={reduce}
              onPressStart={handlePressStart}
              onPressEnd={handlePressEnd}
            />
          </PromptStage>
        )
      }
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="ordleg"
          backRoute="/ordleg"
          onReplay={handleReplay}
        />
      ) : (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            overflow: 'hidden',
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {!supported ? (
            // Graceful fallback when getUserMedia is unavailable / blocked.
            <Box sx={{ textAlign: 'center', px: 2 }}>
              <Typography
                sx={{
                  fontSize: { xs: '1.1rem', md: '1.4rem' },
                  fontWeight: 700,
                  color: theme.accentColor,
                }}
              >
                Mikrofonen virker ikke her.
              </Typography>
              <Typography sx={{ color: 'text.secondary', mt: 1, fontSize: { xs: '0.95rem', md: '1.1rem' } }}>
                Prøv at give adgang til mikrofonen, eller åbn spillet i en anden browser.
              </Typography>
            </Box>
          ) : phase === 'spelling' && recognizedWord ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? { duration: 0 } : CHARGE}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <SpellBanner
                word={recognizedWord}
                letters={letters}
                revealCount={revealCount}
                accent={theme.accentColor}
                dark={muiTheme.scene.dark}
                reduce={reduce}
              />
            </motion.div>
          ) : (
            <>
              <Typography
                sx={{
                  fontSize: { xs: '1.15rem', md: '1.5rem' },
                  fontWeight: 700,
                  textAlign: 'center',
                  // White on dark immersive scenes (accent teal is too dim there).
                  color: muiTheme.scene.dark ? '#FFFFFF' : theme.accentColor,
                }}
              >
                {phase === 'idle' && 'Hold knappen og sig et ord!'}
                {phase === 'recording' && 'Jeg lytter…'}
                {phase === 'processing' && 'Lad mig tænke…'}
                {phase === 'retry' && 'Det hørte jeg ikke helt – prøv igen!'}
              </Typography>
              <Typography
                sx={{
                  color: muiTheme.scene.dark ? 'rgba(255,255,255,0.8)' : 'text.secondary',
                  fontSize: { xs: '0.9rem', md: '1.05rem' },
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                Hold knappen nede mens du taler
              </Typography>
            </>
          )}
        </Box>
      )}
    </GameShell>
  )
}

export default SpeakWordGame
