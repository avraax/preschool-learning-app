// Byggeklodser's MATERIAL boxes (owner 2026-11-07: "a few material boxes as well, e.g. wood boxes") —
// træ, mursten, sten, glas, metal (owner: "hvad med metal også") — PAINTED IN CODE on a small canvas, SEEDED so every redraw (undo, resume, a
// context-loss rebuild) paints the same surface. No three.js here: the tray chips use the same painting
// as a picture (`materialChipUrl`), the scene wraps it as a texture (`engine/textures.ts`).
//
// The look stays in the clay style: soft colours, rounded joints, no photo detail. If the owner wants
// more, each painter is the one place a Gemini render would replace.

import { rng } from '../canvas/brushes.ts'
import type { MaterialKind } from './blockWorld.ts'

const SIZE = 128

/** The material's main colour: the ghost's tint and the chip's fallback before the canvas paints. */
export const MATERIAL_BASE: Record<MaterialKind, string> = {
  wood: '#C68B52',
  brick: '#B9583F',
  stone: '#A3A29B',
  glass: '#BFE6F5',
  metal: '#AEB6BF',
}

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** A shade of `hex` by `k` (−1 darker … +1 lighter). */
const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

const PAINTERS: Record<MaterialKind, (g: CanvasRenderingContext2D, r: () => number) => void> = {
  // Four planks, a darker seam between them, a few soft grain streaks per plank.
  wood: (g, r) => {
    const planks = 4, ph = SIZE / planks
    for (let i = 0; i < planks; i++) {
      g.fillStyle = shade(MATERIAL_BASE.wood, (r() - 0.5) * 0.16)
      g.fillRect(0, i * ph, SIZE, ph)
      g.strokeStyle = shade(MATERIAL_BASE.wood, -0.22)
      g.lineWidth = 1.4
      for (let s = 0; s < 3; s++) {
        const y0 = i * ph + 5 + r() * (ph - 10), amp = 1 + r() * 2, ph0 = r() * 6
        g.beginPath()
        for (let x = 0; x <= SIZE; x += 8) g.lineTo(x, y0 + Math.sin(x / 14 + ph0) * amp)
        g.stroke()
      }
      g.fillStyle = shade(MATERIAL_BASE.wood, -0.38)
      g.fillRect(0, i * ph, SIZE, 2.5)
    }
  },
  // Running bond: four rows of bricks on a light mortar.
  brick: (g, r) => {
    g.fillStyle = '#E8DFCF'
    g.fillRect(0, 0, SIZE, SIZE)
    const rows = 4, bh = SIZE / rows, bw = SIZE / 2, gap = 4
    for (let y = 0; y < rows; y++) {
      const off = y % 2 ? -bw / 2 : 0
      for (let x = off; x < SIZE; x += bw) {
        g.fillStyle = shade(MATERIAL_BASE.brick, (r() - 0.5) * 0.2)
        rr(g, x + gap / 2, y * bh + gap / 2, bw - gap, bh - gap, 4)
        g.fill()
      }
    }
  },
  // Irregular rounded cobbles in greys on a dark joint.
  stone: (g, r) => {
    g.fillStyle = shade(MATERIAL_BASE.stone, -0.35)
    g.fillRect(0, 0, SIZE, SIZE)
    const rows = 3, h = SIZE / rows
    for (let y = 0; y < rows; y++) {
      let x = -r() * 20
      while (x < SIZE) {
        const w = 30 + r() * 26
        g.fillStyle = shade(MATERIAL_BASE.stone, (r() - 0.5) * 0.24)
        rr(g, x + 3, y * h + 3, w - 6, h - 6, 12)
        g.fill()
        x += w
      }
    }
  },
  // Brushed steel: fine horizontal streaks, a soft sheen band, a rivet in each corner.
  metal: (g, r) => {
    g.fillStyle = MATERIAL_BASE.metal
    g.fillRect(0, 0, SIZE, SIZE)
    for (let y = 0; y < SIZE; y += 2) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '60,70,80'},${0.05 + r() * 0.08})`
      g.fillRect(0, y, SIZE, 1)
    }
    const sheen = g.createLinearGradient(0, 0, SIZE, SIZE)
    sheen.addColorStop(0.3, 'rgba(255,255,255,0)')
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.35)')
    sheen.addColorStop(0.7, 'rgba(255,255,255,0)')
    g.fillStyle = sheen
    g.fillRect(0, 0, SIZE, SIZE)
    g.strokeStyle = shade(MATERIAL_BASE.metal, -0.3)
    g.lineWidth = 3
    g.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3)
    for (const [x, y] of [[14, 14], [SIZE - 14, 14], [14, SIZE - 14], [SIZE - 14, SIZE - 14]]) {
      g.fillStyle = shade(MATERIAL_BASE.metal, -0.28)
      g.beginPath()
      g.arc(x, y, 5, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.7)'
      g.beginPath()
      g.arc(x - 1.5, y - 1.5, 2, 0, Math.PI * 2)
      g.fill()
    }
  },
  // Pale blue with a light frame and one soft diagonal glint. Drawn on a see-through material.
  glass: (g) => {
    g.fillStyle = MATERIAL_BASE.glass
    g.fillRect(0, 0, SIZE, SIZE)
    g.strokeStyle = 'rgba(255,255,255,0.95)'
    g.lineWidth = 8
    g.strokeRect(4, 4, SIZE - 8, SIZE - 8)
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.beginPath()
    g.moveTo(26, 98)
    g.lineTo(80, 24)
    g.lineTo(96, 24)
    g.lineTo(42, 98)
    g.closePath()
    g.fill()
  },
}

const SEED: Record<MaterialKind, number> = { wood: 1107, brick: 2207, stone: 3307, glass: 4407, metal: 5507 }

/** The material's surface on a fresh canvas — the same pixels every call. */
export function paintMaterial(kind: MaterialKind): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  PAINTERS[kind](c.getContext('2d')!, rng(SEED[kind]))
  return c
}

const chipUrls = new Map<MaterialKind, string>()
/** The chip's picture (painted once per page). */
export function materialChipUrl(kind: MaterialKind): string {
  let u = chipUrls.get(kind)
  if (!u) {
    u = paintMaterial(kind).toDataURL('image/png')
    chipUrls.set(kind, u)
  }
  return u
}
