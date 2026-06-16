import React, { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { DndContext, DragEndEvent, DragStartEvent, closestCenter } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { ColorProgressChip } from '../common/ScoreChip'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { ColorRepeatButton } from '../common/RepeatButton'
import { getCategoryTheme } from '../../config/categoryThemes'
import { useRound } from '../../hooks/useRound'
import { progressStore, type RoundOutcome } from '../../services/progressStore'
import { sfx } from '../../services/sfxClient'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import GameShell from '../common/GameShell'
import RoundResultScreen from '../common/RoundResultScreen'
import { isIOS } from '../../utils/deviceDetection'
// Simplified audio system
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// ── Tuning levers (static difficulty — edit here, no adaptive logic) ──────────────────────────
const ROUND_MIXES = 8              // correct mixes (questions) per round → RoundResultScreen
const WRONG_MIXES_BEFORE_HINT = 2  // pulse the 2 correct droplets after this many wrong mixes
const BLEND_MS = 600               // swirl/merge animation duration
const REVEAL_MS = 1900             // recipe-reveal hold (lets the spoken rule play)
const FIZZ_MS = 950                // wrong-mix "fizz out" before the pot resets

// Game interfaces
interface ColorDroplet {
  id: string
  color: string
  colorName: string
  hex: string
  emoji: string
  isUsed: boolean
}

interface TargetColor {
  color: string
  name: string
  hex: string
}

interface BlendResult {
  hex: string         // the colour the pot fills with
  name: string | null // the rule's result name (null = no rule for this combo)
  isCorrect: boolean
}

interface RecipeReveal {
  aHex: string
  bHex: string
  targetHex: string
  aName: string
  bName: string
  targetName: string
}

// ── Educational color data + pure helpers (module scope: not themeable, not render-derived) ───
const primaryColors: ColorDroplet[] = [
  { id: 'red', color: 'rød', colorName: 'rød', hex: '#EF4444', emoji: '💧', isUsed: false },
  { id: 'blue', color: 'blå', colorName: 'blå', hex: '#3B82F6', emoji: '💧', isUsed: false },
  { id: 'yellow', color: 'gul', colorName: 'gul', hex: '#FDE047', emoji: '💧', isUsed: false },
  { id: 'white', color: 'hvid', colorName: 'hvid', hex: '#F8FAFC', emoji: '💧', isUsed: false },
  { id: 'black', color: 'sort', colorName: 'sort', hex: '#1F2937', emoji: '💧', isUsed: false }
]

const possibleTargets: TargetColor[] = [
  // Secondary colors (two primaries)
  { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  { color: 'orange', name: 'orange', hex: '#F97316' },
  { color: 'grøn', name: 'grøn', hex: '#10B981' },
  // Tints (primary + white)
  { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  // Shades (primary + black) and grey
  { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  { color: 'grå', name: 'grå', hex: '#9CA3AF' }
]

const mixingRules: Record<string, TargetColor> = {
  // Secondaries
  'rød+blå': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  'blå+rød': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  'rød+gul': { color: 'orange', name: 'orange', hex: '#F97316' },
  'gul+rød': { color: 'orange', name: 'orange', hex: '#F97316' },
  'blå+gul': { color: 'grøn', name: 'grøn', hex: '#10B981' },
  'gul+blå': { color: 'grøn', name: 'grøn', hex: '#10B981' },
  // Tints (+ white)
  'rød+hvid': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  'hvid+rød': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  'blå+hvid': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  'hvid+blå': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  'gul+hvid': { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  'hvid+gul': { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  // Shades (+ black)
  'rød+sort': { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  'sort+rød': { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  'blå+sort': { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  'sort+blå': { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  'sort+hvid': { color: 'grå', name: 'grå', hex: '#9CA3AF' },
  'hvid+sort': { color: 'grå', name: 'grå', hex: '#9CA3AF' }
}

const shuffleArray = (array: ColorDroplet[]): ColorDroplet[] => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// The 2 source colors that mix to a target (for the recipe reveal + hint).
const recipeFor = (targetName: string): [ColorDroplet, ColorDroplet] | null => {
  for (const key of Object.keys(mixingRules)) {
    if (mixingRules[key].name === targetName) {
      const [n1, n2] = key.split('+')
      const d1 = primaryColors.find(c => c.colorName === n1)
      const d2 = primaryColors.find(c => c.colorName === n2)
      if (d1 && d2) return [d1, d2]
    }
  }
  return null
}

const RamFarvenGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()

  // Game state (educational color data — NOT themeable)
  const [targetColor, setTargetColor] = useState<TargetColor>({ color: 'lilla', name: 'lilla', hex: '#A855F7' })
  const [availableColors, setAvailableColors] = useState<ColorDroplet[]>([])
  const [mixingZone, setMixingZone] = useState<ColorDroplet[]>([])
  const [committing, setCommitting] = useState(false)     // locks drops during blend/reveal/fizz
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null)
  const [recipe, setRecipe] = useState<RecipeReveal | null>(null)
  const [hintActive, setHintActive] = useState(false)

  // Simplified audio system
  const audio = useSimplifiedAudioHook({
    componentId: 'RamFarvenGame',
    autoInitialize: false
  })
  const [, setActiveId] = useState<string | null>(null)
  const [gameReady, setGameReady] = useState(false)

  // Bounded round + reward flow (Overhaul Farver §Ram Farven). 8 mixes, 3★ = 0 wrong mixes, 2★ ≤ 2.
  const round = useRound({ length: ROUND_MIXES, starThresholds: { three: 0, two: 2 } })
  const firstAttemptRef = useRef(true)  // first-try flag for the CURRENT target
  const targetWrongRef = useRef(0)      // wrong mixes on the CURRENT target (drives the hint)
  const [roundOutcome, setRoundOutcome] = useState<RoundOutcome | null>(null)

  // Celebration (corner guide reacts via guideReaction)
  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInitialized = useRef(false)
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  const targetNameRef = useRef<string>('')
  const hasInteractedRef = useRef(false)

  const logError = (message: string, data?: any) => {
    if (message.includes('Error') || message.includes('error')) {
      console.error(`🎵 RamFarvenGame: ${message}`, data)
    }
  }

  const reactGuide = (reaction: GuideReaction) => {
    setGuideReaction(reaction)
    if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
    guideReactionTimer.current = setTimeout(() => setGuideReaction(null), 1100)
  }

  // Initialize game
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    revealBoard()

    if (audio.isAudioReady) {
      playWelcomeThenInstructions()
    }

    return () => {
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      if (commitTimer.current) clearTimeout(commitTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) {
      playWelcomeThenInstructions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  const revealBoard = () => {
    if (startedRef.current) return
    startedRef.current = true
    setGameReady(true)
    setupTarget(false)
  }

  const playWelcomeThenInstructions = async () => {
    if (welcomeTriggered.current || hasInteractedRef.current) return
    welcomeTriggered.current = true
    try {
      await audio.playGameWelcome('ramfarven')
    } catch (error) {
      logError('Error playing welcome', { error: error?.toString() })
    }
    if (targetNameRef.current && !hasInteractedRef.current) {
      try {
        audio.updateUserInteraction()
        await audio.speakColorMixingInstructions(targetNameRef.current)
      } catch (error) {
        logError('Error speaking color mixing instructions', { error: error?.toString() })
      }
    }
  }

  // Set up a fresh target. `voice=false` skips speaking (used for the instant first reveal).
  // `prevHex` lets the caller avoid an immediate repeat (state read in the closure may be stale
  // inside chained timeouts, so the caller passes the just-finished target's hex explicitly).
  const setupTarget = (voice = true, prevHex?: string) => {
    const avoid = prevHex ?? targetColor?.hex
    const pool = avoid ? possibleTargets.filter(target => target.hex !== avoid) : possibleTargets
    const next = pool[Math.floor(Math.random() * pool.length)]
    targetNameRef.current = next.name

    setTargetColor(next)
    setAvailableColors(shuffleArray(primaryColors))
    setMixingZone([])
    setBlendResult(null)
    setRecipe(null)
    setHintActive(false)
    setCommitting(false)
    firstAttemptRef.current = true
    targetWrongRef.current = 0

    if (voice) {
      const delay = isIOS() ? 100 : 300
      setTimeout(async () => {
        try {
          audio.updateUserInteraction()
          await audio.speakColorMixingInstructions(next.name)
        } catch (error) {
          logError('Error speaking color mixing instructions', { targetColor: next.name, error: error?.toString() })
        }
      }, delay)
    }
  }

  const finishRound = (firstTryCorrect: number, longestStreak: number) => {
    const outcome = progressStore.recordRoundResult(
      'colors.ramfarven',
      { correct: firstTryCorrect, total: round.length, longestStreak },
      { starThresholds: { three: 0, two: 2 } },
    )
    setRoundOutcome(outcome)
  }

  const handleReplay = () => {
    stopCelebration()
    setRoundOutcome(null)
    round.reset()
    setupTarget(true)
  }

  const repeatInstructions = async () => {
    audio.updateUserInteraction()
    if (!gameReady || !targetColor) return
    try {
      await audio.speakColorMixingInstructions(targetColor.name)
    } catch (error) {
      logError('Error repeating color mixing instructions', { targetColor: targetColor.name, error: error?.toString() })
    }
  }

  // Tapping the goal swatch speaks just the target color name ("lilla") — distinct from the
  // "Hør igen" button which replays the full "Ram farven: X" instruction.
  const speakTargetColor = () => {
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()
    if (!gameReady || !targetColor) return
    audio.speak(targetColor.name).catch(() => {})
  }

  // Empty the pot (Tøm button) — a mis-dragged droplet isn't a forced wrong attempt.
  const emptyPot = () => {
    if (committing) return
    audio.updateUserInteraction()
    setMixingZone([])
    setBlendResult(null)
    setAvailableColors(prev => prev.map(c => ({ ...c, isUsed: false })))
  }

  const addToMixingZone = (droplet: ColorDroplet) => {
    if (committing || mixingZone.length >= 2) return

    const updatedDroplet = { ...droplet, isUsed: true }
    const newMixingZone = [...mixingZone, updatedDroplet]
    setMixingZone(newMixingZone)
    setAvailableColors(prev => prev.map(color =>
      color.id === droplet.id ? updatedDroplet : color
    ))

    sfx.play('tap')
    try {
      audio.speak(droplet.colorName).catch(() => {})
    } catch {
      // ignore
    }

    if (newMixingZone.length === 2) {
      commitMix(newMixingZone)
    }
  }

  // Two droplets in the pot → swirl/blend over BLEND_MS, then resolve correct/wrong.
  const commitMix = (colorsToMix: ColorDroplet[]) => {
    setCommitting(true)
    const [c1, c2] = colorsToMix
    const key = `${c1.colorName}+${c2.colorName}`
    const result = mixingRules[key]
    const isCorrect = !!result && result.name === targetColor.name
    const fillHex = result ? result.hex : `color-mix(in srgb, ${c1.hex} 50%, ${c2.hex} 50%)`

    setBlendResult({ hex: fillHex, name: result?.name ?? null, isCorrect })

    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      if (isCorrect && result) handleCorrectMix(c1, c2, result)
      else handleWrongMix()
    }, BLEND_MS)
  }

  const handleCorrectMix = (c1: ColorDroplet, c2: ColorDroplet, result: TargetColor) => {
    sfx.play('drop-snap')
    celebrateTier('micro')
    reactGuide('cheer')

    // Recipe reveal: 🔴 + 🔵 = 🟣 (visual card only — no spoken rule; owner request).
    setRecipe({ aHex: c1.hex, bHex: c2.hex, targetHex: result.hex, aName: c1.colorName, bName: c2.colorName, targetName: result.name })

    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      setRecipe(null)
      const r = round.completeQuestion(firstAttemptRef.current)
      if (!r.done && r.streak > 0 && r.streak % 3 === 0) celebrateTier('streak')
      if (r.done) finishRound(r.firstTryCorrect, r.longestStreak)
      else setupTarget(true, result.hex)
    }, reduce ? 1200 : REVEAL_MS)
  }

  const handleWrongMix = () => {
    firstAttemptRef.current = false
    sfx.play('wrong')
    reactGuide('think')
    // Wrong = SFX (wrong) + the brief wrong-colour fizz visual only; no spoken feedback (owner request).

    // After N wrong mixes on this target, pulse the 2 correct droplets (never-fail scaffold).
    targetWrongRef.current += 1
    if (targetWrongRef.current >= WRONG_MIXES_BEFORE_HINT) setHintActive(true)

    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      // Fizz out: clear the pot, restore the droplets.
      setMixingZone([])
      setBlendResult(null)
      setAvailableColors(prev => prev.map(c => ({ ...c, isUsed: false })))
      setCommitting(false)
    }, reduce ? 500 : FIZZ_MS)
  }

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    hasInteractedRef.current = true
    setActiveId(null)

    if (!over || over.id !== 'mixing-zone') return

    const draggedColor = availableColors.find(color => color.id === active.id)
    if (draggedColor && !draggedColor.isUsed && !committing && mixingZone.length < 2) {
      addToMixingZone(draggedColor)
    }
  }

  // Hint: which source colorNames make the current target.
  const recipePair = hintActive ? recipeFor(targetColor.name) : null
  const recipeNames = recipePair ? [recipePair[0].colorName, recipePair[1].colorName] : []

  // Pot fill: the blended colour while committing, else a neutral wash.
  const potFill = blendResult ? blendResult.hex : 'rgba(255, 255, 255, 0.4)'
  // Token-driven framed-board surface (mirrors Farvejagt); educational hexes stay as data.
  const boardBg = muiTheme.scene.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)'
  const comicFont = '"Comic Sans MS", "Comic Neue", sans-serif'
  // Goal swatch + pot share ONE size so the two circles read as a balanced pair and line up on the
  // same centre line (smaller in landscape so the goal→pot row AND the droplet tray fit with no
  // scroll). The "below-circle reserve" (label + Tøm slot) is mirrored on both columns so their
  // heights match and the circles stay vertically centred relative to each other.
  const circleSizeSx = {
    width: { xs: 144, sm: 168, md: 192, lg: 208 },
    height: { xs: 144, sm: 168, md: 192, lg: 208 },
    '@media (orientation: landscape)': {
      width: { xs: 120, sm: 140, md: 158, lg: 172 },
      height: { xs: 120, sm: 140, md: 158, lg: 172 },
    },
  }

  return (
    <GameShell
      categoryId="colors"
      title="Ram Farven"
      backRoute="/farver"
      dense
      guideReaction={guideReaction}
      score={
        <ColorProgressChip
          score={round.state.index}
          target={ROUND_MIXES}
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
          {/* Repeat Instructions Button (replays the spoken "Ram farven: X" target). */}
          <Box sx={{ textAlign: 'center', mb: { xs: 0.75, md: 1 }, flex: '0 0 auto' }}>
            <ColorRepeatButton onClick={repeatInstructions} disabled={false} label="🎵 Hør igen" />
          </Box>

          {/* Framed play board (mirrors Farvejagt): a contained stage that fills the remaining
              space so the goal→pot row and the droplet tray are always balanced and never scroll. */}
          <Box
            sx={{
              flex: 1,
              position: 'relative',
              backgroundColor: boardBg,
              borderRadius: 4,
              border: `3px solid ${t.borderColor}`,
              boxShadow: muiTheme.customShadows?.card ?? 3,
              overflow: 'hidden',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              // Landscape: lay the stage and the droplet tray side-by-side, centred as one group
              // with a modest gap (avoids the big void between the pot and the tray). Portrait
              // keeps the tray along the bottom.
              '@media (orientation: landscape)': {
                flexDirection: 'row',
                alignItems: 'stretch',
                justifyContent: 'center',
                gap: { xs: 2, sm: 3, md: 5 }
              }
            }}
          >
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              collisionDetection={closestCenter}
            >
              {/* Goal → Pot row: make THIS (left swatch) IN HERE (right pot). */}
              <Box sx={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: { xs: 1.5, sm: 2.5, md: 3.5 },
                px: 2,
                minHeight: 0,
                // Landscape: don't grab all the width — sit at natural size so the board can centre
                // the stage + tray together (this is what removes the dead space in the middle).
                '@media (orientation: landscape)': { flex: '0 1 auto', px: 0 }
              }}>
                {/* Goal swatch. Same column structure as the pot (circle → label → 44px reserve)
                    so the two circles line up on the same centre line. */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
                  <motion.div
                    key={targetColor.hex}
                    initial={reduce ? { opacity: 1 } : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Box
                      onClick={speakTargetColor}
                      sx={{
                        ...circleSizeSx,
                        borderRadius: '50%',
                        backgroundColor: targetColor.hex,
                        backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%)',
                        border: '4px solid white',
                        cursor: 'pointer',
                        boxShadow: muiTheme.customShadows?.card ?? '0 4px 16px rgba(0,0,0,0.2)'
                      }}
                    />
                  </motion.div>
                  <Box sx={{
                    px: 1.25, py: 0.25, borderRadius: 999,
                    bgcolor: muiTheme.scene.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)',
                    boxShadow: muiTheme.customShadows?.card ?? 1
                  }}>
                    <Typography sx={{
                      fontFamily: comicFont,
                      fontWeight: 700,
                      fontSize: 'clamp(0.74rem, 2.1vw, 0.98rem)',
                      color: muiTheme.scene.dark ? 'white' : 'text.secondary',
                      lineHeight: 1.2
                    }}>
                      Mål
                    </Typography>
                  </Box>
                  {/* Reserve mirroring the pot's Tøm slot so both columns are equal height. */}
                  <Box sx={{ height: 44 }} />
                </Box>

                {/* Arrow — chunky, friendly badge (sized to balance the larger goal/pot circles). */}
                <Box sx={{
                  flex: '0 0 auto',
                  width: { xs: 58, sm: 66, md: 76 },
                  height: { xs: 58, sm: 66, md: 76 },
                  '@media (orientation: landscape)': { width: 54, height: 54 },
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: muiTheme.scene.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)',
                  border: `3px solid ${t.borderColor}`,
                  boxShadow: muiTheme.customShadows?.card ?? 2
                }}>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: '2rem', sm: '2.3rem', md: '2.7rem' }, lineHeight: 1, color: t.accentColor, '@media (orientation: landscape)': { fontSize: '1.9rem' } }}>➜</Typography>
                </Box>

                {/* Mixing pot + Tøm */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
                  <Box sx={circleSizeSx}>
                    <DroppableZone
                      id="mixing-zone"
                      overColor="rgba(255,255,255,0.55)"
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: `4px dashed ${t.borderColor}`,
                        backgroundColor: potFill,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                        position: 'relative',
                        boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.12)',
                        transition: `background-color ${BLEND_MS}ms ease`
                      }}
                    >
                      <AnimatePresence>
                        {mixingZone.map((color, index) => (
                          <motion.div
                            key={color.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={
                              committing && !reduce
                                ? { scale: [1, 0.6, 0], rotate: [0, 220, 360], left: '50%', opacity: [1, 1, 0] }
                                : { scale: 1, opacity: 1, rotate: reduce ? 0 : 360 }
                            }
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: committing ? BLEND_MS / 1000 : 0.4 }}
                            style={{
                              position: 'absolute',
                              left: index === 0 ? '32%' : '62%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            <Box sx={{
                              width: { xs: 36, sm: 42, md: 46, lg: 54 },
                              height: { xs: 36, sm: 42, md: 46, lg: 54 },
                              borderRadius: '50% 50% 50% 0',
                              transform: 'rotate(135deg)',
                              backgroundColor: color.hex,
                              border: '2px solid rgba(255,255,255,0.9)',
                              boxShadow: `0 4px 12px ${color.hex}66, inset 0 2px 0 rgba(255,255,255,0.45)`
                            }} />
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {/* "Drop here" affordance while the pot is empty (gone once mixing starts). */}
                      {mixingZone.length === 0 && !committing && (
                        <Box sx={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          pointerEvents: 'none'
                        }}>
                          <motion.div
                            animate={reduce ? {} : { y: [0, 4, 0] }}
                            transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Typography sx={{ fontSize: 'clamp(1.6rem, 6vw, 2.4rem)', lineHeight: 1, opacity: 0.6, color: muiTheme.scene.dark ? 'rgba(255,255,255,0.85)' : t.accentColor }}>⬇</Typography>
                          </motion.div>
                        </Box>
                      )}
                    </DroppableZone>
                  </Box>

                  {/* "Din blanding" label — mirrors the goal "Mål" chip so the relationship reads. */}
                  <Box sx={{
                    px: 1.25, py: 0.25, borderRadius: 999,
                    bgcolor: muiTheme.scene.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)',
                    boxShadow: muiTheme.customShadows?.card ?? 1
                  }}>
                    <Typography sx={{
                      fontFamily: comicFont, fontWeight: 700,
                      fontSize: 'clamp(0.74rem, 2.1vw, 0.98rem)',
                      color: muiTheme.scene.dark ? 'white' : 'text.secondary', lineHeight: 1.2
                    }}>
                      Din blanding
                    </Typography>
                  </Box>

                  {/* Tøm — pour out a mis-dragged pot (only when it has droplets and isn't committing). */}
                  <Box sx={{ height: 44, display: 'flex', alignItems: 'center' }}>
                    {mixingZone.length >= 1 && !committing && (
                      <Button
                        onClick={emptyPot}
                        variant="contained"
                        sx={{
                          minHeight: 44,
                          minWidth: 88,
                          borderRadius: 999,
                          px: 2.5,
                          fontFamily: comicFont,
                          fontWeight: 700,
                          backgroundColor: t.accentColor,
                          boxShadow: muiTheme.customShadows?.card ?? 3,
                          '&:hover': { backgroundColor: t.hoverBorderColor }
                        }}
                      >
                        🗑️ Tøm
                      </Button>
                    )}
                  </Box>
                </Box>

              </Box>

              {/* Droplet tray — pinned along the board bottom; non-growing so it never clips
                  (this is what fixes the old landscape off-screen palette). */}
              <Box sx={{
                flex: '0 0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: { xs: 1.5, sm: 1.75, md: 2.25 },
                maxWidth: { xs: '380px', sm: '460px', md: '540px' },
                mx: 'auto',
                px: 1,
                pt: 1,
                pb: { xs: 1.25, md: 1.75 },
                // Landscape: a 2-column tray on the right (multiple rows), centred over the board
                // height — roomier than a single cramped column, droplets larger and never touching.
                '@media (orientation: landscape)': {
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: { xs: 1.5, sm: 2, md: 2.5 },
                  maxWidth: 'none',
                  mx: 0,
                  alignContent: 'center',
                  justifyItems: 'center',
                  px: { xs: 1.25, md: 2 },
                  py: 0,
                  pr: { xs: 1.5, md: 2.5 }
                }
              }}>
                {availableColors.map((color) => {
                  const isHint = recipeNames.includes(color.colorName) && !color.isUsed
                  return (
                    <motion.div
                      key={color.id}
                      initial={{ scale: 0, y: 50 }}
                      animate={
                        isHint && !reduce
                          ? { scale: [1, 1.15, 1], y: 0 }
                          : { scale: color.isUsed ? 0.7 : 1, y: 0 }
                      }
                      transition={
                        isHint && !reduce
                          ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
                          : { duration: 0.3 }
                      }
                      whileHover={{ scale: color.isUsed ? 0.7 : 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Box
                        component="div"
                        sx={{
                          position: 'relative !important',
                          left: 'auto !important',
                          top: 'auto !important',
                          '& > div': {
                            position: 'relative !important',
                            left: 'auto !important',
                            top: 'auto !important'
                          }
                        }}
                      >
                        <DraggableItem
                          id={color.id}
                          disabled={!gameReady || color.isUsed || committing}
                          data={color}
                        >
                          <Box sx={{
                            width: { xs: '54px', sm: '60px', md: '68px', lg: '74px' },
                            height: { xs: '54px', sm: '60px', md: '68px', lg: '74px' },
                            '@media (orientation: landscape)': {
                              width: { xs: '50px', sm: '58px', md: '66px', lg: '72px' },
                              height: { xs: '50px', sm: '58px', md: '66px', lg: '72px' }
                            },
                            borderRadius: '50% 50% 50% 0',
                            transform: 'rotate(135deg)',
                            backgroundColor: color.hex,
                            border: '2px solid rgba(255,255,255,0.9)',
                            boxShadow: isHint
                              ? `0 0 0 5px ${t.accentColor}88, 0 6px 14px ${color.hex}66`
                              : color.isUsed ? '0 2px 8px rgba(0,0,0,0.12)' : `0 6px 14px ${color.hex}66, inset 0 2px 0 rgba(255,255,255,0.45)`,
                            cursor: color.isUsed ? 'default' : 'grab',
                            opacity: color.isUsed ? 0.5 : 1,
                            transition: 'box-shadow 0.3s ease',
                            '&:active': { cursor: 'grabbing' }
                          }} />
                        </DraggableItem>
                      </Box>
                    </motion.div>
                  )
                })}
              </Box>
            </DndContext>

            {/* Recipe reveal — a solid celebratory card centred over the whole board (no
                ghosting), showing the rule in words to reinforce the colour names. */}
            <AnimatePresence>
              {recipe && (
                <motion.div
                  key="recipe"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 6,
                    background: muiTheme.scene.dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(3px)'
                  }}
                >
                  <motion.div
                    initial={reduce ? { scale: 1 } : { scale: 0.85 }}
                    animate={{ scale: 1 }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18 }}
                  >
                    <Box sx={{
                      bgcolor: muiTheme.scene.dark ? 'rgba(31,41,55,0.98)' : '#ffffff',
                      borderRadius: 5,
                      border: `3px solid ${t.borderColor}`,
                      boxShadow: muiTheme.customShadows?.card ?? '0 16px 40px rgba(0,0,0,0.28)',
                      px: { xs: 3, md: 4 },
                      py: { xs: 2.5, md: 3 },
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: { xs: 1.25, md: 1.75 },
                      maxWidth: '92%'
                    }}>
                      <Typography sx={{ fontFamily: comicFont, fontWeight: 800, fontSize: 'clamp(1.1rem, 4.5vw, 1.7rem)', color: t.accentColor }}>Flot! 🎉</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.5 } }}>
                        <Swatch hex={recipe.aHex} />
                        <RecipeSign>+</RecipeSign>
                        <Swatch hex={recipe.bHex} />
                        <RecipeSign>=</RecipeSign>
                        <Swatch hex={recipe.targetHex} big />
                      </Box>
                      <Typography sx={{ fontFamily: comicFont, fontWeight: 700, fontSize: 'clamp(0.95rem, 3.2vw, 1.35rem)', color: muiTheme.scene.dark ? 'white' : 'text.primary', textAlign: 'center' }}>
                        {recipe.aName} + {recipe.bName} = {recipe.targetName}
                      </Typography>
                    </Box>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </>
      )}
    </GameShell>
  )
}

// Recipe-reveal swatch (educational colors as data).
const Swatch: React.FC<{ hex: string; big?: boolean }> = ({ hex, big }) => (
  <Box sx={{
    width: big ? { xs: 64, md: 84 } : { xs: 48, md: 64 },
    height: big ? { xs: 64, md: 84 } : { xs: 48, md: 64 },
    borderRadius: '50%',
    backgroundColor: hex,
    border: '3px solid white',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
  }} />
)

const RecipeSign: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const muiTheme = useTheme()
  return (
    <Typography sx={{
      fontFamily: '"Comic Sans MS", "Comic Neue", sans-serif',
      fontWeight: 800,
      fontSize: { xs: '1.8rem', md: '2.4rem' },
      color: muiTheme.scene.dark ? 'white' : 'text.primary'
    }}>
      {children}
    </Typography>
  )
}

export default RamFarvenGame
