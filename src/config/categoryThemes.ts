// Centralized theme configuration for all learning categories
// This ensures consistent theming throughout the app

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
  borderColor: string
  hoverBorderColor: string
  icon: string
  iconSize: string
  description: string
  games: Game[]
}

export const categoryThemes: Record<string, CategoryTheme> = {
  alphabet: {
    id: 'alphabet',
    name: 'Alfabetet',
    gradient: 'linear-gradient(160deg, #FF6B9D 0%, #EC4899 50%, #C2185B 100%)',
    accentColor: '#EC4899',
    borderColor: '#F9A8D4',
    hoverBorderColor: '#AD1457',
    icon: '📚',
    iconSize: '6rem',
    description: 'Lær det danske alfabet fra A til Å med sjove spil og quiz',
    games: [
      {
        id: 'learn',
        title: 'Lær Alfabetet',
        emoji: '📚',
        route: '/alphabet/learn',
        gradient: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)'
      },
      {
        id: 'quiz',
        title: 'Bogstav Quiz',
        emoji: '🎯',
        route: '/alphabet/quiz',
        gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)'
      },
      {
        id: 'memory',
        title: 'Hukommelsesspil',
        emoji: '🧠',
        route: '/learning/memory/letters',
        gradient: 'linear-gradient(135deg, #DB2777 0%, #BE185D 100%)'
      }
    ]
  },
  math: {
    id: 'math',
    name: 'Tal og Regning',
    gradient: 'linear-gradient(160deg, #A78BFA 0%, #7C3AED 50%, #5B21B6 100%)',
    accentColor: '#7C3AED',
    borderColor: '#DDD6FE',
    hoverBorderColor: '#4C1D95',
    icon: '🧮',
    iconSize: '6rem',
    description: 'Lær tal, optælling og grundlæggende matematik på en sjov måde',
    games: [
      {
        id: 'numbers',
        title: 'Lær Tal',
        emoji: '📚',
        route: '/math/numbers',
        gradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)'
      },
      {
        id: 'counting',
        title: 'Tal Quiz',
        emoji: '🎯',
        route: '/math/counting',
        gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
      },
      {
        id: 'addition',
        title: 'Plus Opgaver',
        emoji: '➕',
        route: '/math/addition',
        gradient: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)'
      },
      {
        id: 'comparison',
        title: 'Sammenlign Tal',
        emoji: '⚖️',
        route: '/math/comparison',
        gradient: 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)'
      },
      {
        id: 'memory',
        title: 'Hukommelsesspil',
        emoji: '🧠',
        route: '/learning/memory/numbers',
        gradient: 'linear-gradient(135deg, #5B21B6 0%, #4C1D95 100%)'
      }
    ]
  },
  colors: {
    id: 'colors',
    name: 'Farver',
    gradient: 'linear-gradient(160deg, #FFA726 0%, #F97316 50%, #EA580C 100%)',
    accentColor: '#F97316',
    borderColor: '#FED7AA',
    hoverBorderColor: '#C2410C',
    icon: '🎨',
    iconSize: '6rem',
    description: 'Udforsk farver gennem interaktive spil og kreative aktiviteter',
    games: [
      {
        id: 'farvejagt',
        title: 'Farvejagt',
        emoji: '🎯',
        route: '/farver/jagt',
        gradient: 'linear-gradient(135deg, #FB923C 0%, #F97316 100%)'
      },
      {
        id: 'ram-farven',
        title: 'Ram Farven',
        emoji: '🎨',
        route: '/farver/ram-farven',
        gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)'
      }
    ]
  }
}

// Helper function to get theme by category
export const getCategoryTheme = (categoryId: string): CategoryTheme => {
  return categoryThemes[categoryId] || categoryThemes.alphabet
}

// Helper function to get all theme IDs
export const getCategoryIds = (): string[] => {
  return Object.keys(categoryThemes)
}