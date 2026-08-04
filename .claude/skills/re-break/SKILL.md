---
name: re-break
description: Prove a new or changed test actually catches the bug it was written for, by mechanically re-breaking each invariant and requiring THAT test to go red. Use whenever you have just added or tightened a test, guard, invariant or probe — after fixing a bug, after writing a coverage/pin test, before reporting "verified" or "tests pass" on a fix. Also use when a suite is suspiciously green, or when you need to show which assertions are load-bearing versus vacuous.
---

# Re-break: prove the test is load-bearing

CLAUDE.md mandates this after every bug fix — *"re-break the code to prove the new test/probe actually
fails"*. This skill is the mechanical form, because doing it by hand is where it goes wrong: it's easy to
break something adjacent, watch the suite go red, and record a pass that proved nothing.

## The rule being enforced

For each invariant you claim to have pinned:

1. Break **exactly what that test MEASURES** — not a neighbour, not the whole module.
2. Run **only that test file**.
3. Require the **specific test** to be the one that flips. A red suite is not enough.
4. Restore the file byte-for-byte and move on.

Three outcomes, and two of them are failures:

| Result | Meaning |
|---|---|
| the expected test goes red | the assertion is load-bearing |
| a *different* test goes red | your break missed the measured thing — re-target it |
| everything stays green | **VACUOUS** — the test does not measure what you think. Fix the test, not the break |

The third outcome is the whole point. It has caught real vacuity here: a pinned "sequence count" that a
Normal-level change couldn't move (the union is defined by Svær), and two tests that survived a hand
re-break pass in the accounts session.

## "Everything stayed green" has THREE explanations — rule out two before blaming the test

1. **The mutation never arrived.** For a source test the harness proves this itself (a missed anchor
   must exit non-zero). For a headless probe nothing does, so **read the mutated value back in the same
   run** — `getComputedStyle(el).pointerEvents`, the computed `padding-bottom`, whatever the break
   touched — and only then interpret the result. Assuming the dev server served your edit is how a
   fine test gets rewritten.
2. **The fix is real but no longer LOAD-BEARING.** Two fixes survived their own re-break in one session
   because the geometry they protected had since changed: a corner-companion overlap fix whose tiles
   were later shrunk on owner feedback (the 94×34px overlap stopped reproducing), and a
   `pointer-events: none` on scaled art whose neighbour turned out to win the hit-test anyway on
   `z-index`. Neither test was vacuous and neither fix was wrong — the *justification written in the
   comment* was. **This is a finding, not a failure.** Keep a cheap forward-looking guard, and say
   *defensive* in the comment instead of implying it currently prevents something; an overstated
   comment is exactly what misleads the next session into trusting protection it doesn't have.
   To show such a guard is still worth keeping, re-break the CONDITION rather than the fix — restoring
   the old geometry reproduced the original overlap byte-for-byte and proved the assertion can fire.
3. **The MUTATION is non-deterministic, not the test.** A break that reverses a two-element ordering is
   50/50 under a fixed seed, so it can produce the correct answer by luck and read as VACUOUS. Before
   rewriting a test, check the mutation can only ever be WRONG (`[...lead].reverse()` beats
   `filter(...).reverse()`); re-run it once more if in doubt.
4. **Only then**: the test is vacuous. Fix the test, not the break.

## Doing it

Write a throwaway harness (scratchpad, not the repo) holding a table of
`{ name, file, from, to, expect, testFile? }` — `from`/`to` are exact string swaps, `expect` is a
substring of the test's *name*. For each entry: read the file, assert the anchor exists (a missed anchor
is a silent skip — count it as a failure), write the mutation, run `node --test <testFile>`, restore the
original, then check the red lines for `expect`. Exit non-zero unless every entry flipped its own test.
Run it from the **repo root** — relative paths break otherwise, and a mid-run crash can leave a file
mutated.

**Every source file in this repo is CRLF**, so a multi-line `from` written with `\n` never matches and
the entry silently skips — 5 of 22 breaks vanished that way in one pass, and the harness still printed a
pass rate. Normalise both sides to the file's own endings (`s.replace(/\r?\n/g, '\r\n')` when the file
contains `\r\n`), and make a missed anchor exit non-zero rather than log-and-continue.
**The same trap lives in the TEST**, not just the harness: a source-reading guard whose own multi-line
anchor is written with `\n` never matches, and the assertion that fires is "could not find X — re-point
this guard" rather than the defect. Normalise in the `codeOf` helper (`.replace(/\r\n/g, '\n')` alongside
the comment-stripping) so every anchor in that file can be written naturally.

Prefer breaking **both** sides where an invariant spans two layers: mutate the *table* for one entry and
the *generator* for another. A table-only break can pass while the code ignores the table entirely.

## Two shapes of vacuity this has caught (look for them in your own guards)

- **A regex the target's own syntax closes early.** A source-text guard matched
  `label=\{([^}]*)\}` to forbid a denominator — but a template literal's own `${…}` closes `[^}]*`, so
  `` label={`${n} / ${TOTAL}`} `` captured just `` `${n `` and the guard passed against the exact string
  it existed to forbid. Any `[^X]*` capture over code containing `X` is suspect; anchor on the real
  delimiters (backticks here) instead. This is why the break must produce the *forbidden* value rather
  than something merely different.
- **MATCH-COUNT vacuity: the rule covers N branches, the regex captures the first.** A guard asserting
  the ceremony's scrim is near-solid anchored on `background: dark …` and stopped at the first
  `100%)'` — which is the DARK gradient. Reverting the **light** one stayed green, and the light case was
  the actual defect (cream-on-cream, the menu readable straight through). Whenever a rule applies to a
  light/dark pair, an `if/else`, or a per-skin table, use a `/g` match and **assert the expected count**
  (`assert.equal(matches.length, 2)`) before checking the values — otherwise half the rule is unguarded
  and the suite looks fine. Then break EACH branch separately, not just the convenient one.
- **A break that accidentally satisfies the pattern.** `/<StickerReveal[\s\S]*badge=\{/` was meant to
  prove the count sits on the frame; the mutation `badge={` → `data-not-a-badge={` still *contains*
  `badge={`, so the guard stayed green and read as vacuous when it was merely loose. Require the real
  delimiter (`\sbadge=`). Corollary: when a break appears to prove vacuity, first check the mutated text
  doesn't still match.
- **A lazy `[\s\S]*?` escapes the block you meant to guard.** `/registerHintWrong\(…\)\) \{[\s\S]*?speak\(/`
  was meant to prove the line is spoken *inside* the hint branch — but the lazy match happily crosses the
  branch's closing brace, so moving the speak OUT to fire on every wrong answer stayed green. A regex
  cannot see block structure: **slice the block first** (`indexOf(opener)` → `indexOf('\n      }')`) and
  assert against that substring. Suspect any `[\s\S]*?` that spans what should be one branch.
- **Two loose `includes` where the invariant is a COMPOSITION.** "The file mentions `usePromptBag`" +
  "the file mentions `colorQuizPromptPool(`" both survived replacing the draw with
  `colorQuizPromptPool(level)[0]` — the tokens were still there, the feature was gone. Assert the composed
  call (`.draw(colorQuizPromptPool(`), i.e. the thing that can only be true if the wiring exists.
- **Breaking HALF of a removed mechanism, when only the whole is observable.** Deleting a gold-pass wrap
  looked untested: re-adding the wrap alone changed nothing, because the same commit had also pinned the
  duplicate `count` at 1, so a re-visited slot just rewrote its own entry. The invariant was real; the
  mutation was half. Restore the entire mechanism (wrap **and** the counting) and it flips. If a break
  produces no observable difference, ask whether the mechanism has more than one part before concluding
  the test is vacuous.

## Anchors worth targeting in this repo

- A tuning/parameter table (`src/config/difficulty.ts`) — flip one level's value.
- A pure generator (`src/config/mathProblems.ts`) — remove the clamp/branch the invariant names.
- A derived range (`sequenceStarts`) — truncate it, to prove prebake coverage is really asserted.
- A shared data list — insert a value that violates the rule (an unspellable word, a missing art id).

## Non-test probes

The same discipline applies to headless probes, which fail differently: they report success against a
page that never rendered. Prove the probe's guards fire — a deliberately wrong expected element count,
and `?crash-test=1` — before trusting a sweep. See `.claude/skills/ui-screenshot/SKILL.md`.

## Reporting

Say how many invariants were re-broken and that each flipped **its own** test. If you replaced a vacuous
break, say so and what you replaced it with — that is the finding, not an embarrassment.
