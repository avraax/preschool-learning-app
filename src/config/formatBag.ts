// Which TASK SHAPE the next task takes — the main one, or a level's alternate (Game Depth PRD-01 §3.11).
//
// Several games now mix a second task shape in at Normal/Svær: Ram Farven's reverse "hvad bliver det?",
// Plus/Minus's missing number, Sammenlign's "tryk på det mindste tal". The owner asked for "about 1 in 3".
// A per-task coin flip delivers that only on average — it hands out three alternates in a row as often
// as it hands out none in nine — so the share is dealt from a BAG instead: each pass of `of` slots holds
// exactly `alt` alternates, shuffled, so the share is exact and the position unpredictable.
//
// The seam rule: a pass may not START with an alternate when the previous pass ENDED with one, so the
// child never meets two alternates back-to-back across a seam (inside a pass they can only touch when
// `alt >= 2`). Not adaptivity: nothing here looks at the child's answers.
//
// PURE + Node-importable (sampled by `formatBag.test.ts`), so relative imports carry `.ts`.
import { shuffle } from '../utils/shuffle.ts'

/** A level's share of alternate tasks: exactly `alt` in every `of`. `0` = never. */
export type FormatShare = 0 | { alt: number; of: number }

export type TaskFormat = 'main' | 'alt'

export interface FormatBag {
  next(): TaskFormat
}

/** True when a share can ever deal an alternate. */
export const hasAlternate = (share: FormatShare): share is { alt: number; of: number } =>
  share !== 0 && share.alt > 0 && share.of > 0

export function makeFormatBag(share: FormatShare, rnd: () => number = Math.random): FormatBag {
  if (!hasAlternate(share)) return { next: () => 'main' }
  const of = Math.max(1, Math.floor(share.of))
  const alt = Math.min(of, Math.max(0, Math.floor(share.alt)))
  let pass: TaskFormat[] = []
  let last: TaskFormat = 'main'

  const refill = (): void => {
    const slots: TaskFormat[] = [
      ...Array.from({ length: alt }, () => 'alt' as const),
      ...Array.from({ length: of - alt }, () => 'main' as const),
    ]
    let dealt = shuffle(slots, rnd)
    // Seam rule — only satisfiable while the pass holds at least one main slot.
    if (last === 'alt' && dealt[0] === 'alt' && alt < of) {
      const firstMain = dealt.indexOf('main')
      ;[dealt[0], dealt[firstMain]] = [dealt[firstMain], dealt[0]]
      dealt = [...dealt]
    }
    pass = dealt
  }

  return {
    next(): TaskFormat {
      if (pass.length === 0) refill()
      const f = pass.shift() as TaskFormat
      last = f
      return f
    },
  }
}

export default makeFormatBag
