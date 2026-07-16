import React from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { hexToRgba } from '../../theme/tokens/helpers'
import { contactShadow } from '../../theme/depth'
import { CHARGE, CHARGE_IN_OPACITY, CHARGE_IN_SCALE, idleFloat } from '../../theme/motion'
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'

// PromptFocus (Liveliness PRD-06 F2) — the in-world focal presentation that RETIRES the frosted
// `PromptStage` card. The question's subject rests directly in the calm, frozen world exactly like
// a SceneObject: on a grounding light-pool with a soft contact shadow beneath, "Hør igen" a floating
// pill below it. There is NO frosted panel, NO border, and NO `backdrop-filter` — nothing here reads
// as a card, so the board feels like the same hand-made place as the menu the child just left.
//
// Legibility over busy/dark backdrops comes from the subject's OWN light-pool + a single very-soft
// wide halo (barely-there, not a frame) + the world being frozen and quiet behind it (PRD-06 F3).
// Sits in GameShell's `promptStage` slot, which still sizes it to the anti-void 40%/30% band — only
// the MATERIAL of what fills it changed.

interface PromptFocusProps {
  accent: string
  // Change per question so the subject re-runs its charge-in (the anticipation beat).
  chargeKey?: string | number
  // The baked-art <img> | config.renderHero node | large glyph <Typography>.
  subject: React.ReactNode
  // The "Hør igen" pill, floated beneath the subject.
  repeat?: React.ReactNode
  sx?: SxProps<Theme>
}

const PromptFocus: React.FC<PromptFocusProps> = ({ accent, chargeKey, subject, repeat, sx }) => {
  const theme = useTheme()
  const reduce = useReducedMotion()
  const dark = theme.scene.dark
  const float = idleFloat(reduce)

  return (
    <Box
      data-prompt-focus
      sx={[
        {
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 1, md: 1.5 },
          [PHONE_LANDSCAPE]: { gap: 0.5 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Subject zone — the subject rests IN the world (pool + contact shadow), not in a card. */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Wide, barely-there readability halo — keeps the subject legible over busy backdrops
            WITHOUT reading as a frame (very low opacity, heavily blurred, no edge). */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '82%',
            height: '82%',
            borderRadius: '50%',
            background: dark
              ? `radial-gradient(circle, ${hexToRgba('#0A1230', 0.42)} 0%, ${hexToRgba('#0A1230', 0)} 68%)`
              : `radial-gradient(circle, ${hexToRgba('#FFFFFF', 0.5)} 0%, ${hexToRgba('#FFFFFF', 0)} 70%)`,
            filter: 'blur(26px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Grounding light-pool — a warm pool of light the subject SEATS in (reused from SceneObject:
            warm-white core → accent-tinted edge; brighter on dark worlds). */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            top: '52%',
            transform: 'translate(-50%, -50%)',
            width: '56%',
            height: '56%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${hexToRgba('#FFFFFF', dark ? 0.34 : 0.55)} 0%, ${hexToRgba(accent, 0.2)} 38%, ${hexToRgba(accent, 0)} 68%)`,
            filter: 'blur(10px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Soft contact-shadow ellipse beneath the subject — grounds it in the world. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: '4%',
            width: '46%',
            height: '13%',
            transform: 'translateX(-50%)',
            background: contactShadow(accent, dark ? 0.9 : 1),
            filter: 'blur(7px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Subject — charges in per question (keyed), then breathes with a gentle idle float. */}
        <Box
          component={motion.div}
          key={chargeKey}
          initial={reduce ? false : { opacity: 0, scale: CHARGE_IN_SCALE[0] }}
          animate={reduce ? {} : { opacity: [...CHARGE_IN_OPACITY], scale: [...CHARGE_IN_SCALE] }}
          transition={reduce ? undefined : CHARGE}
          sx={{
            position: 'relative',
            zIndex: 1,
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
            {subject}
          </Box>
        </Box>
      </Box>

      {/* "Hør igen" pill — floats beneath the subject (no panel around it). */}
      {repeat && <Box sx={{ flex: '0 0 auto', zIndex: 1 }}>{repeat}</Box>}
    </Box>
  )
}

export default PromptFocus
