import type { ThemeTokens } from './types'
import { kidThemeTokens } from './kidTheme.tokens'

// The currently active theme tokens. `buildTheme()` sets this whenever it builds a theme,
// so non-React helpers (e.g. `getCategoryTheme` in config/categoryThemes.ts) can read the
// active skin without going through React context. There is a single ThemeProvider at the
// app root, so a module-level reference is sufficient.

let active: ThemeTokens = kidThemeTokens

export const setActiveTokens = (tokens: ThemeTokens): void => {
  active = tokens
}

export const getActiveTokens = (): ThemeTokens => active
