import { useCallback, useRef, useState } from 'react'
import { progressStore, sectionForGameId } from '../services/progressStore'
import { xpBus } from '../services/xpBus'
import { useRewardCeremony } from './useRewardCeremony'

// Per-task XP + streak counter (Endless Play PRD-01 W2 — this was `useRound`).
//
// **THE ROUND IS GONE as a thing the child can perceive.** No boundary, no "Færdig!", no stars, no
// personal bests, no replay button. What survives is what a task game actually needs between two
// questions: grant this task's XP, count the first-try streak for the every-3rd milestone, and — if
// that grant crossed a reward slot — hand the seam to the ceremony BEFORE the next question is
// generated.
//
// `tasksInRound` is NOT a length any more; nothing counts down. It is the `taskXp` NORMALISER ("a round
// is a round" — one task is worth REWARD_XP / tasksInRound, so every game pays the same per notional
// round however it subdivides its work) and, at each call site, the same constant the prompt bag uses
// as its no-repeat WINDOW. Keeping ONE value per game feeding both is what stops the normaliser and the
// bag window drifting apart.
//
// `thenContinue()` is the seam, and it lives here rather than in ten games on purpose: the cancellation
// rule ("a promise is never resolved after unmount") has to hold everywhere or a deferred
// `generateNewQuestion()` fires over the next screen.

export interface TaskRunConfig {
  /**
   * The `taskXp` normaliser + the bag's seam window (see the header). Defaults to 8.
   */
  tasksInRound: number
  /** Stable progress id, e.g. `alphabet.quiz`. Absent → no XP is granted (nothing ships that way). */
  gameId?: string
}

export interface TaskRunState {
  /** Tasks completed since mount. Used only as a per-question `chargeKey`; it never ends anything. */
  index: number
  /** Current first-try streak — the every-3rd milestone beat. */
  streak: number
  /**
   * This task's XP crossed a reward slot, so a ceremony is owed. Read off the STORE CURSOR
   * (`globalLevel() > lastCelebratedLevel`), never `grant.global.leveledUp` — see `useRewardCeremony`.
   */
  crossedLevel: boolean
}

export interface UseTaskRun {
  tasksInRound: number
  state: TaskRunState
  /** Record a completed task. Returns the new state synchronously. */
  completeTask: (firstTry: boolean) => TaskRunState
  /**
   * THE SEAM. If the last `completeTask` crossed a slot, play the ceremony and only then run `next`;
   * otherwise run `next` synchronously. `next` is NEVER run after unmount.
   */
  thenContinue: (next: () => void) => void
}

const initialState = (): TaskRunState => ({ index: 0, streak: 0, crossedLevel: false })

export const useTaskRun = (config?: TaskRunConfig): UseTaskRun => {
  // Ref is the synchronous source of truth (so completeTask can return live values and the caller can
  // branch immediately); state mirrors it to trigger re-renders.
  const ref = useRef<TaskRunState>(initialState())
  const [state, setState] = useState<TaskRunState>(initialState)
  const crossedRef = useRef(false)
  const ceremony = useRewardCeremony()

  const tasksInRound = config?.tasksInRound ?? 8
  const gameId = config?.gameId

  const completeTask = useCallback(
    (firstTry: boolean): TaskRunState => {
      const prev = ref.current
      const index = prev.index + 1
      const streak = firstTry ? prev.streak + 1 : 0
      let crossedLevel = false
      // Live per-task XP: grant on THIS completed task (round-normalised + first-try bonus,
      // difficulty-independent) and ping the corner reward ring.
      if (gameId) {
        const grant = progressStore.grantTaskXp(gameId, { firstTry, tasksInRound })
        xpBus.emit({ amount: grant.granted, leveledUp: grant.global.leveledUp })
        crossedLevel =
          progressStore.globalLevel() > progressStore.get().progression.lastCelebratedLevel
      }
      const next: TaskRunState = { index, streak, crossedLevel }
      ref.current = next
      crossedRef.current = crossedLevel
      setState(next)
      return next
    },
    [gameId, tasksInRound],
  )

  const section = gameId ? sectionForGameId(gameId) : null

  const thenContinue = useCallback(
    (next: () => void) => {
      if (!crossedRef.current) {
        next()
        return
      }
      // Cleared BEFORE the await: the ceremony advances the cursor on dismiss, but a second
      // `thenContinue` fired in between must not queue a second ceremony for the same crossing.
      crossedRef.current = false
      void ceremony.celebrateIfOwed(section).then(next)
    },
    [ceremony, section],
  )

  return { tasksInRound, state, completeTask, thenContinue }
}

export default useTaskRun
