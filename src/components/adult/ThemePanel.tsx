import React, { useEffect, useState } from 'react'
import { Box, Dialog, DialogContent, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { motion } from 'framer-motion'
import AdultBackHeader from './AdultBackHeader'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets } from '../../theme/sceneAssets'

// "Tema" adult sub-panel. Moved here from the old front-page corner ThemeSelector so all
// parent-facing controls live in one place ("Til de voksne"). Picking a skin applies it live
// (AppThemeProvider rebuilds the MUI theme) — the panel stays open so several can be compared.
// Visuals mirror the old selector popover: circular scene thumbnails with an active ring.

interface ThemePanelProps {
  open: boolean
  onClose: () => void
}

const ThemePanel: React.FC<ThemePanelProps> = ({ open, onClose }) => {
  const theme = useTheme()
  const { themeId, setThemeId, availableThemes } = useThemeSwitch()
  // Lazily collect each world's scene thumbnail (tiny URL strings; bytes load only when the
  // <img> renders). Themes without a world keep their emoji.
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    let alive = true
    availableThemes.forEach((t) => {
      loadSceneAssets(t.id).then((a) => {
        if (alive && a?.selectorThumb) {
          setThumbs((prev) => (prev[t.id] ? prev : { ...prev, [t.id]: a.selectorThumb }))
        }
      })
    })
    return () => {
      alive = false
    }
  }, [availableThemes, open])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <AdultBackHeader title="Tema 🎨" onBack={onClose} />
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Vælg appens udseende. Ændringen sker med det samme.
        </Typography>

        <Box
          role="group"
          aria-label="Vælg tema"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
          }}
        >
          {availableThemes.map((t) => {
            const isActive = t.id === themeId
            const ring = isActive
              ? theme.palette.primary.main
              : alpha(theme.palette.primary.main, 0.18)
            return (
              <Box
                key={t.id}
                component={motion.button}
                type="button"
                onClick={() => setThemeId(t.id)}
                aria-label={`Tema: ${t.name}`}
                aria-pressed={isActive}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.93 }}
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  py: 1.25,
                  px: 0.5,
                  border: 'none',
                  borderRadius: 3,
                  backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Circular thumbnail with a ring */}
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '3px solid',
                    borderColor: ring,
                    backgroundColor: 'rgba(255,255,255,0.6)',
                    boxShadow: isActive
                      ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.22)}`
                      : '0 1px 5px rgba(0,0,0,0.12)',
                    fontSize: '2rem',
                    lineHeight: 1,
                  }}
                >
                  {thumbs[t.id] ? (
                    <Box
                      component="img"
                      src={thumbs[t.id]}
                      alt=""
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Box component="span">{t.emoji}</Box>
                  )}
                </Box>
                <Box
                  component="span"
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.name}
                </Box>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
    </Dialog>
  )
}

export default ThemePanel
