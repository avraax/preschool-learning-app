// Regnbue (kid / default) world assets. Dynamic-imported by loadSceneAssets('kid') → code-split.
// Soft sky + rainbow backdrop + a friendly teddy-bear mascot; sparkles are CSS (no art).
import type { SceneAssets } from '../../../theme/sceneAssets'
import scene from './scene.webp'
import mascot from './mascot.webp'
import thumb from './thumb.webp'

const kidAssets: SceneAssets = {
  layers: [scene],
  ambientSprites: [], // none → CSS drifting sparkles
  mascot,
  selectorThumb: thumb,
}

export default kidAssets
