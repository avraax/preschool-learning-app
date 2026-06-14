import React, { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useThemeSwitch } from '../../theme/ThemeProvider'
import { loadSceneAssets, type SceneAssets } from '../../theme/sceneAssets'
import { getCategoryTheme } from '../../config/categoryThemes'
import { hexToRgba } from '../../theme/tokens/helpers'

// P4 calm in-game backdrop (App-wide UI Uplift). Brings the active world INTO the game/learning
// screens so the experience stays in-theme after leaving the menu — but as quiet ATMOSPHERE,
// not a scene: the world image is dimmed + blurred + scrimmed and held STATIC (no parallax, no
// ambient objects, no mascot) so nothing competes with the answers. The section's colour lives
// in the accents (title / card borders / score chip / repeat button); the world lives softly
// behind, and a faint themed corner glow keeps a touch of section identity.
//
// Layering: sits at z-index:-1 inside a position:relative root, so its OPAQUE world-mood base
// composites above the root's own (bright category-gradient) background and behind all in-flow
// content. Host screens only add `position: relative` + this one child — no content z-index
// changes, and the category gradient still paints instantly underneath to avoid any flash.
//
// Themes with an authored world → dimmed scene. Flat skins with a `materials.motif` → a light
// CSS accent. Neither → nothing (today's plain look).

interface GameMotifProps {
  categoryId: string
}

const GameMotif: React.FC<GameMotifProps> = ({ categoryId }) => {
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const scene = theme.scene
  const immersive = scene.layers.length > 0
  const dark = scene.dark
  const accent = getCategoryTheme(categoryId).accentColor

  // Tag the load with its themeId so a stale result (previous theme) is ignored on switch.
  const [loaded, setLoaded] = useState<{ id: string; assets: SceneAssets | null } | null>(null)
  useEffect(() => {
    if (!immersive) return
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (alive) setLoaded({ id: themeId, assets: a })
    })
    return () => {
      alive = false
    }
  }, [themeId, immersive])

  // Flat skin (no authored world): the original light CSS accent, or nothing.
  if (!immersive) {
    if (!theme.materials.motif) return null
    return (
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background: [
            'radial-gradient(120% 70% at 50% -10%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
            `radial-gradient(90% 70% at 100% 100%, ${hexToRgba(accent, 0.16)} 0%, ${hexToRgba(accent, 0)} 55%)`,
            'radial-gradient(80% 60% at 0% 100%, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 60%)',
          ].join(', '),
        }}
      />
    )
  }

  const sceneUrl = loaded && loaded.id === themeId && loaded.assets ? loaded.assets.layers[0] : ''

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        // World-mood base blocks the bright category gradient even before the image loads.
        backgroundColor: dark ? '#070B1A' : '#E7F0F6',
      }}
    >
      {/* Dimmed, blurred world image — static atmosphere (no parallax, no ambient, no mascot). */}
      {sceneUrl && (
        <Box
          component="img"
          src={sceneUrl}
          alt=""
          draggable={false}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scale(1.1)', // hide the blur's soft edges
            filter: 'blur(6px)',
            opacity: dark ? 0.8 : 0.65,
            transition: 'opacity 0.6s ease',
          }}
        />
      )}
      {/* Scrim: mutes the scene and lifts contrast where the answer cards sit (centre-weighted),
          plus a faint themed corner glow for a touch of section identity. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: [
            `radial-gradient(110% 85% at 50% 48%, ${
              dark ? 'rgba(7,11,26,0.55)' : 'rgba(255,255,255,0.52)'
            } 0%, ${dark ? 'rgba(7,11,26,0.18)' : 'rgba(255,255,255,0.16)'} 58%, ${
              dark ? 'rgba(7,11,26,0.34)' : 'rgba(255,255,255,0.28)'
            } 100%)`,
            `radial-gradient(80% 60% at 100% 100%, ${hexToRgba(accent, dark ? 0.24 : 0.16)} 0%, ${hexToRgba(accent, 0)} 55%)`,
          ].join(', '),
        }}
      />
    </Box>
  )
}

export default GameMotif
