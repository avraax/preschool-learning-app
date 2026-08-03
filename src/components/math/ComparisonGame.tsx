import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { AnimatePresence, motion } from 'framer-motion'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import SymbolTile from '../common/SymbolTile'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { getCategoryTheme } from '../../config/categoryThemes'
import { COMPARE_PROMPT, comparisonFactText } from '../../config/gamePhrases'
import { starThresholdsFor } from '../../config/difficulty'
import { makeComparisonPair } from '../../config/mathProblems'
import { MathRepeatButton } from '../common/RepeatButton'
import { useRound } from '../../hooks/useRound'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { isIOS } from '../../utils/deviceDetection'
import { useDifficulty } from '../../hooks/useDifficulty'
import { devFx } from '../../utils/devHarness'
import {
  CHARGE,
  CHARGE_IN_OPACITY,
  CHARGE_IN_SCALE,
  DWELL_FACT,
  EXIT_FAST,
  POP,
  motionOr,
} from '../../theme/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { MASCOT_CORNER_PHONE_PORTRAIT, MASCOT_CORNER_SIZE } from '../common/mascotCorner'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Sammenlign Tal — ONE consistent rule (Math Overhaul §3): two different numbers are shown and the
// child taps the bigger one. Removed (vs the old game): the equality case, the
// largest/smallest/equal variance, and the long wrong-answer explanation path. No punishment: a
// wrong tap → gentle SFX + retry, and after 2 wrongs the correct tile pulses (never-fail hint).
//
// The board is a NUMBER SENTENCE, matching Plus/Minus Opgaver's `a + b = ?` grammar: `2 [?] 8` while
// the question stands, resolving to `2 [<] 8` on the correct tap — the winning tile pops and stays
// lit, the other recedes, and the spoken fact says the same thing out loud. The two numerals ARE the
// answer tiles, so the arena IS the whole game body: two tiles as large as the board allows, with the
// symbol slot between them. Numerals are sized in container-query units off each tile, not from a
// breakpoint ladder, so phone landscape follows by derivation.
//
// Two things were REMOVED here on 2026-08-03 (owner) and should not come back:
//   · **The krokodille.** It was meant to teach `>`/`<` as a mouth eating the bigger number, and did
//     the opposite: the art is a mouth-CLOSED side profile that was never mirrored, so with the
//     bigger number on the left it lunged tail-first at it — the mnemonic taught backwards on half of
//     all questions. It also rendered at ~a third of its nominal size (512×205 of ink on a 606² canvas,
//     sized by height) and sat 30px above the tiles' centre line, because the middle column reserved
//     92px for a symbol that only appeared after the answer. The symbol slot now carries the meaning.
//   · **`PromptFocus`.** This was the app's only game that rendered it OUTSIDE GameShell's
//     `promptStage` slot, so instead of the 40% band it stretched over the whole body: a 512px focal
//     zone holding a 114px answer tile (78% empty), "Hør igen" stranded at the viewport bottom, and a
//     centred circular light-pool wide enough to read as a magenta smudge on light skins. Each tile is
//     grounded by TactileTile's own contact shadow instead; the per-question charge-in beat PromptFocus
//     used to supply is re-applied to the arena row here.
//
// The tiles show NUMERALS ONLY (2026-08-01, owner) — the counted object piles were removed, so reading
// the numerals is the only way through. Don't re-add a countable layer, and don't let tile SIZE encode
// the values either: that would hand over the answer the same way the piles did.

interface ComparisonProblem {
  leftNumber: number
  rightNumber: number
}

type Side = 'left' | 'right'

// The symbol slot's inner layers. The AnimatePresence child must carry a definite width or the
// percentage-sized glyph inside it has nothing to resolve against (framer takes a raw `style`, not sx).
const SLOT_LAYER: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
// Square, filling the slot's width — SymbolTile's ink correction assumes a square box.
const SLOT_GLYPH = { width: '100%', height: 'auto', aspectRatio: '1' } as const
// The prompt + the correct-answer fact come from the shared builders (src/config/gamePhrases.ts),
// which the prebake enumerator also calls — so the played text and the baked clip can't drift.
const comparisonFact = comparisonFactText

const ComparisonGame: React.FC = () => {
  const reduce = useReducedMotion()
  const muiTheme = useTheme()
  const category = getCategoryTheme('math')
  const [currentProblem, setCurrentProblem] = useState<ComparisonProblem | null>(null)
  // Most-recently tapped side + whether it was correct (drives the side AnswerTile glow/shake).
  const [chosen, setChosen] = useState<{ side: Side; correct: boolean } | null>(null)
  // True while a correct answer is being processed/advancing (taps disabled). Wrong taps stay
  // re-enabled so the child can retry.
  const [locked, setLocked] = useState(false)
  // The middle slot holds `?` until a correct tap, then the resolved `>`/`<`.
  const [revealSymbol, setRevealSymbol] = useState(false)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  // Never-fail hint: after 2 wrong taps the correct tile pulses (reduced-motion → static glow, owned
  // by TactileTile). Resets per question. Like Stav Ordet, this game doesn't nudge the mascot on hint.
  const { hint: hintActive, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<boolean>(2)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({ componentId: 'ComparisonGame', autoInitialize: false })
  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame): the board reveals once via revealBoard regardless of
  // which path triggers it, and the welcome plays at most once.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  // True once the child taps → suppresses a (possibly late) welcome from talking over their play.
  const hasInteractedRef = useRef(false)

  // Bounded round + reward flow (Foundation §3). 8 questions; star thresholds come from the difficulty
  // spine at finish time (Difficulty PRD-01 W6).
  const round = useRound({ length: 8, gameId: 'math.comparison' })
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // The post-correct celebration/advance timer (PRD-02 P1/P4) — tracked so it's cleared on unmount
  // (no ghost prompt on the next screen) and never runs twice.
  const advanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Advance-lock (PRD-02 P1): the `locked` state disables tiles, but it's async — a second tap in
  // the same tick reads stale `locked=false`. This ref is set synchronously on a correct tap so the
  // guard closes the same-tick double-tap window that `locked` alone leaves open.
  const isAdvancingRef = useRef(false)
  const guideReactionTimer = useRef<NodeJS.Timeout | null>(null)
  // Clears the wrong-tap tile feedback. Tracked like every other timer so nothing fires post-unmount.
  const wrongResetTimer = useRef<NodeJS.Timeout | null>(null)
  // (PRD-02 P4's `mountedRef` is gone as of 2026-08-02: the tap handler no longer awaits narration, so
  // the advance timer is created synchronously and the unmount cleanup always has it to clear.)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const logError = (message: string, data?: unknown) => {
    console.error(`🎵 ComparisonGame: ${message}`, data)
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the first problem immediately (tappable), no waiting on the welcome.
    revealBoard()

    // Narrate the welcome over the visible board if audio is already unlocked.
    if (audio.isAudioReady) {
      playWelcomeThenPrompt()
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
      if (wrongResetTimer.current) {
        clearTimeout(wrongResetTimer.current)
        wrongResetTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When audio unlocks after mount, play the welcome (board already visible). Interaction-guarded
  // inside playWelcomeThenPrompt so it never talks over active play.
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // Instant load: render the first problem RIGHT AWAY without voicing the prompt yet — the welcome
  // narrates over the visible board and the spoken prompt follows it. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    generateNewProblem(false)
  }

  // Play the welcome over the already-visible board, then voice the prompt. Self-guards; skips the
  // trailing prompt if the child already started tapping.
  const playWelcomeThenPrompt = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('comparison')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (!hasInteractedRef.current) speakProblem()
  }

  // `voice=false` renders the board without voicing the prompt (used for the first problem, which
  // is voiced after the welcome instead).
  const generateNewProblem = (voice = true) => {
    // Static, manual difficulty — read fresh per problem, generated by a PURE function
    // (src/config/mathProblems.ts). This game is **exempt from the tile axis only** (the mechanic is two
    // numbers): the GAP is its axis. Let 1–10 with a gap ≥5 · Normal 1–20 with a gap ≥3 · Svær 1–20,
    // gap 1–2. Never equal — one clear rule: tap the bigger.
    const level = progressStore.difficultyFor('math')
    const { left: leftNum, right: rightNum } = makeComparisonPair(level)

    setCurrentProblem({ leftNumber: leftNum, rightNumber: rightNum })
    // Warm this problem's fact line NOW, while the child is still comparing. Every comparison fact IS
    // prebaked (`comparisonPairs()` enumerates all 190), so this resolves to prefetching the static
    // mp3 rather than a synth — cheap, and it keeps working if the range ever outruns the baked set.
    // Plays nothing, cancels nothing.
    audio.warmSpeech(comparisonFact(Math.max(leftNum, rightNum), Math.min(leftNum, rightNum)))
    setChosen(null)
    setLocked(false)
    setRevealSymbol(false)
    setGuideReaction(null)
    resetHint()
    firstAttemptRef.current = true
    isAdvancingRef.current = false // release the advance-lock for the new problem

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (wrongResetTimer.current) {
      clearTimeout(wrongResetTimer.current)
      wrongResetTimer.current = null
    }
    if (!voice) return
    const delay = isIOS() ? 100 : 500
    timeoutRef.current = setTimeout(() => speakProblem(), delay)
  }

  const speakProblem = async () => {
    try {
      audio.updateUserInteraction()
      await audio.speak(COMPARE_PROMPT)
    } catch (error) {
      logError('Error speaking problem', { error: error?.toString() })
    }
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'math.comparison',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: starThresholdsFor(progressStore.difficultyFor('math')) },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    generateNewProblem()
  }

  const handleSideClick = async (side: Side) => {
    // Advance-lock (PRD-02 P1): the ref closes the same-tick double-tap window that the async
    // `locked` state leaves open (a second tap reads stale `locked=false` before React re-renders).
    if (!currentProblem || locked || isAdvancingRef.current) return
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true

    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    // Every tap is felt: a soft tick synced to the press (separate SFX channel, never TTS) —
    // matching UnifiedQuizGame so the interaction language is consistent app-wide.
    sfx.play('tap')

    const biggerSide: Side =
      currentProblem.leftNumber > currentProblem.rightNumber ? 'left' : 'right'
    const isCorrect = side === biggerSide
    const tappedNumber = side === 'left' ? currentProblem.leftNumber : currentProblem.rightNumber

    // Engage the advance-lock + disable tiles SYNCHRONOUSLY on a correct tap so a second tap in the
    // same tick is already blocked.
    if (isCorrect) {
      isAdvancingRef.current = true
      setLocked(true)
    }

    setChosen({ side, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Narration is FIRE-AND-FORGET alongside the dwell, never awaited (see theme/motion.ts). A correct
    // tap speaks the completed FACT ("sytten er større end ni") — the reinforcement moment (PRD-05 P2);
    // a wrong tap echoes the tapped number. Single audio channel, so the fact REPLACES the echo.
    if (isCorrect) {
      const bigger = Math.max(currentProblem.leftNumber, currentProblem.rightNumber)
      const smaller = Math.min(currentProblem.leftNumber, currentProblem.rightNumber)
      void audio.speak(comparisonFact(bigger, smaller)).catch(() => {})
    } else {
      void audio.speakNumber(tappedNumber).catch(() => {})
    }

    if (isCorrect) {
      // Resolve SYNCHRONOUSLY — the reveal and celebration land on the tap instead of after the spoken
      // fact finished (2026-08-02). `celebrateTier` fires the tier's own SFX cue, so there is no second
      // sfx.play here: the old `sfx.play('chomp')` was a cue stacked on top of it that no other game
      // has (and it was aliased to the drag-and-drop snap anyway).
      setRevealSymbol(true) // `?` → the resolved `>`/`<`, completing the sentence
      celebrateTier('micro')

      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null
        stopCelebration()
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
    } else {
      // Gentle, non-punishing: break the first-try flag, soft SFX, `?` stays put, retry. After the
      // 2nd wrong the correct tile pulses (never-fail hint) — those wrongs already broke first-try, so
      // there's no extra star bookkeeping.
      firstAttemptRef.current = false
      sfx.play('wrong')
      registerHintWrong()
      if (wrongResetTimer.current) clearTimeout(wrongResetTimer.current)
      wrongResetTimer.current = setTimeout(() => {
        wrongResetTimer.current = null
        setChosen(null)
      }, 900)
    }
  }

  const repeatProblem = async () => {
    if (!currentProblem) return
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    try {
      await speakProblem()
    } catch (error) {
      logError('Error repeating problem', { error: error?.toString() })
    }
  }

  // DEV screenshot harness (?fx=correct|wrong|hint): the forced tile/symbol state is DERIVED (no
  // setState-in-effect) so it's persistent and capturable — mirrors UnifiedQuizGame's
  // `tileStateFor`. No-op in production.
  const forcedFx = devFx()
  const biggerSide: Side | null = currentProblem
    ? (currentProblem.leftNumber > currentProblem.rightNumber ? 'left' : 'right')
    : null
  const effectiveChosen: { side: Side; correct: boolean } | null =
    forcedFx === 'correct' && biggerSide
      ? { side: biggerSide, correct: true }
      : forcedFx === 'wrong' && biggerSide
        ? { side: (biggerSide === 'left' ? 'right' : 'left') as Side, correct: false }
        : chosen
  const effectiveReveal = revealSymbol || (forcedFx === 'correct' && !!currentProblem)
  const effectiveHint = hintActive || forcedFx === 'hint'

  const sideState = (side: Side): AnswerTileState =>
    effectiveChosen && effectiveChosen.side === side ? (effectiveChosen.correct ? 'correct' : 'wrong') : 'idle'

  // The comparison symbol: > if left is bigger, < if right is bigger.
  const compareOp: '>' | '<' | null = currentProblem
    ? currentProblem.leftNumber > currentProblem.rightNumber ? '>' : '<'
    : null

  // The tile that LOST recedes once the sentence is complete, so the eye lands on the bigger number.
  // Opacity only under reduced motion (the verdict still reads — colour + ring do the work).
  const recede = (side: Side) =>
    effectiveReveal && biggerSide !== null && side !== biggerSide
      ? reduce ? { opacity: 0.5 } : { opacity: 0.5, scale: 0.94 }
      : { opacity: 1, scale: 1 }

  const renderSide = (side: Side) => {
    if (!currentProblem) return null
    const num = side === 'left' ? currentProblem.leftNumber : currentProblem.rightNumber
    return (
      <Box
        component={motion.div}
        animate={recede(side)}
        transition={motionOr(POP, reduce)}
        sx={{
          // The tile fills this track in BOTH axes — no aspect-ratio, which in a no-scroll column gets
          // clipped and grows upward over its neighbours (see responsive-design.md). `containerType`
          // makes the tile its own query container so the numeral below can size off it.
          flex: '1 1 0',
          minWidth: 0,
          minHeight: 0,
          maxWidth: { xs: 260, md: 290 },
          containerType: 'size',
        }}
      >
        <AnswerTile
          onClick={() => handleSideClick(side)}
          accent={category.accentColor}
          state={sideState(side)}
          hint={effectiveHint && side === biggerSide}
          disabled={locked}
        >
          {/* The NUMERAL is the whole tile (2026-08-01, owner). The object pile that used to sit above
              it was removed: comparing two piles of blobs let the child win without ever reading the
              numerals, which is the skill this game teaches.
              (The "{n} {word}" caption went earlier, PRD-14 W5 — unreadable for a pre-reader.) */}
          <Typography
            variant="h1"
            sx={{
              // Derived from the TILE, not a breakpoint ladder: `cqw` is the binding constraint for a
              // two-digit number (up to 20, so never wider than ~1.1em), `cqh` for a short tile, so
              // `min()` of the two always fits and every viewport — including phone landscape —
              // follows without its own override. Container query units are Safari 16+, safe on the
              // iOS 17 floor.
              //
              // Equal coefficients, so this is simply **52% of the tile's SHORTER side** — one rule
              // instead of two tuned numbers, and it can't be read as independent of the tile caps
              // above (it isn't: change a cap and the numeral moves with it). ~114px at iPad landscape,
              // which is where the owner landed after 281px and 177px both read as too big.
              // A two-digit number is ~1.1em of digit advance = ~57% of the tile's shorter side, so it
              // still clears the tile's ~16px padding on the narrowest tile the app produces
              // (phone portrait, ~141px wide).
              fontSize: 'min(52cqh, 52cqw)',
              fontWeight: 700,
              // Readable-on-white numeral (onTileColor) — see CategoryTheme.onTileColor.
              color: category.onTileColor,
              lineHeight: 1,
            }}
          >
            {num}
          </Typography>
        </AnswerTile>
      </Box>
    )
  }

  // Live difficulty: regenerate the current problem when the level changes in the adult menu
  // (no refresh). Skips the result screen + the initial mount.
  const difficultyLevel = useDifficulty('math')
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (roundOutcome || !currentProblem) return
    generateNewProblem()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell
      categoryId="math"
      title="Sammenlign Tal"
      backRoute="/math"
      guideReaction={guideReaction}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="math"
          backRoute="/math"
          onReplay={handleReplay}
        />
      ) : currentProblem ? (
        <Box
          sx={{
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            // Centred: the arena IS the game body (two tiles + the symbol slot), so there is no focal
            // band to anchor to and no answer grid below. Any slack splits above and below the board.
            justifyContent: 'center',
            minHeight: 0,
            gap: { xs: 1, md: 2 },
            // RESERVE the corner companion's band as padding on the whole column, so the board can
            // never reach into it (.claude/rules/responsive-design.md — reserve the space, don't tune a
            // percentage). Two honest notes:
            //   · The 94×34px overlap that motivated this was measured against the FIRST pass's
            //     442px-tall tiles. At the shipped ~220px it no longer reproduces (re-broken: setting
            //     `pb: 0` keeps the layout probe green), so this is DEFENSIVE — it is what keeps a
            //     future cap increase from silently re-introducing the overlap.
            //   · It still earns its place compositionally: reserving the band lifts the whole board
            //     ~60px, closing the gap that otherwise opens between the title and the arena.
            // As PADDING rather than a tall bottom row: the row would be 120px holding a 48px pill,
            // which pushed the whole board down away from the title.
            //
            // NB the explicit `px` — `pb` is a SPACING prop, so `pb: 120` is 120 × the 8px unit = 960px
            // (unlike `width: 120`, which is 120px). Passing the raw constant collapsed the tiles to
            // TactileTile's 44px floor and pushed them off the top of the screen.
            pb: { xs: `${MASCOT_CORNER_SIZE.xs}px`, md: `${MASCOT_CORNER_SIZE.md}px` },
            [PHONE_PORTRAIT]: { pb: `${MASCOT_CORNER_PHONE_PORTRAIT}px` },
            [PHONE_LANDSCAPE]: { gap: 0.5, pb: 0 }, // companion is hidden in phone landscape
          }}
        >
          {/* Prompt */}
          <Typography
            sx={{
              flex: '0 0 auto',
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '1.05rem', md: '1.35rem' },
              // Prompt text: white on dark scenes, readable-on-white accent on light scenes.
              color: muiTheme.scene.dark ? '#FFFFFF' : category.onTileColor,
              textShadow: muiTheme.scene.dark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
              textAlign: 'center',
              [PHONE_LANDSCAPE]: { fontSize: '0.85rem' },
            }}
          >
            Tryk på det største tal
          </Typography>

          {/* The arena: `2 [?] 8`. Charges in per question — the anticipation beat PromptFocus used to
              supply, re-applied here on the same shared constants. */}
          <Box
            component={motion.div}
            key={`${currentProblem.leftNumber}-${currentProblem.rightNumber}-${round.state.index}`}
            initial={reduce ? false : { opacity: 0, scale: CHARGE_IN_SCALE[0] }}
            animate={reduce ? {} : { opacity: [...CHARGE_IN_OPACITY], scale: [...CHARGE_IN_SCALE] }}
            transition={reduce ? undefined : CHARGE}
            sx={{
              flex: '1 1 auto',
              minHeight: 0,
              // Capped so the tiles read as two CARDS rather than two slabs filling the screen. Settled
              // at ~290×220 on iPad landscape over three owner passes (2026-08-03): 396×370, then
              // 340×260, then this. The column centres whatever is left over, so the world stays
              // visible above and below the board — leftover sky is fine, a 396×114 letterbox was not.
              //
              // PORTRAIT gets a taller cap, because there the tiles are also NARROWER (~276px at iPad
              // portrait): a flat landscape cap left a card pair filling 32% of an 820px column, i.e.
              // the void this rework exists to close, back in a milder form.
              maxHeight: 300,
              '@media (orientation: landscape)': { maxHeight: 220 },
              width: '100%',
              maxWidth: 1000,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              gap: { xs: 1, md: 2.5 },
              [PHONE_LANDSCAPE]: { gap: 0.75 },
              // Deliberately NO extra cap for phone portrait, where two side-by-side tiles can only be
              // ~137px wide and the pair therefore comes out ~1:2.8. A width-tied cap was tried and
              // reverted: the numeral is bound by `cqw` at that width, so shrinking the height buys a
              // tidier aspect ratio and nothing else, while making the tap target smaller.
            }}
          >
            {renderSide('left')}

            {/* The symbol slot — the middle of the number sentence, and the only thing between the two
                numbers now. It is ALWAYS occupied (`?` while the question stands), which is what keeps
                the row optically centred: the old layout reserved this space for a symbol that only
                appeared after the answer, so the croc above it sat 30px high of the tiles' centre. */}
            <Box
              sx={{
                flex: '0 0 auto',
                width: { xs: 52, md: 96 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                [PHONE_LANDSCAPE]: { width: 44 },
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {effectiveReveal && compareOp ? (
                  <motion.div
                    key="op"
                    initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    // TWEEN on exit, never a spring: `mode="wait"` holds the incoming element until the
                    // outgoing one finishes, and a spring on opacity takes ~1s to settle.
                    exit={{ opacity: 0, transition: EXIT_FAST }}
                    transition={motionOr(POP, reduce)}
                    style={SLOT_LAYER}
                  >
                    <SymbolTile op={compareOp} sx={SLOT_GLYPH} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="unknown"
                    initial={reduce ? false : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0, transition: EXIT_FAST }}
                    transition={motionOr(POP, reduce)}
                    style={SLOT_LAYER}
                  >
                    <SymbolTile op="?" sx={SLOT_GLYPH} />
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            {renderSide('right')}
          </Box>

          {/* "Hør igen" sits directly under the arena — it used to ride PromptFocus's repeat slot, which
              (stretched over the whole body) stranded it at the bottom of the viewport. Disabled during
              the advance window so it can't cancel the spoken fact mid-beat. */}
          <Box sx={{ flex: '0 0 auto' }}>
            <MathRepeatButton onClick={repeatProblem} disabled={locked} />
          </Box>
        </Box>
      ) : null}
    </GameShell>
  )
}

export default ComparisonGame
