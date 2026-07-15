import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import GameShell from '../common/GameShell'
import AnswerTile, { type AnswerTileState } from '../common/AnswerTile'
import PromptStage from '../common/PromptStage'
import SymbolTile from '../common/SymbolTile'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { MathScoreChip } from '../common/ScoreChip'
import { getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { getDanishNumberText } from '../../config/danish-phrases'
import { MathRepeatButton } from '../common/RepeatButton'
import { useGameState } from '../../hooks/useGameState'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { isIOS } from '../../utils/deviceDetection'
import { useDifficulty } from '../../hooks/useDifficulty'
import { devFx } from '../../utils/devHarness'
import { BOUNCE, DWELL_CORRECT, motionOr } from '../../theme/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Sammenlign Tal — ONE consistent rule (Math Overhaul §3): two different quantities are shown and
// the child taps the bigger number's side. On a correct tap an animated krokodille >/< "mouth"
// springs open toward the chosen (bigger) number — "the mouth eats the bigger one" — reinforcing
// the symbol. Removed (vs the old game): the equality case, the largest/smallest/equal variance,
// and the long wrong-answer explanation path. No punishment: a wrong tap → gentle SFX + retry.
//
// UI/UX Overhaul PRD §6B: the krokodille is the star (enlarged) and lunges + its mouth chomps
// toward the bigger side (motion.BOUNCE + "chomp" SFX + mascot cheer) on a correct tap. The whole
// arena is raised into a top-anchored layout (PromptStage reused directly, not via GameShell's
// fixed slot — there's no separate "answer grid" here, the count-cards ARE the tappable answers)
// so the old dead gap above the container is gone.

const OBJECT_TYPES = [
  { name: 'æble', emoji: '🍎', danishName: 'æbler' },
  { name: 'ballon', emoji: '🎈', danishName: 'balloner' },
  { name: 'stjerne', emoji: '⭐', danishName: 'stjerner' },
  { name: 'blomst', emoji: '🌸', danishName: 'blomster' },
  { name: 'bil', emoji: '🚗', danishName: 'biler' },
  { name: 'bold', emoji: '⚽', danishName: 'bolde' },
  { name: 'fugl', emoji: '🐦', danishName: 'fugle' },
  { name: 'fisk', emoji: '🐟', danishName: 'fisk' }
]

const DANISH_NUMBERS = [
  'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti',
  'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve'
]

// Object-pile emoji size (PRD-05 P3). Shrinks as the count grows so a full pile of up to 20 fits
// its fixed-height box in EVERY viewport WITHOUT clipping — the shown quantity must always match
// the numeral (the old `overflow: hidden` + fixed size clipped high counts, so 18 could look like
// 20). Sizes are picked so the tightest layouts (phone-landscape's short box, narrow phone-portrait
// sides) still show every object. Returned as an sx object so it can carry the media overrides.
const emojiPileSx = (count: number) => ({
  lineHeight: 1,
  userSelect: 'none' as const,
  fontSize: count <= 8 ? '1.9rem' : count <= 14 ? '1.5rem' : '1.15rem',
  '@media (orientation: landscape)': {
    fontSize: count <= 8 ? '1.5rem' : count <= 14 ? '1.15rem' : '0.95rem',
  },
  [PHONE_LANDSCAPE]: { fontSize: count <= 10 ? '0.85rem' : '0.7rem' },
})

interface ComparisonProblem {
  leftNumber: number
  rightNumber: number
  leftObjects: typeof OBJECT_TYPES[0]
  rightObjects: typeof OBJECT_TYPES[0]
}

type Side = 'left' | 'right'
const COMPARE_PROMPT = 'Tryk på det største tal.'

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
  // The krokodille mouth opens toward the bigger number only after a correct tap.
  const [mouthOpen, setMouthOpen] = useState(false)
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({ componentId: 'ComparisonGame', autoInitialize: false })
  const hasInitialized = useRef(false)
  // Resilient start (mirrors UnifiedQuizGame): the board reveals once via revealBoard regardless of
  // which path triggers it, and the welcome plays at most once.
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  // True once the child taps → suppresses a (possibly late) welcome from talking over their play.
  const hasInteractedRef = useRef(false)

  // Centralized game state management
  const { incrementScore, resetScore, isScoreNarrating, handleScoreClick } = useGameState()

  // Bounded round + reward flow (Foundation §3). 8 questions, 3★ = no mistakes, 2★ ≤ 2.
  const round = useRound({ length: 8, starThresholds: { three: 0, two: 2 } })
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
  // False after unmount (PRD-02 P4): the advance timer is scheduled after the `await speakNumber`
  // echo, so this flag stops the post-await continuation from scheduling a ghost prompt if the child
  // navigates away during the echo. Owned by its own effect so StrictMode's dev remount restores it.
  const mountedRef = useRef(true)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 ComparisonGame: ${message}`, data)
    }
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Owns the mounted flag (PRD-02 P4, StrictMode-safe): true on (re)mount, false on unmount.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
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
    // Static, manual difficulty (UI/UX Overhaul PRD §5.7/Appendix A) — read fresh per problem.
    // 'normal' reproduces today's exact range/rule unchanged: two different numbers 1–20 (no
    // equality — one clear rule: tap the bigger).
    const level = progressStore.difficultyFor('math')
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

    let leftNum: number
    let rightNum: number

    if (level === 'let') {
      // Let: large gaps (≥8) so the bigger number is obvious.
      leftNum = randInt(1, 20)
      const farChoices: number[] = []
      for (let n = 1; n <= 20; n++) if (Math.abs(n - leftNum) >= 8) farChoices.push(n)
      rightNum = farChoices.length ? farChoices[randInt(0, farChoices.length - 1)] : (leftNum > 10 ? 1 : 20)
    } else if (level === 'svaer') {
      // Svær: close pairs (±1–2).
      leftNum = randInt(1, 20)
      const gap = randInt(1, 2)
      const sign = randInt(0, 1) === 0 ? -1 : 1
      const candidate = leftNum + sign * gap
      rightNum = candidate >= 1 && candidate <= 20 ? candidate : leftNum - sign * gap
    } else {
      // Normal (TODAY, unchanged).
      leftNum = randInt(1, 20)
      rightNum = randInt(1, 20)
      while (rightNum === leftNum) {
        rightNum = randInt(1, 20)
      }
    }

    // Distinct object types for visual clarity.
    const leftObjectType = OBJECT_TYPES[randInt(0, OBJECT_TYPES.length - 1)]
    let rightObjectType = OBJECT_TYPES[randInt(0, OBJECT_TYPES.length - 1)]
    while (rightObjectType === leftObjectType) {
      rightObjectType = OBJECT_TYPES[randInt(0, OBJECT_TYPES.length - 1)]
    }

    setCurrentProblem({
      leftNumber: leftNum,
      rightNumber: rightNum,
      leftObjects: leftObjectType,
      rightObjects: rightObjectType,
    })
    setChosen(null)
    setLocked(false)
    setMouthOpen(false)
    setGuideReaction(null)
    firstAttemptRef.current = true
    isAdvancingRef.current = false // release the advance-lock for the new problem

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
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
      { starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('math') },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    resetScore()
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

    // Engage the advance-lock + disable tiles SYNCHRONOUSLY on a correct tap — before the await
    // below — so a second tap in the same tick is already blocked.
    if (isCorrect) {
      isAdvancingRef.current = true
      setLocked(true)
    }

    setChosen({ side, correct: isCorrect })
    setGuideReaction(isCorrect ? 'cheer' : 'think')
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)

    // Speak the completed FACT on a correct tap ("sytten er større end ni") — the reinforcement
    // moment (PRD-05 P2). A wrong tap just echoes the tapped number. Single audio channel, so the
    // fact REPLACES the number echo, never stacks.
    try {
      if (isCorrect) {
        const bigger = Math.max(currentProblem.leftNumber, currentProblem.rightNumber)
        const smaller = Math.min(currentProblem.leftNumber, currentProblem.rightNumber)
        await audio.speak(`${getDanishNumberText(bigger)} er større end ${getDanishNumberText(smaller)}`)
      } else {
        await audio.speakNumber(tappedNumber)
      }
    } catch {
      // ignore number audio errors
    }

    // Navigated away during the echo → don't advance/celebrate (PRD-02 P4).
    if (!mountedRef.current) return

    if (isCorrect) {
      // (advance-lock + setLocked already engaged synchronously above)
      setMouthOpen(true) // krokodille chomps toward the bigger number
      incrementScore()
      celebrateTier('micro')
      sfx.play('chomp')

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
      }, DWELL_CORRECT()) // unified celebration/advance dwell
    } else {
      // Gentle, non-punishing: break the first-try flag, soft SFX, the mouth stays shut, retry.
      firstAttemptRef.current = false
      sfx.play('wrong')
      setTimeout(() => setChosen(null), 900)
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

  // DEV screenshot harness (?fx=correct|wrong): the forced chomp/tile state is DERIVED (no
  // setState-in-effect) so it's persistent and capturable — mirrors UnifiedQuizGame's
  // `tileStateFor`. No-op in production.
  const forcedFx = devFx()
  const biggerSideForced: Side | null = currentProblem
    ? (currentProblem.leftNumber > currentProblem.rightNumber ? 'left' : 'right')
    : null
  const effectiveChosen: { side: Side; correct: boolean } | null =
    forcedFx === 'correct' && biggerSideForced
      ? { side: biggerSideForced, correct: true }
      : forcedFx === 'wrong' && biggerSideForced
        ? { side: (biggerSideForced === 'left' ? 'right' : 'left') as Side, correct: false }
        : chosen
  const effectiveMouthOpen = mouthOpen || (forcedFx === 'correct' && !!currentProblem)

  const sideState = (side: Side): AnswerTileState =>
    effectiveChosen && effectiveChosen.side === side ? (effectiveChosen.correct ? 'correct' : 'wrong') : 'idle'

  // The comparison symbol: > if left is bigger, < if right is bigger.
  const mouthOp: '>' | '<' | null = currentProblem
    ? currentProblem.leftNumber > currentProblem.rightNumber ? '>' : '<'
    : null

  const renderSide = (side: Side) => {
    if (!currentProblem) return null
    const num = side === 'left' ? currentProblem.leftNumber : currentProblem.rightNumber
    const obj = side === 'left' ? currentProblem.leftObjects : currentProblem.rightObjects
    return (
      <Box sx={{ minHeight: { xs: 180, md: 230 }, '@media (orientation: landscape)': { minHeight: { xs: 120, md: 150 } }, [PHONE_LANDSCAPE]: { minHeight: 96 } }}>
        <AnswerTile
          onClick={() => handleSideClick(side)}
          accent={category.accentColor}
          state={sideState(side)}
          disabled={locked}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, width: '100%' }}>
            {/* Objects — a fixed-height pile that always shows EXACTLY `num` objects (never clipped),
                so the visible quantity order-matches the numeral (PRD-05 P3). alignContent centres
                the wrapped rows; the emoji size (emojiPileSx) shrinks with the count so even 20 fit. */}
            <Box sx={{
              height: { xs: 104, md: 128 },
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              alignContent: 'center',
              gap: '3px',
              '@media (orientation: landscape)': { height: { xs: 56, md: 76 } },
              [PHONE_LANDSCAPE]: { height: 34 }
            }}>
              {Array.from({ length: num }, (_, i) => (
                <Box
                  component={motion.span}
                  key={i}
                  initial={reduce ? false : { opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: reduce ? 0 : i * 0.05 }}
                  sx={emojiPileSx(num)}
                >
                  {obj.emoji}
                </Box>
              ))}
            </Box>
            {/* Numeral */}
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '3rem', md: '4rem' },
                fontWeight: 700,
                color: category.accentColor,
                lineHeight: 1,
                '@media (orientation: landscape)': { fontSize: { xs: '2rem', md: '2.8rem' } },
                [PHONE_LANDSCAPE]: { fontSize: '1.6rem' }
              }}
            >
              {num}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, '@media (orientation: landscape)': { fontSize: '0.7rem' } }}>
              {DANISH_NUMBERS[num]} {obj.danishName}
            </Typography>
          </Box>
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
      score={<MathScoreChip answered={round.state.index} total={round.length} disabled={isScoreNarrating} onClick={handleScoreClick} />}
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
            minHeight: 0,
            // Top-anchored layout (§6B): the arena sits right under the title instead of vertically
            // centred with a dead gap above it — PromptStage still supplies the frame/charge-in/
            // idle float, it's just placed here directly (there's no separate answer grid; the
            // count-cards below ARE the tappable answers).
            justifyContent: 'flex-start',
            gap: { xs: 0.75, md: 1.25 },
            [PHONE_LANDSCAPE]: { gap: 0.5 },
          }}
        >
          {/* Prompt */}
          <Typography
            sx={{
              flex: '0 0 auto',
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '1.05rem', md: '1.35rem' },
              color: muiTheme.scene.dark ? '#FFFFFF' : category.accentColor,
              textShadow: muiTheme.scene.dark ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
              textAlign: 'center',
              [PHONE_LANDSCAPE]: { fontSize: '0.85rem' },
            }}
          >
            Tryk på det største tal 👆
          </Typography>

          <Box sx={{ flex: '1 1 auto', minHeight: 0, width: '100%', maxWidth: 860, display: 'flex' }}>
            <PromptStage
              accent={category.accentColor}
              chargeKey={`${currentProblem.leftNumber}-${currentProblem.rightNumber}-${round.state.index}`}
              repeat={<MathRepeatButton onClick={repeatProblem} disabled={false} />}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, md: 2.5 }, width: '100%' }}>
                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>{renderSide('left')}</Box>

                {/* Krokodille: the star. It lunges + its mouth chomps toward the bigger side on a
                    correct tap (motion.BOUNCE). Reduced motion: instant — SFX + mascot still fire. */}
                <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                  <Box
                    component={motion.div}
                    animate={
                      effectiveMouthOpen && mouthOp
                        ? { x: mouthOp === '>' ? [0, -24, 0] : [0, 24, 0], scale: [1, 1.25, 1] }
                        : { x: 0, scale: 1 }
                    }
                    transition={motionOr(BOUNCE, reduce)}
                    sx={{
                      fontSize: { xs: '3.6rem', md: '5.5rem' },
                      lineHeight: 1,
                      // The iPad verification viewport is landscape — this override is what's
                      // actually seen there, so the krokodille is sized generously here too.
                      '@media (orientation: landscape)': { fontSize: { xs: '3.4rem', md: '6.4rem' } },
                      [PHONE_LANDSCAPE]: { fontSize: '2.3rem' },
                    }}
                  >
                    🐊
                  </Box>
                  <Box
                    sx={{
                      height: { xs: 52, md: 76 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '@media (orientation: landscape)': { height: { xs: 48, md: 92 } },
                      [PHONE_LANDSCAPE]: { height: 34 },
                    }}
                  >
                    {effectiveMouthOpen && mouthOp && (
                      <Box
                        component={motion.div}
                        initial={reduce ? false : { scale: 0, rotate: mouthOp === '>' ? 30 : -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={motionOr(BOUNCE, reduce)}
                      >
                        <SymbolTile
                          op={mouthOp}
                          sx={{
                            width: { xs: 52, md: 76 },
                            height: { xs: 52, md: 76 },
                            '@media (orientation: landscape)': { width: { xs: 48, md: 92 }, height: { xs: 48, md: 92 } },
                            [PHONE_LANDSCAPE]: { width: 32, height: 32 },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>

                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>{renderSide('right')}</Box>
              </Box>
            </PromptStage>
          </Box>
        </Box>
      ) : null}
    </GameShell>
  )
}

export default ComparisonGame
