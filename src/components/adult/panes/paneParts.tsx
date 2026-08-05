// Shared bits of the settings panes, so the five of them read as one surface.

import React from 'react'
import { Box, Switch, Typography } from '@mui/material'

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
 * The muted heading above a destructive strip (§7). Both strips use the same words so the visual
 * break reads the same in Barn and in Konto.
 */
export const DangerHeading: React.FC = () => (
  <Typography
    component="h4"
    sx={{
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'text.secondary',
      mb: 0.75,
    }}
  >
    Farlige handlinger
  </Typography>
)

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
