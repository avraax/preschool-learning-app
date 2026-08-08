import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, useMediaQuery } from '@mui/material'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@mui/material/styles'
import { DndContext, DragEndEvent, DragStartEvent, MeasuringStrategy } from '@dnd-kit/core'
import { useDragOnlySensors } from '../common/dnd/useDragOnlySensors'
import { kidCollision } from '../common/dnd/kidCollision'
import { DraggableItem } from '../common/dnd/DraggableItem'
import { DroppableZone } from '../common/dnd/DroppableZone'
import { getCategoryTheme } from '../../config/categoryThemes'
import { NUANCER_INSTRUCTION } from '../../config/gamePhrases'
import { SHADES, HUE_ORDER, type ColorShade } from '../../config/colorContent'
import { hexToRgba } from '../../theme/tokens/helpers'
import { SNAP } from '../../theme/motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
import GameShell from '../common/GameShell'
import PromptFocus from '../common/PromptFocus'
import type { GuideReaction } from '../common/ThemeMascot'
import { useCelebration } from '../common/CelebrationEffect'
import { useDifficulty } from '../../hooks/useDifficulty'
import { ColorRepeatButton } from '../common/RepeatButton'
import { useTaskRun } from '../../hooks/useTaskRun'
import { progressStore } from '../../services/progressStore'
import { COLORS_NUANCER } from '../../config/difficulty'
import { NUANCER_ROUND, nuancerPromptPool } from '../../config/promptPools'
import { usePromptBag } from '../../hooks/usePromptBag'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { isIOS } from '../../utils/deviceDetection'
import { shuffle } from '../../utils/shuffle'
import { devFx } from '../../utils/devHarness'
import { useNeverFailHint } from '../../hooks/useNeverFailHint'
import { useDragActive } from '../common/dnd/useDragActive'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Nuancer — order shades of one hue from LIGHT to DARK. The real discrimination stretch in the
// Farver section: the tiles are the same color family, so the only signal is lightness. DRAG each
// shade into its slot (left = lightest, right = darkest). A wrong slot bounces back (gentle SFX +
// shake); after 2 wrong drops the correct tile for the next empty slot pulses (never-fail hint).
// Play is ENDLESS — no round boundary; the reward ceremony fires in-game at the seam (Endless Play
// PRD-01). Static difficulty — edit the levers below.
//
// UI/UX Overhaul §6C: the slot row now lives in PromptStage (it IS the prompt — this kills the old
// top void), and the tray of draggable shades is the answer zone beneath it. Shared drag juice:
// grab = lift + 'pick-up' SFX; a compatible drop target breathes while hovered; a correct drop
// SNAPs into place + a localized burst; a wrong drop springs back + 'spring-back' SFX. Reduced
// motion drops the travel/particles but keeps colour/glow + SFX.

// ── Tuning levers ─────────────────────────────────────────────────────────────────────────────
// Orderings per round → `NUANCER_ROUND` in config/promptPools, read directly below: it is also the bag's
// no-repeat window (Practice Loop PRD-01 W1) and the measured simulation's round length, so an alias
// here would just be a third name for one number.
const WRONG_BEFORE_HINT = 2        // pulse the correct next tile after this many wrong drops

const NuancerGame: React.FC = () => {
  const muiTheme = useTheme()
  const reduce = useReducedMotion()
  const t = getCategoryTheme('colors')
  const sensors = useDragOnlySensors()
  // PromptStage is much shorter on phone-landscape (GameShell's 30:70 split vs 40:60 on iPad) — too
  // short to also fit RepeatButton's fixed (un-shrinkable) size alongside the slot row. On phone
  // landscape the repeat button moves down into the answer zone instead, so PromptStage's full
  // height goes entirely to the slot row.
  const phoneLandscape = useMediaQuery(PHONE_LANDSCAPE.replace('@media ', ''))

  // Current question: a hue's shades (correct light→dark order) + a scrambled tray. Difficulty
  // (progressStore.difficultyFor('colors')) tunes the shade count: Let orders just 2 (lightest +
  // darkest); Normal (today, unchanged) orders all 3; Svær keeps all 3 but folds in 1 decoy shade
  // from a different hue with no slot of its own — a genuine "does this belong?" distractor,
  // assembled purely from the existing exported SHADES data (colorContent.ts stays untouched).
  const [order, setOrder] = useState<ColorShade[]>([])     // correct order (light→dark); slot i wants order[i]
  const [tray, setTray] = useState<ColorShade[]>([])       // scrambled display order (may include a decoy)
  const [slots, setSlots] = useState<(string | null)[]>([]) // placed shade name per slot index, or null
  const [shakeName, setShakeName] = useState<string | null>(null)
  // Never-fail hint: after WRONG_BEFORE_HINT wrong drops, the correct tile for the next empty slot
  // pulses. `hintName` holds that shade name (or null). Reset per question AND per correct drop.
  const { hint: hintName, registerWrong: registerHintWrong, reset: resetHint } = useNeverFailHint<string>(WRONG_BEFORE_HINT)
  // Shared lift/breathe drag state (activeId = grabbed tray tile, overId = slot under the pointer).
  const { activeId, overId, setActiveId, onDragOver, clearActive } = useDragActive()
  const [burstSlot, setBurstSlot] = useState<number | null>(null) // localized burst on a just-filled slot

  const audio = useSimplifiedAudioHook({ componentId: 'NuancerGame', autoInitialize: false })
  const [gameReady, setGameReady] = useState(false)

  // Endless task play (Endless Play PRD-01 W2). ONE constant, two jobs: the `taskXp` normaliser AND
  // the bag's no-repeat window.
  const run = useTaskRun({ tasksInRound: NUANCER_ROUND, gameId: 'colors.nuancer' })
  const firstAttemptRef = useRef(true)

  const { showCelebration, celebrationIntensity, celebrationDuration, celebrateTier, stopCelebration } = useCelebration()
  const [guideReaction, setGuideReaction] = useState<GuideReaction>(null)
  const guideReactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInitialized = useRef(false)
  const startedRef = useRef(false)
  const welcomeTriggered = useRef(false)
  const hasInteractedRef = useRef(false)
  // The prompt HUE comes from a bag (W1); the old `previousHue` ref is deleted, not kept beside it.
  const hueBag = usePromptBag<string>({ window: NUANCER_ROUND })
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

  const INSTRUCTION = NUANCER_INSTRUCTION

  // Draw the next hue from a BAG and scramble its shades. `voice=false` skips audio.
  const setupQuestion = (voice = true) => {
    isAdvancing.current = false
    // Practice Loop PRD-01 W1: the old avoid-the-previous-hue ref is DELETED. With 6 hues over 8
    // questions two must repeat, but sampling with replacement made the DISTRIBUTION arbitrary — a bag
    // shows all 6 before anything comes back, and the seam rule keeps the refill off the last hue.
    const hue = hueBag.draw(nuancerPromptPool())

    const fullShades = SHADES[hue]
    // Table-driven (Difficulty PRD-01 §4.5): Let orders just the lightest + darkest (2 slots — a
    // simpler binary task); Normal all 3; Svær all 3 plus a decoy tile (below).
    const { slots: slotCount, decoy: wantDecoy } = COLORS_NUANCER[progressStore.difficultyFor('colors')]
    const correct =
      slotCount >= fullShades.length ? fullShades : [fullShades[0], fullShades[fullShades.length - 1]]
    setOrder(correct)

    // Re-shuffle until the scrambled order isn't already sorted, so it's always a real task.
    let scrambled = shuffle(correct)
    let guard = 0
    while (guard++ < 8 && scrambled.every((s, i) => s.name === correct[i].name)) {
      scrambled = shuffle(correct)
    }

    // Svær: fold in one decoy shade from a different hue — it has no slot, so the child must
    // recognise it doesn't belong to this hue's light→dark run (Appendix A: "more distractors"),
    // built purely from the existing exported SHADES data (colorContent.ts stays untouched).
    if (wantDecoy) {
      const otherHues = HUE_ORDER.filter((h) => h !== hue)
      const decoyHue = otherHues[Math.floor(Math.random() * otherHues.length)]
      const decoyShades = SHADES[decoyHue]
      const decoy = decoyShades[Math.floor(Math.random() * decoyShades.length)]
      scrambled = shuffle([...scrambled, decoy])
    }

    setTray(scrambled)
    setSlots(correct.map(() => null))
    setShakeName(null)
    resetHint()
    setBurstSlot(null)
    firstAttemptRef.current = true

    if (!voice) return
    const delay = isIOS() ? 150 : 350
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      audio.updateUserInteraction()
      audio.speak(INSTRUCTION).catch(() => {})
    }, delay)
  }

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

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    revealBoard()
    if (audio.isAudioReady) playWelcomeThenInstructions()

    return () => {
      if (guideReactionTimer.current) clearTimeout(guideReactionTimer.current)
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      if (burstTimer.current) clearTimeout(burstTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (audio.isAudioReady && !welcomeTriggered.current) playWelcomeThenInstructions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isAudioReady])

  // DEV screenshot harness (?fx=correct|wrong|hint): a PURE render-time derivation (no setState in
  // an effect — mirrors UnifiedQuizGame's `tileStateFor`), so it's persistent/capturable with no
  // auto-advance cascade. The effect below only notifies the mascot (an external system), which is
  // the one thing effects legitimately do. No-op in production (devFx() is DEV-only).
  const forcedFx = devFx()
  useEffect(() => {
    if (forcedFx === 'hint') mascotBus.emit('hint')
  }, [forcedFx])

  const completeQuestion = () => {
    if (isAdvancing.current) return
    isAdvancing.current = true
    celebrateTier('micro')
    reactGuide('cheer')

    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      stopCelebration()
      // THE SEAM (Endless Play PRD-01 §4.1) — the ceremony plays here, before the next question is
      // set up, with the advance guard still held.
      const r = run.completeTask(firstAttemptRef.current)
      // Suppressed on a crossing: one loud payoff, not two celebrations in the same 200ms.
      if (r.streak > 0 && r.streak % 3 === 0 && !r.crossedLevel) {
        celebrateTier('streak')
        mascotBus.emit('streak') // mascot does its streak pose, matching the shared quiz engine
      }
      run.thenContinue(() => setupQuestion(true))
    }, isIOS() ? 1100 : 1400)
  }

  const handleDragStart = (event: DragStartEvent) => {
    audio.cancelCurrentAudio()
    setActiveId(event.active.id as string)
    sfx.play('pick-up')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    clearActive()
    if (!over) return // dropped on empty space → springs back
    const m = /^slot-(\d+)$/.exec(String(over.id))
    if (!m) return
    resolveShade(String(active.id), Number(m[1]))
  }

  // A TAP on a shade places it in the LEFTMOST EMPTY slot (owner, 2026-08-03; a tap used to do nothing
  // at all). This game is the only one of the four where a tap cannot carry everything a drag does —
  // shade × slot is two-dimensional — and the alternative was select-then-place, i.e. a first tap that
  // scores nothing. That is exactly the shape the engine's `previewBeforeCommit` was removed for: the
  // owner's 5-year-old read the ignored first tap as a broken game. So the tap commits, and the slot it
  // commits to is the one the instruction already asks for next ("lightest first", filling left to
  // right). Nothing about scoring changes — placing the wrong shade in that slot is wrong either way.
  const tapShade = (shadeName: string) => {
    const firstEmpty = slots.findIndex((s) => !s)
    if (firstEmpty < 0) return
    resolveShade(shadeName, firstEmpty, true)
  }

  // ONE resolution path for both gestures.
  const resolveShade = (shadeName: string, i: number, viaTap = false) => {
    if (!gameReady || isAdvancing.current) return
    if (slots.includes(shadeName)) return // already placed
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    if (slots[i]) return // slot already filled → springs back
    // "Every tap is felt": the drag path already ticked on pick-up, so only the tap owes the press.
    if (viaTap) sfx.play('tap')

    if (order[i] && shadeName === order[i].name) {
      // Correct slot → lock it in with a SNAP + a localized burst.
      const next = [...slots]
      next[i] = shadeName
      setSlots(next)
      resetHint()
      sfx.play('drop-snap')
      setBurstSlot(i)
      if (burstTimer.current) clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => setBurstSlot(null), 500)
      // Identify the placed shade (educational echo). No win/lose narration.
      audio.cancelCurrentAudio()
      audio.speak(shadeName).catch(() => {})
      if (next.every((s) => s !== null)) completeQuestion()
    } else {
      // Wrong slot → springs back (automatic) + gentle SFX + shake, break first-try.
      firstAttemptRef.current = false
      sfx.play('spring-back')
      setShakeName(shadeName)
      reactGuide('think')
      setTimeout(() => setShakeName(null), 450)
      if (registerHintWrong(() => {
        const firstEmpty = slots.findIndex((s) => !s)
        return firstEmpty >= 0 && order[firstEmpty] ? order[firstEmpty].name : null
      })) mascotBus.emit('hint')
    }
  }

  const repeatInstruction = () => {
    audio.updateUserInteraction()
    if (!gameReady) return
    audio.speak(INSTRUCTION).catch(() => {})
  }

  // Tile geometry (lifted-3D, colored). Smaller in landscape so the row + tray fit; phone-landscape
  // shrinks further to the 44px touch-target floor (PromptStage's own allocation is much shorter
  // there) — shared by both the slot row (in PromptStage) and the tray (below) so they match.
  const tileSx = {
    width: { xs: 78, sm: 88, md: 100 },
    height: { xs: 78, sm: 88, md: 100 },
    // Bigger on the roomy iPad landscape surface now that the ramp/hint no longer share the stage —
    // easier grab targets for 5yo motor control and a fuller use of the freed space.
    '@media (orientation: landscape)': { width: 78, height: 78 },
    [PHONE_LANDSCAPE]: { width: 44, height: 44 },
    borderRadius: '18px'
  } as const

  // PRD-09 §3.0 colour-surface grounding: soft accent-tinted clay shadow (no hard keyboard lip);
  // the tile fill stays the true educational shade hex.
  const liftedShadow = (hex: string) =>
    muiTheme.scene.dark
      ? `0 8px 22px ${hexToRgba(hex, 0.5)}, 0 3px 8px rgba(0,0,0,0.4)`
      : `0 8px 20px ${hexToRgba(hex, 0.35)}, 0 3px 8px rgba(0,0,0,0.12)`

  // Bigger, raised soft shadow for the currently-grabbed tray tile (lift toward the camera).
  const grabShadow = (hex: string) =>
    `0 16px 28px ${hexToRgba(hex, 0.45)}, 0 6px 14px rgba(0,0,0,${muiTheme.scene.dark ? 0.5 : 0.3})`

  // Forced ?fx= states (DEV screenshot harness) — pure render-time overrides layered on the real
  // state, never mutating it. 'correct' fills every slot from the real answer (shows SNAP + the
  // completed-row shimmer); 'wrong'/'hint' target the first tray tile / first empty slot.
  const displaySlots = forcedFx === 'correct' && order.length > 0 ? order.map((s) => s.name) : slots
  const displayHintName = forcedFx === 'hint' ? (hintName ?? order[0]?.name ?? null) : hintName
  const displayShakeName = forcedFx === 'wrong' ? (shakeName ?? tray[0]?.name ?? null) : shakeName

  const remaining = tray.filter((s) => !displaySlots.includes(s.name))
  const allPlaced = displaySlots.length > 0 && displaySlots.every((s) => s !== null)

  // The slot row IS the prompt (§6C: "raise the light→dark slot row into PromptStage height" —
  // kills the old top void). Charge-in re-triggers per question via chargeKey (derived from STATE,
  // never from the bag/refs, so it's safe to read during render).
  const promptStageContent =
    !gameReady || order.length === 0 ? undefined : (
      <PromptFocus
        accent={t.accentColor}
        chargeKey={`${order[0]?.hex ?? ''}-${run.state.index}`}
        repeat={phoneLandscape ? undefined : <ColorRepeatButton onClick={repeatInstruction} disabled={false} />}
        subject={
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          {/* Sun (light end) ← slots → Moon (dark end): ONE wordless spatial cue for a pre-reader —
              put the light shade by the sun, the dark shade by the moon. (Replaces the old gradient
              ramp + "lys → mørk" text, which doubled up and needed reading.) */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: { xs: 1.25, md: 2 }, [PHONE_LANDSCAPE]: { gap: 0.75 } }}>
            <Box aria-hidden sx={{ display: 'flex', flex: '0 0 auto', color: '#F59E0B', '& svg': { width: { xs: '2.3rem', md: '3rem' }, height: 'auto' }, [PHONE_LANDSCAPE]: { '& svg': { width: '1.7rem' } } }}>
              <Sun strokeWidth={2.5} />
            </Box>
            {/* Slot row (drop targets): left = lightest (by the sun), right = darkest (by the moon). */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: { xs: 1, md: 1.5 }, [PHONE_LANDSCAPE]: { gap: 0.5 } }}>
            {displaySlots.map((placedName, index) => {
              const placedShade = placedName ? order.find((s) => s.name === placedName) : undefined
              const isOverThis = overId === `slot-${index}`
              const slotAnimate = allPlaced && !reduce
                ? { scale: [1, 1.12, 1] }
                : isOverThis && !reduce
                  ? { scale: [1, 1.06, 1] }
                  : { scale: 1 }
              const slotTransition = allPlaced && !reduce
                ? { duration: 0.5, delay: index * 0.12, ease: 'easeOut' as const }
                : isOverThis && !reduce
                  ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' as const }
                  : { duration: 0.3 }
              return (
                <motion.div key={`slot-${index}`} animate={slotAnimate} transition={slotTransition}>
                  <Box sx={{ ...tileSx, position: 'relative' }}>
                    <motion.div
                      key={placedName ?? 'empty'}
                      initial={placedName && !reduce ? { scale: 0.55 } : false}
                      animate={{ scale: 1 }}
                      transition={placedName && !reduce ? SNAP : { duration: 0 }}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <DroppableZone
                        id={`slot-${index}`}
                        overColor={muiTheme.scene.dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.65)'}
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '16px',
                          // Inviting empty slot (PRD-14 W6 / audit §A6): a clearer "well" — thicker
                          // dashed rim, brighter fill + a concave inset shadow so the drop targets
                          // read as obvious destinations (were a faint 45% wash, no depth).
                          border: placedShade ? '3px solid white' : `4px dashed ${isOverThis ? t.accentColor : t.borderColor}`,
                          backgroundColor: placedShade
                            ? placedShade.hex
                            : muiTheme.scene.dark
                              ? 'rgba(255,255,255,0.22)'
                              : 'rgba(255,255,255,0.72)',
                          boxShadow: placedShade
                            ? liftedShadow(placedShade.hex)
                            : isOverThis
                              ? `0 0 0 4px ${hexToRgba(t.accentColor, 0.5)}, 0 4px 12px rgba(0,0,0,0.15)`
                              : 'inset 0 4px 10px rgba(0,0,0,0.16)',
                          transition: 'background-color 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease'
                        }}
                      />
                    </motion.div>
                    {burstSlot === index && !reduce && placedShade && (
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0.9 }}
                        animate={{ scale: 1.9, opacity: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '16px',
                          backgroundColor: placedShade.hex,
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                  </Box>
                </motion.div>
              )
            })}
            </Box>
            <Box aria-hidden sx={{ display: 'flex', flex: '0 0 auto', color: muiTheme.scene.dark ? '#CBD5E1' : '#475569', '& svg': { width: { xs: '2.3rem', md: '3rem' }, height: 'auto' }, [PHONE_LANDSCAPE]: { '& svg': { width: '1.7rem' } } }}>
              <Moon strokeWidth={2.5} />
            </Box>
          </Box>
        </Box>
        }
      />
    )

  // Live difficulty: rebuild the current question when the level changes in the adult menu (no
  // refresh). Skips the initial mount.
  const difficultyLevel = useDifficulty('colors')
  const prevDifficultyRef = useRef(difficultyLevel)
  useEffect(() => {
    if (prevDifficultyRef.current === difficultyLevel) return
    prevDifficultyRef.current = difficultyLevel
    if (!gameReady) return
    setupQuestion()
  }, [difficultyLevel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={clearActive}
      collisionDetection={kidCollision}
      // The slot drop-targets live inside PromptStage, which applies a perpetual idle-float to its
      // content. With the default (measure-once-at-drag-start) strategy, pointerWithin would test
      // the pointer against stale, pre-float slot rects. Re-measure continuously so the drop lands
      // on the slot actually under the finger.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <GameShell
        categoryId="colors"
        title="Nuancer"
        backRoute="/farver"
        dense
        guideReaction={guideReaction}
        promptStage={promptStageContent}
        celebration={{ show: showCelebration, intensity: celebrationIntensity, duration: celebrationDuration, onComplete: stopCelebration }}
      >
        {gameReady && order.length > 0 ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Phone-landscape only: RepeatButton relocated here from PromptStage (see phoneLandscape
                above) so the slot row gets the stage's full (short) height. */}
            {phoneLandscape && (
              <Box sx={{ textAlign: 'center', flex: '0 0 auto', mb: 0.5 }}>
                <ColorRepeatButton onClick={repeatInstruction} disabled={false} />
              </Box>
            )}
            {/* Tray: the scrambled shades still to place (drag into a slot above). Sits just under
                the PromptStage slots+button as one tight top-centred cluster (centring it in the tall
                answer zone dropped it to the very bottom). The freed PromptStage space now breathes
                around the sun→slots→moon row instead of carrying the old ramp + hint text. */}
            <Box sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: { xs: 1.5, md: 2.5 },
              pt: { xs: 2, md: 4 },
              minHeight: 0
            }}>
              {remaining.map((shade) => {
                const isLifted = activeId === shade.name
                const isHint = displayHintName === shade.name
                const isShaking = displayShakeName === shade.name
                const animate = isLifted && !reduce
                  ? { scale: 1.08, rotate: 6, x: 0 }
                  : isShaking
                    ? { x: [0, -10, 10, -10, 10, 0], scale: 1, rotate: 0 }
                    : isHint && !reduce
                      ? { scale: [1, 1.14, 1], x: 0, rotate: 0 }
                      : { scale: 1, x: 0, rotate: 0 }
                const transition = isLifted && !reduce
                  ? SNAP
                  : isShaking
                    ? { duration: 0.45 }
                    : isHint && !reduce
                      ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
                      : { duration: 0.25 }
                return (
                  <Box key={shade.name}>
                    <DraggableItem
                      id={shade.name}
                      inline
                      disabled={!gameReady}
                      data={shade}
                      // Tap = place this shade in the next empty slot (see tapShade).
                      onActivate={() => tapShade(shade.name)}
                    >
                      <motion.div animate={animate} transition={transition}>
                        <Box sx={{
                          ...tileSx,
                          backgroundColor: shade.hex,
                          border: '3px solid white',
                          cursor: 'grab',
                          userSelect: 'none',
                          boxShadow: isLifted
                            ? grabShadow(shade.hex)
                            : isHint
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
          </Box>
        ) : null}
      </GameShell>
    </DndContext>
  )
}

export default NuancerGame
