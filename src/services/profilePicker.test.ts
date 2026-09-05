// "Hvem spiller?" on every cold start (Børn picker PRD-01), and the two places a create affordance
// must NOT be.
//
// The behavioural half is asserted against the STORE'S PUBLISHED STATE rather than against source
// text, because the defect this replaces was invisible in the source: `hydrate` read a pointer and
// attached, which is a perfectly reasonable-looking line — what was wrong was that a family therefore
// met the picker exactly once, on this device's first launch, and silently resumed as whoever played
// last on every launch after.
//
// Same shim discipline as `authSignOut.test.ts`: install localStorage BEFORE importing the singletons,
// or their try/catch-guarded storage access runs in memory and every assertion about what landed on
// "disk" is vacuous.

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
;(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: unknown) => {
  const url = String(input)
  // A DELETE that succeeds — the only network this file needs.
  if (url.includes('/api/profiles')) return json({ ok: true })
  return json({}, 404)
}) as unknown as typeof fetch

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { profileStore } from './profileStore.ts'
import { progressStore } from './progressStore.ts'

const ROSTER_KEY = 'bornelaering-profiles'
const POINTER_KEY = 'bornelaering-active-profile'

const kids = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `kid-${i + 1}`, name: `Barn ${i + 1}`, avatarId: 'fox' }))

/** Reset to a cold boot: fresh disk, and a store that has not hydrated for this identity. */
const coldBoot = (roster: ReturnType<typeof kids>, pointer: string | null, account: string) => {
  shim.clear()
  disk[ROSTER_KEY] = JSON.stringify(roster)
  if (pointer) disk[POINTER_KEY] = pointer
  profileStore.hydrate(account)
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
}

// ---- The boot rule -----------------------------------------------------------------------------

test('TWO cached children and a valid pointer still ASK — the pointer no longer decides', async () => {
  // The whole feature. Before this, `bornelaering-active-profile` short-circuited the picker forever
  // after the first launch, so the second child could only start a session through the PIN-gated adult
  // menu. The pointer names a real child here, which is precisely the case that used to skip the ask.
  coldBoot(kids(2), 'kid-2', 'adult-A')
  await settle()

  const state = profileStore.get()
  assert.equal(state.status, 'choosing', 'the store attached somebody instead of asking')
  assert.equal(state.activeProfileId, null)
  assert.equal(state.profiles.length, 2)
  // …and NOTHING may be attached while the question is open, or a tap could write to the wrong book.
  assert.equal(progressStore.isAttached(), false, 'a child is attached behind the picker')
})

test('ONE cached child boots straight in — the child never sees a gate', async () => {
  coldBoot(kids(1), 'kid-1', 'adult-B')
  await settle()

  const state = profileStore.get()
  assert.equal(state.status, 'ready')
  assert.equal(state.activeProfileId, 'kid-1')
  assert.equal(progressStore.isAttached(), true)
})

test('one child with a STALE pointer still boots straight in', async () => {
  // The pointer naming a deleted child used to fall through to `cached.length === 1`. It still must:
  // the rule is the COUNT now, and a leftover pointer may never resurrect a picker for one child.
  coldBoot(kids(1), 'kid-99', 'adult-C')
  await settle()

  assert.equal(profileStore.get().activeProfileId, 'kid-1')
  assert.equal(progressStore.isAttached(), true)
})

test('the pointer is still WRITTEN — it is read-dead, not write-dead', async () => {
  // Kept deliberately (§4.6): one line, a later "sidst spillet" marker wants it, and deleting the write
  // is a behaviour change disguised as a tidy-up. If this fails, check it was not "cleaned up".
  coldBoot(kids(2), null, 'adult-D')
  await settle()
  profileStore.selectProfile('kid-2', 'adult-D')
  assert.equal(disk[POINTER_KEY], 'kid-2')
})

// ---- Deleting down to one ----------------------------------------------------------------------

test('deleting the ACTIVE child when one remains SELECTS the survivor', async () => {
  // §4.3. The picker renders at 2+, so a lone survivor left in `choosing` would be an app rendered
  // with an INERT store and nobody playing — the "nobody to play as" hole, reached from the one
  // direction the gate cannot see.
  coldBoot(kids(2), null, 'adult-E')
  await settle()
  profileStore.selectProfile('kid-1', 'adult-E')
  assert.equal(progressStore.isAttached(), true, 'precondition: attached')

  const ok = await profileStore.deleteProfile('kid-1')
  assert.equal(ok, true, 'precondition: the delete succeeded')

  const state = profileStore.get()
  assert.deepEqual(state.profiles.map((p) => p.id), ['kid-2'])
  assert.equal(state.activeProfileId, 'kid-2', 'the survivor was left unselected')
  assert.equal(state.status, 'ready')
  assert.equal(progressStore.isAttached(), true, 'nobody is attached after deleting down to one')
})

test('deleting down to TWO leaves the question open, as it should', async () => {
  // The guard above must not become "always select something" — with two left there is still a choice
  // to make, and making it for the family is the defect this PRD removes.
  coldBoot(kids(3), null, 'adult-F')
  await settle()
  profileStore.selectProfile('kid-1', 'adult-F')

  await profileStore.deleteProfile('kid-1')
  const state = profileStore.get()
  assert.equal(state.profiles.length, 2)
  assert.equal(state.activeProfileId, null)
  assert.equal(state.status, 'choosing')
})

// ---- No create affordance outside the parental gate --------------------------------------------
//
// A config/behaviour test cannot see a component rendering a button, so these read source — comments
// stripped first, because the "why" comment above each removal names the thing it removed.

const codeOf = (rel: string): string =>
  readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('the boot picker offers NO way to create a child', () => {
  // It used to, wired straight to CreateProfileDialog with no gate of any kind — so a five-year-old at
  // "Hvem spiller?" could add children to the account. Both halves are asserted: the component takes no
  // create callback, and the gate passes none.
  const picker = codeOf('components/auth/ProfilePicker.tsx')
  assert.doesNotMatch(picker, /onCreate/, 'ProfilePicker has a create callback again')
  assert.doesNotMatch(picker, /Tilføj/, 'ProfilePicker renders an add-a-child affordance again')
  // Guard the guard: it must still render the tiles it exists for, or "no create button" is vacuous.
  assert.match(picker, /data-profile-tile=\{p\.id\}/, 'the picker lost its child tiles')

  const gate = codeOf('components/auth/ProfileGate.tsx')
  assert.doesNotMatch(gate, /onCreate=/, 'ProfileGate passes a create callback to the picker again')
  // …and the MANDATORY dialog survives, so this cannot pass by having deleted both (§4.4).
  assert.match(gate, /<CreateProfileDialog/, 'the mandatory first-run dialog is gone')
  assert.match(gate, /open=\{needsFirstProfile\}/)
})

test('a GUEST is offered no way to add a child either', () => {
  // §2.8. The row used to render with a "Kræver en konto" hint that scrolled to the sign-in offer;
  // since the Barn+Konto merge that offer is a few centimetres above it in the same pane.
  const boern = codeOf('components/adult/panes/konto/BoernSection.tsx')
  assert.match(boern, /\{!guest && \(/, 'the add-a-child button is no longer guest-gated')
  assert.doesNotMatch(boern, /Kræver en konto/, 'the guest add-a-child row is back')
  assert.doesNotMatch(boern, /onWantAccount/, 'the scroll-to-the-offer plumbing is back')
  // Guard the guard: a signed-in adult must still have the button — this is now the ONLY un-mandatory
  // way to add a child, so deleting it outright would strand a family at one child.
  assert.match(boern, /aria-label="Tilføj et barn"/, 'the signed-in add-a-child button is gone too')
})
