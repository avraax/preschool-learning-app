---
paths:
  - "src/components/ordleg/*.tsx"
---

# Games catalog — Ordleg — `ordleg.read/.spelling/.mic`

One section of the games catalog. The cross-game invariants it relies on — the difficulty spine, the
no-giveaway rule, pool-vs-bag, both-gestures — are in `.claude/rules/games-catalog.md`, which loads
alongside this file.

- Læs Ordet **never AUTO-reads the prompt word** — silent decoding IS the exercise. The correct-tap
  **does** speak the tapped picture's name — that names the child's *choice*, not the prompt, so it's
  not a violation. Thin `UnifiedQuizGame`; after 2 wrong picture taps the correct picture pulses.
  The prompt word is **plain uniform uppercase type, every letter identical** — PRD-18 W1's
  first-letter emphasis is gone (see `game-development.md`); the only help this game gives is the
  picture-tap hint.
- Stav Ordet (hand-rolled): after 2 wrong taps on a slot the correct tile pulses (never-fail
  next-letter hint; reduced-motion → static glow; using it costs a star).
- Sig et Ord is **open-ended** — say any word → it's spelled back. **No target word, no STT grading**;
  a recognized word counts, an STT mishear stays on the same question without counting. It stays
  **hold-to-talk** (owner, 2026-08-04, offered tap-to-talk with auto-stop and chose the hold), and the mic
  is opened once per visit rather than per press. It has **no `promptStage`**: the mic IS the board, so it
  owns its column and GameShell centres it — the prompt band left half the screen empty at idle. The
  capture rules (model, mic lifecycle, transcript normalisation) are in `.claude/rules/audio-system.md`.
