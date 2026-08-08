import { useCallback, useEffect, useRef } from 'react'
import { progressStore, type SectionId } from '../services/progressStore'
import { rewardBus } from '../services/rewardBus'

// Fire the reward ceremony AT THE SEAM, in-game, and resolve when it is over (Endless Play PRD-01 W1).
//
// The round is gone as a child-facing thing, so the payoff and the answer that earned it have to be
// the same moment: play → the ring fills → it's full → the sticker, right there, then play continues.
// Every `useTaskRun` game therefore awaits this between "the task completed" and "generate the next
// one", which is what stops a board dealing itself underneath the overlay.
//
// Three things this hook owns, each of which would otherwise be copied into ten games:
//
//  • **The crossing test reads the STORE CURSOR** — `globalLevel() > lastCelebratedLevel` — never
//    `grant.global.leveledUp` (§4.2). The cursor also catches a crossing produced by a cross-tab write
//    or a CRDT merge, and it is the same value `owedRewards()` and `RewardWatcher` agree on.
//  • **On unmount the promise is CANCELLED, never resolved.** The child can leave mid-ceremony (the
//    back button is mounted throughout play); resolving then would run a deferred
//    `generateNewQuestion()` over the next screen. This is what makes deferring the generator safe in
//    all ten games at once, and it retires the per-game `mountedRef` hazard.
//  • **It never GRANTS.** `progressStore.grantPendingRewards()` stays the overlay's job — the one
//    grant point in the app.

/**
 * A beat after the ceremony closes before play resumes, so the tap that DISMISSED the sticker can't be
 * followed a frame later by a second tap landing on a freshly-generated board.
 */
export const RESUME_MS = 250

export interface RewardCeremony {
  /** Resolves immediately when nothing is owed; otherwise after the ceremony is dismissed. */
  celebrateIfOwed: (section: SectionId | null) => Promise<void>
}

export function useRewardCeremony(): RewardCeremony {
  const mountedRef = useRef(true)
  const resumeTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // `true` HERE, not just as the initial value: StrictMode mounts → cleans up → remounts in dev, and a
  // ref only takes its initial value once (the same trap that froze Sig et Ord — game-development.md).
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      resumeTimers.current.forEach(clearTimeout)
      resumeTimers.current = []
    }
  }, [])

  const celebrateIfOwed = useCallback((section: SectionId | null): Promise<void> => {
    const level = progressStore.globalLevel()
    if (level <= progressStore.get().progression.lastCelebratedLevel) return Promise.resolve()
    return new Promise<void>((resolve) => {
      rewardBus.emit({
        level,
        section,
        onDone: () => {
          const t = setTimeout(() => {
            resumeTimers.current = resumeTimers.current.filter((x) => x !== t)
            // Deliberately NOT resolved after unmount — see the header.
            if (mountedRef.current) resolve()
          }, RESUME_MS)
          resumeTimers.current.push(t)
        },
      })
    })
  }, [])

  return { celebrateIfOwed }
}

export default useRewardCeremony
