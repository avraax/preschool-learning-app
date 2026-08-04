import { useEffect, useMemo, useRef } from 'react'
import { makePromptBag, type PromptBag } from '../config/promptBag'
import { frontLoadKeys, wirePracticeReask } from '../config/practiceWeights'
import { practiceLedger } from '../services/practiceLedger'

/**
 * A game's prompt bag, held for the life of the screen (Practice Loop PRD-01 W1 + W2).
 *
 * `draw(pool)` is the ONE call site a game needs: it builds the bag on the first question and, on every
 * later one, `reset()`s it against the level's current pool — which is a no-op unless the pool actually
 * moved, so a mid-game difficulty change deals from the new level immediately while an unchanged level
 * keeps walking its pass. There is deliberately no second anti-repeat mechanism beside it (the old
 * `recentRef` / `previousObject` / `previousHue` refs are DELETED, not kept alongside — two mechanisms is
 * how one gets bypassed).
 *
 * `window` is the game's ROUND LENGTH: no prompt repeats within that many consecutive draws, so a round
 * can't repeat itself even when it straddles two passes (see `makePromptBag`'s semantics). Pass it from
 * the one round-length constant the `RoundConfig` uses — a hand-copied number here would silently stop
 * covering the round it exists to cover.
 *
 * `gameId` wires W2's practice ledger, and it is wired HERE rather than through a per-game callback
 * because the two halves of a re-ask live in different places: the engine's resolve knows the item and
 * whether it was first-try; only the bag knows the pass. So the bag SUBSCRIBES to misses for its own
 * game and requeues at `requeueAhead(misses)` draws, and it front-loads each new pass with that pool's
 * most-missed items (at most 2 — `frontLoadKeys`). Omit `gameId` and the bag is pure W1 shuffle.
 */
export function usePromptBag<T>(
  opts: { key?: (item: T) => string; window?: number; gameId?: string } = {},
) {
  const ref = useRef<PromptBag<T> | null>(null)
  // The pool of the most recent draw — how a miss reported as a plain itemKey finds its item again.
  const poolRef = useRef<readonly T[]>([])
  // `key`/`window`/`gameId` are constants of the screen, so capturing the first render's values is
  // correct — and it keeps this object's identity stable, which matters because games read it inside
  // generator closures.
  const optsRef = useRef(opts)

  const api = useMemo(() => {
    const { key, window, gameId } = optsRef.current
    const keyOf = (item: T): string => (key ? key(item) : String(item))
    return {
      draw(pool: readonly T[]): T {
        poolRef.current = pool
        if (!ref.current) {
          ref.current = makePromptBag(pool, {
            key,
            window,
            frontLoad: gameId
              ? (live) => frontLoadKeys(live.map(keyOf), (k) => practiceLedger.missesFor(gameId, k))
              : undefined,
          })
        } else {
          ref.current.reset(pool)
        }
        return ref.current.next()
      },
      /** Re-ask `item` in `ahead` draws' time. No-op before the first draw. */
      requeue(item: T, ahead: number): void {
        ref.current?.requeue(item, ahead)
      },
      bag(): PromptBag<T> | null {
        return ref.current
      },
      keyOf,
    }
  }, [])

  // W2's re-ask. The subscription is the whole wiring: no game passes a callback, and a game with no
  // `gameId` (or a section with no ledger entries) behaves exactly as it did under W1 alone. The logic
  // itself is the pure `wirePracticeReask`, so the simulation can drive this exact code path.
  useEffect(() => {
    const gameId = optsRef.current.gameId
    if (!gameId) return
    return wirePracticeReask({
      gameId,
      // Forwarded rather than captured: this effect can run BEFORE the first `draw()` has built the bag
      // (in a hand-rolled game the hook is declared above the init effect), and a bag captured as null
      // then would leave the game with no re-ask at all — silently, since nothing about play changes.
      bag: { requeue: (item, ahead) => ref.current?.requeue(item, ahead) },
      poolAt: () => poolRef.current,
      keyOf: api.keyOf,
      source: practiceLedger,
      onUnknownKey: (itemKey) => {
        // The write point sends a plain string; if it isn't this bag's key the re-ask silently never
        // happens, which is invisible in play. Say so loudly in DEV rather than degrading in silence.
        if (import.meta.env?.DEV) {
          console.warn(`[practice] ${gameId} missed "${itemKey}", which is not a key in its prompt pool`)
        }
      },
    })
  }, [api])

  return api
}

export default usePromptBag
