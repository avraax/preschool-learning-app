import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowAudioPrompt } from './audioPromptPolicy.ts'

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

test('THE FIX: stays closed after the user explicitly dismisses it (button or ✕)', () => {
  assert.equal(shouldShowAudioPrompt({ ...base, userDismissed: true }), false)
})

test('still stays hidden when no user action is needed', () => {
  assert.equal(shouldShowAudioPrompt({ ...base, needsUserAction: false }), false)
})
