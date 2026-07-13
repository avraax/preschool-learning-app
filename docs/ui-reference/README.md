# UI Reference Screenshots

Canonical screenshots of **every view in the app**, captured headlessly for UI/UX polish sessions
("pixel perfect" pass). Reference these before/while redesigning — and re-capture after, so this
folder always reflects the shipped UI.

- **Captured**: 2026-07-13, build `867717b` (v1.0.45)
- **Theme**: Regnbue (default — fresh localStorage). Other skins (Havet, Rummet, Junglen,
  Slikland, Dinosaurer) share the same layout; only tokens differ.
- **Capture tool**: `.claude/skills/ui-screenshot/cdp.mjs` (headless Chrome, audio modal
  auto-dismissed). JPEG q85. To re-capture the full set, ask Claude — the capture script
  pattern lives in the git history of `.bug-reports/uiref.ps1` and in this README.

## Folders

| Folder | Viewport | What |
|---|---|---|
| `ipad/` | 1180×820 (iPad Air landscape) | **Primary design surface** — every route |
| `phone/` | 844×390 (iPhone 13 Pro landscape) | The phone-compact variant (`src/theme/phoneMedia.ts` guards) — every route |
| `portrait/` | 390×844 | Key portrait references (home, menu, quiz, drag board, memory-20, album) |
| `overlays/` | 1180×820 | States routes can't show: adult menu, bug reporter, voice panel, reset gate, crash screen, audio-permission modal |

## File → view map (`ipad/` and `phone/` share names)

| File | Route | View |
|---|---|---|
| `home` | `/` | Front page (section cards + Min Bog shelf) |
| `alphabet` | `/alphabet` | Alfabetet menu |
| `alphabet-learn` | `/alphabet/learn` | Lær Alfabetet (A–Å browse) |
| `alphabet-quiz` | `/alphabet/quiz` | Bogstav Quiz (word-association) |
| `math` | `/math` | Tal og Regning menu (8 cards) |
| `math-counting` | `/math/counting` | Tal Quiz |
| `math-numbers` | `/math/numbers` | Lær Tal (1–100 grid) |
| `math-addition` / `math-subtraction` | `/math/addition` `/math/subtraction` | Plus/Minus Opgaver (equation card) |
| `math-comparison` | `/math/comparison` | Sammenlign Tal (krokodille) |
| `math-patterns` | `/math/patterns` | Hvad Mangler? |
| `farver` | `/farver` | Farver menu (5 cards) |
| `farver-laer` | `/farver/laer` | Lær Farver (shade trio browse) |
| `farver-jagt` | `/farver/jagt` | Farvejagt (drag board + target ring) |
| `farver-quiz` | `/farver/quiz` | Hvilken Farve? (drag onto swatch) |
| `farver-ram-farven` | `/farver/ram-farven` | Ram Farven (mixing station + droplets) |
| `farver-nuancer` | `/farver/nuancer` | Nuancer (light→dark slots) |
| `english` | `/english` | Engelsk menu |
| `english-listen` / `english-word` / `english-translate` | `/english/…` | The three English quizzes |
| `english-learn` | `/english/learn` | Lær Engelsk (theme chips + word cards) |
| `ordleg` | `/ordleg` | Ordleg menu |
| `ordleg-read` | `/ordleg/read` | Læs Ordet (silent decoding) |
| `ordleg-spelling` | `/ordleg/spelling` | Stav Ordet (letter slots + tiles) |
| `ordleg-mic` | `/ordleg/mic` | Sig et Ord (mic button) |
| `learning-memory-letters-10` | `/learning/memory/letters/10` | Memory 10-pair board |
| `learning-memory-numbers-20` | `/learning/memory/numbers/20` | Memory 20-pair board |
| `album` | `/album` | Min Klistermærkebog (sticker album) |

## Not captured (needs live play — grab manually or extend the script later)

- `RoundResultScreen` (stars → rekord ribbon → sticker reveal) — appears after 8 answers
- Answer feedback states (correct glow / wrong shake), memory card flips, drag-in-flight
- `/voicelab` (hidden throwaway tool — intentionally excluded)
- Per-theme variants (re-capture `home` after switching skin in the ThemeSelector)
