// Regnbue (kid / default) world assets. Dynamic-imported by loadSceneAssets('kid') → code-split.
// Soft sky + rainbow backdrop + a friendly teddy-bear mascot; sparkles are CSS (no art).
import type { SceneAssets } from '../../../theme/sceneAssets'
import scene from './scene.webp'
import mascot from './mascot.webp'
import thumb from './thumb.webp'
import mascotIdle from './mascot-idle.webp'
import mascotGreet from './mascot-greet.webp'
import mascotPoint from './mascot-point.webp'
import mascotCelebrate from './mascot-celebrate.webp'

const kidAssets: SceneAssets = {
  layers: [scene],
  ambientSprites: [], // none → CSS drifting sparkles
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6): idle/greet/point/celebrate soft-3D renders.
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
  // Bloom scenery (PRD-05 W7) lands with batch B5: add `bloomScenery: [flower, star, cloud]` here
  // (index-aligned to scene.bloomScenery in kidTheme.tokens.ts) and the sprites appear as XP blooms.
  // Companion growth (batch B6): add `companionStages: [s1..s5]` (seed→full) and they replace the
  // emoji companion automatically (ProgressionCompanion prefers SceneAssets.companionStages).
}

export default kidAssets
