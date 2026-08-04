import { useMemo, useRef } from 'react'
import { makePromptBag, type PromptBag } from '../config/promptBag'

/**
 * A game's prompt bag, held for the life of the screen (Practice Loop PRD-01 W1).
 *
 * `draw(pool)` is the ONE call site a game needs: it builds the bag on the first question and, on every
 * later one, `reset()`s it against the level's current pool — which is a no-op unless the pool actually
 * moved, so a mid-game difficulty change deals from the new level immediately while an unchanged level
 * keeps walking its pass. There is deliberately no second anti-repeat mechanism beside it (the old
 * `recentRef` / `previousObject` / `previousHue` refs are DELETED, not kept alongside — two mechanisms
 * is how one gets bypassed).
 *
 * `window` is the game's ROUND LENGTH: no prompt repeats within that many consecutive draws, so a round
 * can't repeat itself even when it straddles two passes (see `makePromptBag`'s semantics). Pass it from
 * the one round-length constant the `RoundConfig` uses — a hand-copied number here would silently stop
 * covering the round it exists to cover.
 *
 * The bag is exposed as `bag()` so W2 can `requeue()` a missed item on the wrong branch.
 */
export function usePromptBag<T>(opts: { key?: (item: T) => string; window?: number } = {}) {
  const ref = useRef<PromptBag<T> | null>(null)
  // `key` is a pure function of an item and `window` a constant, so capturing the first render's values
  // is correct — and it keeps this object's identity stable, which matters because games read it inside
  // generator closures.
  const optsRef = useRef(opts)

  return useMemo(
    () => ({
      draw(pool: readonly T[]): T {
        if (!ref.current) ref.current = makePromptBag(pool, optsRef.current)
        else ref.current.reset(pool)
        return ref.current.next()
      },
      /** Re-ask `item` in `ahead` draws' time. No-op before the first draw. */
      requeue(item: T, ahead: number): void {
        ref.current?.requeue(item, ahead)
      },
      bag(): PromptBag<T> | null {
        return ref.current
      },
    }),
    [],
  )
}

export default usePromptBag
