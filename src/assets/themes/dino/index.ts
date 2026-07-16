// Dinosaurer (dino) world assets. Dynamic-imported by loadSceneAssets('dino') → code-split.
// Single warm prehistoric backdrop + a transparent baby-dino mascot; leaves are CSS (no art).
import type { SceneAssets } from '../../../theme/sceneAssets'
import sceneFar from './scene-far.webp'
import sceneMid from './scene-mid.webp'
import sceneNear from './scene-near.webp'
import mascot from './mascot.webp'
import thumb from './thumb.webp'
import mascotIdle from './mascot-idle.webp'
import mascotGreet from './mascot-greet.webp'
import mascotPoint from './mascot-point.webp'
import mascotCelebrate from './mascot-celebrate.webp'

const dinoAssets: SceneAssets = {
  // Multi-layer parallax world (PRD-05 W2 / B3): far volcano/sunrise → mid jungle → near mossy ridge.
  layers: [sceneFar, sceneMid, sceneNear],
  ambientSprites: [], // none → CSS falling leaves
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6).
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
}

export default dinoAssets
