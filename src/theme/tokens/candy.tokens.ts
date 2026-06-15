import type { ThemeTokens } from './types'
import { COMIC_FONT, SECTION_ICONS, WHITE_DOTS, category, neutralShadows } from './helpers'

// 🍭 Slikland (Candy Land) — sweet & soft: pastel gradient surfaces with rich candy
// accents (bubblegum pink, grape, tangerine, mint, blueberry) that stay readable.
export const candyThemeTokens: ThemeTokens = {
  id: 'candy',
  name: 'Slikland',
  selectorEmoji: '🍭',
  fontFamily: COMIC_FONT,

  palette: {
    primary: { main: '#D81B60', light: '#FF5C8D', dark: '#A00037', contrastText: '#FFFFFF' },
    secondary: { main: '#8E24AA', light: '#C158DC', dark: '#5C007A', contrastText: '#FFFFFF' },
    success: { main: '#43A047', light: '#76D275', dark: '#00701A', contrastText: '#FFFFFF' },
    warning: { main: '#F4511E', light: '#FF844C', dark: '#B91400', contrastText: '#FFFFFF' },
    error: { main: '#E53935', light: '#FF6F60', dark: '#AB000D', contrastText: '#FFFFFF' },
    info: { main: '#039BE5', light: '#63CCFF', dark: '#006DB3', contrastText: '#FFFFFF' },
    pink: { main: '#EC407A', light: '#FF77A9', dark: '#B4004E', contrastText: '#FFFFFF' },
    backgroundDefault: '#FFF5FA',
    backgroundPaper: '#FFFFFF',
    textPrimary: '#4A2C3A',
    textSecondary: '#8A5A6E',
  },

  categories: {
    alphabet: category(['#FCE4EC', '#F8BBD0', '#F48FB1'], '#D81B60', '#F06292', '#AD1457', '#FCE4EC', SECTION_ICONS.alphabet),
    math: category(['#F3E5F5', '#E1BEE7', '#CE93D8'], '#8E24AA', '#BA68C8', '#6A1B9A', '#F3E5F5', SECTION_ICONS.math),
    colors: category(['#FFF3E0', '#FFE0B2', '#FFCC80'], '#F4511E', '#FF8A65', '#D84315', '#FFF3E0', SECTION_ICONS.colors),
    english: category(['#E0F2F1', '#B2DFDB', '#80CBC4'], '#00897B', '#4DB6AC', '#00695C', '#E0F2F1', SECTION_ICONS.english),
    ordleg: category(['#E1F5FE', '#B3E5FC', '#81D4FA'], '#039BE5', '#4FC3F7', '#0277BD', '#E1F5FE', SECTION_ICONS.ordleg),
  },

  decor: {
    pageBackground: '#FFF5FA',
    rainbow:
      'conic-gradient(from 0deg at 50% 100%, #D81B60 0deg, #EC407A 60deg, #8E24AA 120deg, #039BE5 180deg, #00897B 240deg, #F4511E 300deg, #D81B60 360deg)',
    dots: WHITE_DOTS,
    titleColor: '#D81B60',
    subtitleColor: '#8E24AA',
    confettiColors: ['#F8BBD0', '#E1BEE7', '#FFCC80', '#B2DFDB', '#B3E5FC', '#FF80AB'],
    notFoundBackground: 'linear-gradient(135deg, #FCE4EC 0%, #F3E5F5 50%, #E1F5FE 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #D81B60 0%, #8E24AA 100%)',
    audioPermissionAccent: '#D81B60',
  },

  shadows: neutralShadows('#D81B60'),
}

export default candyThemeTokens
