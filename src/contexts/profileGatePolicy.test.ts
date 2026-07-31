import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileGateBlocks, profileGateSurface } from './profileGatePolicy.ts'

// The one case worth the most: a cold boot on an account that HAS children, before /api/profiles has
// answered. `profiles` is empty because the cached roster was wiped (storageReset does that once per
// device for the accounts release), NOT because the family has no children — and the old condition
// raised the un-dismissible create dialog on exactly that state.
const inFlight = { status: 'choosing' as const, profiles: [], rosterSettled: false }
const kid = { id: 'kid-1', avatarEmoji: 'A' }

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
      profiles: [kid, { id: 'kid-2', avatarEmoji: 'B' }],
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
