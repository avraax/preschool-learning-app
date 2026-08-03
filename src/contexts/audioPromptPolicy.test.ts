import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { shouldShowAudioPrompt, shouldRenderAudioPrompt } from './audioPromptPolicy.ts'

// Source-read guards below need the comments GONE before matching: every rule they assert is also
// EXPLAINED in a comment right beside the code, so a plain `includes()` would be satisfied by the prose
// and stay green after the fix itself was deleted (CLAUDE.md: a guard that greps source must strip
// comments first).
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\/.*$/gm, '')

const readStripped = (rel: string) =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))

const base = { needsUserAction: true, isWorking: false, hasUnlockedOnce: false, userDismissed: false }

test('shows the modal on first run when audio needs a gesture', () => {
  assert.equal(shouldShowAudioPrompt(base), true)
})

test('hides once audio is working', () => {
  assert.equal(shouldShowAudioPrompt({ ...base, isWorking: true, needsUserAction: false }), false)
})

test('THE FIX: does not re-arm after a transient iOS suspend once audio has unlocked once', () => {
  // iOS AudioContext dropped to suspended/interrupted after unlock: needsUserAction back on,
  // isWorking off — but it must stay closed because it already unlocked once.
  assert.equal(
    shouldShowAudioPrompt({ needsUserAction: true, isWorking: false, hasUnlockedOnce: true, userDismissed: false }),
    false,
  )
})

test('THE FIX: stays closed after the user explicitly dismisses it (button or close icon)', () => {
  assert.equal(shouldShowAudioPrompt({ ...base, userDismissed: true }), false)
})

test('still stays hidden when no user action is needed', () => {
  assert.equal(shouldShowAudioPrompt({ ...base, needsUserAction: false }), false)
})

// ----- shouldRenderAudioPrompt: ONE blocking overlay at a time -----------------------------------
// The audio modal painted over the mandatory PIN setup and "who is playing?" — twice, because the
// first fix was a z-index bump. These cases pin the composed decision.

test('an open auth/onboarding surface suppresses the audio modal', () => {
  assert.equal(
    shouldRenderAudioPrompt({ showPrompt: true, authUiOpen: true, devNoGate: false }),
    false,
  )
})

test('with nothing else blocking, a wanted prompt renders', () => {
  assert.equal(
    shouldRenderAudioPrompt({ showPrompt: true, authUiOpen: false, devNoGate: false }),
    true,
  )
})

test('devNoGate (?nogate=1) suppresses it so every screenshot recipe keeps working', () => {
  assert.equal(
    shouldRenderAudioPrompt({ showPrompt: true, authUiOpen: false, devNoGate: true }),
    false,
  )
})

test('the audio verdict is still required — suppression never FORCES the modal open', () => {
  assert.equal(
    shouldRenderAudioPrompt({ showPrompt: false, authUiOpen: false, devNoGate: false }),
    false,
  )
})

// ----- The modal may only CLOSE on a click (tap-through fix, 2026-08-03) -------------------------
// One tap on "Start lyd nu" also pressed whatever sat behind the modal. Cause: the document-wide
// `touchstart` listener runs updateUserInteraction → initializeAudio, and initializeAudio's async
// continuation set `showPrompt: false`. That landed BETWEEN touchstart and the click the same tap
// produces, so the browser hit-tested the click against the now-uncovered page.
//
// The invariant is structural, not a value, so these read the source: closing the modal must happen
// only in `hidePrompt`, and `hidePrompt` may only be wired to `onClick` (a click's target is resolved
// before the handler runs, so unmounting there cannot retarget anything).

test('THE FIX: initializeAudio never closes the modal (its continuation lands mid-gesture)', () => {
  const src = readStripped('./SimplifiedAudioContext.tsx')
  const start = src.indexOf('const initializeAudio')
  const end = src.indexOf('const updateUserInteraction')
  assert.ok(start > 0 && end > start, 'could not locate initializeAudio in the source')
  assert.ok(
    !/showPrompt\s*:/.test(src.slice(start, end)),
    'initializeAudio touches showPrompt again — a tap that unlocks audio will now fall through to the page behind the modal',
  )
})

test('hidePrompt is the single place that closes the modal', () => {
  const src = readStripped('./SimplifiedAudioContext.tsx')
  const closes = src.match(/showPrompt\s*:\s*false/g) ?? []
  // Exactly two: the provider's initial state, and hidePrompt's setState.
  assert.equal(closes.length, 2, `expected 2 "showPrompt: false" (initial state + hidePrompt), found ${closes.length}`)
  const hide = src.slice(src.indexOf('const hidePrompt'))
  assert.ok(/showPrompt\s*:\s*false/.test(hide.slice(0, hide.indexOf('}, ['))), 'hidePrompt no longer closes the modal')
})

test('every dismiss control on the modal is a click handler, never a touch/pointer-down one', () => {
  const src = readStripped('../components/common/SimplifiedAudioPermission.tsx')
  // The scrim and the ✕ both close directly; the button closes via handleEnableAudio.
  assert.ok(src.includes('onClick={hidePrompt}'), 'nothing on the overlay closes it on click')
  assert.ok(src.includes('onClick={handleEnableAudio}'), '"Start lyd nu" no longer closes on click')
  for (const early of ['onPointerDown', 'onTouchStart', 'onMouseDown', 'onPointerUp', 'onTouchEnd']) {
    assert.ok(
      !src.includes(early),
      `${early} on the audio modal closes it before the tap's click is dispatched — the click then lands on the page behind`,
    )
  }
})
