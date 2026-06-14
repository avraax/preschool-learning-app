import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme, type SxProps, type Theme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets } from '../../theme/sceneAssets'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useSimplifiedAudioHook } from '../../hooks/useSimplifiedAudio'

// Per-world mascot (Theme Worlds PRD §5.4). The ONE interactive element of the world layer:
// gentle idle bob, and on tap it (1) plays a reaction wiggle, (2) spawns a fresh burst of
// rising bubbles from itself, and (3) speaks a random Danish line via the existing
// single-channel audio (no new channel, no queue). Renders nothing for themes without a
// mascot. Reduced motion → no idle/react/bubble animation (tap-to-speak still works).

// An externally-driven reaction (e.g. from a game answer). `cheer` = happy jump + scale + a
// fresh burst; `think` = a gentle puzzled shake. `null` = idle. Distinct from the tap reaction.
export type GuideReaction = 'cheer' | 'think' | null

interface ThemeMascotProps {
  sx?: SxProps<Theme> // positioning/size from the host page
  onTap?: () => void // optional extra action on tap
  parallaxDepth?: number // how strongly it rides the shared parallax driver
  reaction?: GuideReaction // external reaction trigger (game feedback) — see GuideReaction
}

// One spawned bubble in a tap burst.
interface TapBubble {
  id: number
  x: number // horizontal offset from the mascot centre (px)
  size: number // diameter (px)
  rise: number // how far it floats up (px)
  drift: number // horizontal drift while rising (px)
  duration: number // seconds
}

const ThemeMascot: React.FC<ThemeMascotProps> = ({ sx, onTap, parallaxDepth = 0.45, reaction = null }) => {
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const reduce = useReducedMotion()
  const audio = useSimplifiedAudioHook({ componentId: 'ThemeMascot', autoInitialize: false })
  // Tag the load with its themeId so a stale mascot isn't shown after a theme switch, without
  // a synchronous setState reset in the effect.
  const [loaded, setLoaded] = useState<{ id: string; mascot: string } | null>(null)
  const [reacting, setReacting] = useState(false)
  const [bubbles, setBubbles] = useState<TapBubble[]>([])
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextBubbleId = useRef(0)

  const lines = theme.scene.mascot.lines
  // Tap burst matches the world's ambient style: stars (space), leaves (dino), bubbles (ocean).
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

  // Build a fresh burst of bubbles rising from the mascot (built from scratch — not the
  // balloon system). Safe to use Math.random here: this runs in an event handler / effect,
  // never during render.
  const spawnBubbleBurst = useCallback(() => {
    const count = 9 + Math.floor(Math.random() * 5) // 9–13 bubbles
    const burst: TapBubble[] = []
    for (let i = 0; i < count; i++) {
      burst.push({
        id: nextBubbleId.current++,
        x: (Math.random() * 2 - 1) * 52,
        size: 12 + Math.random() * 20,
        rise: 150 + Math.random() * 170,
        drift: (Math.random() * 2 - 1) * 40,
        duration: 1.3 + Math.random() * 1.1,
      })
    }
    setBubbles((prev) => [...prev, ...burst])
  }, [])

  // A `cheer` reaction (correct answer) pops a celebratory burst. The burst is deferred to the
  // next frame so we never call setState synchronously during the effect (avoids cascading
  // renders). The cheer/think POSE itself is driven directly off the `reaction` prop below; the
  // parent clears the prop after a beat, so a repeated same-value reaction re-fires.
  useEffect(() => {
    if (reaction !== 'cheer' || reduce) return
    const raf = requestAnimationFrame(() => spawnBubbleBurst())
    return () => cancelAnimationFrame(raf)
  }, [reaction, reduce, spawnBubbleBurst])

  useEffect(() => () => {
    if (reactTimer.current) clearTimeout(reactTimer.current)
  }, [])

  if (!url || !lines.length) return null

  const removeBubble = (id: number) => setBubbles((prev) => prev.filter((b) => b.id !== id))

  const handleTap = () => {
    // Reaction wiggle + bubble burst (both skipped under reduced motion).
    if (!reduce) {
      setReacting(true)
      if (reactTimer.current) clearTimeout(reactTimer.current)
      reactTimer.current = setTimeout(() => setReacting(false), 650)
      spawnBubbleBurst()
    }

    onTap?.()

    if (!audio.isAudioReady) return
    audio.updateUserInteraction() // iOS: refresh interaction timestamp before playback
    audio.cancelCurrentAudio() // honor no-queue: a fresh tap interrupts the previous line
    const line = lines[Math.floor(Math.random() * lines.length)]
    audio.speak(line).catch(() => {})
  }

  // Animation priority: external cheer (big happy jump) → external think (puzzled shake) →
  // tap wiggle → idle bob. Reduced motion stays perfectly still.
  const animate = reduce
    ? undefined
    : reaction === 'cheer'
      ? { y: [0, -34, 0, -14, 0], scale: [1, 1.16, 1, 1.06, 1] }
      : reaction === 'think'
        ? { rotate: [0, -7, 7, -5, 0] }
        : reacting
          ? { scale: [1, 1.14, 0.96, 1.04, 1], rotate: [0, -6, 6, -2, 0] }
          : { y: [0, -7, 0] }

  const transition = reduce
    ? undefined
    : reaction === 'cheer'
      ? { duration: 0.9, ease: 'easeInOut' as const }
      : reaction === 'think'
        ? { duration: 0.6, ease: 'easeInOut' as const }
        : reacting
          ? { duration: 0.65, ease: 'easeInOut' as const }
          : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' as const }

  return (
    // Outer wrapper rides the shared parallax driver (its own plane → depth separation from
    // the scene). Inner button does the idle bob / tap reaction; bubbles overlay on top.
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

      {/* Tap bubble burst — rises out of the mascot and pops (fades). Non-interactive. */}
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        {bubbles.map((b) => (
          <Box
            key={b.id}
            component={motion.div}
            initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
            animate={{ opacity: [0, 0.95, 0.85, 0], scale: [0.3, 1, 1], x: b.drift, y: -b.rise }}
            transition={{ duration: b.duration, ease: 'easeOut' }}
            onAnimationComplete={() => removeBubble(b.id)}
            style={{
              position: 'absolute',
              left: `calc(50% + ${b.x}px)`,
              top: '26%',
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              ...(burstMotion === 'twinkle' || burstMotion === 'drift'
                ? {
                    // 4-point sparkle STAR (clip-path) so it's unmistakably not a bubble.
                    // Use filter drop-shadow (follows the clip), not box-shadow (would be rect).
                    background:
                      'radial-gradient(circle, #ffffff 0%, rgba(255,247,214,0.95) 45%, rgba(255,210,120,0) 78%)',
                    clipPath:
                      'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
                    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))',
                  }
                : burstMotion === 'fall'
                ? {
                    // Leaf burst (dino) — playful poof of leaves.
                    borderRadius: '0 100% 0 100%',
                    background: 'linear-gradient(135deg, #9CCC65 0%, #558B2F 100%)',
                    boxShadow: 'inset 1px -1px 2px rgba(0,0,0,0.18)',
                  }
                : {
                    background:
                      'radial-gradient(circle at 33% 28%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.45) 38%, rgba(200,240,255,0.16) 72%, rgba(200,240,255,0) 100%)',
                    border: '1.5px solid rgba(255,255,255,0.75)',
                    boxShadow: 'inset 0 0 8px rgba(255,255,255,0.5)',
                  }),
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

export default ThemeMascot
