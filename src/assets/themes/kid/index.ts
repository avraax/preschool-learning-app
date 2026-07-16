// Regnbue (kid / default) world assets. Dynamic-imported by loadSceneAssets('kid') → code-split.
// Soft sky + rainbow backdrop + a friendly teddy-bear mascot; sparkles are CSS (no art).
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
import ambient2 from './ambient-2.webp'

const kidAssets: SceneAssets = {
  // Multi-layer parallax world (PRD-05 W2 / batch B3): far rainbow sky → mid clouds → near cloud
  // bank. Index-aligned to scene.layers (depth/anchor) in kidTheme.tokens.ts.
  layers: [sceneFar, sceneMid, sceneNear],
  ambientSprites: [ambient2], // B7: soft cloud puffs drifting (a daytime rainbow sky reads better with clouds than stars)
  mascot,
  selectorThumb: thumb,
  // Reactive-guide poses (Liveliness PRD-05 W6): idle/greet/point/celebrate soft-3D renders.
  mascotPoses: { idle: mascotIdle, greet: mascotGreet, point: mascotPoint, celebrate: mascotCelebrate },
  // Bloom scenery (PRD-05 W7 / B5) — index-aligned to scene.bloomScenery: flower, sparkle-star, cloud.
  bloomScenery: [bloom1, bloom2, bloom3],
  // Companion growth (B6): sprout → plant → budding → flowering → rainbow-bloom (seed→full).
  companionStages: [comp1, comp2, comp3, comp4, comp5],
}

export default kidAssets
