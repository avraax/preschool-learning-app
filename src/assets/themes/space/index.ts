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
import bloom1 from './bloom-1.webp'
import bloom2 from './bloom-2.webp'
import bloom3 from './bloom-3.webp'
import comp1 from './companion-1.webp'
import comp2 from './companion-2.webp'
import comp3 from './companion-3.webp'
import comp4 from './companion-4.webp'
import ambient1 from './ambient-1.webp'
import ambient2 from './ambient-2.webp'

const spaceAssets: SceneAssets = {
  // Multi-layer parallax world (PRD-05 W2 / B3): far nebula → mid planets → near asteroids+rocket.
  layers: [sceneFar, sceneMid, sceneNear],
  ambientSprites: [ambient1, ambient2], // B7: soft twinkling star sprites (index-aligned to scene.ambient.sprites)
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6).
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
  // Bloom scenery (PRD-05 W7 / B5) — index-aligned to scene.bloomScenery: star cluster, comet, star.
  bloomScenery: [bloom1, bloom2, bloom3],
  // Companion growth (B6): baby star → ringed planet growing (4 stages, seed→full).
  companionStages: [comp1, comp2, comp3, comp4],
}

export default spaceAssets
