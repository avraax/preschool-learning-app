// Per-theme world-asset loader (Theme Worlds PRD §5.2).
//
// Art lives under `src/assets/themes/<id>/` and is dynamic-imported per theme so Vite
// code-splits it — the browser fetches ONLY the active theme's art, never all six. The
// loaded `SceneAssets` carries ready-to-render URLs that pair (by index) with the non-asset
// config in `SceneTokens` (depth/anchor/opacity/motion/lines). Components merge the two.
//
// Phase status: P0 ships the skeleton with no registered themes (every load resolves to
// `null`, so scenes render nothing — today's flat look). P1+ adds one entry per world.

// Resolved, ready-to-render asset URLs for one theme's world.
export interface SceneAssets {
  layers: string[]          // back→front, aligns index-for-index with SceneTokens.layers
  ambientSprites: string[]  // aligns with SceneTokens.ambient.sprites
  mascot: string
  selectorThumb: string
}

// Each loader dynamic-imports ONLY that theme's asset module (which re-exports the hashed
// URLs Vite produces from the optimized art). Registered per theme in later phases, e.g.:
//   ocean: () => import('../assets/themes/ocean'),
const loaders: Record<string, () => Promise<{ default: SceneAssets }>> = {
  kid: () => import('../assets/themes/kid'),
  ocean: () => import('../assets/themes/ocean'),
  space: () => import('../assets/themes/space'),
  dino: () => import('../assets/themes/dino'),
}

// Resolve a theme's world assets, or `null` if the theme has none yet (→ flat look).
// Never throws: a failed import degrades gracefully to `null`.
export async function loadSceneAssets(id: string): Promise<SceneAssets | null> {
  const loader = loaders[id]
  if (!loader) return null
  try {
    const mod = await loader()
    return mod.default
  } catch {
    return null
  }
}

// Whether a theme has registered world assets (without fetching them) — handy for the
// selector/preload logic to decide if there's a world to load.
export const hasSceneAssets = (id: string): boolean => id in loaders
