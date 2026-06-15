import React from 'react'
import { useDroppable } from '@dnd-kit/core'

interface DroppableZoneProps {
  id: string
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
  data?: any
  /** Tint shown while a draggable hovers over the zone. Defaults to a neutral white wash so it
   *  never forces red onto a non-red target (educational colors must read true). */
  overColor?: string
}

export const DroppableZone: React.FC<DroppableZoneProps> = ({
  id,
  children,
  style,
  className,
  data,
  overColor = 'rgba(255, 255, 255, 0.35)'
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
        backgroundColor: isOver ? overColor : style?.backgroundColor,
        transition: 'background-color 0.2s ease'
      }}
      className={className}
    >
      {children}
    </div>
  )
}