import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCenter } from '@dnd-kit/core'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { ColorRepeatButton } from '../common/RepeatButton'
import { ColorProgressChip } from '../common/ScoreChip'
import { getCategoryTheme } from '../../config/categoryThemes'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import { isIOS } from '../../utils/deviceDetection'
import { DANISH_OBJECTS, COLOR_TARGETS } from '../../config/colorContent'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// ── Tuning levers (static difficulty — edit here, no adaptive logic) ──────────────────────────
const ROUND_BOARDS = 5            // boards (questions) per round → RoundResultScreen
const DISTRACTORS_PER_COLOR = 1   // calmer ~12-item board (was 2)
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
  emoji: string
  hex: string
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
  const t = getCategoryTheme('colors')

  // Game state
  const [gameItems, setGameItems] = useState<GameItem[]>([])
  const [totalTarget, setTotalTarget] = useState(0)
  const [, setActiveId] = useState<string | null>(null)
  const [targetColor, setTargetColor] = useState<string>('rød')
  const [targetPhrase, setTargetPhrase] = useState<string>('Find alle røde ting')
  const [boardKey, setBoardKey] = useState(0)       // bumped per board → re-triggers scatter-in
  const [boardFlourish, setBoardFlourish] = useState(false)
  const [hintItemId, setHintItemId] = useState<string | null>(null)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'FarvejagtGame',
    autoInitialize: false
  })
  const [gameReady, setGameReady] = useState(false)

  // Bounded round + reward flow (Overhaul Farver §Farvejagt). 5 boards, 3★ = 0 wrong-drop boards, 2★ ≤ 2.
  const round = useRound({ length: ROUND_BOARDS, starThresholds: { three: 0, two: 2 } })
  const firstAttemptRef = useRef(true)   // first-try flag for the CURRENT board
  const boardWrongRef = useRef(0)        // wrong drops on the CURRENT board (drives the hint)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Celebration (corner guide reacts via guideReaction)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flourishTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInitialized = useRef(false)
  const previousColor = useRef<string>('')
  const startedRef = useRef(false)
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

  // Get target color hex for UI elements (educational data — the hunted color must read true)
  const getTargetColorHex = () => {
    const colorObjects = DANISH_OBJECTS[targetColor as keyof typeof DANISH_OBJECTS]
    return colorObjects?.[0]?.hex || '#dc2626'
  }

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

  // Generate one board's items: 5-6 targets + DISTRACTORS_PER_COLOR per other color (~12 total)
  const generateGameItems = () => {
    const target = selectRandomTarget()

    const targetObjects = DANISH_OBJECTS[target.color as keyof typeof DANISH_OBJECTS]
    const selectedTargets = targetObjects
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(6, targetObjects.length))

    const distractorObjects: any[] = []
    const otherColors = Object.keys(DANISH_OBJECTS).filter(color => color !== target.color)

    otherColors.forEach(color => {
      const colorObjects = DANISH_OBJECTS[color as keyof typeof DANISH_OBJECTS]
      const selected = colorObjects
        .sort(() => Math.random() - 0.5)
        .slice(0, DISTRACTORS_PER_COLOR) // calmer board
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
      emoji: obj.emoji,
      hex: obj.hex,
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
    setHintItemId(null)
    firstAttemptRef.current = true
    boardWrongRef.current = 0

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

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'colors.farvejagt',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 } },
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
    reactGuide('cheer')
    setBoardFlourish(true)
    if (flourishTimer.current) clearTimeout(flourishTimer.current)
    flourishTimer.current = setTimeout(() => {
      setBoardFlourish(false)
      const r = round.completeQuestion(firstAttemptRef.current)
      if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
      if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
      else setupBoard(true)
    }, reduce ? 250 : FLOURISH_MS)
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(event.active.id as string)
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    // The child is playing → suppress any pending/late welcome from talking over them.
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    setActiveId(null)

    const draggedItem = gameItems.find(item => item.id === active.id)
    if (!draggedItem || draggedItem.collected) return
    if (!over || over.id !== 'target-zone') return // dropped elsewhere → snaps back automatically

    if (draggedItem.isTarget) {
      // Correct: snap into the collected ring with a pop + sound, keep the spoken reinforcement.
      sfx.play('drop-snap')
      const collectedTargetsNow = gameItems.filter(i => i.isTarget && i.collected).length
      setGameItems(prev => prev.map(item =>
        item.id === active.id ? { ...item, collected: true } : item
      ))
      setHintItemId(null)
      celebrateTier('micro')
      reactGuide('cheer')

      audio.cancelCurrentAudio()
      audio.speak(`${draggedItem.objectNameDefinite} er ${draggedItem.colorName}`).catch(() => {})

      if (collectedTargetsNow + 1 >= totalTarget) {
        handleBoardComplete()
      }
    } else {
      // Wrong: bounce back + gentle SFX + guide reacts; break the board's first-try flag.
      firstAttemptRef.current = false
      sfx.play('wrong')
      reactGuide('think')
      setGameItems(prev => prev.map(item =>
        item.id === active.id ? { ...item, returning: true } : item
      ))
      setTimeout(() => {
        setGameItems(prev => prev.map(item =>
          item.id === active.id ? { ...item, returning: false } : item
        ))
      }, 500)

      audio.cancelCurrentAudio()
      audio.speak(`${draggedItem.objectNameDefinite} er ${draggedItem.colorName}`).catch(() => {})

      // After N wrong drops on this board, pulse an uncollected target (never-fail scaffold).
      boardWrongRef.current += 1
      if (boardWrongRef.current >= WRONG_DROPS_BEFORE_HINT) {
        const hint = gameItems.find(i => i.isTarget && !i.collected)
        if (hint) setHintItemId(hint.id)
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

  const targetItems = gameItems.filter(i => i.isTarget)
  const collectedCount = targetItems.filter(i => i.collected).length
  const boardItems = gameItems.filter(i => !i.collected) // distractors + uncollected targets
  const targetHex = getTargetColorHex()

  // Token-driven board surface (educational color hexes stay as data; chrome reads from theme).
  const boardBg = muiTheme.scene.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)'

  return (
    <GameShell
      categoryId="colors"
      title="Farvejagt"
      backRoute="/farver"
      dense
      guideReaction={guideReaction}
      score={
        <ColorProgressChip
          score={round.state.index}
          target={ROUND_BOARDS}
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
          {/* Target prompt pill — accent carries the educational target hex so a non-reader
              sees which color to hunt. */}
          <Box sx={{ display: 'flex', justifyContent: 'center', flex: '0 0 auto', mb: { xs: 1, md: 1.5 } }}>
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
          <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
            <ColorRepeatButton onClick={repeatInstructions} disabled={false} label="🎵 Hør igen" />
          </Box>

          {/* Game area */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              backgroundColor: boardBg,
              borderRadius: 4,
              border: `3px solid ${t.borderColor}`,
              boxShadow: muiTheme.customShadows?.card ?? 3,
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            <DndContext
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              collisionDetection={closestCenter}
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
                <DroppableZone
                  id="target-zone"
                  overColor={`${targetHex}33`}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `4px dashed ${targetHex}`,
                    backgroundColor: `${targetHex}1A`, // 10% opacity educational tint
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto',
                  }}
                />

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

                {/* Collected ring — items snap-pop into their slot; the whole ring spins on board win. */}
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
                        initial={reduce ? false : { scale: 0, opacity: 0 }}
                        animate={reduce ? { scale: 1, opacity: 1 } : { scale: [0, 1.25, 1], opacity: 1 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width: COLLECTED_SIZE,
                          height: COLLECTED_SIZE,
                          marginLeft: -COLLECTED_SIZE / 2,
                          marginTop: -COLLECTED_SIZE / 2,
                          borderRadius: 10,
                          backgroundColor: item.hex,
                          border: '2px solid white',
                          boxShadow: '0 3px 10px rgba(0,0,0,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography sx={{ fontSize: '1.5rem', lineHeight: 1, userSelect: 'none' }}>{item.emoji}</Typography>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </div>

              {/* Scattered, draggable board items (uncollected). */}
              {boardItems.map((item, index) => {
                const isHint = item.id === hintItemId
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
                      animate={
                        isHint && !reduce
                          ? { scale: [1, 1.15, 1], opacity: 1 }
                          : { scale: 1, opacity: 1 }
                      }
                      transition={
                        isHint && !reduce
                          ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
                          : { duration: 0.35, delay: reduce ? 0 : Math.min(index * 0.04, 0.5), ease: 'easeOut' }
                      }
                      style={{ width: 80, height: 80, transformOrigin: '0 0' }}
                    >
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          backgroundColor: item.hex,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isHint
                            ? `0 0 0 5px ${targetHex}88, 0 4px 12px rgba(0,0,0,0.25)`
                            : 3,
                          border: '2px solid white',
                          transform: 'translate(-50%, -50%)',
                          transition: 'box-shadow 0.3s ease',
                          animation: item.returning ? 'farvejagt-shake 0.5s' : undefined,
                          cursor: 'grab',
                          '&:hover': {
                            transform: !item.returning ? 'translate(-50%, -50%) scale(1.05)' : 'translate(-50%, -50%)',
                          }
                        }}
                      >
                        <Typography sx={{ fontSize: '2.5rem', lineHeight: 1, userSelect: 'none' }}>
                          {item.emoji}
                        </Typography>
                      </Box>
                    </motion.div>
                  </DraggableItem>
                )
              })}

              <DragOverlay>{null}</DragOverlay>
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
