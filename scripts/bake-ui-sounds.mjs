// Bake the answer + navigation cues (owner 2026-10-17: calmer, subtler, one sound per press) into MP3.
// Re-run to regenerate:
//
//   node scripts/bake-ui-sounds.mjs
//
// correct / wrong / tap are SYNTHESISED soft-mallet notes (one tonal family, nothing to license); the
// two travel cues are Kenney "Interface Sounds" (CC0), kept as sources in art-src/sfx/ and logged in
// art-src/sfx/SOURCES.md. Each cue is trimmed, levelled to an RMS target over its audible part (peak
// capped at -3 dBFS), faded out over 10 ms and written as mono 44.1 kHz MP3 — MP3 only, no Ogg before
// iPadOS 18.4. The playback level on top is `CUE_VOLUME` in sfxClient (WebAudio gain, which iOS honours).
//
// The owner picked these by ear from a levelled audition of ~25 candidates (3 synth + 3 Kenney per
// role); the cue NAMES stay, so swapping one is a change here and nowhere else.

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'sounds', 'ui')
const SRC = path.join(ROOT, 'art-src', 'sfx')
const SR = 44100

// One mallet note at t0: a ~4 ms soft attack, body decay k, and two inharmonic upper partials (the
// marimba's ~4x and ~9x) that die much faster. `bright` scales those partials: lower is rounder.
const note = (f, t0, a = 0.5, k = 9, bright = 1) => {
  const env = (kk) => `gte(t,${t0})*(1-exp(-(t-${t0})*250))*exp(-${kk}*(t-${t0}))`
  return [
    `${a}*${env(k)}*sin(2*PI*${f}*(t-${t0}))`,
    `${a * 0.18 * bright}*${env(k * 3.5)}*sin(2*PI*${f * 3.93}*(t-${t0}))`,
    `${a * 0.06 * bright}*${env(k * 7)}*sin(2*PI*${f * 9.2}*(t-${t0}))`,
  ].join('+')
}
const synth = (d, notes) => ['-f', 'lavfi', '-i', `aevalsrc='${notes.join('+')}':s=${SR}:d=${d}`]
const file = (name) => ['-i', path.join(SRC, name)]

// Target RMS (dBFS, audible part): correct leads, wrong sits under it, taps and travel are quietest.
const CUES = {
  // C5 → G5, a soft rising fifth. 0.6 s.
  'correct.mp3': { src: synth(0.6, [note(523.25, 0), note(783.99, 0.09, 0.45)]), rms: -20 },
  // One muted low note (D4), no fall and no buzz: "not that one", never a scold. 0.35 s.
  'wrong.mp3': { src: synth(0.35, [note(294, 0, 0.6, 14, 0.25)]), rms: -23 },
  // A tiny high pluck (G5), the same family as correct. 0.18 s.
  'tap.mp3': { src: synth(0.18, [note(783.99, 0, 0.5, 30, 0.4)]), rms: -24 },
  // Kenney Interface Sounds: maximize_008 / minimize_008 — a low soft rise and its mirror.
  'nav-forward.mp3': { src: file('kenney-maximize_008.ogg'), rms: -24 },
  'nav-back.mp3': { src: file('kenney-minimize_008.ogg'), rms: -26 },
}

const decode = (srcArgs) => {
  const p = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...srcArgs, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  if (p.status !== 0) throw new Error(String(p.stderr))
  return new Float32Array(p.stdout.buffer.slice(p.stdout.byteOffset, p.stdout.byteOffset + p.stdout.length))
}

for (const [name, { src, rms: targetDb }] of Object.entries(CUES)) {
  let x = decode(src)
  // Trim leading/trailing silence below -55 dBFS (keep 0.5 ms of lead-in).
  const thr = 10 ** (-55 / 20)
  let first = 0
  let last = x.length - 1
  while (first < x.length && Math.abs(x[first]) < thr) first++
  while (last > first && Math.abs(x[last]) < thr) last--
  x = x.slice(Math.max(0, first - 22), last + 1)
  let sum = 0
  let peak = 0
  for (const v of x) {
    sum += v * v
    peak = Math.max(peak, Math.abs(v))
  }
  const gain = Math.min(10 ** (targetDb / 20) / Math.sqrt(sum / x.length), 10 ** (-3 / 20) / peak)
  const fade = Math.min(441, x.length)
  for (let i = 0; i < x.length; i++) {
    const fromEnd = x.length - 1 - i
    x[i] *= gain * (fromEnd < fade ? fromEnd / fade : 1)
  }
  const out = path.join(OUT, name)
  const enc = spawnSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', out], { input: Buffer.from(x.buffer) })
  if (enc.status !== 0) throw new Error(String(enc.stderr))
  console.log(`${name}  ${Math.round((x.length / SR) * 1000)} ms  gain ${(20 * Math.log10(gain)).toFixed(1)} dB`)
}
