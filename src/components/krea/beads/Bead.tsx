import React from 'react'
import { CRAYON_HEX } from '../canvas/brushes'
import type { BeadColor } from './beadBoard'

// A Hama bead seen from above, DRAWN IN CODE (Krea PRD-02 §2.1): a glossy plastic ring with the
// board showing through its hole, so any colour at any size is exact. Pure CSS gradients on one static
// element — no per-bead animation, no `will-change` (§4.3): a Svær board can hold 169 of them.

/** The board's plastic, also what shows through a bead's hole. */
export const BOARD_PLASTIC = '#F3EEE4'

const shade = (hex: string, k: number): string => {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, '0')
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`
}

/** The bead's background — one string per colour, cached. White gets a stronger rim so it reads on cream. */
const cache = new Map<BeadColor, string>()
export function beadBackground(c: BeadColor): string {
  const hit = cache.get(c)
  if (hit) return hit
  const hex = CRAYON_HEX[c]
  const rim = shade(hex, c === 'hvid' ? 0.2 : 0.3)
  const bg = [
    `radial-gradient(circle at 50% 50%, ${BOARD_PLASTIC} 0 15%, rgba(0,0,0,0.32) 16.5% 20%, transparent 21.5%)`,
    'radial-gradient(circle at 33% 29%, rgba(255,255,255,0.85) 0 6%, rgba(255,255,255,0) 21%)',
    `radial-gradient(circle at 50% 50%, ${hex} 0 50%, ${rim} 72%, ${shade(hex, c === 'hvid' ? 0.28 : 0.42)} 100%)`,
  ].join(', ')
  cache.set(c, bg)
  return bg
}

export const Bead: React.FC<{ colour: BeadColor; style?: React.CSSProperties; peg?: number }> = ({ colour, style, peg }) => (
  <div
    data-bead={colour}
    data-peg={peg}
    style={{
      borderRadius: '50%',
      background: beadBackground(colour),
      boxShadow: '0 1px 2px rgba(60,40,20,0.35)',
      pointerEvents: 'none',
      ...style,
    }}
  />
)
