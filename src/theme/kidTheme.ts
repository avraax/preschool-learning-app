// Back-compat shim. The theme is now token-driven: see `tokens/kidTheme.tokens.ts` for the
// values and `buildTheme.ts` for the token→MUI mapping. This module re-exports the built
// default theme so any legacy `import kidTheme from './theme/kidTheme'` keeps working.
import { buildTheme } from './buildTheme'
import { kidThemeTokens } from './tokens/kidTheme.tokens'

export const kidTheme = buildTheme(kidThemeTokens)

export default kidTheme
