// One shuffled PASS over a content pool, dealt a BOARD at a time (Endless Play PRD-01 W6 / D7).
//
// `makePromptBag` deals one item per `next()`, which is right for a quiz. Memory needs `n` items at
// once and has an extra constraint a prompt bag never has: **a single board must not contain a
// duplicate pair.** So when a pass runs out mid-board, the refill skips whatever is already on the
// current board and leaves those items at the HEAD of the next pass — they are still dealt exactly
// once, just at the start of the following cycle.
//
// Before this, `UnifiedMemoryGame` did `shuffle(pool).slice(0, boardPairs)` per board: a draw WITH
// replacement across boards, so at 15 pairs from 29 letters the same letters came back board after
// board while others were never seen. In endless play that is the whole experience.
//
// PURE + Node-importable (`boardBag.test.ts` samples it, and it sits in `config/` for the reason
// `game-development.md` gives: a test cannot read a list out of a `.tsx`), so relative imports need an
// explicit `.ts` extension.
import { shuffle } from '../utils/shuffle.ts'

export interface BoardBag<T> {
  /**
   * The next board's `n` items. Never contains a duplicate, and every pool item is dealt exactly once
   * before any of them comes back.
   */
  deal(n: number): T[]
}

export function makeBoardBag<T>(
  pool: readonly T[],
  opts: { rnd?: () => number; key?: (t: T) => string } = {},
): BoardBag<T> {
  const rnd = opts.rnd ?? Math.random
  const key = opts.key ?? ((t: T) => String(t))
  /** What is left of the current pass; the head is dealt next. */
  let remaining: T[] = []

  return {
    deal(n: number): T[] {
      // A board can never be bigger than the pool — a duplicate pair would be arithmetic, not a bug,
      // and the callers' own "pool ≥ board" guards make this unreachable in practice.
      const want = Math.min(Math.max(0, Math.floor(n)), pool.length)
      const board: T[] = []
      const onBoard = new Set<string>()

      while (board.length < want) {
        let idx = remaining.findIndex((i) => !onBoard.has(key(i)))
        if (idx < 0) {
          // The pass is exhausted — start the next one. Appending BEHIND the survivors (rather than
          // replacing `remaining`) is DEFENSIVE, not load-bearing: with `want <= pool.length` a board
          // can never both exhaust a pass and already hold every survivor, so in practice `remaining`
          // is empty here and the two forms are identical. Measured by re-break — dropping the
          // survivors changes no output. It is kept because it is free and it is what would keep the
          // "dealt exactly once" property true if the clamp above ever moved.
          remaining = [...remaining, ...shuffle(pool, rnd)]
          idx = remaining.findIndex((i) => !onBoard.has(key(i)))
          // `want <= pool.length` guarantees a survivor here; bail rather than spin if it ever doesn't.
          if (idx < 0) break
        }
        const [item] = remaining.splice(idx, 1)
        board.push(item)
        onBoard.add(key(item))
      }

      return board
    },
  }
}

export default makeBoardBag
