import type { ThemeTokens } from './types'
import { COMIC_FONT, SECTION_ICONS, WHITE_DOTS, category, neutralShadows } from './helpers'

// 🌊 Havet (Ocean) — cool blues & teals with a warm coral pop and sandy gold.
export const oceanThemeTokens: ThemeTokens = {
  id: 'ocean',
  name: 'Havet',
  selectorEmoji: '🌊',
  fontFamily: COMIC_FONT,

  palette: {
    primary: { main: '#0277BD', light: '#58A5F0', dark: '#004C8C', contrastText: '#FFFFFF' },
    secondary: { main: '#00897B', light: '#4EBAAA', dark: '#005B4F', contrastText: '#FFFFFF' },
    success: { main: '#2E7D32', light: '#60AD5E', dark: '#005005', contrastText: '#FFFFFF' },
    warning: { main: '#F9A825', light: '#FFD95A', dark: '#C17900', contrastText: '#FFFFFF' },
    error: { main: '#D32F2F', light: '#FF6659', dark: '#9A0007', contrastText: '#FFFFFF' },
    info: { main: '#00ACC1', light: '#5DDEF4', dark: '#007C91', contrastText: '#FFFFFF' },
    pink: { main: '#EC407A', light: '#FF77A9', dark: '#B4004E', contrastText: '#FFFFFF' },
    backgroundDefault: '#F0F9FF',
    backgroundPaper: '#FFFFFF',
    textPrimary: '#0F2A3F',
    textSecondary: '#4A6572',
  },

  categories: {
    alphabet: category(['#E1F5FE', '#B3E5FC', '#81D4FA'], '#0277BD', '#4FC3F7', '#01579B', '#E1F5FE', SECTION_ICONS.alphabet),
    math: category(['#E0F2F1', '#B2DFDB', '#80CBC4'], '#00897B', '#4DB6AC', '#00695C', '#E0F2F1', SECTION_ICONS.math),
    colors: category(['#FBE9E7', '#FFCCBC', '#FFAB91'], '#E64A19', '#FF8A65', '#BF360C', '#FBE9E7', SECTION_ICONS.colors),
    english: category(['#FFFDE7', '#FFF9C4', '#FFF59D'], '#F9A825', '#FFD54F', '#F57F17', '#FFFDE7', SECTION_ICONS.english),
    ordleg: category(['#EDE7F6', '#D1C4E9', '#B39DDB'], '#5E35B1', '#9575CD', '#4527A0', '#EDE7F6', SECTION_ICONS.ordleg),
  },

  decor: {
    pageBackground: '#F0F9FF',
    rainbow:
      'conic-gradient(from 0deg at 50% 100%, #01579B 0deg, #0288D1 60deg, #00ACC1 120deg, #26C6DA 180deg, #00897B 240deg, #4FC3F7 300deg, #01579B 360deg)',
    dots: WHITE_DOTS,
    titleColor: '#0277BD',
    subtitleColor: '#FF7043',
    balloonColors: ['#0277BD', '#00ACC1', '#26C6DA', '#00897B', '#FFD54F', '#FF7043', '#5E35B1'],
    confettiColors: ['#4FC3F7', '#80DEEA', '#B2DFDB', '#FFF59D', '#FFAB91', '#B39DDB'],
    notFoundBackground: 'linear-gradient(135deg, #E1F5FE 0%, #B2EBF2 50%, #E0F2F1 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #0288D1 0%, #00897B 100%)',
    audioPermissionAccent: '#0277BD',
  },

  shadows: neutralShadows('#0277BD'),
}

export default oceanThemeTokens
