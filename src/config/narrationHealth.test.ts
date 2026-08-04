// The degraded-mode signal and its wiring (Practice Loop PRD-01 W4).
//
// The interesting assertion is not the boolean — it is that `isWorking` alone is NOT the signal. That is
// the whole reason this module exists: it was TRUE through the Ogg silence on the target iPad, so a
// degraded mode gated on it would never have fired for the exact bug it is meant to catch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('both audio-only boards reveal their answer, and ONLY those two', () => {
  // Tal Quiz prints the numeral; Lyt og Find prints the English word. Each reads `narrationHealthy`,
  // never `isAudioReady` — which is the mistake the whole module exists to prevent.
  const math = codeOf('components/math/MathGame.tsx')
  assert.match(math, /reveal=\{ctx\.narrationHealthy \? undefined : String\(item\.value\)\}/)
  assert.match(math, /audioOnly: true/)
  assert.ok(!/isAudioReady/.test(math), 'Tal Quiz must not gate its reveal on isAudioReady')

  const engine = codeOf('components/common/UnifiedQuizGame.tsx')
  assert.match(engine, /<ListenHero[\s\S]{0,200}reveal=\{audio\.narrationHealthy \? undefined : String\(item\.value\)\}/)
  const listen = codeOf('components/english/EnglishListenGame.tsx')
  assert.match(listen, /audioOnly: true/)

  // No OTHER game may claim audioOnly: a board that survives silence (Bogstav Quiz is picture→letter)
  // would be silently opting out of its own personal bests.
  const AUDIO_ONLY = ['components/math/MathGame.tsx', 'components/english/EnglishListenGame.tsx']
  for (const rel of [
    'components/alphabet/AlphabetGame.tsx',
    'components/english/EnglishWordGame.tsx',
    'components/ordleg/LaesOrdetGame.tsx',
    'components/math/HvadManglerGame.tsx',
  ]) {
    assert.ok(!AUDIO_ONLY.includes(rel) && !codeOf(rel).includes('audioOnly'), `${rel} must not claim audioOnly`)
  }
})

test('a degraded round grants XP but withholds the personal best', () => {
  const store = codeOf('services/progressStore.ts')
  // The best is withheld…
  assert.match(store, /options\.degraded\s*\n?\s*\? \{ streak: false, stars: false, count: false \}/)
  assert.match(store, /bestStreak: options\.degraded \? prev\.bestStreak/)
  assert.match(store, /bestStars: options\.degraded \? prev\.bestStars/)
  assert.match(store, /bestCount: options\.degraded \? prev\.bestCount/)
  // …and the XP is NOT: he played, and a broken iPad must never cost a child rewards. The xp line must
  // not mention `degraded` at all.
  const xpLine = store.split('\n').find((l) => l.includes('this.applyXp(draft, sectionForGameId(gameId)'))
  assert.ok(xpLine, 'could not find the round XP grant — re-point this guard')
  assert.ok(!xpLine.includes('degraded'), 'degraded must not change the XP grant')

  // The engine passes it, and it is STICKY for the round: a round that revealed its answer for part of
  // its length was partly a shape-match.
  const engine = codeOf('components/common/UnifiedQuizGame.tsx')
  assert.match(engine, /degraded: degradedThisRoundRef\.current/)
  assert.match(engine, /if \(config\.audioOnly && !audio\.narrationHealthy\) degradedThisRoundRef\.current = true/)
  assert.match(engine, /degradedThisRoundRef\.current = false/, 'a replay must start un-degraded')
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
