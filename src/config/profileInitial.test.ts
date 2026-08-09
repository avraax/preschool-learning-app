import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileInitial } from './profileInitial.ts'

// The badge's FALLBACK rule, which is the only logic in the Who-Is-Playing feature that can be wrong
// without being visible: an unnamed profile is a supported state, and it must produce NO badge rather
// than a placeholder glyph on a 46px disc.

test('a name yields its first letter, upper-cased', () => {
  assert.equal(profileInitial('Emil'), 'E')
  assert.equal(profileInitial('emil'), 'E')
  assert.equal(profileInitial('  Emil  '), 'E')
  assert.equal(profileInitial('Anna Sofie'), 'A')
})

test('Danish letters survive the upper-casing', () => {
  // The three that a `toUpperCase()` in the wrong locale is most likely to mangle, plus the one the
  // owner would notice first. `Å` is also reachable as a decomposed A + combining ring, which
  // `Array.from` keeps as TWO graphemes — we deliberately take the base letter, not the mark.
  assert.equal(profileInitial('æblemand'), 'Æ')
  assert.equal(profileInitial('øjvind'), 'Ø')
  assert.equal(profileInitial('åse'), 'Å')
  assert.equal(profileInitial('Ålborg'), 'Å')
})

test('an astral first character is not split into half a surrogate pair', () => {
  // A parent CAN type an emoji into the name field — nothing stops them, and `name[0]` would return a
  // lone high surrogate that renders as a replacement box. Built with fromCodePoint so this file does
  // not itself carry a literal glyph (noEmoji.test.ts sweeps every .ts under src/).
  const astral = String.fromCodePoint(0x1f984) // unicorn
  const out = profileInitial(`${astral}Emil`)
  assert.equal(out, astral, 'the whole code point must come back, not a half')
  assert.equal(Array.from(out ?? '').length, 1)
})

test('nothing to show yields null, never a placeholder', () => {
  for (const empty of ['', '   ', '\t\n', undefined, null]) {
    assert.equal(profileInitial(empty as string | null | undefined), null)
  }
  // Non-strings reach here from a stale cached roster written by an older client.
  for (const junk of [42, {}, [], true]) {
    assert.equal(profileInitial(junk as unknown as string), null)
  }
})

test('the result is exactly one grapheme, for every input that returns one', () => {
  // The badge is a fixed-diameter disc; two characters would overflow it rather than shrink.
  for (const name of ['Emil', 'æblemand', 'Anna Sofie', 'Ø', '  Åse']) {
    const out = profileInitial(name)
    assert.ok(out)
    assert.equal(Array.from(out).length, 1, `${name} produced ${out}`)
  }
})
