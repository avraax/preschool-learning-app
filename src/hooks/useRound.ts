import { useCallback, useRef, useState } from 'react'

// Bounded-round state (Overhaul Foundation — System 3).
//
// Turns an endless quiz into a fixed-length round that finishes and rewards. NO timer; wrong
// answers don't end the round or get punished mid-round — they only break the current question's
// "first try" flag, which affects the star rating and the streak.
//
// A question "completes" when the child advances (answers correctly). Call completeQuestion()
// once per completed question with whether it was a first-try-correct. It returns the fresh round
// state synchronously, so the caller can immediately decide: advance to the next question, fire a
// streak-milestone celebration, or end the round.

export interface RoundConfig {
  length: number // questions per round (e.g. 8)
  starThresholds?: { three: number; two: number } // MISTAKES allowed; default 3★=0, 2★≤2
  stickerSetId?: string // optional sticker-pool bias
}

export interface RoundState {
  index: number // questions completed so far
  firstTryCorrect: number // questions answered correctly on the first attempt
  streak: number // current first-try streak
  longestStreak: number // longest first-try streak this round
  done: boolean // round finished
}

export interface UseRound {
  enabled: boolean
  length: number
  state: RoundState
  /** Record a completed question. Returns the new state synchronously. */
  completeQuestion: (firstTry: boolean) => RoundState
  reset: () => void
}

const initialState = (): RoundState => ({
  index: 0,
  firstTryCorrect: 0,
  streak: 0,
  longestStreak: 0,
  done: false,
})

export const useRound = (config?: RoundConfig): UseRound => {
  const enabled = !!config && config.length > 0
  // Ref is the synchronous source of truth (so completeQuestion can return live values and the
  // caller can branch immediately); state mirrors it to trigger re-renders.
  const ref = useRef<RoundState>(initialState())
  const [state, setState] = useState<RoundState>(initialState)

  const completeQuestion = useCallback(
    (firstTry: boolean): RoundState => {
      const prev = ref.current
      const index = prev.index + 1
      const firstTryCorrect = prev.firstTryCorrect + (firstTry ? 1 : 0)
      const streak = firstTry ? prev.streak + 1 : 0
      const longestStreak = Math.max(prev.longestStreak, streak)
      const done = enabled ? index >= (config?.length ?? 0) : false
      const next: RoundState = { index, firstTryCorrect, streak, longestStreak, done }
      ref.current = next
      setState(next)
      return next
    },
    [enabled, config?.length],
  )

  const reset = useCallback(() => {
    ref.current = initialState()
    setState(ref.current)
  }, [])

  return { enabled, length: config?.length ?? 0, state, completeQuestion, reset }
}

export default useRound
