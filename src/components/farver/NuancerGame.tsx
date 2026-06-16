import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
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
// Farver section: the tiles are the same color family, so the only signal is lightness. Tap the
// tiles in order (lightest first); each fills the next left→right slot. After 2 wrong taps the
// correct next tile pulses (never-fail hint, costs a star). Bounded round of 8 → RoundResultScreen.
// Static difficulty (no adaptive logic) — edit the levers below.

// ── Tuning levers ─────────────────────────────────────────────────────────────────────────────
const ROUND_QUESTIONS = 8          // orderings per round → RoundResultScreen
const WRONG_BEFORE_HINT = 2        // pulse the correct next tile after this many wrong taps

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

  // Current question: a hue's shades (correct light→dark order) + a scrambled tray.
  const [order, setOrder] = useState<ColorShade[]>([])   // correct order (light→dark)
  const [tray, setTray] = useState<ColorShade[]>([])     // scrambled display order
  const [placed, setPlaced] = useState<string[]>([])     // shade names placed so far, in order
  const [shakeName, setShakeName] = useState<string | null>(null)
  const [hintName, setHintName] = useState<string | null>(null)
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
    setPlaced([])
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

  const handleTileTap = async (shade: ColorShade) => {
    if (!gameReady || isAdvancing.current) return
    if (placed.includes(shade.name)) return
    hasInteractedRef.current = true
    audio.updateUserInteraction()
    audio.cancelCurrentAudio()

    const expected = order[placed.length]
    if (shade.name === expected.name) {
      // Correct next-lightest → lock into the next slot.
      const newPlaced = [...placed, shade.name]
      setPlaced(newPlaced)
      slotWrongRef.current = 0
      setHintName(null)
      sfx.play('drop-snap')
      try {
        await audio.speak(shade.name)
      } catch { /* ignore */ }
      if (newPlaced.length === order.length) completeQuestion()
    } else {
      // Wrong → gentle SFX + shake, leave it, break first-try.
      firstAttemptRef.current = false
      sfx.play('wrong')
      setShakeName(shade.name)
      reactGuide('think')
      setTimeout(() => setShakeName(null), 450)
      slotWrongRef.current += 1
      if (slotWrongRef.current >= WRONG_BEFORE_HINT) setHintName(expected.name)
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
    borderRadius: '16px',
    border: '3px solid white',
  } as const

  const trayTiles = tray
  const allPlaced = placed.length === order.length && order.length > 0

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
        <>
          {/* Repeat instruction */}
          <Box sx={{ textAlign: 'center', mb: { xs: 1, md: 1.5 }, flex: '0 0 auto' }}>
            <ColorRepeatButton onClick={repeatInstruction} disabled={false} label="🎵 Hør igen" />
          </Box>

          {/* Slots row: left = lightest, right = darkest. Filled slots show the placed shade. */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 1, md: 1.5 },
            flex: '0 0 auto',
            mb: 0.5,
            '@media (orientation: landscape)': { mb: 0.25 }
          }}>
            {order.map((_, index) => {
              const filledName = placed[index]
              const filledShade = filledName ? order.find(s => s.name === filledName) : undefined
              return (
                <motion.div
                  key={`slot-${index}`}
                  animate={!reduce && allPlaced ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <Box sx={{
                    ...tileSx,
                    border: filledShade ? '3px solid white' : `3px dashed ${t.borderColor}`,
                    backgroundColor: filledShade ? filledShade.hex : 'rgba(255,255,255,0.45)',
                    boxShadow: filledShade
                      ? `0 5px 0 ${darken(filledShade.hex, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`
                      : 'none',
                    transition: 'background-color 0.25s ease, box-shadow 0.25s ease'
                  }} />
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

          {/* Tray: the scrambled shades to pick from (tap lightest remaining). */}
          <Box sx={{
            flex: '0 1 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: { xs: 1.5, md: 2 },
            minHeight: 0
          }}>
            {trayTiles.map((shade) => {
              const used = placed.includes(shade.name)
              const isHint = hintName === shade.name && !used
              const isShaking = shakeName === shade.name
              const animate = isShaking
                ? { x: [0, -10, 10, -10, 10, 0], scale: 1, opacity: 1 }
                : isHint && !reduce
                  ? { scale: [1, 1.14, 1], x: 0, opacity: 1 }
                  : { scale: used ? 0.6 : 1, x: 0, opacity: used ? 0 : 1 }
              const transition = isShaking
                ? { duration: 0.45 }
                : isHint && !reduce
                  ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const }
                  : { duration: 0.25 }
              return (
                <motion.div
                  key={shade.name}
                  animate={animate}
                  transition={transition}
                  whileHover={used ? undefined : { scale: 1.08 }}
                  whileTap={used ? undefined : { scale: 0.92 }}
                  style={{ pointerEvents: used ? 'none' : 'auto' }}
                >
                  <Box
                    onClick={() => handleTileTap(shade)}
                    sx={{
                      ...tileSx,
                      backgroundColor: shade.hex,
                      cursor: used ? 'default' : 'pointer',
                      userSelect: 'none',
                      boxShadow: isHint
                        ? `0 0 0 5px ${t.accentColor}88, 0 6px 14px rgba(0,0,0,0.2)`
                        : `0 5px 0 ${darken(shade.hex, 0.28)}, ${muiTheme.scene.dark ? '0 10px 24px rgba(0,0,0,0.45)' : '0 7px 16px rgba(0,0,0,0.12)'}`,
                      transition: 'box-shadow 0.25s ease'
                    }}
                  />
                </motion.div>
              )
            })}
          </Box>
        </>
      )}
    </GameShell>
  )
}

export default NuancerGame
