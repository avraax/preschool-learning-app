import React, { useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useThemeSwitch } from '../../../theme/ThemeProvider'
import { loadSceneAssets, type SceneAssets } from '../../../theme/sceneAssets'
import { useReducedMotion } from '../../../hooks/useReducedMotion'
import { motion } from 'framer-motion'
import type { SceneSectionId } from '../../../theme/tokens/types'
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

interface ThemeSceneProps {
  // Freeze ambient animations (PRD-08 §P4) — set on game routes, where the scene is blurred anyway.
  paused?: boolean
  // Extra drifting ambient objects from the current section's bloom (Liveliness PRD-02 §9).
  bloomExtra?: number
  // Structured World (PRD-05 W7): the current bloom STAGE (0–4) and active section (or null for
  // home / all-sections). Discrete `scene.bloomScenery` sprites appear once the stage reaches their
  // `minStage` — recognizable, earned scenery on top of the ambient-count bloom. Absent → none show.
  bloomStage?: number
  bloomSection?: SceneSectionId | null
}

const ThemeScene: React.FC<ThemeSceneProps> = ({
  paused = false,
  bloomExtra = 0,
  bloomStage = 0,
  bloomSection = null,
}) => {
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
        // Dark worlds paint their base colour IMMEDIATELY (before the art loads) so a dark
        // theme is dark from the first frame — no flash of the light default/rainbow on reload.
        backgroundColor: scene.dark ? '#070B1A' : 'transparent',
      }}
    >
      {/* Only the art fades in; the base colour above is instant. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: assets ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        {assets && (
          <>
            {scene.layers.map((layer, i) =>
              assets.layers[i] ? <ParallaxLayer key={i} spec={layer} url={assets.layers[i]} index={i} /> : null
            )}
            <AmbientField scene={scene} sprites={assets.ambientSprites} themeId={themeId} disabled={reduce} paused={paused} bloomExtra={bloomExtra} />

            {/* Earned bloom scenery (PRD-05 W7): discrete stage-gated sprites that pop in as the
                child's bloom rises. Each token entry pairs by index with a loaded URL in
                assets.bloomScenery (filled by batch B5); an entry with no URL yet renders nothing,
                so this is a no-op until the art lands. Rides the shared parallax vars via `depth`. */}
            {(scene.bloomScenery ?? []).map((sp, i) => {
              const url = sp.src || assets.bloomScenery?.[i]
              if (!url) return null
              if (sp.minStage > bloomStage) return null
              if (sp.section && sp.section !== bloomSection) return null
              return (
                <Box
                  key={`bloom-${i}`}
                  aria-hidden
                  component={motion.img}
                  src={url}
                  alt=""
                  draggable={false}
                  initial={reduce ? false : { opacity: 0, scale: 0.6, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18 }}
                  style={{
                    position: 'absolute',
                    left: `${sp.xPct}%`,
                    top: `${sp.yPct}%`,
                    width: `${Math.round(64 * sp.scale)}px`,
                    height: 'auto',
                    zIndex: 40, // above the parallax layers, below the readability scrim (50)
                    transform: `translate(-50%, -50%) translate3d(calc(var(--parallax-x, 0px) * ${sp.depth}), calc(var(--parallax-y, 0px) * ${sp.depth}), 0)`,
                    filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.28))',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              )
            })}

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
    </Box>
  )
}

export default ThemeScene
