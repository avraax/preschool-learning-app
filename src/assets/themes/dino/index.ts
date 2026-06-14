// Dinosaurer (dino) world assets. Dynamic-imported by loadSceneAssets('dino') → code-split.
// Single warm prehistoric backdrop + a transparent baby-dino mascot; leaves are CSS (no art).
import type { SceneAssets } from '../../../theme/sceneAssets'
import scene from './scene.webp'
import mascot from './mascot.webp'
import thumb from './thumb.webp'

const dinoAssets: SceneAssets = {
  layers: [scene],
  ambientSprites: [], // none → CSS falling leaves
  mascot,
  selectorThumb: thumb,
}

export default dinoAssets
