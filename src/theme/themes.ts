import type { ThemeTokens } from './tokens/types'
import { kidThemeTokens } from './tokens/kidTheme.tokens.ts'
import { oceanThemeTokens } from './tokens/ocean.tokens.ts'
import { spaceThemeTokens } from './tokens/space.tokens.ts'
import { dinoThemeTokens } from './tokens/dino.tokens.ts'

// Registry of all selectable skins. Order = order shown in the front-page selector.
// To add a theme: author a new `*.tokens.ts`, import it, and append it here.
// NOTE: Jungle/Candy tokens still exist in tokens/ but are intentionally NOT registered —
// they have no immersive world art yet, so they're kept out of the selector.
export const themes: ThemeTokens[] = [
  kidThemeTokens,
  oceanThemeTokens,
  spaceThemeTokens,
  dinoThemeTokens,
]

export const defaultThemeId = kidThemeTokens.id

export const getThemeTokens = (id: string | null | undefined): ThemeTokens =>
  themes.find((t) => t.id === id) ?? kidThemeTokens

// Lightweight metadata for the selector (no need to ship full token objects to the UI).
// The picture comes from the skin's baked `selectorThumb` (loaded lazily via `loadSceneAssets`),
// never a glyph — de-emoji PRD-01 W4 deleted the `selectorEmoji` fallback. `themes.test.ts`
// asserts every registered skin ships that thumbnail, so the fallback can't be needed.
export interface ThemeOption {
  id: string
  name: string
}

export const themeOptions: ThemeOption[] = themes.map((t) => ({
  id: t.id,
  name: t.name,
}))
