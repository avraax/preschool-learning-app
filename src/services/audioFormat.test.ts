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

test('no Ogg audio ships at all (undecodable on iOS < 18.4)', () => {
  for (const dir of [TTS_DIR, UI_DIR]) {
    const ogg = readdirSync(dir).filter((f) => /\.(ogg|opus|oga)$/.test(f))
    assert.deepEqual(ogg, [], `${dir} still ships Ogg audio: ${ogg.join(', ')}`)
  }
})
