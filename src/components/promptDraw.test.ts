// Every game's PROMPT comes out of a bag — guarded as SOURCE (Practice Loop PRD-01 §3.3).
//
// `promptBag.test.ts` proves the bag and the pools are right; it cannot see whether a component USES
// them. That is the split from `game-development.md`: a config/data test passes while the feature is
// entirely absent, so the wiring needs its own guard. Both halves were re-broken separately.
//
// The files are read as TEXT because they are `.tsx` and pull in MUI/framer — unimportable from
// `node --test`. Comments are stripped FIRST: a prose mention of `Math.random` in the "why" comment
// above the fix satisfied a plain `includes()` in `authOverlayZ.test.ts` and kept it green after the fix
// itself had been removed. Every comment in these files talks about the random draw it replaced.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NON_POOL_RANDOM_EXEMPT, PROMPT_DRAW_EXEMPT } from '../config/promptBag.ts'
import { PROMPT_POOLS } from '../config/promptPools.ts'

const COMPONENTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const SECTIONS = ['alphabet', 'math', 'farver', 'english', 'ordleg']

/** File contents with block and line comments removed, so prose can never satisfy an assertion. */
const codeOf = (rel: string): string =>
  readFileSync(path.join(COMPONENTS, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const sectionFiles = (): string[] =>
  SECTIONS.flatMap((dir) =>
    readdirSync(path.join(COMPONENTS, dir))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => `${dir}/${f}`),
  )

/**
 * The idiom every prompt draw in this codebase used: `pool[Math.floor(Math.random() * pool.length)]`.
 * Captures the expression being indexed, which is what `PROMPT_DRAW_EXEMPT` is keyed on.
 *
 * The optional call group is load-bearing, found by /re-break: reverting AlphabetGame to
 * `alphabetPromptPool()[Math.floor(Math.random() * …)]` — the natural shape now that the pool is a
 * function — slipped past a bare-identifier version of this pattern and was only caught by the
 * accounting test below. (Something even further out, `pool.at(…)` or a helper, still needs a
 * `Math.random` call, which is what makes that accounting test the real backstop.)
 */
const POOL_INDEX = /([A-Za-z_$][\w$.]*(?:\(\s*[^()]*\))?)\s*\[\s*Math\.floor\s*\(\s*Math\.random\s*\(\s*\)/g

// The one file per game that draws its prompt, and the bag it must draw from. `usePromptBag` is the
// hook; `makeTargetBag` is Ram Farven's own older bag, deliberately not migrated (see the exempt note).
const DRAWS_ITS_PROMPT_FROM_A_BAG: Record<string, string> = {
  'alphabet/AlphabetGame.tsx': 'usePromptBag',
  'english/EnglishListenGame.tsx': 'usePromptBag',
  'english/EnglishWordGame.tsx': 'usePromptBag',
  'ordleg/LaesOrdetGame.tsx': 'usePromptBag',
  'ordleg/SpellingGame.tsx': 'usePromptBag',
  'farver/FarveQuizGame.tsx': 'usePromptBag',
  'farver/NuancerGame.tsx': 'usePromptBag',
  'farver/FarvejagtGame.tsx': 'usePromptBag',
  'farver/RamFarvenGame.tsx': 'makeTargetBag',
}

test('no game selects a prompt from a content pool with Math.random()', () => {
  const found = new Set<string>()
  for (const rel of sectionFiles()) {
    const code = codeOf(rel)
    for (const [, pool] of code.matchAll(POOL_INDEX)) {
      const site = `${rel}::${pool}`
      found.add(site)
      assert.ok(
        site in PROMPT_DRAW_EXEMPT,
        `${site} draws from a pool with Math.random(). Convert it to a prompt bag, or add it to PROMPT_DRAW_EXEMPT with a reason.`,
      )
    }
  }
  // …and no STALE exemption: a reason must not outlive the code it excuses (the same rule that makes
  // difficulty.ts's EXEMPT honest).
  for (const site of Object.keys(PROMPT_DRAW_EXEMPT)) {
    assert.ok(found.has(site), `PROMPT_DRAW_EXEMPT still lists ${site}, which no longer exists`)
  }
  // Every exemption carries a real reason, not an empty string.
  for (const [site, reason] of Object.entries(PROMPT_DRAW_EXEMPT)) {
    assert.ok(reason.length > 20, `${site}'s exemption needs a reason`)
  }
})

test('any OTHER Math.random in a game section is accounted for', () => {
  // The backstop for a draw written in a shape POOL_INDEX doesn't recognise: whatever the syntax, it
  // still needs the call, and a file that has one must say why in NON_POOL_RANDOM_EXEMPT.
  const withOther: string[] = []
  for (const rel of sectionFiles()) {
    const code = codeOf(rel)
    const total = (code.match(/Math\.random/g) ?? []).length
    const inPoolIndex = [...code.matchAll(POOL_INDEX)].length
    if (total - inPoolIndex > 0) withOther.push(rel)
  }
  for (const rel of withOther) {
    assert.ok(
      rel in NON_POOL_RANDOM_EXEMPT,
      `${rel} uses Math.random outside a pool index — convert it, or add it to NON_POOL_RANDOM_EXEMPT with a reason`,
    )
  }
  for (const rel of Object.keys(NON_POOL_RANDOM_EXEMPT)) {
    assert.ok(withOther.includes(rel), `NON_POOL_RANDOM_EXEMPT still lists ${rel}, which no longer needs it`)
  }
})

test('each game draws its prompt from a bag, and from its shared pool', () => {
  for (const [rel, bag] of Object.entries(DRAWS_ITS_PROMPT_FROM_A_BAG)) {
    const code = codeOf(rel)
    assert.match(code, new RegExp(`\\b${bag}\\b`), `${rel} no longer uses ${bag} — its prompt draw regressed`)
  }
  // The pool comes from `promptPools` (importable → the measured simulation samples the same function),
  // not from a filter re-derived inside the component — AND it is passed to the bag's own `draw()`.
  // Those have to be ONE assertion, found by /re-break: replacing the draw with
  // `colorQuizPromptPool(level)[0]` left both `usePromptBag` and the pool call standing in the file, so
  // two separate `includes`-style checks stayed green with the feature gone.
  const POOL_FN: Record<string, string> = {
    'alphabet/AlphabetGame.tsx': 'alphabetPromptPool',
    'english/EnglishListenGame.tsx': 'englishPromptPool',
    'english/EnglishWordGame.tsx': 'englishPromptPool',
    'ordleg/LaesOrdetGame.tsx': 'readingPromptPool',
    'ordleg/SpellingGame.tsx': 'spellingPromptPool',
    'farver/FarveQuizGame.tsx': 'colorQuizPromptPool',
    'farver/NuancerGame.tsx': 'nuancerPromptPool',
    'farver/FarvejagtGame.tsx': 'farvejagtPromptPool',
  }
  for (const [rel, fn] of Object.entries(POOL_FN)) {
    const code = codeOf(rel)
    assert.match(code, new RegExp(`\\.draw\\(\\s*${fn}\\(`), `${rel} does not draw its prompt from ${fn}()`)
  }
  // Every game in the registry is wired, and nothing is wired that the registry doesn't measure.
  assert.equal(PROMPT_POOLS.length, Object.keys(POOL_FN).length)
})

test("the bag's no-repeat window is the game's OWN round length", () => {
  // A hand-typed window would stop covering the round it exists to cover the moment a round length
  // moves — the drift that made a "pool >= 4" guard pass against Læs Ordet's 5-word/8-question bug.
  const WINDOW_CONST: Record<string, string> = {
    'alphabet/AlphabetGame.tsx': 'ALPHABET_ROUND',
    'english/EnglishListenGame.tsx': 'ENGLISH_ROUND',
    'english/EnglishWordGame.tsx': 'ENGLISH_ROUND',
    'ordleg/LaesOrdetGame.tsx': 'READING_ROUND_LENGTH',
    'ordleg/SpellingGame.tsx': 'SPELLING_ROUND',
    'farver/FarveQuizGame.tsx': 'COLORS_QUIZ_ROUND',
    'farver/NuancerGame.tsx': 'NUANCER_ROUND',
    'farver/FarvejagtGame.tsx': 'FARVEJAGT_ROUND',
  }
  for (const [rel, constant] of Object.entries(WINDOW_CONST)) {
    const code = codeOf(rel)
    assert.match(
      code,
      new RegExp(`window:\\s*${constant}\\b`),
      `${rel} must pass window: ${constant} — the same constant its round length reads`,
    )
    // …and that constant really is the round length, not a second number that happens to match.
    assert.match(
      code,
      new RegExp(`length:\\s*${constant}\\b`),
      `${rel}'s RoundConfig must read ${constant} too, or the window and the round can drift apart`,
    )
  }
})

test('the retired anti-repeat mechanisms are GONE, not kept beside the bag', () => {
  // Two mechanisms is how one gets bypassed (PRD §3.2). Each of these bounded ADJACENCY only, and their
  // presence is what made the pool-size fixes look like they should have worked.
  const RETIRED: Record<string, string[]> = {
    'ordleg/LaesOrdetGame.tsx': ['recentRef'],
    'ordleg/SpellingGame.tsx': ['previousWord'],
    'farver/FarveQuizGame.tsx': ['previousObject'],
    'farver/NuancerGame.tsx': ['previousHue'],
    'farver/FarvejagtGame.tsx': ['previousColor'],
  }
  for (const [rel, names] of Object.entries(RETIRED)) {
    const code = codeOf(rel)
    for (const name of names) {
      assert.ok(!code.includes(name), `${rel} still carries ${name} beside the bag`)
    }
  }
})
