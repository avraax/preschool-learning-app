// SIGNING IN FROM GUEST PLAY MUST NOT FLASH THE MANDATORY CREATE DIALOG.
//
// MEASURED ON THE OWNER'S iPAD, 2026-08-09, on staging build 2c5fca8: Google sign-in succeeded, and the
// avatar/name dialog appeared and vanished "superfast" on an account that already had a child. Any tap
// landing in that window creates a nameless profile — one was created at 12:19:00 UTC and had to be
// deleted by hand.
//
// THE MECHANISM. Guest play publishes `rosterSettled: true`, which is CORRECT for a guest: there is no
// roster and there never will be, so an empty one is a real answer. Signing in re-enters
// `profileStore.hydrate()` with a real account id; `guestModeActive()` is already false by then, and a
// device that has only ever played as a guest has no cached roster — so the store published
// `profiles: []` while `rosterSettled` was still `true` FROM THE GUEST PHASE. For the length of the
// `/api/profiles` round trip `profileGateSurface` read "settled AND empty" and raised the
// un-dismissible create dialog.
//
// It is the same defect `profileGatePolicy` was extracted to fix, one moment later: that one stopped
// "we haven't asked yet" reading as "no children"; this stops "we asked, as somebody else" reading the
// same way. Neither is reachable from a pure test of the policy — the policy was right both times. What
// was wrong is the STATE handed to it, so this drives the real store.
//
// Same shim discipline as authSignOut.test.ts: install localStorage BEFORE importing the singletons.

interface Disk {
  [k: string]: string
}
const disk: Disk = {}
const shim = {
  getItem: (k: string) => (k in disk ? disk[k] : null),
  setItem: (k: string, v: string) => {
    disk[k] = String(v)
  },
  removeItem: (k: string) => {
    delete disk[k]
  },
  clear: () => {
    for (const k of Object.keys(disk)) delete disk[k]
  },
  key: (i: number) => Object.keys(disk)[i] ?? null,
  get length() {
    return Object.keys(disk).length
  },
}
;(globalThis as unknown as { localStorage: typeof shim }).localStorage = shim

/** Held open so the test can inspect the state WHILE /api/profiles is still in flight. */
let releaseRoster: (() => void) | null = null
let roster: Array<{ id: string; name: string; avatarEmoji: string }> = [
  { id: 'kid-1', name: 'Sejer', avatarEmoji: 'fox' },
]
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: unknown) => {
  const url = String(input)
  if (url.includes('/get-session')) {
    return json({ user: { id: 'adult-1', email: 'a@example.com' }, session: { id: 's1' } })
  }
  if (url.includes('/family/status')) {
    return json({ hasPin: true, pinUpdatedAt: 1, methods: ['google'], passkeyCount: 0, webauthnEnabled: false })
  }
  if (url.includes('/family/access-token')) return json({ token: 'jwt', expiresIn: 900 })
  if (url.includes('/api/profiles')) {
    // THE WHOLE POINT: the roster answers LATE. A fetch that resolves immediately hides this bug
    // completely, which is why every existing test missed it.
    await new Promise<void>((r) => {
      releaseRoster = r
    })
    return json({ profiles: roster })
  }
  if (url.includes('/api/progress')) return json({ error: 'none yet' }, 404)
  return json({}, 404)
}) as unknown as typeof fetch

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authStore } from './authStore.ts'
import { profileStore } from './profileStore.ts'
import { profileGateSurface } from '../contexts/profileGatePolicy.ts'
import { enterGuestMode } from '../utils/guestMode.ts'

const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

test('the create dialog never flashes between guest play and a signed-in roster', async () => {
  // 1. Guest play. An empty roster IS settled here — a guest has no account to have children in.
  enterGuestMode()
  profileStore.hydrate(null)
  await settle()
  assert.equal(profileStore.get().rosterSettled, true, 'precondition: guest play settles the roster')

  // 2. Sign in. `adoptSession` exits guest mode; `AuthGate` then re-hydrates with the real account id.
  authStore.adoptSession('session-token-1', { id: 'adult-1', email: 'a@example.com' })
  await settle()
  profileStore.hydrate('adult-1')
  await settle()

  // 3. THE WINDOW. /api/profiles has NOT answered yet. This is where the dialog appeared.
  const mid = profileStore.get()
  assert.equal(mid.profiles.length, 0, 'precondition: this device has no cached roster (guest-only device)')
  assert.equal(
    mid.rosterSettled,
    false,
    'the guest phase’s "settled" verdict was carried into the new account — it describes a different identity',
  )
  assert.notEqual(
    profileGateSurface(mid, false),
    'create',
    'THE BUG: the un-dismissible create dialog is raised over an account whose roster has not answered',
  )

  // 4. The roster arrives. Only now may a surface be decided, and it is the child that exists.
  releaseRoster?.()
  await settle()
  const after = profileStore.get()
  assert.equal(after.rosterSettled, true)
  assert.deepEqual(
    after.profiles.map((p) => p.name),
    ['Sejer'],
    'the signed-in roster should be the account’s real child',
  )
  assert.notEqual(profileGateSurface(after, false), 'create', 'an account WITH a child must never be asked to make one')
})

test('a RETURNING adult with two children gets the picker, never the create dialog', async () => {
  // The owner's question, and the case this whole file exists because nothing covered: an account that
  // already has children, signing in on a device that has never seen them. The roster cache is empty
  // (a fresh device, or `storageReset` having swept it), so "settled AND empty" is exactly the state a
  // stale flag manufactures — and with two children there is nothing to auto-attach either, so the
  // window is as long as the round trip.
  roster = [
    { id: 'kid-1', name: 'Sejer', avatarEmoji: 'fox' },
    { id: 'kid-2', name: 'Alma', avatarEmoji: 'cat' },
  ]
  delete disk['bornelaering-profiles']
  delete disk['bornelaering-active-profile']
  profileStore.hydrate('adult-2')
  await settle()

  const mid = profileStore.get()
  assert.equal(mid.rosterSettled, false, 'an unanswered roster must never read as settled')
  assert.notEqual(profileGateSurface(mid, false), 'create', 'an adult with two children asked to create one')

  releaseRoster?.()
  await settle()
  const after = profileStore.get()
  assert.deepEqual(after.profiles.map((p) => p.name).sort(), ['Alma', 'Sejer'])
  // Two children and none chosen is the PICKER — the adult says who is playing, and nothing is attached
  // in the meantime, so no XP can land in the wrong book while they decide.
  assert.equal(profileGateSurface(after, false), 'picker')
  assert.equal(after.activeProfileId, null, 'nothing may be attached before the adult chooses')
})
