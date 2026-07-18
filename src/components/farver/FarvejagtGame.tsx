import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { DndContext, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { ColorRepeatButton } from '../common/RepeatButton'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import { ColorProgressChip } from '../common/ScoreChip'
import { stickerSetForSection } from '../../config/stickers'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useDifficulty } from '../../hooks/useDifficulty'
import { devFx } from '../../utils/devHarness'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import { isIOS } from '../../utils/deviceDetection'
import { shuffle } from '../../utils/shuffle'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { useDragActive } from '../common/dnd/useDragActive'
import { DANISH_OBJECTS, COLOR_TARGETS, COLOR_SWATCH, spokenColor } from '../../config/colorContent'
import ObjectArt from './farverArt'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// ── Tuning levers (static difficulty — edit here, no adaptive logic) ──────────────────────────
const ROUND_BOARDS = 5            // boards (questions) per round → RoundResultScreen
const DISTRACTORS_PER_COLOR = 1   // calmer ~12-item board (was 2) — the NORMAL baseline
const WRONG_DROPS_BEFORE_HINT = 2 // pulse a correct item after this many wrong drops on a board
const CIRCLE = 180                // target circle diameter (px); ring + pip geometry derive from it
const FLOURISH_MS = 700           // board-complete ring spin/pop before advancing
const COLLECTED_SIZE = 46         // collected-item size inside the ring (px)
const RING_RADIUS = 50            // radius of the collected-item ring from circle centre (px)

// Game item interface
interface GameItem {
  id: string
  colorName: string
  objectName: string
  objectNameDefinite: string
  art?: string
  hex: string
  neuter: boolean
  isTarget: boolean
  collected: boolean
  returning: boolean
  x: number
  y: number
}

// Educational color content (objects + hunt targets) lives in src/config/colorContent.ts so all
// color games share one source of truth. NOT themeable.

// Position on the ring (px, relative to the centred CIRCLE wrapper) for a given slot.
const ringSlotPx = (slot: number, total: number, radius: number) => {
  const ang = ((-90 + slot * (360 / Math.max(1, total))) * Math.PI) / 180
  return {
    left: CIRCLE / 2 + radius * Math.cos(ang),
    top: CIRCLE / 2 + radius * Math.sin(ang)
  }
}

const FarvejagtGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const sensors = useDragOnlySensors()

  // Game state
  const [gameItems, setGameItems] = useState<GameItem[]>([])
  const [totalTarget, setTotalTarget] = useState(0)
  // Shared lift/breathe drag state (activeId = grabbed item, overId = target under the pointer).
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()
  const [burstAt, setBurstAt] = useState<{ slot: number; hex: string } | null>(null) // localized splash burst
  const [targetColor, setTargetColor] = useState<string>('rød')
  const [targetPhrase, setTargetPhrase] = useState<string>('Find alle røde ting')
  const [boardKey, setBoardKey] = useState(0)       // bumped per board → re-triggers scatter-in
  const [boardFlourish, setBoardFlourish] = useState(false)
  // Never-fail hint: after WRONG_DROPS_BEFORE_HINT wrong drops on the current board, an uncollected
  // target pulses. `hintItemId` holds that item id (or null). Reset per board (see setup).
  const { hint: hintItemId, setHint: setHintItemId, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<string>(WRONG_DROPS_BEFORE_HINT)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'FarvejagtGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)

  // Bounded round + reward flow (Overhaul Farver §Farvejagt). 5 boards, 3★ = 0 wrong-drop boards, 2★ ≤ 2.
  const round = useRound({ length: ROUND_BOARDS, starThresholds: { three: 0, two: 2 }, gameId: 'colors.farvejagt' })
  const firstAttemptRef = useRef(true)   // first-try flag for the CURRENT board
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Celebration (corner guide reacts via guideReaction)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flourishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInitialized = useRef(false)
  const previousColor = useRef<string>('')
  const startedRef = useRef(false)
  const isAdvancing = useRef(false)  // locks drops during the board-complete flourish (P3)
  const welcomeTriggered = useRef(false)
  // Live target phrase (voiced after the welcome) + interaction guard (so a late welcome never
  // talks over active play).
  const targetPhraseRef = useRef<string>('')
  const hasInteractedRef = useRef(false)

  // Production logging - only essential errors
  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 FarvejagtGame: ${message}`, data)
    }
  }

  // Cue the corner guide, clearing the reaction a beat later so it settles + re-fires.
  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  // Get target color hex for UI elements (educational data — the hunted color must read true).
  // Read the CANONICAL swatch (COLOR_SWATCH), not DANISH_OBJECTS[color][0].hex — the latter drifts
  // between shades because the object arrays get reshuffled per board (P4).
  const getTargetColorHex = () => COLOR_SWATCH[targetColor] || '#dc2626'

  // Random position generator avoiding center area
  const generateRandomPositions = (itemCount: number) => {
    const positions: Array<{x: number, y: number}> = []
    const centerX = 50, centerY = 50, centerRadius = 25
    const minDistance = itemCount > 12 ? 9 : 12

    for (let i = 0; i < itemCount; i++) {
      let attempts = 0
      let position: {x: number, y: number}

      do {
        position = {
          x: Math.random() * 80 + 10, // 10-90% range
          y: Math.random() * 80 + 10  // 10-90% range
        }
        attempts++
      } while (
        attempts < 80 && (
          Math.sqrt((position.x - centerX) ** 2 + (position.y - centerY) ** 2) < centerRadius ||
          positions.some(pos =>
            Math.sqrt((position.x - pos.x) ** 2 + (position.y - pos.y) ** 2) < minDistance
          )
        )
      )

      positions.push(position)
    }
    return positions
  }

  // Select random target color (avoid consecutive repeats)
  const selectRandomTarget = () => {
    let availableTargets = COLOR_TARGETS.filter(target => target.color !== previousColor.current)
    if (availableTargets.length === 0) availableTargets = COLOR_TARGETS

    const selected = availableTargets[Math.floor(Math.random() * availableTargets.length)]
    previousColor.current = selected.color
    return selected
  }

  // Generate one board's items: 5-6 targets + distractors (count/spread tuned by difficulty).
  const generateGameItems = () => {
    const target = selectRandomTarget()

    const targetObjects = DANISH_OBJECTS[target.color as keyof typeof DANISH_OBJECTS]
    const selectedTargets = shuffle(targetObjects)
      .slice(0, Math.min(6, targetObjects.length))

    const distractorObjects: any[] = []
    const allOtherColors = Object.keys(DANISH_OBJECTS).filter(color => color !== target.color)

    // Static difficulty (progressStore.difficultyFor — no adaptivity). Let: fewer distractor
    // colors (calmer board). Normal (today, unchanged): every other color, 1 distractor each.
    // Svær: every other color, 2 distractors each (+distractors, per Appendix A).
    const difficulty = progressStore.difficultyFor('colors')
    const distractorColors = difficulty === 'let'
      ? shuffle(allOtherColors).slice(0, 3)
      : allOtherColors
    const perColor = difficulty === 'svaer' ? DISTRACTORS_PER_COLOR + 1 : DISTRACTORS_PER_COLOR

    distractorColors.forEach(color => {
      const colorObjects = DANISH_OBJECTS[color as keyof typeof DANISH_OBJECTS]
      const selected = shuffle(colorObjects)
        .slice(0, perColor)
      distractorObjects.push(...selected.map(obj => ({ ...obj, colorName: color })))
    })

    const allObjects = [
      ...selectedTargets.map(obj => ({ ...obj, colorName: target.color, isTarget: true })),
      ...distractorObjects.map(obj => ({ ...obj, isTarget: false }))
    ]

    // Targets first so their slot index (ring + pip alignment) is stable & deterministic.
    const positions = generateRandomPositions(allObjects.length)

    const items: GameItem[] = allObjects.map((obj, index) => ({
      id: `item-${index + 1}`,
      colorName: obj.colorName,
      objectName: obj.objectName,
      objectNameDefinite: obj.objectNameDefinite,
      art: obj.art,
      hex: obj.hex,
      neuter: obj.neuter,
      isTarget: obj.isTarget,
      collected: false,
      returning: false,
      x: positions[index].x,
      y: positions[index].y
    }))

    return { items, targetCount: selectedTargets.length, targetColor: target.color, targetPhrase: target.phrase }
  }

  // Set up a fresh board. `voice=false` skips speaking (used for the instant first reveal).
  const setupBoard = (voice = true) => {
    const { items, targetCount, targetColor: newTargetColor, targetPhrase: newTargetPhrase } = generateGameItems()

    setGameItems(items)
    setTotalTarget(targetCount)
    setTargetColor(newTargetColor)
    setTargetPhrase(newTargetPhrase)
    targetPhraseRef.current = newTargetPhrase
    setBoardKey(k => k + 1)
    setBoardFlourish(false)
    resetHint()
    setBurstAt(null)
    firstAttemptRef.current = true
    isAdvancing.current = false

    if (!voice) return

    const delay = isIOS() ? 100 : 300
    setTimeout(async () => {
      try {
        audio.updateUserInteraction()
        await audio.speakColorHuntInstructions(newTargetPhrase)
      } catch (error) {
        logError('Error speaking color hunt instructions', { phrase: newTargetPhrase, error: error?.toString() })
      }
    }, delay)
  }

  // Instant load: render the playable board RIGHT AWAY without voicing instructions yet. Idempotent.
  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    setupBoard(false)
  }

  // Play the welcome over the already-visible board, then voice the target instructions.
  const playWelcomeThenInstructions = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('farvejagt')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (targetPhraseRef.current && !hasInteractedRef.current) {
      try {
        audio.updateUserInteraction()
        await audio.speakColorHuntInstructions(targetPhraseRef.current)
      } catch (error) {
        logError('Error speaking color hunt instructions', { error: error?.toString() })
      }
    }
  }

  // Initialize game
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    // Instant load: show the playable board immediately (draggable), no waiting on the welcome.
    revealBoard()

    if (audio.isAudioReady) {
      playWelcomeThenInstructions()
    }

    return () => {
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      if (flourishTimer.current) clearTimeout(flourishTimer.current)
      if (burstTimer.current) clearTimeout(burstTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When audio unlocks after mount, play the welcome (board already visible).
  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenInstructions()
    }
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
      'colors.farvejagt',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 }, stickerSetId: stickerSetForSection('colors') },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    setupBoard(true)
  }

  // A board is fully collected → flourish, then advance the round (or finish).
  const handleBoardComplete = () => {
    isAdvancing.current = true // lock out drops during the flourish so a late drop can't fail a perfect board (P3)
    reactGuide('cheer')
    setBoardFlourish(true)
    celebrateTier('streak') // board-complete: bigger confetti burst timed with the ring spin
    if (flourishTimer.current) clearTimeout(flourishTimer.current)
    flourishTimer.current = setTimeout(() => {
      setBoardFlourish(false)
      const r = round.completeQuestion(firstAttemptRef.current)
      if (!r.done && r.streak > 0 && r.streak % 3 === 0) {
        celebrateTier('streak')
        mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
      }
      if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
      else setupBoard(true)
    }, reduce ? 250 : FLOURISH_MS)
  }

  // Handle drag start — the draggable LIFTS (§6C shared drag juice) via `activeId` in the render.
  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(event.active.id as string)
    sfx.play('pick-up')
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    clearActive()
    if (isAdvancing.current) return // board-complete flourish in progress → ignore late drops (P3)

    const draggedItem = gameItems.find(item => item.id === active.id)
    if (!draggedItem || draggedItem.collected) return
    if (!over || over.id !== 'target-zone') return // dropped elsewhere → springs back automatically

    if (draggedItem.isTarget) {
      // Correct: SNAP into the collected ring with a splash burst + sound, keep the spoken
      // reinforcement. The burst is positioned at this item's stable ring slot.
      sfx.play('drop-snap')
      const targetItemsNow = gameItems.filter(i => i.isTarget)
      const slotIndex = targetItemsNow.findIndex(i => i.id === draggedItem.id)
      const collectedTargetsNow = targetItemsNow.filter(i => i.collected).length
      setGameItems(prev => prev.map(item =>
        item.id === active.id ? { ...item, collected: true } : item
      ))
      setHintItemId(null)
      celebrateTier('micro')
      reactGuide('cheer')

      if (slotIndex >= 0) {
        setBurstAt({ slot: slotIndex, hex: draggedItem.hex })
        if (burstTimer.current) clearTimeout(burstTimer.current)
        burstTimer.current = setTimeout(() => setBurstAt(null), 550)
      }

      // Identify the object's colour (educational echo). No win/lose narration.
      audio.cancelCurrentAudio()
      audio.speak(`${draggedItem.objectNameDefinite} er ${spokenColor(draggedItem.colorName, draggedItem.neuter)}`).catch(() => {})

      if (collectedTargetsNow + 1 >= totalTarget) {
        handleBoardComplete()
      }
    } else {
      // Wrong: springs back + gentle SFX + guide reacts; break the board's first-try flag.
      firstAttemptRef.current = false
      sfx.play('spring-back')
      reactGuide('think')
      setGameItems(prev => prev.map(item =>
        item.id === active.id ? { ...item, returning: true } : item
      ))
      setTimeout(() => {
        setGameItems(prev => prev.map(item =>
          item.id === active.id ? { ...item, returning: false } : item
        ))
      }, 500)

      // Identify the dropped object's colour (educational echo). No win/lose narration.
      audio.cancelCurrentAudio()
      audio.speak(`${draggedItem.objectNameDefinite} er ${spokenColor(draggedItem.colorName, draggedItem.neuter)}`).catch(() => {})

      // After N wrong drops on this board, pulse an uncollected target (never-fail scaffold).
      if (registerHintWrong(() => gameItems.find(i => i.isTarget && !i.collected)?.id ?? null)) {
        mascotBus.emit('hint')
      }
    }
  }

  // Repeat current target instructions
  const repeatInstructions = () => {
    audio.updateUserInteraction()
    if (!gameReady || !targetColor) return
    try {
      const phrase = COLOR_TARGETS.find(target => target.color === targetColor)?.phrase || 'Find alle røde ting'
      audio.speakColorHuntInstructions(phrase).catch(() => {})
    } catch {
      // Ignore audio errors
    }
  }

  // Forced ?fx= states (DEV screenshot harness) — pure render-time overrides layered on the real
  // gameItems, never mutating state. 'correct' marks the first target collected (shows the SNAP +
  // splash into the ring); 'wrong' marks the first board item as returning (spring-back visual).
  const firstTargetId = gameItems.find(i => i.isTarget)?.id ?? null
  const displayGameItems =
    forcedFx === 'correct' && firstTargetId
      ? gameItems.map(i => (i.id === firstTargetId ? { ...i, collected: true } : i))
      : forcedFx === 'wrong' && gameItems.length > 0
        ? gameItems.map((i, idx) => (idx === 0 ? { ...i, returning: true } : i))
        : gameItems

  const targetItems = displayGameItems.filter(i => i.isTarget)
  const collectedCount = targetItems.filter(i => i.collected).length
  const boardItems = displayGameItems.filter(i => !i.collected) // distractors + uncollected targets
  const targetHex = getTargetColorHex()
  const displayHintItemId = forcedFx === 'hint' ? (hintItemId ?? targetItems.find(i => !i.collected)?.id ?? null) : hintItemId
  // Position of the in-flight splash burst (§6C: "collected items pour into the ring with a splash").
  const burstPos = burstAt ? ringSlotPx(burstAt.slot, totalTarget, RING_RADIUS) : null
  const isOverWell = overId === 'target-zone'

  // Live difficulty: rebuild the current board when the level changes in the adult menu (no
  // refresh). Skips the result screen + the initial mount.
  const difficultyLevel = useDifficulty('colors')
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (roundOutcome || !gameReady) return
    setupBoard()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameShell
      categoryId="colors"
      title="Farvejagt"
      backRoute="/farver"
      dense
      guideReaction={guideReaction}
      score={
        <ColorProgressChip
          answered={round.state.index}
          total={ROUND_BOARDS}
          onClick={repeatInstructions}
        />
      }
      celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
    >
      {roundOutcome ? (
        <RoundResultScreen
          outcome={roundOutcome}
          categoryId="colors"
          backRoute="/farver"
          onReplay={handleReplay}
        />
      ) : gameReady && (
        <>
          {/* Phone landscape: prompt pill + repeat button share ONE row (display:contents
              keeps the stacked layout everywhere else) — the board gets the saved height. */}
          <Box
            sx={{
              display: 'contents',
              [PHONE_LANDSCAPE]: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                mb: 0.75,
                flex: '0 0 auto',
              },
            }}
          >
          {/* Target prompt pill — accent carries the educational target hex so a non-reader
              sees which color to hunt. */}
          <Box sx={{ display: 'flex', justifyContent: 'center', flex: '0 0 auto', mb: { xs: 1, md: 1.5 }, [PHONE_LANDSCAPE]: { mb: 0 } }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: { xs: 2, md: 2.5 },
                py: { xs: 0.75, md: 1 },
                borderRadius: 999,
                bgcolor: muiTheme.scene.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)',
                border: `3px solid ${targetHex}`,
                boxShadow: muiTheme.customShadows?.card ?? '0 6px 18px rgba(0,0,0,0.12)'
              }}
            >
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: targetHex, border: '2px solid rgba(255,255,255,0.85)', flex: '0 0 auto' }} />
              <Typography
                sx={{
                  fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
                  fontWeight: 700,
                  fontSize: 'clamp(1rem, 3.2vw, 1.4rem)',
                  color: muiTheme.scene.dark ? 'white' : 'text.primary'
                }}
              >
                {targetPhrase}
              </Typography>
            </Box>
          </Box>

          {/* Repeat Instructions Button */}
          <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto', [PHONE_LANDSCAPE]: { mb: 0 } }}>
            <ColorRepeatButton onClick={repeatInstructions} disabled={false} />
          </Box>
          </Box>

          {/* Game area — PRD-09: NO framed board. The objects rest directly on the calm frozen
              world (F3); the container is transparent and just anchors the absolute scatter. */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'visible',
              minHeight: 0
            }}
          >
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={onDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={clearActive}
              collisionDetection={kidCollision}
            >
              {/* Centred target zone wrapper: holds the drop circle, the collected ring, and the pips. */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: CIRCLE,
                  height: CIRCLE,
                  zIndex: 0,
                }}
              >
                {/* Glowing collection well — ambient halo behind the ring (§6C Farvejagt delta). */}
                <motion.div
                  aria-hidden
                  animate={reduce ? { opacity: 0.5 } : { opacity: [0.35, 0.6, 0.35] }}
                  transition={reduce ? { duration: 0 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    inset: -18,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${targetHex}55 0%, ${targetHex}00 70%)`,
                    filter: 'blur(6px)',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />

                <motion.div
                  animate={isOverWell && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={isOverWell && !reduce ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                  style={{ position: 'relative', width: '100%', height: '100%', zIndex: 0 }}
                >
                  <DroppableZone
                    id="target-zone"
                    overColor={`${targetHex}33`}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      // Inviting, high-contrast collection well (PRD-14 W6 / audit §A6): a clearly
                      // colour-tinted "basket" with a concave inset shadow, so a 5yo's every drag
                      // aims at an obvious destination instead of a near-invisible 10% outline. The
                      // over-glow + scale pulse (parent) still signal the hover; overColor unchanged.
                      border: `5px dashed ${targetHex}`,
                      backgroundColor: `${targetHex}40`, // ~25% educational tint (was 10%)
                      boxShadow: isOverWell
                        ? `0 0 22px ${targetHex}99, inset 0 8px 18px rgba(0,0,0,0.22)`
                        : `inset 0 8px 18px rgba(0,0,0,0.20)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'auto',
                      transition: 'box-shadow 0.25s ease',
                    }}
                  />
                </motion.div>

                {/* Progress pips around the circle perimeter — one per target item. */}
                {targetItems.map((_, slot) => {
                  const lit = slot < collectedCount
                  const { left, top } = ringSlotPx(slot, totalTarget, CIRCLE / 2)
                  return (
                    <motion.div
                      key={`pip-${slot}`}
                      initial={false}
                      animate={reduce ? { scale: lit ? 1 : 0.85 } : { scale: lit ? [1, 1.4, 1] : 0.85 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: 14,
                        height: 14,
                        marginLeft: -7,
                        marginTop: -7,
                        borderRadius: '50%',
                        backgroundColor: lit ? targetHex : (muiTheme.scene.dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)'),
                        border: '2px solid rgba(255,255,255,0.85)',
                        boxShadow: lit ? `0 0 8px ${targetHex}` : 'none',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    />
                  )
                })}

                {/* Collected ring — items pour into their slot with a pop; the whole ring spins on
                    board win. */}
                <motion.div
                  animate={boardFlourish && !reduce ? { rotate: [0, 360], scale: [1, 1.12, 1] } : { rotate: 0, scale: 1 }}
                  transition={boardFlourish && !reduce ? { duration: 0.65, ease: 'easeInOut' } : { duration: 0 }}
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
                >
                  {targetItems.map((item, slot) => {
                    if (!item.collected) return null
                    const { left, top } = ringSlotPx(slot, totalTarget, RING_RADIUS)
                    return (
                      <motion.div
                        key={`collected-${item.id}`}
                        initial={reduce ? false : { scale: 0, opacity: 0, y: -16 }}
                        animate={reduce ? { scale: 1, opacity: 1, y: 0 } : { scale: [0, 1.25, 1], opacity: 1, y: 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.45, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width: COLLECTED_SIZE,
                          height: COLLECTED_SIZE,
                          marginLeft: -COLLECTED_SIZE / 2,
                          marginTop: -COLLECTED_SIZE / 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {/* Collected: the baked object rests in its ring slot (no hex tile). */}
                        <ObjectArt art={item.art} size={COLLECTED_SIZE} elevation={1} alt={item.objectName} />
                      </motion.div>
                    )
                  })}

                  {/* Localized splash burst on a fresh capture. */}
                  {burstAt && burstPos && !reduce && (
                    <motion.div
                      key={`burst-${burstAt.slot}`}
                      initial={{ scale: 0.4, opacity: 0.9 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      style={{
                        position: 'absolute',
                        left: burstPos.left,
                        top: burstPos.top,
                        width: COLLECTED_SIZE,
                        height: COLLECTED_SIZE,
                        marginLeft: -COLLECTED_SIZE / 2,
                        marginTop: -COLLECTED_SIZE / 2,
                        borderRadius: '50%',
                        backgroundColor: burstAt.hex,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </motion.div>
              </div>

              {/* Scattered, draggable board items (uncollected). */}
              {boardItems.map((item, index) => {
                const isHint = item.id === displayHintItemId
                const isLifted = activeId === item.id
                const tileAnimate = isLifted && !reduce
                  ? { scale: 1.14, opacity: 1, rotate: -6 }
                  : isHint && !reduce
                    ? { scale: [1, 1.15, 1], opacity: 1, rotate: 0 }
                    : { scale: 1, opacity: 1, rotate: 0 }
                const tileTransition = isLifted && !reduce
                  ? { type: 'spring' as const, stiffness: 600, damping: 26 }
                  : isHint && !reduce
                    ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
                    : { duration: 0.35, delay: reduce ? 0 : Math.min(index * 0.04, 0.5), ease: 'easeOut' as const }
                return (
                  <DraggableItem
                    key={item.id}
                    id={item.id}
                    disabled={!gameReady || item.returning}
                    position={{ x: item.x, y: item.y }}
                    data={item}
                  >
                    <motion.div
                      key={`${boardKey}-${item.id}`}
                      initial={reduce ? false : { scale: 0, opacity: 0 }}
                      animate={tileAnimate}
                      transition={tileTransition}
                      style={{ width: 80, height: 80, transformOrigin: '0 0' }}
                    >
                      {/* PRD-09: a baked object RESTING in the world — no hex tile, no border, no
                          keyboard lip. Depth comes from ObjectArt's softShadow; the hint adds an
                          accent glow, the lift raises the shadow. */}
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'translate(-50%, -50%)',
                          animation: item.returning ? 'farvejagt-shake 0.5s' : undefined,
                          cursor: 'grab',
                          filter: isHint && !reduce ? `drop-shadow(0 0 10px ${targetHex})` : undefined,
                          '&:hover': {
                            transform: !item.returning ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%)',
                          }
                        }}
                      >
                        <ObjectArt art={item.art} size={80} elevation={isLifted ? 3 : 1} alt={item.objectName} />
                      </Box>
                    </motion.div>
                  </DraggableItem>
                )
              })}
            </DndContext>
          </Box>

          {/* CSS animations */}
          <style>
            {`
              @keyframes farvejagt-shake {
                0%, 100% { transform: translate(-50%, -50%) translateX(0); }
                25% { transform: translate(-50%, -50%) translateX(-10px) rotate(-5deg); }
                75% { transform: translate(-50%, -50%) translateX(10px) rotate(5deg); }
              }
            `}
          </style>
        </>
      )}
    </GameShell>
  )
}

export default FarvejagtGame
