import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Typography, Box } from '@mui/material'
import { isIOS } from '../../utils/deviceDetection'
import { CategoryTheme } from '../../config/categoryThemes'
import GameShell from './GameShell'
import AnswerTile, { type AnswerTileState } from './AnswerTile'
import PromptStage, { HeroEmoji } from './PromptStage'
import type { GuideReaction } from './ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { useGameState } from '../../hooks/useGameState'
import { useRound, type RoundConfig } from '../../hooks/useRound'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { progressStore, type RoundOutcome, type SectionId } from '../../services/progressStore'
import { useDifficulty } from '../../hooks/useDifficulty'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DWELL_CORRECT } from '../../theme/motion'
import { devFx } from '../../utils/devHarness'
import RoundResultScreen from './RoundResultScreen'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 UnifiedQuizGame: ${message}`, data)
  }
}

// Decide whether an answer-tile label is a multi-letter WORD (render small) or a single
// glyph — a letter, a number, or an emoji (render large). The old `.length > 2` test mis-sized
// multi-codepoint emoji: keycap digits (1️⃣, length 3), variation-selector emoji (🛏️/👁️/🌧️) and
// ZWJ sequences (👨‍👩‍👧) are ONE grapheme but several code units, so they shrank to word size.
// Numbers ("10", "100") stay large; any string containing a pictograph stays large; otherwise a
// label is a "word" only if it spans more than one grapheme cluster.
const isWordLabel = (display: string | number): boolean => {
  if (typeof display !== 'string') return false
  const s = display.trim()
  if (s === '' || /^\d+$/.test(s)) return false               // numbers → large
  if (/\p{Extended_Pictographic}/u.test(s)) return false      // most emoji → large
  // Keycap sequences (1️⃣…9️⃣) have no pictographic codepoint but ARE one grapheme cluster; count
  // grapheme clusters so they stay large. Segmenter isn't in our TS lib target — access via cast.
  const Segmenter = (Intl as unknown as { Segmenter?: any }).Segmenter
  if (typeof Segmenter === 'function') {
    return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length > 1
  }
  // Fallback (no Intl.Segmenter): drop variation selectors, ZWJ and the enclosing-keycap mark so
  // multi-codepoint emoji collapse to one char, then treat >1 remaining as a word.
  const combining = new Set([0xFE0E, 0xFE0F, 0x200D, 0x20E3])
  return [...s].filter((ch) => !combining.has(ch.codePointAt(0)!)).length > 1
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

  // Optional: on a CORRECT answer, speak the completed fact (e.g. Hvad Mangler's finished sequence)
  // INSTEAD OF echoing the tapped item (single audio channel — replaces, never stacks). Receives
  // the current (correct) QuizItem. When absent, a correct tap echoes speakClickedItem as before.
  speakCorrectFact?: (item: QuizItem, audio: any) => Promise<string>

  // Never-fail hint (PRD-05 P1). After this many wrong taps on the current question, the correct
  // tile pulses/glows (AnswerTile `hint`) so the child is never stuck — matching the hand-rolled
  // color/spelling games. The 2 wrongs already broke first-try, so it needs no extra star
  // bookkeeping. Omit (or 0) to disable. Enabled (2) for every config quiz.
  hintAfterNWrong?: number

  // Bounded-round mode (Overhaul Foundation §3). OPTIONAL — absent → today's endless behavior.
  // When set, the quiz runs `round.length` questions then shows RoundResultScreen and records the
  // result to the progress store (stars/bests/stickers). Requires `gameId`.
  round?: RoundConfig
  gameId?: string             // stable id for progress, e.g. 'alphabet.quiz'

  // Optional custom PromptStage hero (UI/UX Overhaul §6A). When provided, the quiz renders this in
  // the PromptStage instead of the default (questionVisual emoji/word, English "listen" card, or the
  // item glyph). Use for richer subjects — e.g. Tal Quiz's numeral + counted objects, or Hvad
  // Mangler's sequence with a pulsing "?". Receives the live QuizItem.
  renderHero?: (item: QuizItem) => React.ReactNode

  // When the welcome message already conveys the first question's prompt (e.g. Hvad Mangler?, whose
  // welcome "Hvad mangler" equals its per-question prompt "Hvad mangler?"), set this so the engine
  // does NOT voice the first prompt right after the welcome — avoiding hearing it twice on entry.
  // Subsequent questions still voice their prompt normally on advance.
  skipFirstPrompt?: boolean
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
  const reduce = useReducedMotion()
  // Live difficulty for this section — re-renders + regenerates on an adult-menu change (no refresh).
  const difficultyLevel = useDifficulty(config.theme.id as SectionId)

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

  // Bounded round (no-op when config.round is absent → endless behavior preserved). Thread the
  // stable gameId in so useRound grants live per-task XP (Liveliness PRD-04) on each question.
  const round = useRound(
    config.round ? { ...config.round, gameId: config.gameId ?? `quiz.${config.quizType}` } : undefined,
  )
  // True until the first wrong tile is tapped for the current question; gates the streak/star
  // "first try" accounting. Reset on each new question.
  const firstAttemptRef = useRef(true)
  // Never-fail hint (PRD-05 P1): after `hintAfterNWrong` wrong taps on the current question the
  // correct tile pulses. Shared primitive; `Infinity` threshold disables it when the config omits
  // `hintAfterNWrong`. `showHint` is the boolean the render reads; reset per question.
  const { hint: showHint, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<boolean>(config.hintAfterNWrong ?? Infinity)
  // When set, the round is over and the reward/result hero replaces the answer grid.
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Timeout ref for cleanup (per-question prompt timer)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // The post-correct celebration/advance timer (PRD-02 P1/P4). Tracked so it's cleared on unmount
  // (no ghost prompt on the next screen) and never runs twice.
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Advance-lock (PRD-02 P1/P2): true from the moment a correct tap is registered until the next
  // question starts. Set synchronously (before any await) so a rapid second tap — the classic 5yo
  // double-tap — can't run the correct path twice (double round-record) and a tap during the
  // celebration dwell can't poison the earned first-try. A ref (not state) so it's readable
  // synchronously within the same event-loop tick.
  const isAdvancingRef = useRef(false)
  // Clears the guide reaction a beat after an answer so the mascot returns to idle and the
  // next (possibly identical) reaction re-fires.
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)
  // False after unmount (PRD-02 P4). The advance timer is scheduled only AFTER the `await
  // speakClickedItem` echo — so if the child navigates away DURING that echo, unmount has already
  // run (nothing to clear yet) and the post-await continuation would still schedule a timer that
  // speaks the next prompt over the menu. This flag lets that continuation bail. Owned by its own
  // effect so StrictMode's dev remount restores it to true.
  const mountedRef = useRef(true)

  const [gameReady, setGameReady] = useState(false)
  const hasInitialized = useRef(false)
  // Guards the actual start (welcome + first question) so it runs exactly once regardless of
  // which path triggers it (audio-ready-at-mount, audio-unlocked-later, or the resilience
  // fallback below).
  const startedRef = useRef(false)
  // Guards the welcome audio so it plays at most once even if audio unlocks after mount.
  const welcomeTriggered = useRef(false)
  
  // Tracks the live current item so its prompt can be voiced after the welcome finishes (the board
  // is generated before the welcome plays, so currentItem state isn't readable synchronously yet).
  const currentItemRef = useRef<QuizItem | null>(null)
  // Bumps each question so option React keys never collide across questions. Without it, a value
  // that lands at the same index in two consecutive questions reuses the same motion.div and skips
  // its enter animation (and would "float" if a layout animation were ever added). Mirrors
  // SpellingGame's wordSeq.
  const questionSeq = useRef(0)
  // True once the child taps — suppresses a (possibly late) welcome from talking over their play.
  const hasInteractedRef = useRef(false)

  // Generate a new question. `speakPrompt=false` renders the board WITHOUT voicing the prompt —
  // used for the very first question, which is instead voiced right after the welcome.
  const generateNewQuestion = useCallback((speakPrompt = true) => {
    // Clear the previous answer's feedback + guide reaction before the new question appears.
    setFeedback(null)
    setGuideReaction(null)
    // New question → first attempt is fresh again (round streak/star accounting) and the
    // advance-lock releases so tiles are tappable again. Reset the hint too.
    firstAttemptRef.current = true
    isAdvancingRef.current = false
    resetHint()

    const quizItem = config.generateQuizItem()
    currentItemRef.current = quizItem
    setCurrentItem(quizItem)
    questionSeq.current += 1 // fresh key namespace for this question's option tiles
    setShowOptions(config.generateOptions(quizItem))

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!speakPrompt) return

    // Shorter delay for quiz prompt since welcome audio has already completed with buffer
    const delay = isIOS() ? 200 : 300
    timeoutRef.current = setTimeout(async () => {
      try {
        // Update user interaction timestamp before playing (iOS fix)
        audio.updateUserInteraction()
        await config.speakQuizPrompt(quizItem, audio)
      } catch (error) {
        logError('Error playing quiz prompt', { item: quizItem, error: error?.toString() })
      } finally {
        if (timeoutRef.current) {
          timeoutRef.current = null
        }
      }
    }, delay)
  }, [audio, config, resetHint]) // Stable dependencies (resetHint identity is stable)

  // Instant load: render the playable board RIGHT AWAY (tappable immediately) without voicing the
  // first prompt yet — the welcome narrates over the visible board and the prompt follows it.
  // Idempotent — safe to call from any start path.
  const revealBoard = useCallback(() => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewQuestion(false)
  }, [generateNewQuestion])

  // Voice the current question's prompt (used once the welcome has finished). Skipped if the child
  // already started tapping.
  const speakCurrentPrompt = useCallback(async () => {
    const item = currentItemRef.current
    if (!item || hasInteractedRef.current) return
    try {
      audio.updateUserInteraction()
      await config.speakQuizPrompt(item, audio)
    } catch (error) {
      logError('Error playing quiz prompt', { error: error?.toString() })
    }
  }, [audio, config])

  // Play the welcome over the already-visible board, then voice the first prompt. Self-guards so it
  // runs at most once; skips the trailing prompt if the child already started tapping.
  const playWelcomeThenPrompt = useCallback(async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome(config.gameWelcomeType)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    // Skip the first prompt when the welcome already said it (e.g. Hvad Mangler?) — otherwise the
    // child hears the same line twice on entry.
    if (!config.skipFirstPrompt) speakCurrentPrompt()
  }, [audio, config.gameWelcomeType, config.skipFirstPrompt, speakCurrentPrompt])

  useEffect(() => {
    // Prevent duplicate initialization with race condition guard
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the playable board immediately (no waiting on the welcome).
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenPrompt()
    }
    // NOTE: no cleanup here on purpose (PRD-02 P4). This effect's deps change (audio.isAudioReady),
    // so a cleanup returned here would run mid-life and could clear a legitimately-pending prompt
    // timer; and after the `hasInitialized` early-return it wouldn't register a cleanup at all,
    // leaving timers alive on unmount. Teardown lives in the dedicated empty-dep effect below.
  }, [audio.isAudioReady, playWelcomeThenPrompt, revealBoard])

  // Dedicated unmount teardown (PRD-02 P4): clear every pending timer so no prompt/advance callback
  // fires after the component is gone (which would start audio over the next screen). Empty deps →
  // runs exactly once, on unmount.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    }
  }, [])

  // Owns the mounted flag (PRD-02 P4, StrictMode-safe): the dev mount→cleanup→remount cycle leaves
  // it TRUE. Declared after the teardown effect so it re-sets true last on a remount.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // When audio unlocks after mount, play the welcome (board is already visible). Ref-guarded +
  // interaction-guarded inside playWelcomeThenPrompt so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenPrompt()
    }
  }, [audio.isAudioReady, playWelcomeThenPrompt])

  // DEV screenshot harness (?fx=): the forced tile feedback is DERIVED in `tileStateFor` (no
  // setState) so it's persistent and capturable; here we only nudge the mascot (a plain emit, not
  // state). No-op in production.
  const forcedFx = devFx()
  useEffect(() => {
    if (!forcedFx || showOptions.length === 0) return
    mascotBus.emit(forcedFx === 'correct' ? 'correct' : forcedFx === 'wrong' ? 'wrong' : forcedFx)
  }, [forcedFx, showOptions.length])

  // Live difficulty: when the adult changes the level mid-game, regenerate the current question at
  // the new level right away (the config's generators read difficultyFor live). Skips the result
  // screen + the initial mount (only reacts to a real change).
  const prevDifficulty = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficulty.current === difficultyLevel) return
    prevDifficulty.current = difficultyLevel
    if (!gameReady || roundOutcome) return
    generateNewQuestion()
  }, [difficultyLevel, gameReady, roundOutcome, generateNewQuestion])

  const handleItemClick = async (selectedItem: QuizItem) => {
    // Only prevent clicks if game isn't ready
    if (!gameReady || !currentItem) {
      return
    }
    // Advance-lock (PRD-02 P1/P2): once a correct answer is resolving, ignore every further tap —
    // both a double-tap on the correct tile (would double-record the round) and a tap on a wrong
    // tile during the celebration dwell (would poison the already-earned first-try).
    if (isAdvancingRef.current) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    // Critical iOS fix: Update user interaction timestamp BEFORE audio call
    audio.updateUserInteraction()
    
    // Always cancel current audio for fast tapping
    audio.cancelCurrentAudio()

    // Every tap is felt: a soft tick synced to the press (separate SFX channel, never TTS).
    sfx.play('tap')

    const isCorrect = selectedItem.value === currentItem.value

    // Engage the advance-lock SYNCHRONOUSLY on a correct tap — before the `await` below — so a
    // second tap fired in the same tick is already blocked by the guard above (PRD-02 P1/P2).
    if (isCorrect) isAdvancingRef.current = true

    // INSTANT visual feedback: mark the tapped tile (correct/wrong border + glow/sparkle/shake)
    // and cue the corner guide BEFORE any audio await, so the red/green feedback never waits on
    // the spoken number/letter. (Audio timing below is unchanged.)
    setFeedback({ value: selectedItem.value, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // On a correct tap, speak the completed FACT if the config supplies one (e.g. Hvad Mangler's
    // finished sequence) — INSTEAD of echoing the tapped item (single audio channel, no stacking).
    // Otherwise echo the tapped item (identification — e.g. the letter/number/word). The win/lose
    // narration (announceGameResult "correct/try-again") stays removed; success/fail is otherwise
    // SFX + visuals only.
    try {
      if (isCorrect && config.speakCorrectFact) {
        await config.speakCorrectFact(currentItem, audio)
      } else {
        await config.speakClickedItem(selectedItem, audio)
      }
    } catch {
      // best-effort: tile audio is non-critical, so ignore playback errors here
    }

    // Navigated away during the echo → don't score/celebrate/schedule the advance (PRD-02 P4). The
    // advance timer is scheduled below, AFTER this await, so this guard is what stops a ghost prompt
    // speaking over the next screen (unmount ran before the timer existed, so there was nothing to
    // clear).
    if (!mountedRef.current) return

    if (isCorrect) {
      incrementScore()
      celebrateTier('micro') // light per-answer sparkle + soft "correct" SFX
    } else {
      // Wrong answers don't advance/punish (current "retry until right" feel preserved); they
      // only break this question's first-try flag (round streak/star accounting) + a gentle SFX.
      firstAttemptRef.current = false
      sfx.play('wrong')
      // Never-fail hint (PRD-05 P1): after N wrong taps on this question, pulse the correct tile.
      // (Only fires on the wrong branch, so the advance-lock — which gates the correct/resolve
      // window at the top of this handler — can never let it run mid-resolve.)
      if (registerHintWrong()) mascotBus.emit('hint')
    }

    // Auto-advance after a short celebration window (correct only; wrong stays for retry).
    if (isCorrect) {
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        stopCelebration()

        if (!round.enabled) {
          generateNewQuestion()
          return
        }

        // Bounded round: record the completed question, fire streak milestones, end or advance.
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
          // Streak chime pitch ascends with the streak length.
          celebrateTier('streak', { sfxRate: 1 + Math.min(r.streak, 12) * 0.06 })
          mascotBus.emit('streak')
        }
        if (r.done) {
          mascotBus.emit('round')
          finishRound(r.firstTryCorrect, r.longestStreak)
        } else {
          generateNewQuestion()
        }
      }, DWELL_CORRECT()) // unified celebration/advance dwell
    }
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

  // Per-tile feedback state for the most-recently tapped answer. In DEV, ?fx=correct|wrong forces
  // the first tile so the state is deterministically capturable.
  const tileStateFor = (item: QuizItem, index: number): AnswerTileState => {
    if (index === 0 && (forcedFx === 'correct' || forcedFx === 'wrong')) return forcedFx
    return feedback && feedback.value === item.value ? (feedback.correct ? 'correct' : 'wrong') : 'idle'
  }

  // Never-fail hint (PRD-05 P1): the correct tile pulses once the wrong-tap threshold is crossed.
  // In DEV, ?fx=hint forces the hint on the correct tile so it's deterministically capturable.
  const tileHintFor = (item: QuizItem): boolean => {
    if (!currentItem || item.value !== currentItem.value) return false
    return showHint || forcedFx === 'hint'
  }

  // Until the welcome gate opens (or the resilience fallback fires) the board shows shimmer
  // placeholders instead of an empty grid, so it never looks broken while audio warms up.
  const showPlaceholders = !gameReady || showOptions.length === 0

  const gameId = config.gameId ?? `quiz.${config.quizType}`
  const bestStars = progressStore.getGame(gameId).bestStars

  // Hero subject for the PromptStage (§6A). Uses the config's questionVisual when present; audio-
  // only English (Lyt og Find) shows a neutral "listen" card so it never reveals the answer;
  // everything else falls back to the item's own glyph (e.g. Tal Quiz numeral) so the stage is
  // never empty.
  const renderHero = () => {
    const item = currentItem
    if (!item) return null
    // Config-supplied custom hero takes precedence (Tal counted objects, Hvad Mangler sequence…).
    if (config.renderHero) return config.renderHero(item)
    const qv = item.questionVisual
    if (qv && (qv.emoji || qv.word)) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
          {qv.emoji && <HeroEmoji>{qv.emoji}</HeroEmoji>}
          {qv.word && (
            <Typography
              sx={{
                fontWeight: 800,
                color: config.theme.accentColor,
                lineHeight: 1,
                userSelect: 'none',
                letterSpacing: qv.emoji ? 'normal' : '0.06em',
                textTransform: qv.emoji ? 'none' : 'uppercase',
                fontSize: qv.emoji ? 'clamp(1.4rem, 5vw, 2.4rem)' : 'clamp(2.4rem, 10vw, 4.5rem)',
                [PHONE_LANDSCAPE]: { fontSize: qv.emoji ? '1.2rem' : '2rem' },
              }}
            >
              {qv.word}
            </Typography>
          )}
        </Box>
      )
    }
    if (config.quizType === 'english') {
      // Listening task: an "equalizer" wonder card — a subject without revealing the picture.
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <HeroEmoji>🔊</HeroEmoji>
          <Box aria-hidden sx={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: 24 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Box
                key={i}
                component={motion.div}
                animate={reduce ? undefined : { scaleY: [0.4, 1, 0.5, 0.9, 0.4] }}
                transition={reduce ? undefined : { duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                sx={{ width: 6, height: 24, transformOrigin: 'bottom', borderRadius: 3, bgcolor: config.theme.accentColor }}
              />
            ))}
          </Box>
        </Box>
      )
    }
    return <HeroEmoji>{item.display}</HeroEmoji>
  }

  return (
    <GameShell
      categoryId={config.theme.id}
      title={config.title}
      backRoute={config.backRoute}
      guideReaction={guideReaction}
      score={
        <ScoreChip
          answered={round.enabled ? round.state.index : score}
          total={round.enabled ? round.length : 0}
          record={bestStars}
          value={score}
          disabled={false}
          onClick={handleScoreClick}
        />
      }
      promptStage={
        roundOutcome ? undefined : (
          <PromptStage
            accent={config.theme.accentColor}
            chargeKey={`${currentItem?.value ?? ''}-${round.state.index}`}
            repeat={
              config.showRepeat !== false && !showPlaceholders ? (
                <RepeatButton onClick={repeatItem} disabled={false} />
              ) : undefined
            }
          >
            {!showPlaceholders && renderHero()}
          </PromptStage>
        )
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
        {/* Answer Options Grid — fills the answer zone beneath the PromptStage. */}
        <Box sx={{
          flex: 1,
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
              },
              // Phone landscape: aspect-driven tiles (150px wide → 112px tall) blew the
              // ≤480px height budget — fix the tile height instead of the aspect.
              [PHONE_LANDSCAPE]: {
                gap: '10px',
                maxWidth: '680px',
                '& > *': { aspectRatio: 'auto', height: '84px', minHeight: '84px', maxHeight: '84px' }
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
                  key={`q${questionSeq.current}-${item.value}-${index}`}
                  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                  animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.8, 1.04, 1] }}
                  transition={reduce ? { duration: 0 } : { delay: index * 0.08, duration: 0.25, ease: 'easeOut' }}
                  style={{ height: '100%' }}
                >
                  <AnswerTile
                    onClick={() => handleItemClick(item)}
                    accent={config.theme.accentColor}
                    state={tileStateFor(item, index)}
                    hint={tileHintFor(item)}
                    // Once a correct answer is resolving, tiles visibly stop responding (PRD-02).
                    // setFeedback re-renders on the same correct tap, so this reads the just-set ref.
                    disabled={isAdvancingRef.current}
                  >
                    <Typography
                      variant="h1"
                      component="span"
                      sx={{
                        // Words (multi-character strings) render smaller so they fit the tile;
                        // single glyphs (letters/numbers/emoji) stay large.
                        fontSize: isWordLabel(item.display)
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
                          fontSize: isWordLabel(item.display)
                            ? 'clamp(1rem, 3.5vw, 1.75rem)'
                            : 'clamp(2rem, 6vw, 3.5rem)'
                        },
                        [PHONE_LANDSCAPE]: {
                          fontSize: isWordLabel(item.display)
                            ? '1.05rem'
                            : '2rem'
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