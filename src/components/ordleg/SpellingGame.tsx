import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Typography,
  Paper
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { categoryThemes } from '../../config/categoryThemes'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { OrdlegScoreChip } from '../common/ScoreChip'
import { OrdlegRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// 2-3 letter child-friendly Danish words. Duplicates from the source list removed.
// Includes Æ, Ø, Å to practise the Danish-specific letters.
const SPELLING_WORDS: { word: string; emoji: string }[] = [
  { word: 'ko', emoji: '🐄' },
  { word: 'bi', emoji: '🐝' },
  { word: 'is', emoji: '🍦' },
  { word: 'os', emoji: '🧀' },
  { word: 'sol', emoji: '☀️' },
  { word: 'hus', emoji: '🏠' },
  { word: 'bil', emoji: '🚗' },
  { word: 'kat', emoji: '🐱' },
  { word: 'hej', emoji: '👋' },
  { word: 'hat', emoji: '🎩' },
  { word: 'mus', emoji: '🐭' },
  { word: 'bus', emoji: '🚌' },
  { word: 'ost', emoji: '🧀' },
  { word: 'fod', emoji: '🦶' },
  { word: 'bog', emoji: '📖' },
  { word: 'and', emoji: '🦆' },
  { word: 'arm', emoji: '💪' },
  { word: 'ben', emoji: '🦵' },
  { word: 'hul', emoji: '🕳️' },
  { word: 'sø', emoji: '🏞️' },
  { word: 'ål', emoji: '🐍' },
  { word: 'øl', emoji: '🍺' },
  // More easy 2-3 letter words
  { word: 'æg', emoji: '🥚' },
  { word: 'te', emoji: '🍵' },
  { word: 'ur', emoji: '⌚' },
  { word: 'sko', emoji: '👟' },
  { word: 'haj', emoji: '🦈' },
  { word: 'abe', emoji: '🐒' },
  { word: 'ræv', emoji: '🦊' },
  { word: 'ulv', emoji: '🐺' },
  { word: 'ged', emoji: '🐐' },
  { word: 'tog', emoji: '🚂' },
  { word: 'mor', emoji: '👩' },
  { word: 'far', emoji: '👨' },
  { word: 'bær', emoji: '🍓' },
  { word: 'løg', emoji: '🧅' },
  { word: 'ski', emoji: '🎿' },
]

const DANISH_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'Y', 'Z', 'Æ', 'Ø', 'Å']

interface LetterTile {
  id: string
  letter: string
}

const SpellingGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()

  // Current word and its uppercase letters
  const [current, setCurrent] = useState<{ word: string; emoji: string } | null>(null)
  const [targetLetters, setTargetLetters] = useState<string[]>([])
  const [filledCount, setFilledCount] = useState(0)
  const [tiles, setTiles] = useState<LetterTile[]>([])
  const [usedTileIds, setUsedTileIds] = useState<Set<string>>(new Set())
  const [shakeTileId, setShakeTileId] = useState<string | null>(null)
  // Next-letter hint: after 2 wrong taps on the current slot the correct tile pulses (never-fail
  // scaffold). The wrong tap that triggered it already broke first-try, so the hint costs a star.
  const [hintTileId, setHintTileId] = useState<string | null>(null)
  const slotWrongRef = useRef(0) // wrong taps on the CURRENT slot
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'SpellingGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame) so the board is never stranded when audio isn't
  // unlocked at mount; the welcome plays at most once.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  const previousWord = useRef<string | null>(null)
  const isAdvancing = useRef(false)
  // Live current word (so it can be voiced after the welcome) + interaction guard (so a late
  // welcome never talks over active play).
  const wordRef = useRef<string | null>(null)
  const hasInteractedRef = useRef(false)

  // Centralized game state management
  const { score, incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()

  // Bounded round + reward flow (Overhaul Ordleg §2). 8 words, 3★ = no mistakes, 2★ ≤ 2.
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Celebration management (corner guide reacts via guideReaction)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Cue the corner guide, clearing the reaction a beat later so it settles + re-fires.
  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 SpellingGame: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the playable board immediately (tappable), no waiting on the welcome.
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenWord()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (guideReactionTimer.current) {
        clearTimeout(guideReactionTimer.current)
        guideReactionTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When audio unlocks after mount, play the welcome (board already visible). Interaction-guarded
  // inside playWelcomeThenWord so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenWord()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Instant load: render the playable board RIGHT AWAY without voicing the word yet — the welcome
  // narrates over the visible board and the spoken word follows it. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewWord(false)
  }

  // Play the welcome over the already-visible board, then voice the first word. Self-guards; skips
  // the trailing word if the child already started tapping.
  const playWelcomeThenWord = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('spelling')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (wordRef.current && !hasInteractedRef.current) speakWord(wordRef.current)
  }

  // Build a shuffled tile pool: the word's letters + a few distractor letters
  const buildTiles = (letters: string[]): LetterTile[] => {
    const wordLetterSet = new Set(letters)
    const distractorPool = DANISH_ALPHABET.filter(l => !wordLetterSet.has(l))
    const distractors: string[] = []
    const distractorCount = 3
    const shuffledPool = [...distractorPool].sort(() => Math.random() - 0.5)
    for (let i = 0; i < distractorCount && i < shuffledPool.length; i++) {
      distractors.push(shuffledPool[i])
    }

    const all = [...letters, ...distractors]
    return all
      .map((letter, index) => ({ id: `tile-${index}-${letter}`, letter }))
      .sort(() => Math.random() - 0.5)
  }

  // `voice=false` renders the board without voicing the word (used for the first word, which is
  // voiced after the welcome instead).
  const generateNewWord = (voice = true) => {
    isAdvancing.current = false

    // Pick a word, avoiding an immediate repeat
    let candidates = SPELLING_WORDS.filter(w => w.word !== previousWord.current)
    if (candidates.length === 0) candidates = SPELLING_WORDS
    const next = candidates[Math.floor(Math.random() * candidates.length)]
    previousWord.current = next.word
    wordRef.current = next.word

    const letters = next.word.toUpperCase().split('')

    setCurrent(next)
    setTargetLetters(letters)
    setFilledCount(0)
    setUsedTileIds(new Set())
    setShakeTileId(null)
    setTiles(buildTiles(letters))
    // Fresh word → fresh first-try flag + hint state.
    firstAttemptRef.current = true
    slotWrongRef.current = 0
    setHintTileId(null)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!voice) return

    const delay = isIOS() ? 200 : 500
    timeoutRef.current = setTimeout(() => {
      speakWord(next.word)
    }, delay)
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'ordleg.spelling',
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
    generateNewWord()
  }

  const speakWord = async (word: string) => {
    try {
      audio.updateUserInteraction()
      await audio.speak(word)
    } catch (error) {
      logError('Error speaking word', { word, error: error?.toString() })
    }
  }

  const handleTileClick = async (tile: LetterTile) => {
    if (!gameReady || !current || isAdvancing.current) return
    if (usedTileIds.has(tile.id)) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    const expectedLetter = targetLetters[filledCount]

    if (tile.letter === expectedLetter) {
      // Correct letter: place it in the next slot. The next slot starts fresh (no hint yet).
      const newFilled = filledCount + 1
      setUsedTileIds(prev => new Set(prev).add(tile.id))
      setFilledCount(newFilled)
      slotWrongRef.current = 0
      setHintTileId(null)

      try {
        await audio.speakLetter(tile.letter)
      } catch (error) {
        // ignore letter audio errors
      }

      if (newFilled === targetLetters.length) {
        // Word complete
        completeWord()
      }
    } else {
      // Wrong letter: gentle SFX + shake, leave it in the pool, break the first-try flag.
      firstAttemptRef.current = false
      sfx.play('wrong')
      setShakeTileId(tile.id)
      reactGuide('think')
      setTimeout(() => setShakeTileId(null), 450)

      // After 2 wrong taps on this slot, point at the correct tile (never-fail scaffold).
      slotWrongRef.current += 1
      if (slotWrongRef.current >= 2) {
        const hint = tiles.find(
          t => !usedTileIds.has(t.id) && t.letter === targetLetters[filledCount],
        )
        if (hint) setHintTileId(hint.id)
      }
    }
  }

  const completeWord = () => {
    if (!current || isAdvancing.current) return
    isAdvancing.current = true

    incrementScore()
    celebrateTier('micro')
    reactGuide('cheer')

    // Play the full word again, then advance to the next one (or finish the round).
    setTimeout(async () => {
      try {
        await audio.speak(current.word)
      } catch (error) {
        // ignore
      }
      setTimeout(() => {
        stopCelebration()
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
        if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
        else generateNewWord()
      }, isIOS() ? 1500 : 2000)
    }, 400)
  }

  const repeatWord = async () => {
    if (!current) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakWord(current.word)
    } catch (error) {
      console.error('🎵 SpellingGame: Error repeating word:', error)
    }
  }

  const theme = categoryThemes.ordleg
  const availableTiles = tiles.filter(t => !usedTileIds.has(t.id))

  return (
    <GameShell
      categoryId="ordleg"
      title="Stav Ordet"
      backRoute="/ordleg"
      dense
      guideReaction={guideReaction}
      score={
        <OrdlegScoreChip
          score={score}
          disabled={isScoreNarrating}
          onClick={handleScoreClick}
        />
      }
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
        {roundOutcome ? (
          <RoundResultScreen
            outcome={roundOutcome}
            categoryId="ordleg"
            backRoute="/ordleg"
            onReplay={handleReplay}
          />
        ) : gameReady && current && (
          <>
            {/* Word prompt: emoji + word + repeat */}
            <Box sx={{ textAlign: 'center', flex: '0 0 auto', mb: { xs: 1, md: 2 } }}>
              <motion.div
                key={current.word}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Typography
                  sx={{
                    fontSize: 'clamp(3rem, 14vh, 6rem)',
                    lineHeight: 1,
                    mb: 0.5
                  }}
                >
                  {current.emoji}
                </Typography>
              </motion.div>
              <Box sx={{ mt: 1 }}>
                <OrdlegRepeatButton onClick={repeatWord} disabled={false} />
              </Box>
            </Box>

            {/* Letter slots */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: { xs: 1, md: 1.5 },
                flex: '0 0 auto',
                mb: { xs: 1.5, md: 2.5 }
              }}
            >
              {targetLetters.map((letter, index) => {
                const filled = index < filledCount
                return (
                  <Box
                    key={index}
                    sx={{
                      width: { xs: 56, sm: 64, md: 80 },
                      height: { xs: 56, sm: 64, md: 80 },
                      borderRadius: 2,
                      border: '3px dashed',
                      borderColor: filled ? 'success.main' : theme.borderColor,
                      bgcolor: filled ? 'success.light' : 'rgba(255,255,255,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Typography
                      sx={{
                            fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
                        fontWeight: 700,
                        color: filled ? 'white' : 'transparent',
                        userSelect: 'none'
                      }}
                    >
                      {filled ? letter : ''}
                    </Typography>
                  </Box>
                )
              })}
            </Box>

            {/* Scrambled letter tiles — non-greedy so the prompt/slots/tiles read as one
                group (shell centres the cluster vertically). */}
            <Box
              sx={{
                flex: '0 1 auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 0,
                mt: { xs: 1, md: 2 }
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: { xs: 1.5, md: 2 },
                  maxWidth: 560
                }}
              >
                <AnimatePresence>
                  {availableTiles.map((tile) => {
                    const isHint = tile.id === hintTileId
                    const isShaking = shakeTileId === tile.id
                    // Hint: a gentle attention pulse (motion) or a static glow ring (reduced motion).
                    const animate = isShaking
                      ? { opacity: 1, scale: 1, x: [0, -10, 10, -10, 10, 0] }
                      : isHint && !reduce
                        ? { opacity: 1, scale: [1, 1.12, 1], x: 0 }
                        : { opacity: 1, scale: 1, x: 0 }
                    const transition = isShaking
                      ? { duration: 0.45 }
                      : isHint && !reduce
                        ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
                        : { duration: 0.2 }
                    return (
                    <motion.div
                      key={tile.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={animate}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={transition}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                    >
                      <Paper
                        elevation={4}
                        onClick={() => handleTileClick(tile)}
                        sx={{
                          width: { xs: 56, sm: 64, md: 76 },
                          height: { xs: 56, sm: 64, md: 76 },
                          minWidth: 44,
                          minHeight: 44,
                          borderRadius: 2,
                          border: '3px solid',
                          borderColor: isShaking
                            ? 'error.main'
                            : isHint
                              ? theme.accentColor
                              : theme.borderColor,
                          bgcolor: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          userSelect: 'none',
                          boxShadow: isHint
                            ? `0 0 0 4px ${theme.accentColor}55, ${muiTheme.scene.dark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.12)'}`
                            : muiTheme.scene.dark
                              ? '0 12px 30px rgba(0,0,0,0.45)'
                              : '0 6px 18px rgba(0,0,0,0.12)',
                          '@media (hover: hover) and (pointer: fine)': {
                            '&:hover': {
                              borderColor: theme.hoverBorderColor,
                              boxShadow: 8
                            }
                          }
                        }}
                      >
                        <Typography
                          sx={{
                                    fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
                            fontWeight: 700,
                            color: theme.accentColor
                          }}
                        >
                          {tile.letter}
                        </Typography>
                      </Paper>
                    </motion.div>
                    )
                  })}
                </AnimatePresence>
              </Box>
            </Box>
          </>
        )}
    </GameShell>
  )
}

export default SpellingGame
