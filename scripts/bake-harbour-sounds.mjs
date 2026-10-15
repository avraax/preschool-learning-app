// Bake Fyld Båden's two long sounds from the owner's downloads in art-src/sfx/ into MP3 cues.
//
//   node scripts/bake-harbour-sounds.mjs
//
// - harbour-ambience.mp3: a SEAMLESS 40 s loop (the last 2 s cross-faded into the first 2 s, so the
//   loop point has no seam), mono, levelled to AMBIENCE_LUFS. It plays as a quiet bed under the game.
// - boat-motor.mp3: a steady 6 s cut of the diesel motor (the source is flat from 3 s on), mono,
//   levelled to MOTOR_LUFS. The game fades it in and out around each arrival and departure.
//
// The LEVEL is baked here and the final loudness is set by `CUE_VOLUME` in sfxClient (WebAudio gain,
// which iOS honours — unlike <audio>.volume). MP3 only: no Ogg before iPadOS 18.4.
// Requires the ffmpeg-static devDependency.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'art-src', 'sfx')
const OUT = path.join(ROOT, 'public', 'sounds', 'ui')

const AMBIENCE_LUFS = -32
const MOTOR_LUFS = -26
const LOOP_S = 40
const XFADE_S = 2

// Every graph gets the SAME file as two inputs ([0:a], [1:a]): the loop needs its head and its body as
// separate streams, and splitting one stream starved the cross-fade (it encoded nothing).
async function lufs(file, filter = '[0:a]anull') {
  const { stderr } = await run(ffmpegPath, ['-hide_banner', '-i', file, '-i', file, '-filter_complex', `${filter},ebur128`, '-f', 'null', '-'], { maxBuffer: 1 << 26 })
  const m = [...stderr.matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g)].pop()
  if (!m) throw new Error(`no loudness for ${file}`)
  return Number(m[1])
}

async function bake(name, src, chain, target) {
  const input = path.join(SRC, src)
  const out = path.join(OUT, name)
  const measured = await lufs(input, chain)
  const gain = (target - measured).toFixed(2)
  await run(ffmpegPath, ['-hide_banner', '-y', '-i', input, '-i', input, '-filter_complex', `${chain},volume=${gain}dB`, '-ac', '1', '-ar', '32000', '-c:a', 'libmp3lame', '-b:a', '64k', out])
  console.log(`  ${name}: ${measured} LUFS → ${await lufs(out)} LUFS (gain ${gain} dB)`)
}

console.log('=== harbour sounds ===')
// [0, LOOP+XFADE] split into a head [0, XFADE] and a body [XFADE, LOOP+XFADE]; cross-fading the body's
// tail into the head gives A[XFADE..LOOP] + mix(A[LOOP..LOOP+XFADE], A[0..XFADE]), which loops cleanly.
await bake(
  'harbour-ambience.mp3',
  'harbour-seagulls-day-src.mp3',
  `[0:a]atrim=${XFADE_S}:${LOOP_S + XFADE_S},asetpts=PTS-STARTPTS[body];` +
    `[1:a]atrim=0:${XFADE_S},asetpts=PTS-STARTPTS[head];` +
    `[body][head]acrossfade=d=${XFADE_S}:c1=tri:c2=tri`,
  AMBIENCE_LUFS,
)
await bake('boat-motor.mp3', 'diesel-motor-fishing-boat-src.mp3', '[0:a]atrim=10:16,asetpts=PTS-STARTPTS', MOTOR_LUFS)
console.log('Done.')
