import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useTapActivate } from './dragActivation'

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
  onActivate
}) => {
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

  const style = {
    // Absolute + left/top% for scattered boards (Farvejagt); relative/in-flow for tray layouts.
    ...(inline
      ? { position: 'relative' as const }
      : { position: 'absolute' as const, left: `${position.x}%`, top: `${position.y}%` }),
    ...(fill ? { width: '100%', height: '100%' } : null),
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.8 : 1, // Slightly transparent while dragging
    cursor: disabled ? 'default' : 'grab',
    touchAction: 'none',
    zIndex: isDragging ? 1000 : 'auto'
  }

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
