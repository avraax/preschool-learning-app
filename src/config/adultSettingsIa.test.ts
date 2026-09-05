import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ADULT_IA,
  ADULT_GROUP_IDS,
  AMBIGUOUS_LABELS,
  adultItemsWithGroup,
  adultItem,
  showsDevTools,
  devToolItemIds,
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

// ---- Owner-only tools (2026-09-05) -----------------------------------------------------------
//
// Six items are tools for the owner rather than settings for a parent, and are hidden in the
// production build. This is NOT a permission: the app has no roles, and a role tier would today
// separate the owner from his wife, who is on the same `AUTH_ALLOWED_EMAILS` list. The axis is the
// BUILD — `BL_TIER === 'staging'`, dev, or the harness.
//
// Two of the six are a functional trap rather than clutter: `lyd.voice`/`lyd.rate` write a
// `voiceOverride` that `ttsClient.resolveRequest` folds into the TTS cache key, so a non-default
// choice misses EVERY prebaked clip and sends all narration to live Azure — which a guest cannot
// call, dropping the whole app to Web Speech or to silence offline.

test('showsDevTools is true on staging, in dev and in the harness — and false in a plain production build', () => {
  // The whole truth table, because the rule is three ORed booleans and the ONE that matters is the
  // all-false case: that is the App Store build.
  assert.equal(showsDevTools('production', false, false), false)
  assert.equal(showsDevTools('staging', false, false), true)
  assert.equal(showsDevTools('production', true, false), true)
  assert.equal(showsDevTools('production', false, true), true)
  assert.equal(showsDevTools('staging', true, true), true)
})

test('exactly the six agreed items are devTool, named literally', () => {
  // Named rather than counted: a count passes while the WRONG six carry the flag.
  assert.deepEqual(devToolItemIds().sort(), [
    'konto.syncNow', 'lyd.everWorked', 'lyd.rate', 'lyd.sample', 'lyd.voice', 'udseende.smoothGraphics',
  ])
})

test('nothing a guideline depends on may ever be marked devTool', () => {
  // Each of these is load-bearing for App Review, not merely useful:
  //   konto.deleteAccount — 5.1.1(v) requires in-app account deletion to be FINDABLE
  //   privatliv.microphone / .policy — the Kids Category story (App Store PRD §3.6); Privatliv was
  //     made its own group precisely so a reviewer would not have to hunt for them
  for (const id of ['konto.deleteAccount', 'privatliv.microphone', 'privatliv.policy']) {
    assert.equal(adultItem(id).devTool, undefined, `${id} must never be hidden from a production build`)
  }
  // …and no destructive item may hide either: hiding a delete does not make it safer, it makes it
  // unreachable on the one build where the data is real.
  for (const { item } of adultItemsWithGroup()) {
    if (item.destructive) assert.equal(item.devTool, undefined, `${item.id} is destructive and must stay visible`)
  }
})

test('the panes actually gate on showDevTools — the data flag alone renders nothing', () => {
  // A config test cannot see a component ignoring the config (games-catalog.md). Read the source.
  const paneOf = (f: string) =>
    readFileSync(new URL(`../components/adult/panes/${f}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const f of ['LydPane.tsx', 'UdseendePane.tsx', 'KontoPane.tsx']) {
    assert.match(paneOf(f), /showDevTools\(\)/, `${f} does not consult showDevTools()`)
  }
  // The stranded-override escape hatch: without it, an override already stored on a production
  // install can never be cleared, because the controls that set it are gone.
  assert.match(paneOf('LydPane.tsx'), /setVoiceOverride\(null\)/)
})
