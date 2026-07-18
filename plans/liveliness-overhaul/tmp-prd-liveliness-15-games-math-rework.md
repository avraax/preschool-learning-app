# Liveliness PRD-15 — Math games rework (per-game UX + learning)

**Date:** 2026-07-17
**Part of:** Games UX & Learning rework (findings: `tmp-prd-liveliness-13-games-ux-audit.md`; shared keystone:
`tmp-prd-liveliness-14-games-learning-layout-pass.md`).
**Depends on:** **PRD-14 merged first.** This builds on PRD-14's shared vertical-rhythm baseline (W1), its Tal Quiz
near-distractor default (W2), and its Sammenlign caption removal (W5). Implement after PRD-14 is in `master`.
**Owner:** Allan. **Target user:** ~5-year-old boy, iPad, pre-reader; counts ~60–70; **adds to 20 on his fingers**;
basic subtraction. No adaptive difficulty. 44px targets. Danish copy.
**Art:** **none needed** — every change here is CSS/layout/code (ten-frame = CSS dots; crocodile = the existing baked
`crocodile.webp` resized; hundreds-chart = grid change; bigger counting objects = sizing). **Zero Gemini generation.**

> This is the first **grouped** per-game rework PRD (audit §I): one section = one implement session. Math is first
> because it holds the single biggest per-game *learning* gap (Plus/Minus with nothing to count). The other section
> reworks (Farver, English, Alphabet/Ordleg) follow as PRD-16+.

> **LEARNING FIRST.** W1 is the flagship (it changes whether he can *solve* rather than guess). W2–W4 improve
> clarity/pacing. Preserve every invariant: honest counting (Tal Quiz), the equation-reveal POP + krokodille chomp
> animations, numerals stay glyphs, no adaptivity, spoken completed-fact on correct.

---

## 1. Scope (4 workstreams; Math section = Lær Tal, Tal Quiz, Plus, Minus, Sammenlign, Hvad Mangler, Memory Tal)

| WS | Game(s) | Change | Priority |
|---|---|---|---|
| **W1** | **Plus & Minus** (`MathOperationGame`) | Add a **concrete quantity layer** (ten-frame / countable dots) under the number sentence so a finger-counter can actually solve | **HIGH** |
| **W2** | **Sammenlign** (`ComparisonGame`) | **Enlarge + center the crocodile** so the >/< "eats the bigger" mnemonic reads | MED |
| **W3** | **Lær Tal** (`NumberLearning`) | **10-column hundreds-chart** layout (base-10 pattern visible) + range cap so tiles stay ≥44px | MED |
| **W4** | **Tal Quiz** (`MathGame`) | **Scale counting objects up at low n** so the count is the hero (pool not mostly empty) | MED |

Already handled by PRD-14 (do NOT redo): Tal Quiz near-count distractors (W2), Hvad Mangler near-value distractors +
the shared vertical rhythm, Sammenlign caption removal, Memory Tal default→10 pairs. **Hvad Mangler & Memory Tal need
nothing further here.**

## 2. Guardrails
iPad-first no-scroll; 44px; Danish; token-driven (all 4 skins + flat); reduced-motion (motion off, layout + audio
kept); **no new narration** (spoken completed-fact unchanged); no adaptive difficulty; honor `.claude/rules`
(advance-lock/first-try/timer hygiene for the hand-rolled games). **Keep the bespoke animations** — MathOperation's
`?`→answer POP flip and Comparison's krokodille BOUNCE chomp + `sfx('chomp')` must survive. Numerals/digits stay
`Typography` glyphs (the lesson) — never baked art.

## 3. Workstream design

### W1 — Plus & Minus: concrete quantity layer (LEARNING, flagship)
**Problem (PRD-13 §C):** he adds *on his fingers*, but the board is a pure abstract symbol string — and Normal
deliberately produces **crossing-ten** sums (7+9=16) where a finger-counter most needs manipulatives. There is
nothing to count. The spoken fact only lands *after* he's already had to solve it.
**Change:** render a **concrete quantity layer** beneath the number sentence (keep the sentence above it as the
concrete→abstract bridge):
- **Addition** `a + b`: two groups of countable **clay dots / a ten-frame** — `a` dots + `b` dots, visually
  distinct groups (e.g. two accent tints) he can count/combine. A ten-frame (two rows of 5) makes crossing-ten
  legible; for sums ≤20 use one or two ten-frames.
- **Subtraction** `a − b`: `a` dots with `b` of them **crossed out / faded** so "take away" is visible; the
  remaining countable set = the answer.
- Pure CSS (tinted `Box` circles with `softShadow`, or a small ten-frame grid) — **no art**. Reduced-motion: static
  dots (no combine animation).
- Keep the number sentence, the 4 answer tiles, the `?`→green POP reveal, and the spoken completed fact **exactly**
  as they are — this layer is additive.
- Fit it in the focal zone under the equation without scrolling (it lives in PromptFocus's subject slot / the
  equation tile's container — see Appendix). On phone-landscape, shrink the dots or fall back to grouped dots (not a
  full ten-frame) so it still fits.
**Learning check:** the dots must be countable and the two addends visually separable; the layer must not crowd the
answer tiles below 44px. If space is tight on phone, the concrete layer may be smaller but must stay countable.
**Verify:** on iPad, an addition question shows two countable dot-groups summing to the answer; subtraction shows
cross-outs; the `?`→answer POP + spoken fact still fire; no scroll; 44px held; reduced-motion → static.

### W2 — Sammenlign: enlarge + center the crocodile (UX)
**Problem (PRD-13 §C):** the krokodille (the >/< mnemonic's whole point — the mouth "eats" the bigger number) is a
small blob dwarfed by the two side-cards at rest, so the metaphor doesn't teach; the `>` appears as a separate small
tile.
**Change:** make the crocodile the **visual centerpiece** between the two cards — enlarge it and center it in the
gap so at rest it clearly sits *between* the numbers, and the chomp visibly lunges toward/into the bigger card. Keep
the existing `crocodile.webp` (just larger) + the BOUNCE chomp + `sfx('chomp')` + the `>`/`<` SymbolTile spring-in
(consider anchoring the `>` on/near the croc's mouth so symbol + mouth read as one). Pull "Hør igen" up if PRD-14's
vertical-rhythm pass didn't already close the lower band.
**Learning check:** the enlarged croc must not shrink the two tappable number cards below 44px or overlap them at
rest. It's the *mediator* between them, not a cover.
**Verify:** at rest the croc is clearly the star between the cards; on correct it chomps toward the bigger side and
the >/< reads as "the mouth opens to the bigger number"; cards stay ≥44px; all 4 skins.

### W3 — Lær Tal: 10-column hundreds-chart + tap-target fix (LEARNING/UX)
**Problem (PRD-13 §C):** the grid effectively renders ~13 columns, which scrambles the base-10 pattern (10/20/30
don't align), and squeezes tiles below 44px tall. **Root cause:** the number grid uses the **shared `LearningGrid`**
with `gridTemplateColumns: repeat(auto-fit, minmax(72px, 1fr))` (App. §A3) — columns = "however many 72px tracks
fit", not a deliberate 10.
**Change (two files):**
- **`NumberLearning.tsx:96`** — cap the range from `1..100` to ~**1..60** (matched to his ~60–70 ceiling; 71–100 is
  unusable to him and is what forces sub-44px tiles). Owner may keep 100, but 60 is the recommended default.
- **`LearningGrid.tsx`** (App. §A3) — for the **numbers** path only (the `!isAlphabet` branch, line 56), replace the
  `auto-fit` with an explicit **10-column** layout so each column = a units digit / each row = a tens band (the
  hundreds-chart pattern). **Scope it to the numbers branch — leave the `isAlphabet` branch (alphabet browse)
  untouched.** With 1–60 that's 10×6 → tiles comfortably ≥44px, no scroll.
Keep tap-to-hear, the numeral+count-cluster bloom, browse XP.
**Learning check:** the win is the *aligned tens* (base-10 visible); confirm 10, 20, 30… stack in one column.
**Verify:** grid is 10 wide, tens align vertically, tiles ≥44px, no scroll; alphabet browse layout **unchanged**;
tap still speaks + blooms.

### W4 — Tal Quiz: bigger counting objects at low n (UX/LEARNING)
**Problem (PRD-13 §C):** in counting mode (n≤20, objects shown, numeral hidden) the baked objects are small and
centrally clustered in a mostly-empty pool — for a *counting* task the countable objects should own the space.
**Change:** scale the counting objects **up** at low counts (n≤~6) so they fill more of the focal pool and are
easy to count; let the per-object size shrink as n grows (existing shrink-with-count logic, just raise the low-n
ceiling / relax the `maxWidth` clamp). Numeral-recognition mode (large n) unchanged. Keep the honest two-mode design
(never a capped/misleading row).
**Verify:** at n=3 the three objects are large and fill the pool (not tiny in empty space); at n=15+ they still fit;
numeral mode unchanged.

## 4. Danish copy
**None new.** All prompts/echoes/spoken facts reuse existing content.

## 5. Files to touch
- `src/components/math/MathOperationGame.tsx` (W1 — concrete layer under the equation; keep POP + spoken fact)
- `src/components/math/ComparisonGame.tsx` (W2 — enlarge/center crocodile; keep chomp)
- `src/components/math/NumberLearning.tsx` (W3 — range cap 1→60) + `src/components/common/LearningGrid.tsx` (W3 — 10-col numbers branch ONLY; alphabet branch untouched)
- `src/components/math/MathGame.tsx` (W4 — low-n object sizing)
**Reuse:** tactile depth helpers (`softShadow`), `getCategoryTheme('math')`, existing `crocodile.webp` +
`countingObjectArt`, `SymbolTile`, PRD-14's vertical-rhythm baseline.

## 6. Verification (end-to-end)
- `npm run build` + `npm run lint` clean.
- `ui-screenshot`, iPad + phone, all 4 skins: W1 addition dot-groups + subtraction cross-outs render, POP + fact
  intact, no scroll; W2 crocodile is the centerpiece + chomps correctly, cards ≥44px; W3 grid 10-wide, tens aligned,
  tiles ≥44px, no scroll; W4 low-n objects large/countable. Reduced-motion + 0 console errors.
- **Then play-test** — especially W1 (does the ten-frame actually help him solve crossing-ten?) and W3 range.

## Appendix A — verbatim current signatures / anchors (from `master`, pre-PRD-14-merge)
*Re-verify the two PRD-14 overlaps after merge: Tal Quiz `generateOptions` (PRD-14 W2) and Sammenlign caption
removal (PRD-14 W5, `ComparisonGame.tsx:472–474` — that caption is GONE post-PRD-14, so don't re-add it).*

**§A1 — MathOperationGame (W1).** `numberSx`/`symbolSx` **:424–440**. `PromptFocus` wrapper + equation clay tile
**:461–558**: the tile `<Box display:flex alignItems:center gap>` **:478–494** holds `{num1} <SymbolTile op> {num2}
<SymbolTile "="> <?/answer POP>`; numerals `:495/497` (`numberSx`), operators `:496/498`, the `?`→answer
`AnimatePresence`/`motion.POP` **:502–552** (answer branch 504–538, `?` branch 539–550). Answer grid `:569–603`
(`gridTemplateColumns:'repeat(2,1fr)'`, `maxWidth {xs:400…md:600}`). **W1 insert:** make the equation `<Box>`
(**:478**) `flexDirection:'column'` and add a **counter/ten-frame row beneath** the `num1/op/num2/=/?` row (CSS dots;
subtraction = crossed-out); sync a ten-frame fill with the `:502–552` POP. Keep the POP + spoken fact intact.

**§A2 — ComparisonGame (W2).** Pile sizing `imgPileSx(count)` **:66–77**. `renderSide` **:413–479** (AnswerTile →
pile `:429–457` + numeral `:459–471` + **caption `:472–474` — REMOVED by PRD-14 W5**). Arena `subject` = 3-column
flex **:548**: `renderSide('left')` `:549` · **crocodile center column `:553–617`** · `renderSide('right')` `:619`.
Croc box sized by **`fontSize`** (`xs 3.6rem/md 5.5rem`; landscape `xs 3.4rem/md 6.4rem`; phone `2.3rem`) **:562–573**,
`<img src={crocodileArt()} height:'1em'>` **:578–586**; the `>`/`<` `SymbolTile` renders in a SEPARATE box BELOW the
croc **:588–616** (only when `effectiveMouthOpen`), sized `xs52/md76`. Chomp `motion` `animate` x-lunge+scale
**:556–561** (`BOUNCE`). **W2:** raise the croc `fontSize` clamp (**:562–573**) and/or the center column's presence
(**:553**) so it's the centerpiece; optionally anchor the `>`/`<` on/near the mouth (currently below). Keep the
`BOUNCE` chomp + `sfx('chomp')`; don't shrink the side `AnswerTile`s below 44px.

**§A3 — Lær Tal grid (W3).** Range in `NumberLearning.tsx:96` `Array.from({length:100})` → change to 60. Grid is the
shared `LearningGrid` (invoked `NumberLearning.tsx:240–247`). Column layout in **`LearningGrid.tsx`** grid `<Box>`
**:46–91**: `gridTemplateColumns` **:49–56** = `isAlphabet ? {responsive 6/7/8/10} : 'repeat(auto-fit, minmax(72px,
1fr))'` (numbers = the auto-fit `else`, **:56**); tile `maxHeight` **:63–65**; phone-landscape numbers override
`minmax(42px,1fr)` **:74–78**. `isAlphabet = items.length === 29`. **W3:** in the `!isAlphabet` branch only, set an
explicit `repeat(10, 1fr)` (with a phone fallback); **do not touch the `isAlphabet` branch**.

**§A4 — Tal Quiz hero (W4).** `heroObjectFontSize(n)` **:55–56** (`≤8→clamp(1.3rem,5vh,2.2rem)`, `≤14→…`, else `…`);
phone `HERO_OBJECT_PHONE_SIZE` **:57**. `renderCountingHero` **:62–125**: numeral branch (n>20) **:66–82**; counting
pool **:86–123** = wrap-flex `flexWrap:'wrap'`, centered, `gap xs4/md6`, **`maxWidth:520`** **:97**, `overflow:hidden`;
per-object `<img height={heroObjectFontSize(n)}>` **:104–121**. Mode split `isCountingMode(n)` = `n≤20`
(`COUNT_OBJECTS_MAX=20` **:24**); wired `renderHero: renderCountingHero` **:167**. **W4:** raise the low-n branch of
`heroObjectFontSize` (**:55–56**) and relax `maxWidth:520` (**:97**) so n≤~6 objects fill the pool; optionally group
into rows/dice-faces (replace the `:87–102` wrap container). Keep the honest two-mode split (no object row for n>20,
comment **:19–24**).

---
*End PRD-15. Implement after PRD-14 merges; art-free; verify + play-test, then PRD-16 (next section) is authored.*
