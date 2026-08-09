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

test('the surface has exactly the six groups, in rail order', () => {
  // Settings PRD-01 shipped FIVE. "Privatliv" is the sixth, added at App Store PRD Phase A with the
  // owner's decision on record (2026-08-06): the microphone default, the parental gate and the privacy
  // policy are one story, and a Kids Category reviewer looks for them together. Pinned as an exact list
  // (not a length) so a seventh group is a deliberate act rather than a drift.
  assert.deepEqual(ADULT_GROUP_IDS, [
    'barn',
    'laering',
    'lyd',
    'udseende',
    'konto',
    'privatliv',
  ])
})

test('the microphone consent item is NOT destructive, so withdrawal is never harder than consent', () => {
  // App Store PRD §3.6: the risky direction is turning the mic ON, and that is guarded by the consent
  // screen, not by this declaration. Marking the row destructive would put a confirm in front of
  // switching it OFF — i.e. friction on withdrawing consent, which the privacy policy promises is one
  // tap (`src/config/legalContent.ts`).
  const mic = adultItemsWithGroup().find(({ item }) => item.id === 'privatliv.microphone')
  assert.ok(mic, 'the microphone row has gone missing from the IA')
  assert.equal(mic!.item.destructive, undefined)
  assert.equal(mic!.item.typeToConfirm, undefined)
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

/**
 * The two log-outs, which are account-scoped and destructive but REVERSIBLE and destroy no data — you
 * sign back in, and the book is on the server. Named rather than inferred, so adding a third
 * confirm-only account action is a decision someone has to make HERE, in front of this comment.
 */
const CONFIRM_ONLY = ['konto.signOut', 'konto.revokeSessions']

test('a confirm-only account action is reversible, and there are only the two', () => {
  // The PIN came off both at the owner's request (2026-08-09): the adult has already passed the
  // parental gate to be in this pane, and the confirm names the account, so the PIN asked the same
  // question twice. That reasoning holds ONLY while the action can be undone by signing back in — so
  // the escape hatch is pinned to those two ids and to `irreversible` being false.
  const confirmOnly = adultItemsWithGroup().filter(({ item }) => item.verify?.kind === 'confirm')
  assert.deepEqual(
    confirmOnly.map(({ item }) => item.id).sort(),
    [...CONFIRM_ONLY].sort(),
    'a new action is verified by its confirm alone — that is only defensible if it is reversible',
  )
  for (const { item } of confirmOnly) {
    assert.notEqual(item.irreversible, true, `${item.id} cannot be undone, so a confirm is not enough`)
    // Still destructive, so it still gets a confirm dialog at all — losing that would make it a
    // single tap in the destructive strip.
    assert.equal(item.destructive, true, `${item.id} must stay destructive or it gets no confirm`)
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
    // The two reversible log-outs are verified by their confirm alone — see the test above, which is
    // what stops this exemption spreading. Everything else account-scoped still needs the server.
    if (v.kind === 'confirm') {
      assert.ok(CONFIRM_ONLY.includes(item.id), `${item.id} claims confirm-only without being listed`)
      continue
    }
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
