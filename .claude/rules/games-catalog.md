---
paths:
  - "src/components/alphabet/*.tsx"
  - "src/components/math/*.tsx"
  - "src/components/farver/*.tsx"
  - "src/components/english/*.tsx"
  - "src/components/ordleg/*.tsx"
  - "src/components/learning/*.tsx"
---

# Games catalog — cross-game invariants

The **durable design invariants** every game shares. Each section's own games, `gameId`s and per-game
notes are in a sibling scoped to that directory — `games-math.md`, `games-alphabet.md`,
`games-ordleg.md`, `games-english.md`, `games-farver.md`, `games-memory.md` — which loads with this
file. Tuning values (milestone tap-counts, round lengths) live in each component's "tuning levers", not
here. How to build a game: `game-development.md`. Drag games: `drag-and-drop.md`.

**Everything that varies BY LEVEL now lives in `src/config/difficulty.ts`** (Difficulty PRD-01), not in
the components: answer-tile counts, number ranges, distractor policies, board/tray sizes, word-length
bands, and the star thresholds. A game reads its own table there and nothing re-derives a level inline.
Two durable rules that module enforces via `difficulty.test.ts`: **no non-exempt game may produce the
same parameters at two levels** (a dead level is a bug — Bogstav Quiz's Svær shipped byte-identical to
Normal), and every game that legitimately ignores the level is in `EXEMPT` **with a reason**
(`alphabet.learn`, `math.learn`, `english.learn`, `colors.learn` — ungraded browses; `ordleg.mic` — no
target word exists). Svær's star budget is deliberately looser (3★ ≤1 mistake): **choosing a harder level
must never cost rewards**, the same fairness rule that keeps XP difficulty-independent.

**The practice ledger is NOT adaptivity, and it is worth knowing that before you delete it.**
`practiceLedger` (device-local, per child, its own key — deliberately outside the synced v4 document)
records per-item misses, and `src/config/practiceWeights.ts` turns them into prompt ORDER inside the
level's own pool: a missed item is re-asked a few draws later, and a pool's most-missed items lead a new
pass. It never reads or writes a LEVEL, so `difficulty.ts`'s "NO ADAPTIVITY … nothing reading it looks at
the child's performance" is still true — which is exactly the sentence that would otherwise justify
deleting this on sight. The separation is mechanical, not a promise: `practiceWeights` imports NOTHING,
the difficulty layer may not name the ledger, and the ledger's READ surface has exactly one consumer (the
prompt bag) so nothing that decides a level can even see a miss. Games only `recordAttempt`.
Guarded by `practiceWeights.test.ts`; the drill it guards AGAINST is a round becoming the same three
letters, not under-drilling.

**A BOARD MUST NOT RESTATE ITS OWN ANSWER.** The app-wide version of a rule that started as a math one,
now that the owner has removed the third instance: Tal Quiz's printed numeral *and* its counting row,
Bogstav Quiz's old "hear the letter, tap the letter" mode, and Hvilken Farve's object shown in its true
colour beside a swatch of that colour. Each let the child win by matching two copies of the answer on
screen instead of exercising the skill — and each looked like a helpful visual, which is why they all
shipped. The test to apply to any prompt: **can the child answer this without the thing the game is
supposed to teach?** If yes, the giveaway comes off, even if that makes the game harder (the fix is
usually to move the answer into speech, or to strip the attribute being asked about). A per-section
"don't re-add it as a counting aid / a picture crutch" note lives in each section below.

**CONFINING A GIVEAWAY TO *LET* IS NOT REMOVING IT** — the fourth instance, and the one worth
generalising (Difficulty PRD-02, owner 2026-08-05). Hvilken Farve kept the true-colour object at Let as
"the youngest child's winnable tier", which reads as a reasonable compromise and is not: the level an
adult sets for a 5-year-old is the level he actually plays, so the giveaway simply became the default
experience with a difficulty label on it. **The rule is total over levels**, and a level that leans on
the giveaway for its easiness is a level that needs re-easing on axes that leak nothing — pool
membership, option count, distractor distance, an earlier hint. Same shape as the fairness rule below:
a harder level must not cost rewards, and an *easier* one must not cost the lesson.

Two more invariants that module enforces, both learned by shipping the bug twice:

- **A LEVEL'S POOL IS ITS CYCLE LENGTH, and it must be at least that game's round constant.** The bag
  deals one shuffled PASS over the whole pool, so in endless play the pool size IS the repeat period: a
  5-word Læs Ordet pool means those five words on a loop of five, forever — a stronger reason than the
  original "a single bounded round has to repeat itself", which died with the round. And **guard a pool
  against the real constant, not a magic floor**: the assertion meant to protect Læs Ordet asked for
  `>= 4` and passed the exact 5-word bug it existed to catch. Export it from the content module so the
  game's `tasksInRound`, its bag window and the guard all read one value.
  **But the pool rule alone can never deliver what it was bought for, because the DRAW is the other
  half.** Sampling with replacement repeats at *any* pool size, so growing Læs Ordet's Let pool from 5
  to 9 words changed nothing measurable — 98% of Let rounds still repeated a word, and the worst asked
  three distinct words in eight questions. Every prompt therefore comes from a **bag** whose no-repeat
  WINDOW is that game's round constant (`usePromptBag` — see `game-development.md`); with pool ≥ that
  constant, a repeat inside any run of that length is structurally impossible rather than merely
  unlikely. **The window is CLAMPED below the pool**, and must be: at `window === pool.length` the bag
  deals the same pass in the same order forever (`promptBag.ts` semantics 3).
- **A "maximally dissimilar distractor" rule must DERIVE its distance from the level's range**, never
  fix it absolutely. A flat "≥10 away" is unsatisfiable inside 1–20 (nothing is 10 from 11 but 1), so
  the generator fell through to its random top-up and produced `11 → 1, 8, 11` — the exact opposite of
  the policy, with nothing failing. `farMinGap` in `mathProblems.ts` is the shape: a fraction of the
  range, capped at the value the wide range used to give.

**Browses carry no counter and no progress bar** (removed 2026-08-01, owner: no educational purpose) —
a browse has no score and no finish line, so a filling bar only implied a list to get through. The only
thing in a browse's HUD is the shared reward ring — and since Endless Play PRD-01 that is true of the
TASK games too, which have no finish line either. This retired `announcePosition` ("Du er ved tal 18 ud
af 100") from the audio controller entirely.

**BOTH GESTURES, EVERYWHERE THEY BOTH MAKE SENSE.** A game that accepts a drag must also accept a tap
and vice versa, through one shared resolve function — owner, 2026-08-03, after the Farver games ignored
plain taps. Which games, where the tap/drop goes, and the single-threshold rule that stops one gesture
answering twice: **`.claude/rules/drag-and-drop.md`** (its first two sections). The games that stay
tap-only are the ones whose prompt has no gap to drop into, and that is a content fact, not an omission.

Shared shape: **both game types are ENDLESS** (Endless Play PRD-01) — no boundary the child can
perceive, no "Færdig!", no stars, no bests, no replay. Task games grant **live per-task XP** (via
`useTaskRun`) and never punish wrong answers (they only break a question's first-try flag, which feeds
the streak beat); "Lær …" browses earn **per-new-item browse XP** (`useBrowseXp`). The sticker ceremony
fires **in-game at the seam**, the moment the ring fills — see `rewards-and-progression.md`.
gameIds are `<section>.<game>`.
