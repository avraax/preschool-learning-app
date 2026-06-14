import type { ThemeTokens } from './types'
import { COMIC_FONT, SECTION_ICONS, WHITE_DOTS, category, neutralShadows } from './helpers'

// 🦕 Dinosaurer (Dinosaurs) — earthy prehistoric adventure: fern green, swamp teal,
// volcano orange-red, stone slate and amber bone.
export const dinoThemeTokens: ThemeTokens = {
  id: 'dino',
  name: 'Dinosaurer',
  selectorEmoji: '🦕',
  fontFamily: COMIC_FONT,

  palette: {
    primary: { main: '#558B2F', light: '#85BB5C', dark: '#255D00', contrastText: '#FFFFFF' },
    secondary: { main: '#D84315', light: '#FF7543', dark: '#9F0000', contrastText: '#FFFFFF' },
    success: { main: '#43A047', light: '#76D275', dark: '#00701A', contrastText: '#FFFFFF' },
    warning: { main: '#FF8F00', light: '#FFC046', dark: '#C56000', contrastText: '#FFFFFF' },
    error: { main: '#C62828', light: '#FF5F52', dark: '#8E0000', contrastText: '#FFFFFF' },
    info: { main: '#00796B', light: '#48A999', dark: '#004C40', contrastText: '#FFFFFF' },
    pink: { main: '#AD1457', light: '#E35183', dark: '#78002E', contrastText: '#FFFFFF' },
    backgroundDefault: '#F5F5EE',
    backgroundPaper: '#FFFFFF',
    textPrimary: '#33291A',
    textSecondary: '#6B5D49',
  },

  categories: {
    alphabet: category(['#E8F5E9', '#C8E6C9', '#A5D6A7'], '#558B2F', '#8BC34A', '#33691E', '#E8F5E9', SECTION_ICONS.alphabet),
    math: category(['#E0F2F1', '#B2DFDB', '#80CBC4'], '#00796B', '#4DB6AC', '#004D40', '#E0F2F1', SECTION_ICONS.math),
    colors: category(['#FBE9E7', '#FFCCBC', '#FFAB91'], '#D84315', '#FF7043', '#BF360C', '#FBE9E7', SECTION_ICONS.colors),
    english: category(['#ECEFF1', '#CFD8DC', '#B0BEC5'], '#455A64', '#78909C', '#263238', '#ECEFF1', SECTION_ICONS.english),
    ordleg: category(['#FFF8E1', '#FFECB3', '#FFE082'], '#FF8F00', '#FFB300', '#E65100', '#FFF8E1', SECTION_ICONS.ordleg),
  },

  decor: {
    pageBackground: '#F5F5EE',
    rainbow:
      'conic-gradient(from 0deg at 50% 100%, #33691E 0deg, #558B2F 60deg, #00796B 120deg, #455A64 180deg, #D84315 240deg, #FF8F00 300deg, #33691E 360deg)',
    dots: WHITE_DOTS,
    titleColor: '#558B2F',
    subtitleColor: '#D84315',
    balloonColors: ['#558B2F', '#00796B', '#D84315', '#455A64', '#FF8F00', '#8BC34A', '#AD1457'],
    confettiColors: ['#A5D6A7', '#80CBC4', '#FFAB91', '#B0BEC5', '#FFE082', '#C5E1A5'],
    notFoundBackground: 'linear-gradient(135deg, #E8F5E9 0%, #FBE9E7 50%, #ECEFF1 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #558B2F 0%, #00796B 100%)',
    audioPermissionAccent: '#558B2F',
  },

  shadows: neutralShadows('#558B2F'),

  // ---- Immersive world (Theme Worlds PRD) ----
  // Baloo 2: chunky, playful, full Danish coverage (Bangers was the PRD pick but risks
  // missing æøå as an all-caps display face).
  titleFontFamily: `"Baloo 2", ${COMIC_FONT}`,

  scene: {
    dark: false,
    layers: [{ src: '', depth: 0.65, anchor: 'center' }], // warm prehistoric backdrop
    ambient: {
      sprites: [], // CSS falling leaves (no art)
      count: 14,
      motion: 'fall',
    },
    mascot: {
      src: '',
      lines: ['Rooar! (en venlig en)', 'Lad os grave!', 'Flot fundet!'],
    },
    selectorThumb: '',
  },

  materials: {
    cardFrame: '',
    buttonGradient: 'linear-gradient(135deg, #558B2F 0%, #00796B 100%)',
    motif: 'soft',
  },
}

export default dinoThemeTokens
