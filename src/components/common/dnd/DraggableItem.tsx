import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface DraggableItemProps {
  id: string
  children: React.ReactNode
  disabled?: boolean
  position?: { x: number; y: number }
  // Render in normal document flow (`position: relative`) instead of being absolutely placed at
  // `position.x/y%`. Use inside a flex/grid tray (Hvilken Farve?, Nuancer, Ram Farven's palette) —
  // avoids the old `position: relative !important` wrapper hacks. `position` is ignored when inline.
  inline?: boolean
  data?: any
}

export const DraggableItem: React.FC<DraggableItemProps> = ({
  id,
  children,
  disabled = false,
  position = { x: 0, y: 0 },
  inline = false,
  data
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

  // Removed debug logging for performance

  const style = {
    // Absolute + left/top% for scattered boards (Farvejagt); relative/in-flow for tray layouts.
    ...(inline
      ? { position: 'relative' as const }
      : { position: 'absolute' as const, left: `${position.x}%`, top: `${position.y}%` }),
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
    >
      {children}
    </div>
  )
}