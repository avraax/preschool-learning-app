import { test } from 'node:test'
import assert from 'node:assert/strict'

// PRD session-01 W4 — the guardrail context budget, as a failing test rather than an advisory script.
//
// Sessions in this repo started at 56-63k tokens before the first request did anything, ~21,400 of
// which were ours, and opening one game component injected a further ~40,400 tokens of rules. That
// regrew over weeks of debriefs, one paragraph at a time, with nothing to notice. This test is what
// notices.
//
// The report is `npm run context:check`; the logic is in `scripts/context-budget.mjs` (standalone
// .mjs, no `.ts` imports, so it also runs under plain `node`).
//
// THE TRAP THIS TEST IS MOST EXPOSED TO: it reads its own inputs from `.claude/**`, so any budget
// derived from the current file sizes would move with the thing it measures and pass vacuously. So
// the numbers are pinned as literals HERE as well as in the script, and the two must agree. Raising
// a budget means editing this file, which means saying so in a commit.
//
// THIS TEST CAN GO RED WITHOUT ANYONE TOUCHING A GUARDRAIL. The glob check counts how many repo files
// a rule's `paths:` match, so *adding source files* under an existing glob trips it — a pure code
// refactor that split `src/components/auth/**` into more, smaller files pushed `auth.md` past its
// ceiling and left master red, with nothing in `.claude/**` changed. Read the violation line before
// assuming the failure is yours: it names the rule, and the fix is usually a
// `GLOB_CEILING_OVERRIDES` entry in the script, never a higher `ruleGlobMatchCeiling`.

// @ts-expect-error - plain .mjs helper, no type declarations
import { BUDGETS, UNSCOPED_ALLOWLIST, collect, check } from '../../scripts/context-budget.mjs'

test('the guardrail surface is inside its budget', () => {
  const violations: string[] = check(collect())
  assert.deepEqual(
    violations,
    [],
    'context budget exceeded:\n  - ' + violations.join('\n  - ')
      + '\n\nMove detail into a path-scoped rule rather than raising a budget.',
  )
})

test('the budgets are the pinned literals, not whatever the files currently are', () => {
  // If a change needs one of these to move, move it deliberately here and in the script.
  assert.deepEqual(BUDGETS, {
    claudeMd: 12_000,
    componentGlobRuleMax: 6_000,
    alwaysLoadedTotal: 17_000,
    componentEditTotal: 48_000,
    skillBodyLines: 500,
    skillDescriptionChars: 1_024,
    ruleGlobMatchCeiling: 40,
  })
})

test('the unscoped-rule allowlist stays at exactly one reasoned entry', () => {
  // A rule with no `paths:` is loaded into every session about anything. This list is the thing that
  // regrows first, so it is pinned by NAME, not merely by length.
  const names = Object.keys(UNSCOPED_ALLOWLIST as Record<string, unknown>)
  assert.deepEqual(names, ['working-in-this-tree.md'])
  for (const n of names) {
    const entry = (UNSCOPED_ALLOWLIST as Record<string, { max: number, reason: string }>)[n]
    assert.ok(entry.max > 0, `${n} needs a byte cap`)
    assert.ok(entry.reason.length > 40, `${n} needs a real reason, not a placeholder`)
  }
})

test('both component-glob rules exist and are the only ones claiming it', () => {
  // The component glob is paid on the single most common edit in the repo. Two small rules own it by
  // design; a third, or either growing past 6 KB, is the regression this whole PRD was about.
  const { rules } = collect() as { rules: Array<{ file: string, globs: string[], bytes: number }> }
  const owners = rules.filter((r) => r.globs.includes('src/components/**/*.tsx')).map((r) => r.file)
  assert.deepEqual(owners.sort(), ['audio-call-sites.md', 'layout-contract.md'])
})
