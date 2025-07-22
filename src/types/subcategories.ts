// Future subcategory types for expansion
// This structure prepares for implementing subcategories under Alphabet and Math sections

export interface SubcategoryItem {
  id: string
  title: string
  description: string
  icon: string // emoji or icon name
  route: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  isComingSoon?: boolean
}

export interface CategoryConfig {
  id: string
  title: string
  description: string
  icon: string
  color: 'primary' | 'secondary' | 'success' | 'warning'
  subcategories: SubcategoryItem[]
}

// Example structure for future implementation:
export const ALPHABET_SUBCATEGORIES: SubcategoryItem[] = [
  {
    id: 'letter-recognition',
    title: 'Bogstav Genkendelse',
    description: 'Klik på det bogstav du hører',
    icon: '🔤',
    route: '/alphabet/recognition'
  },
  {
    id: 'full-alphabet',
    title: 'Hele Alfabetet',
    description: 'Lær alle bogstaver A-Å',
    icon: '📚',
    route: '/alphabet/full',
    isComingSoon: true
  },
  {
    id: 'letter-sounds',
    title: 'Bogstav Lyde',
    description: 'Hør hvordan hvert bogstav lyder',
    icon: '🔊',
    route: '/alphabet/sounds',
    isComingSoon: true
  }
]

export const MATH_SUBCATEGORIES: SubcategoryItem[] = [
  {
    id: 'counting',
    title: 'Tælling',
    description: 'Tæl tal fra 1-100',
    icon: '🔢',
    route: '/math/counting'
  },
  {
    id: 'addition',
    title: 'Plus Regning',
    description: 'Lær at lægge tal sammen',
    icon: '➕',
    route: '/math/addition',
    isComingSoon: true
  },
  {
    id: 'subtraction',
    title: 'Minus Regning',
    description: 'Lær at trække tal fra hinanden',
    icon: '➖',
    route: '/math/subtraction',
    isComingSoon: true
  }
]