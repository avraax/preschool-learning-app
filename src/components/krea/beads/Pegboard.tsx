import React, { useEffect, useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useTapActivate } from '../../common/dnd/dragActivation'
import { BEAD_LAYOUT } from '../../../config/kreaBeads'
import { Bead, BOARD_PLASTIC } from './Bead'
import type { BeadBoard, BeadColor, PegGeometry } from './beadBoard'

// The pegboard (Krea PRD-02 §4.1–4.3).
//
// ONE droppable and ONE draggable for the whole board, never one per peg: a Svær board is 169 pegs, and
// 169 droppables measured with `MeasuringStrategy.Always` is untested here and expensive on the A10X. A
// point becomes a peg by arithmetic (`geometryOf` + `pegAt`). The board's single draggable is how a
// placed bead is dragged off or moved: the press says WHICH bead by where it landed.
//
// Rendering is static: the plastic and its pegs are one SVG, each placed bead one CSS-gradient div with
// no animation of its own. Only the JUST-placed bead plays a one-shot drop (WAAPI, transform/opacity).

export const RIM = BEAD_LAYOUT.rimPitches

/** The peg area of a board element, in client px: the outer pegs sit half a rim inside its edge. */
export function geometryOf(el: HTMLElement | null, n: number): PegGeometry | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width) return null
  const pitch = r.width / (n + RIM)
  return { left: r.left + (RIM / 2) * pitch, top: r.top + (RIM / 2) * pitch, pitch, n }
}

/** A peg's box as a percentage of the board element — what the beads and the ring are placed by. */
export const pegBox = (n: number, peg: number, size: number) => {
  const unit = 100 / (n + RIM)
  const col = peg % n
  const row = Math.floor(peg / n)
  return {
    left: `${(RIM / 2 + col + (1 - size) / 2) * unit}%`,
    top: `${(RIM / 2 + row + (1 - size) / 2) * unit}%`,
    width: `${size * unit}%`,
    height: `${size * unit}%`,
  }
}

/**
 * The plastic and its pegs: a rounded square per peg, overlapping into one smooth shape that follows
 * the board's mask (a heart board is heart-shaped), and a small raised peg in each. Static.
 */
export const BoardArt: React.FC<{ n: number; mask: readonly boolean[] }> = ({ n, mask }) => {
  const S = 100
  const side = (n + RIM) * S
  const o = (RIM / 2) * S
  const cells: React.ReactNode[] = []
  const pegs: React.ReactNode[] = []
  mask.forEach((on, i) => {
    if (!on) return
    const x = o + (i % n) * S
    const y = o + Math.floor(i / n) * S
    cells.push(<rect key={i} x={x - 22} y={y - 22} width={S + 44} height={S + 44} rx={40} />)
    // Square bridges to the right and below neighbours: two rounded cells side by side leave a dip at
    // their seam, so the joins are filled flat and only the OUTER corners round.
    if ((i % n) + 1 < n && mask[i + 1]) cells.push(<rect key={`h${i}`} x={x + S / 2} y={y - 22} width={S} height={S + 44} />)
    if (i + n < mask.length && mask[i + n]) cells.push(<rect key={`v${i}`} x={x - 22} y={y + S / 2} width={S + 44} height={S} />)
    pegs.push(<circle key={i} cx={x + S / 2} cy={y + S / 2} r={15} />)
  })
  return (
    <svg viewBox={`0 0 ${side} ${side}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
      <defs>
        <filter id="kreaBoardShadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy={side * 0.012} stdDeviation={side * 0.012} floodColor="#4E3214" floodOpacity="0.32" />
        </filter>
      </defs>
      <g fill={BOARD_PLASTIC} filter="url(#kreaBoardShadow)">{cells}</g>
      <g fill="#DDD3C1" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth={4}>{pegs}</g>
    </svg>
  )
}

/** The placed beads, absolutely placed by peg. `hide` is the peg whose bead is in the finger right now. */
export const PlacedBeads: React.FC<{ board: BeadBoard; size: number; hide?: number | null }> = ({ board, size, hide }) => (
  <>
    {board.beads.map((c, i) =>
      c && i !== hide ? <Bead key={i} peg={i} colour={c as BeadColor} style={{ position: 'absolute', ...pegBox(board.n, i, size) }} /> : null,
    )}
  </>
)

export interface PegboardProps {
  board: BeadBoard
  /** Bead diameter as a fraction of the pitch (`KREA_BEADS[level].bead`). */
  beadSize: number
  disabled: boolean
  /** The peg whose bead is being dragged (hidden on the board). */
  liftedPeg: number | null
  /** The bead that just landed — it plays the one-shot drop. `n` changes per placement. */
  lastPlaced: { peg: number; n: number } | null
  reduce: boolean
  /** The hit layer, for `geometryOf`. */
  hitRef: React.MutableRefObject<HTMLDivElement | null>
  /** The hover ring the game moves imperatively while a bead hovers (no re-render per pointermove). */
  ringRef: React.Ref<HTMLDivElement>
  /** The board container — Ny plade's slide-away runs on it. */
  boardRef?: React.Ref<HTMLDivElement>
  /** A tap on the board at a client point (not a drag). */
  onTapAt: (x: number, y: number) => void
}

export const Pegboard: React.FC<PegboardProps> = ({ board, beadSize, disabled, liftedPeg, lastPlaced, reduce, hitRef, ringRef, boardRef, onTapAt }) => {
  const drop = useDroppable({ id: 'board' })
  const drag = useDraggable({ id: 'board-bead', disabled })
  const downAt = useRef<{ x: number; y: number } | null>(null)
  const tap = useTapActivate(() => {
    if (downAt.current) onTapAt(downAt.current.x, downAt.current.y)
  }, disabled)

  const setRefs = (el: HTMLDivElement | null) => {
    hitRef.current = el
    drop.setNodeRef(el)
    drag.setNodeRef(el)
  }

  // The just-placed bead drops onto its peg: one WAAPI one-shot on that ONE element.
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!lastPlaced || reduce) return
    const el = layer.current?.querySelector<HTMLElement>(`[data-peg="${lastPlaced.peg}"]`)
    el?.animate(
      [
        { transform: 'translateY(-22%) scale(1.22)', opacity: 0.7 },
        { transform: 'translateY(0px) scale(1)', opacity: 1 },
      ],
      { duration: 170, easing: 'cubic-bezier(0.3,0.7,0.4,1)' },
    )
  }, [lastPlaced, reduce])

  return (
    <div ref={boardRef} data-krea-board data-krea-board-n={board.n} data-krea-beads={board.beads.filter(Boolean).length} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <BoardArt n={board.n} mask={board.mask} />
      <div ref={layer} style={{ position: 'absolute', inset: 0 }}>
        <PlacedBeads board={board} size={beadSize} hide={liftedPeg} />
      </div>
      <div
        ref={ringRef}
        data-krea-ring
        aria-hidden
        style={{
          position: 'absolute',
          display: 'none',
          borderRadius: '50%',
          boxShadow: '0 0 0 3px #FFFFFF, 0 0 0 6px rgba(255,186,40,0.95)',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={setRefs}
        data-krea-board-hit
        {...drag.listeners}
        {...drag.attributes}
        role="application"
        aria-label="Perleplade"
        onPointerDown={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY }
          ;(drag.listeners as { onPointerDown?: (e: React.PointerEvent) => void } | undefined)?.onPointerDown?.(e)
          tap.onPointerDown(e)
        }}
        onClickCapture={tap.onClickCapture}
        onClick={tap.onClick}
        style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent' }}
      />
    </div>
  )
}
