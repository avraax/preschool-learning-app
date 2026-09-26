import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { MUSIC_TARGET_LUFS, musicVolume } from './musicLevel.ts'
import { MUSIC_BAKED, MUSIC_BAKED_TARGET_LUFS } from './musicBaked.ts'

// The music level must live in the FILES, because iOS ignores <audio>.volume (musicLevel.ts). Two
// "halve the music" commits changed a runtime BASE_VOLUME, were audible on the desktop, and did
// nothing at all in the App Store build — which played the raw masters level with the narration.

const ROOT = process.cwd()
const MUSIC_DIR = path.join(ROOT, 'public', 'sounds', 'music')
const shipped = readdirSync(MUSIC_DIR).filter((f) => f.endsWith('.mp3'))

test('the steady music volume is 1 — the level is not a runtime number', () => {
  assert.equal(musicVolume(false), 1)
  assert.ok(musicVolume(true) < 1, 'still ducks where element volume is settable')
})

test('musicClient sets no level of its own (it would reach the desktop only)', () => {
  const src = readFileSync(path.join(ROOT, 'src', 'services', 'musicClient.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  assert.match(src, /musicVolume\(/)
  assert.doesNotMatch(src, /BASE_VOLUME|WORLD_GAIN|volume:\s*0\.\d/)
})

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

test('the fade-out into a game has ONE knob and starts on the tap', () => {
  const client = stripComments(readFileSync(path.join(ROOT, 'src', 'services', 'musicClient.ts'), 'utf8'))
  // stop() — the path every "leave for a game" takes — fades over MUSIC_FADE_OUT_MS, nothing local.
  const stop = client.slice(client.indexOf('stop(): void {'), client.indexOf('leavingFor('))
  assert.match(stop, /fadeOutAndUnload\(t, MUSIC_FADE_OUT_MS\)/)
  // …through the WebAudio gain ramp, because <audio>.volume does nothing on iOS.
  assert.match(client, /setValueCurveAtTime\(/)
  // The wipe tells the bed on the tap, before the cover runs — not after the route has swapped.
  const provider = stripComments(
    readFileSync(path.join(ROOT, 'src', 'components', 'common', 'transition', 'TransitionProvider.tsx'), 'utf8'),
  )
  const start = provider.slice(provider.indexOf('const start = useCallback'), provider.indexOf('const navigateWithTransition'))
  assert.ok(start.indexOf('musicClient.leavingFor(to)') >= 0, 'start() must call musicClient.leavingFor(to)')
  assert.ok(start.indexOf('musicClient.leavingFor(to)') < start.indexOf("setPhase('covering')"))
})

test('the shipped files were baked at the current MUSIC_TARGET_LUFS', () => {
  assert.equal(
    MUSIC_BAKED_TARGET_LUFS,
    MUSIC_TARGET_LUFS,
    'MUSIC_TARGET_LUFS changed without `npm run music:bake`',
  )
  for (const [world, rec] of Object.entries(MUSIC_BAKED)) {
    assert.ok(Math.abs(rec.lufs - MUSIC_TARGET_LUFS) <= 1, `${world} baked at ${rec.lufs} LUFS`)
  }
})

test('every shipped track is exactly the baked file (a swapped-in master fails here)', () => {
  assert.deepEqual(shipped.map((f) => f.replace(/\.mp3$/, '')).sort(), Object.keys(MUSIC_BAKED).sort())
  for (const f of shipped) {
    const sha = createHash('sha256').update(readFileSync(path.join(MUSIC_DIR, f))).digest('hex')
    assert.equal(sha, MUSIC_BAKED[f.replace(/\.mp3$/, '')].sha256, `${f} is not the baked file — run npm run music:bake`)
  }
})

// The real measurement. Skipped only when the ffmpeg-static binary is absent (its download can fail
// on a CI install); the hash test above still pins the files there.
const ffmpeg = (() => {
  try {
    const p = createRequire(import.meta.url)('ffmpeg-static') as string | null
    return p && existsSync(p) ? p : null
  } catch {
    return null
  }
})()

test('each shipped track measures at the target loudness', { skip: ffmpeg ? false : 'no ffmpeg-static binary' }, () => {
  for (const f of shipped) {
    const r = spawnSync(
      ffmpeg!,
      ['-hide_banner', '-nostats', '-i', path.join(MUSIC_DIR, f), '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    )
    const hit = r.stderr.match(/I:\s+(-?\d+(?:\.\d+)?) LUFS/)
    assert.ok(hit, `no loudness reading for ${f}`)
    const lufs = Number(hit[1])
    assert.ok(Math.abs(lufs - MUSIC_TARGET_LUFS) <= 1, `${f} measures ${lufs} LUFS, target ${MUSIC_TARGET_LUFS}`)
  }
})
