// Theme token schema — the single source of truth for everything "skin"-related.
//
// A theme (skin) = ONE object implementing `ThemeTokens`. Adding a new theme means
// authoring one of these and passing it to `buildTheme()` — no styling values live in
// components. See `kidTheme.tokens.ts` for the default theme and CLAUDE.md for the
// "How to add a theme" guide.
//
// NOTE: This intentionally keeps the FULL MUI colour scale (main/light/dark/contrastText)
// per palette entry rather than a single string, so a reskin reproduces today's exact
// colours with no MUI-derived drift.

export interface ColorScale {
  main: string
  light: string
  dark: string
  contrastText: string
}

// Per-section visual identity (the 5 category cards/sections).
export interface CategoryPalette {
  gradient: string        // section background gradient (full-screen section pages)
  accent: string          // titles, primary accents
  border: string
  hoverBorder: string
  icon: string            // emoji glyph
  iconSize: string
  cardSurface: string     // frosted home-card background (white→tint gradient)
  cardBlur: string        // home-card backdrop-filter blur
}

export interface ThemePalette {
  primary: ColorScale
  secondary: ColorScale
  success: ColorScale
  warning: ColorScale
  error: ColorScale
  info: ColorScale
  pink: ColorScale
  backgroundDefault: string
  backgroundPaper: string
  textPrimary: string
  textSecondary: string
}

export interface CategoryTokens {
  alphabet: CategoryPalette
  math: CategoryPalette
  colors: CategoryPalette
  english: CategoryPalette
  ordleg: CategoryPalette
}

// Decorative styling currently hardcoded across components.
export interface DecorTokens {
  pageBackground: string          // home base bg
  rainbow: string                 // home conic-gradient arc
  dots: string                    // home radial-gradient dot texture (the 4 dot layers)
  titleColor: string              // "Børnelæring" logo text
  subtitleColor: string           // tagline + play/book icons
  balloonColors: string[]         // home balloon palette
  confettiColors: string[]        // CelebrationEffect default
  notFoundBackground: string      // 404 page background gradient
}

// Named shadows so cards/buttons share themable elevation.
export interface ShadowTokens {
  card: string
  cardHover: string
  focusRing: string
}

export interface ThemeTokens {
  id: string
  name: string
  fontFamily: string

  palette: ThemePalette

  // The 5 section identities become theme tokens (so a skin can remap them).
  categories: CategoryTokens

  decor: DecorTokens

  shadows: ShadowTokens
}
