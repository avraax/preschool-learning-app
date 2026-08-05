// Soft-3D UI symbols (de-emoji PRD-01 §4 W3). The glyphs that CARRY MEANING in the app's chrome —
// the star IS the round score, the trophy IS "new record" — so they are baked art in the app's own
// material rather than OS-font emoji (which change shape between the iPadOS 17.7 floor device and a
// newer one). Theme-CONSTANT: one set, all 4 skins, exactly like `src/assets/symbols/`.
//
// `sparkle`/`trophy` are green-screen renders keyed by the W3 pass; `star` and `book` REUSE
// already-approved art from the game sets (same style guide, same pipeline) instead of duplicating a
// subject — swap either import for a dedicated `./star.webp` if a distinct render ever lands.
//
// `flame` was DELETED 2026-08-05 with the round-result streak row it was the only consumer of (see the
// header of `RoundResultScreen.tsx`). Kept out rather than left exported: an unused symbol in this map
// is exactly the silently-reappearing fallback the de-emoji work removed, and `flame.webp` is in git if
// a streak signal ever wants a picture again.
//
// Tiny and needed on the first round result, so statically bundled, not code-split.
import sparkle from './sparkle.webp'
import trophy from './trophy.webp'
import star from '../games/math/star.webp'
import book from '../games/english/book.webp'

export type UiSymbol = 'star' | 'trophy' | 'book' | 'sparkle'

export const uiArt: Record<UiSymbol, string> = { star, trophy, book, sparkle }
