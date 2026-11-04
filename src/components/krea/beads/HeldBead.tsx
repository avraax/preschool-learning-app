import React from 'react'
import { Bead } from './Bead'
import { heldBeadPx, type BeadColor } from './beadBoard'

// The bead in hand (Krea PRD-02 §4.2) — picked up BY HAND, no tweezers: the owner wanted it to feel like
// picking a real bead up and pressing it onto the plate (2026-10-16; the tweezers were removed).

/**
 * A tapped bowl: one bead lifted just above its heap, so the child sees "this one is in my hand" right
 * where they tapped. Tapping the bowl again puts it back. Pure decoration: no pointer events.
 */
export const LiftedBead: React.FC<{ colour: BeadColor }> = ({ colour }) => (
  <Bead
    colour={colour}
    style={{ position: 'absolute', width: '34%', height: '34%', left: '33%', top: '-14%', zIndex: 2, boxShadow: '0 6px 7px rgba(60,40,20,0.35)' }}
  />
)

/**
 * The bead in the finger while dragging, peeking out just past the fingertip on touch (the game sets the
 * offset, `heldBeadLiftPx`); never smaller than `HELD_BEAD_MIN_PX`, so a phone bead isn't a speck.
 * Positioned imperatively on every pointermove (`translate`), so a drag re-renders nothing.
 */
export const DragGhost: React.FC<{ ghostRef: React.Ref<HTMLDivElement>; colour: BeadColor | null; beadPx: number }> = ({ ghostRef, colour, beadPx }) => {
  const d = heldBeadPx(beadPx)
  return (
  <div
    ref={ghostRef}
    data-krea-ghost={colour ?? ''}
    aria-hidden
    style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, zIndex: 30, pointerEvents: 'none', display: colour ? 'block' : 'none', transition: 'none' }}
  >
    {colour ? (
      <Bead
        colour={colour}
        style={{ position: 'absolute', width: d, height: d, left: -d / 2, top: -d / 2, boxShadow: '0 8px 10px rgba(60,40,20,0.38)' }}
      />
    ) : null}
  </div>
  )
}
