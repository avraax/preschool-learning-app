// Shared bits of the settings panes, so the five of them read as one surface.

import React from 'react'
import { Box, Switch, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

/**
 * A titled block inside a pane, with an optional explanatory line under the title.
 *
 * `caps={false}` for a title that embeds the CHILD'S NAME — the small-caps eyebrow is right for a
 * generic label ("SÅDAN GÅR DET") and wrong for a name, which it renders as shouting ("… FOR DEV").
 */
export const PaneSection: React.FC<{
  title: string
  hint?: React.ReactNode
  caps?: boolean
  children: React.ReactNode
}> = ({ title, hint, caps = true, children }) => (
  <Box>
    <Typography
      component="h4"
      sx={
        caps
          ? {
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mb: 0.75,
            }
          : { fontSize: '0.95rem', fontWeight: 700, mb: 0.5 }
      }
    >
      {title}
    </Typography>
    {hint && (
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {hint}
      </Typography>
    )}
    {children}
  </Box>
)

/**
 * A destructive block: **its own container, with its own heading** (Familie IA PRD §3.5).
 *
 * It used to be a `DangerHeading` over a strip separated by a `<Divider />`, which was fine while the
 * child actions and the account actions were two different panes. The merge put "Slet barnet" and
 * "Slet kontoen helt" in one pane, and NN/g is explicit that a divider inside one group still reads as
 * one group (Gestalt proximity): *"Avoid placing highly consequential actions … directly next to
 * options that are benign."* So each block gets spatial separation AND a redundant visual signal — a
 * distinct border and background — and the heading NAMES the blast radius, so it is legible without
 * reading the buttons.
 *
 * `data-danger-block` is the probe handle: two of these must be present and separate when signed in.
 */
export const DangerBlock: React.FC<{
  /** `fareBarn` / `fareKonto` — matches the `block` declared in `adultSettingsIa.ts`. */
  id: string
  /** "Farligt for Emil" / "Farligt for kontoen". */
  title: string
  children: React.ReactNode
}> = ({ id, title, children }) => {
  const theme = useTheme()
  return (
    <Box
      data-danger-block={id}
      sx={{
        border: '1px solid',
        borderColor: alpha(theme.palette.error.main, 0.35),
        bgcolor: alpha(theme.palette.error.main, 0.05),
        borderRadius: 2,
        p: 1.5,
      }}
    >
      <Typography
        component="h4"
        sx={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'error.main',
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  )
}

/**
 * One labelled on/off row. Shared by Lyd (sound, music) and Udseende ("Flydende grafik") so the two
 * panes read as one surface rather than each growing its own switch.
 */
export const ToggleRow: React.FC<{
  icon: React.ReactNode
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}> = ({ icon, label, hint, checked, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48 }}>
    <Box sx={{ display: 'flex', color: 'text.secondary', flex: '0 0 auto' }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{label}</Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {hint}
        </Typography>
      )}
    </Box>
    <Switch
      checked={checked}
      onChange={(_, v) => onChange(v)}
      slotProps={{ input: { 'aria-label': `${label} til/fra` } }}
    />
  </Box>
)
