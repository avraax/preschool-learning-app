import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTH_Z } from './authOverlayZ.ts'

// The auth overlays' stacking order, as an invariant rather than a set of literals nobody can compare.
//
// Why this deserves a test: a MUI `<Dialog>` defaults to z-index 1300, while the lock screen and the
// profile picker are hand-rolled `position: fixed` boxes at ~10 000. A dialog opened FROM one of those
// therefore mounts UNDERNEATH it — fully interactive and completely invisible. That produced two real
// dead buttons, and neither could fail a type-check, a lint or a render test:
//
//   * "Brug kode i stedet" on the lock screen (PinDialog behind the gate),
//   * "Lav en ny profil" in the profile picker (CreateProfileDialog behind the picker) — reachable today
//     by any household with two children.

const HERE = path.dirname(fileURLToPath(import.meta.url))

test('a surface always outranks the one it can be opened from', () => {
  // The lock screen is the floor. Onboarding sits inside it; a PIN demand sits above everything, because
  // requirePin() can be raised from any of them.
  assert.ok(AUTH_Z.profilePicker > AUTH_Z.lockScreen, 'picker over the gate')
  assert.ok(AUTH_Z.createProfile > AUTH_Z.profilePicker, 'create dialog over the picker it opens from')
  assert.ok(AUTH_Z.wrongContext > AUTH_Z.createProfile, 'wrong-context return over onboarding')
  assert.ok(AUTH_Z.pin > AUTH_Z.wrongContext, 'a PIN demand is answerable from every surface')
})

test('every PIN surface clears the lock screen — that is the whole point', () => {
  // 1300 is theme.zIndex.modal, the MUI Dialog default. If a PIN surface ever silently falls back to it,
  // the pad becomes invisible on the lock screen again.
  assert.ok(AUTH_Z.pin > 1300)
  assert.ok(AUTH_Z.pin > AUTH_Z.lockScreen)
})

test('every MUI Dialog in the auth stack sets its z-index explicitly', () => {
  // The failure this guards is SILENT OMISSION, not a wrong number: drop the `sx` and the dialog falls
  // back to MUI's 1300, i.e. behind the lock screen and the picker, and it renders invisibly instead of
  // erroring. A missing z-index here is a dead button.
  const missing: string[] = []
  for (const name of readdirSync(HERE)) {
    if (!/\.tsx$/.test(name)) continue
    const src = readFileSync(path.join(HERE, name), 'utf8')
    if (!/<Dialog[\s>]/.test(src)) continue
    if (!src.includes('AUTH_Z.')) missing.push(name)
  }
  assert.deepEqual(
    missing,
    [],
    `these render a <Dialog> in the auth stack with no AUTH_Z z-index: ${missing.join(', ')}`,
  )
})

test('no auth overlay carries a hand-written z-index literal', () => {
  const offenders: string[] = []
  for (const name of readdirSync(HERE)) {
    if (!/\.tsx$/.test(name)) continue
    const src = readFileSync(path.join(HERE, name), 'utf8')
    // A numeric literal, as opposed to an AUTH_Z.* reference. `zIndex: 0`/`1` are legitimate local
    // stacking inside a card, so only the 4-and-5-digit range matters here.
    const match = src.match(/zIndex:\s*\d{4,}/)
    if (match) offenders.push(`${name} (${match[0]})`)
  }
  assert.deepEqual(
    offenders,
    [],
    `use AUTH_Z from authOverlayZ.ts so the ordering stays comparable: ${offenders.join(', ')}`,
  )
})
