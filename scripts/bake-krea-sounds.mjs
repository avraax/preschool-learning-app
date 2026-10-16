// Synthesise Krea's studio tool sounds (Krea PRD-01 §2.3.14) into MP3 cues — no external source, so
// nothing to license and nothing to download. Re-run to regenerate:
//
//   node scripts/bake-krea-sounds.mjs
//
// Each cue is an ffmpeg lavfi graph (noise, sines and envelopes), levelled to a target loudness with
// a two-pass measure → gain, mono, 44.1 kHz MP3. MP3 only: no Ogg before iPadOS 18.4. The final level is
// set by `CUE_VOLUME` in sfxClient (WebAudio gain, which iOS honours).
//
// These are a FIRST PASS for the owner's iPad look-and-feel sign-off (W3) — if a cue sounds cheap, swap
// in a recorded one and log its licence in art-src/sfx/SOURCES.md; the cue NAME stays.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'sounds', 'ui')

const SR = 44100
// One decaying sine partial: amplitude a, frequency f, starting at t0, decay rate k (per second).
const ping = (a, f, t0, k) => `${a}*gte(t,${t0})*exp(-${k}*(t-${t0}))*sin(2*PI*${f}*(t-${t0}))`

const CUES = {
  // A wax crayon on paper: pink noise in the scratch band, pulsed at 10 Hz like short strokes. LOOPED
  // while the finger moves, so it has no fades — 1.2 s is exactly 12 tremolo periods, no seam.
  'krea-crayon': {
    lufs: -30,
    graph: `anoisesrc=color=pink:sample_rate=${SR}:duration=1.2:seed=7,highpass=f=900,lowpass=f=5200,tremolo=f=10:d=0.55`,
  },
  // Rainbow: a quick rising glassy arpeggio.
  'krea-shimmer': {
    lufs: -26,
    graph: `aevalsrc='${[ping(0.5, 1568, 0, 7), ping(0.45, 2093, 0.07, 7), ping(0.4, 2637, 0.14, 7), ping(0.35, 3136, 0.21, 6)].join('+')}':s=${SR}:d=0.75`,
  },
  // Glitter: a handful of tiny high pings.
  'krea-twinkle': {
    lufs: -27,
    graph: `aevalsrc='${[ping(0.4, 3520, 0, 18), ping(0.3, 4699, 0.06, 20), ping(0.35, 3951, 0.13, 18), ping(0.28, 5274, 0.2, 22), ping(0.3, 4186, 0.27, 18)].join('+')}':s=${SR}:d=0.6`,
  },
  // A rubber stamp landing: a soft low thump plus a muffled tap.
  'krea-stamp': {
    lufs: -22,
    graph: `aevalsrc='${ping(0.9, 120, 0, 22)}+${ping(0.5, 240, 0, 35)}+0.25*exp(-90*t)*sin(2*PI*900*t)':s=${SR}:d=0.35`,
  },
  // Undo: a short soft whoosh (band-limited noise under a sine-bump envelope).
  'krea-undo': {
    lufs: -28,
    graph: `anoisesrc=color=pink:sample_rate=${SR}:duration=0.35:seed=3,bandpass=f=1400:w=1600,volume='sin(PI*t/0.35)':eval=frame`,
  },
  // New paper: a dry rustle — bright noise in quick irregular bursts.
  'krea-paper': {
    lufs: -27,
    graph: `anoisesrc=color=white:sample_rate=${SR}:duration=0.7:seed=11,highpass=f=2200,lowpass=f=9000,tremolo=f=19:d=0.8,volume='sin(PI*t/0.7)':eval=frame`,
  },
  // Picking a crayon: a small woody click.
  'krea-pick': {
    lufs: -26,
    graph: `aevalsrc='${ping(0.7, 660, 0, 45)}+${ping(0.35, 1320, 0, 60)}':s=${SR}:d=0.18`,
  },
  // Farvelæg's fill: a round "bloop" — a soft sine sliding up as it fades, like paint landing.
  'krea-fill': {
    lufs: -24,
    graph: `aevalsrc='0.8*exp(-13*t)*sin(2*PI*(240*t+900*t*t))+0.25*exp(-20*t)*sin(2*PI*(480*t+1800*t*t))':s=${SR}:d=0.32`,
  },
  // Perleplade (PRD-02): a bead lifted from the bowl — a bright glassy click.
  'bead-pick': {
    lufs: -26,
    graph: `aevalsrc='${ping(0.6, 2350, 0, 70)}+${ping(0.35, 3520, 0.004, 90)}':s=${SR}:d=0.12`,
  },
  // A bead pressed onto its peg: a soft, short plastic tick (lower, duller than the pick).
  'bead-place': {
    lufs: -25,
    graph: `aevalsrc='${ping(0.8, 820, 0, 85)}+0.3*exp(-160*t)*sin(2*PI*1900*t)':s=${SR}:d=0.1`,
  },
  // A bead going back to its bowl: a gentle little roll — three soft ticks falling in pitch. Never a
  // "wrong" sound: it is what a bead does when it rolls home (PRD-02 §2.4).
  'bead-back': {
    lufs: -28,
    graph: `aevalsrc='${[ping(0.5, 1250, 0, 60), ping(0.42, 1050, 0.07, 60), ping(0.34, 880, 0.15, 60)].join('+')}':s=${SR}:d=0.3`,
  },
  // A finished pattern popping off its pegs: a soft plastic pop, then a bouncy rising boing.
  'bead-popoff': {
    lufs: -23,
    graph: `aevalsrc='0.6*exp(-60*t)*sin(2*PI*520*t)+0.5*gte(t,0.06)*exp(-5*(t-0.06))*sin(2*PI*(260*(t-0.06)+700*(t-0.06)*(t-0.06)))*(1+0.4*sin(2*PI*9*t))':s=${SR}:d=0.75`,
  },
  // Done: a warm "ta-da" — a major chord, then the octave.
  'krea-tada': {
    lufs: -21,
    graph: `aevalsrc='${[ping(0.3, 523.25, 0, 3), ping(0.25, 659.25, 0, 3), ping(0.22, 783.99, 0, 3), ping(0.35, 1046.5, 0.32, 2.4), ping(0.18, 1318.5, 0.32, 2.6)].join('+')}':s=${SR}:d=1.6`,
  },
}

async function measure(graph) {
  const { stderr } = await run(ffmpegPath, ['-hide_banner', '-f', 'lavfi', '-i', `${graph},ebur128`, '-f', 'null', '-'], { maxBuffer: 1 << 26 })
  const m = [...stderr.matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g)].pop()
  if (!m) throw new Error('no loudness')
  return Number(m[1])
}

// ebur128's integrated loudness needs ≥ 400 ms of signal; a shorter cue reads as -70 (gated silence) and
// would be boosted ~+48 dB into clipping. Those are levelled by PEAK instead, to match the others' peaks.
const SHORT_PEAK_DB = -16
async function peak(graph) {
  const { stderr } = await run(ffmpegPath, ['-hide_banner', '-f', 'lavfi', '-i', `${graph},volumedetect`, '-f', 'null', '-'], { maxBuffer: 1 << 26 })
  const m = stderr.match(/max_volume:\s+(-?\d+(?:\.\d+)?) dB/)
  if (!m) throw new Error('no peak')
  return Number(m[1])
}

// `node scripts/bake-krea-sounds.mjs krea-fill` bakes just the named cues.
const only = process.argv.slice(2)
for (const [name, { graph, lufs }] of Object.entries(CUES).filter(([n]) => !only.length || only.includes(n))) {
  const integrated = await measure(graph)
  const gain = (integrated <= -69 ? SHORT_PEAK_DB - (await peak(graph)) : lufs - integrated).toFixed(2)
  const out = path.join(OUT, `${name}.mp3`)
  await run(ffmpegPath, ['-hide_banner', '-y', '-f', 'lavfi', '-i', `${graph},volume=${gain}dB,alimiter=limit=0.95,aformat=channel_layouts=mono`, '-ar', String(SR), '-c:a', 'libmp3lame', '-b:a', '96k', out])
  console.log(`${name}.mp3  gain ${gain} dB`)
}
