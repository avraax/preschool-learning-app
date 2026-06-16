import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent, closestCenter, DragOverlay } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { getCategoryTheme } from '../../config/categoryThemes'
import { DANISH_OBJECTS, COLOR_SWATCH, HUE_ORDER } from '../../config/colorContent'
import { darken, hexToRgba } from '../../theme/tokens/helpers'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { ColorProgressChip } from '../common/ScoreChip'
import { ColorRepeatButton } from '../common/RepeatButton'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { isIOS } from '../../utils/deviceDetection'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Hvilken Farve? — drag an object onto the matching COLOR. Tests object→color association and
// keeps the section's drag language (Farvejagt/Ram Farven/Nuancer are all dnd-kit). A wrong color
// bounces the object back (gentle SFX); after 2 wrong drops the correct color pulses (never-fail
// hint, costs a star). Bounded round of 8 → RoundResultScreen. Static difficulty.

const ROUND_QUESTIONS = 8
const WRONG_BEFORE_HINT = 2
const OPTION_COUNT = 4

interface QuizObject { color: string; objectName: string; objectNameDefinite: string; emoji: string }

const OBJECT_POOL: QuizObject[] = HUE_ORDER.flatMap((color) =>
  (DANISH_OBJECTS[color] ?? []).map((o) => ({
    color,
    objectName: o.objectName,
    objectNameDefinite: o.objectNameDefinite,
    emoji: o.emoji
  }))
)

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const FarveQuizGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()

  const [current, setCurrent] = useState<QuizObject | null>(null)
  const [options, setOptions] = useState<string[]>([])   // candidate color names
  const [solvedColor, setSolvedColor] = useState<string | null>(null) // the color it landed in (correct)
  const [shakeColor, setShakeColor] = useState<string | null>(null)
  const [hintColor, setHintColor] = useState<string | null>(null)
  const [, setActiveId] = useState<string | null>(null)
  const wrongRef = useRef(0)

  const audio = useSimplifiedAudioHook({ componentId: 'FarveQuizGame', autoInitialize: false })
  const [gameReady, setGameReady] = useState(false)

  const round = useRound({ length: ROUND_QUESTIONS, starThresholds: { three: 0, two: 2 } })
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

  const setupQuestion = (voice = true) => {
    isAdvancing.current = false
    let pool = OBJECT_POOL.filter((o) => `${o.color}-${o.objectName}` !== previousObject.current)
    if (pool.length === 0) pool = OBJECT_POOL
    const obj = pool[Math.floor(Math.random() * pool.length)]
    previousObject.current = `${obj.color}-${obj.objectName}`

    const distractors = shuffle(HUE_ORDER.filter((c) => c !== obj.color)).slice(0, OPTION_COUNT - 1)
    const opts = shuffle([obj.color, ...distractors])

    currentRef.current = obj
    setCurrent(obj)
    setOptions(opts)
    setSolvedColor(null)
    setShakeColor(null)
    setHintColor(null)
    wrongRef.current = 0
    firstAttemptRef.current = true

    if (!voice) return
    const delay = isIOS() ? 150 : 350
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      audio.updateUserInteraction()
      audio.speak(promptFor(obj)).catch(() => {})
    }, delay)
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'colors.quiz',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 } },
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
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event
    setActiveId(null)
    if (!gameReady || isAdvancing.current || !current) return
    hasInteractedRef.current = true
    audio.updateUserInteraction()

    if (!over) return
    const m = /^color-(.+)$/.exec(String(over.id))
    if (!m) return
    const droppedColor = m[1]

    if (droppedColor === current.color) {
      // Correct — the object "lands" in the color.
      isAdvancing.current = true
      setSolvedColor(droppedColor)
      setHintColor(null)
      sfx.play('drop-snap')
      celebrateTier('micro')
      reactGuide('cheer')
      // Success = SFX + visuals only; no spoken reinforcement (owner request).

      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      advanceTimer.current = setTimeout(() => {
        stopCelebration()
        const r = round.completeQuestion(firstAttemptRef.current)
        if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
        if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
        else setupQuestion(true)
      }, isIOS() ? 1200 : 1500)
    } else {
      // Wrong — object bounces back (automatic) + gentle SFX + the wrong swatch shakes.
      firstAttemptRef.current = false
      sfx.play('wrong')
      setShakeColor(droppedColor)
      reactGuide('think')
      setTimeout(() => setShakeColor(null), 450)
      wrongRef.current += 1
      if (wrongRef.current >= WRONG_BEFORE_HINT) setHintColor(current.color)
    }
  }

  const repeatPrompt = () => {
    audio.updateUserInteraction()
    if (!gameReady || !current) return
    audio.speak(promptFor(current)).catch(() => {})
  }

  const liftedShadow = (hex: string) =>
    `0 5px 0 ${darken(hex, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`

  return (
    <GameShell
      categoryId="colors"
      title="Hvilken Farve?"
      backRoute="/farver"
      dense
      guideReaction={guideReaction}
      score={<ColorProgressChip score={round.state.index} target={ROUND_QUESTIONS} onClick={repeatPrompt} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {roundOutcome ? (
        <RoundResultScreen outcome={roundOutcome} categoryId="colors" backRoute="/farver" onReplay={handleReplay} />
      ) : gameReady && current && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
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
            {!solvedColor && (
              <Box sx={{
                position: 'relative !important', left: 'auto !important', top: 'auto !important',
                '& > div': { position: 'relative !important', left: 'auto !important', top: 'auto !important' }
              }}>
                <DraggableItem id="object" disabled={!gameReady || isAdvancing.current} data={current}>
                  <motion.div
                    animate={reduce ? {} : { y: [0, -6, 0] }}
                    transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
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
                      boxShadow: `0 6px 0 ${darken(t.accentColor, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 8px 18px rgba(0,0,0,0.14)'}`,
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

          {/* Color drop targets. */}
          <Box sx={{
            flex: '0 1 auto',
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
            '@media (orientation: landscape)': { gridTemplateColumns: 'repeat(4, 1fr)' },
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
              const isHint = hintColor === color
              const isShaking = shakeColor === color
              const isSolved = solvedColor === color
              return (
                <motion.div
                  key={color}
                  animate={isShaking ? { x: [0, -8, 8, -8, 8, 0] } : isHint && !reduce ? { scale: [1, 1.1, 1] } : { scale: 1, x: 0 }}
                  transition={isShaking ? { duration: 0.45 } : isHint && !reduce ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.25 }}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  <Box sx={{
                    width: { xs: 96, sm: 104, md: 120 },
                    height: { xs: 96, sm: 104, md: 120 },
                    '@media (orientation: landscape)': { width: 88, height: 88 }
                  }}>
                    <DroppableZone
                      id={`color-${color}`}
                      overColor={hexToRgba(hex, 0.55)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: hex,
                        backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%)',
                        border: isSolved ? `4px solid ${muiTheme.palette.success.main}` : '4px solid white',
                        boxShadow: isHint
                          ? `0 0 0 5px ${t.accentColor}88, ${liftedShadow(hex)}`
                          : isSolved
                            ? `0 0 0 5px ${hexToRgba(muiTheme.palette.success.main, 0.5)}, ${liftedShadow(hex)}`
                            : liftedShadow(hex),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'box-shadow 0.25s ease, border-color 0.25s ease'
                      }}
                    >
                      {/* The object lands here when correct. */}
                      {isSolved && (
                        <Typography sx={{ fontSize: { xs: '2.4rem', md: '3rem' }, lineHeight: 1, userSelect: 'none' }}>
                          {current.emoji}
                        </Typography>
                      )}
                    </DroppableZone>
                  </Box>
                </motion.div>
              )
            })}
          </Box>

          <DragOverlay>{null}</DragOverlay>
        </DndContext>
      )}
    </GameShell>
  )
}

export default FarveQuizGame
