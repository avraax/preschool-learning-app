// The sign-out contract, and the "have we asked yet?" flag the profile gate depends on.
//
// Both cover bugs that a green build could never have caught, because both are about WHO the app thinks
// is playing after an identity change:
//
//  1. Signing out left progressStore ATTACHED to the child and the cached roster on disk. The next adult
//     to sign in on that device briefly played as the PREVIOUS adult's child — reading and writing that
//     child's local book — until the roster refresh happened to prune it. The revocation path (a 401 on
//     a background validate) had the same hole and no component can intercept it, which is why the fix
//     is a subscription inside authStore rather than a call at the two sign-out buttons.
//
//  2. `profiles.length === 0` was read as "this account has no children" while the very first
//     /api/profiles request was still in flight, so ProfileGate showed its UN-DISMISSIBLE create dialog
//     on every cold boot — and `utils/storageReset.ts` deliberately wipes the cached roster once per
//     device, so that is the accounts release's first impression for an account whose children were
//     created on another device.
//
// Same shim discipline as progressStoreProfiles.test.ts: install localStorage BEFORE importing the
// singletons, or their try/catch-guarded storage access silently runs in-memory and the assertions about
// what actually landed on "disk" become vacuous.

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

// A routing fetch shim. `sessionStatus` is flipped mid-test to simulate revocation.
let sessionStatus = 200
const calls: string[] = []
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: unknown) => {
  const url = String(input)
  calls.push(url)
  if (url.includes('/get-session')) {
    return sessionStatus === 200
      ? json({ user: { id: 'adult-1', email: 'a@example.com' }, session: { id: 's1' } })
      : json({ error: 'Unauthorized' }, sessionStatus)
  }
  if (url.includes('/family/status')) {
    return json({
      hasPin: true,
      pinUpdatedAt: 1000,
      methods: ['google'],
      passkeyCount: 0,
      webauthnEnabled: false,
    })
  }
  if (url.includes('/family/access-token')) return json({ token: 'access-jwt', expiresIn: 900 })
  if (url.includes('/api/profiles')) return json({ profiles: [{ id: 'kid-1', avatarEmoji: 'A' }] })
  if (url.includes('/api/progress')) return json({ error: 'none yet' }, 404)
  if (url.includes('/sign-out')) return json({ ok: true })
  return json({}, 404)
}) as unknown as typeof fetch

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authStore } from './authStore.ts'
import { profileStore } from './profileStore.ts'
import { progressStore } from './progressStore.ts'

const ROSTER_KEY = 'bornelaering-profiles'
const POINTER_KEY = 'bornelaering-active-profile'
const ACCOUNT_KEY = 'bornelaering-account'

/** Let the fire-and-forget fetches inside adopt/hydrate settle. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

test('signing out detaches the child and drops the cached roster', async () => {
  sessionStatus = 200
  authStore.adoptSession('session-token-1', { id: 'adult-1', email: 'a@example.com' })
  await settle()

  profileStore.selectProfile('kid-1', 'adult-1')
  assert.equal(progressStore.isAttached(), true, 'precondition: the child is attached')
  assert.equal(disk[POINTER_KEY], 'kid-1')
  assert.ok(disk[ACCOUNT_KEY], 'precondition: the session is on disk')
  await settle()

  await authStore.signOut()

  assert.equal(progressStore.isAttached(), false, 'the child must be detached')
  assert.equal(progressStore.activeProfileId(), null)
  assert.equal(POINTER_KEY in disk, false, 'the active-profile pointer must be gone')
  assert.equal(ROSTER_KEY in disk, false, 'the cached roster must be gone')
  assert.equal(ACCOUNT_KEY in disk, false, 'the session must be gone')
  assert.equal(profileStore.get().status, 'signed-out')
})

test('a REVOKED session detaches too — nothing else can intercept that path', async () => {
  sessionStatus = 200
  authStore.adoptSession('session-token-2', { id: 'adult-1', email: 'a@example.com' })
  await settle()
  profileStore.selectProfile('kid-1', 'adult-1')
  assert.equal(progressStore.isAttached(), true, 'precondition: attached')
  await settle()

  // The server says the session is gone. This is the path with no component in it at all.
  sessionStatus = 401
  const verdict = await authStore.validate(true)

  assert.equal(verdict, 'invalid')
  assert.equal(progressStore.isAttached(), false, 'a revoked session must detach the child')
  assert.equal(ROSTER_KEY in disk, false, 'a revoked session must drop the cached roster')
})

test('the roster is not "settled" until the request has actually answered', async () => {
  sessionStatus = 200
  authStore.adoptSession('session-token-3', { id: 'adult-1', email: 'a@example.com' })
  await settle()

  profileStore.signOut()
  assert.equal(profileStore.get().rosterSettled, false, 'a fresh sign-in starts unsettled')

  profileStore.hydrate('adult-1')
  // SYNCHRONOUSLY after hydrate: the fetch is in flight. This is the instant ProfileGate used to
  // conclude "this account has no children" and show its un-dismissible create dialog.
  assert.equal(
    profileStore.get().rosterSettled,
    false,
    'must NOT claim to be settled while /api/profiles is in flight',
  )
  assert.equal(profileStore.get().profiles.length, 0, 'and the roster is empty at that instant')

  await settle()
  assert.equal(profileStore.get().rosterSettled, true, 'settled once the answer arrived')
  assert.equal(profileStore.get().profiles.length, 1)
})

test('a failed roster fetch still settles, so the gate cannot hang forever', async () => {
  profileStore.signOut()
  const realFetch = globalThis.fetch
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
    throw new Error('offline')
  }) as unknown as typeof fetch

  await profileStore.refreshRoster('adult-1')
  assert.equal(profileStore.get().rosterSettled, true)

  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = realFetch
})

const countOf = (needle: string) => calls.filter((u) => u.includes(needle)).length

test('repeated resumes do not each cost a session check', async () => {
  sessionStatus = 200
  authStore.adoptSession('session-token-4', { id: 'adult-1', email: 'a@example.com' })
  await settle()

  const before = countOf('/get-session')
  // `visibilitychange:visible` fires on every app switch on an iPad, and `online` can fire alongside it.
  // Deduped (concurrent calls share one request) AND throttled (a fresh verdict is not re-asked).
  await Promise.all([authStore.validate(), authStore.validate(), authStore.validate()])
  await settle()

  assert.equal(countOf('/get-session'), before, 'three resumes must not cost three session checks')
})

test('/family/status is throttled INDEPENDENTLY of the session check', async () => {
  sessionStatus = 200
  authStore.adoptSession('session-token-5', { id: 'adult-1', email: 'a@example.com' })
  await settle()

  const sessionsBefore = countOf('/get-session')
  const statusBefore = countOf('/family/status')

  // FORCED, so each one really does hit /get-session — this isolates the status throttle from the
  // validate throttle. Sequential, so the in-flight dedupe cannot be what is doing the work either.
  await authStore.validate(true)
  await authStore.validate(true)
  await authStore.validate(true)
  await settle()

  assert.equal(countOf('/get-session'), sessionsBefore + 3, 'forced validates must all be sent')
  assert.equal(
    countOf('/family/status'),
    statusBefore,
    'the credential set does not change three times in a second — do not re-ask for it',
  )
})
