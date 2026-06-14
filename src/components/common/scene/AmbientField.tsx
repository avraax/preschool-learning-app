import React, { useMemo } from 'react'
import { Box } from '@mui/material'
import type { SceneTokens } from '../../../theme/tokens/types'

// Floating ambient objects (Theme Worlds PRD §5.3): bubbles/leaves/stars drifting per the
// scene's `motion`. Positions/sizes/timings are randomized ONCE (memoized by theme) so they
// don't re-shuffle on re-render. Transforms-only animation; decorative + non-interactive.
// Reduced motion → render nothing (calm static scene).

interface AmbientFieldProps {
  scene: SceneTokens
  sprites: string[] // resolved URLs, aligned with scene.ambient.sprites
  themeId: string
  disabled?: boolean
}

interface AmbientItem {
  url: string
  left: number
  top: number
  size: number
  duration: number
  delay: number
  drift: number
}

// Deterministic PRNG so ambient layout is PURE during render (no Math.random — satisfies the
// react-hooks purity rule and prevents reshuffling on re-render) and stable per theme.
const hashSeed = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ambientKeyframes = {
  '@keyframes ambient-rise': {
    '0%': { transform: 'translate(0, 0)', opacity: 0 },
    '8%': { opacity: 0.9 },
    '92%': { opacity: 0.9 },
    '100%': { transform: 'translate(var(--drift, 0px), -100vh)', opacity: 0 },
  },
  '@keyframes ambient-fall': {
    '0%': { transform: 'translate(0, -10vh) rotate(0deg)', opacity: 0 },
    '8%': { opacity: 0.9 },
    '92%': { opacity: 0.9 },
    '100%': { transform: 'translate(var(--drift, 0px), 100vh) rotate(320deg)', opacity: 0 },
  },
  '@keyframes ambient-drift': {
    '0%': { transform: 'translate(-6vw, 0)', opacity: 0 },
    '10%': { opacity: 0.85 },
    '90%': { opacity: 0.85 },
    '100%': { transform: 'translate(6vw, -4vh)', opacity: 0 },
  },
  '@keyframes ambient-twinkle': {
    '0%, 100%': { transform: 'scale(0.7)', opacity: 0.2 },
    '50%': { transform: 'scale(1)', opacity: 0.95 },
  },
  // Occasional shooting star: flies across (per-star vector via CSS vars), then waits.
  // The flight spans 0→28% of the cycle so it's slower/longer; the rest is the idle gap.
  '@keyframes ambient-shoot': {
    '0%': { transform: 'translate3d(0, 0, 0)', opacity: 0 },
    '4%': { opacity: 1 },
    '18%': { opacity: 1 },
    '22%': { transform: 'translate3d(var(--shoot-dx, 64vw), var(--shoot-dy, 30vh), 0)', opacity: 0 },
    '100%': { transform: 'translate3d(var(--shoot-dx, 64vw), var(--shoot-dy, 30vh), 0)', opacity: 0 },
  },
} as const

// Shooting-star streaks for twinkle worlds — varied spawn points, directions, lengths and
// timings (staggered) so they appear occasionally from different parts of the sky. `angle`
// rotates the streak to trail behind its travel direction.
const SHOOTING_STARS = [
  { top: '6%', left: '-10%', dx: '82vw', dy: '34vh', angle: 24, len: 150, delay: '-2s', duration: '9s' },
  { top: '2%', left: '80%', dx: '-70vw', dy: '44vh', angle: 150, len: 120, delay: '-6s', duration: '12s' },
  { top: '34%', left: '-6%', dx: '46vw', dy: '40vh', angle: 44, len: 110, delay: '-11s', duration: '15s' },
]

const AmbientField: React.FC<AmbientFieldProps> = ({ scene, sprites, themeId, disabled }) => {
  const { count, motion } = scene.ambient
  const specs = scene.ambient.sprites

  // No sprite images → draw CSS bubbles (e.g. ocean). Otherwise use the sprite URLs.
  const cssBubbles = sprites.length === 0

  const items = useMemo<AmbientItem[]>(() => {
    if (disabled) return []
    const rng = makeRng(hashSeed(themeId) + count) // seeded by theme → stable, reshuffles on switch
    return Array.from({ length: count }, (_, i) => {
      const idx = sprites.length ? i % sprites.length : 0
      const [min, max] = cssBubbles
        ? motion === 'twinkle'
          ? [4, 12] // stars are small
          : motion === 'drift'
            ? [6, 16] // soft sparkles
            : motion === 'fall'
              ? [14, 30] // leaves
              : [8, 22] // bubbles
        : specs[idx]?.size ?? [16, 32]
      return {
        url: sprites.length ? sprites[idx] : '',
        left: rng() * 100,
        top: rng() * 90,
        size: Math.round(min + rng() * (max - min)),
        duration: 9 + rng() * 11,
        delay: -rng() * 14, // negative = staggered, already mid-flight on first paint
        drift: Math.round((rng() * 2 - 1) * 36),
      }
    })
  }, [count, themeId, disabled, sprites, specs, cssBubbles, motion])

  if (!items.length) return null

  const animName = `ambient-${motion}`

  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', ...ambientKeyframes }}>
      {items.map((item, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: `${item.left}%`,
            ...(motion === 'rise'
              ? { bottom: 0 }
              : motion === 'fall'
                ? { top: 0 }
                : { top: `${item.top}%` }),
            width: item.size,
            height: item.size,
            ...(item.url
              ? {
                  backgroundImage: `url(${item.url})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                }
              : motion === 'twinkle' || motion === 'drift'
                ? {
                    // CSS sparkle: a soft glowing dot (stars in space, gentle sparkles in Regnbue).
                    borderRadius: '50%',
                    background:
                      'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,247,214,0.9) 35%, rgba(255,247,214,0) 70%)',
                    boxShadow: '0 0 6px rgba(255,255,255,0.85)',
                  }
                : motion === 'fall'
                  ? {
                      // CSS leaf: rounded teardrop with a soft gradient (tumbles via keyframe).
                      borderRadius: '0 100% 0 100%',
                      background: 'linear-gradient(135deg, #9CCC65 0%, #558B2F 100%)',
                      boxShadow: 'inset 1px -1px 2px rgba(0,0,0,0.18)',
                    }
                  : {
                      // CSS bubble: soft glassy sphere — subtle, so it reads as gentle ambience.
                      borderRadius: '50%',
                      background:
                        'radial-gradient(circle at 33% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 42%, rgba(200,240,255,0.08) 72%, rgba(200,240,255,0) 100%)',
                      border: '1px solid rgba(255,255,255,0.5)',
                      boxShadow: 'inset 0 0 6px rgba(255,255,255,0.35)',
                    }),
            '--drift': `${item.drift}px`,
            animation: `${animName} ${item.duration}s ${motion === 'twinkle' ? 'ease-in-out' : 'linear'} ${item.delay}s infinite`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Occasional shooting stars (twinkle worlds only) — varied origins/directions. */}
      {motion === 'twinkle' &&
        SHOOTING_STARS.map((s, i) => (
          <Box
            key={`shoot-${i}`}
            sx={{
              position: 'absolute',
              top: s.top,
              left: s.left,
              '--shoot-dx': s.dx,
              '--shoot-dy': s.dy,
              animation: `ambient-shoot ${s.duration} ease-out ${s.delay} infinite`,
              willChange: 'transform, opacity',
            }}
          >
            <Box
              sx={{
                width: s.len,
                height: 2.5,
                borderRadius: 2,
                transform: `rotate(${s.angle}deg)`,
                transformOrigin: 'right center',
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
                filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.85))',
              }}
            />
          </Box>
        ))}
    </Box>
  )
}

export default AmbientField
