// Reactive-mascot event bus (UI/UX Overhaul PRD §5.5).
//
// A tiny global emitter so any game handler can trigger the corner mascot's reaction WITHOUT
// prop-drilling a `reaction` through GameShell. The single mounted <Mascot/> subscribes; games
// call `mascotBus.emit('correct')` from the SAME handler that fires `celebrateTier`/SFX, so the
// mascot stays in lock-step with the other feedback. Decoupled from the audio channels.

export type MascotEvent =
  | 'welcome'
  | 'idle'
  | 'correct'
  | 'wrong'
  | 'streak'
  | 'round'
  | 'hint'
  | 'sticker'

type Listener = (event: MascotEvent) => void

class MascotBus {
  private listeners = new Set<Listener>()

  emit(event: MascotEvent): void {
    this.listeners.forEach((l) => {
      try {
        l(event)
      } catch {
        /* a listener error must never break the game handler that emitted */
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

export const mascotBus = new MascotBus()
