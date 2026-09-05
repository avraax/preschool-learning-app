import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ADULT_IA,
  ADULT_GROUP_IDS,
  AMBIGUOUS_LABELS,
  KONTO_BLOCK_ORDER,
  KONTO_DANGER_BLOCKS,
  adultItemsWithGroup,
  adultItem,
  kontoBlockItems,
  showsDevTools,
  devToolItemIds,
} from './adultSettingsIa.ts'
import { pinVerifierFor } from './pinReasons.ts'

// Settings PRD-01 §12. The repo has no jsdom, so the guardable artifact is the pure IA module.
// The load-bearing one is the `pinVerifierFor` test: it reads the REAL table, so downgrading
// logout or account deletion to the local ~5-minute unlock fails the build.

/** One pane's source, comments stripped, so a guard can never pass on a mention in a comment. */
const paneOf = (f: string) =>
  readFileSync(new URL(`../components/adult/panes/${f}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('every group id is unique', () => {
  assert.equal(new Set(ADULT_GROUP_IDS).size, ADULT_GROUP_IDS.length)
})

test('the surface has exactly the five groups, in rail order', () => {
  // Settings PRD-01 shipped FIVE, "Privatliv" made it six at App Store PRD Phase A (owner,
  // 2026-08-06), and the Barn+Konto merge (owner, 2026-09-05) put it back to five by folding `Barn` and
  // `Konto` together — they are one thing to a parent. Pinned as an exact list (not a length) so a
  // sixth group is a deliberate act rather than a drift.
  assert.deepEqual(ADULT_GROUP_IDS, ['konto', 'laering', 'lyd', 'udseende', 'privatliv'])
})

/** Every item that was in `barn` or `konto` before the merge. Literal, so nothing can be LOST. */
const KONTO_ITEM_IDS = [
  'konto.email',
  'barn.active',
  'barn.summary',
  'barn.switch',
  'barn.rename',
  'barn.add',
  'konto.pin',
  'konto.addPasskey',
  'konto.removePasskey',
  'konto.sync',
  'konto.syncNow',
  'barn.reset',
  'barn.delete',
  'konto.signOut',
  'konto.revokeSessions',
  'konto.deleteAccount',
]

test('the merge lost nothing: konto holds every former barn.* and konto.* item, in §3 order', () => {
  // Asserted against the literal id list rather than a count, because a count passes while the WRONG
  // sixteen are present — and the ids are deliberately NOT renamed (they are declared stable across
  // the whole surface, the panes read `typeToConfirm` through `adultItem(id)`, and the PIN-downgrade
  // assertions below key off them).
  const konto = ADULT_IA.find((g) => g.id === 'konto')
  assert.ok(konto, 'the merged Konto group has gone missing')
  assert.deepEqual(konto!.items.map((i) => i.id), KONTO_ITEM_IDS)
})

test('every konto item declares a block, and the blocks run in the declared order', () => {
  const konto = ADULT_IA.find((g) => g.id === 'konto')!
  for (const item of konto.items) {
    assert.ok(item.block, `${item.id} declares no block — the pane order would be JSX-only`)
    assert.ok(
      KONTO_BLOCK_ORDER.includes(item.block!),
      `${item.id} is in an unknown block "${item.block}"`,
    )
  }
  // Items are declared in block order, so `kontoBlockItems` reading the pane top-to-bottom is true.
  const seen = konto.items.map((i) => KONTO_BLOCK_ORDER.indexOf(i.block!))
  for (let i = 1; i < seen.length; i++) {
    assert.ok(
      seen[i] >= seen[i - 1],
      `${konto.items[i].id} is declared out of block order (${konto.items[i].block})`,
    )
  }
  // Guard the guard: an empty block list would make every assertion above vacuous.
  for (const block of KONTO_BLOCK_ORDER) {
    assert.ok(kontoBlockItems(block).length > 0, `block "${block}" is empty`)
  }
})

test('no block mixes a CHILD-scoped and an ACCOUNT-scoped destructive action', () => {
  // The whole reason shape A needed a PRD. Merging the groups put "Slet barnet" and "Slet kontoen
  // helt" in one pane for the first time, and NN/g is verbatim on it: "Avoid placing highly
  // consequential actions (that will require a lot of user work to fix if accidentally triggered)
  // directly next to options that are benign."  Two blast radii in one block is that hazard in its
  // purest form — the adult would be choosing between "one child's book" and "everything" inside a
  // single bordered box.
  const byBlock = new Map<string, Set<string>>()
  for (const { item } of adultItemsWithGroup()) {
    if (!item.destructive || !item.block) continue
    const scopes = byBlock.get(item.block) ?? new Set<string>()
    scopes.add(item.scope!)
    byBlock.set(item.block, scopes)
  }
  assert.ok(byBlock.size >= 2, 'expected at least the two danger blocks to hold destructive items')
  for (const [block, scopes] of byBlock) {
    assert.equal(
      scopes.size,
      1,
      `block "${block}" mixes ${[...scopes].join(' + ')}-scoped destructive actions`,
    )
  }
})

test('the ACCOUNT danger block is the last thing in the pane', () => {
  // §3.5 requirement 3: it puts "Slet kontoen helt" as far from "Omdøb barnet" as the pane allows.
  // Before the merge that distance was an accident of the two groups being separate; it has to be
  // replaced with a deliberate one.
  assert.deepEqual(KONTO_DANGER_BLOCKS, ['fareBarn', 'fareKonto'])
  assert.equal(KONTO_BLOCK_ORDER[KONTO_BLOCK_ORDER.length - 1], 'fareKonto')
  const konto = ADULT_IA.find((g) => g.id === 'konto')!
  assert.equal(konto.items[konto.items.length - 1].block, 'fareKonto')
  // …and the child block is immediately before it, with nothing benign in between.
  const blocks = [...new Set(konto.items.map((i) => i.block))]
  assert.deepEqual(blocks.slice(-2), ['fareBarn', 'fareKonto'])
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
  for (const f of ['LydPane.tsx', 'UdseendePane.tsx', 'konto/SynkSection.tsx']) {
    assert.match(paneOf(f), /showDevTools\(\)/, `${f} does not consult showDevTools()`)
  }
  // The stranded-override escape hatch: without it, an override already stored on a production
  // install can never be cleared, because the controls that set it are gone.
  assert.match(paneOf('LydPane.tsx'), /setVoiceOverride\(null\)/)
})

// ---- The Barn+Konto merge, in the RENDER (2026-09-05) -----------------------------------------
//
// Everything above is the declaration. A config test cannot see whether the component uses the
// config (`game-development.md`), and §3.5's separation is a rendering property: the data being right
// proves nothing about two danger strips being merged back into one box.

test('KontoPane renders the two danger blocks as SEPARATE containers, account last', () => {
  const pane = paneOf('KontoPane.tsx')
  const barnAt = pane.indexOf('<BarnDanger')
  const kontoAt = pane.indexOf('<KontoDanger')
  assert.ok(barnAt > 0, 'the child danger block is not rendered')
  assert.ok(kontoAt > 0, 'the account danger block is not rendered')
  assert.ok(kontoAt > barnAt, 'the ACCOUNT danger block must be the last thing in the pane')
  // Nothing benign may render after them — that is the spatial separation §3.5 buys.
  assert.ok(
    !/<(SignInOffer|BoernSection|SikkerhedSection|SynkSection|PaneSection)\b/.test(pane.slice(barnAt)),
    'something benign renders below the danger blocks',
  )

  // Two containers, not one strip with a divider: each danger block is its own `DangerBlock`, and
  // each names its own blast radius. Gestalt proximity — a divider inside one box still reads as one
  // group, which is why the shared `DangerHeading` + `<Divider />` shape was deleted.
  const blocks = paneOf('konto/DangerBlocks.tsx')
  const containers = blocks.match(/<DangerBlock\b/g) ?? []
  assert.equal(containers.length, 2, 'expected exactly two DangerBlock containers')
  assert.match(blocks, /id="fareBarn"/, 'the child danger block lost its block id')
  assert.match(blocks, /id="fareKonto"/, 'the account danger block lost its block id')
  // The child block NAMES the child (§3.5 requirement 2) — the blast radius has to be legible from
  // the heading alone, exactly as the reset confirmation already is.
  assert.match(blocks, /Farligt for \$\{activeName\}/, 'the child danger block no longer names the child')
  assert.match(blocks, /title="Farligt for kontoen"/)
  // …and the first is CLOSED before the second opens, which is what "separate containers" means.
  // Nesting them, or reverting to one box with a `<Divider />`, would satisfy every assertion above.
  const openA = blocks.indexOf('<DangerBlock')
  const openB = blocks.indexOf('<DangerBlock', openA + 1)
  const closeA = blocks.indexOf('</DangerBlock>')
  assert.ok(
    closeA > openA && closeA < openB,
    'the two danger blocks are one container — the first is not closed before the second opens',
  )
})

test('the duplicate sign-in door is gone from the whole tree', () => {
  // A guest saw BOTH a `Log ind` promo row above the rail and a `Konto — Ikke logget ind` rail entry,
  // and `KontoPane` opened with `if (guest) return <the sign-in offer>` — two affordances, one
  // screen. Scanned across all of `src/`, not just the surface, because the probe attribute is the
  // only trace the row left and a revival could land anywhere.
  const src = fileURLToPath(new URL('..', import.meta.url))
  const offenders = readdirSync(src, { recursive: true, encoding: 'utf8' })
    // `.test.` files excluded because THIS one names the attribute, twice, and would report itself.
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
    .filter((f) => readFileSync(`${src}${f}`, 'utf8').includes('data-guest-signin-promo'))
  assert.deepEqual(offenders, [], 'the standalone Log ind promo row is back')

  // And the offer itself renders exactly once, in the one place §3.1 puts it.
  assert.match(paneOf('KontoPane.tsx'), /<SignInOffer\s*\/>/)
  assert.match(paneOf('konto/SignInOffer.tsx'), /Bogen er sikret/, 'the offer copy has been rewritten')
})
