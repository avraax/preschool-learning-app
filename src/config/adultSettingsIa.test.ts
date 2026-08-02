import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ADULT_IA,
  ADULT_GROUP_IDS,
  AMBIGUOUS_LABELS,
  adultItemsWithGroup,
} from './adultSettingsIa.ts'
import { pinVerifierFor } from './pinReasons.ts'

// Settings PRD-01 §12. The repo has no jsdom, so the guardable artifact is the pure IA module.
// The load-bearing one is the LAST test: it reads the REAL `pinVerifierFor` table, so downgrading
// logout or account deletion to the local ~5-minute unlock fails the build.

test('every group id is unique', () => {
  assert.equal(new Set(ADULT_GROUP_IDS).size, ADULT_GROUP_IDS.length)
})

test('the surface has exactly the five PRD groups, in rail order', () => {
  assert.deepEqual(ADULT_GROUP_IDS, ['barn', 'laering', 'lyd', 'udseende', 'konto'])
})

test('every item belongs to exactly one group', () => {
  const seen = new Map<string, string[]>()
  for (const { group, item } of adultItemsWithGroup()) {
    seen.set(item.id, [...(seen.get(item.id) ?? []), group])
  }
  const shared = [...seen.entries()].filter(([, groups]) => groups.length > 1)
  assert.deepEqual(
    shared,
    [],
    `these items appear in more than one group: ${shared.map(([id, g]) => `${id} → ${g.join(', ')}`).join(' | ')}`,
  )
})

test('no empty labels anywhere', () => {
  for (const g of ADULT_IA) {
    assert.ok(g.label.trim().length > 0, `group ${g.id} has no label`)
    for (const item of g.items) {
      assert.ok(item.label.trim().length > 0, `item ${item.id} has no label`)
    }
  }
})

test('no group is named "Andet" / "Diverse" / "Øvrigt"', () => {
  for (const g of ADULT_IA) {
    assert.ok(
      !(AMBIGUOUS_LABELS as readonly string[]).includes(g.label.trim().toLowerCase()),
      `group ${g.id} uses the ambiguous label "${g.label}"`,
    )
  }
})

test('every destructive item declares how it is verified', () => {
  for (const { item } of adultItemsWithGroup()) {
    if (!item.destructive) continue
    assert.ok(item.verify, `destructive item ${item.id} declares no verification`)
    assert.ok(item.scope, `destructive item ${item.id} declares no scope`)
  }
})

test('every ACCOUNT-scoped destructive action is verified against the SERVER', () => {
  const accountScoped = adultItemsWithGroup().filter(
    ({ item }) => item.destructive && item.scope === 'account',
  )
  // Guard the guard: if the filter ever matches nothing this test passes vacuously.
  assert.ok(accountScoped.length >= 3, 'expected at least logout / logout-everywhere / delete-account')

  for (const { item } of accountScoped) {
    const v = item.verify!
    if (v.kind === 'pinPad') continue // the current PIN, typed and server-verified at the moment
    // BOTH connectivity states: `unlockSession` is the one reason that goes local when offline, and
    // an account-scoped action must never be reachable through it.
    assert.equal(
      pinVerifierFor(v.reason, true),
      'server',
      `${item.id} is account-scoped but "${v.reason}" verifies locally when online`,
    )
    assert.equal(
      pinVerifierFor(v.reason, false),
      'server',
      `${item.id} is account-scoped but "${v.reason}" verifies locally when offline`,
    )
  }
})

test('an IRREVERSIBLE action can never be confirmed with a single tap', () => {
  // A PIN does NOT cover this. Inside the ~5-minute adult-unlock window `requirePin` returns true
  // without prompting, so for a second destructive action in one sitting the confirm dialog is the
  // only barrier left — and where the PIN pad IS shown (account deletion) it arrives on the screen
  // AFTER the confirm, leaving that confirm a single tap, indistinguishable in weight from the
  // reversible "Log ud" beside it. So every irreversible action types a word AT the confirm.
  const irreversible = adultItemsWithGroup().filter(({ item }) => item.destructive && item.irreversible)
  assert.ok(irreversible.length >= 3, 'expected reset / delete-child / delete-account')

  for (const { item } of irreversible) {
    assert.ok(
      item.typeToConfirm,
      `${item.id} is irreversible but a single tap confirms it — give it a typeToConfirm word`,
    )
    // One or two short all-caps Danish words. Long enough to be deliberate, short enough to type on
    // an iPad soft keyboard without the sentence turning into a spelling test.
    assert.match(
      item.typeToConfirm!,
      /^[A-ZÆØÅ]{3,12}( [A-ZÆØÅ]{2,6})?$/,
      `${item.id}: use one or two short all-caps Danish words`,
    )
  }
})

test('no two destructive actions share a confirmation word', () => {
  // Same word on two different targets is how a child-deletion habit carries into wiping the whole
  // account — the typed word is supposed to make you notice WHICH thing you are destroying.
  const words = adultItemsWithGroup()
    .map(({ item }) => item.typeToConfirm)
    .filter((w): w is string => !!w)
  assert.equal(new Set(words).size, words.length, `duplicate confirmation words: ${words.join(', ')}`)
})

test('a reversible destructive action does NOT demand typing', () => {
  // Friction where it buys nothing is friction that teaches people to type past the prompt. Signing
  // out is destructive but recoverable — you log back in.
  for (const { item } of adultItemsWithGroup()) {
    if (item.destructive && !item.irreversible) {
      assert.equal(item.typeToConfirm, undefined, `${item.id} is reversible; drop the typed word`)
    }
  }
})

test('child-scoped destructive actions stay LOCAL, so they work on a plane', () => {
  for (const { item } of adultItemsWithGroup()) {
    if (!item.destructive || item.scope !== 'child') continue
    const v = item.verify!
    assert.equal(v.kind, 'requirePin', `${item.id} should be a plain requirePin`)
    if (v.kind !== 'requirePin') continue
    assert.equal(pinVerifierFor(v.reason, false), 'local', `${item.id} must work offline`)
  }
})
