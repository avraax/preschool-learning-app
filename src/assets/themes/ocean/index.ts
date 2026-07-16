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
import bloom1 from './bloom-1.webp'
import bloom2 from './bloom-2.webp'
import bloom3 from './bloom-3.webp'
import comp1 from './companion-1.webp'
import comp2 from './companion-2.webp'
import comp3 from './companion-3.webp'
import comp4 from './companion-4.webp'
import comp5 from './companion-5.webp'

const oceanAssets: SceneAssets = {
  // Multi-layer parallax world (PRD-05 W2 / B3): far god-rays water → mid reef → near sandbar+coral.
  layers: [sceneFar, sceneMid, sceneNear],
  ambientSprites: [], // none → CSS bubbles
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6).
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
  // Bloom scenery (PRD-05 W7 / B5) — index-aligned to scene.bloomScenery: coral, seashell, starfish.
  bloomScenery: [bloom1, bloom2, bloom3],
  // Companion growth (B6): coral nub → coral → anemone → radiant anemone → pearl (seed→full).
  companionStages: [comp1, comp2, comp3, comp4, comp5],
}

export default oceanAssets
