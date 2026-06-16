import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent, closestCenter, DragOverlay } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { getCategoryTheme } from '../../config/categoryThemes'
import { SHADES, HUE_ORDER, type ColorShade } from '../../config/colorContent'
import { darken } from '../../theme/tokens/helpers'
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

// Nuancer — order shades of one hue from LIGHT to DARK. The real discrimination stretch in the
// Farver section: the tiles are the same color family, so the only signal is lightness. DRAG each
// shade into its slot (left = lightest, right = darkest). A wrong slot bounces back (gentle SFX +
// shake); after 2 wrong drops the correct tile for the next empty slot pulses (never-fail hint,
// costs a star). Bounded round of 8 → RoundResultScreen. Static difficulty — edit the levers below.

// ── Tuning levers ─────────────────────────────────────────────────────────────────────────────
const ROUND_QUESTIONS = 8          // orderings per round → RoundResultScreen
const WRONG_BEFORE_HINT = 2        // pulse the correct next tile after this many wrong drops

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const NuancerGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()

  // Current question: a hue's shades (correct light→dark order) + a scrambled tray.
  const [order, setOrder] = useState<ColorShade[]>([])     // correct order (light→dark); slot i wants order[i]
  const [tray, setTray] = useState<ColorShade[]>([])       // scrambled display order
  const [slots, setSlots] = useState<(string | null)[]>([]) // placed shade name per slot index, or null
  const [shakeName, setShakeName] = useState<string | null>(null)
  const [hintName, setHintName] = useState<string | null>(null)
  const [, setActiveId] = useState<string | null>(null)
  const slotWrongRef = useRef(0)

  const audio = useSimplifiedAudioHook({ componentId: 'NuancerGame', autoInitialize: false })
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
  const previousHue = useRef<string>('')
  const isAdvancing = useRef(false)

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 NuancerGame: ${message}`, data)
    }
  }

  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  const INSTRUCTION = 'Sæt farverne fra lys til mørk'

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    revealBoard()
    if (audio.isAudioReady) playWelcomeThenInstructions()

    return () => {
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) playWelcomeThenInstructions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    setupQuestion(false)
  }

  const playWelcomeThenInstructions = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('nuancer')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (!hasInteractedRef.current) {
      try {
        audio.updateUserInteraction()
        await audio.speak(INSTRUCTION)
      } catch (error) {
        logError('Error speaking instruction', { error: error?.toString() })
      }
    }
  }

  // Pick a fresh hue (avoid immediate repeat) and scramble its shades. `voice=false` skips audio.
  const setupQuestion = (voice = true) => {
    isAdvancing.current = false
    let hues = HUE_ORDER.filter((h) => h !== previousHue.current)
    if (hues.length === 0) hues = [...HUE_ORDER]
    const hue = hues[Math.floor(Math.random() * hues.length)]
    previousHue.current = hue

    const correct = SHADES[hue]
    setOrder(correct)
    // Re-shuffle until the scrambled order isn't already sorted, so it's always a real task.
    let scrambled = shuffle(correct)
    let guard = 0
    while (guard++ < 8 && scrambled.every((s, i) => s.name === correct[i].name)) {
      scrambled = shuffle(correct)
    }
    setTray(scrambled)
    setSlots(correct.map(() => null))
    setShakeName(null)
    setHintName(null)
    slotWrongRef.current = 0
    firstAttemptRef.current = true

    if (!voice) return
    const delay = isIOS() ? 150 : 350
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      audio.updateUserInteraction()
      audio.speak(INSTRUCTION).catch(() => {})
    }, delay)
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'colors.nuancer',
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

  const completeQuestion = () => {
    if (isAdvancing.current) return
    isAdvancing.current = true
    celebrateTier('micro')
    reactGuide('cheer')

    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      stopCelebration()
      const r = round.completeQuestion(firstAttemptRef.current)
      if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
      if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
      else setupQuestion(true)
    }, isIOS() ? 1100 : 1400)
  }

  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!gameReady || isAdvancing.current) return

    const shadeName = active.id as string
    if (slots.includes(shadeName)) return // already placed
    hasInteractedRef.current = true
    audio.updateUserInteraction()

    if (!over) return // dropped on empty space → snaps back
    const m = /^slot-(\d+)$/.exec(String(over.id))
    if (!m) return
    const i = Number(m[1])
    if (slots[i]) return // slot already filled → snaps back

    if (order[i] && shadeName === order[i].name) {
      // Correct slot → lock it in.
      const next = [...slots]
      next[i] = shadeName
      setSlots(next)
      slotWrongRef.current = 0
      setHintName(null)
      sfx.play('drop-snap')
      // Identify the placed shade (educational echo). No win/lose narration.
      audio.cancelCurrentAudio()
      audio.speak(shadeName).catch(() => {})
      if (next.every((s) => s !== null)) completeQuestion()
    } else {
      // Wrong slot → bounce back (automatic) + gentle SFX + shake, break first-try.
      firstAttemptRef.current = false
      sfx.play('wrong')
      setShakeName(shadeName)
      reactGuide('think')
      setTimeout(() => setShakeName(null), 450)
      slotWrongRef.current += 1
      if (slotWrongRef.current >= WRONG_BEFORE_HINT) {
        const firstEmpty = slots.findIndex((s) => !s)
        if (firstEmpty >= 0 && order[firstEmpty]) setHintName(order[firstEmpty].name)
      }
    }
  }

  const repeatInstruction = () => {
    audio.updateUserInteraction()
    if (!gameReady) return
    audio.speak(INSTRUCTION).catch(() => {})
  }

  // Tile geometry (lifted-3D, colored). Slightly smaller in landscape so the row + tray fit.
  const tileSx = {
    width: { xs: 66, sm: 76, md: 88 },
    height: { xs: 66, sm: 76, md: 88 },
    '@media (orientation: landscape)': { width: 60, height: 60 },
    borderRadius: '16px'
  } as const

  const liftedShadow = (hex: string) =>
    `0 5px 0 ${darken(hex, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`

  const remaining = tray.filter((s) => !slots.includes(s.name))
  const allPlaced = slots.length > 0 && slots.every((s) => s !== null)

  return (
    <GameShell
      categoryId="colors"
      title="Nuancer"
      backRoute="/farver"
      dense
      guideReaction={guideReaction}
      score={<ColorProgressChip score={round.state.index} target={ROUND_QUESTIONS} onClick={repeatInstruction} />}
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="colors"
          backRoute="/farver"
          onReplay={handleReplay}
        />
      ) : gameReady && order.length > 0 && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
          {/* Repeat instruction */}
          <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
            <ColorRepeatButton onClick={repeatInstruction} disabled={false} label="🎵 Hør igen" />
          </Box>

          {/* Slot row (drop targets): left = lightest, right = darkest. */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 1, md: 1.5 },
            flex: '0 0 auto',
            mb: 0.5,
            '@media (orientation: landscape)': { mb: 0.25 }
          }}>
            {slots.map((placedName, index) => {
              const placedShade = placedName ? order.find((s) => s.name === placedName) : undefined
              return (
                <motion.div
                  key={`slot-${index}`}
                  animate={!reduce && allPlaced ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <Box sx={tileSx}>
                    <DroppableZone
                      id={`slot-${index}`}
                      overColor={muiTheme.scene.dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)'}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '16px',
                        border: placedShade ? '3px solid white' : `3px dashed ${t.borderColor}`,
                        backgroundColor: placedShade ? placedShade.hex : 'rgba(255,255,255,0.45)',
                        boxShadow: placedShade ? liftedShadow(placedShade.hex) : 'none',
                        transition: 'background-color 0.25s ease, box-shadow 0.25s ease'
                      }}
                    />
                  </Box>
                </motion.div>
              )
            })}
          </Box>

          {/* Lys → Mørk direction hint (icons, language-light). */}
          <Box sx={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1,
            flex: '0 0 auto', mb: { xs: 1.5, md: 2 },
            '@media (orientation: landscape)': { mb: 1 }
          }}>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>☀️</Typography>
            <Typography sx={{
              fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(0.85rem, 2.6vw, 1.05rem)',
              color: muiTheme.scene.dark ? 'rgba(255,255,255,0.85)' : 'text.secondary'
            }}>
              lys → mørk
            </Typography>
            <Typography sx={{ fontSize: '1.3rem', lineHeight: 1 }}>🌙</Typography>
          </Box>

          {/* Tray: the scrambled shades still to place (drag into a slot). */}
          <Box sx={{
            flex: '0 1 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: { xs: 1.5, md: 2 },
            minHeight: { xs: 72, md: 96 }
          }}>
            {remaining.map((shade) => {
              const isHint = hintName === shade.name
              const isShaking = shakeName === shade.name
              const animate = isShaking
                ? { x: [0, -10, 10, -10, 10, 0], scale: 1 }
                : isHint && !reduce
                  ? { scale: [1, 1.14, 1], x: 0 }
                  : { scale: 1, x: 0 }
              const transition = isShaking
                ? { duration: 0.45 }
                : isHint && !reduce
                  ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
                  : { duration: 0.25 }
              return (
                // Force the absolutely-positioned DraggableItem to flow inline in this flex tray.
                <Box
                  key={shade.name}
                  sx={{
                    position: 'relative !important',
                    left: 'auto !important',
                    top: 'auto !important',
                    '& > div': { position: 'relative !important', left: 'auto !important', top: 'auto !important' }
                  }}
                >
                  <DraggableItem id={shade.name} disabled={!gameReady} data={shade}>
                    <motion.div animate={animate} transition={transition}>
                      <Box sx={{
                        ...tileSx,
                        backgroundColor: shade.hex,
                        border: '3px solid white',
                        cursor: 'grab',
                        userSelect: 'none',
                        boxShadow: isHint
                          ? `0 0 0 5px ${t.accentColor}88, 0 6px 14px rgba(0,0,0,0.2)`
                          : liftedShadow(shade.hex),
                        transition: 'box-shadow 0.25s ease',
                        '&:active': { cursor: 'grabbing' }
                      }} />
                    </motion.div>
                  </DraggableItem>
                </Box>
              )
            })}
          </Box>

          <DragOverlay>{null}</DragOverlay>
        </DndContext>
      )}
    </GameShell>
  )
}

export default NuancerGame
