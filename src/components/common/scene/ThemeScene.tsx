import React, { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useThemeSwitch } from '../../../theme/ThemeProvider'
import { loadSceneAssets, type SceneAssets } from '../../../theme/sceneAssets'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import ParallaxLayer from './ParallaxLayer'
import AmbientField from './AmbientField'

// The immersive world layer (Theme Worlds PRD §5.3). Sits behind page content, full-bleed,
// non-interactive (the mascot is rendered separately so it CAN be tapped). Lazy-loads the
// active theme's art (code-split) and fades it in; renders nothing for themes with no world
// (today's flat look).
//
// Parallax is driven by the HOST page (it calls useParallax on its root, setting the
// --parallax-x/y CSS vars); the layers here read those inherited vars and offset by depth, so
// the scene and the separately-rendered mascot share one synced driver across planes.

const ThemeScene: React.FC = () => {
  const theme = useTheme()
  const { themeId } = useThemeSwitch()
  const reduce = useReducedMotion()
  const scene = theme.scene
  // Tag the load with its themeId so a stale result (from the previous theme) is ignored
  // without a synchronous setState reset in the effect.
  const [loaded, setLoaded] = useState<{ id: string; assets: SceneAssets | null } | null>(null)

  useEffect(() => {
    let alive = true
    loadSceneAssets(themeId).then((a) => {
      if (alive) setLoaded({ id: themeId, assets: a })
    })
    return () => {
      alive = false
    }
  }, [themeId])

  const assets = loaded && loaded.id === themeId ? loaded.assets : null

  // No authored world for this theme → flat look (existing decor shows through).
  if (!scene.layers.length) return null

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        pointerEvents: 'none',
        backgroundColor: scene.dark ? '#070B1A' : 'transparent',
        opacity: assets ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}
    >
      {assets && (
        <>
          {scene.layers.map((layer, i) =>
            assets.layers[i] ? <ParallaxLayer key={i} spec={layer} url={assets.layers[i]} index={i} /> : null
          )}
          <AmbientField scene={scene} sprites={assets.ambientSprites} themeId={themeId} disabled={reduce} />
          {/* Gentle scrim: lifts depth and keeps content cards readable over the scene. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 50,
              pointerEvents: 'none',
              background:
                'radial-gradient(ellipse at 50% 38%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 45%), linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.12) 100%)',
            }}
          />
        </>
      )}
    </Box>
  )
}

export default ThemeScene
