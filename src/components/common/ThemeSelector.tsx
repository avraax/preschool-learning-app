import React, { useEffect, useState } from 'react'
import { Box, Paper, ClickAwayListener } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets } from '../../theme/sceneAssets'

// Subtle front-page theme picker. Collapsed = a single round button showing the active
// theme's emoji (top-right corner, out of layout flow). Tap expands a small popover with
// all skins; picking one applies it and collapses. Tap-to-open (not hover) for touch.
const ThemeSelector: React.FC = () => {
  const theme = useTheme()
  const { themeId, setThemeId, availableThemes } = useThemeSwitch()
  const [open, setOpen] = useState(false)
  // Lazily collect each world's scene thumbnail (tiny URL strings; bytes load only when the
  // <img> renders). Themes without a world keep their emoji.
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  useEffect(() => {
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
  }, [availableThemes])

  const active = availableThemes.find((t) => t.id === themeId) ?? availableThemes[0]

  return (
    // Positioned by the host (rendered inline in the home header row), not pinned to the
    // viewport corner — so it aligns with the brand lockup and the card grid's right edge.
    <Box sx={{ position: 'relative', zIndex: 30 }}>
      <ClickAwayListener onClickAway={() => setOpen(false)}>
        <Box sx={{ position: 'relative' }}>
          {/* Collapsed toggle — shows the active theme's emoji */}
          <Box
            component={motion.button}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={`Skift tema (nuværende: ${active.name})`}
            aria-expanded={open}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            sx={{
              cursor: 'pointer',
              width: 54,
              height: 54,
              p: 0,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid',
              borderColor: open ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.4),
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              boxShadow: '0 3px 12px rgba(0, 0, 0, 0.18)',
              backdropFilter: 'blur(6px)',
              fontSize: '1.7rem',
              lineHeight: 1,
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}
          >
            {thumbs[active.id] ? (
              <Box
                component="img"
                src={thumbs[active.id]}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <Box component="span" sx={{ lineHeight: 1 }}>{active.emoji}</Box>
            )}
          </Box>

          {/* Expanded popover — all themes */}
          <AnimatePresence>
            {open && (
              <Box
                component={motion.div}
                initial={{ opacity: 0, scale: 0.85, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ transformOrigin: 'top right' }}
                sx={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0 }}
              >
                <Paper
                  elevation={8}
                  role="group"
                  aria-label="Vælg tema"
                  sx={{
                    p: 1.25,
                    borderRadius: 4,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 0.5,
                    backgroundColor: 'rgba(255, 255, 255, 0.97)',
                    backdropFilter: 'blur(8px)',
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
                        onClick={() => {
                          setThemeId(t.id)
                          setOpen(false)
                        }}
                        aria-label={`Tema: ${t.name}`}
                        aria-pressed={isActive}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.93 }}
                        sx={{
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 0.5,
                          width: 78,
                          py: 1,
                          px: 0.5,
                          border: 'none',
                          borderRadius: 3,
                          backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* Circular thumbnail with a ring — matches the collapsed chip */}
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
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
                            fontSize: '1.9rem',
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
                            fontSize: '0.72rem',
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
                </Paper>
              </Box>
            )}
          </AnimatePresence>
        </Box>
      </ClickAwayListener>
    </Box>
  )
}

export default ThemeSelector
