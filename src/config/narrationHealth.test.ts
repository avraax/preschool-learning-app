// The degraded-mode signal and its wiring (Practice Loop PRD-01 W4).
//
// The interesting assertion is not the boolean — it is that `isWorking` alone is NOT the signal. That is
// the whole reason this module exists: it was TRUE through the Ogg silence on the target iPad, so a
// degraded mode gated on it would never have fired for the exact bug it is meant to catch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAYBACK_FAILURES_UNHEALTHY, isNarrationHealthy } from './narrationHealth.ts'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Comments stripped and line endings normalised (every file here is CRLF). */
const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const live = (over: Partial<Parameters<typeof isNarrationHealthy>[0]> = {}) =>
  isNarrationHealthy({ isWorking: true, unlockedOnce: true, consecutivePlaybackFailures: 0, ...over })

test('the Ogg case: audio "working" but nothing decodes is UNHEALTHY', () => {
  // THE case. During the Ogg failure the element existed and accepted a src, so `isWorking` was true
  // while the child heard nothing. A rule reading only `isWorking` would have called this healthy.
  assert.equal(live({ consecutivePlaybackFailures: 2 }), false)
  // The suspension case (the other real one): audio worked, then stopped.
  assert.equal(live({ isWorking: false }), false)
  // Healthy is neither.
  assert.equal(live(), true)
})

test('a COLD START is not a failure — the answer must not flash before the first tap', () => {
  // `!isWorking` before the first unlock means "nobody has tapped anything yet". PRD §6.1's literal
  // formula (`isWorking && failures < 2`) called that dead and printed Tal Quiz's numeral over its own
  // answer tiles on entry — measured on rung 1. A giveaway flash on every cold launch is worse than the
  // bug W4 fixes, so the rule needs POSITIVE evidence.
  assert.equal(live({ isWorking: false, unlockedOnce: false }), true)
  // …but real evidence still degrades it, unlocked or not: two blocked/failed plays ARE the evidence.
  assert.equal(live({ isWorking: false, unlockedOnce: false, consecutivePlaybackFailures: 2 }), false)
})

test('one failure is a transient, two is dead — pinned as a literal', () => {
  assert.equal(PLAYBACK_FAILURES_UNHEALTHY, 2)
  // A single failure must NOT flip the board: a stale prebaked file 404ing through to Azure, or one
  // blocked play before the unlock gesture, are routine — and flashing the answer mid-play is worse
  // than the transient.
  assert.equal(live({ consecutivePlaybackFailures: 1 }), true)
  assert.equal(live({ consecutivePlaybackFailures: 99 }), false)
})

test('the counter is fed by PLAYBACK, and a cancellation is neutral', () => {
  // ttsClient's no-queue model cancels constantly (a new tap pre-empts the current clip). A cancel
  // resolves, so it must neither increment the counter nor reset it — counting it as success is how a
  // real failure streak would hide, and counting it as failure would degrade normal fast tapping.
  const tts = codeOf('services/ttsClient.ts')
  assert.match(tts, /const finishReject = [\s\S]{0,400}?this\.notePlaybackFailure\(\)/)
  assert.match(tts, /const onEnded = \(\) => \{\s*this\.notePlaybackOk\(\)/)
  // `finishResolve` is the cancellation path — it must NOT touch the counter.
  const resolveBody = tts.slice(tts.indexOf('const finishResolve'), tts.indexOf('const finishReject'))
  assert.ok(
    !resolveBody.includes('notePlaybackOk') && !resolveBody.includes('notePlaybackFailure'),
    'a cancellation must be neutral for the playback-failure counter',
  )
  // And the count is exposed to bug reports alongside the circuit breaker (§6.1).
  assert.match(tts, /consecutivePlaybackFailures: this\.forcedPlaybackFailures \?\? this\.consecutivePlaybackFailures/)
})

test('the health signal is REACTIVE — the board recovers mid-round', () => {
  // A poll would leave the answer on screen for up to a tick after audio came back; the PRD requires
  // "automatically and mid-round". So the context subscribes.
  const ctx = codeOf('contexts/SimplifiedAudioContext.tsx')
  assert.match(ctx, /ttsClient\.onHealthChange\(sync\)/)
  assert.match(ctx, /playbackFailures/)

  // The hook derives the boolean through the PURE rule, not a hand-rolled comparison.
  const hook = codeOf('hooks/useSimplifiedAudio.ts')
  assert.match(hook, /isNarrationHealthy\(\{[\s\S]{0,300}consecutivePlaybackFailures: audioContext\.state\.playbackFailures/)
  assert.match(hook, /unlockedOnce: audioContext\.state\.unlockedOnce/)
  assert.match(hook, /narrationHealthy,\s*\}\), \[[^\]]*narrationHealthy\]/, 'narrationHealthy must be a memo dep, or the hook returns a stale value')
})

// The wiring pin, UNCHANGED: Tal Quiz prints the numeral, Lyt og Find prints the English word, and
// each reads `narrationHealthy` — never `isAudioReady`, the mistake the whole module exists to prevent.
test('both audio-only boards reveal their answer, and ONLY those two', () => {
  const math = codeOf('components/math/MathGame.tsx')
  assert.match(math, /reveal=\{ctx\.narrationHealthy \? undefined : String\(item\.value\)\}/)
  assert.ok(!/isAudioReady/.test(math), 'Tal Quiz must not gate its reveal on isAudioReady')

  const engine = codeOf('components/common/UnifiedQuizGame.tsx')
  assert.match(engine, /<ListenHero[\s\S]{0,200}reveal=\{audio\.narrationHealthy \? undefined : String\(item\.value\)\}/)

  // The `audioOnly` CONFIG FLAG is deleted (Endless Play PRD-01 W3): it only ever fed the personal-best
  // suppression, which went with personal bests. So "no other game may claim audioOnly" is re-pointed
  // at what is actually load-bearing now — the REVEAL itself. Exactly two components may contain one,
  // and they are these two. A third would be a board handing out its own answer with nothing to stop it.
  const REVEALERS = ['components/math/MathGame.tsx', 'components/common/UnifiedQuizGame.tsx']
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) {
        const rel = path.relative(SRC, full).replace(/\\/g, '/')
        if (REVEALERS.includes(rel)) continue
        if (/narrationHealthy \? undefined :/.test(codeOf(rel))) offenders.push(rel)
      }
    }
  }
  walk(path.join(SRC, 'components'))
  assert.deepEqual(offenders, [], `a third board reveals its own answer:\n${offenders.join('\n')}`)

  // And the flag itself stays gone — an unread config field is the silently-dead shape this repo's
  // guards exist to catch.
  for (const rel of REVEALERS.concat([
    'components/english/EnglishListenGame.tsx',
    'components/alphabet/AlphabetGame.tsx',
    'components/english/EnglishWordGame.tsx',
    'components/ordleg/LaesOrdetGame.tsx',
    'components/math/HvadManglerGame.tsx',
  ])) {
    assert.ok(!codeOf(rel).includes('audioOnly'), `${rel} still carries the deleted audioOnly flag`)
  }
})

test('?mute-tts=1 is DEV/harness-gated and absent from a deploy build', () => {
  // Same discipline as `?nogate=1`: the guard is `DEV || __HARNESS__`, which is statically false in any
  // plain `vite build`, so the whole call folds away. `harnessBuild.test.ts` already fails if a deploy
  // script selects harness mode.
  const harness = codeOf('utils/devHarness.ts')
  assert.match(harness, /installDevMuteTts[\s\S]{0,200}if \(!DEV\) return/)
  assert.match(harness, /readParams\(\)\.get\('mute-tts'\) !== '1'/)
  // It forces the counter through the same constant the rule reads, so the harness can't drift from it.
  assert.match(harness, /forcePlaybackFailures\(PLAYBACK_FAILURES_UNHEALTHY\)/)
  // Nothing outside the harness may force the counter — that would ship a way to fake dead narration.
  const tts = codeOf('services/ttsClient.ts')
  assert.equal((tts.match(/forcePlaybackFailures/g) ?? []).length, 1, 'forcePlaybackFailures has extra callers')
})
