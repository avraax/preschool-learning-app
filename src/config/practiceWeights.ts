// WHEN a missed item comes back — expanding retrieval, in two pure functions (Practice Loop PRD-01 W2).
//
// **THIS IS NOT ADAPTIVE DIFFICULTY.** The standing owner rule stands: the LEVEL is manual and
// adult-set, and nothing reads the child's performance to change one. This module changes the ORDER of
// prompts inside the level's own pool and nothing else — same items, same tile counts, same distractor
// policy, same star thresholds, same XP. Write that down here, because `difficulty.ts`'s header ("NO
// ADAPTIVITY. … Nothing in this file — or anything reading it — looks at the child's performance") is
// otherwise a correct reason for a future session to delete this feature.
//
// The mechanical form of that promise, asserted by `practiceWeights.test.ts`: this module must not
// import `difficulty.ts`, and nothing that calls `difficultyFor()` may import the ledger. So a level can
// never be a function of a miss, whatever anyone writes later.
//
// PURE + Node-importable → relative imports need an explicit `.ts` extension (there are none today, and
// the guard above is why: the only thing it could reach for is the difficulty table).

/** Draws to wait before the first re-ask. */
export const REQUEUE_BASE = 2
/** Misses past this stop pushing the re-ask further out — expanding retrieval, not exile. */
export const REQUEUE_MISS_CAP = 3
/**
 * How many of the pool's most-missed items may lead a pass. Deliberately small: the failure mode to
 * guard is a round that becomes a drill of the same three letters (that is what makes a 5-year-old
 * quit), NOT under-drilling.
 */
export const MAX_FRONT_LOADED = 2

/**
 * Where a just-missed item goes: `2 + min(misses, 3)` draws ahead, i.e. the 3rd next question the first
 * time and the 5th from the third miss on. Expanding retrieval in one line — re-ask soon, then further
 * out each time, which is what beats massed repetition for this age.
 *
 * `misses` is the count AFTER recording this miss, so the first miss gives 3.
 */
export const requeueAhead = (misses: number): number =>
  REQUEUE_BASE + Math.min(Math.max(0, Math.floor(misses)), REQUEUE_MISS_CAP)

/**
 * The (at most `MAX_FRONT_LOADED`) items of this pool that should lead the next pass — the most-missed
 * first. An item with no recorded misses is never front-loaded, so a fresh child's rounds are pure
 * shuffle and nothing about this is visible until he has actually got something wrong.
 *
 * Ties keep the pool's own order, so the result is deterministic (a bag whose front-load reshuffled on
 * every refill would make the measured guarantees unreproducible).
 */
export const frontLoadKeys = (
  keys: readonly string[],
  missesOf: (key: string) => number,
): string[] =>
  keys
    .map((key, index) => ({ key, index, misses: missesOf(key) }))
    .filter((e) => e.misses > 0)
    .sort((a, b) => b.misses - a.misses || a.index - b.index)
    .slice(0, MAX_FRONT_LOADED)
    .map((e) => e.key)

/**
 * What a practice ledger has to offer for the wiring below — structurally typed, so this module still
 * imports NOTHING (which is what keeps the "must not import difficulty.ts" promise trivially auditable).
 */
export interface PracticeSource {
  missesFor(gameId: string, itemKey: string): number
  onMiss(listener: (gameId: string, itemKey: string, misses: number) => void): () => void
}

/** The bag surface the re-ask needs — a subset of `PromptBag<T>`. */
interface RequeueableBag<T> {
  requeue(item: T, ahead: number): void
}

/**
 * THE re-ask. Subscribes a bag to its own game's misses and pushes the missed item back
 * `requeueAhead(misses)` draws. Returns an unsubscribe.
 *
 * It lives here — pure, taking the source as an interface — rather than inside `usePromptBag`, so the
 * simulation in `practiceWeights.test.ts` drives the REAL wiring instead of a copy of it. A test that
 * re-implemented "and then it requeues" would keep passing after the product stopped doing it.
 */
export const wirePracticeReask = <T>(args: {
  gameId: string
  bag: RequeueableBag<T>
  /** The live pool, read at miss time — how a miss reported as a plain key finds its item again. */
  poolAt: () => readonly T[]
  keyOf: (item: T) => string
  source: PracticeSource
  /** Called instead when the missed key isn't in this bag's pool (a silent no-ask otherwise). */
  onUnknownKey?: (itemKey: string) => void
}): (() => void) =>
  args.source.onMiss((missedGame, itemKey, misses) => {
    if (missedGame !== args.gameId) return
    const item = args.poolAt().find((i) => args.keyOf(i) === itemKey)
    if (item === undefined) args.onUnknownKey?.(itemKey)
    else args.bag.requeue(item, requeueAhead(misses))
  })
