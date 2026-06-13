# Theme Rework Plan — Multi-Theme Readiness

Goal: make the app **fully theme-driven** so adding a new visual theme (skin) =
authoring **one tokens object** and registering it. No styling values hardcoded in
components.

Status: **APPROVED — ready to execute.** Discovery complete. No code changed yet.
Content/theme split **CONFIRMED**: section colors = themeable tokens; Farvejagt/RamFarven
educational colors = left as content. Execute Phase 1 → 2 → 3, building + verifying on
iPad between phases. Difficulty/ranges are NOT to be changed (per prior instruction).

---

## 1. Critical distinction: theme styling vs. domain content

Not every color is "theme." Two buckets:

- **Theme styling (TOKENIZE):** brand/semantic palette, the 5 section identities
  (gradients/accent/border), decorative styling (home rainbow, dot texture, balloon
  palette, celebration confetti), shared shadows/surfaces/borders, the font.
- **Domain content (LEAVE AS-IS):** the *educational* colors —
  `FarvejagtGame` color-object swatches (41 hex: "a red apple is #dc2626") and
  `RamFarvenGame` mixing ingredients/targets (27 hex). These are the *subject matter*;
  a reskin must never change them. Also out of scope: `public/*.svg` PWA icon artwork.

A reskin changes the *skin*, never the lesson content.

---

## 2. Token schema

```ts
// src/theme/tokens/types.ts
export interface CategoryPalette {
  gradient: string        // section background gradient
  accent: string          // titles, primary accents
  border: string
  hoverBorder: string
  icon: string            // emoji glyph
  iconSize: string
}

export interface ThemeTokens {
  id: string
  name: string
  fontFamily: string

  palette: {
    primary: string; secondary: string; success: string; warning: string
    error: string; info: string; pink: string
    backgroundDefault: string; backgroundPaper: string
    textPrimary: string; textSecondary: string
  }

  // The 5 section identities become theme tokens (so a skin can remap them).
  categories: {
    alphabet: CategoryPalette
    math: CategoryPalette
    colors: CategoryPalette
    english: CategoryPalette
    ordleg: CategoryPalette
  }

  // Decorative styling currently hardcoded in components.
  decor: {
    pageBackground: string          // home base bg (#F8FAFC)
    rainbow: string                 // home conic-gradient arc
    dots: string                    // home radial-gradient dot texture
    titleColor: string              // "Børnelæring" (#8B5CF6)
    subtitleColor: string           // tagline (#F87171)
    balloonColors: string[]         // home balloon palette
    confettiColors: string[]        // CelebrationEffect default
  }

  // Named shadows so cards/buttons share themable elevation.
  shadows: {
    card: string
    cardHover: string
    focusRing: string
  }
}
```

---

## 3. Architecture

- `src/theme/tokens/types.ts` — `ThemeTokens`/`CategoryPalette`.
- `src/theme/tokens/kidTheme.tokens.ts` — the DEFAULT theme, holding today's exact values.
- `src/theme/buildTheme.ts` — `buildTheme(tokens): Theme` = `createTheme(...)` mapping
  tokens → MUI palette/typography/components, PLUS attaching `categories` and `decor`
  to the theme object.
- **Module augmentation** (`@mui/material/styles`): add `categories` and `decor` to
  `Theme`/`ThemeOptions` so components read `useTheme().categories.math.accent`, etc.
- `getCategoryTheme(id)` keeps its signature but reads from the active theme tokens
  (back-compat for the many call sites).
- `categoryThemes.ts`: section **colors move into tokens**; the `games[]` arrays
  (routes/titles/emojis/per-game button gradients) stay as content/config. (Per-game
  gradients can optionally derive from the category accent later; keep as data for now.)
- `main.tsx`: `<ThemeProvider theme={buildTheme(kidThemeTokens)}>`.

Adding a theme later = `myTheme.tokens.ts` (copy + edit values) → `buildTheme(myTheme)`
→ register/select. A theme switcher is optional (not required for "readiness").

---

## 4. Phased migration (build + on-device check between phases)

**Phase 1 — Structure, ZERO visual change.**
Create tokens (exact current values), `buildTheme`, module augmentation; repoint
`getCategoryTheme`; wire `main.tsx`. Build → must look identical. Commit.

**Phase 2 — Replace inline styling with tokens (the bulk; regression risk).**
File-by-file, swap hardcoded styling for `theme.*`. Priority order:
1. `App.tsx` (home decor: rainbow, dots, bg, title/subtitle, balloon palette, card
   gradients/shadows) — biggest.
2. `CelebrationEffect.tsx` (confetti default).
3. Shared UI: `GameSelectionLayout`, `GameHeader`, `RepeatButton`, `ScoreChip`,
   `RestartButton`, `UnifiedQuizGame`, `UnifiedMemoryGame`, `LearningGrid`,
   `UpdateBanner`, `SimplifiedAudioPermission`, `balloon/*`, `dnd/*`.
4. Games: `MathOperationGame`, `ComparisonGame`, `HvadManglerGame`, `NumberLearning`,
   `AlphabetLearning`, `AlphabetGame`, `SpellingGame`, `SpeakWordGame`, `LaesOrdetGame`,
   `English*`.
5. `FarvejagtGame` / `RamFarvenGame`: replace ONLY non-content styling (shadows, borders,
   chrome). **Leave the color-object/mixing data untouched.**
Commit in small groups; build after each; you verify on iPad.

**Phase 3 — Prove + document.**
Add a second sample theme to confirm a full reskin works; add a short "How to add a
theme" section to CLAUDE.md; optional runtime switcher. Final build + on-device check.

---

## 5. Discovery inventory (counts from scan)

- **Hex colors** (180 total): App.tsx 9, **FarvejagtGame 41 = content**, categoryThemes 39,
  **RamFarvenGame 27 = content**, kidTheme 32, BalloonBase 14, UnifiedMemoryGame 5,
  SimplifiedAudioPermission 3, UpdateBanner 3, UnifiedQuizGame 3, ParticleEffects 2,
  CelebrationEffect 1, SpeakWordGame 1.
- **Gradients** (39): categoryThemes 24, App.tsx 11, SimplifiedAudioPermission 2,
  SpeakWordGame 1, UnifiedMemoryGame 1.
- **rgba()/shadows** (114 across 24 files): App 18, AlphabetLearning 8,
  SimplifiedAudioPermission 8, SpeakWordGame 7, EnglishLearning 6, MathOperationGame 4,
  ComparisonGame 5, GameSelectionLayout 5, RepeatButton 5, SpellingGame 5, … etc.

---

## 6. Risk & sizing

- Phase 1: low risk (structural, values unchanged).
- Phase 2: the real work and the only regression risk — ~25 files. Mitigation: keep exact
  values in tokens, commit in small groups, build + on-device verify each group.
- Large effort overall; best executed in phased commits and possibly a fresh session
  using this spec.

## 7. Decisions (CONFIRMED)
- Section colors are **theme tokens** (a skin can remap them). ✅ confirmed.
- Educational colors in Farvejagt/RamFarven **stay as content** (never themed). ✅ confirmed.
