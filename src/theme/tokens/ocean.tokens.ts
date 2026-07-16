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
    confettiColors: ['#4FC3F7', '#80DEEA', '#B2DFDB', '#FFF59D', '#FFAB91', '#B39DDB'],
    notFoundBackground: 'linear-gradient(135deg, #E1F5FE 0%, #B2EBF2 50%, #E0F2F1 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #0288D1 0%, #00897B 100%)',
    audioPermissionAccent: '#0277BD',
  },

  shadows: neutralShadows('#0277BD'),

  // ---- Immersive world (Theme Worlds PRD) ----
  // Round, bubbly title font; falls back to Comic Neue (which also covers æøå).
  titleFontFamily: `"Fredoka", ${COMIC_FONT}`,

  // Asset URLs (src/selectorThumb/mascot.src) are resolved at runtime by
  // loadSceneAssets('ocean'); the values below are the non-asset CONFIG paired with them.
  scene: {
    dark: false,
    // One immersive full-bleed underwater backdrop (opaque). Depth 0.7 → the whole scene
    // pans gently (camera drift); the mascot rides a nearer plane (higher depth) for real
    // parallax separation. ParallaxLayer's scale overscan hides the edges as it moves.
    // Multi-layer parallax (PRD-05 W2). Index-aligned to SceneAssets.layers (far→mid→near).
    layers: [
      { src: '', depth: 0.14, anchor: 'center' }, // far: sunlit water + god-rays
      { src: '', depth: 0.44, anchor: 'center' }, // mid: reef
      { src: '', depth: 0.82, anchor: 'center' }, // near: sandbar + coral
    ],
    ambient: {
      // B7 art motes (index-aligned to SceneAssets.ambientSprites): bubble + bubble cluster, rising.
      sprites: [{ src: '', size: [12, 28] }, { src: '', size: [18, 36] }],
      count: 12,
      motion: 'rise',
    },
    mascot: {
      src: '',
      lines: ['Pluf! Vil du dykke med?', 'Bobler!', 'Sikke flot!'],
    },
    selectorThumb: '',
    music: '/sounds/music/ocean.mp3', // Havet loop ("Aquatic Downtime"); body-trimmed loop in musicClient
    // Structured World (PRD-05 W3): objects hover in the sunlit open water above the seabed, in a
    // gentle arc clear of the coral clusters at the left/right edges. Refine onto shore/coral once
    // B3 near-layer art lands.
    homeAnchors: [
      { section: 'alphabet', xPct: 17, yPct: 60, scale: 1, rotate: -3, depth: 0.3 },
      { section: 'math', xPct: 34, yPct: 54, scale: 1, rotate: 2, depth: 0.32 },
      { section: 'colors', xPct: 50, yPct: 51, scale: 1.06, rotate: 0, depth: 0.34 },
      { section: 'english', xPct: 66, yPct: 54, scale: 1, rotate: -2, depth: 0.32 },
      { section: 'ordleg', xPct: 83, yPct: 60, scale: 1, rotate: 3, depth: 0.3 },
    ],
    sectionFocus: {
      alphabet: { xPct: 22, yPct: 55, zoom: 1.32 },
      math: { xPct: 36, yPct: 48, zoom: 1.34 },
      colors: { xPct: 50, yPct: 46, zoom: 1.36 },
      english: { xPct: 64, yPct: 48, zoom: 1.34 },
      ordleg: { xPct: 78, yPct: 55, zoom: 1.32 },
    },
    // Earned bloom scenery (PRD-05 W7). Layout only; `src:''` → URL from SceneAssets.bloomScenery
    // by INDEX (batch B5, order: coral, seashell, starfish). Seated low on the seabed.
    bloomScenery: [
      { src: '', minStage: 1, xPct: 10, yPct: 86, depth: 0.6, scale: 1 },
      { src: '', minStage: 2, xPct: 90, yPct: 84, depth: 0.55, scale: 0.9 },
      { src: '', minStage: 3, xPct: 50, yPct: 90, depth: 0.62, scale: 1.1 },
    ],
  },

  materials: {
    cardFrame: '',
    buttonGradient: 'linear-gradient(135deg, #0288D1 0%, #00897B 100%)',
    motif: 'soft',
  },

  // ---- Themed route transition (Liveliness PRD-02) ----
  // A foam-crested wave (opaque ocean-blue gradient) rises from the bottom edge to cover, then
  // recedes downward on reveal (tide out). White foam crest is drawn by the `wave` motif.
  transition: {
    variant: 'wave',
    color: 'linear-gradient(to top, #01579B 0%, #0277BD 55%, #039BE5 100%)',
    direction: 'up',
    coverMs: 260,
    revealMs: 320,
    ease: [0.33, 1, 0.68, 1],
    sfx: 'nav-wave',
    motif: 'wave',
    reduced: 'fade',
  },
}

export default oceanThemeTokens
