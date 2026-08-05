// "Udseende" — the skin picker (absorbs the old "Tema" panel).
//
// Its own pane even though it holds ONE control (Settings PRD-01 §2): the thumbnail grid needs the
// room, and it is a whim-change setting an adult comes back to. The skin is PER CHILD — `themeId`
// lives in `progressStore.settings`, which is per-profile, and the UI now says so.
//
// The picker shows each skin's baked `selectorThumb`, never a glyph — `themes.test.ts` enforces that a
// skin can only be REGISTERED once its world art exists.

import React, { useEffect, useState } from 'react'
import { Box, Stack } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { motion } from 'framer-motion'
import { useThemeSwitch } from '../../../theme/ThemeProvider'
import { loadSceneAssets } from '../../../theme/sceneAssets'
import { PaneSection, ToggleRow } from './paneParts'
import { useProgress } from '../../../hooks/useProgress'
import { SMOOTH_GRAPHICS_HINT, SMOOTH_GRAPHICS_LABEL } from '../../../config/perfProfile'
import { Sparkles } from 'lucide-react'

export interface UdseendePaneProps {
  childName?: string
}

const UdseendePane: React.FC<UdseendePaneProps> = ({ childName }) => {
  const theme = useTheme()
  const { themeId, setThemeId, availableThemes } = useThemeSwitch()
  const progress = useProgress()
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
    <Stack spacing={2.5}>
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

    {/* "Flydende grafik" (Performance PRD-01 W6) — the PERMANENT escape hatch for the rendering
        profile. ON is the fast path, so it reads as a feature to turn OFF rather than a workaround to
        enable; `perfProfileGuard` pins that default. It exists because you cannot type a query
        parameter into a standalone PWA, so this switch is the only way to A/B the two rendering paths
        ON the child's iPad — and the only way to back out of a regression without a deploy. It changes
        RENDERING ONLY: never XP, difficulty, narration or any game logic.

        The item also lives in `src/config/adultSettingsIa.ts`, because the group/item structure is DATA
        and is guarded — adding it here alone would fail that guard. */}
    <PaneSection title="Ydelse">
      <ToggleRow
        icon={<Sparkles size={19} />}
        label={SMOOTH_GRAPHICS_LABEL}
        hint={SMOOTH_GRAPHICS_HINT}
        // Absence means the fast path, so `!== false` — not a bare truthiness check, which would show
        // the switch OFF for every child who has never touched it.
        checked={progress.state.settings.smoothGraphics !== false}
        onChange={(v) => progress.setSetting('smoothGraphics', v)}
      />
    </PaneSection>
    </Stack>
  )
}

export default UdseendePane
