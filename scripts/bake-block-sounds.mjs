// Byggeklodser's sounds (Krea PRD-03 §4.9) — synthesised foley, nothing to license. Owner, 2026-11-06:
// "natural and in line with a game like this", and "it's okay if they are subtle so they don't get
// annoying". So every cue is short, soft and levelled QUIET (RMS targets below the answer cues).
//
//   node scripts/bake-block-sounds.mjs             → bakes the PICKED cues into public/sounds/ui/
//   node scripts/bake-block-sounds.mjs --audition  → bakes every candidate + an audition page into
//                                                   public/audition-blocks/ (NOT committed; delete after)
//
// The DSP is plain JS (seeded noise, one-pole/biquad filters, envelopes), so a re-run is byte-stable.
// Encoding is mono 44.1 kHz MP3 via ffmpeg-static — MP3 only, no Ogg before iPadOS 18.4.

import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SR = 44100

// ----- tiny DSP kit ---------------------------------------------------------------------------------------
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1
const buf = (ms) => new Float32Array(Math.round((ms / 1000) * SR))
const t = (i) => i / SR
/** Attack-then-exponential-decay envelope. */
const env = (i, attackMs, decay) => {
  const s = t(i)
  const a = attackMs / 1000
  return (s < a ? s / a : 1) * Math.exp(-decay * Math.max(0, s - a))
}
/** RBJ biquad, in place. type: 'lp' | 'bp' | 'hp'. `f` may be a function of the sample index (a sweep). */
const biquad = (x, type, f, q = 0.7) => {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const w = (2 * Math.PI * (typeof f === 'function' ? f(i) : f)) / SR
    const al = Math.sin(w) / (2 * q)
    const cw = Math.cos(w)
    let b0, b1, b2
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2 }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2 }
    else { b0 = al; b1 = 0; b2 = -al }
    const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al
    const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y
    x[i] = y
  }
  return x
}
const mix = (...parts) => {
  const n = Math.max(...parts.map((p) => p.length))
  const out = new Float32Array(n)
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i]
  return out
}
const delay = (x, ms, gain = 1) => {
  const d = Math.round((ms / 1000) * SR)
  const out = new Float32Array(x.length + d)
  for (let i = 0; i < x.length; i++) out[i + d] = x[i] * gain
  return out
}
/** A decaying sine, optionally gliding from f0 to f1. */
const tone = (ms, f0, f1, attackMs, decay, amp = 1) => {
  const x = buf(ms)
  let ph = 0
  for (let i = 0; i < x.length; i++) {
    const f = f0 + (f1 - f0) * Math.min(1, t(i) / (ms / 1000))
    ph += (2 * Math.PI * f) / SR
    x[i] = amp * Math.sin(ph) * env(i, attackMs, decay)
  }
  return x
}
/** A shaped noise burst. */
const noise = (ms, seed, attackMs, decay, amp = 1) => {
  const r = seeded(seed)
  const x = buf(ms)
  for (let i = 0; i < x.length; i++) x[i] = amp * r() * env(i, attackMs, decay)
  return x
}

// ----- the candidates -------------------------------------------------------------------------------------
// A clay/wood toy block set down: a short muffled knock with a little body.
const clayTock = (pitch = 210, seed = 7) =>
  mix(biquad(noise(70, seed, 0.6, 90, 0.9), 'lp', 1300, 0.8), tone(110, pitch, pitch * 0.92, 1.2, 38, 0.55))
// A wooden block: brighter knock with a hollow resonance.
const woodKnock = (seed = 11) =>
  mix(biquad(noise(40, seed, 0.3, 160, 0.9), 'bp', 2400, 1.4), biquad(noise(120, seed + 1, 0.5, 45, 1.4), 'bp', 880, 9))
// A soft thud: low body falling in pitch, almost no click.
const softThud = (seed = 3) => mix(tone(120, 150, 95, 3, 30, 0.9), biquad(noise(40, seed, 1, 120, 0.25), 'lp', 900, 0.7))
// An airy "poof": noise swept down through a band, soft attack.
const poof = (ms = 220, seed = 21) => {
  const n = noise(ms, seed, 25, 16, 1)
  return biquad(n, 'bp', (i) => 1800 * Math.exp(-3.2 * t(i)) + 350, 1.1)
}
const puff = (seed = 23) => biquad(noise(140, seed, 12, 28, 1), 'lp', 700, 0.7)
// A gentle "not there": two soft knocks, the second lower and quieter (a little bounce).
const bounce = (seed = 31) => mix(clayTock(230, seed), delay(clayTock(185, seed + 4), 105, 0.55))
const boing = () => {
  const x = buf(180)
  let ph = 0
  for (let i = 0; i < x.length; i++) {
    const f = 300 - 90 * Math.min(1, t(i) / 0.18) + 8 * Math.sin(2 * Math.PI * 22 * t(i))
    ph += (2 * Math.PI * f) / SR
    x[i] = 0.8 * Math.sin(ph) * env(i, 4, 22)
  }
  return x
}

// role → candidates. `src` is either synthesised samples or an existing shipped cue (for comparison).
const CANDIDATES = {
  'block-place': [
    { id: 'place-1-leretok', label: 'Ler-tok (blød klods)', make: () => clayTock(), rms: -27 },
    { id: 'place-2-traeklods', label: 'Træklods (lys)', make: () => woodKnock(), rms: -29 },
    { id: 'place-3-dump', label: 'Blødt dump', make: () => softThud(), rms: -26 },
    { id: 'place-4-leretok-lav', label: 'Ler-tok (dybere)', make: () => clayTock(160, 9), rms: -27 },
    { id: 'place-5-perle', label: 'Nuværende (perle)', file: 'public/sounds/ui/bead-place.mp3' },
    { id: 'place-6-kasse', label: 'Kasse (Kenney træ)', file: 'public/sounds/ui/box-land.mp3' },
  ],
  'block-remove': [
    { id: 'remove-1-puf', label: 'Puf (luftig)', make: () => poof(), rms: -30 },
    { id: 'remove-2-kort-puf', label: 'Kort puf', make: () => puff(), rms: -30 },
    { id: 'remove-3-puf-lang', label: 'Puf (længere)', make: () => poof(320, 25), rms: -31 },
    { id: 'remove-4-viskelaeder', label: 'Nuværende (viskelæder)', file: 'public/sounds/ui/krea-undo.mp3' },
  ],
  'block-back': [
    { id: 'back-1-hop', label: 'Lille hop (to tok)', make: () => bounce(), rms: -29 },
    { id: 'back-2-boing', label: 'Blød boing', make: () => boing(), rms: -30 },
    { id: 'back-3-perle', label: 'Nuværende (perle tilbage)', file: 'public/sounds/ui/bead-back.mp3' },
  ],
}

/** The owner's picks (filled in after the audition). Until then the game keeps its borrowed cues. */
const PICKS = {}

// ----- level + encode (the bake-ui-sounds shape) --------------------------------------------------------
const level = (x, targetDb) => {
  const thr = 10 ** (-55 / 20)
  let first = 0, last = x.length - 1
  while (first < x.length && Math.abs(x[first]) < thr) first++
  while (last > first && Math.abs(x[last]) < thr) last--
  x = x.slice(Math.max(0, first - 22), last + 1)
  let sum = 0, peak = 0
  for (const v of x) { sum += v * v; peak = Math.max(peak, Math.abs(v)) }
  const gain = Math.min(10 ** (targetDb / 20) / Math.sqrt(sum / x.length), 10 ** (-3 / 20) / peak)
  const fade = Math.min(441, x.length)
  for (let i = 0; i < x.length; i++) x[i] *= gain * (x.length - 1 - i < fade ? (x.length - 1 - i) / fade : 1)
  return x
}
const encode = (x, out) => {
  const enc = spawnSync(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', out], { input: Buffer.from(x.buffer) })
  if (enc.status !== 0) throw new Error(String(enc.stderr))
}

if (process.argv.includes('--audition')) {
  const dir = path.join(ROOT, 'public', 'audition-blocks')
  mkdirSync(dir, { recursive: true })
  const rows = []
  for (const [role, list] of Object.entries(CANDIDATES)) {
    rows.push(`<h2>${role === 'block-place' ? 'Sæt en klods' : role === 'block-remove' ? 'Viskelæder (fjern en klods)' : 'Klodsen kan ikke være der'}</h2>`)
    for (const c of list) {
      const file = `${c.id}.mp3`
      if (c.file) copyFileSync(path.join(ROOT, c.file), path.join(dir, file))
      else encode(level(c.make(), c.rms), path.join(dir, file))
      rows.push(`<button onclick="play('${file}')"><b>${c.id.split('-')[1]}</b> ${c.label}</button>`)
    }
  }
  writeFileSync(
    path.join(dir, 'index.html'),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Byggeklodser lyde</title>
<style>body{font-family:system-ui;background:#FBF7F0;margin:20px;color:#3a2a1a}h2{margin:28px 0 10px}button{display:block;width:100%;max-width:520px;margin:8px 0;padding:18px;font-size:18px;text-align:left;border-radius:14px;border:0;background:#fff;box-shadow:0 2px 6px #0002}b{display:inline-block;width:2em}</style>
<h1>Byggeklodser — vælg lyde</h1><p>Tryk flere gange: det er sådan barnet hører dem. Skriv numrene du kan lide (fx sæt 1, fjern 2, kan-ikke 1).</p>
${rows.join('\n')}
<script>const cache={};function play(f){const a=cache[f]||(cache[f]=new Audio(f));a.currentTime=0;a.play()}</script>`,
  )
  console.log(`audition: ${dir}`)
} else {
  for (const [role, id] of Object.entries(PICKS)) {
    const c = CANDIDATES[role].find((k) => k.id === id)
    const out = path.join(ROOT, 'public', 'sounds', 'ui', `${role}.mp3`)
    if (c.file) copyFileSync(path.join(ROOT, c.file), out)
    else encode(level(c.make(), c.rms), out)
    console.log(`${role}.mp3 ← ${id}`)
  }
  if (!Object.keys(PICKS).length) console.log('no picks yet — run with --audition first')
}
