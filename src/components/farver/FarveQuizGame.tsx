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
  quizObjectPool,
  spokenColor,
  type QuizObject,
} from '../../config/colorContent'
import { COLORS_QUIZ, starThresholdsFor } from '../../config/difficulty'
import { hexToRgba } from '../../theme/tokens/helpers'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { SNAP } from '../../theme/motion'
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
// (gentle SFX); after 2 wrong drops the correct color pulses (never-fail hint, costs a star).
// Bounded round of 8 → RoundResultScreen. Static difficulty. Keeps the section's drag language
// (Farvejagt/Ram Farven/Nuancer are all dnd-kit).
//
// **The object is GREYED OUT above Let** (`COLORS_QUIZ[level].reveal`), and that is what makes this a
// colour game rather than a pixel match: shown in its true colour, the fox's orange is already on the
// board next to an orange swatch, so the child never needs the word — the same "a board must not
// restate its own answer" defect the owner removed from Tal Quiz and from Bogstav Quiz's old
// hear-the-letter mode. Greyed, "Hvilken farve er ræven?" is the real question, the spoken echo
// ("ræven er orange") teaches instead of narrating, and the colour comes BACK as the reveal when the
// object lands in the right swatch. The pool shrinks with it — a greyed car has no right answer, see
// `canonical` in colorContent.
//
// UI/UX Overhaul §6C: shared drag juice — grab = lift + 'pick-up' SFX; a swatch breathes while a
// compatible item hovers it; a correct swatch ABSORBS the object (scale-in + splash); a wrong drop
// springs back + 'spring-back' SFX. Reduced motion keeps colour/glow + SFX, drops the travel.

const WRONG_BEFORE_HINT = 2
// Round length, option count, hue policy and reveal mode all come from config (Difficulty PRD-01
// §4.5): Let 3 swatches / non-adjacent hues / in colour · Normal 4 / random / grey · Svær 5 /
// wheel-adjacent only / grey.

const FarveQuizGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()

  const [current, setCurrent] = useState<QuizObject | null>(null)
  const [options, setOptions] = useState<string[]>([])   // candidate color names
  // Whether THIS question's object is greyed out. Held in state beside the question (not derived at
  // render from the live level) so the object can never be greyed while it was drawn from the
  // colour-mode pool — a mid-question level change regenerates both together.
  const [greyObject, setGreyObject] = useState(false)
  const [solvedColor, setSolvedColor] = useState<string | null>(null) // the color it landed in (correct)
  const [shakeColor, setShakeColor] = useState<string | null>(null)
  // Never-fail hint: after WRONG_BEFORE_HINT wrong drops on the current question, the correct color
  // pulses. `hintColor` holds that color name (or null). Reset per question (see setupQuestion).
  const { hint: hintColor, setHint: setHintColor, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<string>(WRONG_BEFORE_HINT)
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
  const previousObject = useRef<string>('')
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
    // Static difficulty (progressStore.difficultyFor — no adaptivity), table-driven. Two axes: the
    // REVEAL mode (in colour at Let = the answer is visible; greyed above it = the child recalls it,
    // which also narrows the pool to canonical-colour objects), and the DISTRACTOR HUES — Let excludes
    // the answer's wheel neighbours (so no near-miss is on the board), Normal is random, Svær offers
    // the neighbours FIRST — rød/orange, blå/lilla — so telling adjacent hues apart is the task.
    // `HUE_WHEEL`, not `HUE_ORDER`: the display order's neighbours (rød/blå) aren't the ones a child
    // confuses.
    const { options: optionCount, hues, reveal } = COLORS_QUIZ[progressStore.difficultyFor('colors')]

    const objects = quizObjectPool(reveal)
    let pool = objects.filter((o) => `${o.color}-${o.objectName}` !== previousObject.current)
    if (pool.length === 0) pool = objects
    const obj = pool[Math.floor(Math.random() * pool.length)]
    previousObject.current = `${obj.color}-${obj.objectName}`

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
    setGreyObject(reveal === 'grey')
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
      audio.speak(`${current.objectNameDefinite} er ${spokenColor(current.color, current.neuter)}`).catch(() => {})

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
      if (registerHintWrong(() => current.color)) mascotBus.emit('hint')
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
  // refresh). Skips the result screen + the initial mount.
  const difficultyLevel = useDifficulty('colors')
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
              SMALLER than the 92px swatches, with ~200px of the column left unused. Harmless while the
              object was shown in colour (its hue was the answer, and hue survives any size), but in
              grey mode the SILHOUETTE is the entire question, so the prompt has to be the biggest
              thing on the board. Phones keep the compact size — they have no slack to give. */}
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
                  <motion.div
                    animate={
                      isLiftedObject && !reduce
                        ? { scale: 1.12, rotate: 5, y: 0 }
                        : reduce ? {} : { y: [0, -6, 0], scale: 1, rotate: 0 }
                    }
                    transition={
                      isLiftedObject && !reduce
                        ? SNAP
                        : reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                    }
                  >
                    {/* PRD-09: the object is a baked soft-3D thing resting in the world (no #ECF1F8
                        holder, no border, no lip). Above Let it is GREYED (`greyObject`), so the child
                        has to know the colour instead of matching it off the art; the colour returns
                        on the copy that lands in the swatch below. */}
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
                        desaturate={greyObject}
                      />
                    </Box>
                  </motion.div>
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
