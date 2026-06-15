import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Typography, Box } from '@mui/material'
import { isIOS } from '../../utils/deviceDetection'
import { CategoryTheme } from '../../config/categoryThemes'
import GameShell from './GameShell'
import AnswerTile, { type AnswerTileState } from './AnswerTile'
import type { GuideReaction } from './ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { useGameState } from '../../hooks/useGameState'
import { useRound, type RoundConfig } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import RoundResultScreen from './RoundResultScreen'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 UnifiedQuizGame: ${message}`, data)
  }
}

// Quiz item interface for flexible content
export interface QuizItem {
  value: string | number      // The actual value (letter, number, or expression)
  display: string | number    // What to show on screen
  audioPrompt: string         // The full prompt text
  repeatWord: string          // Word to repeat in prompt
  // Optional visual question shown in the prompt area (e.g. word-association mode:
  // show an emoji + word and ask which letter it starts with). When present, the
  // quiz renders this above the answer grid instead of relying on audio alone.
  questionVisual?: { emoji: string; word?: string }
}

// Configuration interface for the unified quiz
export interface UnifiedQuizConfig {
  // Quiz identification
  quizType: 'alphabet' | 'counting' | 'arithmetic' | 'english' | 'ordleg'
  
  // Content generation
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem) => QuizItem[]
  
  // Display configuration
  title: string                // "Bogstav Quiz" or "Tal Quiz"
  emoji: string               // "🎯" or "🧮"
  teacherCharacter: 'owl' | 'fox'
  theme: CategoryTheme
  backRoute: string
  
  // Component configuration
  ScoreChipComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  // Hide the "Gentag" repeat button (e.g. Læs Ordet, where the word must not be read aloud).
  showRepeat?: boolean        // default true

  // Audio configuration
  gameWelcomeType: string     // 'alphabet' or 'math'
  
  // Audio methods (flexible to handle different prompt types)
  speakQuizPrompt: (item: QuizItem, audio: any) => Promise<string>
  speakClickedItem: (item: QuizItem, audio: any) => Promise<string>
  getRepeatAudio: (item: QuizItem, audio: any) => Promise<string>

  // Bounded-round mode (Overhaul Foundation §3). OPTIONAL — absent → today's endless behavior.
  // When set, the quiz runs `round.length` questions then shows RoundResultScreen and records the
  // result to the progress store (stars/bests/stickers). Requires `gameId`.
  round?: RoundConfig
  gameId?: string             // stable id for progress, e.g. 'alphabet.quiz'
}

interface UnifiedQuizGameProps {
  config: UnifiedQuizConfig
}

const UnifiedQuizGame: React.FC<UnifiedQuizGameProps> = ({ config }) => {
  const [currentItem, setCurrentItem] = useState<QuizItem | null>(null)
  const [showOptions, setShowOptions] = useState<QuizItem[]>([])
  // Feedback for the most-recently tapped answer (drives the AnswerTile correct/wrong state)
  // and the bottom-corner guide reaction. Cleared on each new question.
  const [feedback, setFeedback] = useState<{ value: string | number; correct: boolean } | null>(null)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)

  // Component initialization - no logging needed in production

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: `UnifiedQuizGame-${config.quizType}`,
    autoInitialize: false
  })

  // Centralized game state management
  const { score, incrementScore, resetScore, handleScoreClick } = useGameState()

  // Celebration management (rendered by GameShell)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Bounded round (no-op when config.round is absent → endless behavior preserved).
  const round = useRound(config.round)
  // True until the first wrong tile is tapped for the current question; gates the streak/star
  // "first try" accounting. Reset on each new question.
  const firstAttemptRef = useRef(true)
  // When set, the round is over and the reward/result hero replaces the answer grid.
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Timeout ref for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Clears the guide reaction a beat after an answer so the mascot returns to idle and the
  // next (possibly identical) reaction re-fires.
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)

  const [gameReady, setGameReady] = useState(false)
  const hasInitialized = useRef(false)
  // Guards the actual start (welcome + first question) so it runs exactly once regardless of
  // which path triggers it (audio-ready-at-mount, audio-unlocked-later, or the resilience
  // fallback below).
  const startedRef = useRef(false)
  // Guards the welcome audio so it plays at most once even if audio unlocks after mount.
  const welcomeTriggered = useRef(false)
  
  // Generate new question using config
  const generateNewQuestion = useCallback(() => {
    // Clear the previous answer's feedback + guide reaction before the new question appears.
    setFeedback(null)
    setGuideReaction(null)
    // New question → first attempt is fresh again (round streak/star accounting).
    firstAttemptRef.current = true

    // Generate quiz item using config
    const quizItem = config.generateQuizItem()
    
    // Generated new item
    
    setCurrentItem(quizItem)
    
    // Generate options using config
    const options = config.generateOptions(quizItem)
    
    // Generated quiz options
    
    setShowOptions(options)
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Shorter delay for quiz prompt since welcome audio has already completed with buffer
    const delay = isIOS() ? 200 : 300  // Even shorter delay for better user experience
    
    // Schedule delayed audio
    timeoutRef.current = setTimeout(async () => {
      try {
        // Update user interaction timestamp before playing (iOS fix)
        audio.updateUserInteraction()
        await config.speakQuizPrompt(quizItem, audio)
      } catch (error) {
        logError('Error playing quiz prompt', { 
          item: quizItem,
          error: error?.toString()
        })
      } finally {
        if (timeoutRef.current) {
          timeoutRef.current = null
        }
      }
    }, delay)
    
  }, [audio, config]) // Stable dependencies
  
  // Reveal the playable cards (first question). Idempotent — safe to call from any start path.
  const beginGame = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewQuestion()
  }, [generateNewQuestion])

  // Play welcome message then reveal the cards. Self-guards (ref) so the welcome plays at most
  // once even if audio readiness flips more than once.
  const playWelcomeAndStart = useCallback(async () => {
    if (welcomeTriggered.current) return
    welcomeTriggered.current = true
    try {
      // Play the welcome message and wait for it to complete
      await audio.playGameWelcome(config.gameWelcomeType)

      // Additional delay after welcome audio completes to ensure clean transition
      const additionalDelay = isIOS() ? 1500 : 2000  // Even longer delay for cleaner audio experience
      setTimeout(() => beginGame(), additionalDelay)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
      // Still start the game even if audio fails
      beginGame()
    }
  }, [audio, config.gameWelcomeType, beginGame])

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Play the welcome immediately if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeAndStart()
    }

    // Resilience: browsers block the AudioContext until a user gesture, so isAudioReady may
    // never flip on a fresh/deep-linked load. Reveal the playable cards after a short delay so
    // the child is never stranded on an empty screen; the welcome line still plays if/when
    // audio unlocks (beginGame + playWelcomeAndStart are ref-guarded, so this never
    // double-starts).
    const fallback = setTimeout(() => beginGame(), 2500)

    return () => {
      clearTimeout(fallback)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (guideReactionTimer.current) {
        clearTimeout(guideReactionTimer.current)
        guideReactionTimer.current = null
      }
    }
  }, [audio.isAudioReady, playWelcomeAndStart, beginGame])

  // When audio unlocks after mount, play the welcome (unless it/the game already started).
  // Ref-guarded so the effect performs no setState.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current && !startedRef.current) {
      playWelcomeAndStart()
    }
  }, [audio.isAudioReady, playWelcomeAndStart])

  const handleItemClick = async (selectedItem: QuizItem) => {
    // Only prevent clicks if game isn't ready
    if (!gameReady || !currentItem) {
      return
    }
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    // FIRST: Play the clicked item immediately for fast feedback
    try {
      await config.speakClickedItem(selectedItem, audio)
    } catch {
      // best-effort: tile audio is non-critical, so ignore playback errors here
    }

    const isCorrect = selectedItem.value === currentItem.value

    // Mark the tapped tile (glow+sparkle / shake) and cue the corner guide (cheer / think),
    // clearing the reaction a beat later so the guide settles back to idle.
    setFeedback({ value: selectedItem.value, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // IMMEDIATELY: Start visual celebration effects if correct
    if (isCorrect) {
      incrementScore()
      celebrateTier('micro') // light per-answer sparkle + soft "correct" SFX
    } else {
      // Wrong answers don't advance/punish (current "retry until right" feel preserved); they
      // only break this question's first-try flag (round streak/star accounting) + a gentle SFX.
      firstAttemptRef.current = false
      sfx.play('wrong')
    }

    // THEN: Play celebration audio after a very short delay
    setTimeout(async () => {
      try {
        // Just play the audio feedback, visuals already started
        await audio.announceGameResult(isCorrect)

        // Auto-advance to next question after celebration
        setTimeout(() => {
          if (!isCorrect) return
          stopCelebration() // Stop celebration after 2 seconds

          if (!round.enabled) {
            generateNewQuestion()
            return
          }

          // Bounded round: record the completed question, fire streak milestones, end or advance.
          const r = round.completeQuestion(firstAttemptRef.current)
          if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
            celebrateTier('streak')
          }
          if (r.done) {
            finishRound(r.firstTryCorrect, r.longestStreak)
          } else {
            generateNewQuestion()
          }
        }, isIOS() ? 1500 : 2000) // 2 second celebration duration

      } catch (error) {
        logError('Error in game result audio', {
          selectedItem: selectedItem.display,
          currentItem: currentItem.display,
          isCorrect,
          error: error?.toString()
        })
      }
    }, 150) // Very short delay between item audio and celebration audio
  }

  const repeatItem = async () => {
    if (!currentItem) return
    
    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()
    
    try {
      await config.getRepeatAudio(currentItem, audio)
    } catch (error) {
      console.error('🎵 UnifiedQuizGame: Error repeating item:', error)
    }
  }

  // Round ended → record to the progress store (stars/bests/stickers) and show the result hero.
  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const gameId = config.gameId ?? `quiz.${config.quizType}`
    const outcome = progressStore.recordRoundResult(
      gameId,
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: config.round?.starThresholds, stickerSetId: config.round?.stickerSetId },
    )
    setRoundOutcome(outcome)
  }

  // "Spil igen" → reset round + score and start a fresh round.
  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
    generateNewQuestion()
  }

  const ScoreChip = config.ScoreChipComponent
  const RepeatButton = config.RepeatButtonComponent

  // Per-tile feedback state for the most-recently tapped answer.
  const tileStateFor = (item: QuizItem): AnswerTileState =>
    feedback && feedback.value === item.value ? (feedback.correct ? 'correct' : 'wrong') : 'idle'

  // Until the welcome gate opens (or the resilience fallback fires) the board shows shimmer
  // placeholders instead of an empty grid, so it never looks broken while audio warms up.
  const showPlaceholders = !gameReady || showOptions.length === 0

  return (
    <GameShell
      categoryId={config.theme.id}
      title={config.title}
      backRoute={config.backRoute}
      guideReaction={guideReaction}
      score={
        <ScoreChip
          score={score}
          disabled={false}
          onClick={handleScoreClick}
        />
      }
      celebration={{
        show: showCelebration,
        intensity: celebrationIntensity,
        duration: celebrationDuration,
        onComplete: stopCelebration,
      }}
    >
        {roundOutcome ? (
          <RoundResultScreen
            outcome={roundOutcome}
            categoryId={config.theme.id}
            backRoute={config.backRoute}
            onReplay={handleReplay}
          />
        ) : (
        <>
        {/* Visual Question - shown for word-association style rounds */}
        {currentItem?.questionVisual && (
          <Box sx={{ textAlign: 'center', mb: { xs: 1.5, md: 2 }, flex: '0 0 auto' }}>
            <motion.div
              key={`${currentItem.value}-${currentItem.questionVisual.word}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              {currentItem.questionVisual.emoji && (
                <Typography
                  sx={{
                    fontSize: 'clamp(3rem, 12vw, 5rem)',
                    lineHeight: 1,
                    mb: 0.5,
                    '@media (orientation: landscape)': {
                      fontSize: 'clamp(2.5rem, 8vh, 4rem)'
                    }
                  }}
                >
                  {currentItem.questionVisual.emoji}
                </Typography>
              )}
              {currentItem.questionVisual.word && (
                <Typography
                  sx={{
                    fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
                    fontWeight: 700,
                    color: config.theme.accentColor,
                    userSelect: 'none'
                  }}
                >
                  {currentItem.questionVisual.word}
                </Typography>
              )}
            </motion.div>
          </Box>
        )}

        {/* Audio Control - Compact (hidden for games that must not read the answer aloud) */}
        {config.showRepeat !== false && (
          <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 3 }, flex: '0 0 auto' }}>
            <RepeatButton
              onClick={repeatItem}
              disabled={false}
            />
          </Box>
        )}

        {/* Answer Options Grid — non-greedy so it groups directly under the prompt
            (GameShell centres the prompt+answers cluster vertically). */}
        <Box sx={{
          flex: '0 1 auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 0
        }}>
          <Box
            sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridAutoRows: 'auto',
              gap: { xs: '16px', sm: '20px', md: '24px' },
              width: '100%',
              maxWidth: { xs: '400px', sm: '500px', md: '600px' },
              justifyContent: 'center',
              alignItems: 'center',
              // Individual card aspect ratio and constraints
              '& > *': {
                aspectRatio: '4/3',
                minHeight: { xs: '80px', sm: '90px', md: '100px' },
                maxHeight: { xs: '120px', sm: '140px', md: '160px' },
                width: '100%'
              },
              // Orientation specific adjustments
              '@media (orientation: landscape)': {
                gridTemplateColumns: 'repeat(4, 1fr)',
                maxWidth: { xs: '600px', sm: '700px', md: '800px' },
                '& > *': {
                  aspectRatio: '4/3',
                  minHeight: { xs: '60px', sm: '70px', md: '80px' },
                  maxHeight: { xs: '100px', sm: '110px', md: '120px' }
                }
              }
            }}
          >
          {showPlaceholders
            ? // Loading shimmer (welcome gate pending) — same footprint as the real tiles.
              [0, 1, 2, 3].map((i) => (
                <Box
                  key={`placeholder-${i}`}
                  aria-hidden
                  sx={{
                    height: '100%',
                    borderRadius: '18px',
                    border: '3px solid',
                    borderColor: 'rgba(255,255,255,0.5)',
                    background:
                      'linear-gradient(100deg, rgba(255,255,255,0.55) 30%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.55) 70%)',
                    backgroundSize: '200% 100%',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                    '@media (prefers-reduced-motion: no-preference)': {
                      animation: 'answerTileShimmer 1.4s ease-in-out infinite',
                    },
                    '@keyframes answerTileShimmer': {
                      '0%': { backgroundPosition: '160% 0' },
                      '100%': { backgroundPosition: '-60% 0' },
                    },
                  }}
                />
              ))
            : showOptions.map((item, index) => (
                <motion.div
                  key={`${item.value}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.08 }}
                  style={{ height: '100%' }}
                >
                  <AnswerTile
                    onClick={() => handleItemClick(item)}
                    accent={config.theme.accentColor}
                    state={tileStateFor(item)}
                  >
                    <Typography
                      variant="h1"
                      component="span"
                      sx={{
                        // Words (multi-character strings) render smaller so they fit the tile;
                        // single glyphs (letters/numbers/emoji) stay large.
                        fontSize: (typeof item.display === 'string' && item.display.length > 2)
                          ? 'clamp(1.1rem, 4.5vw, 2rem)'
                          : 'clamp(2.5rem, 8vw, 4.5rem)',
                        fontWeight: 700,
                        color: config.theme.accentColor,
                        userSelect: 'none',
                        lineHeight: 1.1,
                        textAlign: 'center',
                        px: 1,
                        // Adjust font size in landscape
                        '@media (orientation: landscape)': {
                          fontSize: (typeof item.display === 'string' && item.display.length > 2)
                            ? 'clamp(1rem, 3.5vw, 1.75rem)'
                            : 'clamp(2rem, 6vw, 3.5rem)'
                        }
                      }}
                    >
                      {item.display}
                    </Typography>
                  </AnswerTile>
                </motion.div>
              ))}
          </Box>
        </Box>
        </>
        )}
    </GameShell>
  )
}

export default UnifiedQuizGame