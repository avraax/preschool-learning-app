// Dinosaurer (dino) world assets. Dynamic-imported by loadSceneAssets('dino') → code-split.
// Single warm prehistoric backdrop + a transparent baby-dino mascot; leaves are CSS (no art).
import type { SceneAssets } from '../../../theme/sceneAssets'
import sceneFar from './scene-far.webp'
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
import ambient1 from './ambient-1.webp'
import ambient2 from './ambient-2.webp'

const dinoAssets: SceneAssets = {
  // Two-layer parallax world (PRD-05 W2 / B3): far (volcano + distant green mountains) → near (mossy
  // ridge / foreground jungle). The mid "jungle tree-line" render (#12) is a thin horizontal foliage
  // strip and the far already carries mountains in that zone, so any placement read as a floating
  // band (owner call, 2026-07-16: drop it). The far mountains serve as the mid-ground.
  layers: [sceneFar, sceneNear],
  ambientSprites: [ambient1, ambient2], // B7: falling leaf + fern frond (index-aligned to scene.ambient.sprites)
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6).
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
  // Bloom scenery (PRD-05 W7 / B5) — index-aligned to scene.bloomScenery: fern sprout, egg, mushroom.
  bloomScenery: [bloom1, bloom2, bloom3],
  // Companion growth (B6): egg → cracking egg → hatchling → young dino → grown dino (seed→full).
  companionStages: [comp1, comp2, comp3, comp4, comp5],
}

export default dinoAssets
