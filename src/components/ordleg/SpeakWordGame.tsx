import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Typography
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Mic, MicOff } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
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

const SpeakWordGame: React.FC = () => {
  const muiTheme = useTheme()
  const theme = categoryThemes.ordleg
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
      score={<OrdlegScoreChip score={score} disabled={isScoreNarrating} onClick={handleScoreClick} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="ordleg"
          backRoute="/ordleg"
          onReplay={handleReplay}
        />
      ) : (
      <>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {!supported ? (
          // Graceful fallback when getUserMedia is unavailable / blocked.
          <Box sx={{ textAlign: 'center', px: 2 }}>
            <MicOff size={64} color={theme.accentColor} />
            <Typography
              sx={{
                                fontSize: { xs: '1.1rem', md: '1.4rem' },
                fontWeight: 700,
                color: theme.accentColor,
                mt: 2
              }}
            >
              Mikrofonen virker ikke her.
            </Typography>
            <Typography sx={{ color: 'text.secondary', mt: 1, fontSize: { xs: '0.95rem', md: '1.1rem' } }}>
              Prøv at give adgang til mikrofonen, eller åbn spillet i en anden browser.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Instruction / status text */}
            <Box sx={{ textAlign: 'center', flex: '0 0 auto', mb: { xs: 2, md: 3 }, minHeight: 56 }}>
              <Typography
                sx={{
                                    fontSize: { xs: '1.15rem', md: '1.5rem' },
                  fontWeight: 700,
                  color: theme.accentColor
                }}
              >
                {phase === 'idle' && 'Hold knappen og sig et ord!'}
                {phase === 'recording' && 'Jeg lytter…'}
                {phase === 'processing' && 'Lad mig tænke…'}
                {phase === 'retry' && 'Det hørte jeg ikke helt – prøv igen!'}
                {phase === 'spelling' && 'Sådan staves det:'}
              </Typography>
            </Box>

            {/* Spelling display */}
            <Box
              sx={{
                flex: '0 0 auto',
                minHeight: { xs: 90, md: 120 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: { xs: 2, md: 3 }
              }}
            >
              {phase === 'spelling' && recognizedWord && (
                <Box sx={{ display: 'flex', gap: { xs: 0.75, md: 1.25 }, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {letters.map((letter, index) => {
                    const revealed = index < revealCount
                    return (
                      <motion.div
                        key={`${recognizedWord}-${index}`}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={revealed ? { opacity: 1, scale: 1 } : { opacity: 0.25, scale: 0.85 }}
                        transition={{ duration: 0.25 }}
                      >
                        <Box
                          sx={{
                            width: { xs: 48, sm: 56, md: 72 },
                            height: { xs: 48, sm: 56, md: 72 },
                            borderRadius: 2,
                            border: '3px solid',
                            borderColor: revealed ? theme.accentColor : theme.borderColor,
                            bgcolor: revealed ? 'white' : 'rgba(255,255,255,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: muiTheme.scene.dark
                              ? '0 12px 30px rgba(0,0,0,0.45)'
                              : '0 6px 18px rgba(0,0,0,0.12)'
                          }}
                        >
                          <Typography
                            sx={{
                                                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2.5rem' },
                              fontWeight: 700,
                              color: theme.accentColor
                            }}
                          >
                            {letter}
                          </Typography>
                        </Box>
                      </motion.div>
                    )
                  })}
                </Box>
              )}
            </Box>

            {/* Magic mic button */}
            <Box sx={{ flex: '0 0 auto', textAlign: 'center' }}>
              <motion.div
                animate={
                  phase === 'recording'
                    ? { scale: [1, 1.12, 1] }
                    : { scale: 1 }
                }
                transition={
                  phase === 'recording'
                    ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 0.2 }
                }
                style={{ display: 'inline-block' }}
              >
                <Box
                  role="button"
                  aria-label="Sig et ord"
                  onPointerDown={handlePressStart}
                  onPointerUp={handlePressEnd}
                  onPointerLeave={handlePressEnd}
                  onPointerCancel={handlePressEnd}
                  sx={{
                    width: { xs: 140, md: 168 },
                    height: { xs: 140, md: 168 },
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
                    background: phase === 'recording'
                      ? `radial-gradient(circle at 50% 40%, #FF8A80 0%, ${theme.accentColor} 100%)`
                      : theme.games[1]?.gradient || theme.gradient,
                    border: '6px solid white',
                    boxShadow: phase === 'recording'
                      ? `0 0 0 8px ${theme.accentColor}33, 0 8px 24px rgba(0,0,0,0.25)`
                      : '0 8px 24px rgba(0,0,0,0.25)',
                    opacity: isBusy ? 0.6 : 1,
                    pointerEvents: isBusy ? 'none' : 'auto',
                    transition: 'background 0.2s ease, box-shadow 0.2s ease'
                  }}
                >
                  <Mic size={64} color="white" />
                </Box>
              </motion.div>
              <Typography
                sx={{
                  mt: 2,
                  color: 'text.secondary',
                  fontSize: { xs: '0.9rem', md: '1.05rem' },
                  fontWeight: 600
                }}
              >
                Hold knappen nede mens du taler
              </Typography>
            </Box>
          </>
        )}
      </Box>

      <AnimatePresence>
        {/* recognized word headline above the spelling once known */}
        {phase === 'spelling' && recognizedWord && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}
          >
            <Typography
              sx={{
                                fontSize: 'clamp(2rem, 9vw, 4rem)',
                fontWeight: 700,
                color: theme.accentColor,
                letterSpacing: '0.08em'
              }}
            >
              {recognizedWord.toUpperCase()}
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </GameShell>
  )
}

export default SpeakWordGame
