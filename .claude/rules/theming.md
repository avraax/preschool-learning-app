---
paths:
  - "src/theme/*.ts"
  - "src/theme/*.tsx"
  - "src/theme/tokens/*.ts"
  - "src/config/categoryThemes.ts"
  - "src/components/adult/panes/UdseendePane.tsx"
---

# Theming (skins)

Fully token-driven. Each theme (skin) = one `ThemeTokens` object in `src/theme/tokens/*.tokens.ts`;
`buildTheme(tokens)` maps it onto the MUI theme and attaches `theme.categories` / `theme.decor` /
`theme.customShadows`. **No styling values are hardcoded in components** — read them via `useTheme()` or
`getCategoryTheme(id)`.

The active skin is chosen at runtime in "Indstillinger" → **Udseende** (`panes/UdseendePane.tsx`) via
`AppThemeProvider` (`src/theme/ThemeProvider.tsx`), persisted to `localStorage` and per-child through
`progressStore.settings.themeId`.

## The three that bite

- **`getCategoryTheme(id)`, never `categoryThemes[id]`.** The static map is bound to the default (kid)
  tokens and is NOT skin-aware, so a component that renders live inside a skin shows kid-skin colours on
  every other skin.
- **Accent-on-light contrast.** Accent TEXT/glyphs on a white tile/card/memory-face surface must use
  `theme.onTileColor` (AA-on-white, a no-op when the accent already reads), NEVER raw `accentColor` — a
  light skin accent (Rummet cyan, Havet yellow) is illegible on the white `tileSurface`. Focal-zone/scene
  text (PromptFocus, titles, headlines) uses `scene.dark ? accentColor : onTileColor`; frosted menu cards
  use `onCardColor`. Helpers in `theme/tokens/helpers.ts`.
- **The adult surface does NOT use the skin**: `buildAdultTheme(base)` (`src/theme/adultTheme.tsx`) merges a
  calm system-font/neutral-grey theme ON TOP of the live skin — **two-arg `createTheme(base, …)`, never a
  fresh theme**, or `theme.categories`/`.decor`/`.scene`/`.materials`/`.transition` vanish and their
  consumers crash.

**Educational colours are NOT themeable** — Farvejagt/RamFarven colour content stays as data in
`src/config/colorContent.ts`.

Ships **4 registered themes**: Regnbue (default), Havet, Rummet, Dinosaurer (`src/theme/themes.ts`). Two
more token files — `jungle.tokens.ts` (Junglen) + `candy.tokens.ts` (Slikland) — exist but are
**deliberately not registered** (add them to the `themes` array to ship).

## Adding a theme

1. Copy an existing `src/theme/tokens/<skin>.tokens.ts` (e.g. `ocean.tokens.ts`), give it a unique `id` +
   `name`, and edit the colours. Use the `category()` / `gradient3()` / `neutralShadows()` helpers from
   `tokens/helpers.ts` so the structure matches other skins. The picker shows the skin's baked
   `selectorThumb`, never a glyph — so **a skin can only be REGISTERED once its world art exists**
   (`themes.test.ts` enforces that; art pipeline in `.claude/rules/scene-assets.md`).
2. Give the 5 sections (alphabet/math/colors/english/ordleg) **distinct, readable accents**. Keep `success`
   green-ish and `error` red-ish (kids read green=correct / red=wrong). A section's GLYPH is not a token at
   all — it's theme-constant baked art in `src/assets/themes/icons/`, identical on every skin, so a new
   theme supplies colours only. Accents only need to read on the SCENE — tile/card text auto-darkens to AA
   via `onTileColor`, so don't over-darken an accent just for tile legibility.
3. Register it: import and append to the `themes` array in `src/theme/themes.ts`. It appears in the
   front-page selector automatically. The default `kid` theme (`kidTheme.tokens.ts`) keeps hand-written
   exact values; don't refactor it.
