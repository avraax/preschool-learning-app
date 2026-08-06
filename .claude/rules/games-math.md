---
paths:
  - "src/components/math/*.tsx"
---

# Games catalog — Math — `math.counting/.addition/.subtraction/.comparison/.patterns`

One section of the games catalog. The cross-game invariants it relies on — the difficulty spine, the
no-giveaway rule, pool-vs-bag, both-gestures — are in `.claude/rules/games-catalog.md`, which loads
alongside this file.

- **The generators are PURE functions** in `src/config/mathProblems.ts` (`makeAdditionProblem`,
  `makeSubtractionProblem`, `makeComparisonPair`, `makeSequenceQuestion`, `pickQuizNumber`,
  `numberDistractors`…), not component code — that's what lets `difficulty.test.ts` sample thousands of
  problems per level, and what lets the prebake enumerator reach the same ranges. The components keep all
  their animation + audio behaviour and just call these.
- **Minus never borrows below Svær.** Counting *on* to 20 on fingers is a skill the child has; counting
  *back* across the ten is not, so at Normal the subtrahend never exceeds the minuend's units digit
  (18−6, 15−3) while Plus at Normal *does* cross (8+7). Equal effort, deliberately unequal arithmetic
  structure — that pairing IS the calibration, and PRD-15 removing the countable ten-frame is what made a
  borrowing Normal unwinnable. Svær is the reverse of both: always crosses / always borrows.
- Distractors are **near-number** (digit-swap, off-by-one/ten), not random.
- **NOTHING on a math board restates a number that's already on it.** Every countable stand-in has now
  been removed by the owner: Lær Tal's star/dot cluster and Sammenlign Tal's piles (2026-08-01), Tal
  Quiz's object row and Plus/Minus's ten-frame under the number sentence (2026-08-02). Each one let the
  child reach the answer by counting blobs instead of reading the numerals, which is the skill. Don't
  re-add a countable layer to a board whose numbers are visible — the reading IS the task.
- **Tal Quiz is LISTEN-then-recognise, and shows NOTHING of the answer** (owner 2026-08-01): the
  number lives only in the spoken "Find tallet N" (+ Hør igen) and the focal zone is the shared
  `ListenHero` (speaker + audio-driven equalizer, also used by Lyt og Find). Both earlier visuals were
  removed as giveaways — the printed numeral (a tile row containing it made the tap shape-matching)
  AND the n-objects "Hvor mange?" counting row (a second visible copy of the answer). The task is real
  because Danish inverts the number word ("syvogtredive" = seven-and-thirty), which is what the
  digit-swap distractors test.
- Plus/Minus/Sammenlign **speak the completed fact** on a correct tap ("tre plus fire er syv"); Hvad
  Mangler reads the finished sequence — instead of echoing the tapped number.
- Lær Tal's **"Hør tallene"** pill counts 1→N out loud (the number sibling of Lær Alfabetet's autoplay:
  same run token + fire-and-forget onset step, its own wider step because Danish number words are longer —
  `src/config/numberAutoplay.ts`; shared pacing facts in `autoplayPace.ts`). **One steady flow, no
  grouping and no tempo change** — that phrasing belongs to reciting the alphabet, not to counting. It
  follows the VISIBLE range (100, or 60 at Let) so the ring always has a cell, and earns no XP.
  `NUMBER_BROWSE_RATE` is the single source for the faster number rate — tap, autoplay and the prebake
  enumerator all read it (a rate is part of the cache key).
- Plus/Minus's prompt is the **number sentence alone** on its clay tile (`a op b = ?`), with the
  `?`→answer POP on a correct tap. PRD-15 W1's countable ten-frame beneath it is gone (see above).
- Sammenlign Tal: tap the **bigger** number; **equality was dropped**. The board is a NUMBER SENTENCE
  (`2 [?] 8`, resolving to `2 [<] 8` on a correct tap — winner lit, loser receding), matching
  Plus/Minus's `a + b = ?` grammar. The two numerals ARE the answer tiles, so the arena is the whole
  game body — no `promptStage` band, and nothing else in it.
  **The krokodille was deleted 2026-08-03** (owner: "what does it reflect"). It was meant to teach
  `>`/`<` as a mouth eating the bigger number and taught it **backwards on half of all questions**: the
  art is mouth-CLOSED and was never mirrored, so with the bigger number on the left it lunged
  tail-first at it. The durable lesson, not the removal: **a mnemonic whose meaning depends on
  ORIENTATION must mirror with the content — otherwise don't carry it with a character.**
  It shows **numerals ONLY** — the counted object piles beside them were removed 2026-08-01 (owner):
  comparing two piles of blobs let the child win without reading either numeral, which is the whole
  skill. Don't re-add them as a "counting aid", and don't let tile SIZE encode the values either.
- The equation/comparison symbols `+ − = ? > <` are **baked soft-3D `SymbolTile` art**
  (`src/assets/symbols`), not emoji/glyphs — don't re-bake or emoji them. Numerals stay Typography.
