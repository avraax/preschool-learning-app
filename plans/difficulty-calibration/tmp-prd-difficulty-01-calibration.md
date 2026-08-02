# Difficulty PRD-01 — Sværhedsgrad calibration & alignment across all games

**Date:** 2026-08-02
**Owner:** Allan. **Target user:** ~5-year-old boy, iPad, pre-reader; counts ~60–70; **adds to 20 on his
fingers**; basic subtraction; knows every letter. Danish copy, 44px targets, iPad-first no-scroll.
**Art:** one optional gate only (4-letter Stav Ordet subjects, §6). Everything else is code/data.
**Prebake:** one gate (the widened Hvad Mangler read-backs, §6). Math ops / numbers / comparisons stay
inside the existing baked bounds.
**Status:** authored, NOT implemented. Implement in a fresh session.

> **The bug this PRD fixes, in one line:** `Sværhedsgrad` was added game-by-game with the anchor
> *"Normal == exactly what this game did before"*, so nobody ever defined what the three levels MEAN.
> Each game then invented its own axis, and they drifted — **Minus at Normal is far harder than Plus at
> Normal** (owner report), Bogstav Quiz Svær is byte-identical to Normal, and three games ignore the
> setting completely.

> **No adaptivity.** This is and stays a static, manual, adult-set level (standing owner rule). Nothing
> here reads the child's performance.

---

## 1. Scope

Every game in the app (24 surfaces) is either **calibrated against one shared definition of the three
levels** or **explicitly listed as exempt with a reason**. Seven workstreams:

| WS | Area | Change | Priority |
|---|---|---|---|
| **W1** | `src/config/difficulty.ts` (new) | The **single source of truth**: the shared spine + every game's per-level table + the exempt list. Pure, Node-importable. | **HIGH** |
| **W2** | `src/config/mathProblems.ts` (new) + the 4 math games | Lift the math generators out of the components as **pure `(level, rnd) => problem` functions** and recalibrate them (this is the owner's actual complaint). | **HIGH** |
| **W3** | `UnifiedQuizGame` + the 8 config quizzes | **Option count becomes a shared axis (3/4/5)**, resolved centrally, plus the answer-grid layout that 3/5/6 tiles needs. | **HIGH** |
| **W4** | Alphabet, English, Farver quizzes | Give every level a **distinct distractor policy** (kill the dead Svær). | MED |
| **W5** | Stav Ordet + Hukommelse | The two **silent** games start responding; Memory collapses to one child-facing tile with the level owning the board. | MED |
| **W6** | Stars + adult panel | 3★ softens at Svær; the panel explains the levels in Danish. | MED |
| **W7** | Prebake + docs | Derive `sequenceStarts` from W1, run the narration protocol, repoint `CLAUDE.md` / `games-catalog.md`. | MED |

**Out of scope / non-goals:** adaptivity of any kind; XP stays difficulty-independent (`taskXp`/`roundXp`
untouched — fairness); round length stays 8 (Farvejagt 5); the reward book, its curve and the 45-slot
path are untouched; no new game mechanics.

## 2. Guardrails

- Honour `.claude/rules`: `game-development.md` (advance-lock, first-try, timer hygiene, never `await`
  narration in a tap handler), `audio-system.md` (the 8-step protocol for any new spoken line),
  `drag-and-drop.md` (kidCollision, spring-back, advance-guard), `responsive-design.md` (no-scroll,
  44px, phone variants), `games-catalog.md`'s per-game invariants.
- **Preserve every existing invariant** even while its numbers move: Tal Quiz shows nothing of the answer
  (listen-only); no countable stand-in on any math board; Sammenlign shows numerals only, no equality; Q
  is never the asked letter; Læs Ordet never reads the prompt word; Sig et Ord has no target word; the
  bespoke animations (`?`→answer POP, krokodille chomp) survive; educational colours stay data.
- Token-driven and verified on all 4 skins + reduced motion + phone landscape.
- **Every generator that produces a spoken line must stay inside the baked set** or go through the
  prebake protocol. `ADDEND_MAX`(10) / `MINUEND_MAX`(20) / `COMPARE_MAX`(20) / numbers ≤100 are the
  existing ceilings — the new tables must not silently outrun them (§6).

## 3. The shared spine — what the three levels MEAN

This is the whole point of the PRD. Declared once in `difficulty.ts`, referenced by every game.

| Axis | **Let** | **Normal** | **Svær** |
|---|---|---|---|
| Intent | "kan det allerede" — recognition, confidence | **"kan det med lidt tanke"** — fluency practice at his real level | "næste års niveau" — genuinely beyond |
| Expected first-try in a round of 8 | ~8 / 8 | **7–8 / 8** | 5–6 / 8 |
| Answer tiles | **3** | **4** | **5** |
| Distractors | maximally **dissimilar** | **near** — real confusions | **confusable-only** |
| Content range | smallest | inside his verified reach | one step beyond |
| Stars | 3★ 0 fejl · 2★ ≤2 | 3★ 0 fejl · 2★ ≤2 | **3★ ≤1 fejl · 2★ ≤3** |

Owner rulings baked into that table:

1. **Normal = comfortable/fluency**, not the edge. The stretch lives in Svær.
2. **Subtraction across the ten is Svær-only.** (Normal reaches 20 but never borrows.)
3. **Svær must never be a no-op** — a level that produces the same parameters as Normal is a bug, and
   W1's test fails the build for it.
4. **Choosing a harder level must not cost rewards** → the Svær star tolerance, mirroring the existing
   rule that XP is never difficulty-dependent.

## 4. Per-game calibration matrix

### 4.1 Math — `difficultyFor('math')`

| Game | Let | Normal | Svær |
|---|---|---|---|
| **Tal Quiz** `math.counting` | 1–50 · 3 tiles · distractors differ in **both** digits and by ≥10 | **1–100** · 4 tiles · digit-swap + ±1/±10 | 1–100 · 5 tiles · **digit-swap always present** when one exists, else ±1 |
| **Plus** `math.addition` | sums ≤10 | sums ≤20, both addends ≥2 (crossing allowed) | sums 11–20, **always crosses the ten** |
| **Minus** `math.subtraction` | minuend ≤10, no crossing | minuend ≤20, **never borrows** (subtrahend ≤ the minuend's units digit); ~40% single-digit for variety | minuend 11–20, **always borrows** (subtrahend > units digit) |
| **Sammenlign** `math.comparison` | 1–10 · gap ≥5 | 1–20 · any distinct pair | 1–20 · gap 1–2 |
| **Hvad Mangler** `math.patterns` | weights 55/15/5/5 · starts ≤10 | 25/20/15/12 · starts ≤40 | 10/15/30/30 · starts ≤60 |
| **Memory Tal** `memory.numbers` | 6 par (12 kort) | 10 par (20 kort) | 15 par (30 kort) |
| **Lær Tal** (browse) | 1–60 | 1–100 | 1–100 |

Notes:
- **Minus Normal is the headline fix.** Today it draws minuend 2–20 with *any* subtrahend, so a round is
  dominated by borrow problems (16−9) — and PRD-15's countable ten-frame was removed 2026-08-02, so
  there is nothing on the board to count with. The no-borrow rule makes 18−6 / 15−3 the Normal shape:
  same effort as Plus Normal, which is the acceptance test.
- **Plus Normal keeps crossing the ten** (8+7) on purpose: counting *on* to 20 on fingers is a skill he
  has; counting *back* across the ten is not. Equal effort, not equal arithmetic structure.
- **Every Hvad Mangler sequence type gets a level-scaled random start.** Today `skip-10` always emits the
  identical `10 20 30 40 50` — 30% of all questions at Svær — and no range moves with the level at all.
  All sequences must stay ≤100 (the narration ceiling). This is a **content bug fix**, not tuning.
- **Sammenlign is exempt from the tile axis** (the mechanic is two numbers). Its gap IS its axis and it's
  already the best-calibrated game in the app — only the Let range tightens.
- Tal Quiz's task is hearing the inverted Danish number word ("syvogtredive" = 37), so at Svær the
  *distractor policy*, not a wider range, is the step up (1–100 is the prebaked ceiling).

### 4.2 Alphabet — `difficultyFor('alphabet')`

| Game | Let | Normal | Svær |
|---|---|---|---|
| **Bogstav Quiz** `alphabet.quiz` | 3 tiles · confusable group **excluded** (today) | 4 tiles · confusables seeded (today) | 5 tiles · **all** distractors from the confusable group; random top-up only if the group is too small |
| **Memory Bogstaver** `memory.letters` | 6 par | 10 par | 15 par |
| **Lær Alfabetet** | **exempt** — ungraded browse, all 29 letters at every level | | |

Svær is currently **identical to Normal** here (`level === 'normal' || level === 'svaer'` seeds the same
group) — the clearest instance of a dead level. Q stays distractor-only at every level.

### 4.3 Ordleg — `difficultyFor('ordleg')`

| Game | Let | Normal | Svær |
|---|---|---|---|
| **Læs Ordet** `ordleg.read` | 2-letter words · 3 pictures · no shared initial | 2–3 letter · 4 pictures · no shared initial | 2–3 letter · **6** pictures · shared initials allowed |
| **Stav Ordet** `ordleg.spelling` **(new lever)** | 2-letter words · 1 distractor letter | 2–3 letter · 3 distractors (today) | 3–4 letter words · 4 distractors |
| **Sig et Ord** `ordleg.mic` | **exempt** — open-ended by design, no target word to grade | | |

Læs Ordet is already spine-compliant (it keeps **6** rather than 5 at Svær because its tiles are
pictures, not glyphs) — it only moves into the shared table. Word length stays gentle at every level
(standing owner rule: he can't spell yet), so Svær's axis is picture count, never longer prompt words.

### 4.4 English — `difficultyFor('english')`

All three quizzes (`english.listen` / `.word` / `.translate`), **word pool identical at every level** —
the deliberate beginner floor stays:

| | Let | Normal | Svær |
|---|---|---|---|
| Tiles | 3 | 4 | 5 |
| Distractors | different-theme only (today) | random (today) | same-theme only (today) |

**Lær Engelsk** — exempt (ungraded browse). The three games' distinct skills (audio→picture /
picture→word / word→word, no picture on Translate) are untouched.

### 4.5 Farver — `difficultyFor('colors')`

| Game | Let | Normal | Svær |
|---|---|---|---|
| **Hvilken Farve** `colors.quiz` | 3 tiles · **non-adjacent** hues | 4 tiles · random (today) | 5 tiles · **adjacent hues only** (rød/orange, blå/lilla) |
| **Farvejagt** `colors.farvejagt` | 3 distractor colours ×1 (~6 items) | all other colours ×1 (~12) | all ×2 (~20) |
| **Ram Farven** `colors.ramfarven` | **4** targets — add `lyserød` (3 targets over an 8-mix round repeats each ~2.7×) | 6 | 9 |
| **Nuancer** `colors.nuancer` | 2 slots | 3 slots | 3 slots + 1 decoy |
| **Lær Farver** | **exempt** — ungraded browse | | |

Adjacency comes from the existing `HUE_ORDER` in `colorContent.ts`. `quizSafe:false` objects stay
excluded at every level. The drag games map the tile axis onto board/tray size, which they already do.

### 4.6 The exempt list (must be explicit in code, with reasons)

`alphabet.learn`, `math.learn` (Lær Tal responds only via its range), `english.learn`, `colors.learn` —
ungraded browses. `ordleg.mic` — no target word exists. `math.comparison` — exempt from the **tile** axis
only (2-number mechanic), fully calibrated on range + gap.

## 5. Where the calibration lives

- **`src/config/difficulty.ts` (new)** — pure, no React, **Node-importable**: `OPTION_COUNT`,
  `STAR_THRESHOLDS`, one table per game from §4, and `EXEMPT` with a reason string per entry.
  Node-importable is a hard requirement: `shared-narration-clips.js` must derive the baked ranges from
  this module, exactly as it already does with `ADDEND_MAX`/`MINUEND_MAX` (§6). **Relative imports in
  that graph need explicit `.ts` extensions** or the prebake scripts break.
- **`src/config/mathProblems.ts` (new)** — the generators as pure functions of `(level, rnd)`:
  `makeAdditionProblem`, `makeSubtractionProblem`, `makeComparisonPair`, `makeSequenceQuestion`,
  `pickQuizNumber`, `numberDistractors`. Two reasons this refactor is required, not cosmetic: the §7
  invariants can only be sampled if the generators are callable outside React, and the enumerator needs
  the same code the game runs. `MathOperationGame` / `ComparisonGame` / `HvadManglerGame` / `MathGame`
  keep all their animation and audio behaviour and just call these.
- **`UnifiedQuizGame`** resolves the option count from the level once, so the config quizzes stop
  hand-rolling it (`AlphabetGame`, `MathGame`, `HvadManglerGame`, `LaesOrdetGame`, `EnglishListenGame`,
  `EnglishWordGame`, `EnglishTranslateGame`, `FarveQuizGame`). Its `generateOptions` contract gains the
  requested count; each game keeps ownership of *which* distractors it picks.
- **Reuse, don't reinvent**: `useDifficulty(section)` + `progressStore.difficultyFor`, `shuffle()`,
  `useNeverFailHint`, `useRound`, `confusablesFor` (alphabet), `HUE_ORDER` / `SHADES` (`colorContent.ts`),
  `possibleTargets` / `mixingRules` (`colorMixing.ts`), `pickDistractorWords` / `themeMatesOf` (english),
  the `TactileTile` / `PromptFocus` primitives.
- Every game must keep its existing **live-regeneration effect** (`useDifficulty` + a prev-level ref) so
  a mid-game change in the adult menu takes effect on the current question.

## 6. Gates — art & prebake (do these deliberately, they fail soft)

**Prebake (required, W7).** `sequenceStarts` in `src/config/gamePhrases.ts` hardcodes exactly today's
narrow starts (count-by-1 1–10, skip-2 0/2/4/6, skip-5 5/10/15, skip-10 **only** 10) and
`shared-narration-clips.js` bakes Hvad Mangler's read-back from it. Widening the ranges therefore drops
every new sequence's spoken read-back to live Azure, unauditioned — the exact failure mode
`audio-system.md` warns about. So: derive `sequenceStarts` from the difficulty table (never hand-copy),
pin the bounds in a test, `npm run tts:prebake` (~150 new clips), `npm run audit:check` → listen/sign off
→ commit the mp3s + `prebakedTts.ts` + `docs/audit/*`.

**No prebake needed** for the math operations (all inside `ADDEND_MAX` 10 / `MINUEND_MAX` 20),
comparisons (`COMPARE_MAX` 20), numbers (≤100) or colours — verify with `audit:check`, don't assume.

**Art (optional, W5).** Stav Ordet Svær wants 3–4 letter words, but all 30 keys in
`src/assets/games/ordleg/` are 2–3 letters. Candidates already rendered elsewhere — `hest`, `gris`,
`fisk`, `hval` in `src/assets/rewards/` — must be verified key-by-key (and each word checked against
`prebakedTts.ts`, since Stav Ordet speaks it). **If no 4-letter art lands, Svær ships as 3-letter + 4
distractors** and the 4-letter tier is a follow-up. Never ship a glyph fallback (`noEmoji.test.ts`'s
allowlist is empty).

## 7. Verification

**`src/config/difficulty.test.ts` (new)** — pins the §4 values *and* samples ~2000 generated problems per
level to assert behaviour:

- Minus **Normal never borrows**; Minus **Svær always** borrows; Minus Let stays ≤10.
- Plus Let sums ≤10; Plus Svær always crosses the ten; Plus Normal both addends ≥2, sums ≤20.
- Every Hvad Mangler sequence is ≤100 **and** its `{start, step}` is present in `sequenceStarts`.
- Tal Quiz Svær always offers a digit-swap distractor when one exists; Let's distractors are ≥10 away.
- Option counts resolve to 3/4/5 (Læs Ordet 3/4/6) for every non-exempt quiz.
- **No non-exempt game has an identical parameter set at two levels** — the guard that would have caught
  today's dead alphabet Svær, and the one that keeps this from drifting again.

**Re-break every pinned invariant** and confirm *that specific test* flips (CLAUDE.md rule — the break
must target what the test measures; adjacent breakage proves nothing). Pin literal values, not just
"app and enumerator agree" — they move together.

**Headless per-level sweep** (ui-screenshot skill): `window.__progress.setDifficulty({global: …})`
regenerates the current question live, so drive each quiz at all three levels and **measure** (never
eyeball) the answer grid at **1024×768, 844×390 and 667×375** — 3/5/6 tiles must lay out without an
orphan row, hold 44px, and not overflow (`rect` vs `[0, innerWidth]`, since the no-scroll root clips
rather than scrolls). Run both dnd probes (abort + positive control) for the four Farver games. Check the
30-card Memory board fits no-scroll. Verify all 4 skins + `?reduce=1`.

`npm run build` · `npm run lint` · `npm test`; prebake + `audit:check` per §6.

**Acceptance (owner):** at **Normal**, a round of 8 Plus and a round of 8 Minus cost the same effort, and
he lands 7–8 first-try in both. At **Svær**, every game is visibly different from Normal. Nothing in the
child-facing UI names a difficulty except the one Hukommelse tile losing its "(svær)" suffix.

## 8. Suggested implementation order

W1 (the table) → W2 (math, the actual complaint) → W3 (option count + grid layout) → W4 (distractor
policies) → W5 (Stav Ordet + Memory) → W6 (stars + panel copy) → W7 (prebake + docs). W1+W2 alone fix the
reported bug and are shippable on their own if the session runs long.

## Appendix — files to touch

New: `src/config/difficulty.ts`, `src/config/mathProblems.ts`, `src/config/difficulty.test.ts`.

Changed: `src/components/math/{MathOperationGame,ComparisonGame,HvadManglerGame,MathGame,NumberLearning}.tsx`
· `src/components/common/UnifiedQuizGame.tsx` (option count + answer grid ~L716–751) ·
`src/components/common/UnifiedMemoryGame.tsx` + `src/components/learning/MemoryGame.tsx` ·
`src/components/alphabet/AlphabetGame.tsx` · `src/components/ordleg/{LaesOrdetGame,SpellingGame}.tsx` ·
`src/components/english/English{Listen,Word,Translate}Game.tsx` ·
`src/components/farver/{FarveQuizGame,FarvejagtGame,RamFarvenGame,NuancerGame}.tsx` ·
`src/config/{gamePhrases.ts,categoryThemes.ts}` · `shared-narration-clips.js` ·
`src/components/adult/DifficultyPanel.tsx` · `src/App.tsx` (memory route) · `CLAUDE.md` ·
`.claude/rules/games-catalog.md`.
