import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useTapActivate } from './dragActivation'

interface DroppableZoneProps {
  id: string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  data?: any
  /** Tint shown while a draggable hovers over the zone. Defaults to a neutral white wash so it
   *  never forces red onto a non-red target (educational colors must read true). */
  overColor?: string
  /** Tap = the other half of the interaction (owner, 2026-08-03). The zone carries it when the ZONE is
   *  what the child chooses — Hvilken Farve?'s swatches, where the single draggable object is merely
   *  the thing being placed, so tapping the object could not mean anything. Games whose DRAGGABLE is
   *  the choice (Farvejagt, Ram Farven, Nuancer) put `onActivate` there instead. Same threshold rule
   *  as DraggableItem: see dragActivation.ts. */
  onActivate?: () => void
}

export const DroppableZone: React.FC<DroppableZoneProps> = ({
  id,
  children,
  style,
  className,
  data,
  overColor = 'rgba(255, 255, 255, 0.35)',
  onActivate
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data
  })

  const tap = useTapActivate(onActivate)

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: isOver ? overColor : style?.backgroundColor,
        transition: 'background-color 0.2s ease',
        ...(onActivate ? { cursor: 'pointer' } : null)
      }}
      className={className}
      onPointerDown={onActivate ? tap.onPointerDown : undefined}
      onClick={onActivate ? tap.onClick : undefined}
    >
      {children}
    </div>
  )
}
