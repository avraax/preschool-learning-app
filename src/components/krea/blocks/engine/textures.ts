// Byggeklodser's textures (Krea PRD-03 §4.7).
//
// - The CLAY grain is a SEEDED procedural normal map: the same seed always draws the same surface, so undo,
//   resume and a context-loss rebuild look identical. Subtle by design (owner: "subtle clay").
// - The window, door and wheel-hub faces are CODE-DRAWN STAND-INS until the owner's flat-lit Gemini faces
//   land (art prompts, batch D). They are flat-lit too: the 3D lights them, so nothing here bakes a shadow.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { rng } from '../../canvas/brushes.ts'

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

const colorTex = (c: HTMLCanvasElement): Texture => {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Stand-in window face: blue glass in a white frame with a cross bar. */
export function windowFace(): Texture {
  const [c, g] = canvas(128, 128)
  g.fillStyle = '#F6F2EA'
  g.fillRect(0, 0, 128, 128)
  const glass = g.createLinearGradient(0, 14, 0, 114)
  glass.addColorStop(0, '#8FD0F2')
  glass.addColorStop(1, '#4E9FD6')
  g.fillStyle = glass
  g.beginPath()
  g.roundRect(16, 16, 96, 96, 10)
  g.fill()
  g.fillStyle = '#F6F2EA'
  g.fillRect(60, 16, 8, 96)
  g.fillRect(16, 60, 96, 8)
  return colorTex(c)
}

/** Stand-in door face: brown planks, a darker frame and a knob. */
export function doorFace(): Texture {
  const [c, g] = canvas(128, 128)
  g.fillStyle = '#6B3F1C'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#9A5E2E'
  g.beginPath()
  g.roundRect(14, 10, 100, 118, [14, 14, 0, 0])
  g.fill()
  g.strokeStyle = 'rgba(80, 45, 18, 0.55)'
  g.lineWidth = 3
  for (const x of [39, 64, 89]) {
    g.beginPath()
    g.moveTo(x, 14)
    g.lineTo(x, 128)
    g.stroke()
  }
  g.fillStyle = '#E8C060'
  g.beginPath()
  g.arc(96, 72, 6, 0, Math.PI * 2)
  g.fill()
  return colorTex(c)
}
