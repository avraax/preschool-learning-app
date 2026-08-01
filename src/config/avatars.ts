// The closed set of child-profile avatars (de-emoji PRD-01 — the last child-facing emoji surface).
//
// PURE and Node-importable, like `pinPolicy.ts` / `progressSchema.ts`: `api/profiles.ts` imports it
// directly so the client and the server validate against ONE list. No `window`, no asset imports —
// the baked art lives in `src/assets/avatars/index.ts`, which is Vite-only (`import.meta.glob`).
//
// Order IS the grid order: 6 columns × 2 rows, owner-locked 2026-08-01.

export const AVATAR_IDS = [
  'fox', 'bear', 'rabbit', 'owl', 'cat', 'dog',
  'unicorn', 'frog', 'penguin', 'butterfly', 'turtle', 'lion',
] as const

export type AvatarId = (typeof AVATAR_IDS)[number]

export const DEFAULT_AVATAR_ID: AvatarId = 'fox'

const AVATAR_ID_SET: ReadonlySet<string> = new Set(AVATAR_IDS)

export const isAvatarId = (v: unknown): v is AvatarId =>
  typeof v === 'string' && AVATAR_ID_SET.has(v)

// Danish labels — the accessible name for each tile, since a pre-reader picks by picture but the
// adult (and a screen reader) needs words.
export const AVATAR_LABELS: Record<AvatarId, string> = {
  fox: 'Ræv',
  bear: 'Bjørn',
  rabbit: 'Kanin',
  owl: 'Ugle',
  cat: 'Kat',
  dog: 'Hund',
  unicorn: 'Enhjørning',
  frog: 'Frø',
  penguin: 'Pingvin',
  butterfly: 'Sommerfugl',
  turtle: 'Skildpadde',
  lion: 'Løve',
}

// Profiles created BEFORE the baked avatars stored the emoji glyph itself. The subjects were kept
// identical on purpose (owner decision 2026-08-01), so every legacy value maps 1:1 and nobody's
// avatar changes meaning. Reads normalise through here; writes only ever store an id.
//
// Written as `\u{…}` ESCAPES, not literal glyphs, so this migration table doesn't itself trip
// `noEmoji.test.ts` — the file is data ABOUT emoji, never a surface that renders one.
const LEGACY_GLYPH_TO_ID: Record<string, AvatarId> = {
  '\u{1F98A}': 'fox',
  '\u{1F43B}': 'bear',
  '\u{1F430}': 'rabbit',
  '\u{1F989}': 'owl',
  '\u{1F431}': 'cat',
  '\u{1F436}': 'dog',
  '\u{1F984}': 'unicorn',
  '\u{1F438}': 'frog',
  '\u{1F427}': 'penguin',
  '\u{1F98B}': 'butterfly',
  '\u{1F422}': 'turtle',
  '\u{1F981}': 'lion',
}

/**
 * The glyphs a client running pre-baked-avatar JS may still send. Exported so `api/profiles.ts` can
 * tell a KNOWN legacy value (accept, store as its id) from an unrecognised one (reject) — without it,
 * `normalizeAvatarId`'s default would quietly turn every typo into a fox.
 */
export const LEGACY_AVATAR_GLYPHS: ReadonlySet<string> = new Set(Object.keys(LEGACY_GLYPH_TO_ID))

/**
 * Coerce a stored avatar value to a known id: an id passes through, a legacy glyph maps across, and
 * anything else (corrupt row, a glyph from some future set) falls back to the default rather than
 * rendering nothing. Never returns an emoji — that is the whole point (PRD D5).
 */
export const normalizeAvatarId = (v: unknown): AvatarId => {
  if (isAvatarId(v)) return v
  if (typeof v === 'string') {
    const mapped = LEGACY_GLYPH_TO_ID[v.trim()]
    if (mapped) return mapped
  }
  return DEFAULT_AVATAR_ID
}
