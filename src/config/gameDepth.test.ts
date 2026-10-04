// Game Depth PRD-01 — the guards for the new task shapes and content (plans/game-depth/).
//
// Three kinds of guard, for the reason `game-development.md` gives: a data test cannot see whether a
// component USES the data, so every new shape is pinned (1) as the exact spoken string, (2) as
// enumerated for prebake (a missed clip is SILENCE for a guest), and (3) as source wiring.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { colorMixQuestionText } from './gamePhrases.ts'
import {
  possibleTargets,
  recipeNamesFor,
  reverseChoicesFor,
  REVERSE_CHOICES,
  mixingRules,
  TARGET_PRIORITY,
} from './colorMixing.ts'
import { COLORS_RAMFARVEN, LEVELS } from './difficulty.ts'
import { collectNarrationClips } from '../../shared-narration-clips.js'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const enumerated = (): Set<string> =>
  new Set(collectNarrationClips().map((c: { text: string }) => c.text))

// ---- Ram Farven — the reverse task (§3.3) -------------------------------------------------------------

test('Ram Farven reverse: the question is exactly this, one per goal, all enumerated', () => {
  assert.equal(colorMixQuestionText('rød', 'blå'), 'rød og blå, hvad bliver det?')
  assert.deepEqual(recipeNamesFor('lilla'), ['rød', 'blå'])
  const all = enumerated()
  for (const tgt of possibleTargets) {
    const pair = recipeNamesFor(tgt.name)
    assert.ok(pair, `${tgt.name} has no recipe`)
    // The recipe really makes the goal (order-independent rule table).
    assert.equal(mixingRules[`${pair[0]}+${pair[1]}`].name, tgt.name)
    const q = colorMixQuestionText(pair[0], pair[1])
    assert.ok(all.has(q), `missing prebake clip: "${q}"`)
  }
})

test('Ram Farven reverse: 3 distinct choices, the goal always among them, all from the level pool', () => {
  assert.equal(REVERSE_CHOICES, 3)
  for (const level of LEVELS) {
    const pool = TARGET_PRIORITY.slice(0, COLORS_RAMFARVEN[level].targets)
    for (let s = 1; s < 200; s++) {
      const goal = pool[s % pool.length]
      const choices = reverseChoicesFor(goal, pool, seeded(s * 31 + level.length))
      assert.equal(choices.length, 3)
      assert.equal(new Set(choices).size, 3, `${level}: duplicate choice ${choices}`)
      assert.ok(choices.includes(goal))
      for (const c of choices) assert.ok(pool.includes(c), `${level}: ${c} is outside the level pool`)
    }
  }
})

test('Ram Farven reverse: never at Let, about 1 in 3 above it', () => {
  assert.equal(COLORS_RAMFARVEN.let.reverse, 0)
  assert.deepEqual(COLORS_RAMFARVEN.normal.reverse, { alt: 1, of: 3 })
  assert.deepEqual(COLORS_RAMFARVEN.svaer.reverse, { alt: 1, of: 3 })
})

test('Ram Farven reverse never puts the answer on the board', () => {
  const code = codeOf('components/farver/RamFarvenGame.tsx')
  // The goal swatch is replaced by the two droplets on a reverse task…
  assert.match(code, /mode === 'reverse' && reversePair \?/)
  // …the "Mål" chip is hidden (not removed — the geometry stays put)…
  assert.match(code, /visibility: mode === 'reverse' \? 'hidden' : 'visible'/)
  // …the halo behind it is not tinted with the goal…
  assert.match(code, /const goalTint = mode === 'reverse' \? '#94A3B8' : targetColor\.hex/)
  assert.doesNotMatch(code, /hexToRgba\(targetColor\.hex, 0\.24\)/)
  // …the pale ring (which only appears for pale GOALS) can't leak it either…
  assert.match(code, /const isPaleTarget = mode === 'mix' &&/)
  // …and tapping the left circle repeats the question instead of naming the goal.
  assert.match(code, /if \(mode === 'reverse'\) \{\s*void speakInstruction\(targetColor\.name, 'reverse'\)/)
  // Both gestures through ONE resolve function.
  assert.match(code, /onActivate=\{\(\) => resolveSwatch\(choice\.name, true\)\}/)
  assert.match(code, /if \(id\.startsWith\(SWATCH_PREFIX\)\) resolveSwatch\(/)
  // "Hør igen", the welcome tail and the first voicing share one instruction helper.
  assert.equal((code.match(/speakColorMixingInstructions\(/g) ?? []).length, 1)
})

test('Ram Farven fits a 375 px portrait phone and keeps its tray clear of the corner mascot', () => {
  // Both pre-existing, found in the Game Depth PRD-01 sweep: the bench row measured ~434 px against a
  // 375 px phone (the pot ran off the right edge), and the 5-droplet tray sat under the tappable mascot.
  const code = codeOf('components/farver/RamFarvenGame.tsx')
  assert.match(code, /\[PHONE_PORTRAIT\]: \{ width: 112, height: 112 \}/)
  assert.match(code, /\[PHONE_PORTRAIT\]: \{ pb: `\$\{MASCOT_CORNER_PHONE_PORTRAIT \+ 6\}px` \}/)
})
