---
paths:
  - "src/components/alphabet/*.tsx"
  - "src/components/math/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/components/english/*.tsx"
  - "src/components/ordleg/*.tsx"
  - "src/components/learning/*.tsx"
---

# Games catalog (per section)

What each game is + its `gameId` + the **durable design invariants** (the *why*). Tuning values —
milestone tap-counts, round lengths — live in each component's "tuning levers", NOT here. How to build
a game: `game-development.md`. Drag games: `drag-and-drop.md`.

**Everything that varies BY LEVEL now lives in `src/config/difficulty.ts`** (Difficulty PRD-01), not in
the components: answer-tile counts, number ranges, distractor policies, board/tray sizes, word-length
bands, and the star thresholds. A game reads its own table there and nothing re-derives a level inline.
Two durable rules that module enforces via `difficulty.test.ts`: **no non-exempt game may produce the
same parameters at two levels** (a dead level is a bug — Bogstav Quiz's Svær shipped byte-identical to
Normal), and every game that legitimately ignores the level is in `EXEMPT` **with a reason**
(`alphabet.learn`, `math.learn`, `english.learn`, `colors.learn` — ungraded browses; `ordleg.mic` — no
target word exists). Svær's star budget is deliberately looser (3★ ≤1 mistake): **choosing a harder level
must never cost rewards**, the same fairness rule that keeps XP difficulty-independent.

**A BOARD MUST NOT RESTATE ITS OWN ANSWER.** The app-wide version of a rule that started as a math one,
now that the owner has removed the third instance: Tal Quiz's printed numeral *and* its counting row,
Bogstav Quiz's old "hear the letter, tap the letter" mode, and Hvilken Farve's object shown in its true
colour beside a swatch of that colour. Each let the child win by matching two copies of the answer on
screen instead of exercising the skill — and each looked like a helpful visual, which is why they all
shipped. The test to apply to any prompt: **can the child answer this without the thing the game is
supposed to teach?** If yes, the giveaway comes off, even if that makes the game harder (the fix is
usually to move the answer into speech, or to strip the attribute being asked about). A per-section
"don't re-add it as a counting aid / a picture crutch" note lives in each section below.

Two more invariants that module enforces, both learned by shipping the bug twice:

- **A level's content POOL must be at least the ROUND LENGTH.** Smaller, and a single round has to
  repeat itself, which reads as the game being stuck rather than easy — Ram Farven's Let targets and
  then Læs Ordet's Let words (5 words, 8 questions). And **guard a pool against the real round
  constant, not a magic floor**: the assertion that was supposed to protect Læs Ordet asked for `>= 4`
  and therefore passed the exact 5-word bug it existed to catch. Export the round length from the
  content module so the game's `RoundConfig` and the guard read one value.
- **A "maximally dissimilar distractor" rule must DERIVE its distance from the level's range**, never
  fix it absolutely. A flat "≥10 away" is unsatisfiable inside 1–20 (nothing is 10 from 11 but 1), so
  the generator fell through to its random top-up and produced `11 → 1, 8, 11` — the exact opposite of
  the policy, with nothing failing. `farMinGap` in `mathProblems.ts` is the shape: a fraction of the
  range, capped at the value the wide range used to give.

**Browses carry no counter and no progress bar** (removed 2026-08-01, owner: no educational purpose) —
a browse has no score and no finish line, so a filling bar only implied a list to get through. The only
thing in a browse's HUD is the shared reward ring; `answered/total` pips belong to bounded ROUNDS. This
retired `announcePosition` ("Du er ved tal 18 ud af 100") from the audio controller entirely.

Shared shape: task games run bounded rounds → `RoundResultScreen`, grant **live per-task XP** (via
`useRound`'s `gameId`), and never punish wrong answers (they only break a question's first-try flag).
Calm "Lær …" browses run no round — they earn **per-new-item browse XP** (`useBrowseXp`). Stickers
are the **trophy of a level-up** now (not per-round / per-browse) — see CLAUDE.md Progression.
gameIds are `<section>.<game>`.

## Math — `math.counting/.addition/.subtraction/.comparison/.patterns`
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

## Alphabet — `alphabet.quiz` (+ Lær Alfabetet browse)
- Bogstav Quiz is **all word-association**: show a picture, tap the letter the word starts with (the
  trivial "hør bogstavet" recognition mode was removed). The prompt subject is baked soft-3D art (not a
  flat emoji). **Q is the only letter never asked** (distractor-only) — W/X/Å are askable. The askable
  set is `WORD_LETTERS`; the full display manifest (incl. Q) is `LETTER_WORDS`.
- Distractors are **confusable-seeded**, not random: Normal/Svær draw from the correct letter's
  look-/sound-alike group (M/N, B/D/P, Æ/Ø/Å…) so a right answer means the child told them apart, and
  **Let deliberately EXCLUDES that group** so its options read as maximally dissimilar.
- Lær Alfabetet (browse) speaks **"{bogstav} som {ord}"** on a TAP, never the bare letter name — a child
  who already knows every letter learns nothing from the name. Both this and the quiz's correct-answer
  fact go through the shared builders in `src/config/letterWords.ts` (per-letter pronunciation overrides
  — see `audio-system.md`).
- Lær Alfabetet's **"Hør alfabetet"** pill autoplays A→Å: the bare letter NAMES (the sequence is the
  lesson here, so no "som {ord}"), grouped A–G · H–N · O–U · V–Z · Æ Ø Å with a longer breath between
  groups (`src/config/alphabetGroups.ts` — the tempo levers), driving `currentIndex` so the ring + bloom
  travel in step. The letters are paced on a fixed **onset-to-onset step** and deliberately NOT awaited —
  awaiting the padded clips halved the pace (see `audio-system.md`); the step's floor is the longest
  spoken name plus playback startup. **Earns no XP** (browse XP stays tap-only; one press would otherwise mint the whole
  section's allowance). An incrementing run token aborts the loop on a letter tap, a re-press or
  unmount — `mountedRef` alone is not enough.

## Ordleg — `ordleg.read/.spelling/.mic`
- Læs Ordet **never AUTO-reads the prompt word** — silent decoding IS the exercise. The correct-tap
  **does** speak the tapped picture's name — that names the child's *choice*, not the prompt, so it's
  not a violation. Thin `UnifiedQuizGame`; after 2 wrong picture taps the correct picture pulses.
  The prompt word is **plain uniform uppercase type, every letter identical** — PRD-18 W1's
  first-letter emphasis is gone (see `game-development.md`); the only help this game gives is the
  picture-tap hint.
- Stav Ordet (hand-rolled): after 2 wrong taps on a slot the correct tile pulses (never-fail
  next-letter hint; reduced-motion → static glow; using it costs a star).
- Sig et Ord is **open-ended** — say any word → it's spelled back. **No target word, no STT grading**;
  a recognized word counts, an STT mishear stays on the same question without counting.

## English — `english.listen/.word` (+ Lær Engelsk browse)
- Thin `UnifiedQuizGame` configs. Distractors **random**, themes **mixed** (no minimal-pairs, no
  per-theme rounds) — a deliberate beginner floor.
- **The two are distinct skills** (PRD-17 W1 — don't collapse them): Lyt og Find = audio→picture;
  **Find det Engelske Ord** = picture→English word (recognition, keeps the baked picture prompt).
- Lyt og Find's listen-hero equalizer is driven by the **real `audio.isPlaying`** state (bars dance
  during playback, settle when idle) — read the audio hook, never a component-level `isPlaying`.
- English words are spoken by en-US Ava (`speakEnglish`). **Nothing speaks the Danish gloss (`w.da`)
  any more** — Lær Engelsk only DISPLAYS it — so it is deliberately NOT enumerated for prebake. Adding
  a surface that speaks a Danish gloss means re-adding that loop (`audio-system.md`'s protocol).
- **There was a third quiz, `english.translate` (Dansk til Engelsk)** — Danish word, no picture →
  English word. **Removed entirely 2026-08-03** at the owner's request: component, route, tile, baked
  icon, difficulty entries, welcome line and its prebaked clips. Its removal is the reason the Danish
  glosses left the closed narration set, and the reason Find det Engelske Ord's picture is no longer a
  "differentiator" (it is just the prompt). Don't reintroduce it as a variant of Find.

## Farver — `colors.farvejagt/.ramfarven/.quiz/.nuancer` (+ Lær Farver browse)
All drag-based except the calm Lær Farver browse; hand-rolled dnd-kit — see `drag-and-drop.md`.
- Farvejagt: drag objects into the target-color circle; a correct drop snaps into a ring + spoken
  "{objektet} er {farve}".
- Ram Farven: drag 2 droplets into the pot; correct → recipe reveal + spoken "rød og blå bliver lilla";
  `Tøm` empties the pot. Wrong → fizz + **no win/lose narration** — but if the mix made a REAL colour it
  is NAMED (owner 2026-08-03): aiming for lilla and mixing rød+gul makes orange, and that discovery used
  to fizz away unnamed. Naming is identification, not feedback — the same distinction that lets the
  correct branch speak a recipe instead of "rigtigt!".
  Its recipes (`primaryColors`/`possibleTargets`/`mixingRules`/`TARGET_PRIORITY`/`makeTargetBag`) live in
  **`src/config/colorMixing.ts`** — moved out of the component 2026-08-02 because the game speaks lines
  built from them, and data stranded in a `.tsx` can never be enumerated for prebake. Three invariants
  there, all guarded by `colorMixing.test.ts`:
  - **Every unordered pair of the 5 sources maps to a goal, in BOTH orders** — 10 pairs, 10 goals, no
    dead ends. `gul+sort → mørkegul` closed the last gap (it used to fall through to an unnamed
    `color-mix()` sludge that was always wrong), which is also what makes the naming above total. The
    ceiling follows: 5 sources give 10 pairs and all 10 are used, so **more goals need a new SOURCE
    colour** — deliberately not done, since adding grøn as a droplet while teaching blå+gul=grøn is
    muddy for a 5-year-old.
  - **The level owns the TRAY as well as the pool** (`COLORS_RAMFARVEN` = targets + `sources`). Pool size
    used to be the only axis, and the side effect was that **black was a dead droplet at Let AND Normal**
    — nothing at either level uses it. Now Let offers 4 droplets (no black, so every droplet is in some
    answer), Normal introduces black AS the decoy, Svær opens all 10 goals. `primaryColors`' ORDER is
    therefore load-bearing (black last — the tray is `slice(0, sources)`), and the test that matters is
    **every goal a level asks for must be mixable from that level's droplets**; reading `TARGET_PRIORITY`
    out of the `.tsx` with a regex made a first attempt at that guard vacuous, which is why the list is
    config now. Let's 4 droplets can make 6 colours while it asks for 4 — that headroom is deliberate
    (the spare tints are what the child stumbles into and hears named), so it is a SUBSET invariant, not
    an equality.
  - **Goals are drawn from a BAG**, not sampled (`makeTargetBag`, pure + seedable). Avoiding only the
    previous target let 8 mixes from Let's 4 goals hand out lilla four times; a shuffled pass makes Let
    two clean passes and Normal show all 6 before repeating. `avoidFirst` is what stops a repeat
    straddling the seam between two bags. Let's pool (4) is intentionally BELOW the round length (8),
    contra the pool-≥-round rule above: this pool is the mixable SPACE, not a content list.
  The pale-tint goals (lyserød/lyseblå/lysegul/grå) need a neutral ring to read against the pale world,
  and it must be a **padded box that reserves its own space** — as a `118%` absolute disc it reserved
  none and measured **7.5px INSIDE the "Mål" chip** (a non-pale target measured 8px clear), the overlap
  the owner reported. It is always rendered and only painted when pale, so bench geometry stays constant
  as targets rotate. `.claude/rules/responsive-design.md`, "reserve the space, don't tune a percentage".
- Hvilken Farve?: drag the object onto the matching color swatch — and **above Let the object is
  DESATURATED** (`COLORS_QUIZ[level].reveal`), because shown in its true colour the answer is already on
  the board and the child matches the fox's orange to the orange swatch without ever needing the word.
  Same "a board must not restate its own answer" rule as Tal Quiz's removed numeral/object row and
  Bogstav Quiz's dropped hear-the-letter mode; matching is a ~2–3 year milestone, and the rest of this
  section already covers the 5–6 skills (sorting, shades, mixing). The colour comes BACK on the copy
  that lands in the swatch — that pop is the reveal, so never grey it too. Grey mode also narrows the
  pool to `canonical` objects: a greyed car, shirt or crystal has no right answer, and the authored
  lilla `hjerte` would score rød wrong. Guarded in `colorContent.test.ts` (pool ≥ round, per-hue floor,
  and the game's `desaturate` wiring read as source — the tables being right proves nothing on its own).
- Nuancer: drag 3 shades into slots **light→dark** (left = lightest).
- **Educational color content is data** in `src/config/colorContent.ts` (NOT themeable); color hexes
  stay data, never themed.
- **Content-quality invariants (PRD-04):** the spoken echo must go through `spokenColor(hue, neuter)`
  so the adjective agrees in gender ("æblet er rødt", "havet er blåt" — not "rød"/"blå"); every
  `ColorObject` carries a `neuter` flag, and objects whose emoji contradict their color (⚽/👒/☁️/🌸)
  carry `quizSafe:false` so Hvilken Farve never scores the child on a misleading picture.

## Memory — `memory.letters`, `memory.numbers`
- One engine (`UnifiedMemoryGame.tsx`) + config factory (`MemoryGame.tsx`); **one tile per section**, and
  the **difficulty LEVEL owns the board** (6 / 10 / 15 pairs — `MEMORY_BOARD`). It used to be two tiles
  per section, one of them titled "Hukommelse 20 (svær)" — the only place a difficulty was ever named in
  the child-facing UI. `:size` survives in the route only so old bookmarks land somewhere; it is ignored.
- **One `gameId` per TYPE, never per board size** — a level change must not fragment the child's bests,
  for the same reason XP is difficulty-independent. Star thresholds scale with the board via
  `memoryStarThresholds(pairs, level)`, which preserves PRD-05's reachable 10-pair curve (`{9, 18}`).
- **A board-size change has to DEAL A NEW BOARD.** The engine's init effect is `hasInitialized`-guarded,
  so without an explicit `config.boardPairs` effect the old card array survives: measured 20 cards on
  screen while the chip read "Par: 0/6", i.e. the round would "finish" with 8 cards still face-down.
- **One board = one round** (no `useRound` — every pair is always found, so the only skill signal is
  mismatches): `recordRoundResult(gameId, { correct: pairs, total: pairs + mismatches, longestStreak })`
  → stars scale with mismatches, and longest match-streak is the record.
- Juice: `flip` on reveal, `match` + a light pop on a pair (deliberately NOT a full `celebrateTier`),
  `celebrateTier('streak')` every 3rd consecutive match, gentle `wrong` on a mismatch.
