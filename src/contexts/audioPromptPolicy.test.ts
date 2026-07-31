import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowAudioPrompt, shouldRenderAudioPrompt } from './audioPromptPolicy.ts'

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
