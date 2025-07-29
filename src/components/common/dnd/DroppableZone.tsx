import React from 'react'
import { useDroppable } from '@dnd-kit/core'

interface DroppableZoneProps {
  id: string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  data?: any
}

export const DroppableZone: React.FC<DroppableZoneProps> = ({ 
  id, 
  children,
  style,
  className,
  data
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: isOver ? 'rgba(220, 38, 38, 0.2)' : style?.backgroundColor,
        transition: 'background-color 0.2s ease'
      }}
      className={className}
    >
      {children}
    </div>
  )
}