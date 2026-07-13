import React from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { hexToRgba } from '../../theme/tokens/helpers'
import { CHARGE, CHARGE_IN_OPACITY, CHARGE_IN_SCALE, idleFloat } from '../../theme/motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// Prompt Stage (UI/UX Overhaul PRD §5.3) — a framed, generously-sized focal zone that anchors a
// game's question and eliminates the "dead vertical band" atop most games. Sits in GameShell's
// dedicated stage slot (which sizes it to ~34–42% of the body on iPad / ~26–34% phone-landscape).
//
// - Frame: rounded glass card with a section-accent hairline + the theme card shadow.
// - Content charges in with a slight overshoot on each new question (keyed by `chargeKey`) and
//   keeps a subtle idle float so it feels alive. Reduced motion → static.
// - `repeat` (e.g. the RepeatButton) renders beneath the hero content.

interface PromptStageProps {
  accent: string
  // Change this per question so the hero re-runs its charge-in (anticipation beat).
  chargeKey?: string | number
  repeat?: React.ReactNode
  children: React.ReactNode
}

const PromptStage: React.FC<PromptStageProps> = ({ accent, chargeKey, repeat, children }) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const paper = theme.palette.background.paper
  const float = idleFloat(reduce)

  return (
    <Box
      data-prompt-stage
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 1, md: 1.5 },
        px: { xs: 2, md: 3 },
        py: { xs: 1.5, md: 2 },
        borderRadius: '28px',
        background: dark ? hexToRgba(paper, 0.16) : hexToRgba(paper, 0.9),
        border: `2px solid ${hexToRgba(accent, dark ? 0.5 : 0.35)}`,
        boxShadow: theme.customShadows.card,
        backdropFilter: 'blur(12px) saturate(1.05)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.05)',
        overflow: 'hidden',
        [PHONE_LANDSCAPE]: { borderRadius: '18px', px: 1.5, py: 0.75, gap: 0.5 },
      }}
    >
      {/* Hero subject — charges in per question, then breathes. Fills the available stage height. */}
      <Box
        component={motion.div}
        key={chargeKey}
        initial={reduce ? false : { opacity: 0, scale: CHARGE_IN_SCALE[0] }}
        animate={reduce ? {} : { opacity: [...CHARGE_IN_OPACITY], scale: [...CHARGE_IN_SCALE] }}
        transition={reduce ? undefined : CHARGE}
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          component={motion.div}
          animate={float.animate}
          transition={float.transition}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          {children}
        </Box>
      </Box>

      {repeat && <Box sx={{ flex: '0 0 auto' }}>{repeat}</Box>}
    </Box>
  )
}

export default PromptStage

// A convenience hero-emoji renderer at the PRD's canonical size. Games can use their own markup
// (equation cards, words, waveforms), but a plain hero emoji is the common case.
export const HeroEmoji: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    component="span"
    sx={{
      fontSize: 'clamp(3.5rem, 14vh, 7rem)',
      lineHeight: 1,
      userSelect: 'none',
      [PHONE_LANDSCAPE]: { fontSize: 'clamp(2.2rem, 18vh, 3.2rem)' },
    }}
  >
    {children}
  </Box>
)
