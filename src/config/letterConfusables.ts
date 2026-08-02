// Which Danish letters a child actually mixes up — the data behind Bogstav Quiz's distractor policy
// (Difficulty PRD-01 §4.2).
//
// It lives in `src/config/` rather than in `AlphabetGame.tsx` for one reason: `difficulty.test.ts` runs
// on plain Node, so it cannot import a `.tsx` (React + MUI + `.webp` imports). The assertion that makes
// Svær real — "every askable letter can fill four distractors from the confusable pool WITHOUT falling
// back to random letters" — is only checkable from here.
//
// Pure data + two lookups. No React, no side effects.

/**
 * The TIGHT groups: near-identical shapes, or Danish vowels that sound alike. Normal seeds its
 * distractors from here; Let keeps them out.
 */
export const CONFUSABLE_GROUPS: string[][] = [
  ['M', 'N'],
  ['Æ', 'Ø', 'Å'],
  ['B', 'D', 'P'],
  ['E', 'Æ'],
  ['O', 'Å'],
  ['I', 'Y'],
]

/**
 * The BROAD shape/sound families. Svær asks for FIVE tiles = four distractors, and no tight group is
 * that big (the largest gives 3), so "all distractors from the confusable group" would have fallen
 * straight through to random letters — leaving Svær barely different from Normal, which is the exact
 * dead level this PRD exists to fix. These families are what make it a real level.
 *
 * Grouped by what actually gets confused on a page: closed bowls, stem+bowl, vertical stems with bars,
 * diagonals, humps, the vowels, and the curved hooks. Every letter has ≥4 mates across the two tiers —
 * asserted by `difficulty.test.ts`, so shrinking a family fails the build rather than silently
 * re-introducing random top-ups at Svær.
 */
export const SHAPE_FAMILIES: string[][] = [
  ['B', 'C', 'D', 'G', 'O', 'P', 'Q', 'Ø'],
  ['B', 'D', 'P', 'R'],
  ['E', 'F', 'H', 'I', 'J', 'L', 'T'],
  ['A', 'K', 'M', 'N', 'V', 'W', 'X', 'Y'],
  ['M', 'N', 'U', 'W'],
  ['A', 'E', 'I', 'O', 'U', 'Y', 'Æ', 'Ø', 'Å'],
  ['G', 'J', 'R', 'S', 'Z'],
]

const matesIn = (groups: string[][], letter: string): string[] => {
  const set = new Set<string>()
  for (const group of groups) {
    if (!group.includes(letter)) continue
    for (const g of group) if (g !== letter) set.add(g)
  }
  return [...set]
}

/** The tight look-/sound-alike group for a letter (M/N, B/D/P, Æ/Ø/Å…). */
export const confusablesFor = (letter: string): string[] => matesIn(CONFUSABLE_GROUPS, letter)

/** Only the broad-family mates — i.e. the confusable pool MINUS the tight group. */
export const shapeMatesFor = (letter: string): string[] => {
  const tight = confusablesFor(letter)
  return matesIn(SHAPE_FAMILIES, letter).filter((l) => !tight.includes(l))
}

/** Everything confusable with a letter, tight group FIRST then its broad shape/sound families. */
export const confusablePoolFor = (letter: string): string[] => [
  ...confusablesFor(letter),
  ...shapeMatesFor(letter),
]
