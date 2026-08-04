import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADDEND_MAX,
  MINUEND_MAX,
  COMPARE_MAX,
  additionPairs,
  subtractionPairs,
  comparisonPairs,
  mathPromptText,
  mathFactText,
  COMPARE_PROMPT,
  comparisonFactText,
  HVAD_MANGLER_PROMPT,
  sequenceFactText,
  sequenceStarts,
  sequenceNumbers,
  SEQUENCE_LENGTH,
  NUANCER_INSTRUCTION,
  colorMixTargetText,
  colorMixResultText,
  MIC_RETRY_LINE,
  MIC_HOLD_HINT,
  MIC_READY_LINE,
} from './gamePhrases.ts'
import { startsWithQuestion } from './letterWords.ts'
import { possibleTargets, mixingRules } from './colorMixing.ts'
import { collectNarrationClips } from '../../shared-narration-clips.js'

// Two independent guards, because either one alone passes vacuously:
//
//   1. PIN THE STRINGS. The app and the prebake enumerator call the same builders, so a changed
//      builder changes BOTH sides and a pure "they agree" test stays green while every committed clip
//      silently becomes an orphan (the trap called out in CLAUDE.md). So the exact spoken text is
//      asserted literally here.
//   2. COVERAGE. Every problem the games can generate must have its lines enumerated, or that question
//      falls back to live Azure and is never auditioned.

test('spoken math/comparison/sequence/colour lines are exactly these strings', () => {
  assert.equal(mathPromptText('addition', 3, 4), 'Hvad er tre plus fire')
  assert.equal(mathFactText('addition', 3, 4, 7), 'tre plus fire er syv')
  assert.equal(mathPromptText('subtraction', 7, 3), 'Hvad er syv minus tre')
  assert.equal(mathFactText('subtraction', 7, 3, 4), 'syv minus tre er fire')
  // Number 1 stays "en", never "et" (owner ruling, PRD-11) — a change here re-bakes ~200 clips.
  assert.equal(mathPromptText('addition', 1, 1), 'Hvad er en plus en')
  assert.equal(COMPARE_PROMPT, 'Tryk på det største tal.')
  assert.equal(comparisonFactText(17, 9), 'sytten er større end ni')
  assert.equal(HVAD_MANGLER_PROMPT, 'Hvad mangler?')
  assert.equal(sequenceFactText([2, 4, 6, 8, 10]), 'to, fire, seks, otte, ti')
  assert.equal(NUANCER_INSTRUCTION, 'Sæt farverne fra lys til mørk')
  assert.equal(colorMixTargetText('lilla'), 'Lav lilla farve ved at blande farverne')
  assert.equal(colorMixResultText('rød', 'blå', 'lilla'), 'rød og blå bliver lilla')
  assert.equal(startsWithQuestion('Æble'), 'Hvad starter Æble med?')
  // Sig et Ord's coaching lines — a hold-to-talk gesture can only be coached out loud (the child
  // can't read), so these three must be baked, not live.
  assert.equal(MIC_RETRY_LINE, 'Det hørte jeg ikke helt. Prøv igen!')
  assert.equal(MIC_HOLD_HINT, 'Hold knappen nede, mens du siger ordet.')
  assert.equal(MIC_READY_LINE, 'Nu er mikrofonen klar. Prøv igen!')
})

test('the shared bounds match the games ranges', () => {
  // These are the ceilings MathOperationGame/ComparisonGame generate inside. Raising a range in a game
  // without raising the constant here leaves the new questions un-prebaked (live, unauditioned Azure).
  assert.equal(ADDEND_MAX, 10)
  assert.equal(MINUEND_MAX, 20)
  assert.equal(COMPARE_MAX, 20)
  assert.equal(additionPairs().length, 100) // 10 × 10
  assert.equal(subtractionPairs().length, 210) // b ≤ a over a = 1..20
  assert.equal(comparisonPairs().length, 190) // unordered pairs of 1..20
  // No pair may fall outside the bounds, and subtraction never goes negative.
  for (const [a, b] of additionPairs()) assert.ok(a >= 1 && a <= ADDEND_MAX && b >= 1 && b <= ADDEND_MAX)
  for (const [a, b] of subtractionPairs()) assert.ok(b <= a && a <= MINUEND_MAX)
  for (const [big, small] of comparisonPairs()) assert.ok(small < big && big <= COMPARE_MAX)
  // `sequenceStarts` is DERIVED from the difficulty table now (Difficulty PRD-01 W7) — it used to be a
  // hardcoded list of 18 narrow starts whose only skip-10 entry was `{start:10}`. Pin the COUNT and the
  // ceiling here: "the app and the enumerator agree" passes vacuously when both read the same derivation.
  assert.equal(sequenceStarts.length, 109)
  assert.equal(SEQUENCE_LENGTH, 5)
  for (const spec of sequenceStarts) {
    const numbers = sequenceNumbers(spec)
    assert.equal(numbers.length, SEQUENCE_LENGTH)
    assert.ok(Math.max(...numbers) <= 100, `sequence ${spec.start}/${spec.step} runs past 100`)
  }
  // The four steps are all still reachable, with more than one start each past Let.
  for (const step of [1, 2, 5, 10]) {
    const starts = sequenceStarts.filter((s) => s.step === step)
    assert.ok(starts.length > 1, `step ${step} has only ${starts.length} start(s)`)
  }
})

test('every composed game line is enumerated for prebake', () => {
  const enumerated = new Set(collectNarrationClips().map((c: { text: string }) => c.text))
  const want = (text: string) => assert.ok(enumerated.has(text), `missing prebake clip: "${text}"`)

  for (const [a, b] of additionPairs()) {
    want(mathPromptText('addition', a, b))
    want(mathFactText('addition', a, b, a + b))
  }
  for (const [a, b] of subtractionPairs()) {
    want(mathPromptText('subtraction', a, b))
    want(mathFactText('subtraction', a, b, a - b))
  }
  want(COMPARE_PROMPT)
  for (const [big, small] of comparisonPairs()) want(comparisonFactText(big, small))
  want(HVAD_MANGLER_PROMPT)
  for (const spec of sequenceStarts) want(sequenceFactText(sequenceNumbers(spec)))
  want(NUANCER_INSTRUCTION)
  for (const tgt of possibleTargets) want(colorMixTargetText(tgt.name))
  for (const key of Object.keys(mixingRules)) {
    const [c1, c2] = key.split('+')
    want(colorMixResultText(c1, c2, mixingRules[key].name))
  }
  want(MIC_RETRY_LINE)
  want(MIC_HOLD_HINT)
  want(MIC_READY_LINE)
})
