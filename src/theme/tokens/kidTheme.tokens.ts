import type { ThemeTokens } from './types'
import { onCardColor, tileSurface } from './helpers'

// DEFAULT THEME — "kid" skin.
// Holds today's EXACT values so the app looks identical after the token migration.
// To add a new theme: copy this file, rename the id/name, edit the values, and pass the
// new object to `buildTheme()` (see CLAUDE.md).

// Single bundled font, defined ONCE here. Comic Neue is self-hosted via @fontsource so it
// renders identically on every OS/device. A future theme defines its own fontFamily.
const FONT_FAMILY = '"Comic Neue", "Comic Sans MS", "Comic Sans", sans-serif'

export const kidThemeTokens: ThemeTokens = {
  id: 'kid',
  name: 'Regnbue',
  selectorEmoji: '🌈',
  fontFamily: FONT_FAMILY,

  palette: {
    primary: { main: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED', contrastText: '#FFFFFF' },
    secondary: { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB', contrastText: '#FFFFFF' },
    success: { main: '#10B981', light: '#34D399', dark: '#059669', contrastText: '#FFFFFF' },
    warning: { main: '#F59E0B', light: '#FBBF24', dark: '#D97706', contrastText: '#FFFFFF' },
    error: { main: '#EF4444', light: '#F87171', dark: '#DC2626', contrastText: '#FFFFFF' },
    info: { main: '#06B6D4', light: '#22D3EE', dark: '#0891B2', contrastText: '#FFFFFF' },
    pink: { main: '#EC4899', light: '#F472B6', dark: '#DB2777', contrastText: '#FFFFFF' },
    backgroundDefault: '#F8FAFC',
    backgroundPaper: '#FFFFFF',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
  },

  categories: {
    alphabet: {
      gradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 50%, #90CAF9 100%)',
      accent: '#1976D2',
      onCard: onCardColor('#1976D2'),
      tileSurface: tileSurface('#1976D2'),
      border: '#64B5F6',
      hoverBorder: '#1976D2',
      icon: '📚',
      iconSize: '4rem',
      cardSurface: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(227, 242, 253, 0.9) 100%)',
      cardBlur: 'blur(15px)',
    },
    math: {
      gradient: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 50%, #CE93D8 100%)',
      accent: '#9C27B0',
      onCard: onCardColor('#9C27B0'),
      tileSurface: tileSurface('#9C27B0'),
      border: '#BA68C8',
      hoverBorder: '#9C27B0',
      icon: '🧮',
      iconSize: '4rem',
      cardSurface: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(243, 229, 245, 0.9) 100%)',
      cardBlur: 'blur(15px)',
    },
    colors: {
      gradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 50%, #FFCC80 100%)',
      accent: '#E65100',
      onCard: onCardColor('#E65100'),
      tileSurface: tileSurface('#E65100'),
      border: '#FFB74D',
      hoverBorder: '#FF6B00',
      icon: '🎨',
      iconSize: '4rem',
      cardSurface: 'linear-gradient(135deg, rgba(255, 243, 224, 0.95) 0%, rgba(255, 224, 178, 0.95) 100%)',
      cardBlur: 'blur(10px)',
    },
    english: {
      gradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 50%, #A5D6A7 100%)',
      accent: '#2E7D32',
      onCard: onCardColor('#2E7D32'),
      tileSurface: tileSurface('#2E7D32'),
      border: '#66BB6A',
      hoverBorder: '#2E7D32',
      icon: '🌍',
      iconSize: '4rem',
      cardSurface: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(232, 245, 233, 0.9) 100%)',
      cardBlur: 'blur(15px)',
    },
    ordleg: {
      gradient: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 50%, #80CBC4 100%)',
      accent: '#00796B',
      onCard: onCardColor('#00796B'),
      tileSurface: tileSurface('#00796B'),
      border: '#4DB6AC',
      hoverBorder: '#00796B',
      icon: '🗣️',
      iconSize: '4rem',
      cardSurface: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(224, 242, 241, 0.9) 100%)',
      cardBlur: 'blur(15px)',
    },
  },

  decor: {
    pageBackground: '#F8FAFC',
    rainbow:
      'conic-gradient(from 0deg at 50% 100%, #FF0000 0deg, #FF8C00 51deg, #FFD700 102deg, #32CD32 153deg, #1E90FF 204deg, #9932CC 255deg, #8B00FF 306deg, #FF0000 360deg)',
    // The four white "dot" layers behind the home content (rendered over pageBackground).
    dots: [
      'radial-gradient(circle at 15% 25%, rgba(255, 255, 255, 0.8) 25px, transparent 26px)',
      'radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.8) 30px, transparent 31px)',
      'radial-gradient(circle at 25% 70%, rgba(255, 255, 255, 0.8) 28px, transparent 29px)',
      'radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.8) 22px, transparent 23px)',
    ].join(',\n'),
    titleColor: '#8B5CF6',
    subtitleColor: '#F87171',
    confettiColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'],
    notFoundBackground: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    audioPermissionAccent: '#667eea',
  },

  shadows: {
    card: '0 8px 32px rgba(0, 0, 0, 0.12)',
    cardHover: '0 12px 48px rgba(0, 0, 0, 0.18)',
    focusRing: '0 0 0 4px rgba(139, 92, 246, 0.4)',
    // Punchy branded lift for focal/pressed states (primary #8B5CF6).
    pop: '0 4px 0 rgb(97, 64, 172), 0 10px 24px rgba(139, 92, 246, 0.35)',
  },

  // ---- Immersive world (Theme Worlds PRD) — gentle, light, familiar default ----
  // Title font stays Comic Neue (omitted → falls back to fontFamily), per the PRD.
  scene: {
    dark: false,
    // Multi-layer parallax (PRD-05 W2). Index-aligned to SceneAssets.layers (far→mid→near).
    layers: [
      { src: '', depth: 0.14, anchor: 'center' }, // far: rainbow sky
      { src: '', depth: 0.44, anchor: 'center' }, // mid: floating clouds
      { src: '', depth: 0.82, anchor: 'center' }, // near: cloud bank
    ],
    ambient: {
      // B7 art motes (index-aligned to SceneAssets.ambientSprites): soft cloud puffs drifting.
      sprites: [{ src: '', size: [22, 44] }],
      count: 7,
      motion: 'drift',
    },
    mascot: {
      src: '',
      lines: ['Hej! Skal vi lege?', 'Godt klaret!', 'Vi ses!'],
    },
    selectorThumb: '',
    music: '/sounds/music/kid.mp3', // Regnbue loop ("Rainbow Adventures"); body-trimmed loop in musicClient
    // Structured World (PRD-05 W3): the 5 section objects rest along a gentle rainbow-arc smile
    // in the open sky under the rainbow (up in the middle), clear of the bottom cloud bank +
    // corner mascot. Refine onto real cloud puffs once B3/B5 near-layer art lands.
    homeAnchors: [
      { section: 'alphabet', xPct: 15, yPct: 65, scale: 0.94, rotate: -3, depth: 0.3 },
      { section: 'math', xPct: 33, yPct: 61, scale: 1.02, rotate: 2, depth: 0.32 },
      { section: 'colors', xPct: 50, yPct: 59, scale: 1.14, rotate: 0, depth: 0.34 },
      { section: 'english', xPct: 67, yPct: 61, scale: 1.02, rotate: -2, depth: 0.32 },
      { section: 'ordleg', xPct: 85, yPct: 65, scale: 0.94, rotate: 3, depth: 0.3 },
    ],
    // Section framing (PRD-05 W4/W5): each section pushes into the region where its object sat,
    // so /alphabet feels like a different corner of the sky than /math (continuity with the push-in).
    sectionFocus: {
      alphabet: { xPct: 22, yPct: 52, zoom: 1.32 },
      math: { xPct: 36, yPct: 46, zoom: 1.34 },
      colors: { xPct: 50, yPct: 44, zoom: 1.36 },
      english: { xPct: 64, yPct: 46, zoom: 1.34 },
      ordleg: { xPct: 78, yPct: 52, zoom: 1.32 },
    },
    // Earned bloom scenery (PRD-05 W7). Layout only; `src:''` → the URL comes from
    // SceneAssets.bloomScenery by INDEX (batch B5, order: flower, sparkle-star, cloud puff).
    bloomScenery: [
      { src: '', minStage: 1, xPct: 12, yPct: 82, depth: 0.55, scale: 1 },
      { src: '', minStage: 2, xPct: 88, yPct: 28, depth: 0.3, scale: 0.9 },
      { src: '', minStage: 3, xPct: 72, yPct: 86, depth: 0.6, scale: 1.15 },
    ],
  },

  materials: {
    cardFrame: '',
    buttonGradient: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
    motif: 'soft',
  },

  // ---- Themed route transition (Liveliness PRD-02) ----
  // Rainbow iris: an opaque rainbow radial rises from the bottom (echoing the home arc), covers,
  // then irises open to reveal the next page. Bright sparkle speckle on top.
  transition: {
    variant: 'iris',
    color: 'radial-gradient(circle at 50% 108%, #8B5CF6 0%, #3B82F6 30%, #EC4899 62%, #F59E0B 100%)',
    direction: 'up',
    coverMs: 240,
    revealMs: 300,
    ease: [0.22, 1, 0.36, 1],
    sfx: 'nav-whoosh',
    motif: 'sparkle',
    reduced: 'fade',
  },
}

export default kidThemeTokens
