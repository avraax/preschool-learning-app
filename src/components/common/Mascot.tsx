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
import { idleFloat } from '../../theme/idleMotion'
import { PHONE_LANDSCAPE, PHONE_PORTRAIT } from '../../theme/phoneMedia'
import { MASCOT_CORNER_PHONE_PORTRAIT, MASCOT_CORNER_SIZE } from './mascotCorner'

// Reactive corner mascot (UI/UX Overhaul PRD §5.5). ONE reusable emotional guide that reacts to
// gameplay events (correct/wrong/streak/round/hint/sticker/welcome) via the `mascotBus`. Games
// emit from the same handler as their celebration/SFX; this component translates each event into
// a distinct pose + a short Danish speech bubble. Reduced motion → no transform animation, so the
// bubble carries the reaction on its own.
//
// Reuses the per-world sprite from `loadSceneAssets` and renders NOTHING until it resolves — the
// old emoji stand-in (and the emoji expression badge) are gone per de-emoji PRD-01 D5.

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

// Motion keyframes per pose (skipped under reduced motion). Every pose is a ONE-SHOT reaction that
// ends back at identity, which is what framer is for. The `idle` bob is NOT here any more: it was an
// infinite framer loop recalculating style 60× a second on a mascot that is doing nothing, and it now
// rides the sprite as a CSS keyframe animation (`idleFloat`) one layer down — see
// `src/theme/idleMotion.ts` and the nested-layer rule (Performance PRD-01 W1/F4).
const poseAnim = (event: MascotEvent): { animate?: TargetAndTransition; transition?: Transition } => {
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
      return {}
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
  // The idle bob, as CSS, on the SPRITE — one layer below the framer feedback on the button, so the
  // two transforms compose instead of overwriting each other. Stood down while a reaction pose or a
  // tap animation owns the motion, exactly as the old framer loop was.
  const bob = idleFloat(reduce || pose !== 'idle' || !!tapAnim, { distance: 6, durationS: 3.2, as: 'img' })

  // The corner footprint comes from `mascotCorner.ts` — full-bleed play surfaces RESERVE that same
  // value, so resizing the companion here can't leave a game overlapping it.

  return (
    <Box
      data-mascot-event={pose}
      sx={{
        position: 'fixed',
        zIndex: 6,
        left: 'calc(env(safe-area-inset-left) + 6px)',
        bottom: 'calc(env(safe-area-inset-bottom) + 2px)',
        width: MASCOT_CORNER_SIZE,
        height: MASCOT_CORNER_SIZE,
        pointerEvents: 'none',
        // Phones: play surface first — hide in landscape, small in portrait.
        [PHONE_LANDSCAPE]: { display: 'none' },
        [PHONE_PORTRAIT]: { width: MASCOT_CORNER_PHONE_PORTRAIT, height: MASCOT_CORNER_PHONE_PORTRAIT },
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
        {/* Nothing until the sprite resolves — never a flat emoji stand-in (de-emoji PRD-01 D5). */}
        {url && (
          <Box
            {...bob.props}
            component="img"
            src={url}
            alt=""
            draggable={false}
            sx={[
              {
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.28))',
                userSelect: 'none',
              },
              bob.sx,
            ]}
          />
        )}
      </Box>
    </Box>
  )
}

export default Mascot
