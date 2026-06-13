import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Container,
  Box,
  Typography,
  IconButton,
  AppBar,
  Toolbar
} from '@mui/material'
import { ArrowLeft, Mic, MicOff } from 'lucide-react'
import { categoryThemes } from '../../config/categoryThemes'
import LottieCharacter, { useCharacterState } from '../common/LottieCharacter'
import CelebrationEffect, { useCelebration } from '../common/CelebrationEffect'
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
  const navigate = useNavigate()
  const theme = categoryThemes.ordleg
  const audio = useSimplifiedAudioHook({ componentId: 'SpeakWordGame', autoInitialize: false })
  const speech = useSpeechInput()

  const teacher = useCharacterState('wave')
  const { showCelebration, celebrationIntensity, celebrate, stopCelebration } = useCelebration()

  const [phase, setPhaseState] = useState<Phase>('idle')
  const [recognizedWord, setRecognizedWord] = useState('')
  const [revealCount, setRevealCount] = useState(0)
  const [micFailed, setMicFailed] = useState(false)

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
    teacher.setCharacter('owl')
    teacher.wave()
    return () => {
      mountedRef.current = false
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
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
    teacher.wave()

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

  const handleResult = async (result: SpeechResult | null) => {
    const word = extractFirstWord(result?.transcript ?? '')

    if (!word) {
      // Friendly retry — no failure feeling.
      setPhase('retry')
      teacher.think()
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
    teacher.wave()

    await runSpellingSequence(word)

    if (!mountedRef.current) return
    setPhase('idle')
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
    celebrate()
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
    <Box
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: theme.gradient
      }}
    >
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: 'space-between', py: 1.5 }}>
          <IconButton
            onClick={() => navigate('/ordleg')}
            color="primary"
            size="large"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(8px)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.9)', transform: 'scale(1.05)' }
            }}
          >
            <ArrowLeft size={24} />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              color: theme.accentColor,
              fontWeight: 700,
              fontSize: { xs: '1.25rem', md: '1.6rem' },
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            🎤 Sig et Ord
          </Typography>
          <Box sx={{ width: 48 }} />
        </Toolbar>
      </AppBar>

      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: { xs: 1, md: 2 },
          overflow: 'hidden'
        }}
      >
        {/* Teacher character */}
        <Box sx={{ flex: '0 0 auto', mb: { xs: 1, md: 2 } }}>
          <LottieCharacter
            character={teacher.character}
            state={teacher.state}
            size={88}
            onClick={teacher.wave}
          />
        </Box>

        {!supported ? (
          // Graceful fallback when getUserMedia is unavailable / blocked.
          <Box sx={{ textAlign: 'center', px: 2 }}>
            <MicOff size={64} color={theme.accentColor} />
            <Typography
              sx={{
                fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
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
                  fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
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
                            justifyContent: 'center'
                          }}
                        >
                          <Typography
                            sx={{
                              fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
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
      </Container>

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
                fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
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

      <CelebrationEffect
        show={showCelebration}
        intensity={celebrationIntensity}
        onComplete={stopCelebration}
      />
    </Box>
  )
}

export default SpeakWordGame
