import React, { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme, type SxProps, type Theme } from '@mui/material/styles'
import { motion, type TargetAndTransition, type Transition } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets } from '../../theme/sceneAssets'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { mascotBus, type MascotEvent } from '../../services/mascotBus'
import { hexToRgba } from '../../theme/tokens/helpers'
import { getTapAnims, TAP_ANIM_MAX_MS, type TapAnim } from '../../theme/mascotAnimations'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'

// Reactive corner mascot (UI/UX Overhaul PRD §5.5). ONE reusable emotional guide that reacts to
// gameplay events (correct/wrong/streak/round/hint/sticker/welcome) via the `mascotBus`. Games
// emit from the same handler as their celebration/SFX; this component translates each event into
// a distinct pose + a short Danish speech bubble. Reduced motion → static pose swap (no transform
// animation) with the bubble + a small expression badge still communicating the reaction.
//
// Reuses the per-world sprite from `loadSceneAssets`; falls back to a world-appropriate emoji so
// the mascot is always PRESENT (and reactive) even before the sprite resolves.

// Short Danish copy pools per event (Appendix C). Pick one at random on emit (event handler, not
// during render, so Math.random is safe).
const COPY: Partial<Record<MascotEvent, string[]>> = {
  welcome: ['Skal vi lege?', 'Kom, vi starter!'],
  correct: ['Ja!', 'Flot!', 'Sådan!'],
  wrong: ['Prøv igen!', 'Næsten!'],
  streak: ['Wow, du er i gang!', 'Uovervindelig!'],
  round: ['Hurra! Du gjorde det!'],
  sticker: ['Et nyt klistermærke!'],
  hint: ['Kig her!', 'Prøv den her!'],
}

// A tiny expression badge shown per pose — the primary "static pose swap" under reduced motion,
// and a subtle accent otherwise.
const BADGE: Partial<Record<MascotEvent, string>> = {
  correct: '⭐',
  // wrong: intentionally no badge (encouragement is the lean-in pose + spoken line, not an icon)
  streak: '🔥',
  round: '🎉',
  sticker: '✨',
  hint: '👉',
  welcome: '👋',
}


// How long a reaction pose holds before easing back to idle (ms).
const HOLD_MS: Partial<Record<MascotEvent, number>> = {
  correct: 950,
  wrong: 750,
  streak: 950,
  round: 1400,
  sticker: 1400,
  hint: 900,
  welcome: 1100,
}

const pick = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)]

// Motion keyframes per pose (skipped under reduced motion).
const poseAnim = (event: MascotEvent): { animate: TargetAndTransition; transition: Transition } => {
  switch (event) {
    case 'correct':
      return { animate: { y: [0, -30, 0, -12, 0], scale: [1, 1.16, 0.94, 1.06, 1] }, transition: { duration: 0.9, ease: 'easeInOut' } }
    case 'wrong':
      return { animate: { rotate: [0, -6, 5, -3, 0], y: [0, 3, 0] }, transition: { duration: 0.65, ease: 'easeInOut' } }
    case 'streak':
      return { animate: { rotate: [0, -18, 340, 360], scale: [1, 1.12, 1.12, 1] }, transition: { duration: 0.95, ease: 'easeInOut' } }
    case 'round':
      return { animate: { y: [0, -24, 0, -24, 0], scale: [1, 1.14, 1, 1.14, 1] }, transition: { duration: 1.3, ease: 'easeInOut' } }
    case 'sticker':
      return { animate: { scale: [1, 1.2, 0.98, 1.08, 1], rotate: [0, -8, 8, -3, 0] }, transition: { duration: 1.3, ease: 'easeInOut' } }
    case 'hint':
      return { animate: { x: [0, 10, 0, 10, 0], rotate: [0, -4, 0, -4, 0] }, transition: { duration: 0.85, ease: 'easeInOut' } }
    case 'welcome':
      return { animate: { rotate: [0, -12, 12, -8, 0] }, transition: { duration: 0.95, ease: 'easeInOut' } }
    case 'idle':
    default:
      return { animate: { y: [0, -6, 0] }, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }
  }
}

const emojiFallback = (motionKind: string): string => {
  switch (motionKind) {
    case 'twinkle': return '🚀'
    case 'rise': return '🐙'
    case 'fall': return '🦕'
    default: return '🦄'
  }
}

interface MascotProps {
  sx?: SxProps<Theme>
  // DEV/screenshot harness: force an initial reaction pose (e.g. /dev/mascot?event=correct).
  forceEvent?: MascotEvent
}

const Mascot: React.FC<MascotProps> = ({ sx, forceEvent }) => {
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const reduce = useReducedMotion()
  const [loaded, setLoaded] = useState<{ id: string; mascot: string } | null>(null)
  const [pose, setPose] = useState<MascotEvent>(forceEvent ?? 'idle')
  const [bubble, setBubble] = useState<string | null>(
    forceEvent && COPY[forceEvent] ? pick(COPY[forceEvent]!) : null,
  )
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tap reactions: cycle through TAP_ANIMS on each tap (a transient animation over the base pose).
  const [tapAnim, setTapAnim] = useState<TapAnim | null>(null)
  const tapIndex = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current) }, [])

  const handleTap = () => {
    if (reduce) return // reduced motion → no tap animation (parity)
    const anims = getTapAnims(themeId) // this world's personality set
    const a = anims[tapIndex.current % anims.length]
    tapIndex.current += 1
    setTapAnim(a)
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => setTapAnim(null), TAP_ANIM_MAX_MS)
  }

  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (alive && a?.mascot) setLoaded({ id: themeId, mascot: a.mascot })
    })
    return () => {
      alive = false
    }
  }, [themeId])

  // React to gameplay events. A non-idle pose holds briefly, then eases back to idle; the bubble
  // auto-dismisses on its own timer.
  useEffect(() => {
    const unsub = mascotBus.subscribe((event) => {
      if (event === 'idle') {
        setPose('idle')
        return
      }
      setPose(event)
      const copy = COPY[event]
      if (copy) {
        setBubble(pick(copy))
        if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
        bubbleTimer.current = setTimeout(() => setBubble(null), 1800)
      }
      if (poseTimer.current) clearTimeout(poseTimer.current)
      poseTimer.current = setTimeout(() => setPose('idle'), HOLD_MS[event] ?? 900)
    })
    return () => {
      unsub()
      if (poseTimer.current) clearTimeout(poseTimer.current)
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current)
    }
  }, [])

  const url = loaded && loaded.id === themeId ? loaded.mascot : ''
  const { animate, transition } = poseAnim(pose)
  const badge = BADGE[pose]

  return (
    <Box
      data-mascot-event={pose}
      sx={{
        position: 'fixed',
        zIndex: 6,
        left: 'calc(env(safe-area-inset-left) + 6px)',
        bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
        width: { xs: 84, md: 120 },
        height: { xs: 84, md: 120 },
        pointerEvents: 'none',
        // Phones: play surface first — hide in landscape, small in portrait.
        [PHONE_LANDSCAPE]: { display: 'none' },
        [PHONE_PORTRAIT]: { width: 52, height: 52 },
        ...sx,
      }}
    >
      {/* Speech bubble — above the sprite, offset toward centre so it never runs off the corner. */}
      {bubble && (
        <Box
          component={motion.div}
          aria-hidden
          initial={reduce ? undefined : { opacity: 0, y: 8, scale: 0.8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          sx={{
            position: 'absolute',
            bottom: '92%',
            left: '38%',
            transform: 'translateX(-10%)',
            whiteSpace: 'nowrap',
            px: 1.4,
            py: 0.6,
            borderRadius: '14px',
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontWeight: 700,
            fontSize: { xs: '0.85rem', md: '1rem' },
            boxShadow: theme.customShadows.card,
            border: `2px solid ${hexToRgba(theme.palette.primary.main, 0.4)}`,
            // Little tail pointing down toward the mascot.
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -7,
              left: 18,
              width: 0,
              height: 0,
              borderLeft: '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop: `8px solid ${theme.palette.background.paper}`,
            },
          }}
        >
          {bubble}
        </Box>
      )}

      {/* Expression badge — the static pose swap under reduced motion; a small accent otherwise. */}
      {badge && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -4,
            right: -2,
            fontSize: { xs: '1.3rem', md: '1.7rem' },
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
            zIndex: 1,
          }}
        >
          {badge}
        </Box>
      )}

      <Box
        component={motion.button}
        type="button"
        onClick={handleTap}
        aria-label="Tryk på figuren"
        animate={reduce ? undefined : tapAnim ? tapAnim.animate : animate}
        transition={reduce ? undefined : tapAnim ? tapAnim.transition : transition}
        sx={{
          width: '100%',
          height: '100%',
          p: 0,
          border: 'none',
          background: 'transparent',
          display: 'block',
          cursor: 'pointer',
          pointerEvents: 'auto', // tappable even though the container is click-through
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
        }}
      >
        {url ? (
          <Box
            component="img"
            src={url}
            alt=""
            draggable={false}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.28))',
              userSelect: 'none',
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: { xs: '3rem', md: '4.2rem' },
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.28))',
            }}
          >
            {emojiFallback(theme.scene.ambient.motion)}
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default Mascot
