import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { DraggableItem } from '../../common/dnd/DraggableItem'
import { KREA_COLOR_NAME } from '../../../config/kreaPhrases'
import { BEAD_ART } from '../../../assets/games/krea/beads'
import { Bead } from './Bead'
import { LiftedBead } from './HeldBead'
import type { BeadColor } from './beadBoard'

// The colour bowls (Krea PRD-02 §2.2): a clay bowl heaped with beads per crayon colour. Each bowl is a
// shared `DraggableItem` — DRAG one bead out of it onto a peg, or TAP it to lift one bead into the
// hand (`onActivate`). Both end in the game's one resolver. The bowl itself never moves: the
// draggable is a transparent hit box over it, and the game draws the bead in the finger.
//
// The tray is ONE droppable ("bowls"): a bead dragged off the board and dropped here goes home.

// The heap in the bowl's mouth: fixed spots (% of the bowl box), so every bowl looks the same and
// nothing is random.
// Centred in the mouth (x 50%, y ~33% of the keyed render): two at the back, three in front, each 22%
// wide, so these are left/top = centre − 11. Index 2 (front middle) is the one that leaves.
const HEAP = [
  { x: 29, y: 14 },
  { x: 49, y: 14 },
  { x: 39, y: 25 },
  { x: 19, y: 25 },
  { x: 59, y: 25 },
]

export const BeadBowls: React.FC<{
  colours: readonly BeadColor[]
  /** The colour in hand after a tap (its bowl lifts a little and one bead floats above it). */
  held: BeadColor | null
  /** The never-fail hint (W3): this bowl glows. */
  glow?: BeadColor | null
  /** The bowl whose bead is in the finger right now. */
  dragging: BeadColor | null
  disabled: boolean
  orientation: 'landscape' | 'portrait'
  onTap: (c: BeadColor) => void
}> = ({ colours, held, glow, dragging, disabled, orientation, onTap }) => {
  const drop = useDroppable({ id: 'bowls' })
  return (
    <div
      ref={drop.setNodeRef}
      data-krea-bowls
      data-krea-held={held ?? ''}
      style={{
        display: 'grid',
        gap: 'var(--bead-bowl-gap)',
        ...(orientation === 'landscape'
          ? { gridTemplateColumns: 'repeat(2, var(--bead-bowl))', gridAutoRows: 'var(--bead-bowl)' }
          : { gridTemplateRows: 'repeat(var(--bead-bowl-rows, 2), var(--bead-bowl))', gridAutoColumns: 'var(--bead-bowl)', gridAutoFlow: 'column' }),
        alignContent: 'center',
        justifyContent: 'center',
      }}
    >
      {colours.map((c) => (
        <div key={c} data-krea-bowl={c} aria-label={KREA_COLOR_NAME[c]} style={{ position: 'relative', width: 'var(--bead-bowl)', height: 'var(--bead-bowl)' }}>
          {/* The bowl's look (lift, glow) lives on this SIBLING of the draggable, never on the cell: any
              transform on a DraggableItem's ANCESTOR — even an identity `translateY(0) scale(1)` — made
              dnd-kit's drag offset drift in WebKit (measured: 98 → 49 → 147 px while the finger moved
              98 → 196 → 294). */}
          <div
            data-krea-bowl-look
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              transform: held === c ? 'translateY(-5px) scale(1.06)' : 'translateY(0px) scale(1)',
              transition: 'transform 140ms cubic-bezier(0.3,0.7,0.4,1)',
              filter: glow === c ? 'drop-shadow(0 0 8px rgba(255,210,60,1))' : held === c ? 'drop-shadow(0 0 6px rgba(255,214,90,0.9))' : 'drop-shadow(0 3px 3px rgba(70,40,15,0.3))',
            }}
          >
            <img src={BEAD_ART.bowl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            {HEAP.map((p, i) => (
              <Bead
                key={i}
                colour={c}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: '22%',
                  height: '22%',
                  // The top bead of the heap is the one that leaves: hidden while it is in the finger or in hand.
                  visibility: i === 2 && (dragging === c || held === c) ? 'hidden' : 'visible',
                }}
              />
            ))}
          </div>
          {held === c ? <LiftedBead colour={c} /> : null}
          <DraggableItem id={`bowl:${c}`} inline fill disabled={disabled} data={{ colour: c }} onActivate={() => onTap(c)}>
            <div aria-label={KREA_COLOR_NAME[c]} style={{ width: '100%', height: '100%' }} />
          </DraggableItem>
        </div>
      ))}
    </div>
  )
}
