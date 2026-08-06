---
paths:
  - "src/components/learning/*.tsx"
---

# Games catalog — Memory — `memory.letters`, `memory.numbers`

One section of the games catalog. The cross-game invariants it relies on — the difficulty spine, the
no-giveaway rule, pool-vs-bag, both-gestures — are in `.claude/rules/games-catalog.md`, which loads
alongside this file.

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
