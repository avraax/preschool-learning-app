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
| ✅ done | `/math/numbers` | NumberLearning | Lifted tiles + landscape card compaction → dense grid legible (shared LearningGrid fix) |
| ✅ done | `/math/addition` | MathOperationGame | Bumped operator-tile size (38/54→48/68) for balance |
| ✅ done | `/math/subtraction` | MathOperationGame | Same symbol-size fix (shared component) |
| ✅ at bar | `/math/comparison` | ComparisonGame | Framed card + krokodille reads well |
| ✅ at bar | `/math/patterns` | HvadManglerGame | Shared UnifiedQuizGame engine — clean |
| ✅ done | `/alphabet/learn` | AlphabetLearning | Lifted tiles + landscape card compaction (shared LearningGrid fix) |
| ✅ at bar | `/alphabet/quiz` | AlphabetGame | Shared UnifiedQuizGame engine — lifted AnswerTiles, word-association reads clean |
| ✅ at bar | `/english/listen` | EnglishListenGame | Shared engine — green tiles/repeat, spot-checked |
| ✅ at bar | `/english/word` | EnglishWordGame | Shared engine — spot-checked |
| ✅ at bar | `/english/translate` | EnglishTranslateGame | Shared engine — spot-checked |
| ✅ done | `/english/learn` | EnglishLearning | Lifted-3D word cards (green edge lip + active glow), dark-correct |
| ✅ at bar | `/ordleg/read` | LaesOrdetGame | Shared engine — teal tiles, no prompt-word audio (correct), spot-checked |
| ✅ done | `/ordleg/spelling` | SpellingGame | Lifted-3D letter tiles (hint glow / shake edge) + landscape balance |
| ✅ done | `/ordleg/mic` | SpeakWordGame | Fixed landscape mic-off-screen + lifted tiles + dark-readable text |
| ✅ at bar | `/learning/memory/:type/:size` | MemoryGame | Already lifted-3D (prior overhaul); verified sizing (10/20) + match glow + dark all hold |
| ⬜ todo | menus | GameSelectionLayout + Home | section pickers + front page |

> **Efficiency note:** many games are thin configs over `UnifiedQuizGame` — fixing the shared engine's
> layout polishes all of them at once; then per-game only the content differs. Triage the shared
> engine first.

## Operational details (read before running — saves a fresh session from re-deriving)

### Screenshots (the `ui-screenshot` skill / `cdp.mjs`)
Exact command (portrait default 540×940; add `--w 900 --h 500` for landscape, `--w 1024 --h 768` for iPad):
```bash
node .claude/skills/ui-screenshot/cdp.mjs --url "http://127.0.0.1:5173/<route>" \
  --wait-for '#root > *' --settle 1600 --out /tmp/shot.png
```
- **Do NOT pass `--click-text 'Start lyd nu'`.** The driver auto-dismisses the audio modal itself
  (it launches with autoplay allowed). Passing it makes the run exit 1 ("NOT FOUND") whenever the
  modal was already gone, which breaks `&&` chains/loops. Just rely on the built-in dismiss.
- **Read the PNG at its real Windows path**, not `/tmp`: `/tmp/shot.png` actually lands at
  `C:/Users/<user>/AppData/Local/Temp/shot.png` (the run prints the resolved path). Read that.
- Always check the printed `console errors` / `page exceptions` lines (should be 0).
- Delete temp PNGs when done.

### Capturing transient states (drag/flow states the headless driver can't trigger)
Temporarily seed React state, screenshot, then **revert**. Worked example from Ram Farven:
- **Force the recipe card:** set the `recipe` useState initial to a literal object, AND comment the
  `setRecipe(null)` line inside the game's `setupTarget`-equivalent (the init reset wipes a seeded
  value), screenshot, revert both.
- **Droplet-in-pot / button states:** seed the relevant array state (e.g. `mixingZone`) initial +
  comment its reset; **force a hint** by short-circuiting the guard (e.g.
  `const recipePair = recipeFor(targetColor.name)` instead of `hintActive ? … : null`).
- After each: revert the temp edit and grep for leftovers (`TEMP`, seeded literals) before moving on.

### Previewing a dark theme on the headless driver
The driver uses a fresh Chrome profile each run, so the persisted theme (`localStorage`
`bornelaering-theme`) won't stick. Temporarily set `export const defaultThemeId = spaceThemeTokens.id`
in `src/theme/themes.ts` (Rummet, the dark immersive scene), screenshot, then revert to
`kidThemeTokens.id`. Verify text/surfaces stay readable (`muiTheme.scene.dark` paths).

### Reference patterns to copy (this is "the bar")
- **Framed play board:** `src/components/farver/FarvejagtGame.tsx:520-531` (token `boardBg`, `borderRadius:4`,
  `3px solid t.borderColor`, `customShadows.card`, `overflow:hidden`, `flex:1`).
- **Target pill:** `FarvejagtGame.tsx:486-512`.
- **Lifted-3D depth language:** `src/components/common/AnswerTile.tsx` (accent border, darker 3D lip,
  layered shadow, top-light gradient; helpers `darken`/`hexToRgba` in `src/theme/tokens/helpers.ts`).
- **Worked example of this whole rubric:** `src/components/farver/RamFarvenGame.tsx` (framed board,
  goal→pot, label chips, drop affordance, solid recipe card, landscape side-tray, dark-theme handling).
- Theme access: `getCategoryTheme('<cat>')` + `useTheme()` → `muiTheme.scene.dark`,
  `muiTheme.customShadows.card`, `theme.decor.*`. Never hardcode styling. Comic Sans; Danish only.

### Per-remaining-route hints (what to look for)
- **Learning grids** (`NumberLearning`, `AlphabetLearning` → shared `src/components/common/LearningGrid.tsx`):
  in landscape the dense grid (esp. 100 numbers) gets tiny/sub-44px cells — check legibility/targets;
  consider giving the grid more room (e.g. smaller current-item card in landscape). Shared component →
  one fix helps both.
- **`SpellingGame` / `SpeakWordGame`** (hand-rolled): check framing/balance + dark theme + all states
  (idle, recording, result) against the bar.
- **`MemoryGame`**: check card grid sizing in landscape (sub-44px on phones), flip/match states, dark theme.
- **Menus** (`GameSelectionLayout`, Home in `App.tsx`): already fairly polished — verify cohesion + dark theme only.
- **Quiz games** (anything that is a `UnifiedQuizGame` config — alphabet quiz, all English quizzes, Læs
  Ordet, Tal Quiz, Hvad Mangler): the shared engine is already at bar — only spot-check each one's
  content (visual question / word tiles), don't rework.

### Commit per route
On a branch (currently `feature/games-overhaul`). Stage only the files you changed for that route
(don't sweep up unrelated working-tree edits). Message form:
```
<Game> UI polish: <one-line what changed>

<short why / before→after>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```
Then update this file's tracker status and continue.

## Continue-this-sweep prompt (fresh session)
```
Run the autonomous UI/UX polish sweep per plans/ui-polish-sweep.md (read the whole file first,
especially "Operational details"). Work fully autonomously — do NOT ask me design questions; make
taste calls against the reference bar (RamFarvenGame / FarvejagtGame) and show before/after in your
report. Take the next ⬜ todo / 🟨 minor route(s), apply the rubric (screenshot all meaningful
states at portrait + landscape + iPad and in the dark Rummet theme, evaluate, fix, verify with
npm run build + ui-screenshot, delete temp PNGs, commit per route, update the tracker status), then
report what changed. Dev servers run in Windows PowerShell on 5173/3001 (start them if down:
`node --env-file=.env.local dev-server.js` and `node node_modules/vite/bin/vite.js --host 127.0.0.1`).
```
