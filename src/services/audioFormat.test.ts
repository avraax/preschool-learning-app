import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TTS_CONFIG } from '../../shared-tts-config.js'
import { PREBAKED_TTS } from '../config/prebakedTts.ts'

// Guards the container choice that made the app silent on an iPad Pro 2nd gen (iPadOS 17.7):
// every clip shipped as Opus-in-Ogg, and Apple has no Ogg container support before iOS/iPadOS 18.4.
// MP3 is the one audio format every Safari can decode, so nothing here may drift back to .ogg.
// (sfxClient's cue table is read as TEXT — importing it would pull in Howler + the browser store.)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const TTS_DIR = path.join(ROOT, 'public', 'sounds', 'tts')
const UI_DIR = path.join(ROOT, 'public', 'sounds', 'ui')
const SOUNDS_ROOT = path.join(ROOT, 'public', 'sounds')

const sfxCuePaths = (): string[] => {
  const src = readFileSync(path.join(ROOT, 'src', 'services', 'sfxClient.ts'), 'utf-8')
  const paths = [...src.matchAll(/'(\/sounds\/ui\/[^']+)'/g)].map((m) => m[1])
  assert.ok(paths.length >= 10, 'expected the SFX cue table to be found')
  return [...new Set(paths)]
}

test('TTS output format, data-URL mime and prebaked extension all say MP3', () => {
  assert.match(TTS_CONFIG.outputFormat, /mp3$/)
  assert.equal(TTS_CONFIG.mime, 'audio/mpeg')
  assert.equal(TTS_CONFIG.fileExt, 'mp3')
})

test('every prebaked narration clip is an .mp3 that exists on disk', () => {
  const files = Object.values(PREBAKED_TTS)
  assert.ok(files.length > 500, `expected the full prebaked set, got ${files.length}`)
  for (const file of files) {
    assert.match(file, /\.mp3$/, `${file} is not an .mp3`)
    assert.ok(existsSync(path.join(TTS_DIR, file)), `missing prebaked file ${file}`)
  }
})

test('every SFX cue points at an .mp3 that exists on disk', () => {
  for (const cue of sfxCuePaths()) {
    assert.match(cue, /\.mp3$/, `${cue} is not an .mp3`)
    assert.ok(existsSync(path.join(UI_DIR, path.basename(cue))), `missing cue file ${cue}`)
  }
})

// This test used to be named "no Ogg audio ships at all" while checking only TTS_DIR and UI_DIR — and
// 40 .ogg files were shipping the whole time under public/sounds/mascots/. It swept the whole tree once
// the scope was widened to match the claim, so the exemption below is explicit and reasoned rather than
// a silently narrow directory list. Only CHILD-FACING audio must be MP3; the exempt tree is reachable
// only from the off-menu /voicelab audition tool, whose previews are consequently SILENT on the target
// iPad (iPadOS 17.7 cannot decode an Ogg container). That is acceptable for an adult dev tool and must
// not be "fixed" by narrowing this guard again.
const OGG_EXEMPT_DIRS: Record<string, string> = {
  mascots: 'mascot SFX source packs, played only by the off-menu /voicelab audition tool (voicelabData.ts) — never by a child-facing surface. Silent on iPadOS 17.7 by consequence.',
}

test('no Ogg audio ships anywhere a child can reach it (undecodable on iOS < 18.4)', () => {
  const root = SOUNDS_ROOT
  const offenders: string[] = []
  const walk = (dir: string, rel: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (OGG_EXEMPT_DIRS[entry.name]) continue
        walk(path.join(dir, entry.name), relPath)
      } else if (/\.(ogg|opus|oga)$/.test(entry.name)) {
        offenders.push(relPath)
      }
    }
  }
  walk(root, '')
  assert.deepEqual(offenders, [], `Ogg audio on a child-facing path (silent on the target iPad): ${offenders.join(', ')}`)
})

test('the music beds every menu plays are MP3 too', () => {
  // The music bed was the ONLY thing still audible when Ogg silenced that iPad, because it was already
  // mp3. It is a separate channel (HTML5 Audio, not Howler, not the TTS controller), so it has its own
  // way of regressing and its own check.
  const musicDir = path.join(SOUNDS_ROOT, 'music')
  const files = readdirSync(musicDir).filter((f) => !f.startsWith('.'))
  assert.ok(files.length > 0, 'no music beds found')
  for (const f of files) assert.match(f, /\.mp3$/, `music bed ${f} is not an .mp3`)
})
