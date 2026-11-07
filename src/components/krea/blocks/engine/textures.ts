// Byggeklodser's textures (Krea PRD-03 §4.7).
//
// - The CLAY grain is a SEEDED procedural normal map: the same seed always draws the same surface, so undo,
//   resume and a context-loss rebuild look identical. Subtle by design (owner: "subtle clay").
// - The window and door faces are the owner's flat-lit Gemini renders, cropped by
//   `scripts/optimize-block-art.mjs`. The material boxes are painted in code (`materialArt.ts`).

import { CanvasTexture, MirroredRepeatWrapping, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { rng } from '../../canvas/brushes.ts'
import { paintMaterial } from '../materialArt.ts'
import type { MaterialKind } from '../blockWorld.ts'

const canvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/** A faint, uneven clay surface as a normal map (seeded: identical every time). */
export function clayNormalMap(seed = 20261106, size = 128): Texture {
  const r = rng(seed)
  // Height field: a few soft blobs over gentle noise, then wrapped so it tiles.
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = r() * 0.25
  for (let b = 0; b < 26; b++) {
    const cx = r() * size, cy = r() * size, rad = 6 + r() * 18, amp = (r() - 0.5) * 1.4
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = Math.min(Math.abs(x - cx), size - Math.abs(x - cx))
      const dy = Math.min(Math.abs(y - cy), size - Math.abs(y - cy))
      const d = (dx * dx + dy * dy) / (rad * rad)
      if (d < 1) h[y * size + x] += amp * (1 - d) * (1 - d)
    }
  }
  const [c, g] = canvas(size, size)
  const img = g.createImageData(size, size)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (at(x - 1, y) - at(x + 1, y)) * 0.9
    const ny = (at(x, y - 1) - at(x, y + 1)) * 0.9
    const len = Math.hypot(nx, ny, 1)
    const o = (y * size + x) * 4
    img.data[o] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
    img.data[o + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
    img.data[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
    img.data[o + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

/** A material box's painted surface (`materialArt.ts`) as a colour texture — seeded, identical every time. */
export function materialTexture(kind: MaterialKind): Texture {
  const t = new CanvasTexture(paintMaterial(kind))
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Load one of the owner's flat renders (`src/assets/games/krea/blocks/`). Colour data, so sRGB; `repeat`
 * tiles it (the island's side band runs round the whole edge). `onLoad` asks the scene for a frame —
 * the scene renders on demand, so a texture that arrives later must say so.
 */
export function loadTexture(url: string, onLoad: () => void, repeat?: { x: number; y: number }): Texture {
  const t = new TextureLoader().load(url, onLoad)
  t.colorSpace = SRGBColorSpace
  if (repeat) {
    // MIRRORED: the renders aren't seamless, and a plain repeat drew a hard vertical seam every tile
    // round the island's edge (WebKit shots, sand worst). Mirroring meets every edge with itself.
    t.wrapS = t.wrapT = MirroredRepeatWrapping
    t.repeat.set(repeat.x, repeat.y)
  }
  return t
}
