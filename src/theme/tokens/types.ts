// Theme token schema — the single source of truth for everything "skin"-related.
//
// A theme (skin) = ONE object implementing `ThemeTokens`. Adding a new theme means
// authoring one of these and passing it to `buildTheme()` — no styling values live in
// components. See `kidTheme.tokens.ts` for the default theme and CLAUDE.md for the
// "How to add a theme" guide.
//
// NOTE: This intentionally keeps the FULL MUI colour scale (main/light/dark/contrastText)
// per palette entry rather than a single string, so a reskin reproduces today's exact
// colours with no MUI-derived drift.

import type { SfxCue } from '../../services/sfxClient'

export interface ColorScale {
  main: string
  light: string
  dark: string
  contrastText: string
}

// Per-section visual identity (the 5 category cards/sections).
export interface CategoryPalette {
  gradient: string        // section background gradient (full-screen section pages)
  accent: string          // titles, primary accents, borders/fills
  onCard: string          // AA-guaranteed label colour for text on frosted cards/menus (≥4.5:1)
  tileSurface: string     // section-tinted idle answer-tile surface (white→accent tint)
  border: string
  hoverBorder: string
  icon: string            // emoji glyph
  iconSize: string
  cardSurface: string     // frosted home-card background (white→tint gradient)
  cardBlur: string        // home-card backdrop-filter blur
}

export interface ThemePalette {
  primary: ColorScale
  secondary: ColorScale
  success: ColorScale
  warning: ColorScale
  error: ColorScale
  info: ColorScale
  pink: ColorScale
  backgroundDefault: string
  backgroundPaper: string
  textPrimary: string
  textSecondary: string
}

export interface CategoryTokens {
  alphabet: CategoryPalette
  math: CategoryPalette
  colors: CategoryPalette
  english: CategoryPalette
  ordleg: CategoryPalette
}

// Decorative styling currently hardcoded across components.
export interface DecorTokens {
  pageBackground: string          // home base bg
  rainbow: string                 // home conic-gradient arc
  dots: string                    // home radial-gradient dot texture (the 4 dot layers)
  titleColor: string              // "Børnelæring" logo text
  subtitleColor: string           // tagline + play/book icons
  confettiColors: string[]        // CelebrationEffect default
  notFoundBackground: string      // 404 page background gradient
  audioPermissionGradient: string // iOS audio-permission modal background
  audioPermissionAccent: string   // that modal's button text color
}

// Named shadows so cards/buttons share themable elevation.
export interface ShadowTokens {
  card: string
  cardHover: string
  focusRing: string
  pop: string             // punchy multi-layer tactile shadow for pressed/active + focal states
}

// ---- Immersive "world" tokens (Theme Worlds PRD) -------------------------------------
// These describe a theme's home/menu world: layered parallax scenery, ambient objects,
// a per-world mascot, and themed materials. They are OPTIONAL on ThemeTokens so a skin can
// be authored incrementally (a theme with no `scene`/`materials` renders today's flat look).
// Asset URLs are resolved at runtime by `loadSceneAssets(id)` (code-split per theme); the
// tokens below hold the non-asset CONFIG (depth/motion/lines/etc.) that pairs with them.

export type AmbientMotion = 'rise' | 'fall' | 'drift' | 'twinkle'

export interface ParallaxLayerSpec {
  src: string            // imported asset URL (transparent PNG/WebP/AVIF) or '' to use loader
  depth: number          // 0 = static (far), 1 = strongest parallax (near); ~0.05–0.3 typical
  anchor?: 'top' | 'bottom' | 'center' // placement hint; default = cover/full-bleed
  opacity?: number
}

export interface AmbientSpriteSpec {
  src: string            // small transparent sprite (e.g. a single bubble/leaf/star)
  size: [number, number] // min/max px
}

// The 5 learning sections (matches CategoryTokens' keys / progressStore SectionId). Kept as a
// local alias so this schema file has no runtime dependency on the store.
export type SceneSectionId = keyof CategoryTokens

// ---- Structured World (Liveliness PRD-05) --------------------------------------------
// Per-theme SEATING + FRAMING config for the "objects live in the world" shell. All optional
// on SceneTokens and defaulted in buildTheme, so flat/un-updated skins keep working.

// Where one of the 5 section objects rests on the home scene (percent of the viewport). Each
// theme seats its 5 objects on its own near-layer features (clouds/shore/asteroids/ridges).
export interface HomeAnchor {
  section: SceneSectionId
  xPct: number            // 0–100, horizontal centre of the object
  yPct: number            // 0–100, vertical centre of the object
  scale: number           // relative object size (1 = base)
  rotate?: number         // small resting tilt (deg)
  depth?: number          // parallax ride strength (0 static → ~0.6 near); default ~0.3
}

// Where the persistent world re-centres/zooms when a section menu is framed on its locale
// (the cinematic push-in destination + framed-menu backdrop).
export interface SceneFocus {
  xPct: number            // focal point the world re-centres on (0–100)
  yPct: number
  zoom: number            // scene scale at rest in that section (~1.1–1.4)
}

// A discrete, stage-gated scenery sprite that fades/pops in as the section's bloom stage rises.
export interface BloomSprite {
  src: string             // resolved sprite URL (or '' to use a loader-provided one by index)
  minStage: number        // appears once bloomStage ≥ this (0–4)
  xPct: number
  yPct: number
  depth: number           // parallax ride strength
  scale: number
  section?: SceneSectionId // optional: only bloom in this section's framed scene (else home/all)
}

export interface SceneTokens {
  dark: boolean                 // dark decorative backdrop (Space). Cards/text stay light.
  layers: ParallaxLayerSpec[]   // back→front; rendered behind content with parallax
  ambient: {
    sprites: AmbientSpriteSpec[]
    count: number               // simultaneous objects (perf-capped, see PRD §7)
    motion: AmbientMotion
  }
  mascot: {
    src: string                 // mascot sprite (transparent)
    lines: string[]             // short Danish phrases spoken on tap (pick one at random)
  }
  selectorThumb: string         // small scene thumbnail for the theme selector
  music?: string                // per-world ambient loop URL (optional; absence → no music)
  // Optional growing-companion override (Liveliness PRD-01). `stages` are per-level-milestone emoji
  // (or asset URLs) for the home companion + level-up growth reveal; `ringColor` tints its XP ring.
  // Absent → a generic plant companion + a primary-derived ring color (see ProgressionCompanion).
  progressionCompanion?: { stages: string[]; ringColor: string }
  // ---- Structured World (Liveliness PRD-05) — all optional, defaulted in buildTheme ----
  homeAnchors?: HomeAnchor[]                          // per-theme seating of the 5 section objects (W3)
  sectionFocus?: Partial<Record<SceneSectionId, SceneFocus>> // per-section camera focus (W2/W4/W5)
  bloomScenery?: BloomSprite[]                        // discrete stage-gated scenery sprites (W7)
}

export interface MaterialTokens {
  // Home + menu "furniture" (NOT applied to game screens).
  cardFrame: string             // border/frame treatment (CSS border or background image)
  cardSurfaceOverlay?: string   // optional texture overlay on cards (subtle, low opacity)
  buttonGradient: string        // primary/menu button background
  motif: string                 // small static motif used on game screens (corner png or css)
}

// ---- Themed route transition (Liveliness PRD-02) -------------------------------------
// A per-skin signature "wipe" that carries the child between routes: a rising wave (Havet),
// a warp (Rummet), tumbling leaves (Dino), a rainbow iris (Regnbue). Optional on ThemeTokens
// and defaulted in buildTheme (flat/unregistered skins → a fast opaque `fade`). The overlay
// paints an OPAQUE fill and animates transform/clip-path ONLY (never the page's opacity, never
// backdrop-filter) — see the compositing-flicker rules in the PRD.

// `push` (Liveliness PRD-05) = a cinematic focus-push into the tapped object's locale.
export type TransitionVariant = 'wave' | 'zoom' | 'leaves' | 'iris' | 'fade' | 'push'

export interface TransitionTokens {
  variant: TransitionVariant
  color: string                 // OPAQUE fill/gradient the overlay paints (never transparent)
  direction: 'up' | 'down' | 'left' | 'right' | 'in'   // forward vector; back reverses it
  coverMs: number               // cover-in duration (~250)
  revealMs: number              // reveal-out duration (~300)
  ease: number[] | string       // framer transition ease (cubic-bezier array or keyword)
  sfx: SfxCue                    // forward travel cue (fired at cover start)
  motif?: 'wave' | 'rocket' | 'leaves' | 'sparkle'     // signature sprite riding the overlay
  reduced: 'fade' | 'none'      // reduced-motion fallback (fast opaque swap, or plain navigate)
}

export interface ThemeTokens {
  id: string
  name: string            // human label shown in the front-page theme selector
  selectorEmoji: string   // emoji shown in the front-page theme selector
  fontFamily: string

  palette: ThemePalette

  // The 5 section identities become theme tokens (so a skin can remap them).
  categories: CategoryTokens

  decor: DecorTokens

  shadows: ShadowTokens

  // ---- Immersive world (optional; absence = today's flat look) ----
  titleFontFamily?: string  // bundled themed display font for titles (falls back to fontFamily)
  scene?: SceneTokens
  materials?: MaterialTokens
  transition?: TransitionTokens
}
