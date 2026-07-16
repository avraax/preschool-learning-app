// Havet (ocean) world assets. Vite resolves each import to a hashed URL string and emits the
// WebP as a separate file; the bytes are only fetched when an <img>/CSS-url actually renders
// it. Dynamic-imported by `loadSceneAssets('ocean')`, so it's code-split.
//
// Structure (PRD-05 W2): a 3-layer parallax world (far god-rays water → mid reef → near
// sandbar+coral) + a transparent mascot cutout. Bubbles are drawn in CSS (no sprite art).
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

const oceanAssets: SceneAssets = {
  // Multi-layer parallax world (PRD-05 W2 / B3): far god-rays water → mid reef → near sandbar+coral.
  layers: [sceneFar, sceneMid, sceneNear],
  ambientSprites: [], // none → CSS bubbles
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6).
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
}

export default oceanAssets
