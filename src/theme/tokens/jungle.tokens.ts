import type { ThemeTokens } from './types'
import { COMIC_FONT, SECTION_ICONS, WHITE_DOTS, category, neutralShadows } from './helpers'

// 🌴 Junglen (Jungle) — lush leaf greens & tropical teal with parrot orange, macaw blue
// and jungle-flower pink.
export const jungleThemeTokens: ThemeTokens = {
  id: 'jungle',
  name: 'Junglen',
  selectorEmoji: '🌴',
  fontFamily: COMIC_FONT,

  palette: {
    primary: { main: '#2E7D32', light: '#60AD5E', dark: '#005005', contrastText: '#FFFFFF' },
    secondary: { main: '#EF6C00', light: '#FF9D3F', dark: '#B53D00', contrastText: '#FFFFFF' },
    success: { main: '#43A047', light: '#76D275', dark: '#00701A', contrastText: '#FFFFFF' },
    warning: { main: '#F9A825', light: '#FFD95A', dark: '#C17900', contrastText: '#FFFFFF' },
    error: { main: '#D32F2F', light: '#FF6659', dark: '#9A0007', contrastText: '#FFFFFF' },
    info: { main: '#1565C0', light: '#5E92F3', dark: '#003C8F', contrastText: '#FFFFFF' },
    pink: { main: '#C2185B', light: '#FA5788', dark: '#8C0032', contrastText: '#FFFFFF' },
    backgroundDefault: '#F1F8E9',
    backgroundPaper: '#FFFFFF',
    textPrimary: '#1B3A1B',
    textSecondary: '#4E6B4E',
  },

  categories: {
    alphabet: category(['#E8F5E9', '#C8E6C9', '#A5D6A7'], '#2E7D32', '#66BB6A', '#1B5E20', '#E8F5E9', SECTION_ICONS.alphabet),
    math: category(['#E0F2F1', '#B2DFDB', '#80CBC4'], '#00897B', '#4DB6AC', '#00695C', '#E0F2F1', SECTION_ICONS.math),
    colors: category(['#FFF3E0', '#FFE0B2', '#FFCC80'], '#EF6C00', '#FFA726', '#E65100', '#FFF3E0', SECTION_ICONS.colors),
    english: category(['#E3F2FD', '#BBDEFB', '#90CAF9'], '#1565C0', '#42A5F5', '#0D47A1', '#E3F2FD', SECTION_ICONS.english),
    ordleg: category(['#FCE4EC', '#F8BBD0', '#F48FB1'], '#C2185B', '#EC407A', '#880E4F', '#FCE4EC', SECTION_ICONS.ordleg),
  },

  decor: {
    pageBackground: '#F1F8E9',
    rainbow:
      'conic-gradient(from 0deg at 50% 100%, #1B5E20 0deg, #2E7D32 60deg, #00897B 120deg, #1565C0 180deg, #C2185B 240deg, #EF6C00 300deg, #1B5E20 360deg)',
    dots: WHITE_DOTS,
    titleColor: '#2E7D32',
    subtitleColor: '#EF6C00',
    confettiColors: ['#A5D6A7', '#80CBC4', '#FFCC80', '#90CAF9', '#F48FB1', '#FFF176'],
    notFoundBackground: 'linear-gradient(135deg, #E8F5E9 0%, #FFF3E0 50%, #E3F2FD 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #2E7D32 0%, #00897B 100%)',
    audioPermissionAccent: '#2E7D32',
  },

  shadows: neutralShadows('#2E7D32'),
}

export default jungleThemeTokens
