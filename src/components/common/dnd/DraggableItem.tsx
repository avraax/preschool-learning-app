import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface DraggableItemProps {
  id: string
  children: React.ReactNode
  disabled?: boolean
  position?: { x: number; y: number }
  data?: any
}

export const DraggableItem: React.FC<DraggableItemProps> = ({ 
  id, 
  children, 
  disabled = false,
  position = { x: 0, y: 0 },
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
    position: 'absolute' as const,
    left: `${position.x}%`,
    top: `${position.y}%`,
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