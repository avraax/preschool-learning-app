// One shuffled PASS over a content pool — the app-wide fix for "every prompt is drawn with
// replacement" (Practice Loop PRD-01 W1).
//
// Every quiz picked its prompt with `pool[Math.floor(Math.random() * pool.length)]`, so a round could
// ask the same thing twice however big the pool was: Bogstav Quiz asks 8 of 28 letters, which is
// P(repeat) ~ 0.66 (the product of (1 - i/28), i=1..7). The two anti-repeat mechanisms that existed —
// Læs Ordet's recent-3 window, Hvilken Farve's avoid-the-previous — bound ADJACENCY, not FREQUENCY, so
// they couldn't fix it either. That is also why the catalog rule "a level's content POOL must be at
// least the ROUND LENGTH" never did what it was bought for: growing Læs Ordet's Let pool from 5 to 9
// words changed nothing, because sampling with replacement repeats at any pool size.
//
// This generalises `makeTargetBag` in `colorMixing.ts`, which was written for exactly this defect in
// Ram Farven ("avoiding only the previous target let 8 mixes from Let's 4 goals hand out lilla four
// times") and then never propagated. Ram Farven keeps its own copy on purpose — see
// `NON_POOL_RANDOM_EXEMPT`.
//
// PURE + Node-importable (`promptBag.test.ts` samples it, and it sits in `config/` for the same reason
// the prebake enumerator's data does), so relative imports need an explicit `.ts` extension.
import { shuffle } from '../utils/shuffle.ts'

export interface PromptBag<T> {
  /** The next prompt. Never repeats until the pool has been exhausted. */
  next(): T
  /**
   * Push an item back in `ahead` draws' time — `ahead: 3` makes it the 3rd next draw (W2's re-ask).
   * Clamped into the remaining pass; if fewer draws remain it goes to the front of the NEXT pass.
   */
  requeue(item: T, ahead: number): void
  /**
   * Rebuild for a new pool (a mid-game difficulty change). A no-op when the pool is unchanged, so a
   * level change that doesn't move the pool must not restart the pass — otherwise every adult-menu
   * poke reshuffles and the no-repeat guarantee erodes. Keeps the seam rule against the last item.
   */
  reset(items: readonly T[]): void
}

// Identity keys for object items, so the default `key` can never silently collapse a whole pool of
// objects into one "[object Object]" bucket. Pools are module-level constants, so reference identity is
// a real key; a call site that builds fresh objects per draw must pass its own `key`.
const identityKeys = new WeakMap<object, string>()
let identitySeq = 0
const defaultKey = (item: unknown): string => {
  if (item !== null && (typeof item === 'object' || typeof item === 'function')) {
    const obj = item as object
    let k = identityKeys.get(obj)
    if (k === undefined) {
      k = `#${++identitySeq}`
      identityKeys.set(obj, k)
    }
    return k
  }
  return String(item)
}

// A NUL separator, so no pair of item keys can join into the same signature as a different pool.
// Built with `fromCharCode` rather than written literally — a raw control byte in a source file makes
// git and ripgrep treat the whole file as binary.
const SEP = String.fromCharCode(0)
const signatureOf = <T>(list: readonly T[], key: (t: T) => string): string =>
  list.map(key).join(SEP)

/**
 * A bag draw over `items`.
 *
 * Semantics (each one is an assertion in `promptBag.test.ts`):
 * 1. A pass is a `shuffle()` of the pool and `next()` walks it, so one pass yields every item exactly
 *    once (absent `requeue`, which deliberately inserts a second copy).
 * 2. **No item repeats within `window` consecutive draws** — the generalisation of `makeTargetBag`'s
 *    `avoidFirst`, and the reason it is a window rather than one item: a bag only guarantees "no repeat
 *    inside a PASS", and a round of 8 over a pool of 28 straddles a pass boundary one round in three.
 *    With `avoidFirst` alone (window 2) ~14% of Bogstav Quiz rounds still repeated, because a fresh
 *    shuffle is free to deal a just-asked letter second. Pass the game's ROUND LENGTH as the window and
 *    a round can never repeat, wherever in the pass it starts. Feasible for any pool >= window; below
 *    that (Nuancer asks 8 questions over 6 hues) the repeat is arithmetic, and the refill degrades to
 *    "as late as possible" rather than hanging.
 * 3. A pool of 1 is legal and returns that item forever (Ram Farven's Let pool is 4 — don't throw).
 * 4. `reset()` is idempotent for an unchanged pool.
 * 5. `rnd` is injectable so tests are deterministic (same reason `shuffle` takes it).
 */
export function makePromptBag<T>(
  items: readonly T[],
  opts: { key?: (t: T) => string; rnd?: () => number; window?: number } = {},
): PromptBag<T> {
  const key = opts.key ?? (defaultKey as (t: T) => string)
  const rnd = opts.rnd ?? Math.random
  // Window 2 = "never twice in a row" = `makeTargetBag`'s `avoidFirst`, the conservative default.
  const window = Math.max(2, Math.floor(opts.window ?? 2))

  let pool: T[] = [...items]
  let signature = signatureOf(pool, key)
  /** The remaining draws of the current pass; the head is the next prompt. */
  let pass: T[] = []
  /** Items promised to the HEAD of the next pass — a `requeue` that outran the current pass. */
  let front: T[] = []
  /** The keys of the last `window - 1` draws, which the head of a new pass must avoid. */
  const recent: string[] = []

  const refill = (): void => {
    // Shuffle, then deal the pass greedily so its head avoids what was just drawn. Only the first
    // `window - 1` positions are actually constrained (a pass never repeats itself), and for
    // pool >= window a candidate always survives the filter — proof: at position i the forbidden set
    // holds at most (window - 1 - i) items still in `remaining`, leaving >= pool - window + 1 >= 1.
    const remaining = shuffle(pool, rnd)
    const seen = [...recent]
    const dealt: T[] = []
    while (remaining.length > 0) {
      let idx = remaining.findIndex((i) => !seen.includes(key(i)))
      // Infeasible only when the pool is SMALLER than the window; take the oldest-seen candidate so the
      // unavoidable repeat lands as late as it can, rather than looping forever.
      if (idx < 0) idx = 0
      const [item] = remaining.splice(idx, 1)
      dealt.push(item)
      seen.push(key(item))
      if (seen.length > window - 1) seen.shift()
    }
    pass = dealt
    // The promised items go in AFTER the window pass is dealt: a requeued item is by construction one
    // just missed, so the window would push W2's re-ask straight back out of its scheduled slot.
    if (front.length > 0) {
      const promised = new Set(front.map(key))
      pass = [...front, ...pass.filter((i) => !promised.has(key(i)))]
      front = []
    }
  }

  return {
    next(): T {
      // An empty pool cannot produce a prompt, and every caller's pool is guarded to be non-empty (the
      // pool-at-least-round rule, plus `spellingWordsFor`'s own floor). Throwing beats returning
      // `undefined`, which would crash one frame later on an unanswerable board.
      if (pool.length === 0) throw new Error('makePromptBag: next() on an empty pool')
      if (pass.length === 0) refill()
      const item = pass.shift() as T
      recent.push(key(item))
      if (recent.length > window - 1) recent.shift()
      return item
    },

    requeue(item: T, ahead: number): void {
      const k = key(item)
      // A re-miss RE-schedules rather than stacking copies, so a repeatedly-missed item can never fill
      // the rest of the pass with itself.
      pass = pass.filter((i) => key(i) !== k)
      front = front.filter((i) => key(i) !== k)
      const idx = Math.max(0, Math.floor(ahead) - 1) // `ahead: 1` = the very next draw
      if (idx <= pass.length) pass.splice(idx, 0, item)
      else front.push(item)
    },

    reset(nextItems: readonly T[]): void {
      const nextSignature = signatureOf(nextItems, key)
      if (nextSignature === signature) return
      signature = nextSignature
      pool = [...nextItems]
      pass = []
      // Drop promises the new pool can't keep; keep `recent` so the window survives the change.
      front = front.filter((i) => pool.some((p) => key(p) === key(i)))
    },
  }
}

/**
 * Content-pool draws under `src/components/{alphabet,math,farver,english,ordleg}` that legitimately
 * stay on `Math.random()`, each with its reason — same shape as `difficulty.ts`'s `EXEMPT`, and read by
 * `promptDraw.test.ts` (which also fails on a STALE entry, so a reason can't outlive its code).
 *
 * Keys are `<path under src/components>::<the identifier being indexed>`.
 */
export const PROMPT_DRAW_EXEMPT: Record<string, string> = {
  'alphabet/AlphabetGame.tsx::DANISH_ALPHABET':
    'distractor top-up, not the prompt — distractors are already shuffled and are not the thing that repeats',
  'farver/NuancerGame.tsx::otherHues':
    "Svaer's decoy hue — a distractor, not the prompt (the prompt hue is the bag draw above it)",
  'farver/NuancerGame.tsx::decoyShades':
    "Svaer's decoy shade within that hue — a distractor, not the prompt",
}

/**
 * Files in those sections whose OTHER `Math.random()` uses (not a pool index) are deliberate, with the
 * reason. Anything else has to be converted, or argued for here.
 */
export const NON_POOL_RANDOM_EXEMPT: Record<string, string> = {
  'farver/FarvejagtGame.tsx':
    'scatter POSITIONS on the board (x/y percentages) — geometry, not content; the target colour is a bag draw',
  'farver/RamFarvenGame.tsx':
    "passes Math.random as the `rnd` of its own `makeTargetBag` — already a bag. Deliberately NOT migrated: it buys nothing and risks colorMixing.test.ts's invariants, so the duplication is noted on both sides instead",
}
