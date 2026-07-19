import type {
  CategoryPalette,
  HomeAnchor,
  MaterialTokens,
  SceneFocus,
  SceneSectionId,
  SceneTokens,
  ShadowTokens,
} from './types'

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

// ---- WCAG contrast utilities (UI/UX Overhaul PRD §5.1 — `onCard` AA guarantee) --------------
// Parse either #hex (3/6) or rgb()/rgba() into [r,g,b] 0–255.
const toRgb = (color: string): [number, number, number] => {
  if (color.startsWith('rgb')) {
    const m = color.match(/[\d.]+/g) ?? []
    return [Number(m[0]) || 0, Number(m[1]) || 0, Number(m[2]) || 0]
  }
  const h = color.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

const channelLin = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

// WCAG relative luminance (0 black → 1 white).
export const relLuminance = (color: string): number => {
  const [r, g, b] = toRgb(color)
  return 0.2126 * channelLin(r) + 0.7152 * channelLin(g) + 0.0722 * channelLin(b)
}

// WCAG contrast ratio between two opaque colours (1–21).
export const contrastRatio = (a: string, b: string): number => {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// Darken `fg` toward black in small steps until it clears `ratio` against `bg` (or hits black).
export const ensureContrast = (fg: string, bg = '#FFFFFF', ratio = 4.5): string => {
  if (contrastRatio(fg, bg) >= ratio) return fg
  let amount = 0
  let out = fg
  while (contrastRatio(out, bg) < ratio && amount < 0.96) {
    amount += 0.04
    out = darken(fg, amount)
  }
  return out
}

// AA-guaranteed label colour for text on frosted cards/menus (keeps the accent's hue; darkens
// only as much as needed). Target: contrast ≥7.5:1 vs white → luminance ≤ ~0.09, which clears
// AA (≥4.5:1) even on the darkest frosted surface we allow (opaque light glass over a dark world,
// luminance ~0.69 — see the dark-scene card opacity in App/GameSelectionLayout). Warm accents
// (gold/orange) become a deep amber/rust; already-dark accents (navy/green) are barely touched.
export const onCardColor = (accent: string): string => ensureContrast(accent, '#FFFFFF', 7.5)

// AA label colour for accent TEXT/GLYPHS drawn on an (essentially WHITE) answer-tile / card /
// memory-face surface — `tileSurface` is white→faint-accent, luminance ~1.0, so 4.5:1 vs white is
// the correct, sufficient target (unlike frosted menu cards, which need `onCardColor`'s 7.5:1).
// It's a NO-OP when the accent already clears 4.5:1, so readable accents (most of the default kid
// skin) are untouched and keep their vividness; only genuinely-too-light accents (e.g. Rummet's
// cyan #00ACC1 → #007c8b, Havet's yellow #F9A825 → #9f6c18) darken just enough to read. Keeps the
// hue — the tiles stay colourful, they stop being illegible. See `ensureContrast`.
export const onTileColor = (accent: string): string => ensureContrast(accent, '#FFFFFF', 4.5)

// Section-tinted idle answer-tile surface (white → faint accent tint). `dark` deepens the tint
// slightly so it still reads over dark worlds. Replaces the old hardcoded `#ECF1F8`.
export const tileSurface = (accent: string, dark = false): string =>
  `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(accent, dark ? 0.14 : 0.08)} 100%)`

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
  onCard: onCardColor(accent),
  tileSurface: tileSurface(accent),
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
  // Punchy branded lift for focal/pressed states (coloured lip + soft glow in the theme primary).
  pop: `0 4px 0 ${darken(focusColor, 0.3)}, 0 10px 24px ${hexToRgba(focusColor, 0.35)}`,
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

// ---- Structured World defaults (Liveliness PRD-05) -----------------------------------
// A theme that hasn't authored per-theme seating/framing still gets a sensible, balanced
// arrangement so the home objects + section framing work. Each theme is expected to OVERRIDE
// these with anchors that sit on its own near-layer features (clouds/shore/asteroids/ridges).

export const SCENE_SECTION_ORDER: SceneSectionId[] = ['alphabet', 'math', 'colors', 'english', 'ordleg']

// 5 objects on a gentle rainbow arc across the lower-middle of the scene (predictable, uncluttered).
export const defaultHomeAnchors = (): HomeAnchor[] => [
  { section: 'alphabet', xPct: 16, yPct: 54, scale: 1, depth: 0.3 },
  { section: 'math', xPct: 33, yPct: 47, scale: 1, depth: 0.32 },
  { section: 'colors', xPct: 50, yPct: 44, scale: 1.04, depth: 0.34 },
  { section: 'english', xPct: 67, yPct: 47, scale: 1, depth: 0.32 },
  { section: 'ordleg', xPct: 84, yPct: 54, scale: 1, depth: 0.3 },
]

// A neutral centred focus per section (no zoom-in) — themes override to frame their own locale.
export const defaultSectionFocus = (): Record<SceneSectionId, SceneFocus> => {
  const centred: SceneFocus = { xPct: 50, yPct: 50, zoom: 1.15 }
  return {
    alphabet: { ...centred },
    math: { ...centred },
    colors: { ...centred },
    english: { ...centred },
    ordleg: { ...centred },
  }
}
