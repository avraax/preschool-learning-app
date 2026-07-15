import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import type { AmbientMotion } from '../../theme/tokens/types'

// Reusable themed particle burst (Liveliness PRD-02 §5) — extracted from ThemeMascot's original
// `spawnBubbleBurst`. A fresh burst of rising bubbles / stars / leaves / sparkles keyed off the
// world's ambient `motion`, drawn in pure CSS (clip-path shapes), that rises out of the host and
// pops. Non-interactive; the host must be `position: relative` (or fixed) with visible overflow.
//
// Imperative: call `ref.current.fire()` from an event handler (tap / correct answer / attract).
// Bursts are capped so rapid taps can't spawn unbounded particles.

export interface ThemedBurstHandle {
  fire: () => void
}

interface ThemedBurstProps {
  motionKind: AmbientMotion // theme.scene.ambient.motion: rise=bubbles, twinkle/drift=stars, fall=leaves
  originTop?: string // vertical origin of the burst within the host (default '30%')
  count?: number // particles per burst (randomized around this; default ~11)
}

interface Particle {
  id: number
  x: number // horizontal offset from centre (px)
  size: number
  rise: number
  drift: number
  duration: number
}

// Above this many live particles, a new fire() is ignored (≈2 bursts) — the PRD's concurrency cap.
const MAX_ACTIVE = 26

const ThemedBurst = forwardRef<ThemedBurstHandle, ThemedBurstProps>(
  ({ motionKind, originTop = '30%', count = 11 }, ref) => {
    const [particles, setParticles] = useState<Particle[]>([])
    const nextId = useRef(0)

    // Math.random is safe here: fire() only runs from event handlers / effects, never during render.
    const fire = useCallback(() => {
      setParticles((prev) => {
        if (prev.length > MAX_ACTIVE) return prev // cap concurrent bursts
        const n = count + Math.floor(Math.random() * 5) - 2
        const burst: Particle[] = []
        for (let i = 0; i < Math.max(6, n); i++) {
          burst.push({
            id: nextId.current++,
            x: (Math.random() * 2 - 1) * 52,
            size: 12 + Math.random() * 20,
            rise: 150 + Math.random() * 170,
            drift: (Math.random() * 2 - 1) * 40,
            duration: 1.3 + Math.random() * 1.1,
          })
        }
        return [...prev, ...burst]
      })
    }, [count])

    useImperativeHandle(ref, () => ({ fire }), [fire])

    const remove = (id: number) => setParticles((prev) => prev.filter((p) => p.id !== id))

    const isStar = motionKind === 'twinkle' || motionKind === 'drift'
    const isLeaf = motionKind === 'fall'

    return (
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        {particles.map((p) => (
          <Box
            key={p.id}
            component={motion.div}
            initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
            animate={{ opacity: [0, 0.95, 0.85, 0], scale: [0.3, 1, 1], x: p.drift, y: -p.rise }}
            transition={{ duration: p.duration, ease: 'easeOut' }}
            onAnimationComplete={() => remove(p.id)}
            style={{
              position: 'absolute',
              left: `calc(50% + ${p.x}px)`,
              top: originTop,
              width: p.size,
              height: p.size,
              borderRadius: isStar || isLeaf ? undefined : '50%',
              ...(isStar
                ? {
                    background:
                      'radial-gradient(circle, #ffffff 0%, rgba(255,247,214,0.95) 45%, rgba(255,210,120,0) 78%)',
                    clipPath:
                      'polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)',
                    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9))',
                  }
                : isLeaf
                  ? {
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
    )
  },
)

ThemedBurst.displayName = 'ThemedBurst'

export default ThemedBurst
