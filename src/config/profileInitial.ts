// The child's first letter, for the profile badge in the corner (Who-Is-Playing).
//
// PURE and Node-importable on purpose: the fallback rule is the whole point of this module, and a rule
// that lives inside a .tsx cannot be unit-tested here (MUI/Vite are unimportable from `node --test`).
//
// **A missing name means NO badge — never a placeholder.** `ChildProfile.name` is optional by design
// (`api/profiles.ts`: "an avatar and an OPTIONAL first name"), so an unnamed child is a normal state,
// not a defect. The picker and the adult roster show `'—'` for it because they are LISTS, where a row
// needs something to be. The corner badge is not a list: an em-dash or a `?` on a 46px disc is a glyph
// a pre-reader would try to decode. The portrait alone already identifies the child; the letter is the
// second cue, and a second cue is allowed to be absent.

/**
 * First grapheme of a child's name, upper-cased for display — or `null` when there is nothing to show.
 *
 * `Array.from()` rather than `name[0]`: a leading astral character (an emoji a parent typed into the
 * name field) is a surrogate PAIR, and indexing one splits it into a lone high surrogate that renders
 * as a replacement box. Danish `ÆØÅ` are BMP so they survive either way — but `toLocaleUpperCase('da-DK')`
 * is still the right call rather than `toUpperCase()`, so the casing follows the app's own locale.
 */
export function profileInitial(name?: string | null): string | null {
  if (typeof name !== 'string') return null
  // ONE null path, not two. An explicit `if (!trimmed) return null` sat here and a re-break proved it
  // dead: `Array.from('')[0]` is already `undefined`, so the empty and whitespace-only cases fall
  // through this guard anyway. Two guards where one fires is how a later edit removes the wrong one.
  const first = Array.from(name.trim())[0]
  if (!first) return null
  return first.toLocaleUpperCase('da-DK')
}
