import React from 'react'
import { BEAD_ART } from '../../../assets/games/krea/beads'
import { Bead } from './Bead'
import type { BeadColor } from './beadBoard'

// The tweezers (Krea PRD-02 §4.2). Held tools lie on the right with the tip pointing DOWN-LEFT (house
// art rule) — the render already does. Where the tips meet, as a fraction of the sprite box, measured
// on the keyed 256² WebP: that is where the bead sits.
const TIP = { x: 0.2, y: 0.78 }

/**
 * A tapped bowl: the tweezers stand in it holding one bead, so the child sees the bead is "in hand"
 * right where they tapped — a separate tweezers object in the side column read as a mystery control
 * (owner, 2026-10-16). Tapping the bowl again puts the bead back. Pure decoration: no pointer events.
 */
export const BowlTweezers: React.FC<{ colour: BeadColor }> = ({ colour }) => {
  const w = 0.72
  // The bead lifted just above the heap; the tweezers' tips on it.
  const bead = { x: 0.5, y: 0.08 }
  return (
    <div data-krea-bowl-tweezers={colour} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      <img
        src={BEAD_ART.tweezers}
        alt=""
        draggable={false}
        style={{ position: 'absolute', width: `${w * 100}%`, height: `${w * 100}%`, left: `${(bead.x - TIP.x * w) * 100}%`, top: `${(bead.y - TIP.y * w) * 100}%`, filter: 'drop-shadow(0 4px 4px rgba(70,40,15,0.3))' }}
      />
      <Bead colour={colour} style={{ position: 'absolute', width: '34%', height: '34%', left: `${(bead.x - 0.17) * 100}%`, top: `${(bead.y - 0.17) * 100}%`, boxShadow: '0 4px 5px rgba(60,40,20,0.35)' }} />
    </div>
  )
}

/**
 * The bead in the finger while dragging: the bead with the tweezers' tips on it, floating about one
 * pitch ABOVE the finger so the finger never hides the peg it lands on (§4.2). Positioned imperatively
 * by the game on every pointermove (`translate`), so a drag re-renders nothing.
 */
export const DragGhost: React.FC<{ ghostRef: React.Ref<HTMLDivElement>; colour: BeadColor | null; beadPx: number }> = ({ ghostRef, colour, beadPx }) => {
  const tw = beadPx * 2.6
  return (
    <div
      ref={ghostRef}
      data-krea-ghost={colour ?? ''}
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        zIndex: 30,
        pointerEvents: 'none',
        display: colour ? 'block' : 'none',
        transition: 'none',
      }}
    >
      {colour ? (
        <>
          <Bead colour={colour} style={{ position: 'absolute', width: beadPx, height: beadPx, left: -beadPx / 2, top: -beadPx / 2, boxShadow: '0 6px 8px rgba(60,40,20,0.35)' }} />
          <img
            src={BEAD_ART.tweezers}
            alt=""
            draggable={false}
            style={{ position: 'absolute', width: tw, height: tw, left: -TIP.x * tw, top: -TIP.y * tw, pointerEvents: 'none', filter: 'drop-shadow(0 6px 6px rgba(70,40,15,0.3))' }}
          />
        </>
      ) : null}
    </div>
  )
}
