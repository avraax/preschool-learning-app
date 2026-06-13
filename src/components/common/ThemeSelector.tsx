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
    <Box
      sx={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 8px)',
        right: 'calc(env(safe-area-inset-right) + 8px)',
        zIndex: 20,
      }}
    >
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
              width: 48,
              height: 48,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid',
              borderColor: open ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.35),
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(6px)',
              fontSize: '1.6rem',
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
                    p: 1,
                    borderRadius: 3,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 0.75,
                    backgroundColor: 'rgba(255, 255, 255, 0.96)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {availableThemes.map((t) => {
                    const isActive = t.id === themeId
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
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        sx={{
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.25,
                          width: 60,
                          minHeight: 60,
                          py: 0.5,
                          borderRadius: 2,
                          border: '2px solid',
                          borderColor: isActive ? theme.palette.primary.main : 'transparent',
                          backgroundColor: isActive
                            ? alpha(theme.palette.primary.main, 0.12)
                            : 'transparent',
                          transition: 'border-color 0.15s ease, background-color 0.15s ease',
                        }}
                      >
                        {thumbs[t.id] ? (
                          <Box
                            component="img"
                            src={thumbs[t.id]}
                            alt=""
                            sx={{ width: 44, height: 30, objectFit: 'cover', borderRadius: 1 }}
                          />
                        ) : (
                          <Box component="span" sx={{ fontSize: '1.6rem', lineHeight: 1 }}>{t.emoji}</Box>
                        )}
                        <Box
                          component="span"
                          sx={{
                            fontSize: '0.6rem',
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
