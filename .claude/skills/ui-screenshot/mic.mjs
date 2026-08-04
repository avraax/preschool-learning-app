// End-to-end MIC probe (rung 1½). Drives the REAL app in Chrome with a FAKE MICROPHONE fed real Danish
// audio, through the real press gesture, the real MediaRecorder and the real /api/stt.
//
//   node --env-file=.env.local --import ./scripts/js-to-ts-resolve.mjs \
//     .claude/skills/ui-screenshot/mic.mjs [word ...] [--viewport=ipad|all] [--child] [--hold=150]
//
//   words      any word with a prebaked clip (kat, hund, sol, fisk …); the pseudo-word `stille` feeds
//              SILENCE, which must reach the game's friendly retry rather than hang
//   --child    pitch up ~40% at the same speed, quieter, rushed — a PROXY for a 5–7 year old, not a
//              child. Whether the Danish sounds right to a real ear is still rung 3.
//   --hold=ms  press duration; below MIN_PRESS_MS this must produce the spoken "hold the button" coach
//   --viewport ipad · ipad-portrait · phone · phone-landscape · all
//
// What it proves that nothing else can: capture actually starts when the UI claims to be listening, the
// level meter is driven by REAL audio (a word swings the bars to ~0.97, silence leaves them at the 0.35
// idle — the synthetic fallback would swing on silence too), the container Safari/Chrome each produce is
// accepted, the recognizer's answer survives normalization, and "Lad mig tænke…" is never terminal.
//
// Chrome flags do the heavy lifting: --use-fake-device-for-media-stream replaces the mic with a WAV
// file (looped), --use-fake-ui-for-media-stream auto-grants permission. cdp.mjs can't pass extra flags,
// hence this one-off launcher.
//
// FOUR outcomes per run, never two: PASS (spelled the right word), MISHEARD (spelled another word),
// NOT_HEARD (the game's own retry line — a legitimate product state), UNKNOWN (the probe failed).
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import ffmpegPath from 'ffmpeg-static'
import { TTS_CONFIG } from '../../../shared-tts-config.js'
import { ttsCacheKey } from '../../../shared-tts-key.js'
import { PREBAKED_TTS } from '../../../src/config/prebakedTts.ts'

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9337
const OUT = path.join(os.tmpdir(), 'bl-mic-probe')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const DA = TTS_CONFIG.voices.primary
const clipFor = (text) => {
  const f = PREBAKED_TTS[ttsCacheKey({ name: DA.name, lang: DA.lang, rate: TTS_CONFIG.speakingRate, useLexicon: true, text })]
  return f ? path.join('public', 'sounds', 'tts', f) : null
}

// A fake-capture file must be 16-bit PCM WAV. Chrome LOOPS it, so pad to ~2.6s with the word in the
// middle: whatever moment the recording starts, it contains one clean, whole utterance.
const makeFakeMic = (word, distortion) => {
  const dst = path.resolve(OUT, `mic-${word}${distortion ? '-d' : ''}.wav`)
  // The pseudo-word "stille" feeds SILENCE: the game must reach its own friendly retry, not hang.
  if (word === 'stille') {
    const r = spawnSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '2.6',
      '-c:a', 'pcm_s16le', dst], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error((r.stderr || '').slice(-300))
    return dst
  }
  const src = clipFor(word)
  if (!src) throw new Error(`no prebaked clip for "${word}"`)
  // `--child` approximates a 5-7 year old: pitch up ~40% at the same speed, quieter, slightly rushed.
  // A PROXY for a child, not a child — the real ear test stays with the owner.
  const filter = distortion
    ? 'asetrate=24000*1.40,aresample=48000,atempo=1/1.40,volume=-10dB,atempo=1.15,adelay=500|500,apad=whole_dur=2.6'
    : 'adelay=500|500,apad=whole_dur=2.6,aresample=48000'
  const r = spawnSync(ffmpegPath, ['-y', '-i', src, '-af', filter, '-ac', '1', '-c:a', 'pcm_s16le', dst], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error((r.stderr || '').slice(-300))
  return dst
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cdp(word, wavPath, viewport) {
  const profile = path.join(os.tmpdir(), `mic-e2e-${Date.now()}`)
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${wavPath}`,
    `--window-size=${viewport.w},${viewport.h}`,
    'about:blank',
  ], { stdio: 'ignore' })

  let ws, target
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page')
      if (target) break
    } catch { /* not up yet */ }
    await sleep(250)
  }
  if (!target) { chrome.kill(); throw new Error('Chrome never exposed a page target') }

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  const logs = []
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      logs.push(`${msg.params.type}: ${(msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)}`)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push(`exception: ${msg.params.exceptionDetails?.exception?.description?.slice(0, 300) ?? '?'}`)
    }
  }
  const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })) })

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: viewport.w, height: viewport.h, deviceScaleFactor: 1, mobile: !!viewport.mobile })
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/ordleg/mic?nogate=1' })
  await sleep(4000)

  const script = readFileSync(new URL('./mic-page.js', import.meta.url), 'utf8')
  const holdMs = process.argv.find((a) => a.startsWith('--hold='))?.split('=')[1]
  const prelude = holdMs ? `window.__HOLD_MS=${Number(holdMs)};\n` : ''
  const result = await send('Runtime.evaluate', { expression: prelude + script, awaitPromise: true, returnByValue: true })
  const value = result.result?.result?.value
  ws.close()
  chrome.kill()
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  return { value, logs }
}

const VIEWPORTS = {
  ipad: { w: 1024, h: 768, mobile: true },
  'ipad-portrait': { w: 768, h: 1024, mobile: true },
  phone: { w: 390, h: 844, mobile: true },
  'phone-landscape': { w: 844, h: 390, mobile: true },
}

const words = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const vpArg = process.argv.find((a) => a.startsWith('--viewport='))?.split('=')[1] ?? 'ipad'
const list = words.length ? words : ['kat']

const childMode = process.argv.includes('--child')
for (const word of list) {
  const wav = makeFakeMic(word, childMode)
  for (const vpName of vpArg === 'all' ? Object.keys(VIEWPORTS) : [vpArg]) {
    let out
    try {
      out = await cdp(word, wav, VIEWPORTS[vpName])
    } catch (e) {
      console.log(`\n### ${word} @ ${vpName}: UNKNOWN (probe) — ${e.message}`)
      continue
    }
    const v = out.value
    console.log(`\n### said "${word}" @ ${vpName}`)
    if (!v) { console.log('  UNKNOWN (probe) — page script returned nothing'); continue }
    console.log(`  verdict     : ${v.verdict}${v.heard ? ` — spelled "${v.heard}"` : ''}`)
    console.log(`  orb         : ${v.orb ? `${v.orb.w}x${v.orb.h} px, hit-target ${v.hitTarget ? 'OK' : 'MISS'} (${v.hitAt})` : 'NOT FOUND'}`)
    console.log(`  status trail: ${(v.trail || []).join(' → ')}`)
    console.log(`  mic level   : ${v.levels ? `max bar scale ${v.levels.max} (idle 0.35), samples ${v.levels.samples}` : 'n/a'}`)
    console.log(`  timings     : press→listening ${v.tListen ?? '?'}ms, release→result ${v.tResult ?? '?'}ms`)
    if (v.centring) console.log(`  centring    : ${v.centring.content}px of content in a ${v.centring.body}px body — ${v.centring.above}px above, ${v.centring.below}px below (equal = centred)`)
    if (v.overflow) console.log(`  reveal fit  : ${v.overflow.aboveViewport === 0 && v.overflow.belowViewport === 0 ? 'no overflow' : `OVERFLOW ${v.overflow.aboveViewport}px above / ${v.overflow.belowViewport}px below the viewport`}`)
    if (v.rec?.length) console.log(`  recorder    : ${v.rec.map((e) => `${e.event}${e.size !== undefined ? `(${e.size}B)` : ''}${e.mime ? `(${e.mime})` : ''}`).join(' → ')}`)
    console.log(`  /api/stt    : ${v.stt?.length ? v.stt.map((e) => JSON.stringify(e)).join(' → ') : 'NEVER CALLED'}`)
    if (v.notes?.length) console.log(`  notes       : ${v.notes.join(' | ')}`)
    if (out.logs.length) console.log(`  console     : ${out.logs.slice(0, 6).join(' | ')}`)
  }
}
