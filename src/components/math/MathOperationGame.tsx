import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Typography, Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent, MeasuringStrategy } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { useDragActive } from '../common/dnd/useDragActive'
import { getCategoryTheme } from '../../config/categoryThemes'
import { mathFactText } from '../../config/gamePhrases'
import { optionCountFor, starThresholdsFor } from '../../config/difficulty'
import { makeAdditionProblem, makeSubtractionProblem, operationDistractors } from '../../config/mathProblems'
import { answerGridSx } from '../common/answerGrid'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import PromptFocus from '../common/PromptFocus'
import SymbolTile from '../common/SymbolTile'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { MathRepeatButton } from '../common/RepeatButton'
import RoundResultScreen from '../common/RoundResultScreen'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useDifficulty } from '../../hooks/useDifficulty'
import { isIOS } from '../../utils/deviceDetection'
import { devFx } from '../../utils/devHarness'
import { POP, DWELL_FACT, EXIT_FAST, motionOr } from '../../theme/motion'
import { darken, hexToRgba, tileSurface } from '../../theme/tokens/helpers'
import { softShadow } from '../../theme/depth'
import { shuffle } from '../../utils/shuffle'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Unified addition/subtraction game. Behaviour and difficulty ranges are preserved
// exactly from the previous AdditionGame/SubtractionGame for 'normal'; only the operator,
// problem generation, spoken prompt, title and welcome differ by `operation`.
//
// Games Visual Uplift (PRD-08 §3.3): the equation "number sentence" rests as CLAY in PromptFocus's
// in-world light-pool — the frosted PromptStage card (border + backdrop-filter) is retired. On a
// correct answer the "?" flips to the revealed answer with a motion.POP (enter) + EXIT_FAST (the
// leaving "?"), then the DWELL_FACT auto-advance.
interface MathOperationGameProps {
  operation: 'addition' | 'subtraction'
}

// The number sentence is the WHOLE prompt (owner 2026-08-02). PRD-15 W1's countable ten-frame under
// the equation was removed: `a` dots + `b` dots is a second rendering of the two numerals already on
// screen, so it doubled the visual load and let the child answer by counting dots instead of reading
// the sentence. This matches the same call made on Sammenlign Tal's object piles, Lær Tal's dot
// cluster and Tal Quiz's object row — nothing on a math board restates a number that's already shown.
const MathOperationGame: React.FC<MathOperationGameProps> = ({ operation }) => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const category = getCategoryTheme('math')
  // Phone landscape's PromptStage slot is short (~26-34% of an already-short body) — the repeat
  // button shrinks there so the equation keeps its full height instead of being squeezed/clipped.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))
  // Answer by TAP or by DRAG onto the "?" (see handleDragEnd).
  const sensors = useDragOnlySensors()
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()
  const isAddition = operation === 'addition'
  const title = isAddition ? 'Plus Opgaver' : 'Minus Opgaver'
  const operator = isAddition ? '+' : '-'
  const gameId = isAddition ? 'math.addition' : 'math.subtraction'

  // The correct-answer fact comes from the shared builder (src/config/gamePhrases.ts), which the
  // prebake enumerator also calls — so the played text and the baked clip can never drift apart.
  const factText = (a: number, b: number, answer: number): string => mathFactText(operation, a, b, answer)

  const [num1, setNum1] = useState<number | null>(null)
  const [num2, setNum2] = useState<number | null>(null)
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null)
  const [options, setOptions] = useState<number[]>([])
  // Feedback for the most-recently tapped answer + the corner guide reaction.
  const [feedback, setFeedback] = useState<{ value: number; correct: boolean } | null>(null)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  // The equation's "?" flips to the revealed answer (motion.POP) once the tapped tile is correct.
  const [revealAnswer, setRevealAnswer] = useState(false)
  // Never-fail hint: after 2 wrong taps the correct answer tile pulses (reduced-motion → static glow,
  // owned by TactileTile). Resets per problem. No mascot nudge — matching Stav Ordet.
  const { hint: hintActive, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<boolean>(2)

  const audio = useSimplifiedAudioHook({
    componentId: isAddition ? 'AdditionGame' : 'SubtractionGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)
  const hasInitialized = useRef(false)
  // Guards the actual start (runs once regardless of which path triggers it) and the welcome
  // (plays at most once even if audio unlocks after mount). Mirrors UnifiedQuizGame's resilient
  // start so a child is never stranded on an empty board when audio isn't unlocked at mount.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)

  const { incrementScore, resetScore } = useGameState()

  // Bounded round + reward flow (Foundation §3). 8 questions; the star thresholds come from the
  // difficulty spine at finish time (Difficulty PRD-01 W6), so they're not pinned here.
  const round = useRound({ length: 8, gameId })
  // True until the first wrong tile is tapped for the current problem (gates streak/star).
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // The post-correct celebration/advance timer (PRD-02 P1/P4) — tracked so it's cleared on unmount
  // (no ghost prompt on the next screen) and never runs twice.
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Advance-lock (PRD-02 P1/P2): set synchronously on a correct tap so a rapid double-tap can't
  // double-record the round and a tap during the celebration dwell can't poison the earned
  // first-try. A ref so it's readable synchronously within the same event-loop tick.
  const isAdvancingRef = useRef(false)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)
  // (PRD-02 P4's `mountedRef` is gone as of 2026-08-02: the tap handler no longer awaits narration, so
  // the advance timer is created synchronously and the unmount cleanup always has it to clear.)
  // Live current problem (so it can be voiced after the welcome) + interaction guard (so a late
  // welcome never talks over active play).
  const problemRef = useRef<{ a: number; b: number } | null>(null)
  // Per-problem key namespace so option tiles never reuse a motion.div across problems (which would
  // skip the enter animation on a shared value at the same index). Mirrors SpellingGame's wordSeq.
  const optionSeq = useRef(0)
  const hasInteractedRef = useRef(false)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 ${isAddition ? 'AdditionGame' : 'SubtractionGame'}: ${message}`, data)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the playable board immediately (tappable), no waiting on the welcome.
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenProblem()
    }

    // Empty-dep effect → this cleanup runs once, on unmount: clear every pending timer so no
    // prompt/advance callback fires after the component is gone (ghost TTS on the next screen).
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current)
        advanceTimerRef.current = null
      }
      if (guideReactionTimer.current) {
        clearTimeout(guideReactionTimer.current)
        guideReactionTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When audio unlocks after mount, play the welcome (board already visible). Interaction-guarded
  // inside playWelcomeThenProblem so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenProblem()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Instant load: render the playable board RIGHT AWAY without voicing the first problem yet — the
  // welcome narrates over the visible board and the spoken problem follows it. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    generateNewProblem(false)
  }

  // Play the welcome over the already-visible board, then voice the first problem. Self-guards;
  // skips the trailing problem if the child already started tapping.
  const playWelcomeThenProblem = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome(operation)
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (problemRef.current && !hasInteractedRef.current) {
      speakProblem(problemRef.current.a, problemRef.current.b)
    }
  }

  // `voice=false` renders the board without voicing the problem (used for the first problem, which
  // is voiced after the welcome instead).
  const generateNewProblem = (voice = true) => {
    // Clear the previous answer's feedback + guide reaction before the new problem appears.
    setFeedback(null)
    setGuideReaction(null)
    setRevealAnswer(false)
    resetHint()
    // New problem → first attempt fresh again and the advance-lock releases (tiles tappable again).
    firstAttemptRef.current = true
    isAdvancingRef.current = false

    // Static, manual difficulty — read fresh per problem. The generation itself is a PURE function in
    // src/config/mathProblems.ts, sampled by difficulty.test.ts (Difficulty PRD-01 W2):
    //   Plus  — Let sums ≤10 · Normal sums ≤20, both addends ≥2, crossing allowed · Svær ALWAYS crosses
    //   Minus — Let minuend ≤10 · Normal minuend ≤20 and NEVER borrows · Svær 11–20 and ALWAYS borrows
    // Minus at Normal is the headline fix: it used to draw any subtrahend, so a round was dominated by
    // borrow problems (16−9) with nothing left on the board to count with (the ten-frame was removed
    // 2026-08-02). Plus at Normal keeps crossing the ten on purpose — counting ON to 20 on fingers is a
    // skill he has; counting BACK across it is not. Equal effort, not equal arithmetic structure.
    const level = progressStore.difficultyFor('math')
    const { a: firstNum, b: secondNum, answer } = isAddition
      ? makeAdditionProblem(level)
      : makeSubtractionProblem(level)

    setNum1(firstNum)
    setNum2(secondNum)
    setCorrectAnswer(answer)
    problemRef.current = { a: firstNum, b: secondNum }

    // Warm this problem's fact line while the child is still working the problem out, so nothing is
    // paid on the correct tap — the one moment that must feel immediate. The fact is prebaked now, so
    // this warms the clip's HTTP fetch; if a clip is ever missing it warms the synth instead.
    audio.warmSpeech(factText(firstNum, secondNum, answer))

    // Near-answer distractors (off-by-one/two + the operands) clamped to the valid result range, so
    // wrong options are plausible confusions rather than random noise. The COUNT is the shared tile
    // axis now (3 / 4 / 5 — Difficulty PRD-01 W3), resolved from the same table the config quizzes use.
    const optionCount = optionCountFor(gameId, level)
    const picks = operationDistractors(operation, { a: firstNum, b: secondNum, answer }, level, optionCount - 1)

    optionSeq.current += 1 // fresh key namespace for this problem's option tiles
    setOptions(shuffle([answer, ...picks]))

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (!voice) return

    const delay = isIOS() ? 100 : 500
    timeoutRef.current = setTimeout(() => {
      speakProblem(firstNum, secondNum)
    }, delay)
  }

  const speakProblem = async (a: number, b: number) => {
    try {
      audio.updateUserInteraction()
      if (isAddition) {
        await audio.speakAdditionProblem(a, b, 'primary')
      } else {
        await audio.speakSubtractionProblem(a, b, 'primary')
      }
    } catch (error: any) {
      logError('Error speaking problem', { num1: a, num2: b, error: error?.toString() })
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(String(event.active.id))
    sfx.play('pick-up')
  }

  // Drag an answer tile onto the "?" (owner, 2026-08-03: every game that can support both gestures
  // should). The equation already HAS a slot the answer belongs in, which is what makes a drag mean
  // something here — unlike Sammenlign Tal, where the two numerals ARE the answer tiles and there is
  // nowhere to drag to. Both gestures end in `handleAnswerClick`, so the advance-lock, the first-try
  // flag, the hint counter and the reveal are all untouched.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    clearActive()
    if (!over || over.id !== 'answer-slot') return // released elsewhere → springs back, nothing scored
    const value = Number(String(active.id).replace(/^opt-/, ''))
    if (!Number.isNaN(value)) void handleAnswerClick(value, true)
  }

  const handleAnswerClick = async (selectedAnswer: number, viaDrag = false) => {
    if (correctAnswer === null) return
    // Advance-lock (PRD-02 P1/P2): ignore every tap once a correct answer is resolving — blocks the
    // double-tap double-record and the celebration-tap star theft.
    if (isAdvancingRef.current) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    // Every tap is felt: a soft tick synced to the press (separate SFX channel, never TTS) —
    // matching UnifiedQuizGame so the interaction language is consistent app-wide. A DROP already
    // sounded its press on pick-up, so it skips the tick rather than stacking a third cue.
    if (!viaDrag) sfx.play('tap')

    const isCorrect = selectedAnswer === correctAnswer

    // Engage the advance-lock SYNCHRONOUSLY on a correct tap so a second tap fired in the same tick
    // is already blocked by the guard above.
    if (isCorrect) isAdvancingRef.current = true

    // Mark the tapped tile + cue the corner guide, clearing the reaction a beat later.
    setFeedback({ value: selectedAnswer, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Resolve SYNCHRONOUSLY — score, celebration and the "?"→answer POP all land on the tap
    // (2026-08-02). They used to sit after `await`ing the spoken fact, which on this game meant a 1.09s
    // live synth + a 2.64s clip: the equation's answer didn't appear for ~4s and then the board changed
    // in the same frame, so the reveal and the confetti were never actually seen.
    if (isCorrect) {
      incrementScore()
      celebrateTier('micro') // light per-answer sparkle + soft "correct" SFX
      setRevealAnswer(true) // the equation's "?" flips to the answer (motion.POP)
    } else {
      // Wrong answers don't advance/punish (retry-until-right preserved); they only break this
      // problem's first-try flag (round streak/star accounting) + a gentle SFX. After the 2nd wrong
      // the correct tile pulses (never-fail hint) — the same scaffold every config quiz has; those
      // wrongs already broke first-try, so there is no extra star bookkeeping.
      firstAttemptRef.current = false
      sfx.play('wrong')
      registerHintWrong()
    }

    // Narration is FIRE-AND-FORGET alongside the dwell, never awaited (see theme/motion.ts). A correct
    // tap speaks the completed FACT ("tre plus fire er syv") — the reinforcement moment (PRD-05 P2);
    // a wrong tap echoes the tapped number (identification). Single audio channel, so the fact
    // REPLACES the echo, never stacks. The win/lose narration stays removed.
    if (isCorrect && correctAnswer !== null && num1 !== null && num2 !== null) {
      void audio.speak(factText(num1, num2, correctAnswer)).catch(() => {})
    } else {
      void audio.speakNumber(selectedAnswer).catch(() => {})
    }

    // Auto-advance after a short celebration window (correct only; wrong stays for retry).
    if (isCorrect) {
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        stopCelebration()

        // Bounded round: record the completed question, fire streak milestones, end or advance.
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
          celebrateTier('streak')
          mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
        }
        if (r.done) {
          finishRound(r.firstTryCorrect, r.longestStreak)
        } else {
          generateNewProblem()
        }
        // A fixed celebration window from the tap. The correct branch always speaks a sentence fact,
        // so it always gets DWELL_FACT — long enough that the next problem's prompt only cancels the
        // clip's trailing silence, never the spoken fact.
      }, DWELL_FACT)
    }
  }

  // Round ended → record to the progress store (stars/bests/stickers) and show the result hero.
  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      gameId,
      { correct: firstTryCorrect, total: round.length, longestStreak },
      // Svær tolerates 1 mistake for 3★ / 3 for 2★ — choosing a harder level must not cost stars
      // (Difficulty PRD-01 W6, mirroring the rule that XP is never difficulty-dependent).
      { starThresholds: starThresholdsFor(progressStore.difficultyFor('math')) },
    )
    setRoundOutcome(outcome)
  }

  // "Spil igen" → reset round + score and start a fresh round.
  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
    generateNewProblem()
  }

  const repeatProblem = async () => {
    if (num1 === null || num2 === null) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakProblem(num1, num2)
    } catch (error) {
      logError('Error repeating problem', { error: error?.toString() })
    }
  }

  const showEquation = gameReady && num1 !== null && num2 !== null && options.length > 0

  // DEV screenshot harness (?fx=correct|wrong): the forced equation-flip/tile state is DERIVED
  // (no setState-in-effect) so it's persistent and capturable — mirrors UnifiedQuizGame's
  // `tileStateFor`. No-op in production.
  const forcedFx = devFx()
  const fxWrongValue = forcedFx === 'wrong' ? options.find((o) => o !== correctAnswer) : undefined
  const effectiveRevealAnswer = revealAnswer || (forcedFx === 'correct' && showEquation && correctAnswer !== null)
  const effectiveHint = hintActive || forcedFx === 'hint'
  const effectiveFeedback: { value: number; correct: boolean } | null =
    forcedFx === 'correct' && showEquation && correctAnswer !== null
      ? { value: correctAnswer, correct: true }
      : forcedFx === 'wrong' && showEquation && fxWrongValue !== undefined
        ? { value: fxWrongValue, correct: false }
        : feedback

  // Big number styling inside the glossy "number sentence" card. The card is `tileSurface` — its top
  // stop is opaque #FFFFFF on EVERY skin, so the numbers sit on white regardless of scene. The old
  // `scene.dark ? '#FFFFFF'` branch was therefore white-on-white on dark skins; `onTileColor` is the
  // correct always-dark-on-white label (a no-op for accents that already read).
  const numberSx = {
    fontSize: { xs: '3rem', md: '4.2rem' },
    fontWeight: 800,
    color: category.onTileColor,
    lineHeight: 1,
    userSelect: 'none' as const,
    textShadow: 'none',
    '@media (orientation: landscape)': { fontSize: { xs: '2.4rem', md: '3.4rem' } },
    [PHONE_LANDSCAPE]: { fontSize: '1.3rem' },
  }
  // The `?`/answer SLOT. Sized for the revealed-answer chip (a bordered box around a 2.4rem numeral),
  // not for the glyph — so it stays as it was.
  const symbolSx = {
    width: { xs: 56, md: 80 },
    height: { xs: 56, md: 80 },
    '@media (orientation: landscape)': { width: { xs: 44, md: 64 }, height: { xs: 44, md: 64 } },
    [PHONE_LANDSCAPE]: { width: 26, height: 26 },
  }
  // The operators (`+ − =`), roughly half the numerals' font-size. Separate from `symbolSx` because
  // `SymbolTile`'s box now IS the rendered glyph: it used to deliver only ~39% of its box (the `=`
  // came out as a small blob), so re-using the slot size here would make the operators taller than
  // the numbers they sit between.
  const operatorSx = {
    width: { xs: 26, md: 36 },
    height: { xs: 26, md: 36 },
    '@media (orientation: landscape)': { width: { xs: 20, md: 28 }, height: { xs: 20, md: 28 } },
    [PHONE_LANDSCAPE]: { width: 12, height: 12 },
  }

  // Live difficulty: regenerate the current problem when the level changes in the adult menu
  // (no refresh). Skips the result screen + the initial mount.
  const difficultyLevel = useDifficulty('math')
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (roundOutcome || !gameReady) return
    generateNewProblem()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // The DndContext wraps the whole shell because the two halves of the gesture live in different
    // GameShell slots: the "?" droppable is inside `promptStage`, the draggable tiles are in
    // `children`. `MeasuringStrategy.Always` is mandatory — PromptFocus idle-floats, so a rect measured
    // once at drag start would judge the drop against a stale position (drag-and-drop.md).
    <DndContext
      sensors={sensors}
      collisionDetection={kidCollision}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearActive}
    >
    <GameShell
      categoryId="math"
      title={title}
      backRoute="/math"
      guideReaction={guideReaction}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      promptStage={
        roundOutcome ? undefined : (
          <PromptFocus
            accent={category.accentColor}
            chargeKey={`${num1}-${num2}-${round.state.index}`}
            repeat={
              showEquation ? (
                <MathRepeatButton onClick={repeatProblem} disabled={false} size={phoneLandscape ? 'small' : 'large'} />
              ) : undefined
            }
            subject={
              showEquation ? (
              // The equation "number sentence" now rests as CLAY on PromptFocus's light-pool (no
              // frosted card / no backdrop-filter). Re-materialed (PRD-08 §3.3): the hard 2px border
              // + customShadows.pop are gone — the clay tileSurface keeps a 1px hairline for
              // definition, a grounded softShadow() drop-shadow, and an inner-light top highlight,
              // matching the TactileTile chip material. The SymbolTile operators + big numerals stay.
              <Box
                sx={{
                  // One row: the number sentence alone on the clay tile (the ten-frame beneath it was
                  // removed — see the note above the component).
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1.25, md: 2 },
                  background: tileSurface(category.accentColor, muiTheme.scene.dark),
                  borderRadius: 4,
                  border: `1px solid ${hexToRgba(category.accentColor, muiTheme.scene.dark ? 0.4 : 0.26)}`,
                  px: { xs: 2.5, md: 4 },
                  py: { xs: 1.5, md: 2.5 },
                  filter: softShadow(muiTheme.scene.dark ? 1.6 : 1.2),
                  boxShadow: `inset 0 2px 3px ${hexToRgba('#FFFFFF', muiTheme.scene.dark ? 0.3 : 0.6)}`,
                  '@media (orientation: landscape)': { py: { xs: 1, md: 1.5 } },
                  [PHONE_LANDSCAPE]: { py: 0.25, px: 1, gap: 0.5 },
                }}
              >
                {/* num1 op num2 = ?→answer POP */}
                <Typography variant="h1" component="span" sx={numberSx}>{num1}</Typography>
                <SymbolTile op={operator} sx={operatorSx} />
                <Typography variant="h1" component="span" sx={numberSx}>{num2}</Typography>
                <SymbolTile op="=" sx={operatorSx} />

                {/* The "?" flips to the revealed answer with a motion.POP once correct (reduced
                    motion: instant swap — the colour/glow + SFX still land). It is also the DROP
                    TARGET for an answer tile: the slot the answer belongs in is the only honest place
                    to drop one. `overColor` transparent — the cue is the accent ring below, since a
                    white wash inside the clay tile just looks like a paint bug. */}
                <DroppableZone
                  id="answer-slot"
                  overColor="transparent"
                  style={{
                    borderRadius: '16px',
                    outline: overId === 'answer-slot' ? `4px solid ${category.accentColor}` : '4px solid transparent',
                    outlineOffset: '4px',
                    transition: 'outline-color 0.2s ease',
                  }}
                >
                <Box sx={{ ...symbolSx, position: 'relative' }}>
                  <AnimatePresence mode="wait" initial={false}>
                    {effectiveRevealAnswer && correctAnswer !== null ? (
                      <motion.div
                        key="answer"
                        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0, transition: EXIT_FAST }}
                        transition={motionOr(POP, reduce)}
                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: hexToRgba(muiTheme.palette.success.main, 0.2),
                            border: `3px solid ${muiTheme.palette.success.main}`,
                            boxShadow: muiTheme.customShadows.pop,
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 800,
                              lineHeight: 1,
                              color: darken(muiTheme.palette.success.main, 0.2),
                              fontSize: { xs: '1.7rem', md: '2.4rem' },
                              [PHONE_LANDSCAPE]: { fontSize: '0.85rem' },
                            }}
                          >
                            {correctAnswer}
                          </Typography>
                        </Box>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="question"
                        initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0, transition: EXIT_FAST }}
                        transition={motionOr(POP, reduce)}
                        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {/* 80% of the slot: the slot is sized for the answer chip, and the `?` glyph
                            now fills whatever box it's given, so 100% would make it taller than the
                            numerals beside it. */}
                        <SymbolTile op="?" sx={{ width: '80%', height: '80%' }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>
                </DroppableZone>
              </Box>
              ) : null
            }
          />
        )
      }
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="math"
          backRoute="/math"
          onReplay={handleReplay}
        />
      ) : (
      <>
      {/* Answer options — rise to the TOP of the answer zone beneath the equation (PRD-14 W1) so the
          tiles sit close under the prompt instead of hugging the bottom edge (kills the dead mid-band).
          Phone-landscape keeps its centred tiles (tight 30/70 split preserved). */}
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
          // Shared with UnifiedQuizGame (Difficulty PRD-01 W3): the columns + width envelope follow the
          // TILE COUNT, which is now 3 / 4 / 5 by level. Falls back to the level's own count before the
          // first problem exists so the zone never reflows on the first render.
          sx={answerGridSx(options.length || optionCountFor(gameId, difficultyLevel))}
        >
          {showEquation ? options.map((option, index) => (
            <motion.div
              key={`o${optionSeq.current}-${option}-${index}`}
              initial={{ opacity: 0, scale: 0.8 }}
              // Grabbed tile LIFTS, matching the Farver games' shared drag juice (§6C).
              animate={{ opacity: 1, scale: activeId === `opt-${option}` && !reduce ? 1.08 : 1 }}
              transition={{ delay: index * 0.08 }}
              style={{ height: '100%' }}
            >
              {/* Draggable wrapper, tap unchanged: AnswerTile keeps its own onClick (that is its press
                  animation + button semantics) and DraggableItem's capture-phase guard swallows the
                  trailing click of a real drag, so one gesture can never answer twice. `fill` because
                  the grid cell is what sizes the tile. */}
              <DraggableItem
                id={`opt-${option}`}
                inline
                fill
                disabled={isAdvancingRef.current}
                data={{ option }}
              >
              <AnswerTile
                onClick={() => handleAnswerClick(option)}
                accent={category.accentColor}
                state={(effectiveFeedback && effectiveFeedback.value === option ? (effectiveFeedback.correct ? 'correct' : 'wrong') : 'idle') as AnswerTileState}
                hint={effectiveHint && option === correctAnswer}
                // Tiles visibly stop responding once a correct answer is resolving (PRD-02). The
                // correct tap's setRevealAnswer/setFeedback re-render reads the just-set ref.
                disabled={isAdvancingRef.current}
              >
                <Typography
                  variant="h1"
                  component="span"
                  sx={{
                    fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
                    fontWeight: 700,
                    // Readable-on-white answer-tile numeral (onTileColor) — see CategoryTheme.onTileColor.
                    color: category.onTileColor,
                    userSelect: 'none',
                    lineHeight: 1,
                    '@media (orientation: landscape)': { fontSize: 'clamp(2rem, 6vw, 3.5rem)' },
                    [PHONE_LANDSCAPE]: { fontSize: '2rem' }
                  }}
                >
                  {option}
                </Typography>
              </AnswerTile>
              </DraggableItem>
            </motion.div>
          )) : null}
        </Box>
      </Box>
      </>
      )}
    </GameShell>
    </DndContext>
  )
}

export default MathOperationGame
