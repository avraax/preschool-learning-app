import type { CategoryPalette, MaterialTokens, SceneTokens, ShadowTokens } from './types'

// The bundled kid-friendly font. All current themes share it; a theme may override its own.
export const COMIC_FONT = '"Comic Neue", "Comic Sans MS", "Comic Sans", sans-serif'

// Authoring helpers for theme token files. The default "kid" theme keeps its hand-written
// exact values; every OTHER theme is authored with these so the structure stays identical
// across skins and only the colours differ.

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full, 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const gradient3 = (c1: string, c2: string, c3: string): string =>
  `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`

// Darken a hex colour toward black by `amount` (0–1). Used for the soft-3D "edge/lip" under
// tactile tiles (AnswerTile/SymbolTile) so the bottom shadow reads as a coloured rim of the
// section accent rather than flat grey.
export const darken = (hex: string, amount: number): string => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full, 16)
  const f = Math.max(0, 1 - amount)
  const r = Math.round(((num >> 16) & 255) * f)
  const g = Math.round(((num >> 8) & 255) * f)
  const b = Math.round((num & 255) * f)
  return `rgb(${r}, ${g}, ${b})`
}

// Frosted home-card surface: white → soft category tint (matches the default theme's pattern).
export const cardSurface = (tint: string): string =>
  `linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, ${hexToRgba(tint, 0.9)} 100%)`

// Section emojis stay constant across themes so children keep recognising each section;
// a theme changes colours/decor, not what a section IS.
export const SECTION_ICONS = {
  alphabet: '📚',
  math: '🧮',
  colors: '🎨',
  english: '🌍',
  ordleg: '🗣️',
} as const

// Build one section palette. `gradientStops` = the 3 stops of the section-page background;
// `tint` = the very-light colour blended into the home card.
export const category = (
  gradientStops: [string, string, string],
  accent: string,
  border: string,
  hoverBorder: string,
  tint: string,
  icon: string
): CategoryPalette => ({
  gradient: gradient3(...gradientStops),
  accent,
  border,
  hoverBorder,
  icon,
  iconSize: '4rem',
  cardSurface: cardSurface(tint),
  cardBlur: 'blur(15px)',
})

// The white "dot" texture behind the home content — universal across skins.
export const WHITE_DOTS = [
  'radial-gradient(circle at 15% 25%, rgba(255, 255, 255, 0.8) 25px, transparent 26px)',
  'radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.8) 30px, transparent 31px)',
  'radial-gradient(circle at 25% 70%, rgba(255, 255, 255, 0.8) 28px, transparent 29px)',
  'radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.8) 22px, transparent 23px)',
].join(',\n')

// Neutral drop shadows (look right on any skin); focus ring tinted with the theme's primary.
export const neutralShadows = (focusColor: string): ShadowTokens => ({
  card: '0 8px 32px rgba(0, 0, 0, 0.12)',
  cardHover: '0 12px 48px rgba(0, 0, 0, 0.18)',
  focusRing: `0 0 0 4px ${hexToRgba(focusColor, 0.4)}`,
})

// ---- Immersive world defaults (Theme Worlds PRD) -------------------------------------
// A theme with no authored `scene` renders today's flat look: no parallax, no ambient
// objects, no mascot. `buildTheme()` uses this as the fallback.
export const emptyScene = (): SceneTokens => ({
  dark: false,
  layers: [],
  ambient: { sprites: [], count: 0, motion: 'drift' },
  mascot: { src: '', lines: [] },
  selectorThumb: '',
})

// A theme with no authored `materials` keeps today's card/button surfaces (motif '' = none).
export const noMaterials = (): MaterialTokens => ({
  cardFrame: '',
  buttonGradient: '',
  motif: '',
})
