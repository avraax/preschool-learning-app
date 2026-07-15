// Live per-task XP event bus (Liveliness PRD-04). Mirrors mascotBus / levelUpBus: a tiny global
// emitter so the few earning choke points (useRound.completeQuestion, UnifiedMemoryGame's match
// branch, the browse-XP helper) can tell the in-game/menu LevelRingMini indicator that XP was just
// granted — WITHOUT prop-drilling through every game. The ring itself reads the live value from the
// progress store (useProgress); this bus only drives the transient flourish: the "+X" flyer, the
// ring "tick"/"pop", and (in-game only) a non-interrupting level-up burst.
//
// Decoupled from the audio channels, the scene/world layer, and the big level-up ceremony
// (levelUpBus). A mid-game level-up sets `leveledUp` here for the small flourish but does NOT emit
// levelUpBus — the big ceremony is deferred to a safe surface (round-result / next menu).

export interface XpTickEvent {
  amount: number // XP granted by this single task (already weighted; the "+N" the flyer shows)
  leveledUp: boolean // this grant crossed a global level (drives the in-game mini-flourish)
}

type Listener = (event: XpTickEvent) => void

class XpBus {
  private listeners = new Set<Listener>()

  emit(event: XpTickEvent): void {
    if (event.amount <= 0 && !event.leveledUp) return // nothing to show
    this.listeners.forEach((l) => {
      try {
        l(event)
      } catch {
        /* a listener error must never break the handler that granted XP */
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

export const xpBus = new XpBus()
