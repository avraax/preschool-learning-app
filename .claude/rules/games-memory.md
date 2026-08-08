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
- **One `gameId` per TYPE, never per board size** — a level change must not fragment the child's XP, for
  the same reason XP is difficulty-independent.
- **A board-size change has to DEAL A NEW BOARD.** The engine's init effect is `hasInitialized`-guarded,
  so without an explicit `config.boardPairs` effect the old card array survives: measured 20 cards on
  screen while the chip read "Par: 0/6", i.e. the board would "finish" with 8 cards still face-down.
- **ENDLESS BOARDS, dealt from a FULL-POOL BAG** (Endless Play PRD-01 W6/D7). A completed board waits
  `BOARD_TURNOVER_MS` (so the last match registers), plays the ceremony if one is owed, then deals
  itself again — there is no round result and no stars. `config.generateItems()` is the **pool**, not a
  board: `src/config/boardBag.ts` deals one shuffled pass over it, so every letter/number is shown once
  before any repeats and **no board ever holds a duplicate pair** (at 15 pairs from 29 letters the
  boards come out 15 / 14+1 / …). The old `shuffle(pool).slice(0, boardPairs)` was a draw WITH
  replacement across boards — in endless play that is the whole experience. `RestartButton` re-deals
  from the SAME bag, so restarting doesn't rewind the cycle.
- Each matched pair grants live per-task XP normalised by `boardPairs`, so a 6- and a 15-pair board are
  worth the same one reward.
- Juice: `flip` on reveal, `match` + a light pop on a pair (deliberately NOT a full `celebrateTier`),
  `celebrateTier('streak')` every 3rd consecutive match, gentle `wrong` on a mismatch.
