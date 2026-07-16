// Rummet (space) world assets. Dynamic-imported by loadSceneAssets('space') → code-split.
// Single immersive DARK backdrop + a transparent astronaut mascot; stars are CSS (no art).
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

const spaceAssets: SceneAssets = {
  // Multi-layer parallax world (PRD-05 W2 / B3): far nebula → mid planets → near asteroids+rocket.
  layers: [sceneFar, sceneMid, sceneNear],
  ambientSprites: [], // none → CSS twinkling stars
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6).
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
}

export default spaceAssets
