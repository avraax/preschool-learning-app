import type { ThemeTokens } from './types'

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
    balloonColors: ['#EF4444', '#3B82F6', '#10B981', '#FDE047', '#8B5CF6', '#F97316', '#EC4899'],
    confettiColors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'],
    notFoundBackground: 'linear-gradient(135deg, #dbeafe 0%, #e9d5ff 50%, #fce7f3 100%)',
    audioPermissionGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    audioPermissionAccent: '#667eea',
  },

  shadows: {
    card: '0 8px 32px rgba(0, 0, 0, 0.12)',
    cardHover: '0 12px 48px rgba(0, 0, 0, 0.18)',
    // Not yet consumed in Phase 1; derived from primary for future focus styling.
    focusRing: '0 0 0 4px rgba(139, 92, 246, 0.4)',
  },

  // ---- Immersive world (Theme Worlds PRD) — gentle, light, familiar default ----
  // Title font stays Comic Neue (omitted → falls back to fontFamily), per the PRD.
  scene: {
    dark: false,
    layers: [{ src: '', depth: 0.6, anchor: 'center' }], // soft sky + rainbow backdrop
    ambient: {
      sprites: [], // CSS drifting sparkles (no art)
      count: 14,
      motion: 'drift',
    },
    mascot: {
      src: '',
      lines: ['Hej! Skal vi lege?', 'Godt klaret!', 'Vi ses!'],
    },
    selectorThumb: '',
  },

  materials: {
    cardFrame: '',
    buttonGradient: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
    motif: 'soft',
  },
}

export default kidThemeTokens
