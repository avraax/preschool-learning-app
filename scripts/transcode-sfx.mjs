// Transcode the curated SFX cues in public/sounds/ui/ to MP3.
//
// WHY MP3 and not Ogg/Opus: Apple only added Ogg *container* support in iOS/iPadOS 18.4, so an
// older iPad (e.g. iPad Pro 2nd gen, capped at 17.7) cannot decode a single .ogg — Howler bails
// with "No codec support for selected audio sources" and every cue is silent. MP3 plays on every
// Safari ever shipped. (Howler also probes a .ogg URL against `audio/ogg; codecs="vorbis"`, which
// our Opus-in-Ogg files never matched anyway.)
//
// Usage:  node scripts/transcode-sfx.mjs [--keep-source]
// Requires the ffmpeg-static devDependency. Cues are short, so quality settings favour size.

import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UI_DIR = path.join(__dirname, '..', 'public', 'sounds', 'ui')
const KEEP = process.argv.includes('--keep-source')

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

const sources = (await readdir(UI_DIR)).filter((f) => f.endsWith('.ogg'))
if (!sources.length) {
  console.log('Nothing to do — no .ogg cues in public/sounds/ui/.')
  process.exit(0)
}

let before = 0
let after = 0
for (const file of sources) {
  const src = path.join(UI_DIR, file)
  const out = src.replace(/\.ogg$/, '.mp3')
  // 96 kbps CBR keeps the cues crisp; they are all well under a second.
  await run(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-c:a', 'libmp3lame', '-b:a', '96k', out])
  const [s, o] = await Promise.all([stat(src), stat(out)])
  before += s.size
  after += o.size
  console.log(`  ${file} ${kb(s.size)} → ${path.basename(out)} ${kb(o.size)}`)
  if (!KEEP) await rm(src)
}
console.log(`\n✅ ${sources.length} cues → MP3 (${kb(before)} → ${kb(after)})${KEEP ? ' — sources kept' : ''}`)
