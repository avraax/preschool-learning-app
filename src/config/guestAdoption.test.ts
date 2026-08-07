// The guest-adoption predicate (adult-login-visibility PRD §7 / W6).
//
// `guestAdoptionOffer` is pure over state the caller has already read, which is exactly what makes an
// exhaustive refusal table cheap. Every refusal below is a REASONED no, not a gap — the header of
// `guestAdoption.ts` says why each one exists, and the one that matters most is `rosterCount === 0`:
// merging into an account that already has children hits `mergeLedger`'s per-device `max` and silently
// discards XP, because the guest book and the child book key the SAME device id.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guestAdoptionOffer, type GuestAdoptionInput } from './guestAdoption.ts'
import { defaultPersisted, type PersistedProgress } from './progressSchema.ts'
import { rewardNumber } from './progression.ts'

/** A guest book with real play in it: XP and slots on this device's ledger entry. */
const playedGuestDoc = (xp = 240, slots = 3): PersistedProgress => {
  const doc = defaultPersisted('local-guest', 'device-A', 1_700_000_000_000)
  doc.ledger['device-A'] = { xp, slots, bloom: { alphabet: xp } }
  doc.stickers.grantedSlots = slots
  return doc
}

/** The one state in which the offer is made. Each case below spoils exactly one field. */
const eligible = (): GuestAdoptionInput => ({
  claimed: false,
  guestDoc: playedGuestDoc(),
  rosterCount: 0,
  rosterSettled: true,
  hasSessionToken: true,
})

test('the positive case: a played guest book, a settled empty roster, a session', () => {
  const result = guestAdoptionOffer(eligible())
  assert.equal(result.offer, true)
  // The hint number is the CHILD-FACING one, through the pure rewardNumber() — never globalLevel(),
  // never collectedFromLevel recomputed inline.
  assert.equal(result.stickers, rewardNumber(3))
  assert.equal(result.stickers, 3)
})

test('already claimed → no offer (the book may be adopted exactly once, ever)', () => {
  // Without this the same XP would be counted into two different accounts from one device.
  assert.equal(guestAdoptionOffer({ ...eligible(), claimed: true }).offer, false)
})

test('no guest document → no offer', () => {
  // `normalizePersisted` answers null for absent AND for a non-v4 blob (clean sheet, by design).
  assert.equal(guestAdoptionOffer({ ...eligible(), guestDoc: null }).offer, false)
})

test('a guest book with zero XP → no offer (nothing to ask about)', () => {
  const untouched = defaultPersisted('local-guest', 'device-A', 1_700_000_000_000)
  assert.equal(guestAdoptionOffer({ ...eligible(), guestDoc: untouched }).offer, false)
})

test('an account that already has children → no offer', () => {
  // We cannot know WHICH child the guest was, and any existing child is outside the server's
  // store-the-first-PUT-verbatim window. §6.2.
  assert.equal(guestAdoptionOffer({ ...eligible(), rosterCount: 1 }).offer, false)
  assert.equal(guestAdoptionOffer({ ...eligible(), rosterCount: 4 }).offer, false)
})

test('an UNSETTLED roster → no offer, even though the count reads zero', () => {
  // "No children" and "we haven't asked yet" are different states (.claude/rules/auth.md). Reading
  // `profiles.length === 0` directly has already shipped one bug in this codebase.
  assert.equal(
    guestAdoptionOffer({ ...eligible(), rosterCount: 0, rosterSettled: false }).offer,
    false,
  )
})

test('no session token → no offer (there is no account to adopt INTO)', () => {
  assert.equal(guestAdoptionOffer({ ...eligible(), hasSessionToken: false }).offer, false)
})

test('a refusal always reports zero stickers, so no caller can render a stale hint', () => {
  for (const spoil of [
    { claimed: true },
    { guestDoc: null },
    { rosterCount: 2 },
    { rosterSettled: false },
    { hasSessionToken: false },
  ] as Array<Partial<GuestAdoptionInput>>) {
    const result = guestAdoptionOffer({ ...eligible(), ...spoil })
    assert.equal(result.offer, false)
    assert.equal(result.stickers, 0)
  }
})
