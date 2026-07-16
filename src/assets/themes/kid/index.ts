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
}

export default kidAssets
