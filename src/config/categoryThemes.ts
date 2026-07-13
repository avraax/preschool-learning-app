// Centralized theme configuration for all learning categories.
//
// Section *colors* (gradient/accent/border/hoverBorder/icon/iconSize) are now THEME TOKENS
// — they live in `src/theme/tokens/*` and are read here from the active skin. Only the
// *content/config* (name, description, and the games[] list with routes/titles/emojis/
// per-game button gradients) lives in this file. A reskin remaps colors; it never touches
// this content.

import type { ThemeTokens } from '../theme/tokens/types'
import { getActiveTokens } from '../theme/tokens/activeTokens'
import { kidThemeTokens } from '../theme/tokens/kidTheme.tokens'

export interface Game {
  id: string
  title: string
  emoji: string
  route: string
  gradient: string
}

export interface CategoryTheme {
  id: string
  name: string
  gradient: string
  accentColor: string
  onCardColor: string      // AA-guaranteed label colour for text on frosted cards/menus
  tileSurface: string      // section-tinted idle answer-tile surface
  borderColor: string
  hoverBorderColor: string
  icon: string
  iconSize: string
  description: string
  games: Game[]
}

// Content/config only — colors come from theme tokens (merged in below).
interface CategoryContent {
  name: string
  description: string
  games: Game[]
}

type CategoryId = keyof ThemeTokens['categories']

const categoryContent: Record<CategoryId, CategoryContent> = {
  alphabet: {
    name: 'Alfabetet',
    description: 'Lær det danske alfabet fra A til Å med sjove spil og quiz',
    games: [
      {
        id: 'learn',
        title: 'Lær Alfabetet',
        emoji: '📚',
        route: '/alphabet/learn',
        gradient: 'linear-gradient(135deg, #64B5F6 0%, #42A5F5 100%)'
      },
      {
        id: 'quiz',
        title: 'Bogstav Quiz',
        emoji: '🎯',
        route: '/alphabet/quiz',
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)'
      },
      {
        id: 'memory10',
        title: 'Hukommelse 10',
        emoji: '🧠',
        route: '/learning/memory/letters/10',
        gradient: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)'
      },
      {
        id: 'memory20',
        title: 'Hukommelse 20',
        emoji: '🧠',
        route: '/learning/memory/letters/20',
        gradient: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)'
      }
    ]
  },
  math: {
    name: 'Tal og Regning',
    description: 'Lær tal, optælling og grundlæggende matematik på en sjov måde',
    games: [
      {
        id: 'numbers',
        title: 'Lær Tal',
        emoji: '📚',
        route: '/math/numbers',
        gradient: 'linear-gradient(135deg, #CE93D8 0%, #BA68C8 100%)'
      },
      {
        id: 'counting',
        title: 'Tal Quiz',
        emoji: '🎯',
        route: '/math/counting',
        gradient: 'linear-gradient(135deg, #AB47BC 0%, #9C27B0 100%)'
      },
      {
        id: 'addition',
        title: 'Plus Opgaver',
        emoji: '➕',
        route: '/math/addition',
        gradient: 'linear-gradient(135deg, #9C27B0 0%, #8E24AA 100%)'
      },
      {
        id: 'subtraction',
        title: 'Minus Opgaver',
        emoji: '➖',
        route: '/math/subtraction',
        gradient: 'linear-gradient(135deg, #9333EA 0%, #7E22CE 100%)'
      },
      {
        id: 'comparison',
        title: 'Sammenlign Tal',
        emoji: '⚖️',
        route: '/math/comparison',
        gradient: 'linear-gradient(135deg, #8E24AA 0%, #7B1FA2 100%)'
      },
      {
        id: 'patterns',
        title: 'Hvad Mangler?',
        emoji: '🧩',
        route: '/math/patterns',
        gradient: 'linear-gradient(135deg, #7E57C2 0%, #5E35B1 100%)'
      },
      {
        id: 'memory10',
        title: 'Hukommelse 10',
        emoji: '🧠',
        route: '/learning/memory/numbers/10',
        gradient: 'linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%)'
      },
      {
        id: 'memory20',
        title: 'Hukommelse 20',
        emoji: '🧠',
        route: '/learning/memory/numbers/20',
        gradient: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)'
      }
    ]
  },
  colors: {
    name: 'Farver',
    description: 'Udforsk farver gennem interaktive spil og kreative aktiviteter',
    games: [
      {
        id: 'laer',
        title: 'Lær Farver',
        emoji: '🌈',
        route: '/farver/laer',
        gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FDE047 35%, #3B82F6 70%, #A855F7 100%)'
      },
      {
        id: 'farvejagt',
        title: 'Farvejagt',
        emoji: '🎯',
        route: '/farver/jagt',
        gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FF6B9D 100%)'
      },
      {
        id: 'farvequiz',
        title: 'Hvilken Farve?',
        emoji: '❓',
        route: '/farver/quiz',
        gradient: 'linear-gradient(135deg, #38BDF8 0%, #818CF8 50%, #F472B6 100%)'
      },
      {
        id: 'ram-farven',
        title: 'Ram Farven',
        emoji: '🎨',
        route: '/farver/ram-farven',
        gradient: 'linear-gradient(135deg, #A855F7 0%, #F97316 50%, #10B981 100%)'
      },
      {
        id: 'nuancer',
        title: 'Nuancer',
        emoji: '🌗',
        route: '/farver/nuancer',
        gradient: 'linear-gradient(135deg, #BFDBFE 0%, #3B82F6 50%, #1E3A8A 100%)'
      }
    ]
  },
  english: {
    name: 'Engelsk',
    description: 'Lær dine første engelske ord med billeder og lyd',
    games: [
      {
        id: 'listen',
        title: 'Lyt og Find',
        emoji: '👂',
        route: '/english/listen',
        gradient: 'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)'
      },
      {
        id: 'word',
        title: 'Find det Engelske Ord',
        emoji: '🔤',
        route: '/english/word',
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)'
      },
      {
        id: 'translate',
        title: 'Dansk til Engelsk',
        emoji: '🔁',
        route: '/english/translate',
        gradient: 'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)'
      },
      {
        id: 'learn',
        title: 'Lær Engelsk',
        emoji: '📚',
        route: '/english/learn',
        gradient: 'linear-gradient(135deg, #388E3C 0%, #1B5E20 100%)'
      }
    ]
  },
  ordleg: {
    name: 'Ordleg',
    description: 'Stav ord og sig ord højt med din stemme',
    games: [
      {
        id: 'read',
        title: 'Læs Ordet',
        emoji: '📖',
        route: '/ordleg/read',
        gradient: 'linear-gradient(135deg, #4DB6AC 0%, #26A69A 100%)'
      },
      {
        id: 'spelling',
        title: 'Stav Ordet',
        emoji: '✏️',
        route: '/ordleg/spelling',
        gradient: 'linear-gradient(135deg, #26A69A 0%, #00897B 100%)'
      },
      {
        id: 'mic',
        title: 'Sig et Ord',
        emoji: '🎤',
        route: '/ordleg/mic',
        gradient: 'linear-gradient(135deg, #00897B 0%, #00695C 100%)'
      }
    ]
  }
}

// Merge a category's themeable colors (from tokens) with its content/config.
const toCategoryTheme = (id: CategoryId, tokens: ThemeTokens): CategoryTheme => {
  const palette = tokens.categories[id]
  const content = categoryContent[id]
  return {
    id,
    name: content.name,
    gradient: palette.gradient,
    accentColor: palette.accent,
    onCardColor: palette.onCard,
    tileSurface: palette.tileSurface,
    borderColor: palette.border,
    hoverBorderColor: palette.hoverBorder,
    icon: palette.icon,
    iconSize: palette.iconSize,
    description: content.description,
    games: content.games,
  }
}

const categoryIds = Object.keys(categoryContent) as CategoryId[]

// Static map built from the DEFAULT theme — preserves the legacy `categoryThemes.<id>`
// shape for direct property access. Color-bearing fields trace back to the default tokens.
export const categoryThemes: Record<string, CategoryTheme> = Object.fromEntries(
  categoryIds.map((id) => [id, toCategoryTheme(id, kidThemeTokens)])
)

// Helper function to get theme by category — reads the ACTIVE skin so a reskin/switch is
// reflected at call time.
export const getCategoryTheme = (categoryId: string): CategoryTheme => {
  const tokens = getActiveTokens()
  const id = (categoryId in tokens.categories ? categoryId : 'alphabet') as CategoryId
  return toCategoryTheme(id, tokens)
}

// Helper function to get all theme IDs
export const getCategoryIds = (): string[] => {
  return [...categoryIds]
}
