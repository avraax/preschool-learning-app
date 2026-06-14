import type { ThemeTokens } from './tokens/types'
import { kidThemeTokens } from './tokens/kidTheme.tokens'
import { oceanThemeTokens } from './tokens/ocean.tokens'
import { spaceThemeTokens } from './tokens/space.tokens'
import { dinoThemeTokens } from './tokens/dino.tokens'

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
export interface ThemeOption {
  id: string
  name: string
  emoji: string
}

export const themeOptions: ThemeOption[] = themes.map((t) => ({
  id: t.id,
  name: t.name,
  emoji: t.selectorEmoji,
}))
