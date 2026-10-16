# PRD — Krea 02: Perleplade (Hama-style beads)

Status: authored 2026-10-16. **NOT implemented.** **Requires `tmp-prd-krea-01-section-and-drawing.md`
to be shipped first.** That PRD registers the `krea` section, the studio scene, the picker, the session
store, the "Nyt papir?" confirm, the done/next buttons and the release gate, and this one reuses all of
them. Every decision in PRD-01 §2.1 (rewards, session-only persistence, the confirm) applies here
unchanged. Art prompts: `plans/krea/krea-art-prompts.md` (batches marked Perleplade).

---

## 1. Why

Hama beads are a Danish invention (Malte Haaning, Nykøbing Mors) and a staple of Danish childhood and
daycare. Placing beads one at a time **is** fine-motor practice, copying a pattern **is** visual
matching and colour naming, and a pattern's colour counts **are** counting. The education is the game
action (memory: education first).

Research (2026-10-16):
- **Hama's own app (Hama Universe)**, 4+, aimed at 5–7: 20 pegboards, 18 colours, themed islands of
  copy-a-pattern, an "iron it" finale, and a free white board unlocked later. It was last updated in 2022
  with few ratings, so the space is open. Third-party bead apps are adult pattern tools.
- **Physical sizes:**
  - Maxi beads are 10 mm (age 3+), Midi 5 mm (5+), Mini 2.5 mm (10+).
  - The large Midi square board is 29×29 pegs.
  - Standard shapes: square, circle, hexagon, heart, star.
- **On a 1024 pt-wide iPad a 29-wide board gives pegs under 35 pt**, too small for a finger. Boards here
  are scaled to the child, not to Hama's catalogue (§2).

## 2. Decisions — dated 2026-10-16, do not re-litigate

1. **Tile "Perleplade"**, gameId `krea.beads`, route `/krea/perler`, fourth in the Krea menu.
2. **Placing a bead: drag one bead from a colour bowl onto a peg**, like the real thing. **Tap parity**
   (house rule): **tap a bowl → one bead lifts into the tweezers; tap a peg → it drops there.** One bead
   per pick for both gestures, **through one resolve function** `placeBead(colour, peg)`.
3. **Two modes, both in the picture grid:**
   - **Copy a pattern:** a pattern card beside the board. Earns XP when complete.
   - **Free board:** an empty shaped pegboard. No XP.

   **There is no ironing finale and no sequence/continue-the-pattern mode** (owner chose neither).
4. **A wrong colour on a pattern peg bounces back gently**: the bead springs back to its bowl with a soft
   sound, never a "wrong" buzzer. **After 2 misses on the same peg**, the right bowl glows (never-fail
   hint). A bead on a peg that isn't part of the pattern also springs back. On the **free board**,
   anything goes anywhere.
5. **Bead and board size follow difficulty** (XP is the same at every level):

   | Level | Bead look | Board |
   |---|---|---|
   | Let | Maxi (big) | 6×6 to 8×8 |
   | Normal | Midi | about 10×10 |
   | Svær | Midi | about 12×12 to 14×14, finer patterns |

   Each pattern is authored per level as grid data (§3). The free-board shapes scale the same way.
6. **Finishing:** the PRD-01 §2.2.9 pattern.
   - Pattern complete → the done button appears.
   - Free board → done is available once there's a bead.
   - Done → **the piece pops off the board and wobbles** (this is "comes alive" here), plus a sound and
     one describing line.
   - The piece stays; **next** returns to the picker.
   - Taking a bead off: drag it back to its bowl, or tap it with empty tweezers, then confirm.
   - "Nyt papir?" → for beads, the confirm reads **"Vil du have en ny plade? Dine perler forsvinder."**
7. **Counting tie-in:** the pattern card shows a **colour legend with numerals** (● 12), rendered as
   Typography, never baked. **Tapping a legend chip speaks the number** (the existing bare-number clips
   0–100), and the board's beads of that colour glow briefly. On done, the describing line is
   per-pattern ("Se, hjertet hopper!"). The game does not count beads aloud while placing them (silent,
   like Fyld Båden's landing).
8. **Symmetry tie-in:** v1 patterns include symmetric ones (sommerfugl, hjerte, and others; see the list).
9. **Content v1:**
   - **8 patterns per level**: hjerte · sommerfugl · fisk · blomst · stjerne · hus · kat · regnbue
   - **5 free boards**: firkant · cirkel · hjerte · stjerne · fisk

   Shapes are peg masks, and patterns may use only pegs inside the board's mask.

### 2.1 Decided by the author, stated as assumptions
- `tasksInRound` is the same as PRD-01 (2). Free board: no `useTaskRun`.
- Bowl colours are the Krea palette (8 at Let, 12 above), named on pick (PRD-01 §2.2.6).
- **Grid:** square boards use a square grid. Circle, heart and star are **masks over a square grid**,
  not Hama's hex offset, so tap targets stay simple.
- Beads and pegs are **drawn in code** (radial gradients: a glossy torus with a hole), so any colour or
  size is exact. Bowls, the pegboard plastic, the tweezers and the pattern card frame are baked art.

## 3. What changes in code

| Path | Change | |
|---|---|---|
| `src/config/kreaBeads.ts` (+test) | patterns as **string grids per level** (one char per peg, `.` empty) + a legend map, the free-board masks, the per-level board size table, and the per-colour counts derived (never hand-typed) | new |
| `src/components/krea/beads/beadBoard.ts` (+test) | pure: `placeBead`, `removeBead`, `accepts(peg, colour)` for both modes, completion, legend counts, miss counter per peg | new |
| `src/components/krea/beads/Pegboard.tsx`, `Bead.tsx`, `BeadBowls.tsx`, `PatternCard.tsx`, `Tweezers.tsx` | rendering + gesture wiring | new |
| `src/components/krea/PerlepladeGame.tsx` | the game, reusing PRD-01's studio, picker, confirm, done/next, alive and session | new |
| `src/App.tsx`, `KreaSelection.tsx` | route + un-hide the 4th tile (still behind `kreaGate`) | edit |
| `src/config/difficulty.ts` | `TUNING['krea.beads']` board size per level (distinct at all three); `TILE_AXIS_EXEMPT` reason "the axis is board size" | edit |
| `gamePhrases.ts`/`kreaPhrases.ts`, `shared-narration-clips.js`, `GAME_WELCOME_MESSAGES`, `WELCOME_TITLES` | welcome "Perleplade", the bead confirm, 8 + 5 describing lines | edit |
| `sfxClient.ts` + mp3s | `bead-pick` (glass click), `bead-place` (soft plastic tick), `bead-back` (gentle roll), `pop-off` | edit/new |
| `usageEvents.ts`, `rewardSurfaces.test.ts` `SEAM_GAMES`, icons `krea.beads` | registration | edit |

## 4. The traps — read this before you write any of it

### 4.1 Hundreds of pegs vs dnd-kit
- **Do not make every peg a dnd-kit droppable.** A 14×14 board is 196 droppables measured with
  `MeasuringStrategy.Always`, which is untested here and expensive on the A10X.
- Use **one droppable: the board**. Resolve the peg **arithmetically** from the drop point (board rect +
  pitch → row/col), snapping to the nearest peg within half a pitch.
- `!over` or outside the mask → spring back. Still use the shared primitives: `DraggableItem` for the
  lifted bead, `kidCollision`, `useDragOnlySensors`, `wasWobbledTap` (a wobbled tap is a tap).
- Tap mode resolves the peg with the same arithmetic. **One function, `placeBead`, for both.**

### 4.2 Peg size and the tweezers
- The **minimum peg pitch is 40 CSS px** on the iPad in landscape. If a level's board doesn't fit at
  40 px in the reserved rect, the board table is wrong, so fix the table, not the pitch. This is guarded
  by a test over the board table at the iPad's smallest viewport (1024×768 landscape minus chrome).
  Phone width may **pan** the board (it's the one surface allowed to; document it) or show the board
  without the card. Decide by measuring.
- **The dragged bead floats above the finger** (offset ~1 pitch up), or the finger hides the target peg.
  The tweezers sprite shows where it will land; the target peg gets a ring highlight while hovering.
- **Tap mode state:** a picked bead in the tweezers stays until it's placed, or the bowl is tapped again
  (which returns it). Navigating away drops it back. The tweezers are never left "holding" across a
  resume.

### 4.3 Rendering cost
- 196 beads as DOM nodes with gradients is fine if they are **static**: no per-bead framer and no
  per-bead `will-change`.
- Only the **just-placed** bead plays a one-shot drop (transform/opacity). The legend glow is one
  overlay, not 30 animated beads.
- The pop-off "alive" moment animates **the board container**, not each bead.
- Measure with `perf.mjs` at Svær's largest board.
- If DOM cost is too high on the A10X, render the placed beads to one canvas. Bead art is deterministic
  code, so that's a drop-in.

### 4.4 Pattern data
- Patterns are hand-authored grids. **Derive** legend counts from the grid, and **test** that:
  - every pattern fits inside its level's board mask
  - every pattern uses only palette colours available at its level (Let's 8)
  - every legend count is ≤ 100 (the prebaked number range)
  - each pattern at Svær is not just Let's grid scaled up (distinct designs, or at least finer detail)
- Symmetric patterns (hjerte, sommerfugl, stjerne) are **tested for symmetry**, so a typo in a row
  shows.

### 4.5 Session and confirm
- Reuse `kreaSession`: key per pattern/board item, value = the placed-bead map. Same lifecycle (clear on
  next-after-done, confirm-yes, profile switch, resetAll).

## 5. What must NOT change
Everything in PRD-01 §5:
- The free board earns no XP. No grading.
- The wrong-colour bounce is silent of judgement: no buzzer, no "forkert", no red flash.
- Nothing persists beyond the session.
- Numbers are Typography.
- One audio at a time.

## 6. Work stages
- **W0 — Art** (bowls, pegboard plastic per shape, tweezers, pattern card frame, tile icon), from
  `krea-art-prompts.md`.
- **W1 — `kreaBeads` + `beadBoard`**, pure, with every §4.4 test.
- **W2 — The board, gestures, free board end to end.** Drag + tap through `placeBead`, the 40 px pitch
  test, pop-off, session. **Stop for the owner's iPad feel check** (drag vs tap, bead size at Let).
- **W3 — Copy a pattern.** Card, legend + spoken counts, bounce-back, the 2-miss hint, XP + seam.
  Narration prebaked.
- **W4 — Guards, `games-krea.md` update (within its byte cap), screenshots.**

## 7. Verification
**Rungs 1–2:**
- Board fit at every level on the iPad landscape/portrait viewports and phone.
- A synthetic drag and a synthetic tap-tap both place the same bead.
- A wrong colour springs back.
- The hint after 2 misses.
- The legend tap speaks the number (`--audio-report`).
- `perf.mjs` on the Svær board, full and at rest.

**Guards, each re-broken:**
- the pitch ≥ 40 px test
- pattern-inside-mask
- palette-per-level
- legend ≤ 100
- symmetry
- `placeBead` as the single resolver (break: a tap path that bypasses it)
- the wrong-colour bounce leaving the board unchanged
- free board having no `useTaskRun`

**Rung 3 (iPad, UNKNOWN until then):**
- whether dragging beads one at a time is fun or tedious at Normal/Svær (the owner chose drag
  knowingly; watch the child)
- whether a drag also registers a tap (the known tap/drag parity residue)
- whether bead size at Let is right for a 5-year-old's finger

## 8. Out of scope
- An ironing finale.
- Continue-the-sequence patterns.
- Hex-offset boards.
- Glow-in-the-dark beads.
- Clicking boards together.
- Saving or printing a pattern.
- Bucket fill or row-paint shortcuts (the owner chose one bead at a time).

## 9. Kickoff prompt for a fresh session

> Implement `plans/krea/tmp-prd-krea-02-perleplade.md` (Perleplade, the 4th Krea tile). PRD-01 must
> already be shipped; read its §2 and §4 first, then this file's §4, then `drag-and-drop.md`. Start with
> W1 (pure pattern data + board model, with every §4.4 test), then W2, and stop there for the owner's
> iPad feel check on drag vs tap. Re-break every guard in §7 and name the rung for every claim.
