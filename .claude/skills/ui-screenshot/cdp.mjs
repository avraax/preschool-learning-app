// Zero-dependency headless-Chrome driver via the Chrome DevTools Protocol (CDP).
// Node 22+ only (global WebSocket + fetch). Drives the LOCAL dev app to screenshot/measure UI.
//
// Usage:
//   node .claude/skills/ui-screenshot/cdp.mjs --url <url> [options]
//
// Core:
//   --url <url>               Page to open (required). e.g. http://127.0.0.1:5173/alphabet/quiz
//   --out <file>              Save a PNG screenshot here.
//   --w <px> --h <px>         Viewport (default 540x940, phone-ish portrait).
//
// Waiting (prefer these over fixed sleeps — faster + far more reliable):
//   --wait-for "<css>"        Block until the selector exists (then proceed). Repeatable.
//   --wait-for-text "<txt>"   Block until some element's text contains txt.
//   --timeout <ms>            Max wait for any --wait-for / pre-click wait (default 10000).
//   --settle <ms>             Extra pause after readiness before acting/shooting (default 500).
//   --wait <ms>               Fallback fixed wait used ONLY when no --wait-for* is given (default 3000).
//
// Interaction (clicks auto-wait for their selector first, so no manual sleeps needed):
//   --click "<css>"           element.click() the first match (repeatable, in order).
//   --click-text "<txt>"      Click the first <button> whose text contains txt (repeatable).
//   --type "<css>::<text>"    Focus a field and type text (repeatable).
//
// Output / verification:
//   --measure "<s1,s2>"       Print getBoundingClientRect {l,r,t,b} per selector (catch overflow/clipping).
//   --clip "<css>"            Screenshot ONLY that element (tight crop + small padding).
//   --full-page               Full scrollable-page screenshot (instead of viewport).
//   --eval "<js>"             Evaluate JS in the page; print the returned value.
//   (console errors + page exceptions are ALWAYS captured and summarised at the end.)
//
// Behaviour:
//   --keep-audio-modal        Do NOT auto-dismiss the "Tænd for lyd" permission modal.
//   --port <n>                CDP debug port (default 9333).
//
// Notes:
//  * Launches with --autoplay-policy=no-user-gesture-required so the audio modal usually never
//    shows; also clicks "Start lyd nu" as a fallback unless --keep-audio-modal.
//  * Clicks use element.click() (NOT synthetic mouse coords — MUI ignores those).
//  * Exit code is non-zero if a --wait-for / click target never appears, so failures are loud.
//  * Run dev servers FIRST in Windows PowerShell (not WSL): `npm run dev` + `npm run dev:api`.

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const all = (name) => args.reduce((acc, a, i) => (a === name ? [...acc, args[i + 1]] : acc), [])
const has = (name) => args.includes(name)

const URL = opt('--url')
if (!URL) { console.error('Missing --url'); process.exit(2) }
const W = parseInt(opt('--w', '540'), 10)
const H = parseInt(opt('--h', '940'), 10)
const TIMEOUT = parseInt(opt('--timeout', '10000'), 10)
const SETTLE = parseInt(opt('--settle', '500'), 10)
const FIXED_WAIT = parseInt(opt('--wait', '3000'), 10)
const OUT = opt('--out')
const PORT = parseInt(opt('--port', '9333'), 10)
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let exitCode = 0

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--disable-gpu', `--window-size=${W},${H}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, 'about:blank',
], { stdio: 'ignore' })

async function getJSON(path) {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}${path}`); if (r.ok) return r.json() } catch {}
    await sleep(250)
  }
  throw new Error('Chrome DevTools endpoint not ready')
}

const ver = await getJSON('/json/version')
const ws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

let id = 1
const pending = new Map()
let sessionId = null
const consoleErrors = []
const exceptions = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value || a.description || a.unserializableValue || '').join(' ').slice(0, 200))
  }
  if (m.method === 'Runtime.exceptionThrown') {
    exceptions.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 200))
  }
}
const send = (method, params = {}, sid = sessionId) => {
  const i = id++
  const p = { id: i, method, params }
  if (sid) p.sessionId = sid
  return new Promise((r) => { pending.set(i, r); ws.send(JSON.stringify(p)) })
}
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  return r.result?.result?.value
}
async function waitFor(expr, label) {
  const start = Date.now()
  while (Date.now() - start < TIMEOUT) {
    if (await evaluate(expr)) return true
    await sleep(150)
  }
  console.error(`TIMEOUT waiting for ${label}`)
  exitCode = 1
  return false
}
const waitForSelector = (sel) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, `selector ${sel}`)
const waitForText = (txt) => waitFor(`[...document.querySelectorAll('*')].some(e=>e.children.length===0&&(e.textContent||'').includes(${JSON.stringify(txt)}))`, `text "${txt}"`)

const { result: tgt } = await send('Target.createTarget', { url: 'about:blank' }, null)
sessionId = (await send('Target.attachToTarget', { targetId: tgt.targetId, flatten: true }, null)).result.sessionId
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: URL })

// Readiness gate: wait for the SPA to mount (default), unless an explicit fixed --wait is given.
if (has('--wait')) await sleep(FIXED_WAIT)
else await waitFor('!!document.querySelector("#root") && document.querySelector("#root").children.length>0', 'app mount (#root)')
await sleep(SETTLE)

if (!has('--keep-audio-modal')) {
  await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Start lyd nu/i.test(x.textContent||''));if(b){b.click();return true}return false})()`)
  await sleep(300)
}

for (const sel of all('--click')) {
  if (await waitForSelector(sel)) {
    const ok = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e){e.click();return true}return false})()`)
    console.log(`click ${sel}: ${ok ? 'ok' : 'NOT FOUND'}`)
    if (!ok) exitCode = 1
    await sleep(SETTLE)
  }
}
for (const txt of all('--click-text')) {
  const ok = await evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes(${JSON.stringify(txt)}));if(e){e.click();return true}return false})()`)
  console.log(`click-text "${txt}": ${ok ? 'ok' : 'NOT FOUND'}`)
  if (!ok) exitCode = 1
  await sleep(SETTLE)
}
for (const spec of all('--type')) {
  const [sel, ...rest] = spec.split('::')
  const text = rest.join('::')
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e){e.focus();e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}})()`)
  await sleep(200)
}

// Post-interaction waits: gate on UI that a click/type produced (e.g. an opened popover) before
// measuring/screenshotting.
for (const s of all('--wait-for')) await waitForSelector(s)
for (const t of all('--wait-for-text')) await waitForText(t)
if (all('--wait-for').length || all('--wait-for-text').length) await sleep(SETTLE)

const measure = opt('--measure')
if (measure) {
  const sels = JSON.stringify(measure.split(',').map((s) => s.trim()).filter(Boolean))
  const out = await evaluate(`(()=>{const sels=${sels};const rc=e=>{const r=e.getBoundingClientRect();return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom)}};return JSON.stringify(sels.map(s=>({sel:s,rect:(()=>{const e=document.querySelector(s);return e?rc(e):null})()})))})()`)
  console.log('measure:', out)
}

const ev = opt('--eval')
if (ev) console.log('eval:', await evaluate(ev))

if (OUT) {
  const clipSel = opt('--clip')
  let params = { format: 'png' }
  if (clipSel) {
    const rect = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(clipSel)});if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify({x:r.left,y:r.top,w:r.width,h:r.height})})()`)
    if (rect) {
      const r = JSON.parse(rect)
      const pad = 8
      params.clip = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 }
    } else { console.error(`--clip selector not found: ${clipSel}`); exitCode = 1 }
  } else if (has('--full-page')) {
    params.captureBeyondViewport = true
  }
  const { result } = await send('Page.captureScreenshot', params)
  writeFileSync(OUT, Buffer.from(result.data, 'base64'))
  console.log(`screenshot saved: ${OUT}`)
}

console.log(`console errors: ${consoleErrors.length}${consoleErrors.length ? ' ' + JSON.stringify(consoleErrors.slice(0, 5)) : ''}`)
console.log(`page exceptions: ${exceptions.length}${exceptions.length ? ' ' + JSON.stringify(exceptions.slice(0, 5)) : ''}`)

ws.close(); chrome.kill(); await sleep(200)
process.exit(exitCode)
