// Centralized theme configuration for all learning categories
// This ensures consistent theming throughout the app

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
    description: 'Lær bogstaver og ord'
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
    description: 'Lær tal og matematik'
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
    description: 'Lær farver og kreativitet'
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