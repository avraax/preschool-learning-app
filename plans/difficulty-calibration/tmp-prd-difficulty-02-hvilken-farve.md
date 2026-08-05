# Difficulty PRD-02 — Hvilken Farve?: the answer never sits on the board

**Date:** 2026-08-05
**Owner:** Allan. **Target user:** ~5-year-old boy, iPad, pre-reader; knows his colours.
**Status:** authored, NOT implemented. Implement in a fresh session.
**Gates:** none. **No new narration** (no prebake, no `/audit` pass), **no new art**, no engine change.
Pure data + one component + guards.

> **The bug this PRD fixes, in one line:** `COLORS_QUIZ.let.reveal === 'colour'` shows the object in its
> TRUE colour, so the fox's orange sits on the board next to the orange swatch and the child wins by
> matching two pixels — the "a board must not restate its own answer" defect the owner has now removed
> three times elsewhere (Tal Quiz's numeral + object row, Bogstav Quiz's hear-the-letter mode). Difficulty
> PRD-01 confined it to Let as "the youngest child's winnable tier". Owner, 2026-08-05: **it must never be
> possible to see the object's colour, at any Sværhedsgrad.**

The reveal axis was also carrying Let's easing, so removing it needs Let re-eased on axes that don't leak
the answer. That is the rest of this PRD.

---

## 1. Owner decisions (2026-08-05)

Asked and answered before authoring — do not re-litigate:

| Question | Ruling |
|---|---|
| Show the true colour at any level? | **Never.** The `reveal` axis is deleted, not narrowed. |
| Svær's swatch count | **Stays 3 / 4 / 5.** (6 = all hues was offered and declined — it needs a 3×2 grid on iPad portrait and makes the hue-distance policy moot.) |
| Does the level narrow WHICH objects are asked? | **Yes** — Let asks only subjects whose colour is unambiguous; Normal/Svær ask all 18. |
| Never-fail hint | **After 1 wrong at Let**, 2 at Normal/Svær. |

## 2. Scope

`src/config/difficulty.ts`, `src/config/colorContent.ts`, `src/config/promptPools.ts`,
`src/components/farver/FarveQuizGame.tsx` and their guards. Nothing else in the Farver section moves.

**Out of scope / non-goals:** the other four Farver games; option counts (stay 3/4/5); round length (8);
`DANISH_OBJECTS` membership, hexes, `objectName`s and spoken echoes (**unchanged — this is what keeps
the change prebake-free**); the drag/tap parity and `kidCollision` behaviour; XP, stars and the reward
path. No adaptivity, as always.

## 3. What the three levels mean after this

| Axis | **Let** | **Normal** | **Svær** |
|---|---|---|---|
| Prompt object | **desaturated** | desaturated | desaturated |
| Swatches | 3 | 4 | 5 |
| Distractor hues | non-adjacent (no near miss on the board) | random | wheel-neighbours FIRST (rød/orange, blå/lilla) |
| Object pool | **12 unambiguous subjects** | all 18 canonical | all 18 canonical |
| Hint names the colour after | **1 wrong** | 2 wrong | 2 wrong |

Three axes still separate every pair of levels, so `difficulty.test.ts`'s distinctness guard holds without
`reveal` (Normal and Svær share pool + hintAfter and differ on options + hues).

**The colour still comes back** on the copy that lands in the correct swatch — with the reveal axis gone
that pop is now the *only* place the child ever sees the object's true colour, at every level. It is the
lesson. Exactly one `desaturate` site, forever.

## 4. Workstreams

### W1 — `src/config/difficulty.ts`: swap the `reveal` axis for `pool` + `hintAfter`

```ts
export interface ColorQuizTuning {
  options: number
  hues: 'non-adjacent' | 'random' | 'adjacent'
  /** Which object pool the level asks from (`colorContent.ts`). */
  pool: ColorPool
  /** Wrong drops before the never-fail hint pulses AND names the colour. */
  hintAfter: number
}

export const COLORS_QUIZ: Record<DifficultyLevel, ColorQuizTuning> = {
  let:    { options: 3, hues: 'non-adjacent', pool: 'obvious', hintAfter: 1 },
  normal: { options: 4, hues: 'random',       pool: 'all',     hintAfter: 2 },
  svaer:  { options: 5, hues: 'adjacent',     pool: 'all',     hintAfter: 2 },
}
```

Rewrite the doc comment above it: the old one explains why Let keeps the visible version, which is now
exactly the thing that must never come back. State the rule instead — the object is always desaturated,
and Let is eased by pool, swatch count, hue distance and an earlier hint.

### W2 — `src/config/colorContent.ts`: `ColorReveal` → `ColorPool`, and an `obvious` flag

- Delete `export type ColorReveal = 'colour' | 'grey'`. Add `export type ColorPool = 'obvious' | 'all'`.
- `quizObjectPool(pool: ColorPool)`: always drops `quizSafe:false` **and** `canonical:false` (18 objects);
  `'obvious'` additionally drops `obvious:false`.
- `ColorObject` gains `obvious?: boolean` — marked `false` on the six below, default-true by omission, the
  same convention as `canonical`. Keep `canonical` as its own flag with its own comment: the two now both
  mean "not askable", but they record different reasons and `canonical` is what documents why bil / rose /
  lastbil / skjorte / krystal / hjerte are gone from this game at every level.

**The Let pool (12).** This is the one thing in the PRD that is a judgment call about a Danish
5-year-old rather than a mechanical consequence — **owner, review the membership before implementing.**

| hue | Let asks | held back to Normal/Svær, and why |
|---|---|---|
| gul | sol, banan, kylling | **majs** — a cob reads yellow-and-green |
| orange | appelsin, gulerod, ræv | **græskar** — pumpkins also come white and green |
| rød | æble, jordbær | — |
| grøn | agurk, træ | **skildpadde** (turtles read brown), **kløver** (unfamiliar subject) |
| blå | blåbær | **hval** — whales read blue-grey |
| lilla | druer | **aubergine** — its colour is not world knowledge at 5 |

12 ≥ the round of 8, and every hue stays askable at Let (blå and lilla sit at a floor of 1 — a further trim
there is a bug, and new canonical art is the fix, mirroring the existing rød/blå/lilla note).

**The six non-canonical objects leave `colors.quiz` at every level** (they were only ever askable in colour
mode). They stay in `DANISH_OBJECTS` and are still used by Farvejagt and Lær Farver, so **no narration clip
is orphaned** — nothing to prebake, nothing to prune, no audit pass.

### W3 — `src/config/promptPools.ts`

`colorQuizPromptPool(level) = quizObjectPool(COLORS_QUIZ[level].pool)`. Same shape as today, one field
renamed; the `PROMPT_POOLS` spec and `quizObjectKey` are untouched. The bag's window is already
`COLORS_QUIZ_ROUND`.

### W4 — `src/components/farver/FarveQuizGame.tsx`

- **Delete the `greyObject` state and `setGreyObject`.** `<ObjectArt … desaturate />` — a bare prop, no
  expression, so nothing can re-condition it on a level without failing W5's guard. The absorbed copy in
  the swatch keeps no `desaturate` at all.
- `setupQuestion` destructures `{ options: optionCount, hues }` only; the pool still comes from
  `colorQuizPromptPool(level)`.
- Hoist the existing `useDifficulty('colors')` call above the hint hook and pass the threshold:
  `useNeverFailHint<string>(COLORS_QUIZ[difficultyLevel].hintAfter)`. Delete `WRONG_BEFORE_HINT`.
  (`useNeverFailHint` lists `threshold` in `registerWrong`'s deps, so a live level change takes effect
  without a remount — and the existing live-difficulty effect already regenerates the question.)
- Rewrite the two block comments that explain grey-above-Let (top of file, and the one on the `ObjectArt`).
  They are load-bearing prose: the next session reads them, and a stale "only above Let" is how this
  regresses.
- **The prompt object is now the whole question at every level, so keep it the biggest thing on the
  board.** The `PHONE_LANDSCAPE`-scoped sizing (112/140px, 80px on phones) already exists for exactly that
  reason — don't let a bare `orientation: landscape` query back in.

### W5 — Guards

`src/config/colorContent.test.ts` — four edits, keeping each test's existing shape:
- "the grey pool holds every canonical object and nothing else" → pin **24** objects in `DANISH_OBJECTS`,
  **18** askable (`'all'`), **12** at `'obvious'`, all as literals; keep the by-name `dropped` assertion for
  the six non-canonical ones and add the by-name list of the six held back from Let.
- "every hue stays askable" → assert per-hue counts for BOTH pools (`{rød:2, blå:2, grøn:4, gul:4, lilla:2,
  orange:4}` and `{rød:2, blå:1, grøn:2, gul:3, lilla:1, orange:3}`), and both `>= COLORS_QUIZ_ROUND`.
- "only the easiest level may show the object in its true colour" → **invert it**: no level may carry a
  colour-reveal mode. Assert `COLORS_QUIZ[level]` has no `reveal` key at any level and that the string
  `'colour'` does not appear as a tuning value — the point is that re-adding the axis fails a test rather
  than passing silently.
- the source-read guard (comments stripped, via `codeOf`) → keep `colorQuizPromptPool(level)`; replace
  `/reveal\s*}\s*=\s*COLORS_QUIZ\[/` with a check that the pool still follows `COLORS_QUIZ[level].pool` for
  all three levels; keep **exactly one** `desaturate` occurrence and assert it is the **bare** prop
  (`assert.doesNotMatch(code, /desaturate\s*=/)` — an `=` means someone made it conditional again); add
  `hintAfter` → `useNeverFailHint` wiring and assert `WRONG_BEFORE_HINT` is gone.

`src/config/difficulty.test.ts` — update the `COLORS_QUIZ` deepEqual pin to the new four-field table and
rewrite its comment (`reveal` is currently called "the load-bearing one"). `OPTION_COUNTS`'s
`'colors.quiz': [3, 4, 5]` is unchanged.

### W6 — Docs

- `.claude/rules/games-catalog.md`, Farver section: "**above Let** the object is DESATURATED" → always,
  and record the new Let easing axes. Its "A BOARD MUST NOT RESTATE ITS OWN ANSWER" paragraph gains the
  fourth instance being closed rather than confined.
- `src/config/difficulty.ts` and `colorContent.ts` doc comments (W1/W2 above).
- Re-capture `docs/ui-reference/` for Hvilken Farve? at Let — its board changes visibly.

## 5. Verification

- `npm test` · `npm run lint` · `npm run build` (don't commit `version.ts` churn).
- **Rung 1** (`.claude/skills/ui-screenshot/`): drive Hvilken Farve? at all three levels — assert the
  prompt object renders desaturated at **Let**, the swatch count is 3/4/5, and one wrong drop at Let pulses
  the correct swatch (the hint threshold is the one change no source guard can prove behaves).
  Positive control: a correct drop still absorbs the object **in full colour**.
- **Sample the generators, don't read the table** (CLAUDE.md): sample Let questions and assert every drawn
  object is in the 12, and that no distractor is a wheel neighbour of the answer.
- **`/re-break`**, one invariant at a time — each mutation must flip *that* test:
  1. `desaturate` → `desaturate={someLevelCheck}` (the wiring guard's bare-prop assertion).
  2. Flip one held-back object's `obvious` back to true (the Let by-name pin).
  3. `let.pool = 'all'` (the table pin + the Let per-hue counts).
  4. `let.hintAfter = 2` (the table pin — and the rung-1 probe above).
  5. Re-add `reveal: 'colour'` to `let` (the inverted reveal test).

## 6. Risks

- **Let is genuinely harder than today** — option count is a weaker easing than "the answer is on the
  board". Expect a play-test ruling; the cheapest further levers, in order, are Let's pool membership
  (§W2's table), then dropping Let to 2 swatches. Do NOT reach for a partial colour hint on the object.
- The 12-object Let pool is a judgment call, not a measurement. It is the first thing to adjust after the
  owner plays it, and the by-name guard is what makes an adjustment a visible, deliberate edit.
