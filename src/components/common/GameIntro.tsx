import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets } from '../../theme/sceneAssets'
import { getCategoryTheme } from '../../config/categoryThemes'
import { hexToRgba } from '../../theme/tokens/helpers'
import { softShadow } from '../../theme/depth'
import { sfx } from '../../services/sfxClient'
import { mascotBus } from '../../services/mascotBus'

// "Er du klar? … Kør!" game-entry beat (Liveliness PRD-03 §A1). A short, skippable mascot-presents
// moment rendered by GameShell over the (already-live) board while the spoken welcome plays.
//
// Purely ADDITIVE: the board is instant-load underneath, so this never gates the game's own
// `gameReady`/interaction timing — it's a themed curtain that lifts. A tap anywhere fast-forwards
// (a synchronous ref, checked before scheduling — same pattern as RoundResultScreen's skip). The
// skip tap bubbles to the window `pointerdown` audio-unlock listener (App.tsx), so it also satisfies
// the iOS gesture. GameShell never renders this under reduced motion, so today's silent-instant
// behavior is preserved there.

// Emoji fallback mirrors Mascot.tsx so the pose is always PRESENT before the sprite resolves.
const emojiFallback = (motionKind: string): string => {
  switch (motionKind) {
    case 'twinkle': return '🚀'
    case 'rise': return '🐙'
    case 'fall': return '🦕'
    default: return '🦄'
  }
}

interface GameIntroProps {
  categoryId: string
  onDismiss: () => void
  // DEV/screenshot harness only: freeze the beat (no phase-swap / auto-dismiss timers) so a headless
  // screenshot can capture it, and optionally start on the "Kør!" phase.
  hold?: boolean
  initialPhase?: 'ready' | 'go'
}

// Beat timing (ms). "Er du klar?" holds, then swaps to "Kør!", then the curtain lifts. Tuned so the
// spoken welcome (played by the game) reads together with the "Kør!" dismissal — audio-led.
const GO_AT = 850
const DISMISS_AT = 1350

const GameIntro: React.FC<GameIntroProps> = ({ categoryId, onDismiss, hold = false, initialPhase = 'ready' }) => {
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const category = getCategoryTheme(categoryId)
  const dark = theme.scene.dark
  const accent = category.accentColor
  const [phase, setPhase] = useState<'ready' | 'go'>(initialPhase)
  const [sprite, setSprite] = useState<string>('')
  // Fast-forward guard: set synchronously on the first skip so a rapid double-tap can't fire the
  // dismiss twice or race the scheduled timers.
  const dismissedRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Load this world's mascot for an enlarged intro pose — prefer the B4 GREET (waving) pose so the
  // "Er du klar?" beat shows the guide welcoming the child, matching the reactive-guide language
  // (W6); fall back to the idle sprite, then emoji, so nothing regresses on un-updated skins.
  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (!alive || !a) return
      setSprite(a.mascotPoses?.greet ?? a.mascot ?? '')
    })
    return () => {
      alive = false
    }
  }, [themeId])

  // The mascot presents (corner Mascot waves via the bus) + schedule the "Kør!" swap and the lift.
  useEffect(() => {
    mascotBus.emit('welcome')
    if (hold) return
    const timers = timersRef.current
    timers.push(setTimeout(() => setPhase('go'), GO_AT))
    // A soft "go" cue right as it swaps (separate SFX channel — never touches narration).
    timers.push(setTimeout(() => sfx.play('nav-whoosh'), GO_AT))
    timers.push(
      setTimeout(() => {
        if (dismissedRef.current) return
        dismissedRef.current = true
        onDismiss()
      }, DISMISS_AT),
    )
    return () => {
      timers.forEach(clearTimeout)
      timersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold])

  // Tap anywhere → skip straight to the board (idempotent, timer-clearing).
  const skip = () => {
    if (hold || dismissedRef.current) return
    dismissedRef.current = true
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    onDismiss()
  }

  return (
    <Box
      component={motion.div}
      data-game-intro
      onClick={skip}
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 5, // above the board, below the corner Mascot (zIndex 6) so it "presents" over the curtain
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 2, md: 3 },
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        // Opaque themed curtain (no backdrop-filter — flicker discipline). Lifts to reveal the board.
        background: dark
          ? 'radial-gradient(circle at 50% 42%, #16204a 0%, #070b1a 100%)'
          : category.gradient,
      }}
    >
      {/* Enlarged mascot pose (this world's sprite; emoji fallback keeps it present). */}
      <Box
        component={motion.div}
        initial={{ scale: 0.6, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: [24, -10, 0], opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        sx={{
          width: { xs: 128, md: 176 },
          height: { xs: 128, md: 176 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: softShadow(2.4),
        }}
      >
        {sprite ? (
          <Box
            component="img"
            src={sprite}
            alt=""
            draggable={false}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
          />
        ) : (
          <Box sx={{ fontSize: { xs: '5rem', md: '7rem' }, lineHeight: 1 }}>
            {emojiFallback(theme.scene.ambient.motion)}
          </Box>
        )}
      </Box>

      {/* Text flourish — "Er du klar?" then a punchy "Kør!". Keyed so the swap re-animates. */}
      <Typography
        key={phase}
        component={motion.div}
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: phase === 'go' ? [0.8, 1.15, 1] : 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        sx={{
          fontFamily: theme.titleFontFamily,
          fontWeight: 700,
          fontSize: phase === 'go' ? { xs: '2.8rem', md: '4rem' } : { xs: '2rem', md: '2.8rem' },
          color: dark ? '#FFFFFF' : accent,
          textShadow: dark
            ? '0 0 20px rgba(120,170,255,0.6), 0 2px 10px rgba(0,0,0,0.5)'
            : `2px 2px 0 ${hexToRgba(accent, 0.18)}`,
          letterSpacing: phase === 'go' ? '0.04em' : 'normal',
        }}
      >
        {phase === 'go' ? 'Kør!' : 'Er du klar?'}
      </Typography>
    </Box>
  )
}

export default GameIntro
