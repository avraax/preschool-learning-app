import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// OAuthReturnHandler's poll is the ONLY thing that finishes a sign-in when the app page survives the
// round trip — an installed PWA (and the shell) open the authorize URL in a separate view with its own
// storage jar, so the context that comes back holds no flowId and the context that does hold one is the
// app sitting behind it. Two shapes broke that, both silently, and both are guarded here.
//
// It is a SOURCE guard because there is no DOM in this suite; the comments are stripped first so the
// rationale above the fix cannot satisfy it (same reason as authOverlayZ.test.ts).

const src = readFileSync('src/components/auth/OAuthReturnHandler.tsx', 'utf8')
  .replace(/\r\n/g, '\n')
  .split('\n')
  .map((line) => line.replace(/(^|\s)\/\/.*$/, ''))
  .join('\n')

const effect = src.slice(src.indexOf('useEffect(() => {'), src.indexOf('}, [attempt])'))
const ARM = 'const onVisible'

test('the poll and the visibility listener are armed unconditionally', () => {
  // They used to be installed only when a flow was ALREADY pending at mount. A sign-in started later in
  // the same page lifetime therefore got no recovery at all, and the parked session was never claimed
  // (report F9BJX + four identical ones). Nothing may return out of the effect before the arming.
  assert.ok(effect.includes(ARM), 'the arming block is gone — this guard would pass vacuously')
  assert.match(effect.slice(effect.indexOf(ARM)), /setInterval\(/)
  assert.match(effect.slice(effect.indexOf(ARM)), /addEventListener\('visibilitychange'/)

  const NOTE = "noteAuthStep('google-return'"
  const beforeArming = effect.slice(effect.indexOf(NOTE) + NOTE.length, effect.indexOf(ARM))
  assert.ok(effect.includes(NOTE) && beforeArming.length > 0, 'the fragment branch moved — re-anchor this guard')
  // `[\s{;]` rather than `\b`, or the stage name "google-return" satisfies the pattern by itself.
  assert.doesNotMatch(
    beforeArming,
    /[\s{;]return\b/,
    'an early return between the fragment branch and the arming disables recovery for any flow started after mount',
  )
})

test('the give-up window is measured from the FLOW, not from mount', () => {
  // A mount-time ref means an app that has been open longer than the window "exhausts" it before the
  // adult ever taps the button — and now that the poll is permanent, that is every app.
  const poll = effect.slice(effect.indexOf('setInterval('))
  assert.match(poll, /Date\.now\(\) - current\.startedAt > POLL_WINDOW_MS/)
  assert.doesNotMatch(src, /useRef<number>\(Date\.now\(\)\)/, 'the mount-time window ref is back')
})
