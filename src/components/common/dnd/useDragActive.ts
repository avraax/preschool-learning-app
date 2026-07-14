import { useState } from 'react'
import type { DragOverEvent } from '@dnd-kit/core'

// Shared lift/breathe drag state for the Farver drag games. `activeId` is the currently-grabbed
// draggable (drives the lift/scale juice); `overId` is the droppable under the pointer (drives the
// target's breathe/glow). Identical across all four games, so it lives here once.
//
// Wire it into a DndContext:
//   <DndContext onDragStart={handleDragStart} onDragOver={onDragOver}
//               onDragCancel={clearActive} onDragEnd={handleDragEnd}>
// `onDragStart` stays per-game (it varies — pick-up SFX, and 3 of 4 games also cancel narration —
// so the game owns it and calls `setActiveId(event.active.id)`). Both drag-end and drag-cancel must
// clear the state: cancel wires straight to `clearActive`, and each game's own `handleDragEnd` calls
// `clearActive()` at the top before its game-specific drop logic.
export function useDragActive() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const onDragOver = (event: DragOverEvent) => setOverId(event.over ? String(event.over.id) : null)
  const clearActive = () => {
    setActiveId(null)
    setOverId(null)
  }

  return { activeId, overId, setActiveId, onDragOver, clearActive }
}
