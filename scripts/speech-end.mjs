// Where the SPEECH ends inside a prebaked clip (ms from the file's start), measured with ffmpeg's
// silencedetect — the same tool behind the DWELL_* numbers in src/theme/motion.ts.
//
// Why: Azure pads every clip with silence, and the trailing pad VARIES (measured 0.35–1.06 s over 60
// clips, 2026-11-07), so neither the file length nor a fixed dwell says when the words are over. Games
// cut long lines off ("Hvad mangler"'s sequence read-back) by advancing on a fixed dwell. The prebake
// records each clip's speech end; ttsClient turns it into "how much of the current line is still to
// come", and a game's advance waits that out (never awaiting the audio itself — audio-system.md step 8).
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

/** -35 dBFS ≈ the 0.02 peak threshold the in-browser checks used; 150 ms ignores breaths between words. */
const NOISE = '-35dB'
const MIN_SILENCE = 0.15

export function measureSpeechEnd(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, ['-hide_banner', '-nostats', '-i', file, '-af', `silencedetect=noise=${NOISE}:d=${MIN_SILENCE}`, '-f', 'null', '-'])
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', () => {
      const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(err)
      if (!dur) return reject(new Error(`no duration for ${file}`))
      const total = (+dur[1] * 3600 + +dur[2] * 60 + +dur[3]) * 1000
      const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1] * 1000)
      const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1] * 1000)
      // The trailing pad is a silence that starts and never ends (or ends at the file's end).
      const last = starts[starts.length - 1]
      const trailing = last !== undefined && (ends.length < starts.length || ends[ends.length - 1] >= total - 30)
      resolve(Math.round(trailing ? last : total))
    })
  })
}
