// Shared bits of the settings panes, so the five of them read as one surface.

import React from 'react'
import { Box, Typography } from '@mui/material'

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
