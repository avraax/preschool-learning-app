---
paths:
  - "src/components/ordleg/*.tsx"
---

# Games catalog — Ordleg — `ordleg.read/.spelling`

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
- **There is no speech-input game.** Ordleg had a third game, "Sig et Ord", which recorded the child
  and sent the audio to a speech recogniser; it was removed in full on 2026-09-18 — game, `/api/stt`,
  the mic consent switch, the iOS purpose string and every privacy disclosure that described it. **The
  app now uses no microphone at all**, and `capacitorConfig.test.ts` fails if a purpose string or a
  `getUserMedia` call comes back. Do not reintroduce one without reopening `src/config/legalContent.ts`,
  which states plainly to parents that neither mic nor camera is used.
