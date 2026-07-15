import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { getCategoryTheme } from '../../config/categoryThemes'
import { stickerSetForSection } from '../../config/stickers'
import { DANISH_OBJECTS, COLOR_SWATCH, HUE_ORDER, spokenColor } from '../../config/colorContent'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import { SNAP } from '../../theme/motion'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { ColorProgressChip } from '../common/ScoreChip'
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
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Hvilken Farve? — drag an object onto the matching COLOR. Tests object→color association and
// keeps the section's drag language (Farvejagt/Ram Farven/Nuancer are all dnd-kit). A wrong color
// bounces the object back (gentle SFX); after 2 wrong drops the correct color pulses (never-fail
// hint, costs a star). Bounded round of 8 → RoundResultScreen. Static difficulty.
//
// UI/UX Overhaul §6C: shared drag juice — grab = lift + 'pick-up' SFX; a swatch breathes while a
// compatible item hovers it; a correct swatch ABSORBS the object (scale-in + splash); a wrong drop
// springs back + 'spring-back' SFX. Reduced motion keeps colour/glow + SFX, drops the travel.

const ROUND_QUESTIONS = 8
const WRONG_BEFORE_HINT = 2
const OPTION_COUNT = 4 // NORMAL baseline (today, unchanged) — difficulty below adjusts Let/Svær

interface QuizObject { color: string; objectName: string; objectNameDefinite: string; emoji: string; neuter: boolean }

// Only quiz-safe objects: emoji whose color the child can actually read off the picture. Objects
// flagged quizSafe:false in colorContent (⚽/👒/☁️/🌸) are excluded so the child is never scored
// wrong for correctly seeing a black-and-white ball or a white cloud.
const OBJECT_POOL: QuizObject[] = HUE_ORDER.flatMap((color) =>
  (DANISH_OBJECTS[color] ?? [])
    .filter((o) => o.quizSafe !== false)
    .map((o) => ({
      color,
      objectName: o.objectName,
      objectNameDefinite: o.objectNameDefinite,
      emoji: o.emoji,
      neuter: o.neuter
    }))
)

const FarveQuizGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()

  const [current, setCurrent] = useState<QuizObject | null>(null)
  const [options, setOptions] = useState<string[]>([])   // candidate color names
  const [solvedColor, setSolvedColor] = useState<string | null>(null) // the color it landed in (correct)
  const [shakeColor, setShakeColor] = useState<string | null>(null)
  // Never-fail hint: after WRONG_BEFORE_HINT wrong drops on the current question, the correct color
  // pulses. `hintColor` holds that color name (or null). Reset per question (see setupQuestion).
  const { hint: hintColor, setHint: setHintColor, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<string>(WRONG_BEFORE_HINT)
  // Shared lift/breathe drag state (activeId = grabbed object, overId = swatch under the pointer).
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()

  const audio = useSimplifiedAudioHook({ componentId: 'FarveQuizGame', autoInitialize: false })
  const [gameReady, setGameReady] = useState(false)

  const round = useRound({ length: ROUND_QUESTIONS, starThresholds: { three: 0, two: 2 }, gameId: 'colors.quiz' })
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
    let pool = OBJECT_POOL.filter((o) => `${o.color}-${o.objectName}` !== previousObject.current)
    if (pool.length === 0) pool = OBJECT_POOL
    const obj = pool[Math.floor(Math.random() * pool.length)]
    previousObject.current = `${obj.color}-${obj.objectName}`

    // Static difficulty (progressStore.difficultyFor — no adaptivity). Let: 3 options. Normal
    // (today, unchanged): 4. Svær: 5. Distractors stay random per the section's design.
    const difficulty = progressStore.difficultyFor('colors')
    const optionCount = difficulty === 'let' ? 3 : difficulty === 'svaer' ? 5 : OPTION_COUNT
    const distractors = shuffle(HUE_ORDER.filter((c) => c !== obj.color)).slice(0, optionCount - 1)
    const opts = shuffle([obj.color, ...distractors])

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
      { starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('colors') },
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
    if (!gameReady || isAdvancing.current || !current) return
    hasInteractedRef.current = true
    audio.updateUserInteraction()

    if (!over) return
    const m = /^color-(.+)$/.exec(String(over.id))
    if (!m) return
    const droppedColor = m[1]

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

  const liftedShadow = (hex: string) =>
    `0 5px 0 ${darken(hex, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`

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
      score={<ColorProgressChip answered={round.state.index} total={ROUND_QUESTIONS} onClick={repeatPrompt} />}
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
          <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
            <ColorRepeatButton onClick={repeatPrompt} disabled={false} label="🎵 Hør igen" />
          </Box>

          {/* The object to drag onto a color. */}
          <Box sx={{
            flex: '0 0 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mb: { xs: 1.5, md: 2.5 },
            minHeight: { xs: 96, md: 120 },
            '@media (orientation: landscape)': { mb: 1, minHeight: 84 }
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
                    <Box sx={{
                      width: { xs: 92, md: 112 },
                      height: { xs: 92, md: 112 },
                      '@media (orientation: landscape)': { width: 80, height: 80 },
                      borderRadius: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      background: 'linear-gradient(180deg, #FFFFFF 0%, #ECF1F8 100%)',
                      border: `3px solid ${hexToRgba(t.accentColor, muiTheme.scene.dark ? 0.55 : 0.34)}`,
                      boxShadow: isLiftedObject
                        ? `0 20px 34px rgba(0,0,0,${muiTheme.scene.dark ? 0.55 : 0.32}), 0 0 0 4px rgba(255,255,255,0.65)`
                        : `0 6px 0 ${darken(t.accentColor, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 8px 18px rgba(0,0,0,0.14)'}`,
                      '&:active': { cursor: 'grabbing' }
                    }}>
                      <Typography sx={{ fontSize: { xs: '3rem', md: '3.6rem' }, lineHeight: 1, userSelect: 'none' }}>
                        {current.emoji}
                      </Typography>
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
            maxWidth: 640,
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
                      {/* The object lands here when correct — absorbed with a scale-in pop. */}
                      {isSolved && (
                        <motion.div
                          initial={reduce ? false : { scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={reduce ? { duration: 0 } : SNAP}
                        >
                          <Typography sx={{ fontSize: { xs: '2.4rem', md: '3rem' }, lineHeight: 1, userSelect: 'none' }}>
                            {current.emoji}
                          </Typography>
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
