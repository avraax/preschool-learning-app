import React from 'react'
import { Box } from '@mui/material'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useTransitionNav } from '../../hooks/useTransitionNav'
import { useReducedMotion } from '../../hooks/useReducedMotion'

// One friendly, consistent back button (Liveliness PRD-02 §8) — replaces the two inconsistently
// styled static IconButtons (GameSelectionLayout's translucent one + GameShell's frosted one).
// Circular, frosted, ≥44px, safe-area aware. Tapping reverses the themed wipe (goBack + `back` SFX,
// handled by the transition system). Entrance slide-in; whileHover lift; whileTap nudges LEFT so
// the gesture reads as "back". Reduced motion → static (no entrance / hover / tap motion).

interface BackButtonProps {
  to: string
  variant?: 'menu' | 'game' // reserved; the look is intentionally identical everywhere
}

const BackButton: React.FC<BackButtonProps> = ({ to }) => {
  const { goBack } = useTransitionNav()
  const reduce = useReducedMotion()

  return (
    <Box
      component={motion.button}
      type="button"
      aria-label="Tilbage"
      onClick={() => goBack(to)}
      initial={reduce ? false : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
      whileHover={reduce ? undefined : { scale: 1.06 }}
      whileTap={reduce ? undefined : { scale: 0.9, x: -2 }}
      sx={{
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        minWidth: 44,
        minHeight: 44,
        p: 0,
        border: '1px solid rgba(255, 255, 255, 0.35)',
        borderRadius: '50%',
        color: 'inherit',
        cursor: 'pointer',
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        WebkitTapHighlightColor: 'transparent',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.4)' },
        },
      }}
    >
      <ArrowLeft size={24} />
    </Box>
  )
}

export default BackButton
