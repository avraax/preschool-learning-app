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
    gradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 50%, #90CAF9 100%)',
    accentColor: '#1976D2',
    borderColor: '#64B5F6',
    hoverBorderColor: '#1976D2',
    icon: '📚',
    iconSize: '4rem',
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
    iconSize: '4rem',
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
    iconSize: '4rem',
    description: 'Udforsk farver gennem interaktive spil og kreative aktiviteter',
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
  },
  english: {
    id: 'english',
    name: 'Engelsk',
    gradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 50%, #A5D6A7 100%)',
    accentColor: '#2E7D32',
    borderColor: '#66BB6A',
    hoverBorderColor: '#2E7D32',
    icon: '🌍',
    iconSize: '4rem',
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
    id: 'ordleg',
    name: 'Ordleg',
    gradient: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 50%, #80CBC4 100%)',
    accentColor: '#00796B',
    borderColor: '#4DB6AC',
    hoverBorderColor: '#00796B',
    icon: '🗣️',
    iconSize: '4rem',
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

// Helper function to get theme by category
export const getCategoryTheme = (categoryId: string): CategoryTheme => {
  return categoryThemes[categoryId] || categoryThemes.alphabet
}

// Helper function to get all theme IDs
export const getCategoryIds = (): string[] => {
  return Object.keys(categoryThemes)
}