// Havet (ocean) world assets. Vite resolves each import to a hashed URL string and emits the
// WebP as a separate file; the bytes are only fetched when an <img>/CSS-url actually renders
// it. Dynamic-imported by `loadSceneAssets('ocean')`, so it's code-split.
//
// Structure (revised P1): ONE immersive full-bleed backdrop + a transparent mascot cutout.
// Bubbles are drawn in CSS (no sprite art). `scene.webp` is the rich underwater backdrop;
// until that art lands it falls back to the clean `far.webp` water so the build stays green.
import type { SceneAssets } from '../../../theme/sceneAssets'
import scene from './scene.webp'
import mascot from './mascot.webp'
import thumb from './thumb.webp'

const oceanAssets: SceneAssets = {
  layers: [scene], // back→front; single immersive backdrop
  ambientSprites: [], // none → CSS bubbles
  mascot,
  selectorThumb: thumb,
}

export default oceanAssets
