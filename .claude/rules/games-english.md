---
paths:
  - "src/components/english/*.tsx"
---

# Games catalog — English — `english.listen/.word` (+ Lær Engelsk browse)

One section of the games catalog. The cross-game invariants it relies on — the difficulty spine, the
no-giveaway rule, pool-vs-bag, both-gestures — are in `.claude/rules/games-catalog.md`, which loads
alongside this file.

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
