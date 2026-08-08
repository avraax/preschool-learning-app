// Reward-ceremony event bus (Reward Book PRD-01 W4). Mirrors mascotBus: a tiny global emitter so any
// play context (round-result screen, browse handler, memory) can trigger the app-root
// <RewardOverlay/> WITHOUT prop-drilling. The overlay subscribes; callers emit from the same place
// they record the play. Decoupled from the audio channels + the scene/world layer.
//
// `level` is the internal cursor, NOT something the child ever sees: the overlay uses it only to
// advance `lastCelebratedLevel` on dismiss so a ceremony fires exactly once. What's actually shown is
// whatever `progressStore.grantPendingRewards()` hands over.

import type { SectionId } from './progressStore'

export interface RewardEvent {
  level: number // the level just REACHED (levelAfter) — the once-only cursor
  section: SectionId | null // the section whose play triggered it (null = unknown/mixed)
  /**
   * Fired EXACTLY ONCE when the ceremony is over — on dismiss and on the empty-ceremony bail-out
   * (Endless Play PRD-01 W1). It is what lets an in-game seam AWAIT the ceremony and only then
   * generate the next question, so a board can never deal itself under the overlay.
   *
   * The overlay collapses two emits into one ceremony (keeping the higher level), so it holds a SET
   * of pending callbacks rather than the latest event's — otherwise the first caller's continuation
   * would be dropped and its game would freeze mid-round.
   */
  onDone?: () => void
}

type Listener = (event: RewardEvent) => void

class RewardBus {
  private listeners = new Set<Listener>()

  emit(event: RewardEvent): void {
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

export const rewardBus = new RewardBus()

// DEV: expose for the headless verification harness (force the ceremony without playing a round).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __rewardBus?: RewardBus }).__rewardBus = rewardBus
}
