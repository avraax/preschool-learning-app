import type { ThemeTokens } from './types'
import { COMIC_FONT, SECTION_ICONS, WHITE_DOTS, category, neutralShadows } from './helpers'

// 🚀 Rummet (Space) — light cosmic skin: periwinkle base with vivid nebula purples,
// rocket red, alien cyan and star gold (kept light so cards/text stay readable).
export const spaceThemeTokens: ThemeTokens = {
  id: 'space',
  name: 'Rummet',
  selectorEmoji: '🚀',
  fontFamily: COMIC_FONT,

  palette: {
    primary: { main: '#3949AB', light: '#6F74DD', dark: '#00227B', contrastText: '#FFFFFF' },
    secondary: { main: '#8E24AA', light: '#C158DC', dark: '#5C007A', contrastText: '#FFFFFF' },
    success: { main: '#43A047', light: '#76D275', dark: '#00701A', contrastText: '#FFFFFF' },
    warning: { main: '#FF8F00', light: '#FFC046', dark: '#C56000', contrastText: '#FFFFFF' },
    error: { main: '#E53935', light: '#FF6F60', dark: '#AB000D', contrastText: '#FFFFFF' },
    info: { main: '#00ACC1', light: '#5DDEF4', dark: '#007C91', contrastText: '#FFFFFF' },
    pink: { main: '#D500F9', light: '#FF52FF', dark: '#9E00C5', contrastText: '#FFFFFF' },
    backgroundDefault: '#F4F4FF',
    backgroundPaper: '#FFFFFF',
    textPrimary: '#1A1A40',
    textSecondary: '#4E4E7A',
  },

  categories: {
    alphabet: category(['#E8EAF6', '#C5CAE9', '#9FA8DA'], '#3949AB', '#7986CB', '#283593', '#E8EAF6', SECTION_ICONS.alphabet),
    math: category(['#F3E5F5', '#E1BEE7', '#CE93D8'], '#8E24AA', '#BA68C8', '#6A1B9A', '#F3E5F5', SECTION_ICONS.math),
    colors: category(['#FFEBEE', '#FFCDD2', '#EF9A9A'], '#E53935', '#EF5350', '#C62828', '#FFEBEE', SECTION_ICONS.colors),
    english: category(['#E0F7FA', '#B2EBF2', '#80DEEA'], '#00ACC1', '#4DD0E1', '#00838F', '#E0F7FA', SECTION_ICONS.english),
    ordleg: category(['#FFF8E1', '#FFECB3', '#FFE082'], '#FF8F00', '#FFB300', '#FF6F00', '#FFF8E1', SECTION_ICONS.ordleg),
  },

  decor: {
    pageBackground: '#F4F4FF',
    rainbow:
      'conic-gradient(from 0deg at 50% 100%, #283593 0deg, #3949AB 60deg, #8E24AA 120deg, #D500F9 180deg, #E53935 240deg, #FF8F00 300deg, #283593 360deg)',
    dots: WHITE_DOTS,
    titleColor: '#3949AB',
    subtitleColor: '#8E24AA',
    confettiColors: ['#9FA8DA', '#CE93D8', '#FFE082', '#80DEEA', '#EF9A9A', '#FF52FF'],
    notFoundBackground: 'linear-gradient(135deg, #E8EAF6 0%, #F3E5F5 50%, #E0F7FA 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #3949AB 0%, #8E24AA 100%)',
    audioPermissionAccent: '#3949AB',
  },

  shadows: neutralShadows('#3949AB'),

  // ---- Immersive world (Theme Worlds PRD) — DARK backdrop; cards/text stay light ----
  titleFontFamily: `"Exo 2", ${COMIC_FONT}`,

  scene: {
    dark: true,
    layers: [{ src: '', depth: 0.6, anchor: 'center' }], // full-bleed dark space backdrop
    ambient: {
      sprites: [], // CSS twinkling stars (no art needed)
      count: 28,
      motion: 'twinkle',
    },
    mascot: {
      src: '',
      lines: ['Klar til opsendelse?', '3-2-1!', 'Til stjernerne!'],
    },
    selectorThumb: '',
    music: '/sounds/music/space.mp3', // Rummet loop ("Galaxy/Universe"); body-trimmed + level-matched in musicClient
    // Structured World (PRD-05 W3): objects FLOAT among the stars along an arc across the
    // upper-middle nebula band — deliberately clear of the ringed planet (lower-left) and rocket
    // (lower-right) already painted into the backdrop. Dark world → float shadow (see SceneObjectField).
    homeAnchors: [
      { section: 'alphabet', xPct: 18, yPct: 45, scale: 1, rotate: -3, depth: 0.3 },
      { section: 'math', xPct: 35, yPct: 38, scale: 1, rotate: 2, depth: 0.32 },
      { section: 'colors', xPct: 50, yPct: 35, scale: 1.06, rotate: 0, depth: 0.34 },
      { section: 'english', xPct: 65, yPct: 38, scale: 1, rotate: -2, depth: 0.32 },
      { section: 'ordleg', xPct: 82, yPct: 45, scale: 1, rotate: 3, depth: 0.3 },
    ],
    sectionFocus: {
      alphabet: { xPct: 24, yPct: 46, zoom: 1.32 },
      math: { xPct: 37, yPct: 40, zoom: 1.34 },
      colors: { xPct: 50, yPct: 38, zoom: 1.36 },
      english: { xPct: 63, yPct: 40, zoom: 1.34 },
      ordleg: { xPct: 76, yPct: 46, zoom: 1.32 },
    },
  },

  materials: {
    cardFrame: '',
    buttonGradient: 'linear-gradient(135deg, #3949AB 0%, #8E24AA 100%)',
    motif: 'soft',
  },

  // ---- Themed route transition (Liveliness PRD-02) ----
  // Warp-in: an opaque dark space radial with a starburst scales up from centre to cover; on
  // reveal the field zooms through and out. `rocket` motif rides the centre.
  transition: {
    variant: 'zoom',
    color: 'radial-gradient(circle at 50% 50%, #1A237E 0%, #0B1030 55%, #070B1A 100%)',
    direction: 'in',
    coverMs: 260,
    revealMs: 340,
    ease: [0.16, 1, 0.3, 1],
    sfx: 'nav-warp',
    motif: 'rocket',
    reduced: 'fade',
  },
}

export default spaceThemeTokens
