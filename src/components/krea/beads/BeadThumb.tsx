import React from 'react'
import { CRAYON_HEX } from '../canvas/brushes'
import { BOARD_PLASTIC } from './Bead'
import { RIM } from './Pegboard'
import type { BeadBoard, BeadColor } from './beadBoard'

// A picker card's bead picture as ONE cached image (owner 2026-11-04: 78 Perleplade cards). Drawn the
// live way — a `<Bead>` div with three radial gradients per bead plus an SVG peg board — the picker came
// to ~35 000 elements and stalled 200–600 ms per scroll frame (measured, rung 1). The board itself still
// renders live; only the thumbnails are flattened. Cached by content, so an unchanged card never redraws.

const PX = 192
const cache = new Map<string, string>()

export interface ThumbLayer {
  board: BeadBoard
  /** Bead diameter as a fraction of the pitch. */
  size: number
  alpha?: number
}

function draw(mask: readonly boolean[] | null, n: number, layers: ThumbLayer[]): string {
  const cv = document.createElement('canvas')
  cv.width = PX
  cv.height = PX
  const g = cv.getContext('2d')
  if (!g) return ''
  const pitch = PX / (n + RIM)
  const o = (RIM / 2) * pitch
  if (mask) {
    // The board: a cream cell per peg (joined), small pegs on it.
    g.fillStyle = BOARD_PLASTIC
    mask.forEach((on, i) => {
      if (!on) return
      g.fillRect(o + (i % n) * pitch - pitch * 0.22, o + Math.floor(i / n) * pitch - pitch * 0.22, pitch * 1.44, pitch * 1.44)
    })
    g.fillStyle = '#D9CDB6'
    mask.forEach((on, i) => {
      if (!on) return
      g.beginPath()
      g.arc(o + ((i % n) + 0.5) * pitch, o + (Math.floor(i / n) + 0.5) * pitch, pitch * 0.15, 0, Math.PI * 2)
      g.fill()
    })
  }
  for (const { board, size, alpha = 1 } of layers) {
    g.globalAlpha = alpha
    const r = (pitch * size) / 2
    board.beads.forEach((c, i) => {
      if (!c) return
      const cx = o + ((i % n) + 0.5) * pitch
      const cy = o + (Math.floor(i / n) + 0.5) * pitch
      g.fillStyle = CRAYON_HEX[c as BeadColor]
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.fill()
      if (c === 'hvid') {
        g.strokeStyle = '#C9BEAB'
        g.lineWidth = Math.max(1, r * 0.18)
        g.stroke()
      }
      // The bead's hole, as on the real thing.
      g.fillStyle = 'rgba(0,0,0,0.22)'
      g.beginPath()
      g.arc(cx, cy, r * 0.32, 0, Math.PI * 2)
      g.fill()
    })
  }
  g.globalAlpha = 1
  return cv.toDataURL('image/png')
}

const keyOf = (mask: readonly boolean[] | null, n: number, layers: ThumbLayer[]): string =>
  `${n}|${mask ? mask.map((m) => (m ? 1 : 0)).join('') : '-'}|${layers.map((l) => `${l.size}:${l.alpha ?? 1}:${l.board.beads.map((b) => b ?? '.').join(',')}`).join('|')}`

/** One picture of a board (pegs when `mask` is given) with bead layers drawn over it, in order. */
export const BeadThumb: React.FC<{ n: number; mask?: readonly boolean[] | null; layers: ThumbLayer[] }> = ({ n, mask = null, layers }) => {
  const key = keyOf(mask, n, layers)
  let src = cache.get(key)
  if (src === undefined) {
    src = typeof document === 'undefined' ? '' : draw(mask, n, layers)
    cache.set(key, src)
  }
  return src ? <img src={src} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} /> : null
}
