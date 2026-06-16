# UI/UX Polish Sweep — all games

**Goal:** bring every game/screen to the app's visual bar (the lifted-3D, framed, themed look —
Farvejagt is the reference), autonomously. Triggered after the Ram Farven uplift, which is the
template for this pass.

**Mode:** fully autonomous (owner chose this) — execute per game, commit per game, report at the end.
Runs across multiple sessions (context limits); this file is the resumable tracker.

## The rubric (apply to each game)

1. **Capture matrix** — screenshot via the `ui-screenshot` skill at **portrait (540×940)**,
   **landscape (900×500)**, **iPad (1024×768)**, in the **default (light) theme AND a dark theme
   (Rummet/`space`)**, across **every meaningful state**: idle/empty, mid-interaction, correct,
   wrong, hint/scaffold, round-result, any overlay. Seed transient states temporarily (set initial
   state / short-circuit a reset), screenshot, then **revert** — see Ram Farven history for the
   pattern (e.g. force `recipe`, seed `mixingZone`, force a hint). To preview a dark theme on the
   headless driver (fresh profile each run), temporarily set `defaultThemeId = spaceThemeTokens.id`
   in `src/theme/themes.ts`, then revert.
2. **Evaluate vs the bar:**
   - **Framing & cohesion** — contained framed stage where appropriate; matches the lifted-3D /
     themed look; consistent with Farvejagt/peers.
   - **Sizing & balance** — content fills the stage; no dead space; no clipping; **no scroll** in any
     orientation (esp. landscape).
   - **Duplicate / redundant info & clutter** — one source of truth per fact; minimal text for a
     non-reader; remove repeated representations of the same thing.
   - **Dark-theme correctness** — readable on dark immersive scenes (token-driven, `scene.dark`).
   - **Affordances** — clear "what do I do" cues; ≥44px targets; Comic Sans; Danish only.
3. **Fix** the issues (token-driven, reuse existing components/patterns; no hardcoded styling).
4. **Verify** — re-screenshot the key states/sizes/themes; `npm run build` + (file) lint clean;
   delete temp PNGs; commit (`<Game> UI polish: …`).

## Constraints
- Dev servers must run (Win PowerShell): `npm run dev` + `npm run dev:api` (ports 5173/3001).
- Don't change game mechanics/content — visual/layout/clutter only (unless an obvious bug).
- Educational color data stays as data. Honor `.claude/rules` (audio/responsive/game-dev).

## Tracker (status per route)

| Status | Route | Component | Notes |
|---|---|---|---|
| ✅ done | `/farver/ram-farven` | RamFarvenGame | Template for this sweep |
| 🟦 reference | `/farver/jagt` | FarvejagtGame | The bar; verify it still holds |
| ✅ at bar | `/math/counting` | MathGame | Shared UnifiedQuizGame engine — clean, near-number distractors |
| 🟨 minor | `/math/numbers` | NumberLearning | OK; 100-grid is dense/tiny in landscape (learning-only, low stakes) — revisit if time |
| ✅ done | `/math/addition` | MathOperationGame | Bumped operator-tile size (38/54→48/68) for balance |
| ✅ done | `/math/subtraction` | MathOperationGame | Same symbol-size fix (shared component) |
| ✅ at bar | `/math/comparison` | ComparisonGame | Framed card + krokodille reads well |
| ✅ at bar | `/math/patterns` | HvadManglerGame | Shared UnifiedQuizGame engine — clean |
| ⬜ todo | `/alphabet/learn` | AlphabetLearning | learning grid |
| ⬜ todo | `/alphabet/quiz` | AlphabetGame | UnifiedQuizGame config |
| ⬜ todo | `/english/listen` | EnglishListenGame | UnifiedQuizGame config |
| ⬜ todo | `/english/word` | EnglishWordGame | UnifiedQuizGame config |
| ⬜ todo | `/english/translate` | EnglishTranslateGame | UnifiedQuizGame config |
| ⬜ todo | `/english/learn` | EnglishLearning | browse |
| ⬜ todo | `/ordleg/read` | LaesOrdetGame | UnifiedQuizGame config |
| ⬜ todo | `/ordleg/spelling` | SpellingGame | hand-rolled |
| ⬜ todo | `/ordleg/mic` | SpeakWordGame | hand-rolled (mic) |
| ⬜ todo | `/learning/memory/:type` | MemoryGame | letters + numbers |
| ⬜ todo | menus | GameSelectionLayout + Home | section pickers + front page |

> **Efficiency note:** many games are thin configs over `UnifiedQuizGame` — fixing the shared engine's
> layout polishes all of them at once; then per-game only the content differs. Triage the shared
> engine first.

## Continue-this-sweep prompt (fresh session)
```
Continue the autonomous UI/UX polish sweep per plans/ui-polish-sweep.md. Take the next ⬜ todo
route(s), apply the rubric (screenshot all states/sizes + a dark theme, evaluate, fix, verify with
build + ui-screenshot, commit), update the tracker status, and report. Dev servers are on 5173/3001.
```
