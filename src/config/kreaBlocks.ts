// Byggeklodser's content (Krea PRD-03 §3) — PURE data, no React, no three.js, so the game, the guards and
// the prebake enumerator all read ONE source. Themes now; the models join in W3.
//
// Owner, 2026-11-06 (UM5B3, RK4EG, YRFQQ): no floating island in a painted landscape. The plate rests on a
// calm STUDIO floor, and a theme is only the PLATE's surface — plain (the default; "I almost liked the
// earlier version with no art better"), grass, snow or sand. Themes switch INSIDE the game and keep the
// build; there is no entry picker.
//
// Explicit `.ts` extension on imports: this module is in `shared-narration-clips.js`'s plain-Node graph.

export const BLOCK_THEME_IDS = ['plain', 'graes', 'sne', 'strand'] as const
export type BlockThemeId = (typeof BLOCK_THEME_IDS)[number]

export interface BlockThemeDef {
  id: BlockThemeId
  /** The theme button's name for assistive tech (never spoken). */
  name: string
  /** The plate's clay colours: the top (under a render, its tint), the side band, the underside. */
  top: string
  side: string
  soil: string
  /** Whether the owner's render textures the plate (plain is clay colour only). */
  textured: boolean
  /** The checker that shows the squares: the light tint and its strength on this surface. */
  checker: { color: string; alpha: number }
}

export const BLOCK_THEMES: readonly BlockThemeDef[] = [
  { id: 'plain', name: 'Ler', top: '#EADFCD', side: '#D8C8AE', soil: '#C9B595', textured: false, checker: { color: '#FFFFFF', alpha: 0.5 } },
  { id: 'graes', name: 'Græs', top: '#FFFFFF', side: '#FFFFFF', soil: '#7A5A3A', textured: true, checker: { color: '#F4FFE6', alpha: 0.24 } },
  { id: 'sne', name: 'Sne', top: '#FFFFFF', side: '#FFFFFF', soil: '#8FA3B8', textured: true, checker: { color: '#5E7FA6', alpha: 0.12 } },
  { id: 'strand', name: 'Strand', top: '#FFFFFF', side: '#FFFFFF', soil: '#B08A55', textured: true, checker: { color: '#FFFFFF', alpha: 0.32 } },
]

export const themeById = (id: string | null | undefined): BlockThemeDef =>
  BLOCK_THEMES.find((t) => t.id === id) ?? BLOCK_THEMES[0]

/** The studio the plate stands in: one calm look on every theme (the floor fades into the wall). */
export const BLOCK_STUDIO = { wall: '#F3EEE6', floor: '#EDE6DB' } as const
