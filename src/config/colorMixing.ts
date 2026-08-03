// Ram Farven's colour-mixing recipes — educational DATA, never themeable (like `colorContent.ts`).
//
// This moved out of `RamFarvenGame.tsx` on 2026-08-02 for one reason: the game speaks lines built from
// these recipes ("rød og blå bliver lilla", "Lav lilla farve ved at blande farverne"), and
// `shared-narration-clips.js` can only import `src/config/*.ts` — data stranded in a .tsx can never be
// enumerated, so those clips silently stayed live/unauditioned. The game still owns everything else
// (pot mechanics, difficulty pools, the recipe reveal UI).
//
// PURE + Node-importable (the enumerator imports it), so relative imports need an explicit `.ts`.
import { shuffle } from '../utils/shuffle.ts'

export interface ColorDroplet {
  id: string
  color: string
  colorName: string
  hex: string
  isUsed: boolean
}

export interface TargetColor {
  color: string
  name: string
  hex: string
}

/**
 * The 5 droppable source colours (3 primaries + white/black for tints and shades).
 *
 * **The ORDER is load-bearing.** Ram Farven's tray is `primaryColors.slice(0, sources)` where
 * `sources` comes from `COLORS_RAMFARVEN[level]`, so the three primaries must come FIRST and **black
 * must stay LAST** — that slice is what gives Let a board where every droplet is part of some answer,
 * and what makes black arrive at Normal as a deliberate decoy. Reordering silently changes which
 * droplets each level offers; `colorMixing.test.ts` pins the ids.
 */
export const primaryColors: ColorDroplet[] = [
  { id: 'red', color: 'rød', colorName: 'rød', hex: '#EF4444', isUsed: false },
  { id: 'blue', color: 'blå', colorName: 'blå', hex: '#3B82F6', isUsed: false },
  { id: 'yellow', color: 'gul', colorName: 'gul', hex: '#FDE047', isUsed: false },
  { id: 'white', color: 'hvid', colorName: 'hvid', hex: '#F8FAFC', isUsed: false },
  { id: 'black', color: 'sort', colorName: 'sort', hex: '#1F2937', isUsed: false }
]

/**
 * The 10 mixable goals — every unordered pair of `primaryColors` makes exactly one of them, so the
 * child can never make a combination that means nothing. `mørkegul` closed the last gap (`gul+sort`
 * used to fall through to an unnamed `color-mix()` sludge that was always wrong). That also fixes the
 * ceiling: 5 sources give 10 pairs and all 10 are now used, so **more goals require a new SOURCE
 * colour** — which is deliberately not done, since adding grøn as a droplet while also teaching
 * blå+gul=grøn is muddy for a 5-year-old. The difficulty pools that gate these stay in the game.
 */
export const possibleTargets: TargetColor[] = [
  // Secondary colors (two primaries)
  { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  { color: 'orange', name: 'orange', hex: '#F97316' },
  { color: 'grøn', name: 'grøn', hex: '#10B981' },
  // Tints (primary + white)
  { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  // Shades (primary + black) and grey. `mørkegul`'s hex is the one `SHADES.gul` in colorContent.ts
  // already teaches, so the newest goal at least doesn't widen the section's hex drift.
  { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  { color: 'mørkegul', name: 'mørkegul', hex: '#CA8A04' },
  { color: 'grå', name: 'grå', hex: '#9CA3AF' }
]

/** Both orders are listed so a mix is order-independent; the SPOKEN line is built per key, so
 *  "rød og blå bliver lilla" and "blå og rød bliver lilla" are both real (and both prebaked). */
export const mixingRules: Record<string, TargetColor> = {
  // Secondaries
  'rød+blå': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  'blå+rød': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  'rød+gul': { color: 'orange', name: 'orange', hex: '#F97316' },
  'gul+rød': { color: 'orange', name: 'orange', hex: '#F97316' },
  'blå+gul': { color: 'grøn', name: 'grøn', hex: '#10B981' },
  'gul+blå': { color: 'grøn', name: 'grøn', hex: '#10B981' },
  // Tints (+ white)
  'rød+hvid': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  'hvid+rød': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  'blå+hvid': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  'hvid+blå': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  'gul+hvid': { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  'hvid+gul': { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  // Shades (+ black)
  'rød+sort': { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  'sort+rød': { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  'blå+sort': { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  'sort+blå': { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  'gul+sort': { color: 'mørkegul', name: 'mørkegul', hex: '#CA8A04' },
  'sort+gul': { color: 'mørkegul', name: 'mørkegul', hex: '#CA8A04' },
  'sort+hvid': { color: 'grå', name: 'grå', hex: '#9CA3AF' },
  'hvid+sort': { color: 'grå', name: 'grå', hex: '#9CA3AF' }
}

/**
 * The ORDER the difficulty pool grows in: the 3 iconic two-primary secondaries, then `lyserød` (Let's
 * 4th — with only 3 goals an 8-mix round repeats each ~2.7×, which reads as stuck rather than easy),
 * the remaining tints, then the black-based shades + grey that force the child to reach for black.
 * `COLORS_RAMFARVEN[level].targets` takes a prefix of this.
 *
 * Lives here rather than in the game so `colorMixing.test.ts` can assert the invariant that matters —
 * **every goal a level asks for must be mixable from the droplets that level offers**. A goal needing
 * black at Let would be unwinnable with nothing failing, and reading this list out of the .tsx with a
 * regex was how a first attempt at that guard ended up vacuous.
 *
 * Must stay a PERMUTATION of `possibleTargets`: a name no rule produces is an impossible goal, and a
 * target missing from here can never be asked.
 */
export const TARGET_PRIORITY: readonly string[] = [
  'lilla', 'orange', 'grøn',
  'lyserød', 'lyseblå', 'lysegul',
  'mørkerød', 'mørkeblå', 'mørkegul', 'grå',
]

/**
 * One shuffled pass over a level's goals — a "bag" draw, which is what actually fixes the repetition.
 *
 * The old draw avoided only the immediately-previous target and then picked uniformly at random, so
 * eight mixes out of Let's four goals could hand out lilla four times and it read as the game being
 * stuck. Walking a shuffled bag and refilling when it empties makes Let exactly two clean passes of
 * its four, and Normal show all six before anything repeats.
 *
 * `avoidFirst` is the just-served goal: without it a repeat straddles the seam between two bags (the
 * last of one and the first of the next), which is the one place a bag draw can still look random.
 * PURE and seedable (`rnd`) so `colorMixing.test.ts` can sample it — same shape as the math generators.
 */
export const makeTargetBag = (
  names: readonly string[],
  rnd: () => number = Math.random,
  avoidFirst?: string,
): string[] => {
  const bag = shuffle(names, rnd)
  if (bag.length > 1 && avoidFirst !== undefined && bag[0] === avoidFirst) {
    const j = 1 + Math.floor(rnd() * (bag.length - 1))
    ;[bag[0], bag[j]] = [bag[j], bag[0]]
  }
  return bag
}
