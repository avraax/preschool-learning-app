import { useCallback } from 'react'
import { useAnimationControls } from 'framer-motion'
import type { SxProps, Theme } from '@mui/material/styles'
import { useReducedMotion } from './useReducedMotion'

// Living-card behaviour (Liveliness PRD-02 §5). Two cheap, independent motions on a menu card:
//   • idle breathe — pure CSS keyframe (scale 1 → 1.012 → 1), phased by card index, gated by
//     `prefers-reduced-motion` and pausable via animationPlayState while a wipe covers the menu.
//   • tap squash + attract wiggle — framer, driven imperatively on the ONE affected card only.
// Composed on SEPARATE nested elements so the CSS breathe transform and the framer transforms
// don't fight. Reduced motion → no breathe, and bump/wiggle become no-ops.

interface UseLivingCardArgs {
  index: number
  frozen?: boolean // pause breathe (menu not foreground / a wipe is covering)
}

interface LivingCard {
  breatheSx: SxProps<Theme>
  controls: ReturnType<typeof useAnimationControls>
  bump: () => void // tap squash/stretch
  wiggle: () => void // idle-attract one-shot bounce/tilt
}

export function useLivingCard({ index, frozen = false }: UseLivingCardArgs): LivingCard {
  const reduce = useReducedMotion()
  const controls = useAnimationControls()

  // Out-of-phase, gentle, slightly varied per index so the grid breathes organically.
  const duration = 3.6 + (index % 5) * 0.25
  const delay = index * 0.35

  const breatheSx: SxProps<Theme> = {
    '@media (prefers-reduced-motion: no-preference)': {
      '@keyframes livingCardBreathe': {
        '0%, 100%': { transform: 'scale(1)' },
        '50%': { transform: 'scale(1.012)' },
      },
      animation: `livingCardBreathe ${duration}s ease-in-out ${delay}s infinite`,
      animationPlayState: frozen ? 'paused' : 'running',
      willChange: 'transform',
    },
  }

  const bump = useCallback(() => {
    if (reduce) return
    controls.start({
      scaleX: [1, 0.94, 1.03, 1],
      scaleY: [1, 1.06, 0.97, 1],
      transition: { duration: 0.32, ease: 'easeOut' },
    })
  }, [controls, reduce])

  const wiggle = useCallback(() => {
    if (reduce) return
    controls.start({
      rotate: [0, -6, 6, -4, 0],
      y: [0, -8, 0],
      transition: { duration: 0.7, ease: 'easeInOut' },
    })
  }, [controls, reduce])

  return { breatheSx, controls, bump, wiggle }
}

export default useLivingCard
