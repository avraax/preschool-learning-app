import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useTapActivate } from './dragActivation'
import { draggableStyle, type DragLift } from './draggableStyle'
import { useReducedMotion } from '../../../hooks/useReducedMotion'

interface DraggableItemProps {
  id: string
  children: React.ReactNode
  disabled?: boolean
  position?: { x: number; y: number }
  // Render in normal document flow (`position: relative`) instead of being absolutely placed at
  // `position.x/y%`. Use inside a flex/grid tray (Hvilken Farve?, Nuancer, Ram Farven's palette) —
  // avoids the old `position: relative !important` wrapper hacks. `position` is ignored when inline.
  inline?: boolean
  // Stretch to the parent's box (`width/height: 100%`). Needed when the draggable sits in a sized grid
  // cell and its child expects to fill it — an `inline` wrapper has no height of its own, so an
  // AnswerTile inside one collapses to its content. Only meaningful with `inline`.
  fill?: boolean
  data?: any
  // The grab "lift" (scale/tilt while held). It MUST live here, never as a framer scale on a wrapper
  // around the DraggableItem: an ancestor's scale multiplies the drag offset, so the item drifts off
  // the finger. See draggableStyle.ts.
  lift?: DragLift
  // Tap = the other half of the interaction (owner, 2026-08-03). Fires only for a press-release that
  // stayed inside `DRAG_ACTIVATION_DISTANCE`, i.e. exactly the gestures dnd-kit refuses to drag with,
  // so a tap and a drop can never both resolve one gesture. Wire it to the SAME resolve function the
  // game's `onDragEnd` calls — never a copy of that logic.
  onActivate?: () => void
}

export const DraggableItem: React.FC<DraggableItemProps> = ({
  id,
  children,
  disabled = false,
  position = { x: 0, y: 0 },
  inline = false,
  fill = false,
  data,
  lift,
  onActivate
}) => {
  const reduce = useReducedMotion()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
    data
  })

  const tap = useTapActivate(onActivate, disabled)

  // dnd-kit's `listeners` already carries an `onPointerDown` (it is how the sensor arms). Compose
  // rather than replace: spreading `listeners` and THEN setting our own `onPointerDown` would drop
  // theirs and silently kill dragging on this element.
  const handlePointerDown = (e: React.PointerEvent) => {
    ;(listeners as any)?.onPointerDown?.(e)
    tap.onPointerDown(e)
  }

  const style = draggableStyle({ transform, isDragging, disabled, inline, fill, position, lift, reduce }) as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onPointerDown={handlePointerDown}
      // Always installed: it swallows the trailing click of a real DRAG so a child that owns its own
      // tap (Stav Ordet's TactileTile buttons) cannot answer a second time for the same gesture.
      onClickCapture={tap.onClickCapture}
      onClick={onActivate ? tap.onClick : undefined}
    >
      {children}
    </div>
  )
}
