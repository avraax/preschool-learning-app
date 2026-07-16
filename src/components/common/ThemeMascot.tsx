import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme, type SxProps, type Theme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets, type MascotPoses } from '../../theme/sceneAssets'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { getTapAnims, TAP_ANIM_MAX_MS, type TapAnim } from '../../theme/mascotAnimations'
import ThemedBurst, { type ThemedBurstHandle } from './ThemedBurst'

// Per-world mascot (Theme Worlds PRD §5.4) — upgraded to the reactive GUIDE (Liveliness PRD-05 W6).
// The ONE interactive element of the world layer. It now cross-fades between baked soft-3D POSES
// (idle / greet / point / celebrate) on top of the existing idle bob, tap wiggle + themed burst:
//   • greets on mount (menu arrival), then settles to idle,
//   • points (beckons) during an idle-attract nudge,
//   • celebrates on an external `cheer` (e.g. a level-up landing on a menu),
//   • idle otherwise.
// Poses are 4 stacked <img>s that only swap OPACITY (cheap, flicker-safe, no layout change). A theme
// with no authored poses falls back to `{ idle: mascot }` (the single sprite), so nothing regresses.
// Reduced motion → a static idle pose, no bob/beckon/cross-fade.

export type GuideReaction = 'cheer' | 'think' | null
type Pose = keyof MascotPoses // 'idle' | 'greet' | 'point' | 'celebrate'

interface ThemeMascotProps {
  sx?: SxProps<Theme>
  onTap?: () => void
  parallaxDepth?: number
  reaction?: GuideReaction
  attract?: boolean
}

const GREET_MS = 2000
const POINT_MS = 1400

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
  const [loaded, setLoaded] = useState<{ id: string; poses: MascotPoses } | null>(null)
  const [tapAnim, setTapAnim] = useState<TapAnim | null>(null)
  // A short-lived pose (greet on mount / point on attract) layered over the resting idle.
  const [transient, setTransient] = useState<Pose | null>(reduce ? null : 'greet')
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tapIndex = useRef(0)
  const burstRef = useRef<ThemedBurstHandle>(null)

  const lines = theme.scene.mascot.lines
  const burstMotion = theme.scene.ambient.motion

  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (!alive || !a) return
      // Prefer authored poses; fall back to the single sprite as idle so un-updated skins still work.
      const poses = a.mascotPoses ?? (a.mascot ? { idle: a.mascot } : null)
      if (poses) setLoaded({ id: themeId, poses })
    })
    return () => {
      alive = false
    }
  }, [themeId])

  // Greet on mount / theme change (skipped under reduced motion), then settle to idle.
  useEffect(() => {
    if (reduce) {
      setTransient(null)
      return
    }
    setTransient('greet')
    if (poseTimer.current) clearTimeout(poseTimer.current)
    poseTimer.current = setTimeout(() => setTransient(null), GREET_MS)
    return () => {
      if (poseTimer.current) clearTimeout(poseTimer.current)
    }
  }, [themeId, reduce])

  // Cheer reaction pops a celebratory burst (deferred a frame — no setState during this effect).
  useEffect(() => {
    if (reaction !== 'cheer' || reduce) return
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [reaction, reduce])

  // Idle/attract nudge (PRD-02 §6 + PRD-05 W6): beckon = the `point` pose + this world's first tap
  // anim + a small burst. Parent toggles `attract` true→false each idle cycle so this re-fires.
  useEffect(() => {
    if (!attract || reduce) return
    const anims = getTapAnims(themeId)
    setTapAnim(anims[0])
    setTransient('point')
    if (reactTimer.current) clearTimeout(reactTimer.current)
    reactTimer.current = setTimeout(() => setTapAnim(null), TAP_ANIM_MAX_MS)
    if (poseTimer.current) clearTimeout(poseTimer.current)
    poseTimer.current = setTimeout(() => setTransient(null), POINT_MS)
    const raf = requestAnimationFrame(() => burstRef.current?.fire())
    return () => cancelAnimationFrame(raf)
  }, [attract, reduce, themeId])

  useEffect(
    () => () => {
      if (reactTimer.current) clearTimeout(reactTimer.current)
      if (poseTimer.current) clearTimeout(poseTimer.current)
    },
    [],
  )

  const poses = loaded && loaded.id === themeId ? loaded.poses : null

  // Which pose is showing: external cheer → celebrate; else the transient (greet/point); else idle.
  const activePose: Pose = reaction === 'cheer' ? 'celebrate' : transient ?? 'idle'

  // Distinct pose→url list to render as a cross-fade stack (only present poses; deduped).
  const layers = useMemo(() => {
    if (!poses) return [] as { pose: Pose; url: string }[]
    const order: Pose[] = ['idle', 'greet', 'point', 'celebrate']
    return order.filter((p) => poses[p]).map((p) => ({ pose: p, url: poses[p] as string }))
  }, [poses])

  if (!layers.length || !lines.length) return null

  // The active url (fall back to idle/first if the active pose isn't authored for this theme).
  const activeUrl = (poses && poses[activePose]) || layers[0].url

  const handleTap = () => {
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
          position: 'relative',
        }}
      >
        {/* Cross-fade pose stack — all present poses mounted; only the active one is opaque. */}
        {layers.map(({ pose, url }) => (
          <Box
            key={pose}
            component="img"
            src={url}
            alt=""
            draggable={false}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'bottom center',
              filter: 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.28))',
              pointerEvents: 'none',
              userSelect: 'none',
              opacity: url === activeUrl ? 1 : 0,
              transition: reduce ? 'none' : 'opacity 0.3s ease',
            }}
          />
        ))}
      </Box>

      {/* Tap / cheer / attract burst — rises out of the mascot and pops (shared ThemedBurst). */}
      <ThemedBurst ref={burstRef} motionKind={burstMotion} originTop="26%" />
    </Box>
  )
}

export default ThemeMascot
