// Soft-3D UI symbols (de-emoji PRD-01 §4 W3). The glyphs that CARRY MEANING in the app's chrome are
// baked art in the app's own material rather than OS-font emoji (which change shape between the
// iPadOS 17.7 floor device and a newer one). Theme-CONSTANT: one set, all 4 skins, exactly like
// `src/assets/symbols/`.
//
// `sparkle` is a green-screen render keyed by the W3 pass. `book` is the SAME already-approved subject
// the English set ships (same style guide, same pipeline — no new render), but it now lives HERE
// (Corner identity PRD-01 W0) rather than being imported across from `assets/games/english/`.
//
// That move is not tidiness. `uiArt.book` is the centre of the corner ring on home, every section menu
// and every game, plus Min Bog's title and its header pill — so a rename or a re-key inside the English
// GAME set would blank the corner of the entire app, and nothing would fail. A copy is 16 KB and makes
// the chrome's art independent of any game's. `uiArt.test.ts` fails the build if a symbol's file stops
// resolving or stops living in this directory. It is a re-TRIM-only reuse of keyed art (never re-keyed
// — see `.claude/rules/scene-assets.md`), so the two files are byte-identical by construction.
//
// FOUR SYMBOLS HAVE BEEN DELETED FROM THIS MAP, and the pattern is the point:
//   • `flame` — 2026-08-05, with the round-result streak row it was the only consumer of.
//   • `star`, `trophy` — Endless Play PRD-01 §8: stars and "Ny rekord!" no longer exist.
//   • `sparkle` — Corner identity PRD-01 §2.1: the ring's centre is the child's own book at every
//     point on the path, so the "book full" gold sparkle it branched to has no state left to show.
// Each is kept OUT rather than left exported. An unused symbol here is exactly the silently-
// reappearing fallback the de-emoji work removed; the `.webp` files stay in git (and `star.webp` is
// still a live game asset under `assets/games/math/`) if a picture is ever wanted again.
//
// Tiny, so statically bundled, not code-split.
import book from './book.webp'

export type UiSymbol = 'book'

export const uiArt: Record<UiSymbol, string> = { book }
