import type { ThemeTokens } from './tokens/types'
import { kidThemeTokens } from './tokens/kidTheme.tokens'
import { oceanThemeTokens } from './tokens/ocean.tokens'
import { spaceThemeTokens } from './tokens/space.tokens'
import { jungleThemeTokens } from './tokens/jungle.tokens'
import { candyThemeTokens } from './tokens/candy.tokens'
import { dinoThemeTokens } from './tokens/dino.tokens'

// Registry of all selectable skins. Order = order shown in the front-page selector.
// To add a theme: author a new `*.tokens.ts`, import it, and append it here.
export const themes: ThemeTokens[] = [
  kidThemeTokens,
  oceanThemeTokens,
  spaceThemeTokens,
  jungleThemeTokens,
  candyThemeTokens,
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
