import React, { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme, type SxProps, type Theme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets } from '../../theme/sceneAssets'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { getTapAnims, TAP_ANIM_MAX_MS, type TapAnim } from '../../theme/mascotAnimations'
import ThemedBurst, { type ThemedBurstHandle } from './ThemedBurst'

// Per-world mascot (Theme Worlds PRD §5.4). The ONE interactive element of the world layer:
// gentle idle bob, and on tap it plays a reaction wiggle + spawns a fresh themed burst (via the
// shared <ThemedBurst>). Silent (no narration on tap). Renders nothing for themes without a mascot.
// Reduced motion → no idle/react/burst animation.
//
// Liveliness PRD-02: the burst is now the shared <ThemedBurst> (single source of truth with living
// cards), and an `attract` prop lets the idle/attract loop nudge the mascot into a beckon gesture.

// An externally-driven reaction (e.g. from a game answer). `cheer` = happy jump + scale + a
// fresh burst; `think` = a gentle puzzled shake. `null` = idle. Distinct from the tap reaction.
export type GuideReaction = 'cheer' | 'think' | null

interface ThemeMascotProps {
  sx?: SxProps<Theme> // positioning/size from the host page
  onTap?: () => void // optional extra action on tap
  parallaxDepth?: number // how strongly it rides the shared parallax driver
  reaction?: GuideReaction // external reaction trigger (game feedback) — see GuideReaction
  attract?: boolean // idle/attract loop nudge → a one-shot beckon gesture + small burst
}

const ThemeMascot: React.FC<ThemeMascotProps> = ({
  sx,
  onTap,
  parallaxDepth = 0.45,
  reaction = null,
  attract = false,
}) => {
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const reduce = useReducedMotion()
  // Tag the load with its themeId so a stale mascot isn't shown after a theme switch, without
  // a synchronous setState reset in the effect.
  const [loaded, setLoaded] = useState<{ id: string; mascot: string } | null>(null)
  const [tapAnim, setTapAnim] = useState<TapAnim | null>(null)
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapIndex = useRef(0)
  const burstRef = useRef<ThemedBurstHandle>(null)

  const lines = theme.scene.mascot.lines
  // Burst matches the world's ambient style: stars (space), leaves (dino), bubbles (ocean).
  const burstMotion = theme.scene.ambient.motion

  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (alive && a?.mascot) setLoaded({ id: themeId, mascot: a.mascot })
    })
    return () => {
      alive = false
    }
  }, [themeId])

  const url = loaded && loaded.id === themeId ? loaded.mascot : ''

  // A `cheer` reaction (correct answer) pops a celebratory burst. Deferred to the next frame so we
  // never call the burst's setState synchronously during this effect (avoids cascading renders).
  useEffect(() => {
    if (reaction !== 'cheer' || reduce) return
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [reaction, reduce])

  // Idle/attract nudge (Liveliness PRD-02 §6): a one-shot beckon reusing this world's first tap
  // anim + a small burst. The parent toggles `attract` true→false each idle cycle so this re-fires.
  useEffect(() => {
    if (!attract || reduce) return
    const anims = getTapAnims(themeId)
    setTapAnim(anims[0])
    if (reactTimer.current) clearTimeout(reactTimer.current)
    reactTimer.current = setTimeout(() => setTapAnim(null), TAP_ANIM_MAX_MS)
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [attract, reduce, themeId])

  useEffect(
    () => () => {
      if (reactTimer.current) clearTimeout(reactTimer.current)
    },
    [],
  )

  if (!url || !lines.length) return null

  const handleTap = () => {
    // Per-theme tap reaction (cycles through this world's set) + a themed burst. Skipped under RM.
    if (!reduce) {
      const anims = getTapAnims(themeId)
      const a = anims[tapIndex.current % anims.length]
      tapIndex.current += 1
      setTapAnim(a)
      if (reactTimer.current) clearTimeout(reactTimer.current)
      reactTimer.current = setTimeout(() => setTapAnim(null), TAP_ANIM_MAX_MS)
      burstRef.current?.fire()
    }

    onTap?.()
  }

  // Animation priority: external cheer (big happy jump) → external think (puzzled shake) →
  // tap/attract wiggle → idle bob. Reduced motion stays perfectly still.
  const animate = reduce
    ? undefined
    : reaction === 'cheer'
      ? { y: [0, -34, 0, -14, 0], scale: [1, 1.16, 1, 1.06, 1] }
      : reaction === 'think'
        ? { rotate: [0, -7, 7, -5, 0] }
        : tapAnim
          ? tapAnim.animate
          : { y: [0, -7, 0] }

  const transition = reduce
    ? undefined
    : reaction === 'cheer'
      ? { duration: 0.9, ease: 'easeInOut' as const }
      : reaction === 'think'
        ? { duration: 0.6, ease: 'easeInOut' as const }
        : tapAnim
          ? tapAnim.transition
          : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' as const }

  return (
    // Outer wrapper rides the shared parallax driver (its own plane → depth separation from
    // the scene). Inner button does the idle bob / tap reaction; the burst overlays on top.
    <Box
      sx={{
        position: 'fixed',
        zIndex: 6,
        transform: `translate3d(calc(var(--parallax-x, 0px) * ${parallaxDepth}), calc(var(--parallax-y, 0px) * ${parallaxDepth}), 0)`,
        willChange: 'transform',
        ...sx,
      }}
    >
      <Box
        component={motion.button}
        type="button"
        onClick={handleTap}
        aria-label="Snak med figuren"
        animate={animate}
        transition={transition}
        sx={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          p: 0,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Box
          component="img"
          src={url}
          alt=""
          draggable={false}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.28))',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </Box>

      {/* Tap / cheer / attract burst — rises out of the mascot and pops (shared ThemedBurst). */}
      <ThemedBurst ref={burstRef} motionKind={burstMotion} originTop="26%" />
    </Box>
  )
}

export default ThemeMascot
