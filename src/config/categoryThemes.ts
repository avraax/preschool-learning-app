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
  games: Game[]
}

export const categoryThemes: Record<string, CategoryTheme> = {
  alphabet: {
    id: 'alphabet',
    name: 'Alfabetet',
    gradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 50%, #90CAF9 100%)',
    accentColor: '#1976D2',
    borderColor: '#64B5F6',
    hoverBorderColor: '#1976D2',
    icon: '📚',
    iconSize: '6rem',
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
        id: 'memory',
        title: 'Hukommelsesspil',
        emoji: '🧠',
        route: '/learning/memory/letters',
        gradient: 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)'
      }
    ]
  },
  math: {
    id: 'math',
    name: 'Tal og Regning',
    gradient: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 50%, #CE93D8 100%)',
    accentColor: '#9C27B0',
    borderColor: '#BA68C8',
    hoverBorderColor: '#9C27B0',
    icon: '🧮',
    iconSize: '6rem',
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
        id: 'comparison',
        title: 'Sammenlign Tal',
        emoji: '⚖️',
        route: '/math/comparison',
        gradient: 'linear-gradient(135deg, #8E24AA 0%, #7B1FA2 100%)'
      },
      {
        id: 'memory',
        title: 'Hukommelsesspil',
        emoji: '🧠',
        route: '/learning/memory/numbers',
        gradient: 'linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%)'
      }
    ]
  },
  colors: {
    id: 'colors',
    name: 'Farver',
    gradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 50%, #FFCC80 100%)',
    accentColor: '#E65100',
    borderColor: '#FFB74D',
    hoverBorderColor: '#FF6B00',
    icon: '🎨',
    iconSize: '6rem',
    games: [
      {
        id: 'farvejagt',
        title: 'Farvejagt',
        emoji: '🎯',
        route: '/farver/jagt',
        gradient: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 50%, #FF6B9D 100%)'
      },
      {
        id: 'ram-farven',
        title: 'Ram Farven',
        emoji: '🎨',
        route: '/farver/ram-farven',
        gradient: 'linear-gradient(135deg, #A855F7 0%, #F97316 50%, #10B981 100%)'
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