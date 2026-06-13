import React from 'react'
import { Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'

// Front-page theme picker: a row of emoji buttons (one per skin). Tapping one switches
// the app theme instantly and persists the choice. Designed for non-readers — big emoji,
// the active theme gets a coloured ring + lift.
const ThemeSelector: React.FC = () => {
  const theme = useTheme()
  const { themeId, setThemeId, availableThemes } = useThemeSwitch()

  return (
    <Box
      role="group"
      aria-label="Vælg tema"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: { xs: 1, md: 1.5 },
      }}
    >
      {availableThemes.map((t) => {
        const active = t.id === themeId
        return (
          <Box
            key={t.id}
            component={motion.button}
            type="button"
            onClick={() => setThemeId(t.id)}
            aria-label={`Tema: ${t.name}`}
            aria-pressed={active}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              width: { xs: 56, md: 64 },
              minHeight: 56,
              py: 0.75,
              borderRadius: 3,
              border: '3px solid',
              borderColor: active ? theme.palette.primary.main : 'transparent',
              backgroundColor: active
                ? alpha(theme.palette.primary.main, 0.12)
                : 'rgba(255, 255, 255, 0.7)',
              boxShadow: active
                ? `0 6px 18px ${alpha(theme.palette.primary.main, 0.35)}`
                : '0 2px 8px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(6px)',
              transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <Box component="span" sx={{ fontSize: { xs: '1.6rem', md: '1.9rem' }, lineHeight: 1 }}>
              {t.emoji}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: { xs: '0.6rem', md: '0.68rem' },
                fontWeight: 700,
                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                whiteSpace: 'nowrap',
              }}
            >
              {t.name}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

export default ThemeSelector
