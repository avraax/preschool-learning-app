import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileGateBlocks, profileGateSurface } from './profileGatePolicy.ts'

// The one case worth the most: a cold boot on an account that HAS children, before /api/profiles has
// answered. `profiles` is empty because the cached roster was wiped (storageReset does that once per
// device for the accounts release), NOT because the family has no children — and the old condition
// raised the un-dismissible create dialog on exactly that state.
const inFlight = { status: 'choosing' as const, profiles: [], rosterSettled: false }
const kid = { id: 'kid-1', avatarId: 'fox' as const }

test('an unanswered roster shows NOTHING — never the mandatory dialog', () => {
  assert.equal(profileGateSurface(inFlight), 'none')
  assert.equal(profileGateBlocks(profileGateSurface(inFlight)), false)
})

test('an ANSWERED empty roster is the mandatory create dialog', () => {
  assert.equal(
    profileGateSurface({ status: 'choosing', profiles: [], rosterSettled: true }),
    'create',
  )
})

test('two children and none chosen is the picker', () => {
  assert.equal(
    profileGateSurface({
      status: 'choosing',
      profiles: [kid, { id: 'kid-2', avatarId: 'fox' as const }],
      rosterSettled: true,
    }),
    'picker',
  )
})

test('one child already attached shows nothing — the child never sees a gate', () => {
  assert.equal(
    profileGateSurface({ status: 'ready', profiles: [kid], rosterSettled: true }),
    'none',
  )
})

test('signed out shows nothing — the AUTH gate owns that screen', () => {
  assert.equal(
    profileGateSurface({ status: 'signed-out', profiles: [], rosterSettled: true }),
    'none',
  )
})

test('an explicit "add a child" request wins over everything', () => {
  assert.equal(
    profileGateSurface({ status: 'ready', profiles: [kid], rosterSettled: true }, true),
    'create',
  )
  // Including while the roster is still in flight — the adult asked for it.
  assert.equal(profileGateSurface(inFlight, true), 'create')
})

// ---- Børn picker PRD-01 ------------------------------------------------------------------------
//
// The picker now appears on EVERY cold start at 2+ children, so its boundary is load-bearing in a way
// it was not before: `hydrate` used to auto-attach the last child, which meant a wrong `> 0` could
// never be observed. The table below is the whole decision, pinned as a table so the boundary is
// explicit rather than implied by whichever case somebody thought to write.

test('the picker boundary is MORE THAN ONE child, exhaustively', () => {
  const roster = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `kid-${i + 1}`, avatarId: 'fox' as const }))
  const cases: [number, boolean, ReturnType<typeof profileGateSurface>][] = [
    // children, rosterSettled, expected — status 'choosing' throughout (nothing attached yet)
    [0, false, 'none'], // we have not asked yet: never the mandatory dialog
    [0, true, 'create'], // answered and empty: there is nobody to play as
    [1, false, 'none'], // one child boots straight in — the child never sees a gate
    [1, true, 'none'],
    [2, false, 'picker'], // …two ALWAYS ask, cached roster or fetched
    [2, true, 'picker'],
    [3, true, 'picker'],
  ]
  for (const [n, settled, expected] of cases) {
    assert.equal(
      profileGateSurface({ status: 'choosing', profiles: roster(n), rosterSettled: settled }),
      expected,
      `${n} child(ren), rosterSettled=${settled}`,
    )
  }
})

test('a single child NEVER reaches the picker, whatever the status', () => {
  // The accounts-PRD contract, and the reason the boundary is `> 1`. Deleting down to one child is the
  // one path that can reach `choosing` with a lone survivor; `profileStore.deleteProfile` selects them,
  // and this is the second line of defence if that ever regresses — a one-tile "Hvem spiller?" is a
  // screen that asks a question with one possible answer.
  for (const status of ['choosing', 'ready'] as const) {
    assert.equal(
      profileGateSurface({ status, profiles: [kid], rosterSettled: true }),
      'none',
      `status=${status}`,
    )
  }
})
