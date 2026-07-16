import React from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { softShadow } from '../../theme/depth'

// TactilePill (Liveliness PRD-06 F4) — the shared soft-3D pill material for in-game HUD chrome, so
// "Hør igen" (RepeatButton) and the score (ScoreChip) read as ONE family that sits lightly on the
// world, matching the tactile-tile / SceneObject clay language (and replacing the old plain-MUI
// `boxShadow:2/4` button + the flat glowing score pill).
//
// Material: an accent-filled pill with a soft top sheen (the clay read), a grounded `softShadow()`
// drop-shadow, an inner-light highlight, and a small press-travel. No hard lip, no `backdrop-filter`.
// The caller supplies padding / font / content via `sx` + children; content colour is the caller's
// (both consumers compute a legible on-accent colour). Renders a real <button> when `onClick` is set,
// else a plain box (score can be non-interactive).

interface TactilePillProps {
  accent: string
  onClick?: () => void
  disabled?: boolean
  ariaLabel?: string
  children: React.ReactNode
  sx?: SxProps<Theme>
}

const TactilePill: React.FC<TactilePillProps> = ({ accent, onClick, disabled = false, ariaLabel, children, sx }) => {
  const theme = useTheme()
  const dark = theme.scene.dark
  const interactive = !!onClick && !disabled

  return (
    <Box
      component={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={onClick ? disabled : undefined}
      aria-label={ariaLabel}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.9,
          minHeight: 44,
          px: 2,
          border: 'none',
          borderRadius: 999,
          // Clay pill: a soft white sheen over the accent fill (top-lit), grey when disabled.
          background: disabled
            ? theme.palette.grey[300]
            : `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 58%), ${accent}`,
          color: disabled ? theme.palette.grey[600] : undefined,
          fontFamily: 'inherit',
          // Grounded soft shadow + an inner top-light highlight → the "resting clay" read.
          filter: disabled ? 'none' : softShadow(dark ? 1.4 : 1.1),
          boxShadow: disabled ? 'none' : `inset 0 1px 0 rgba(255,255,255,0.4)`,
          opacity: disabled ? 0.7 : 1,
          cursor: interactive ? 'pointer' : 'default',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
          transition: 'transform 0.08s cubic-bezier(0.22,1,0.36,1), filter 0.2s ease',
          '&:focus-visible': interactive ? { outline: '3px solid', outlineColor: accent, outlineOffset: '2px' } : {},
          ...(interactive
            ? {
                '&:active': { transform: 'translateY(2px)' },
                '@media (hover: hover) and (pointer: fine)': {
                  '&:hover': { filter: softShadow(dark ? 1.9 : 1.6) },
                },
              }
            : {}),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  )
}

export default TactilePill
