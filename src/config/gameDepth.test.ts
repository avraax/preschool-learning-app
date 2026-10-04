// Game Depth PRD-01 — the guards for the new task shapes and content (plans/game-depth/).
//
// Three kinds of guard, for the reason `game-development.md` gives: a data test cannot see whether a
// component USES the data, so every new shape is pinned (1) as the exact spoken string, (2) as
// enumerated for prebake (a missed clip is SILENCE for a guest), and (3) as source wiring.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COMPARE_SMALLER_PROMPT, colorMixQuestionText, comparisonPairs, comparisonSmallerFactText, mathFactText, mathMissingPromptText, missingPairs } from './gamePhrases.ts'
import { makeMissingProblem, missingDistractors } from './mathProblems.ts'
import {
  possibleTargets,
  recipeNamesFor,
  reverseChoicesFor,
  REVERSE_CHOICES,
  mixingRules,
  TARGET_PRIORITY,
} from './colorMixing.ts'
import { COLORS_RAMFARVEN, LEVELS, MATH_ADDITION, MATH_COMPARISON, MATH_SUBTRACTION, MEMORY_BOARD, MEMORY_CLUSTER_MAX, ORDLEG_SPELL, memoryNumbersFor } from './difficulty.ts'
import { getDanishNumberText } from './danish-phrases.ts'
import { READING_MAX_LEN, READING_ROUND_LENGTH, READING_WORDS, SPELLING_ALPHABET, makeMissingLetterTask, spellingWordsFor } from './ordlegWords.ts'
import { readingPromptPool } from './promptPools.ts'
import { confusablePoolFor } from './letterConfusables.ts'
import { LETTER_QUIZ_WORDS, LETTER_WORDS, WORD_LETTERS, startsWithPhrase, startsWithQuestion } from './letterWords.ts'
import { alphabetHintLine } from './hintLines.ts'
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

// ---- Stav Ordet Let — one missing letter (§3.4) -----------------------------------------------------

test('a missing-letter task has one blank, its answer in a 3-tile tray, and no distractor that could also fit', () => {
  for (const w of spellingWordsFor('let')) {
    for (let s = 1; s < 25; s++) {
      const t = makeMissingLetterTask(w.word, ORDLEG_SPELL.let.distractors, confusablePoolFor, seeded(s * 97 + w.word.length))
      assert.deepEqual(t.letters, w.word.toUpperCase().split(''))
      assert.ok(t.blankIndex >= 0 && t.blankIndex < t.letters.length)
      const answer = t.letters[t.blankIndex]
      assert.equal(t.tiles.length, 3, `${w.word}: tray ${t.tiles}`)
      assert.equal(t.tiles.filter((x) => x === answer).length, 1, `${w.word}: answer missing or doubled`)
      for (const d of t.tiles.filter((x) => x !== answer)) {
        assert.ok(!t.letters.includes(d), `${w.word}: distractor ${d} is in the word`)
        assert.ok(!confusablePoolFor(answer).includes(d), `${w.word}: ${d} is confusable with ${answer}`)
        assert.ok(SPELLING_ALPHABET.includes(d))
      }
    }
  }
  // The blank moves around (not always the first letter).
  const positions = new Set<number>()
  for (let s = 1; s < 40; s++) positions.add(makeMissingLetterTask('sol', 2, confusablePoolFor, seeded(s)).blankIndex)
  assert.equal(positions.size, 3)
})

test('Stav Ordet wires the missing-letter task at Let and keeps full spelling above it', () => {
  assert.equal(ORDLEG_SPELL.let.mode, 'missing')
  assert.equal(ORDLEG_SPELL.normal.mode, 'full')
  assert.equal(ORDLEG_SPELL.svaer.mode, 'full')
  const code = codeOf('components/ordleg/SpellingGame.tsx')
  assert.match(code, /if \(mode === 'missing'\) \{\s*const task = makeMissingLetterTask\(/)
  assert.match(code, /const expectedLetter = blankIndex !== null \? targetLetters\[blankIndex\] : targetLetters\[filledCount\]/)
  // The one correct letter completes the word on the gap task.
  assert.match(code, /const newFilled = blankIndex !== null \? targetLetters\.length : filledCount \+ 1/)
})

// ---- Læs Ordet — a wider Let, a bigger pool (§3.5) --------------------------------------------------

test('Læs Ordet: Let asks the easy tier, Normal/Svær the whole pool, nothing longer than 3 letters', () => {
  assert.equal(READING_MAX_LEN, 3)
  for (const w of READING_WORDS) assert.ok(w.word.length <= READING_MAX_LEN, `"${w.word}" is too long`)
  // The easy tier by name — it is a judgement about Danish spelling, so it may not move silently.
  assert.deepEqual(
    readingPromptPool('let').map((w) => w.word).sort(),
    ['bi', 'bil', 'bus', 'hat', 'hus', 'is', 'kat', 'ko', 'mus', 'ost', 'ski', 'sko', 'so', 'sol', 'sø', 'te', 'ur', 'æg', 'ål'].sort(),
  )
  assert.equal(readingPromptPool('normal').length, 35)
  assert.deepEqual(readingPromptPool('svaer'), readingPromptPool('normal'))
  for (const level of LEVELS) assert.ok(readingPromptPool(level).length >= READING_ROUND_LENGTH)
  // The excluded ones stay excluded (abstract / a whole-child picture).
  for (const banned of ['hej', 'fod', 'ben', 'arm', 'kop']) assert.ok(!READING_WORDS.some((w) => w.word === banned))
})

test('every Læs Ordet word resolves to a baked picture, and its spoken name is enumerated', () => {
  // ordlegArt falls back ordleg → shared → english; mirror that on disk (Node can't run the glob).
  const dirs = ['ordleg', 'shared', 'english'].map((d) => path.join(SRC, 'assets/games', d))
  const all = enumerated()
  for (const w of READING_WORDS) {
    assert.ok(dirs.some((d) => existsSync(path.join(d, `${w.art}.webp`))), `${w.word}: no art "${w.art}"`)
    assert.ok(all.has(w.word), `${w.word}: its spoken name is not enumerated`)
  }
})

// ---- Bogstav Quiz — several pictures per letter (§3.6) ----------------------------------------------

const artFileFor = (ref: string): string => {
  const [dir, id] = ref.split('/')
  const stem = dir === 'alphabet' ? ({ Æ: 'AE', Ø: 'OE', Å: 'AA' } as Record<string, string>)[id] ?? id : id
  return path.join(SRC, 'assets/games', dir, `${stem}.webp`)
}

test('every quiz word starts with its letter, entry 0 is the canonical word, and its picture exists', () => {
  let total = 0
  for (const letter of WORD_LETTERS) {
    const words = LETTER_QUIZ_WORDS[letter]
    assert.ok(words && words.length >= 1, `${letter} has no quiz words`)
    assert.equal(words[0].word, LETTER_WORDS[letter].word, `${letter}: entry 0 must be the canonical word`)
    assert.equal(words[0].art, `alphabet/${letter}`)
    assert.equal(new Set(words.map((w) => w.word)).size, words.length, `${letter}: duplicate word`)
    for (const q of words) {
      assert.equal(q.word[0].toUpperCase(), letter, `${q.word} does not start with ${letter}`)
      // Silent H (hj-/hv-) would teach the wrong first sound.
      assert.ok(!/^h[jv]/i.test(q.word), `${q.word}: silent H`)
      assert.ok(existsSync(artFileFor(q.art)), `${q.word}: no picture at ${q.art}`)
      total++
    }
  }
  // Pinned so a list that silently empties fails: 28 canonical + 31 extra.
  assert.equal(total, 59)
  // No picture is shown for two different letters (that would teach one picture two first sounds).
  const arts = WORD_LETTERS.flatMap((l) => LETTER_QUIZ_WORDS[l].map((q) => q.art))
  assert.equal(new Set(arts).size, arts.length)
})

test('every quiz word speaks a baked question, fact and hint — never live Azure', () => {
  const all = enumerated()
  for (const letter of WORD_LETTERS) {
    for (const q of LETTER_QUIZ_WORDS[letter]) {
      for (const line of [startsWithQuestion(q.word), startsWithPhrase(letter, q.word), alphabetHintLine(letter, q.word)]) {
        assert.ok(all.has(line), `missing prebake clip: "${line}"`)
      }
    }
  }
  // The hint names the picture ON SCREEN, not the letter's canonical word.
  assert.equal(alphabetHintLine('G', 'Gris'), 'Gris starter med G')
})

test('Bogstav Quiz shows the rotated word and speaks THAT word in its fact and hint', () => {
  const code = codeOf('components/alphabet/AlphabetGame.tsx')
  assert.match(code, /const \{ word, art \} = nextWordFor\(letter\)/)
  assert.match(code, /questionVisual: \{ art: wordArt\(art\) \}/)
  assert.match(code, /alphabetHintLine\(item\.value as string, item\.repeatWord\)/)
  assert.match(code, /startsWithPhrase\(item\.value as string, String\(item\.repeatWord\)\)/)
  assert.doesNotMatch(code, /LETTER_WORDS\[/)
})

test('Å shows the eel everywhere the alphabet art is used', () => {
  assert.equal(LETTER_WORDS['Å'].word, 'Ål')
  const a = readFileSync(path.join(SRC, 'assets/games/alphabet/AA.webp'))
  const b = readFileSync(path.join(SRC, 'assets/games/ordleg/aal.webp'))
  assert.ok(a.equals(b), 'alphabet/AA.webp is not the eel picture')
})

// ---- Hukommelse – Tal — range by level (§3.7) -------------------------------------------------------

test('Hukommelse numbers follow the level: 1–10 / 1–20 / 1–30, always at least a board of pairs', () => {
  assert.deepEqual(memoryNumbersFor('let'), Array.from({ length: 10 }, (_, i) => String(i + 1)))
  assert.equal(memoryNumbersFor('normal').length, 20)
  assert.deepEqual(memoryNumbersFor('svaer').slice(-1), ['30'])
  for (const level of LEVELS) assert.ok(memoryNumbersFor(level).length >= MEMORY_BOARD[level].pairs)
  assert.equal(MEMORY_CLUSTER_MAX, 20)
  // Every number a card can show is a baked clip (numbers 0–100 are enumerated).
  const all = enumerated()
  for (const n of memoryNumbersFor('svaer')) assert.ok(all.has(getDanishNumberText(Number(n))))
})

test('the memory board bag rebuilds when the POOL changes, and big numbers drop the cluster', () => {
  const engine = codeOf('components/common/UnifiedMemoryGame.tsx')
  assert.match(engine, /const poolKey = `\$\{config\.gameType\}:\$\{pool\.join\('\|'\)\}`/)
  assert.match(engine, /bagRef\.current\.key !== poolKey/)
  const game = codeOf('components/learning/MemoryGame.tsx')
  assert.match(game, /useMemo\(\(\) => memoryNumbersFor\(level\), \[level\]\)/)
  assert.match(game, /if \(n > MEMORY_CLUSTER_MAX\) return \{ primary: number \}/)
  assert.doesNotMatch(game, /length: 20/)
})

// ---- Plus / Minus — the missing-number form (§3.8) --------------------------------------------------

test('missing-number questions are exactly this, and every one the game can ask is baked', () => {
  assert.equal(mathMissingPromptText('addition', 3, 7), 'tre plus hvad giver syv')
  assert.equal(mathMissingPromptText('subtraction', 7, 3), 'syv minus hvad giver tre')
  const all = enumerated()
  for (const op of ['addition', 'subtraction'] as const) {
    const pairs = new Set(missingPairs(op).map(([a, b]) => `${a},${b}`))
    for (const level of ['normal', 'svaer'] as const) {
      const rnd = seeded(op.length * 1000 + level.length)
      for (let i = 0; i < 4000; i++) {
        const p = makeMissingProblem(op, level, rnd)
        assert.ok(pairs.has(`${p.a},${p.b}`), `${op} ${level}: ${p.a},${p.b} outside missingPairs`)
        const q = mathMissingPromptText(op, p.a, p.answer)
        assert.ok(all.has(q), `missing prebake clip: "${q}"`)
        assert.ok(all.has(mathFactText(op, p.a, p.b, p.answer)))
      }
    }
  }
})

test('missing-number problems keep each level honest', () => {
  const rnd = seeded(4242)
  for (let i = 0; i < 4000; i++) {
    const n = makeMissingProblem('addition', 'normal', rnd)
    assert.ok(n.answer <= 10 && n.a >= 2 && n.b >= 2, `Normal plus ${n.a}+${n.b}`)
    const s = makeMissingProblem('addition', 'svaer', rnd)
    assert.ok(s.answer > 10, `Svær plus must cross: ${s.a}+${s.b}`)
    const m = makeMissingProblem('subtraction', 'normal', rnd)
    assert.ok(m.a < 10 || m.b <= m.a % 10, `Normal minus must not borrow: ${m.a}-${m.b}`)
    assert.ok(m.answer >= 1 && m.b >= 1)
    const ms = makeMissingProblem('subtraction', 'svaer', rnd)
    assert.ok(ms.b > ms.a % 10, `Svær minus must borrow: ${ms.a}-${ms.b}`)
    for (const p of [n, s, m, ms]) {
      const d = missingDistractors(p, 4, rnd)
      assert.equal(d.length, 4)
      assert.equal(new Set(d).size, 4)
      assert.ok(!d.includes(p.b), 'a distractor equals the answer')
      assert.ok(d.every((x) => x >= 1 && x <= 20))
    }
  }
  // Never at Let; exactly 1 in 3 above it.
  for (const t of [MATH_ADDITION, MATH_SUBTRACTION]) {
    assert.equal(t.let.missing, 0)
    assert.deepEqual(t.normal.missing, { alt: 1, of: 3 })
    assert.deepEqual(t.svaer.missing, { alt: 1, of: 3 })
  }
})

test('Plus/Minus moves the ? to the gap and asks the matching question', () => {
  const code = codeOf('components/math/MathOperationGame.tsx')
  assert.match(code, /\{missing \? answerSlot : \(/)
  assert.match(code, /\{missing \? \(\s*<Typography[^>]*>\{total\}<\/Typography>\s*\) : answerSlot\}/)
  assert.match(code, /if \(missingRef\.current\) \{\s*await audio\.speak\(mathMissingPromptText\(/)
  // The correct tap speaks the ordinary fact with the TOTAL, never the hidden number as a total.
  assert.match(code, /factText\(num1, num2, total\)/)
  assert.doesNotMatch(code, /factText\(num1, num2, correctAnswer\)/)
})

// ---- Sammenlign — "tryk på det mindste tal" (§3.9) --------------------------------------------------

test('Sammenlign "mindste": exact strings, Svær only, every fact baked', () => {
  assert.equal(COMPARE_SMALLER_PROMPT, 'Tryk på det mindste tal.')
  assert.equal(comparisonSmallerFactText(9, 10), 'ni er mindre end ti')
  assert.equal(MATH_COMPARISON.let.askSmaller, 0)
  assert.equal(MATH_COMPARISON.normal.askSmaller, 0)
  assert.deepEqual(MATH_COMPARISON.svaer.askSmaller, { alt: 1, of: 3 })
  const all = enumerated()
  assert.ok(all.has(COMPARE_SMALLER_PROMPT))
  for (const [bigger, smaller] of comparisonPairs()) {
    assert.ok(all.has(comparisonSmallerFactText(smaller, bigger)), `missing ${smaller} < ${bigger}`)
  }
})

test('Sammenlign targets the asked side everywhere and asks the matching question', () => {
  const code = codeOf('components/math/ComparisonGame.tsx')
  assert.match(code, /\(p\.leftNumber > p\.rightNumber\) !== smallerTask \? 'left' : 'right'/)
  assert.match(code, /const isCorrect = side === targetSide/)
  assert.match(code, /hint=\{effectiveHint && side === targetSide\}/)
  assert.match(code, /askSmallerRef\.current \? COMPARE_SMALLER_PROMPT : COMPARE_PROMPT/)
  assert.doesNotMatch(code, /biggerSide/)
  // No visual cue for the question (owner): the only new markup is a data attribute.
  assert.doesNotMatch(code, /mindste/i)
})
