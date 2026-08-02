// "Udseende" — the skin picker (absorbs the old "Tema" panel).
//
// Its own pane even though it holds ONE control (Settings PRD-01 §2): the thumbnail grid needs the
// room, and it is a whim-change setting an adult comes back to. The skin is PER CHILD — `themeId`
// lives in `progressStore.settings`, which is per-profile, and the UI now says so.
//
// The picker shows each skin's baked `selectorThumb`, never a glyph — `themes.test.ts` enforces that a
// skin can only be REGISTERED once its world art exists.

import React, { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../../theme/ThemeProvider'
import { loadSceneAssets } from '../../../theme/sceneAssets'
import { PaneSection } from './paneParts'

export interface UdseendePaneProps {
  childName?: string
}

const UdseendePane: React.FC<UdseendePaneProps> = ({ childName }) => {
  const theme = useTheme()
  const { themeId, setThemeId, availableThemes } = useThemeSwitch()
  // Lazily collect each world's thumbnail (tiny URL strings; bytes load only when the <img> renders).
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

  return (
    <PaneSection
      title={childName ? `Tema for ${childName}` : 'Tema'}
      caps={!childName}
      hint="Vælg appens verden. Ændringen sker med det samme."
    >
      <Box
        role="group"
        aria-label="Vælg tema"
        sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 1 }}
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
              whileTap={{ scale: 0.94 }}
              sx={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.75,
                py: 1.25,
                px: 0.5,
                minHeight: 44,
                border: 'none',
                borderRadius: 2,
                backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            >
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
                }}
              >
                {thumbs[t.id] && (
                  <Box
                    component="img"
                    src={thumbs[t.id]}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
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
    </PaneSection>
  )
}

export default UdseendePane
