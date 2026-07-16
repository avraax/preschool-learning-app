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
    // Multi-layer parallax (PRD-05 W2). Index-aligned to SceneAssets.layers (far→mid→near).
    layers: [
      { src: '', depth: 0.14, anchor: 'center' }, // far: sunrise sky + volcano
      // mid jungle dropped well down so its whole span (incl. the centre over the volcano) meets the
      // near ridge — no longer a green ribbon floating in the sky.
      { src: '', depth: 0.44, anchor: 'center', offsetY: 20 }, // mid: jungle tree-line
      { src: '', depth: 0.82, anchor: 'center' }, // near: mossy ridge
    ],
    ambient: {
      // B7 art motes (index-aligned to SceneAssets.ambientSprites): leaf + fern frond, falling.
      sprites: [{ src: '', size: [18, 34] }, { src: '', size: [16, 30] }],
      count: 12,
      motion: 'fall',
    },
    mascot: {
      src: '',
      lines: ['Rooar! (en venlig en)', 'Lad os grave!', 'Flot fundet!'],
    },
    selectorThumb: '',
    music: '/sounds/music/dino.mp3', // Dinosaurer loop ("Fantasy theme"); body-trimmed loop in musicClient
    // Structured World (PRD-05 W3): objects rest on the jungle canopy/ridge in a gentle arc, the
    // centre one lifted above the volcano peak so it isn't obscured. Refine onto the mossy ridge
    // once B3 near-layer art lands.
    // Seated on the jungle canopy at varied heights; colors rides higher on the centre vine bridge.
    homeAnchors: [
      { section: 'alphabet', xPct: 15, yPct: 60, scale: 0.96, rotate: -3, depth: 0.3 },
      { section: 'math', xPct: 33, yPct: 57, scale: 1.04, rotate: 2, depth: 0.32 },
      { section: 'colors', xPct: 50, yPct: 47, scale: 1.14, rotate: 0, depth: 0.34 },
      { section: 'english', xPct: 68, yPct: 57, scale: 1.04, rotate: -2, depth: 0.32 },
      { section: 'ordleg', xPct: 85, yPct: 60, scale: 0.96, rotate: 3, depth: 0.3 },
    ],
    sectionFocus: {
      alphabet: { xPct: 22, yPct: 58, zoom: 1.32 },
      math: { xPct: 36, yPct: 56, zoom: 1.34 },
      colors: { xPct: 50, yPct: 48, zoom: 1.36 },
      english: { xPct: 64, yPct: 56, zoom: 1.34 },
      ordleg: { xPct: 78, yPct: 58, zoom: 1.32 },
    },
    // Earned bloom scenery (PRD-05 W7). Layout only; `src:''` → URL from SceneAssets.bloomScenery
    // by INDEX (batch B5, order: fern sprout, egg, mushroom). Rest on the jungle ridge.
    bloomScenery: [
      { src: '', minStage: 1, xPct: 10, yPct: 78, depth: 0.55, scale: 1 },
      { src: '', minStage: 2, xPct: 90, yPct: 80, depth: 0.5, scale: 0.95 },
      { src: '', minStage: 3, xPct: 30, yPct: 84, depth: 0.58, scale: 1.05 },
    ],
  },

  materials: {
    cardFrame: '',
    buttonGradient: 'linear-gradient(135deg, #558B2F 0%, #00796B 100%)',
    motif: 'soft',
  },

  // ---- Themed route transition (Liveliness PRD-02) ----
  // An earthy green→amber panel sweeps left→right with tumbling leaves on the leading edge (a
  // stompy, dusty crossing).
  transition: {
    variant: 'leaves',
    color: 'linear-gradient(90deg, #33691E 0%, #558B2F 55%, #C56000 100%)',
    direction: 'right',
    coverMs: 260,
    revealMs: 320,
    ease: [0.45, 0, 0.55, 1],
    sfx: 'nav-stomp',
    motif: 'leaves',
    reduced: 'fade',
  },
}

export default dinoThemeTokens
