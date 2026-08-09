import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_AVATAR_ID, isAvatarId } from '../../config/avatars.ts'

// PINNING, NOT REBUILDING (sign-in reliability PRD W9).
//
// The staging database says this path already works: one `childProfile` row, `avatarEmoji: 'fox'`,
// created by the owner on a real device. So the job here is to stop it from regressing while the sign-in
// machinery around it is rewritten — every invariant below is something that, if it broke, would break
// SILENTLY and only on a first sign-in, which is the one moment nobody re-tests.
//
// The pure pieces are already covered elsewhere and are not duplicated here: `profileGatePolicy.test.ts`
// (which surface to show), `guestAdoption.test.ts` (whether to offer), `progressAdoption.test.ts` (the
// copy itself), `avatars.test.ts` (the closed set). What was NOT covered is the WIRING between them,
// which is where the order and the defaults live.

const codeOf = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '')) // the rationale is in comments; it must not satisfy the guard
    .join('\n')

const dialog = codeOf('src/components/auth/CreateProfileDialog.tsx')
const gate = codeOf('src/components/auth/ProfileGate.tsx')

test('a first sign-in reaches an UN-DISMISSIBLE create dialog', () => {
  // There is nobody to play as yet, so a dismissible dialog is a dead end: the adult closes it and the
  // app has no child, no book and no way back except signing out. `dismissible` must be driven by the
  // mandatory case, not defaulted.
  assert.match(gate, /open=\{creating \|\| needsFirstProfile\}/, 'the dialog is no longer raised by the gate')
  assert.match(gate, /dismissible=\{!needsFirstProfile\}/, 'the first-run dialog can be dismissed')
  // And "first run" must come from the POLICY, never from `profiles.length === 0` read inline — that
  // read is what raised the mandatory dialog for the length of every cold boot's roster round trip.
  assert.match(gate, /const surface = profileGateSurface\(account, creating\)/)
  assert.doesNotMatch(gate, /profiles\.length === 0/, 'the gate is inferring "no children" itself again')
})

test('an avatar is always preselected, from the closed set', () => {
  // `avatarEmoji` is NOT NULL in the schema, and the column name lies (it holds an avatar id). A dialog
  // that started with nothing selected would let an adult submit a profile the API must reject — and the
  // rejection lands after the name has been typed, on the first screen of the app.
  assert.match(
    dialog,
    /useState<AvatarId>\(DEFAULT_AVATAR_ID\)/,
    'the avatar no longer starts preselected',
  )
  assert.ok(isAvatarId(DEFAULT_AVATAR_ID), 'the default avatar is not in the closed set')
  // The owner's real staging profile is this one, so a change here is visible on his iPad.
  assert.equal(DEFAULT_AVATAR_ID, 'fox')
})

test('avatarEmoji can never be written NULL — cleanAvatar is an ALLOW-LIST', () => {
  // Its old rule was the exact opposite (it rejected ASCII on the grounds that "an avatar is a
  // pictograph"), which is backwards now that avatars ARE ascii ids. Both copies must agree, because
  // `dev-server.js` mirrors the endpoint and a divergence is a bug that only exists in production.
  for (const [label, src] of [
    ['api/profiles.ts', codeOf('api/profiles.ts')],
    ['dev-server.js', codeOf('dev-server.js')],
  ] as const) {
    const at = src.indexOf('cleanAvatar')
    assert.ok(at > 0, `${label}: cleanAvatar is gone`)
    const fn = src.slice(at, at + 400)
    assert.match(fn, /isAvatarId\(s\)/, `${label}: cleanAvatar no longer checks the closed set`)
    // THE UNKNOWN-VALUE PATH, specifically — not merely "a `return null` appears somewhere in here".
    // The earlier `typeof v !== 'string'` guard satisfies that, so a looser form stayed green against a
    // mutation that made an unrecognised glyph fall back to the default (found by re-breaking it).
    // A default would be worse than a refusal: a typo'd avatar would silently become a fox.
    assert.match(
      fn,
      /\.has\(s\)\s*\?\s*normalizeAvatarId\(s\)\s*:\s*null/,
      `${label}: an unrecognised avatar is defaulted rather than refused`,
    )
  }
  // And the create path must REFUSE rather than store null.
  assert.match(
    codeOf('api/profiles.ts'),
    /if \(!avatarEmoji\) return[\s\S]{0,80}400/,
    'api/profiles.ts would store a null avatar',
  )
})

test('the guest-book offer is default ON and asked exactly once', () => {
  // Default-on because the median case — one iPad, one child, months of play — is that the guest book
  // IS this child's, and an adult who unticks it has said so deliberately. Asked once because
  // `guestAdoptionOffer` refuses when `claimed`, and `markGuestBookClaimed()` is what sets that.
  assert.match(dialog, /useState\(true\)/, 'the adoption checkbox no longer defaults to on')
  assert.match(dialog, /guestAdoptionOffer\(\{/, 'the offer is no longer computed by the pure predicate')
  assert.match(dialog, /claimed: guestBookClaimed\(\)/, 'the once-only check is gone')
  assert.match(gate, /markGuestBookClaimed\(\)/, 'nothing marks the book claimed, so it would be offered forever')
  // ATTRIBUTION, NOT PERMISSION — the copy is load-bearing. The guest book belongs to one specific
  // child, so the label NAMES the child being created ("…til Emil"): that is what makes it a question
  // about whose book it is, rather than a consent dialog the adult clicks through. A silent transfer
  // puts months of stickers on a sibling with no undo.
  const raw = readFileSync('src/components/auth/CreateProfileDialog.tsx', 'utf8')
  assert.match(raw, /Flyt fremgangen fra denne iPad/, 'the adoption copy changed — re-read PRD §6.3 first')
  assert.match(
    raw,
    /label=\{`Flyt fremgangen fra denne iPad til \$\{name\.trim\(\) \|\| 'barnet'\}`\}/,
    'the label no longer names the child — it reads as a permission prompt again',
  )
  // And the count is stated, so the adult knows what is at stake before ticking.
  assert.match(raw, /klistermærker? følger med/, 'the sticker count is no longer shown')
})

test('THE ORDER: adoptDocument runs BEFORE selectProfile', () => {
  // `selectProfile()` attaches the store, and `attach()` writes `defaultPersisted(...)` for a profile
  // with no book on disk. Adopting afterwards would therefore copy into a document that has already been
  // overwritten — the child's whole guest book, silently replaced by an empty one at the exact moment
  // the adult was told it would be kept.
  const adopt = gate.indexOf('progressStore.adoptDocument(')
  const select = gate.indexOf('profileStore.selectProfile(')
  assert.ok(adopt > 0, 'the adoption call is gone')
  assert.ok(select > 0, 'the selection call is gone')
  assert.ok(adopt < select, 'adoptDocument must run BEFORE selectProfile')
  // A failed adoption must not block profile creation: the child starts fresh rather than being stuck.
  const between = gate.slice(adopt, select)
  assert.doesNotMatch(between, /\breturn\b/, 'a failed adoption now aborts profile selection')
})
