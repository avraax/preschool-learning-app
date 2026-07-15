// Level-up event bus (Liveliness PRD-01). Mirrors mascotBus: a tiny global emitter so any play
// context (round-result screen, browse handler, memory) can trigger the app-root <LevelUpOverlay/>
// WITHOUT prop-drilling. The overlay subscribes; callers emit from the same place they record the
// play. Decoupled from the audio channels + the scene/world layer.

import type { SectionId } from './progressStore'

export interface LevelUpEvent {
  level: number // the level just REACHED (levelAfter)
  section: SectionId | null // the section whose play triggered it (null = unknown/mixed)
}

type Listener = (event: LevelUpEvent) => void

class LevelUpBus {
  private listeners = new Set<Listener>()

  emit(event: LevelUpEvent): void {
    this.listeners.forEach((l) => {
      try {
        l(event)
      } catch {
        /* a listener error must never break the handler that emitted */
      }
    })
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const levelUpBus = new LevelUpBus()

// DEV: expose for the headless verification harness (force the level-up ceremony without a round).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __levelUpBus?: LevelUpBus }).__levelUpBus = levelUpBus
}
