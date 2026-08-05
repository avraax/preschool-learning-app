import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { getCategoryTheme } from '../../config/categoryThemes'
import {
  COLOR_SWATCH,
  COLORS_QUIZ_ROUND,
  HUE_ORDER,
  adjacentHues,
  spokenColor,
  type QuizObject,
} from '../../config/colorContent'
import { COLORS_QUIZ, starThresholdsFor } from '../../config/difficulty'
import { colorObjectFactText } from '../../config/gamePhrases'
import { colorQuizPromptPool, quizObjectKey } from '../../config/promptPools'
import { usePromptBag } from '../../hooks/usePromptBag'
import { hexToRgba } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { SNAP } from '../../theme/motion'
import { idleFloat } from '../../theme/idleMotion'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { ColorRepeatButton } from '../common/RepeatButton'
import { useRound } from '../../hooks/useRound'
import { useDifficulty } from '../../hooks/useDifficulty'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { isIOS } from '../../utils/deviceDetection'
import { shuffle } from '../../utils/shuffle'
import { devFx } from '../../utils/devHarness'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { useDragActive } from '../common/dnd/useDragActive'
import ObjectArt from './farverArt'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Hvilken Farve? — drag an object onto the matching COLOR. A wrong color bounces the object back
// (gentle SFX); after the level's `hintAfter` wrong drops the correct color pulses and is NAMED
// (never-fail hint, costs a star). Bounded round of 8 → RoundResultScreen. Static difficulty. Keeps
// the section's drag language (Farvejagt/Ram Farven/Nuancer are all dnd-kit).
//
// **The object is ALWAYS DESATURATED — at every Sværhedsgrad, with no axis that can undo it**
// (Difficulty PRD-02, owner 2026-08-05). That is what makes this a colour game rather than a pixel
// match: shown in its true colour, the fox's orange is already on the board next to an orange swatch,
// so the child never needs the word — the same "a board must not restate its own answer" defect the
// owner removed from Tal Quiz and from Bogstav Quiz's old hear-the-letter mode. PRD-01 confined the
// visible version to Let as "the youngest child's winnable tier"; that was still the giveaway, so the
// `reveal` axis is gone rather than narrowed. Greyed, "Hvilken farve er ræven?" is the real question,
// the spoken echo ("ræven er orange") teaches instead of narrating, and the colour comes BACK — only —
// on the copy that lands in the right swatch. Never re-condition the `desaturate` prop on a level.
//
// Let is eased on axes that leak nothing instead: the smaller `pool` (12 unambiguous subjects — see
// `obvious` in colorContent), 3 swatches, distractor hues off the answer's wheel neighbours, and the
// naming hint after ONE wrong drop. Non-canonical subjects (a car, a shirt) are askable nowhere.
//
// UI/UX Overhaul §6C: shared drag juice — grab = lift + 'pick-up' SFX; a swatch breathes while a
// compatible item hovers it; a correct swatch ABSORBS the object (scale-in + splash); a wrong drop
// springs back + 'spring-back' SFX. Reduced motion keeps colour/glow + SFX, drops the travel.

// Round length, option count, hue policy, object pool and the hint threshold all come from config
// (Difficulty PRD-01 §4.5 + PRD-02): Let 3 swatches / non-adjacent hues / obvious pool / hint after 1
// · Normal 4 / random / all 18 / 2 · Svær 5 / wheel-adjacent only / all 18 / 2.

const FarveQuizGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  // The prompt object's resting float (PRD-01 W1: CSS keyframes, not a framer loop). `lifted` stands
  // it down so the drag's spring owns the transform on its own.
  const objectFloat = (lifted: boolean) => idleFloat(reduce || lifted, { distance: 6, durationS: 1.6 })
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()

  const [current, setCurrent] = useState<QuizObject | null>(null)
  const [options, setOptions] = useState<string[]>([])   // candidate color names
  const [solvedColor, setSolvedColor] = useState<string | null>(null) // the color it landed in (correct)
  const [shakeColor, setShakeColor] = useState<string | null>(null)
  // Live difficulty (read here, above the hint hook, because the hint THRESHOLD is per-level now).
  // The regenerate-on-change effect lives at the bottom of the component.
  const difficultyLevel = useDifficulty('colors')
  // Never-fail hint: after the level's `hintAfter` wrong drops on the current question, the correct
  // color pulses and is named. `hintColor` holds that color name (or null). Reset per question (see
  // setupQuestion). `useNeverFailHint` lists `threshold` in `registerWrong`'s deps, so an adult
  // changing the level mid-game takes effect without a remount.
  const { hint: hintColor, setHint: setHintColor, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<string>(COLORS_QUIZ[difficultyLevel].hintAfter)
  // Shared lift/breathe drag state (activeId = grabbed object, overId = swatch under the pointer).
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()

  const audio = useSimplifiedAudioHook({ componentId: 'FarveQuizGame', autoInitialize: false })
  const [gameReady, setGameReady] = useState(false)

  const round = useRound({ length: COLORS_QUIZ_ROUND, gameId: 'colors.quiz' })
  const firstAttemptRef = useRef(true)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInitialized = useRef(false)
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  const hasInteractedRef = useRef(false)
  // Prompt objects come from a BAG (Practice Loop PRD-01 W1). The old `previousObject` ref is DELETED,
  // not kept beside it — avoiding only the previous object bounded ADJACENCY, so a round of 8 still
  // repeated objects out of an 18–24 item pool while most went unasked (two mechanisms is how one gets
  // bypassed). Reveal mode moves the pool, so `reset()` deals from the new one on a level change.
  const objectBag = usePromptBag<QuizObject>({ key: quizObjectKey, window: COLORS_QUIZ_ROUND })
  const isAdvancing = useRef(false)
  // Live current object so the post-welcome prompt voices the right one (state is async at mount).
  const currentRef = useRef<QuizObject | null>(null)

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 FarveQuizGame: ${message}`, data)
    }
  }

  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  const promptFor = (obj: QuizObject) => `Hvilken farve er ${obj.objectNameDefinite}?`

  const setupQuestion = (voice = true) => {
    isAdvancing.current = false
    // Static difficulty (progressStore.difficultyFor — no adaptivity), table-driven. The object is
    // desaturated regardless, so the axes here are the POOL (Let asks only the 12 subjects whose
    // colour is unambiguous at 5; Normal/Svær ask all 18 canonical ones) and the DISTRACTOR HUES —
    // Let excludes the answer's wheel neighbours (so no near-miss is on the board), Normal is random,
    // Svær offers the neighbours FIRST — rød/orange, blå/lilla — so telling adjacent hues apart is the
    // task. `HUE_WHEEL`, not `HUE_ORDER`: the display order's neighbours (rød/blå) aren't the ones a
    // child confuses.
    const level = progressStore.difficultyFor('colors')
    const { options: optionCount, hues } = COLORS_QUIZ[level]

    // `colorQuizPromptPool(level)` IS `quizObjectPool(COLORS_QUIZ[level].pool)` — read through
    // promptPools so the measured simulation samples the same per-level pool this board asks from.
    const obj = objectBag.draw(colorQuizPromptPool(level))

    const neighbours = adjacentHues(obj.color)
    const others = HUE_ORDER.filter((c) => c !== obj.color)
    const ranked =
      hues === 'adjacent'
        ? [...shuffle(others.filter((c) => neighbours.includes(c))), ...shuffle(others.filter((c) => !neighbours.includes(c)))]
        : hues === 'non-adjacent'
          ? [...shuffle(others.filter((c) => !neighbours.includes(c))), ...shuffle(others.filter((c) => neighbours.includes(c)))]
          : shuffle(others)
    const opts = shuffle([obj.color, ...ranked.slice(0, optionCount - 1)])

    currentRef.current = obj
    setCurrent(obj)
    setOptions(opts)
    setSolvedColor(null)
    setShakeColor(null)
    resetHint()
    firstAttemptRef.current = true

    if (!voice) return
    const delay = isIOS() ? 150 : 350
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      audio.updateUserInteraction()
      audio.speak(promptFor(obj)).catch(() => {})
    }, delay)
  }

  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    setupQuestion(false)
  }

  const playWelcomeThenPrompt = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('farvequiz')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (!hasInteractedRef.current && currentRef.current) {
      try {
        audio.updateUserInteraction()
        await audio.speak(promptFor(currentRef.current))
      } catch { /* ignore */ }
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    revealBoard()
    if (audio.isAudioReady) playWelcomeThenPrompt()
    return () => {
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) playWelcomeThenPrompt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // DEV screenshot harness (?fx=correct|wrong|hint): a PURE render-time derivation (no setState in
  // an effect — mirrors UnifiedQuizGame's `tileStateFor`). The effect below only notifies the
  // mascot (an external system). No-op in production (devFx() is DEV-only).
  const forcedFx = devFx()
  useEffect(() => {
    if (forcedFx === 'hint') mascotBus.emit('hint')
  }, [forcedFx])

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'colors.quiz',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      // Svær tolerates 1 mistake for 3★ / 3 for 2★ (Difficulty PRD-01 W6) — a harder level must not
      // cost the child stars, the same fairness rule that keeps XP difficulty-independent.
      { starThresholds: starThresholdsFor(progressStore.difficultyFor('colors')) },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    setupQuestion(true)
  }

  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(event.active.id as string)
    sfx.play('pick-up')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event
    clearActive()
    if (!over) return
    const m = /^color-(.+)$/.exec(String(over.id))
    if (!m) return
    resolveColor(m[1])
  }

  // ONE resolution path for both gestures: dropping the object on a swatch, and a plain TAP on that
  // swatch (DroppableZone's `onActivate` — owner, 2026-08-03; a tap used to do nothing at all).
  // Note the tap lives on the ZONE here, not the draggable: this game has a single draggable (the
  // object being placed), so tapping IT could not name a colour. The child's choice is the swatch.
  const resolveColor = (droppedColor: string, viaTap = false) => {
    if (!gameReady || isAdvancing.current || !current) return
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    // "Every tap is felt": the drag path already ticked on pick-up, so only the tap owes the press.
    if (viaTap) sfx.play('tap')

    if (droppedColor === current.color) {
      // Correct — the object "lands" in the color (absorb + splash).
      isAdvancing.current = true
      setSolvedColor(droppedColor)
      setHintColor(null)
      sfx.play('drop-snap')
      celebrateTier('micro')
      reactGuide('cheer')

      // Identify the object's colour (educational echo). No win/lose narration.
      audio.cancelCurrentAudio()
      audio.speak(colorObjectFactText(current.objectNameDefinite, spokenColor(current.color, current.neuter))).catch(() => {})

      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      advanceTimer.current = setTimeout(() => {
        stopCelebration()
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
          celebrateTier('streak')
          mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
        }
        if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
        else setupQuestion(true)
      }, isIOS() ? 1200 : 1500)
    } else {
      // Wrong — object springs back (automatic) + gentle SFX + the wrong swatch shakes.
      firstAttemptRef.current = false
      sfx.play('spring-back')
      setShakeColor(droppedColor)
      reactGuide('think')
      setTimeout(() => setShakeColor(null), 450)
      if (registerHintWrong(() => current.color)) {
        mascotBus.emit('hint')
        // …and NAME the colour (Practice Loop PRD-01 W3) — the same identification line a correct drop
        // speaks, through the same shared builder, so it is provably the baked clip. The object is
        // greyed at every level, which makes this the one thing that can unstick a child who doesn't
        // recall the colour — and why Let trips it after a SINGLE wrong drop (`hintAfter`).
        // Fire-and-forget; the `spring-back` SFX is a separate channel and survives it.
        audio
          .speak(colorObjectFactText(current.objectNameDefinite, spokenColor(current.color, current.neuter)))
          .catch(() => {})
      }
    }
  }

  const repeatPrompt = () => {
    audio.updateUserInteraction()
    if (!gameReady || !current) return
    audio.speak(promptFor(current)).catch(() => {})
  }

  // PRD-09 §3.0 colour-surface grounding: soft accent-tinted clay shadow (no hard keyboard lip);
  // the swatch fill stays the true educational hex.
  const liftedShadow = (hex: string) =>
    muiTheme.scene.dark
      ? `0 8px 22px ${hexToRgba(hex, 0.5)}, 0 3px 8px rgba(0,0,0,0.4)`
      : `0 8px 20px ${hexToRgba(hex, 0.35)}, 0 3px 8px rgba(0,0,0,0.12)`

  const isLiftedObject = activeId === 'object'

  // Forced ?fx= states (DEV screenshot harness) — pure render-time overrides layered on the real
  // state, never mutating it.
  const displaySolvedColor = forcedFx === 'correct' && current ? (solvedColor ?? current.color) : solvedColor
  const displayShakeColor = forcedFx === 'wrong' && current
    ? (shakeColor ?? options.find((c) => c !== current.color) ?? options[0] ?? null)
    : shakeColor
  const displayHintColor = forcedFx === 'hint' && current ? (hintColor ?? current.color) : hintColor

  // Live difficulty: rebuild the current question when the level changes in the adult menu (no
  // refresh). Skips the result screen + the initial mount. (`difficultyLevel` itself is read at the
  // top of the component — the hint hook needs it.)
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (roundOutcome || !gameReady) return
    setupQuestion()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell
      categoryId="colors"
      title="Hvilken Farve?"
      backRoute="/farver"
      dense
      guideReaction={guideReaction}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {roundOutcome ? (
        <RoundResultScreen outcome={roundOutcome} categoryId="colors" backRoute="/farver" onReplay={handleReplay} />
      ) : gameReady && current && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={onDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={clearActive}
          collisionDetection={kidCollision}
        >
          {/* Repeat the spoken question */}
          <Box sx={{ textAlign: 'center', mb: { xs: 0.75, md: 1 }, flex: '0 0 auto' }}>
            <ColorRepeatButton onClick={repeatPrompt} disabled={false} />
          </Box>

          {/* The object to drag onto a color. W5: pulled tight to the swatch row below (smaller mb)
              so the object + swatches read as one cluster and the drag is short.

              Sized off PHONE_LANDSCAPE, not a blanket `orientation: landscape`: the bare orientation
              query also caught the iPad — the app's PRIMARY device — and shrank the object to 80px,
              SMALLER than the 92px swatches, with ~200px of the column left unused. That was merely
              ugly back when the object was shown in colour at Let (its hue was the answer, and hue
              survives any size); now the SILHOUETTE is the entire question at every level, so the
              prompt has to be the biggest thing on the board. Phones keep the compact size — they
              have no slack to give. */}
          <Box sx={{
            flex: '0 0 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mb: { xs: 0.5, md: 1 },
            minHeight: { xs: 116, md: 148 },
            [PHONE_LANDSCAPE]: { mb: 0.5, minHeight: 84 }
          }}>
            {!displaySolvedColor && (
              <Box>
                <DraggableItem id="object" inline disabled={!gameReady} data={current}>
                  {/* The prompt object's resting float ran the whole time the board was up, as a
                      framer `repeat: Infinity` loop; it is now a CSS keyframe animation (same 6px /
                      1.6s) on the SAME element — safe here because the two states are mutually
                      exclusive (`isLiftedObject`), and a running CSS animation outranks framer's
                      inline transform in the cascade, so an overlap would swallow the lift. PRD-01 W1. */}
                  <Box
                    component={motion.div}
                    animate={isLiftedObject && !reduce ? { scale: 1.12, rotate: 5, y: 0 } : { scale: 1, rotate: 0, y: 0 }}
                    transition={isLiftedObject && !reduce ? SNAP : { duration: 0.2 }}
                    sx={[objectFloat(isLiftedObject).sx]}
                  >
                    {/* PRD-09: the object is a baked soft-3D thing resting in the world (no #ECF1F8
                        holder, no border, no lip). It is GREYED at EVERY level (PRD-02 — a BARE
                        `desaturate` prop, deliberately not an expression), so the child has to know
                        the colour instead of matching it off the art; the colour returns only on the
                        copy that lands in the swatch below. */}
                    <Box sx={{
                      width: { xs: 112, md: 140 },
                      height: { xs: 112, md: 140 },
                      [PHONE_LANDSCAPE]: { width: 80, height: 80 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      '&:active': { cursor: 'grabbing' }
                    }}>
                      <ObjectArt
                        art={current.art}
                        size="100%"
                        elevation={isLiftedObject ? 3 : 1}
                        alt={current.objectName}
                        desaturate
                      />
                    </Box>
                  </Box>
                </DraggableItem>
              </Box>
            )}
          </Box>

          {/* Color drop targets — count matches difficulty (3 let / 4 normal / 5 svær). */}
          <Box sx={{
            flex: '0 1 auto',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: `repeat(${options.length}, 1fr)` },
            '@media (orientation: landscape)': { gridTemplateColumns: `repeat(${options.length}, 1fr)` },
            gap: { xs: 1.5, md: 2 },
            justifyItems: 'center',
            alignContent: 'center',
            // The envelope has to hold the WIDEST level, not the middle one. At 5 swatches the fixed
            // 128px circles need 5×128 + 4×16 = 704px, so inside a 640 cap each 1fr cell was 115px and
            // every circle overflowed its own cell — measured 8px of the outer two clipped off the
            // right edge of an iPad in portrait (Svær only; landscape's 92px circles always fit).
            // Kept level-dependent so PRD-16 W5's deliberately tight 3/4-swatch cluster is unchanged.
            maxWidth: options.length >= 5 ? 720 : 640,
            mx: 'auto',
            width: '100%',
            px: 1,
            minHeight: 0
          }}>
            {options.map((color) => {
              const hex = COLOR_SWATCH[color]
              const isHint = displayHintColor === color
              const isShaking = displayShakeColor === color
              const isSolved = displaySolvedColor === color
              const isOverThis = overId === `color-${color}`
              const animate = isShaking
                ? { x: [0, -8, 8, -8, 8, 0], scale: 1 }
                : isHint && !reduce
                  ? { scale: [1, 1.1, 1] }
                  : isOverThis && !reduce
                    ? { scale: [1, 1.08, 1], x: 0 }
                    : { scale: 1, x: 0 }
              const transition = isShaking
                ? { duration: 0.45 }
                : isHint && !reduce
                  ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
                  : isOverThis && !reduce
                    ? { duration: 0.55, repeat: Infinity, ease: 'easeInOut' as const }
                    : { duration: 0.25 }
              return (
                <motion.div
                  key={color}
                  animate={animate}
                  transition={transition}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  <Box sx={{
                    width: { xs: 100, sm: 110, md: 128 },
                    height: { xs: 100, sm: 110, md: 128 },
                    '@media (orientation: landscape)': { width: 92, height: 92 },
                    position: 'relative'
                  }}>
                    <DroppableZone
                      id={`color-${color}`}
                      overColor={hexToRgba(hex, 0.55)}
                      // Tap the swatch = the same answer as dropping the object on it.
                      onActivate={() => resolveColor(color, true)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: hex,
                        backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%)',
                        border: isSolved ? `4px solid ${muiTheme.palette.success.main}` : '4px solid white',
                        boxShadow: isHint
                          ? `0 0 0 5px ${t.accentColor}88, ${liftedShadow(hex)}`
                          : isSolved
                            ? `0 0 0 5px ${hexToRgba(muiTheme.palette.success.main, 0.5)}, ${liftedShadow(hex)}`
                            : isOverThis
                              ? `0 0 0 5px ${hexToRgba(hex, 0.6)}, ${liftedShadow(hex)}`
                              : liftedShadow(hex),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'box-shadow 0.25s ease, border-color 0.25s ease'
                      }}
                    >
                      {/* The object lands here when correct — absorbed with a scale-in pop, and always
                          in FULL COLOUR: in grey mode this pop IS the answer reveal (the greyed copy
                          above unmounts as this one mounts). */}
                      {isSolved && (
                        <motion.div
                          initial={reduce ? false : { scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={reduce ? { duration: 0 } : SNAP}
                        >
                          <ObjectArt art={current.art} size={64} elevation={2} alt={current.objectName} />
                        </motion.div>
                      )}
                    </DroppableZone>
                    {/* Color splash burst on absorb. */}
                    {isSolved && !reduce && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0.85 }}
                        animate={{ scale: 1.9, opacity: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </Box>
                </motion.div>
              )
            })}
          </Box>
        </DndContext>
      )}
    </GameShell>
  )
}

export default FarveQuizGame
