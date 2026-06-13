// Rummet (space) world assets. Dynamic-imported by loadSceneAssets('space') → code-split.
// Single immersive DARK backdrop + a transparent astronaut mascot; stars are CSS (no art).
import type { SceneAssets } from '../../../theme/sceneAssets'
import scene from './scene.webp'
import mascot from './mascot.webp'
import thumb from './thumb.webp'

const spaceAssets: SceneAssets = {
  layers: [scene],
  ambientSprites: [], // none → CSS twinkling stars
  mascot,
  selectorThumb: thumb,
}

export default spaceAssets
