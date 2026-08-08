// Soft-3D UI symbols (de-emoji PRD-01 §4 W3). The glyphs that CARRY MEANING in the app's chrome are
// baked art in the app's own material rather than OS-font emoji (which change shape between the
// iPadOS 17.7 floor device and a newer one). Theme-CONSTANT: one set, all 4 skins, exactly like
// `src/assets/symbols/`.
//
// `sparkle` is a green-screen render keyed by the W3 pass; `book` REUSES already-approved art from the
// game sets (same style guide, same pipeline) instead of duplicating a subject.
//
// THREE SYMBOLS HAVE BEEN DELETED FROM THIS MAP, and the pattern is the point:
//   • `flame` — 2026-08-05, with the round-result streak row it was the only consumer of.
//   • `star`, `trophy` — Endless Play PRD-01 §8: stars and "Ny rekord!" no longer exist.
// Each is kept OUT rather than left exported. An unused symbol here is exactly the silently-
// reappearing fallback the de-emoji work removed; the `.webp` files stay in git (and `star.webp` is
// still a live game asset under `assets/games/math/`) if a picture is ever wanted again.
//
// Tiny, so statically bundled, not code-split.
import sparkle from './sparkle.webp'
import book from '../games/english/book.webp'

export type UiSymbol = 'book' | 'sparkle'

export const uiArt: Record<UiSymbol, string> = { book, sparkle }
