# PRD — Immersive Game-Page Rework ("Play-Stage in the World")

> Authoritative spec for lifting the in-game screens to the visual quality of the menus.
> Pilot on Tal Quiz, then propagate. Builds on Theme Worlds (P0–P3) + App-wide UI Uplift
> (P4). Read alongside `APP_UI_UPLIFT_PRD.md`, `THEME_WORLDS_PRD.md`, `CLAUDE.md`,
> `.claude/rules/*`.

## Context

The theme worlds (P0–P3) and the menus look designed and premium. The **game pages still
look like a functional quiz on a pretty background.** Concretely, from the code + screenshots:

- The "teacher" is a **flat emoji** — `LottieCharacter` never loads Lottie JSON; it renders
  🦊/🦉 with CSS. It clashes with the soft-3D world.
- **Header iconography is inconsistent**: `UnifiedQuizGame` shows the real soft-3D section icon
  (`math.webp`), but hand-rolled games (e.g. `MathOperationGame`) show a flat 🧮 + `−` emoji.
- **Answer cards are flat white**; math operators are emojis.
- `MathOperationGame` has a **layout bug**: the "Hvad bliver svaret? 🤔" line sits *behind* the
  equation card (no top spacing; the flex:1 answer grid pushes the card up).
- We added a dimmed world backdrop (`GameMotif`) — good — but the foreground is still unstyled.

**Goal:** lift game pages to the same designed, immersive, soft-3D quality as the menus.
**Pilot on Tal Quiz (the shared `UnifiedQuizGame`, which powers 7 quizzes), perfect it, then
propagate.** Outcome: a consistent, delightful, on-theme play surface a 5-year-old loves.

## Locked decisions (from planning)

1. **Pilot = Tal Quiz** (`UnifiedQuizGame`) — highest leverage (auto-lifts 7 quiz games).
2. **Guide = the existing per-theme world mascot** (astronaut/whale/dino/bear) — **no new
   character art**; "who teaches" changes with the theme (accepted).
3. **Answer tiles = tactile soft-3D tiles** (CSS: gradient, depth, themed edge, pressed state).
4. **Math symbols = soft-3D symbol tiles** (the ONE new Gemini art set: `+ − = ? > < × ÷`).
5. **Guide placement = bottom-corner companion** (reacts from the corner).
6. **Architecture = shared `GameShell`** every game adopts (incremental, after the pilot).
7. **Feedback = full** (correct: tile glow + star pop + mascot cheer; wrong: shake + mascot think).
8. **Content stays emoji** (🍎🐒 objects/animals/words) — only chrome (guide/tiles/symbols) is upgraded.

## Guardrails (unchanged)

No game difficulty/range/logic changes (visual only). Educational colors (Farvejagt/RamFarven)
never themed. No-scroll full-viewport; ≥44px targets; respect `prefers-reduced-motion`; audio stays
centralized (single channel, no queue). Add zero new lint problems; per-phase build+lint green →
iPad check → commit. Per-theme art ≤700KB.

## Design

### A. `GameShell` (new — `src/components/common/GameShell.tsx`)
Unified scaffold all games render their content into. Provides:
- `position: relative; isolation: isolate; height: 100dvh; overflow: hidden` root + category
  gradient base + `<GameMotif/>` backdrop (already built).
- **Header**: back button (left), **themed title** (`titleFontFamily` + dark-scene light/glow
  treatment — already shipped) — **drop the redundant section icon**; score slot (right).
- **Corner `<GameGuide/>`** (bottom-left, clear of the version chip).
- `<CelebrationEffect/>` (themed — already shipped).
- A `children` content slot (the per-game body).
Props: `categoryId`, `title`, `backRoute`, `score` node, optional `guideReaction`. `UnifiedQuizGame`
renders its prompt/repeat/answer-grid inside it; hand-rolled games migrate in Phase C.

### B. `AnswerTile` (new — `src/components/common/AnswerTile.tsx`)
Reusable tactile tile replacing the flat white answer `Card`s. Pure CSS: rounded (~18px), soft
top-light gradient over white (kept high-contrast), themed accent edge/border, layered drop
shadow (deeper on `scene.dark`), `:active`/tap pressed state, focus ring. Big content glyph on
top (number/letter/emoji/word — typography unchanged). Correct→glow+sparkle, wrong→shake (Phase E).

### C. `SymbolTile` (new — `src/components/common/SymbolTile.tsx`) + equation presentation
Renders a soft-3D symbol image (`symbolImages[op]`) for `+ − = ? > < × ÷`. Used to rebuild the
math equation as a clean "number sentence" (styled number type + SymbolTiles), and the comparison
symbol buttons. **Fixes the `MathOperationGame` layout bug** (proper flex column, gap, repeat
button below — not inside — the equation; question line no longer overlaps).

### D. `GameGuide` (new thin wrapper, or extend `ThemeMascot`)
Reuses the theme mascot (existing `loadSceneAssets(themeId).mascot` + `ThemeMascot` patterns).
Bottom-left corner on game pages, smaller than home. Idle bob; **reacts**: `cheer` (happy
jump/scale + themed burst — reuse `ThemeMascot`'s burst) on correct, `think` (gentle shake) on
wrong; tap → encouragement line via the existing single audio channel. Reduced-motion → static.

### E. Full feedback
On answer: correct → tapped `AnswerTile` glows + a **star pop** (CSS sparkle / reuse themed
celebration particles — no new art) + `GameGuide` cheers + existing themed `CelebrationEffect`.
Wrong → tile shake + `GameGuide` think. Wired via the shell + tile props; no logic/scoring change.

### F. Loading polish (the "takes some time" gripe; keeps welcome-then-cards)
While the welcome gate is pending, render **placeholder/shimmer tiles** in the answer grid so the
board never looks empty/broken. (Quiz resilience fallback already shows real tiles ≤2.5s.)

## Art (Gemini) — only the math symbol tiles

Pipeline (existing): generate PNG on **solid #FF00FF** → `art-src/symbols/<op>.png` → extend
`scripts/optimize-theme-art.mjs` with a `symbols` group (~160px, q90, magenta-keyed) → outputs
`src/assets/symbols/*.webp` → add a `symbolImages` registry (mirror `src/assets/themes/icons`).
Star-pop + guide reuse existing assets/CSS (no art). Generate 8 tiles, consistent friendly palette:

- **plus**: "Soft 3D rendered children's illustration, Pixar/Disney style: a single chunky rounded glossy PLUS sign (+), warm sunny orange, soft global lighting, rounded bevelled edges, gentle depth, centered, no extra text, no scary elements, solid pure magenta #FF00FF background."
- **minus / equals / question / greater (>) / less (<) / times (×) / divide (÷)**: same prompt, swapping the glyph (and a coherent palette — e.g. orange operators, teal `=`, purple `?`).

## Phases (each: build → `npm run build` + changed-file lint → iPad check → commit)

- **Phase A — Pilot (Tal Quiz / `UnifiedQuizGame`)**: build `GameShell`, `AnswerTile`, `GameGuide`;
  refactor `UnifiedQuizGame` to use them; full feedback; loading placeholders. This auto-lifts all
  7 quiz games. Validate look/feel on iPad before propagating.
- **Phase B — Math symbols**: generate symbol tiles (owner) → `SymbolTile` + `symbolImages`;
  rebuild `MathOperationGame` (fix layout bug) + `ComparisonGame` equation/symbol presentation.
- **Phase C — Propagate**: adopt `GameShell`/`AnswerTile`/`GameGuide`/feedback in the remaining
  hand-rolled games (`SpellingGame`, `SpeakWordGame`, `AlphabetLearning`, `NumberLearning`,
  `EnglishLearning`, `FarvejagtGame`, `RamFarvenGame`, `UnifiedMemoryGame`). Color CONTENT untouched.
- **Phase D — QA**: no-scroll portrait+landscape, contrast (esp. dark Rummet), reduced-motion,
  asset budget ≤700KB, changed-file lint clean. Then commit; remaining audio-resilience rollout
  (MathOp/Comparison/Spelling/SpeakWord/Memory) folds in here.

## Files

- **New**: `src/components/common/GameShell.tsx`, `AnswerTile.tsx`, `SymbolTile.tsx`,
  `GameGuide.tsx`; `src/assets/symbols/index.ts` (+ `art-src/symbols/*.png`).
- **Edit**: `src/components/common/UnifiedQuizGame.tsx` (adopt shell/tiles/feedback),
  `GameHeader.tsx` (fold into shell or align), `ThemeMascot.tsx` (reaction prop, reuse for guide),
  `scripts/optimize-theme-art.mjs` (symbols group), the hand-rolled game components (Phase C).
- **Reuse**: `GameMotif`, `CelebrationEffect` (themed), `ScoreChip`/`RepeatButton` (polished),
  `loadSceneAssets`, `sectionIconImages` pattern, `getCategoryTheme`, theme tokens.

## Verification

Per phase: `npm run build` (tsc+vite) green; `npx eslint <changed files>` adds zero new problems
(repo has ~130 pre-existing — don't chase them); on-device iPad check across light + dark (Rummet)
themes and 2–3 game types; reduced-motion off→on; portrait+landscape no-scroll; active-theme art
≤700KB. Pause for owner iPad confirmation before each commit; commit per phase.

Note: the owner runs both dev servers in **Windows PowerShell** (not WSL — WSL causes 502 on
/api). On Windows the build/lint commands are run via PowerShell.

---

## APPENDIX — execution details for a fresh session

### A0. Current state — READ FIRST
- **P3 (menus) committed** as `d14e6f8` on `master`. **P4 visual work committed** in the same
  commit batch as this PRD (the commit that added this file). The tree should be clean at start.
- P4 already shipped (so DO NOT reinvent):
  - `src/components/common/GameMotif.tsx` — dimmed/blurred **world backdrop** behind game pages
    (z-index:-1). All game roots have `position:relative` + **`isolation:'isolate'`** (needed so the
    z-1 backdrop sits above the gradient — without it the backdrop is invisible behind the bg).
  - `materials.motif:'soft'` in kid/ocean/space/dino tokens; `public/manifest.json` bg/theme →
    `#F8FAFC`.
  - Themed `CelebrationEffect` particles (by `theme.scene.ambient.motion`); `ScoreChip` accent glow;
    `RepeatButton` labels dropped the `🎵` (speaker icon kept).
  - **Dark-scene title treatment** + `titleFontFamily` in `UnifiedQuizGame` and `GameHeader`, and
    propagated to hand-rolled headers; **answer-card elevation + 16px radius** in `UnifiedQuizGame`;
    elevation also added to hand-rolled game cards.
  - **Quiz audio-resilience fix** in `UnifiedQuizGame` (see A4).
  - **Theme-flash fix**: `ThemeScene` paints its dark base immediately (only art fades); home
    rainbow `::before` gated to `!immersive`.

### A1. Reuse pointers (already shipped — DO NOT reinvent)
- Dark-scene title sx: `color: muiTheme.scene.dark ? '#FFFFFF' : <accent>`; `textShadow` dark =
  `'0 0 16px rgba(120,170,255,0.55), 0 2px 8px rgba(0,0,0,0.5)'`, light = `1px 1px 2px <accent>33`.
- Card elevation: `muiTheme.scene.dark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.12)'`.
- `immersive = theme.scene.layers.length > 0`; `getCategoryTheme(id)` → accent/border; `theme.titleFontFamily`.
- Guide art = `loadSceneAssets(themeId).mascot`; copy `ThemeMascot.tsx` patterns (idle bob; tap burst
  shaped by `theme.scene.ambient.motion`; speaks `theme.scene.mascot.lines` via the single audio channel).
  Place bottom-left (version chip is bottom-right).

### A2. Component API sketches
- `GameShell` `{ categoryId, title, backRoute, score?: ReactNode, guideReaction?: 'cheer'|'think'|null, children }`
  → root (relative + isolation + 100dvh + category gradient) → `<GameMotif categoryId/>` → header
  (back / themed title / score) → content slot → `<GameGuide categoryId reaction/>` (bottom-left) →
  `<CelebrationEffect/>`.
- `AnswerTile` `{ onClick, state?: 'idle'|'correct'|'wrong', accent, children }` — CSS tactile tile;
  correct→glow+CSS sparkle, wrong→shake (framer-motion).
- `SymbolTile` `{ op: '+'|'-'|'='|'?'|'>'|'<'|'×'|'÷', size? }` → `<img src={symbolImages[op]}/>`.
- `GameGuide` — thin wrapper over (or extension of) `ThemeMascot` adding a `reaction` prop that drives
  the cheer (jump/scale + burst) / think (shake) animation.

### A3. Propagation lists
- `UnifiedQuizGame` covers (auto-lift in Phase A): AlphabetGame, MathGame, EnglishListen/Word/Translate,
  LaesOrdetGame, HvadManglerGame.
- Hand-rolled to migrate to `GameShell` (Phase C): MathOperationGame, ComparisonGame, NumberLearning,
  AlphabetLearning, EnglishLearning, SpellingGame, SpeakWordGame, FarvejagtGame, RamFarvenGame,
  UnifiedMemoryGame. (Farver color CONTENT is never themed.)

### A4. PENDING — audio-resilience to propagate (Phase D)
The fixed pattern lives in `UnifiedQuizGame`: `startedRef` + `welcomeTriggered` refs, a `beginGame()`
idempotent starter, a **2.5s fallback** `setTimeout(beginGame)` in the mount effect, and a readiness
effect guarded by the refs (NOT `!hasInitialized.current`, which is always set at mount). The other
task games still have the broken `!hasInitialized.current` readiness guard → can strand on an empty
screen: **MathOperationGame, ComparisonGame, SpellingGame, SpeakWordGame, UnifiedMemoryGame.** Apply
the same pattern to each.

### A5. MathOperationGame layout bug
~lines 304–346: question `Typography` (mb:4) then a `<Paper>` equation with the repeat button INSIDE
its flex row and no top spacing → under the `flex:1` answer grid the card overlaps the question text.
Fix: a clear flex **column** (question → equation → repeat button BELOW the equation) with `gap`; do
not nest the repeat button in the equation row.

### A6. New art — math symbol tiles (the only Gemini art)
Pipeline: `art-src/symbols/<op>.png` on solid `#FF00FF` → extend `scripts/optimize-theme-art.mjs`
with a `symbols` role group (~160px wide, q90, magenta chroma-key) → `src/assets/symbols/<op>.webp`
→ add a `symbolImages` registry mirroring `src/assets/themes/icons/index.ts`. Run
`node scripts/optimize-theme-art.mjs symbols`. Glyphs: `+ − = ? > < × ÷`; coherent friendly palette
(e.g. orange operators, teal `=`, purple `?`). Star-pop + guide need NO art (CSS + existing mascots).
