# UI Reference Screenshots

Canonical screenshots of **every view in the app**, captured headlessly for UI/UX polish sessions
("pixel perfect" pass). Reference these before/while redesigning — and re-capture after, so this
folder always reflects the shipped UI.

- **Captured**: 2026-08-01, v1.0.45 — **the entire set, in one pass, after the de-emoji PRD completed.**
  Nothing here predates it, so the per-build notes this file used to carry are gone.
- **Theme**: Regnbue (default — forced via `?theme=kid`). Other skins (Havet, Rummet, Junglen,
  Slikland, Dinosaurer) share the same layout; only tokens differ.
- **Capture tool**: `.claude/skills/ui-screenshot/cdp.mjs` (headless Chrome). JPEG q85. The route
  sweep is scripted in the gitignored **`.bug-reports/uiref.sh`** — run it with both dev servers up
  (Windows PowerShell, not WSL). The `overlays/` set needs per-dialog `--eval` clicks and is not in
  that script.
- **`?nogate=1` is mandatory** since the accounts release: it bypasses the auth gate AND the audio
  welcome, and attaches a stand-in dev child so `progressStore` isn't inert. Without it, every capture
  is just the lock screen.
- Opening the adult menu is a plain click (the `?adult-tap=1` hold-workaround is gone) but still needs
  **~4.5s of settle** — it captures a snapdom screenshot before rendering, so a shorter wait silently
  yields the un-opened page.
- **`overlays/audio-blocked-cue.jpg` replaced `overlays/audio-permission.jpg`.** The blocking "Tænd for
  lyd" modal was deleted (Audio activation PRD-01); the small non-blocking "Tryk for lyd" chip shows only
  while the evidence-based verdict is `blocked`. The old shot was removed rather than kept — a reference
  picture of UI that can never appear again is a trap, not a record.
  **It IS re-capturable**, unlike most overlays, but only with the whole recipe — the cue is unreachable
  by default because `?nogate=1` stands it down and, without `?nogate=1`, `authUiOpen` does:
  ```bash
  node .claude/skills/ui-screenshot/cdp.mjs --url "http://127.0.0.1:5173/alphabet?nogate=1&audio-cue=1" \
    --w 1024 --h 768 --block-autoplay --simulate-audio-blocked --wait-for '#root > *' --settle 1500 \
    --trusted-tap '[aria-label="Bogstav Quiz"]' --settle 2500 \
    --out docs/ui-reference/overlays/audio-blocked-cue.jpg
  ```
  `--trusted-tap` is load-bearing: `element.click()` grants no `navigator.userActivation`, so the verdict
  correctly stays `idle` and no cue appears. The phone shot uses `--w 844 --h 390` — a DIFFERENT layout
  there (bottom-centre, because that shell moves the game title into the header row), so capture both.
- **`overlays/auth-pin-pad.jpg` cannot be re-captured headlessly** and is deliberately older than the
  rest: the PIN pad needs a PIN actually set on the account. Overwriting it yields a picture of the page
  *behind* the overlay, which is worse than a slightly old but correct one — if you try, check the
  result before committing.

**What this pass shows (de-emoji PRD, complete):** **no view in the app renders an OS-font emoji any
more.** Section-menu game tiles and home cards are baked icon art; Min Bog's 45 reward slots, its 5
chapter tabs and the corner RewardRing are baked reward art; the result screen's star/trophy/flame and
Min Bog's book/sparkle come from `src/assets/ui/`; the theme picker shows baked skin thumbnails; child
profiles show baked avatar portraits; and every adult dialog is on lucide icons.
`overlays/profiles-panel.jpg` is NEW in this pass.

**Hvilken Farve?, re-captured 2026-08-05 (Difficulty PRD-02).** `ipad/farver-quiz` and
`phone/farver-quiz` were the last stragglers from before the object was greyed out at all — the old pair
showed a **red car in full colour**, i.e. both the pixel-match giveaway and a non-canonical subject the
game no longer asks. New `ipad/farver-quiz-let` covers the 3-swatch Let board. These three are the only
game captures taken at `?rewards=12` besides `home`/`album`, so the header ring reads as played rather
than empty; the rest of the set has an empty gauge because a fresh Chrome profile has no progress.

**Adult settings, re-captured 2026-08-02 (Settings PRD-01).** The `overlays/` set no longer contains
`adult-menu`, `profiles-panel`, `theme-panel`, `difficulty-panel` or `voice-panel` — that flat
13-row scrolling dialog and its six sibling sub-panels were replaced by ONE two-pane surface with a
persistent rail (Barn / Læring / Lyd / Udseende / Konto) and a support footer. `overlays/phone/` is
new: the adult area had never been captured at a phone size at all. Recipe for these:
`--click '[aria-label="Til de voksne"]' --wait-for '.MuiDialog-paper' --settle 4500`, then
`--click '[data-rail-item=<group>]'` for a pane (on 844×390 the rail is only rendered at the root, so
click `[aria-label="Tilbage"]` first).

## Folders

| Folder | Viewport | What |
|---|---|---|
| `ipad/` | 1180×820 (iPad Air landscape) | **Primary design surface** — every route |
| `phone/` | 844×390 (iPhone 13 Pro landscape) | The phone-compact variant (`src/theme/phoneMedia.ts` guards) — every route |
| `portrait/` | 390×844 | Key portrait references (home, menu, quiz, drag board, memory-20, album) |
| `overlays/` | 1180×820 | States routes can't show: the five settings panes (`settings-barn`, `settings-laering`, `settings-lyd`, `settings-udseende`, `settings-konto`), their nested task dialogs (`settings-reset-confirm`, `settings-logout-confirm`, `settings-create-profile`, `settings-delete-account-pin`), bug reporter, crash screen, the audio-blocked cue (`audio-blocked-cue`), and the auth surfaces (`auth-lock-screen`, `auth-pin-pad`, `auth-profile-picker`) |
| `overlays/phone/` | 844×390 | The settings surface's COMPACT variant — the root list (`settings-root`) plus each pushed pane. The adult area had zero phone coverage before the settings rework |

## File → view map (`ipad/` and `phone/` share names)

| File | Route | View |
|---|---|---|
| `home` | `/` | Front page (section cards + Min Bog shelf) — captured at `?rewards=12` |
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
| `farver-quiz` | `/farver/quiz` | Hvilken Farve? (drag onto swatch) — the prompt object is DESATURATED at every level (Difficulty PRD-02) |
| `farver-quiz-let` (ipad only) | `/farver/quiz` | The same board at **Let**: 3 swatches, and no wheel neighbour of the answer among them. Captured with `window.__progress.setDifficulty({global:'let'})` in an `--eval`, since Let is where PRD-02 changed the board |
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
| `album` | `/album` | Min Bog (the Reward Book) — captured at `?rewards=12` so all three slot states show (collected / next silhouette / blank) |

## Not captured (needs live play — grab manually or extend the script later)

- `RoundResultScreen` (stars → rekord ribbon → sticker reveal) — appears after 8 answers
- Answer feedback states (correct glow / wrong shake), memory card flips, drag-in-flight
- `/voicelab` (hidden throwaway tool — intentionally excluded)
- Per-theme variants (re-capture `home` after switching skin in the ThemeSelector)
