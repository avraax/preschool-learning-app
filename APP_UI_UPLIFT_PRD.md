# App-wide UI Uplift — plan & checklist

Goal: bring **every screen** of Børnelæring up to the visual quality of the new home page
(immersive theme worlds, glassy materials, soft-3D icons, themed titles). Builds directly on
the Theme Worlds work (P0–P2 shipped) — see `THEME_WORLDS_PRD.md` for status + locked decisions
and the reusable toolkit. This doc is the execution checklist for the rest.

Owner: Danish preschool learning app for a ~5-year-old. React 19 + TS + Vite 8 + MUI v9, Framer
Motion, Howler. Deploy: Vercel on push to `master`. House rules in `CLAUDE.md` + `.claude/rules/*`.

---

## 1. Guiding principle — calm vs immersive (LOCKED)

Two tiers, per the original PRD's locked decision:

- **Immersive screens** (Home ✅, **Section menus** = P3): full `<ThemeScene/>` backdrop +
  parallax + ambient + glassy cards + themed title + (optional) idle mascot.
- **Calm screens** (all game/quiz/learning screens = P4): theme **colors** (already token-driven)
  + **ONE light static motif** + themed header (soft-3D icon + title treatment). **NO** scene,
  parallax, ambient, or mascot — kids must focus. This is deliberate, not laziness.

## 2. Hard guardrails (do not violate)

- **No game difficulty/range/logic changes.** Visual only.
- **Educational colors are never themed** — `FarvejagtGame` swatches + `RamFarvenGame` mixing
  colors are subject matter (data), not skin.
- **Respect `prefers-reduced-motion`** (use `useReducedMotion`); honored already in scene/ambient.
- **Touch targets ≥ 44px**; **no-scroll** full-viewport game layouts (`.claude/rules/responsive-design.md`).
- **Audio** stays centralized (`useSimplifiedAudioHook`, single channel, no queue) — see
  `.claude/rules/audio-system.md`.
- **Lint baseline:** the repo has ~130 PRE-EXISTING lint problems. Rule = **add zero new ones**;
  verify only your changed files are clean (`npx eslint <files>`). Don't chase the baseline.
- **Build + lint green per phase; commit per phase; pause for on-device iPad check before commit.**

## 3. Reusable toolkit (REUSE — do not reinvent)

- `theme.scene` / `theme.materials` / `theme.titleFontFamily` (via `useTheme()`); `immersive =
  theme.scene.layers.length > 0`, `darkScene = theme.scene.dark`.
- `<ThemeScene/>` (full-bleed scene + ambient + scrim), `<ThemeMascot/>`, `useParallax(rootRef)`
  (set CSS vars on a page root), `AmbientField` (motion → bubbles/sparkles+shooting-stars/leaves).
- `sectionIconImages` (soft-3D section icons), `appLogo` (`src/assets/logo.webp`).
- Glassy card recipe (home): `rgba(255,255,255,0.62→0.46)` gradient + `blur(16px) saturate(1.1)`.
- Title treatment recipe (home): dark-scene → light text + glow; light immersive → white halo.
- Asset pipeline: `art-src/<id>/` → `optimize-theme-art.mjs` (magenta-key, ≤700KB) → asset module
  → `sceneAssets.ts`. Title fonts via `titleFonts.ts` (latin subset, verify æøå).

## 4. Per-layer checklist

### P3 — Section menus (immersive)  ▢
All 5 menus render through **`GameSelectionLayout.tsx`** — update it once, lifts all.
- ▢ Render `<ThemeScene/>` behind the menu content (root needs `position: relative` + a
  `useParallax` driver + the menu content above it).
- ▢ Glassy material on the game cards (the menu cards currently use `game.gradient`; decide:
  keep per-game gradient vs themed glass — recommend **themed glass like home** so menus match,
  with the game emoji/title on top). Keep card geometry/targets unchanged.
- ▢ Header: swap the emoji `theme.icon` for the **soft-3D `sectionIconImages[categoryId]`** +
  apply the **title treatment** to `theme.name`.
- ▢ (Optional, recommended) a **small idle mascot** in a corner (no tap burst needed, or reuse
  ThemeMascot scaled down). Confirm with owner.
- ▢ Verify no-scroll + readability on every menu (alphabet/math/farver/english/ordleg), light + dark.

### P4 — Game & learning screens (calm)  ▢
Keep current structure; add the calm layer. Components:
- Alphabet: `AlphabetGame` (quiz), `AlphabetLearning`.
- Math: `MathGame`, `NumberLearning`, `MathOperationGame` (+/−), `ComparisonGame`, `HvadManglerGame`.
- Farver: `FarvejagtGame`, `RamFarvenGame` — **content colors untouched**; chrome only.
- English: `EnglishListenGame`, `EnglishWordGame`, `EnglishTranslateGame`, `EnglishLearning`.
- Ordleg: `LaesOrdetGame`, `SpellingGame`, `SpeakWordGame`.
- Learning: `MemoryGame`.

For each (mostly via shared chrome below):
- ▢ Header: soft-3D section icon + themed title treatment (calm — no glow overload).
- ▢ **One light static motif** — `theme.materials.motif` (currently `''`). **OPEN DECISION** (see §5).
- ▢ Confirm no scene/parallax/ambient/mascot; no-scroll; ≥44px; contrast OK (esp. dark Space).

### Shared chrome / components  ▢
- ▢ `GameHeader` / `GameSelectionLayout` AppBar — themed icon + title.
- ▢ `RepeatButton` (5 variants), `ScoreChip` (5 variants) — confirm they read theme tokens, polish.
- ▢ `UnifiedQuizGame` cards, `LearningGrid`, `MemoryGame` cards — surfaces/shadows match the new feel.
- ▢ `CelebrationEffect` (already reduced-motion aware) — confirm palette uses theme tokens.
- ▢ `SimplifiedAudioPermission` modal — uses `decor.audioPermission*`; polish to match.
- ▢ `NotFoundPage` (404) — uses `decor.notFoundBackground`; could add a faint motif.
- ▢ `UpdateBanner` — restyle to match. `VersionDisplay` — ✅ done (subtle).
- ▢ Icons lift carried into menu headers + game headers (tracked from `THEME_WORLDS_POLISH.md`).

## 5. Open decisions (confirm before/at P4)

1. **Game-screen motif** (`materials.motif`): recommend a **CSS / lightweight** treatment (e.g., a
   faint low-opacity themed corner accent or a soft top header strip in the theme color) over
   generating 4× more art. Could optionally reuse a tiny cropped scene element at very low opacity.
   → Decide the exact motif style once, apply to all themes.
2. **Idle mascot on menus?** (recommended yes, small/non-interactive) vs menus stay mascot-free.
3. **Menu cards**: themed glass (matches home) vs keep the current bold per-game gradient cards.
4. **Manifest splash** `background_color`/`theme_color` are still purple `#8B5CF6` — leave (brand)
   or set to a neutral light to match the new logo's background.

## 6. Order of work & per-phase "done"

1. **P3 — menus** (biggest visible gap; one shared component). → build+lint clean → iPad check → commit.
2. **P4 — game motif + headers** (shared chrome first, then verify each game). → … → commit.
3. **Component polish pass** (buttons/chips/modals/404/banner). → … → commit.
4. **Final QA pass:** reduced-motion off→on on every screen; contrast (esp. dark Space cards/text);
   per-theme asset budget ≤700KB; no-scroll in portrait+landscape; changed-file lint clean.

## 7. Notes for a fresh session
- Start from `master` HEAD (P0–P2 committed). Read this doc + `THEME_WORLDS_PRD.md` status +
  `.claude/rules/*` first.
- The art workflow needs the owner in the loop (Gemini generation). Most of P3/P4 is **code-only**
  (reusing existing scenes/icons), so it needs far less art than P1–P2 — possibly none beyond an
  optional motif.
- `THEME_WORLDS_POLISH.md` (the original 4-item cross-layer tracker) is now subsumed by this doc;
  keep it for the icon/title/version history or delete it.
