import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Typography, Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent, MeasuringStrategy } from '@dnd-kit/core'
import { useDragOnlySensors } from './dnd/useDragOnlySensors'
import { kidCollision } from './dnd/kidCollision'
import { DraggableItem } from './dnd/DraggableItem'
import { useDragActive } from './dnd/useDragActive'
import { wasWobbledTap } from './dnd/dragActivation'
import { isIOS } from '../../utils/deviceDetection'
import { CategoryTheme } from '../../config/categoryThemes'
import GameShell from './GameShell'
import AnswerTile, { type AnswerTileState } from './AnswerTile'
import PromptFocus from './PromptFocus'
import ListenHero from './ListenHero'
import { HeroEmoji, HeroArt, TileArt } from './PromptArt'
import type { GuideReaction } from './ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { useGameState } from '../../hooks/useGameState'
import { useTaskRun } from '../../hooks/useTaskRun'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { type SectionId } from '../../services/progressStore'
import { practiceLedger } from '../../services/practiceLedger'
import { useDifficulty } from '../../hooks/useDifficulty'
import { optionCountFor } from '../../config/difficulty'
import { answerGridSx } from './answerGrid'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { DWELL_CORRECT, DWELL_FACT } from '../../theme/motion'
import { devFx } from '../../utils/devHarness'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Production logging - only essential errors
const logError = (message: string, data?: any) => {
  if (message.includes('Error') || message.includes('error')) {
    console.error(`🎵 UnifiedQuizGame: ${message}`, data)
  }
}

// Decide whether an answer-tile label is a multi-letter WORD (render small) or a single
// glyph — a letter or a number (render large). Answer labels are letters/numerals/words now (no
// pictographs — those became baked art), but the grapheme-cluster test is kept: the old `.length > 2`
// test mis-sized multi-codepoint glyphs (keycap digits, variation-selector and ZWJ pictographs are ONE
// grapheme but several code units), so they'd have shrunk to word size. Numbers ("10", "100") stay
// large; any pictograph stays large; otherwise a label is a "word" only if it spans >1 grapheme cluster.
const isWordLabel = (display: string | number): boolean => {
  if (typeof display !== 'string') return false
  const s = display.trim()
  if (s === '' || /^\d+$/.test(s)) return false               // numbers → large
  if (/\p{Extended_Pictographic}/u.test(s)) return false      // most emoji → large
  // Keycap sequences (enclosed-digit emoji) have no pictographic codepoint but ARE one grapheme
  // cluster; count grapheme clusters so they stay large. Segmenter isn't in our TS lib target — cast.
  const Segmenter = (Intl as unknown as { Segmenter?: any }).Segmenter
  if (typeof Segmenter === 'function') {
    return [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].length > 1
  }
  // Fallback (no Intl.Segmenter): drop variation selectors, ZWJ and the enclosing-keycap mark so
  // multi-codepoint emoji collapse to one char, then treat >1 remaining as a word.
  const combining = new Set([0xFE0E, 0xFE0F, 0x200D, 0x20E3])
  return [...s].filter((ch) => !combining.has(ch.codePointAt(0)!)).length > 1
}

// The droppable id a `dragToPromptSlot` quiz's hero must use for its gap (see the config field).
// Exported so the config and the engine can never disagree about the string.
export const QUIZ_PROMPT_SLOT_ID = 'quiz-prompt-slot'

// Stable per-option drag id. Keyed on `value` (the matchable primitive) rather than the render index so
// a re-render mid-drag can't retarget the gesture at a different tile.
const dragIdFor = (item: QuizItem) => `opt-${item.value}`

// Quiz item interface for flexible content
export interface QuizItem {
  value: string | number      // The actual value (letter, number, or expression)
  display: string | number    // What to show on screen
  audioPrompt: string         // The full prompt text
  repeatWord: string          // Word to repeat in prompt
  // Optional visual question shown in the prompt area (e.g. word-association mode:
  // show an emoji + word and ask which letter it starts with). When present, the
  // quiz renders this above the answer grid instead of relying on audio alone.
  // A prompt word renders as ONE uniform string — no per-letter size/weight/opacity. PRD-18 W1's
  // `emphasizeFirstLetter` flag lived here and was removed 2026-08-03 (owner: "all letters should be
  // displayed the same no matter what"); see the render site for why it also mis-taught letter case.
  questionVisual?: { emoji?: string; word?: string; art?: string }
  // Optional baked soft-3D picture rendered on THIS OPTION's answer tile (Liveliness PRD-10 §3.1) —
  // distinct from `questionVisual.art`, which is the *prompt's* art. Used by Læs Ordet, whose answers
  // ARE the pictures (the prompt is the word to read). When set the tile renders a <TileArt> instead
  // of the glyph/emoji `display`; when absent (every other quiz) the tile renders `display` exactly as
  // before — so this addition is inert for all non-Ordleg quizzes.
  art?: string
  // Optional custom answer-tile content (Liveliness PRD-12 §2B): a React node rendered on THIS
  // OPTION's tile instead of the `display` glyph — used by Hvad Mangler to render CSS clay pips for
  // the visual-pattern options (no emoji, no baked art). `value` stays a plain matchable primitive;
  // `node` is purely the visual. Absent for every other quiz → the glyph render is unchanged.
  node?: React.ReactNode
}

// Configuration interface for the unified quiz
export interface UnifiedQuizConfig {
  // Quiz identification
  quizType: 'alphabet' | 'counting' | 'arithmetic' | 'english' | 'ordleg'
  
  // Content generation. `optionCount` is resolved CENTRALLY by the engine from the difficulty table
  // (Difficulty PRD-01 W3 — `optionCountFor(gameId, level)`: 3/4/5, or 3/4/6 for Læs Ordet's picture
  // tiles), so no config hand-rolls it any more. Each game still owns *which* distractors it picks —
  // it just has to return exactly `optionCount` items (correct answer included).
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem, optionCount: number) => QuizItem[]

  // Display configuration
  title: string                // "Bogstav Quiz" or "Tal Quiz"
  // Legacy game-identity glyph — never rendered (kept optional only for back-compat; PRD-12 dropped
  // the emoji values). Do not add new usages.
  emoji?: string
  teacherCharacter: 'owl' | 'fox'
  theme: CategoryTheme
  backRoute: string
  
  // Component configuration
  RepeatButtonComponent: React.ComponentType<any>
  // Hide the "Gentag" repeat button (e.g. Læs Ordet, where the word must not be read aloud).
  showRepeat?: boolean        // default true

  // Audio configuration
  gameWelcomeType: string     // 'alphabet' or 'math'
  
  // Audio methods (flexible to handle different prompt types)
  speakQuizPrompt: (item: QuizItem, audio: any) => Promise<string>
  speakClickedItem: (item: QuizItem, audio: any) => Promise<string>
  getRepeatAudio: (item: QuizItem, audio: any) => Promise<string>

  // The never-fail hint SPEAKS the answer (Practice Loop PRD-01 W3). Called when `hintAfterNWrong` is
  // crossed, alongside the tile pulse — fire-and-forget, never awaited. The argument is the CURRENT
  // item, i.e. the right answer, NOT the tile that was tapped. What each game says is data in
  // `src/config/hintLines.ts`, so the guard reads the same value the game speaks.
  //
  // A game may omit this and stay silent — Læs Ordet must (it never reads its prompt word aloud).
  speakHint?: (item: QuizItem, audio: any) => Promise<string>

  // Optional: on a CORRECT answer, speak the completed fact (e.g. Hvad Mangler's finished sequence)
  // INSTEAD OF echoing the tapped item (single audio channel — replaces, never stacks). Receives
  // the current (correct) QuizItem. When absent, a correct tap echoes speakClickedItem as before.
  speakCorrectFact?: (item: QuizItem, audio: any) => Promise<string>

  // Never-fail hint (PRD-05 P1). After this many wrong taps on the current question, the correct
  // tile pulses/glows (AnswerTile `hint`) so the child is never stuck — matching the hand-rolled
  // color/spelling games. The 2 wrongs already broke first-try, so it needs no extra star
  // bookkeeping. Omit (or 0) to disable. Enabled (2) for every config quiz.
  hintAfterNWrong?: number

  // Hear-before-commit (PRD-14 W7 — the flagship). OPT-IN, for quizzes whose ANSWER tiles are
  // written words a pre-reader cannot read (english.word; also english.translate before that game was
  // removed in 2026-08-03). When on, the FIRST
  // tap on a tile AUDITIONS it — speaks the tile's word and raises it ('selected') WITHOUT scoring,
  // advancing, breaking first-try, or arming the hint. Only a SECOND tap on the SAME raised tile
  // COMMITS (runs the normal correct/wrong path). Tapping a DIFFERENT tile moves the audition.
  // Absent/false → today's single-tap-commits behavior, byte-identical. Do NOT enable it where the
  // answers already reveal themselves (picture answers, glyph/number quizzes he can read).
  previewBeforeCommit?: boolean

  // Play is ENDLESS (Endless Play PRD-01 D1) — there is no round boundary and no result surface. This
  // number is the `taskXp` NORMALISER ("a round is a round"), and at each call site it is the same
  // constant the game's prompt bag uses as its no-repeat window. Default 8. Requires `gameId` to earn.
  tasksInRound?: number
  gameId?: string             // stable id for progress, e.g. 'alphabet.quiz'

  // Optional custom PromptStage hero (UI/UX Overhaul §6A). When provided, the quiz renders this in
  // the PromptStage instead of the default (questionVisual emoji/word, English "listen" card, or the
  // item glyph). Use for richer subjects — e.g. Tal Quiz's numeral + counted objects, or Hvad
  // Mangler's sequence with a pulsing "?". Receives the live QuizItem, plus the engine's live audio
  // state so a hero can react to playback (Tal Quiz's numeral band renders the shared ListenHero) —
  // read `speaking` from here, never a component-level isPlaying (see audio-system.md).
  // `narrationHealthy` is the W4 degraded-mode signal: false → an audio-only board must reveal its own
  // answer, because it is otherwise unanswerable (Tal Quiz shows nothing but a speaker). Read it from
  // here rather than the hook so a hero can't accidentally read `isAudioReady`, which was TRUE through
  // the Ogg silence.
  renderHero?: (
    item: QuizItem,
    ctx: { speaking: boolean; dropActive: boolean; narrationHealthy: boolean },
  ) => React.ReactNode

  // Answer by DRAG as well as by tap (owner, 2026-08-03). OPT-IN, and only meaningful for a quiz whose
  // PROMPT contains the slot the answer belongs in — Hvad Mangler's "?" in the sequence. The other
  // config quizzes ask a question rather than show a gap ("which letter does this start with?"), so a
  // drop target there would be invented furniture; they leave this unset and the engine mounts no
  // DndContext at all, so this addition is completely inert for them.
  //
  // Contract: the config's `renderHero` must wrap its gap in a
  // `<DroppableZone id={QUIZ_PROMPT_SLOT_ID}>`, and can ring it using `ctx.dropActive`. A drop there
  // runs the SAME `handleItemClick` a tap runs, so the advance-lock, first-try flag, hint counter and
  // round bookkeeping are shared — there is no second scoring path.
  dragToPromptSlot?: boolean

  // (`audioOnly` is DELETED — Endless Play PRD-01 W3. It only ever fed the `degraded` flag on
  // `recordRoundResult`, i.e. the personal-best suppression, and personal bests are gone. The W4
  // degraded-mode PRODUCT behaviour is untouched: an unanswerable audio-only board still reveals its
  // own answer, driven straight off `audio.narrationHealthy` at the render site — never off a config
  // flag. Keeping the flag would have left an unread config field, which is the exact silently-dead
  // shape this repo's guards exist to catch.)

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
  // Hear-before-commit (PRD-14 W7): the value of the currently-auditioned/raised tile, or null when
  // nothing is selected. Only used when config.previewBeforeCommit is on. Cleared per question.
  const [previewValue, setPreviewValue] = useState<string | number | null>(null)
  const reduce = useReducedMotion()
  // Drag-to-the-gap support (opt-in via config.dragToPromptSlot — inert otherwise; the hooks are cheap
  // and unconditional so the hook order never depends on config).
  const sensors = useDragOnlySensors()
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()
  // Scene darkness — the focal-zone prompt word rides the light-pool: light accent on a DARK scene,
  // but the darkened readable-on-white accent on a LIGHT scene (see the qv.word hero below).
  const muiTheme = useTheme()
  // Live difficulty for this section — re-renders + regenerates on an adult-menu change (no refresh).
  const difficultyLevel = useDifficulty(config.theme.id as SectionId)
  // The shared answer-tile axis (Difficulty PRD-01 W3): 3 / 4 / 5 tiles (Læs Ordet 3/4/6), resolved
  // ONCE here from the level so no config quiz hand-rolls it. `generateOptions` receives the count and
  // keeps ownership of WHICH distractors it picks. Read via a ref inside the generator so the callback
  // identity (and therefore the init effect) doesn't churn on every level change.
  const optionCount = optionCountFor(config.gameId, difficultyLevel)
  const optionCountRef = useRef(optionCount)
  optionCountRef.current = optionCount

  // Component initialization - no logging needed in production

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: `UnifiedQuizGame-${config.quizType}`,
    autoInitialize: false
  })

  // Centralized game state management. `score` itself is no longer READ anywhere — the header chip
  // that displayed it is gone.
  const { incrementScore } = useGameState()

  // Celebration management (rendered by GameShell)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  // Endless task play: per-task XP + the streak counter + the ceremony seam (Endless Play PRD-01 W2).
  const run = useTaskRun({
    tasksInRound: config.tasksInRound ?? 8,
    gameId: config.gameId ?? `quiz.${config.quizType}`,
  })
  // True until the first wrong tile is tapped for the current question; gates the streak's
  // "first try" accounting. Reset on each new question.
  const firstAttemptRef = useRef(true)
  // Never-fail hint (PRD-05 P1): after `hintAfterNWrong` wrong taps on the current question the
  // correct tile pulses. Shared primitive; `Infinity` threshold disables it when the config omits
  // `hintAfterNWrong`. `showHint` is the boolean the render reads; reset per question.
  const { hint: showHint, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<boolean>(config.hintAfterNWrong ?? Infinity)

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
  // (PRD-02 P4's `mountedRef` is gone as of 2026-08-02: the tap handler no longer awaits narration, so
  // the advance timer is created synchronously and the unmount cleanup below always has it to clear.
  // There is no post-await continuation left that could schedule a ghost prompt over the next screen.)

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
    setPreviewValue(null) // hear-before-commit: no tile is auditioned at the start of a question (W7)

    const quizItem = config.generateQuizItem()
    currentItemRef.current = quizItem
    setCurrentItem(quizItem)
    questionSeq.current += 1 // fresh key namespace for this question's option tiles
    setShowOptions(config.generateOptions(quizItem, optionCountRef.current))

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
  // the new level right away (the config's generators read difficultyFor live). Skips the initial
  // mount (only reacts to a real change).
  const prevDifficulty = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficulty.current === difficultyLevel) return
    prevDifficulty.current = difficultyLevel
    if (!gameReady) return
    generateNewQuestion()
  }, [difficultyLevel, gameReady, generateNewQuestion])

  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(String(event.active.id))
    sfx.play('pick-up')
  }

  // A drop on the prompt's gap resolves exactly as a tap on that tile would (see `dragToPromptSlot`).
  // `kidCollision` returns nothing when the pointer is over nothing, so an abortive drag springs back
  // without scoring or breaking first-try.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event
    clearActive()
    // Landed on the prompt's gap, or a TAP THAT WOBBLED — ONE call either way, so both gestures keep
    // sharing `handleItemClick` and with it the advance-lock, first-try and practice-ledger rules.
    // Past 8px dnd-kit had already claimed the gesture as a drag and sounded `pick-up`, so bailing out
    // here is what dropped the child's tap and left him tapping again; a gesture that travelled
    // FURTHER was aimed somewhere and missed, and still springs back. `viaDrag: true` so it does not
    // stack a second `tap` tick on the `pick-up` that already played. See `wasWobbledTap`.
    const landed = !!over && over.id === QUIZ_PROMPT_SLOT_ID
    if (!landed && !wasWobbledTap(delta)) return
    const item = showOptions.find((o) => dragIdFor(o) === String(active.id))
    if (item) void handleItemClick(item, true)
  }

  const handleItemClick = async (selectedItem: QuizItem, viaDrag = false) => {
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

    // Every tap is felt: a soft tick synced to the press (separate SFX channel, never TTS). A DROP
    // already sounded its press on pick-up, so it skips the tick rather than stacking a third cue.
    if (!viaDrag) sfx.play('tap')

    // Hear-before-commit (PRD-14 W7): when enabled, the FIRST tap on a tile (or on a DIFFERENT tile
    // than the one currently raised) AUDITIONS it — speak its word + raise it — and returns WITHOUT
    // committing. The audio was already cancelled above, so this is single-channel. Crucially we
    // return BEFORE the lock/score/feedback/first-try/hint block: none of those invariants run on an
    // audition. Only a second tap on the SAME already-raised tile falls through to the commit path.
    if (config.previewBeforeCommit && selectedItem.value !== previewValue) {
      setPreviewValue(selectedItem.value)
      setFeedback(null)     // clear any prior correct/wrong mark so only the raised tile is highlighted
      setGuideReaction(null)
      try {
        await config.speakClickedItem(selectedItem, audio)
      } catch {
        // best-effort: audition audio is non-critical
      }
      return
    }

    const isCorrect = selectedItem.value === currentItem.value

    // Engage the advance-lock SYNCHRONOUSLY on a correct tap so a second tap fired in the same tick
    // is already blocked by the guard above (PRD-02 P1/P2).
    if (isCorrect) isAdvancingRef.current = true

    // INSTANT visual feedback: mark the tapped tile (correct/wrong border + glow/sparkle/shake)
    // and cue the corner guide.
    setFeedback({ value: selectedItem.value, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Resolve the answer SYNCHRONOUSLY — score, celebration and the wrong-branch SFX/hint all land on
    // the tap (2026-08-02). These used to sit AFTER `await`ing the narration, so the confetti didn't
    // appear until the clip had finished and then the board changed immediately: the celebration was
    // effectively invisible and the whole beat read as ~4s of dead green tile.
    // Practice ledger (Practice Loop PRD-01 W2): recorded HERE because this is the point that already
    // knows first-try, so there is no new bookkeeping. Three rules in one line: the item recorded is
    // always the CURRENT one — what he was ASKED — never the tile he tapped; a wrong tap is a miss; and a
    // correct tap counts as `seen` only when it was FIRST-TRY, because a correct tap after a wrong one
    // already recorded that question's miss and must not record it twice. It feeds prompt ORDER only,
    // never a level (see `practiceWeights.ts`), and no-ops for a game whose prompts aren't pool-drawn.
    // `currentItem.value` IS the bag's item key for every pool-drawn quiz (letter / w.en / w.word); a
    // mismatch would silently drop the re-ask, so `usePromptBag` warns about it in DEV.
    if (config.gameId && (!isCorrect || firstAttemptRef.current)) {
      practiceLedger.recordAttempt(config.gameId, String(currentItem.value), isCorrect)
    }

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
      if (registerHintWrong()) {
        mascotBus.emit('hint')
        // …and SPEAK the answer (Practice Loop PRD-01 W3). A pointer is not an explanation, and the app
        // already had the right sentence — it just only ever said it to the child who got it right.
        // Fire-and-forget (audio-system.md step 8): the single channel means this replaces whatever is
        // playing, which is correct, and the `wrong` SFX is a separate channel that survives it.
        // `currentItem` — the ANSWER — never `selectedItem`.
        if (config.speakHint) void config.speakHint(currentItem, audio).catch(() => {})
      }
    }

    // Narration is FIRE-AND-FORGET, never awaited — it plays alongside the dwell below (see the
    // DWELL_* note in theme/motion.ts). On a correct tap speak the completed FACT if the config
    // supplies one (e.g. Hvad Mangler's finished sequence) INSTEAD of echoing the tapped item (single
    // audio channel, no stacking); otherwise echo the tapped item (identification).
    //
    // EXCEPT on a `previewBeforeCommit` quiz: reaching here means this tile was already the auditioned
    // one, so the child heard this exact word ~a second ago. The audition IS the echo; don't repeat it.
    const alreadyAuditioned = !!config.previewBeforeCommit
    // A sentence fact needs the longer dwell so it isn't cut mid-word; a one-word echo doesn't.
    const spokeFact = isCorrect && !!config.speakCorrectFact
    // `.catch` on the promise, not try/catch — nothing awaits these, so a rejection would otherwise
    // surface as an unhandled rejection (and the crash reporter would upload it).
    if (spokeFact) {
      void config.speakCorrectFact!(currentItem, audio).catch(() => {})
    } else if (!alreadyAuditioned) {
      void config.speakClickedItem(selectedItem, audio).catch(() => {})
    }

    // Auto-advance after a short celebration window (correct only; wrong stays for retry).
    if (isCorrect) {
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        stopCelebration()

        // THE SEAM (Endless Play PRD-01 §4.1). Record the completed task, fire the streak milestone,
        // and hand the continuation to `thenContinue` — which plays the ceremony first when this task
        // crossed a slot, and only then generates the next question. The advance lock is still held
        // (the generator releases it), so the board is inert underneath the overlay.
        const r = run.completeTask(firstAttemptRef.current)
        // Suppressed on a crossing, deliberately: one loud payoff, not two celebrations stacked in the
        // same 200ms — the same argument that deleted the ring's `levelup-mini`.
        if (r.streak > 0 && r.streak % 3 === 0 && !r.crossedLevel) {
          // Streak chime pitch ascends with the streak length.
          celebrateTier('streak', { sfxRate: 1 + Math.min(r.streak, 12) * 0.06 })
          mascotBus.emit('streak')
        }
        run.thenContinue(() => generateNewQuestion())
        // A fixed celebration window from the tap — nothing above it awaits audio, so this timer is
        // created synchronously and the unmount cleanup can always clear it (which also retires the
        // old "timer scheduled after an await, so unmount had nothing to clear" ghost-prompt hazard).
        // The next question's own prompt delay (200/300ms) sits on top, so it only ever cancels the
        // narration's trailing silence.
      }, spokeFact ? DWELL_FACT : DWELL_CORRECT())
    }
  }

  const repeatItem = async () => {
    if (!currentItem) return

    // Asking to hear the prompt again IS the child playing (same flag `handleItemClick` sets), and
    // without this the LATE WELCOME cancels the very clip they asked for. On a cold load audio is
    // not unlocked at mount, so the welcome is deferred to the `isAudioReady` effect below — and the
    // thing that unlocks audio is this tap. So the order was: tap → speak(prompt) → unlock →
    // `isAudioReady` flips → deferred welcome fires → `playAudio` calls `stopCurrentAudio()` → the
    // prompt dies before it is heard. Measured as `/math/patterns` reporting SILENT ("all clips
    // pre-empted") in the QA sweep, and as the "1 pre-empted by design" on every other quiz — which
    // was never by design, only survivable there because the clip got requested a second time.
    hasInteractedRef.current = true

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

  const RepeatButton = config.RepeatButtonComponent

  // Per-tile feedback state for the most-recently tapped answer. In DEV, ?fx=correct|wrong forces
  // the first tile so the state is deterministically capturable.
  const tileStateFor = (item: QuizItem, index: number): AnswerTileState => {
    if (index === 0 && (forcedFx === 'correct' || forcedFx === 'wrong')) return forcedFx
    // Committed correct/wrong feedback always wins over the raised audition state.
    if (feedback && feedback.value === item.value) return feedback.correct ? 'correct' : 'wrong'
    // Hear-before-commit (W7): the auditioned tile reads as raised/'selected' until it commits.
    if (previewValue !== null && item.value === previewValue) return 'selected'
    return 'idle'
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

  // Hero subject for the PromptStage (§6A). Uses the config's questionVisual when present; audio-
  // only English (Lyt og Find) shows a neutral "listen" card so it never reveals the answer;
  // everything else falls back to the item's own glyph (e.g. Tal Quiz numeral) so the stage is
  // never empty.
  const renderHero = () => {
    const item = currentItem
    if (!item) return null
    // Config-supplied custom hero takes precedence (Tal counted objects, Hvad Mangler sequence…).
    if (config.renderHero) {
      return config.renderHero(item, {
        speaking: audio.isPlaying,
        dropActive: overId === QUIZ_PROMPT_SLOT_ID,
        narrationHealthy: audio.narrationHealthy,
      })
    }
    const qv = item.questionVisual
    if (qv && (qv.art || qv.emoji || qv.word)) {
      // A picture above the word makes the word a small CAPTION; a word with no picture is the BIG
      // prompt subject (Læs Ordet, Hvad Mangler's sequence). Art is the picture now — emoji is the
      // retired fallback, so treat either as "has picture". (The caption branch has no consumer since
      // Dansk til Engelsk was removed 2026-08-03 — Find det Engelske Ord passes `word: ''` — but the
      // rule is kept: it is what makes a picture+word prompt legible if one is ever added back.)
      const hasPicture = !!(qv.art || qv.emoji)
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 0.5, md: 1 } }}>
          {/* Baked soft-3D subject when the area has art (PRD-07); emoji is the retired art-gated fallback. */}
          {qv.art ? <HeroArt src={qv.art} /> : qv.emoji ? <HeroEmoji>{qv.emoji}</HeroEmoji> : null}
          {qv.word && (
            // EVERY letter of a prompt word renders identically — same size, weight and opacity
            // (owner, 2026-08-03). PRD-18 W1's first-letter decode cue (oversized bold first grapheme,
            // muted remainder) is DELETED: it stole the focus of the whole board, and because the word
            // is `textTransform: uppercase`, shrinking + fading the remainder made a capital O read as a
            // lowercase one — "SO" looked like Title Case "So", teaching the wrong letter shapes to a
            // child who is learning exactly that. Don't re-introduce per-letter styling on a word the
            // child is supposed to read.
            <Typography
              sx={{
                fontWeight: 800,
                // Prompt word on the focal-zone light-pool: keep the vivid accent on DARK scenes
                // (readable there), but darken to the readable-on-white accent on LIGHT scenes so a
                // light section accent (Havet's yellow, Rummet's cyan) isn't washed out. No-op when
                // the accent already reads. Mirrors the tile fix (onTileColor).
                color: muiTheme.scene.dark ? config.theme.accentColor : config.theme.onTileColor,
                lineHeight: 1,
                userSelect: 'none',
                letterSpacing: hasPicture ? 'normal' : '0.06em',
                textTransform: hasPicture ? 'none' : 'uppercase',
                fontSize: hasPicture ? 'clamp(1.4rem, 5vw, 2.4rem)' : 'clamp(2.4rem, 10vw, 4.5rem)',
                [PHONE_LANDSCAPE]: { fontSize: hasPicture ? '1.2rem' : '2rem' },
              }}
            >
              {qv.word}
            </Typography>
          )}
        </Box>
      )
    }
    if (config.quizType === 'english') {
      // Listening task (Lyt og Find): the shared "listen" hero — a subject without revealing the
      // picture. PRD-17 W2: the indicator tracks REAL audio-playback state (`audio.isPlaying`, read
      // from the hook — never a component-level isPlaying, per audio-system.md).
      //
      // W4: with narration DEAD this board is audio→picture with no audio, i.e. unanswerable — so it
      // reveals the English word as type. Deliberately the giveaway; see ListenHero's `reveal`.
      return (
        <ListenHero
          accent={config.theme.accentColor}
          speaking={audio.isPlaying}
          reveal={audio.narrationHealthy ? undefined : String(item.value)}
        />
      )
    }
    return <HeroEmoji>{item.display}</HeroEmoji>
  }

  const board = (
    <GameShell
      categoryId={config.theme.id}
      title={config.title}
      backRoute={config.backRoute}
      guideReaction={guideReaction}
      promptStage={
        <PromptFocus
          accent={config.theme.accentColor}
          chargeKey={`${currentItem?.value ?? ''}-${run.state.index}`}
          subject={showPlaceholders ? null : renderHero()}
          repeat={
            config.showRepeat !== false && !showPlaceholders ? (
              <RepeatButton onClick={repeatItem} disabled={false} />
            ) : undefined
          }
        />
      }
      celebration={{
        show: showCelebration,
        intensity: celebrationIntensity,
        duration: celebrationDuration,
        onComplete: stopCelebration,
      }}
    >
        {/* Answer Options Grid — fills the answer zone beneath the PromptStage. The grid rises to the
            TOP of the body zone (PRD-14 W1) so the tiles sit right beneath the prompt instead of
            hugging the very bottom edge — killing the old dead mid-band. Phone-landscape keeps the
            tiles centred (its 30/70 split is already tight — preserve that behaviour). */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          pt: { xs: 1, md: 2 },
          minHeight: 0,
          [PHONE_LANDSCAPE]: { alignItems: 'center', pt: 0 },
        }}>
          <Box
            // Columns + width envelope now follow the TILE COUNT (Difficulty PRD-01 W3) — shared with
            // MathOperationGame's hand-rolled grid so the two answer zones can't drift. While the board
            // is still shimmering there are no options yet, so fall back to the level's own count.
            sx={answerGridSx(showPlaceholders ? optionCount : showOptions.length)}
          >
          {showPlaceholders
            ? // Loading shimmer (welcome gate pending) — same footprint as the real tiles.
              Array.from({ length: optionCount }, (_, i) => i).map((i) => (
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
                  animate={
                    reduce
                      ? { opacity: 1 }
                      : activeId === dragIdFor(item)
                        // Grabbed tile LIFTS (the Farver games' shared drag juice). A plain number, not
                        // the entrance keyframes — a keyframe array would restart the pop mid-drag.
                        ? { opacity: 1, scale: 1.08 }
                        : { opacity: 1, scale: [0.8, 1.04, 1] }
                  }
                  transition={reduce ? { duration: 0 } : { delay: index * 0.08, duration: 0.25, ease: 'easeOut' }}
                  style={{ height: '100%' }}
                >
                  <DragWrap
                    enabled={config.dragToPromptSlot === true}
                    id={dragIdFor(item)}
                    disabled={isAdvancingRef.current}
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
                    {/* Baked soft-3D picture answer (Læs Ordet — the answers ARE the pictures; §3.1);
                        a custom node (Hvad Mangler's CSS clay pips; PRD-12 §2B); else the glyph/emoji
                        Typography below, byte-identical to before for every other quiz. */}
                    {item.art ? (
                      <TileArt src={item.art} />
                    ) : item.node ? (
                      item.node
                    ) : (
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
                        // Readable-on-white tile label: darkens only too-light accents (e.g. Rummet
                        // cyan / Havet yellow) that were illegible on the white tile; a no-op for
                        // accents that already pass AA. See onTileColor / CategoryTheme.onTileColor.
                        color: config.theme.onTileColor,
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
                    )}
                  </AnswerTile>
                  </DragWrap>
                </motion.div>
              ))}
          </Box>
        </Box>
    </GameShell>
  )

  // Only a `dragToPromptSlot` quiz mounts a DndContext, so the four quizzes that answer by tap alone
  // are byte-identical to before. `MeasuringStrategy.Always` is mandatory: PromptFocus idle-floats, so
  // a rect measured once at drag start judges the drop against a stale position (drag-and-drop.md).
  if (!config.dragToPromptSlot) return board

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kidCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearActive}
    >
      {board}
    </DndContext>
  )
}

// Wraps an answer tile in a draggable ONLY when the quiz opted into drag; otherwise renders the tile
// untouched (no extra DOM, no dnd-kit hook) so the tap-only quizzes are unaffected. The tile keeps its
// own onClick for the tap — DraggableItem's capture-phase guard swallows the trailing click of a real
// drag, so one gesture can never answer twice.
const DragWrap: React.FC<{ enabled: boolean; id: string; disabled: boolean; children: React.ReactNode }> = ({
  enabled,
  id,
  disabled,
  children,
}) => {
  if (!enabled) return <>{children}</>
  return (
    <DraggableItem id={id} inline fill disabled={disabled}>
      {children}
    </DraggableItem>
  )
}

export default UnifiedQuizGame