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
//   --audio-report            Inject audio-probe.js before app scripts; print whether playback actually
//                             produced sound (verdict OK / SILENT / NO AUDIO ATTEMPTED). Exit 1 on SILENT.
//                             Chrome here proves the app's own plumbing; it says nothing about Safari
//                             codec support — for that use webkit.mjs, and ultimately a real device.
//   (console errors + page exceptions are ALWAYS captured and summarised at the end.)
//
// Behaviour:
//   --port <n>                CDP debug port (default 9333).
//
// Performance (the owner's floor device is an iPad Pro 2nd gen / A10X, 2017, on iPadOS 17.7):
//   --cpu-throttle <n>        CDP CPU throttling multiplier (4 ≈ A10X-ish vs this desktop; 6 = harsher).
//                             An APPROXIMATION of a slow CPU, NOT a model of that iPad: it scales CPU
//                             only — GPU, memory bandwidth, decode and Safari's own JIT are untouched.
//   --perf                    Collect long tasks, LCP, CLS, frame times + JS heap and print a summary.
//                             Combine with --cpu-throttle to see what the handicap actually costs.
//
// Notes:
//  * Launches with --autoplay-policy=no-user-gesture-required, so audio is unlocked from the start and
//    the app's "Tryk for lyd" cue never appears. There is NOTHING to dismiss any more: the blocking
//    "Tænd for lyd" modal is gone (Audio activation PRD-01), and `--keep-audio-modal` went with it.
//    To exercise the cue on purpose, block autoplay instead — `--block-autoplay`.
//  * Clicks use element.click() (NOT synthetic mouse coords — MUI ignores those).
//  * Exit code is non-zero if a --wait-for / click target never appears, so failures are loud.
//  * Run dev servers FIRST in Windows PowerShell (not WSL): `npm run dev` + `npm run dev:api`.

import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// `--block-autoplay` flips the ONE launch flag that makes the app's audio verdict reach `blocked`:
// every `play()` then rejects with NotAllowedError until a real gesture happens, which is what the
// "Tryk for lyd" cue keys on (Audio activation PRD-01 §5.1). Without it Chrome unlocks audio at launch
// and the cue is correctly never shown — so a cue-absence assertion under the default flag proves the
// cue does not appear spuriously, and only this flag proves it appears when it should.
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  has('--block-autoplay') ? '--autoplay-policy=document-user-activation-required'
                          : '--autoplay-policy=no-user-gesture-required',
  '--disable-gpu', `--window-size=${W},${H}`,
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
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

// --ipad-ua: run the app's iOS branches in CHROME. This is the only place audio can be verified on an
// iOS code path at all: Playwright's WebKit has no WebAudio/speechSynthesis, and Chrome does — so an
// iPad UA here exercises `deviceDetection`'s isIOS/isIPad, the unlock path and Howler's touch-platform
// html5 pool WHILE clips can still actually play. It is not Safari, and it is not the device.
if (has('--ipad-ua')) {
  const UA = 'Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
  await send('Emulation.setUserAgentOverride', { userAgent: UA, platform: 'iPad' })
  console.log('ua override: iPad / iPadOS 17.7')
}

// --webauthn: install a CDP VIRTUAL AUTHENTICATOR before the page loads, so passkey register/unlock
// can be exercised headlessly (accounts PRD §12). It proves the real plumbing — options endpoint,
// navigator.credentials.*, verification, the set-auth-token handoff — but it does NOT prove the iOS
// gesture rule (activation is consumed across an `await`); only the real iPad can.
if (has('--webauthn')) {
  await send('WebAuthn.enable', { enableUI: false })
  const { result: auth } = await send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  console.log(`virtual authenticator: ${auth?.authenticatorId ?? 'FAILED'}`)
}

// The probe must be installed BEFORE app scripts run — it patches HTMLMediaElement.play and
// decodeAudioData, and ttsClient's first clip can be in flight within a few hundred ms of mount.
if (has('--audio-report')) {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'audio-probe.js'), 'utf8')
  await send('Page.addScriptToEvaluateOnNewDocument', { source })
}

// Perf collectors must also predate the app: LCP and long-task entries are not buffered forever, and a
// PerformanceObserver installed after mount misses exactly the expensive startup we care about.
if (has('--perf')) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){window.__perf={long:[],lcp:0,cls:0,frames:[]};
      try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__perf.long.push(Math.round(e.duration))})}).observe({type:'longtask',buffered:true})}catch(e){}
      try{new PerformanceObserver(function(l){var es=l.getEntries();window.__perf.lcp=Math.round(es[es.length-1].startTime)}).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
      try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(!e.hadRecentInput)window.__perf.cls+=e.value})}).observe({type:'layout-shift',buffered:true})}catch(e){}
      var last=0;function tick(t){if(last)window.__perf.frames.push(t-last);last=t;requestAnimationFrame(tick)}requestAnimationFrame(tick);})()`,
  })
}

const CPU = parseFloat(opt('--cpu-throttle', '0'))
if (CPU > 1) {
  await send('Emulation.setCPUThrottlingRate', { rate: CPU })
  console.log(`cpu throttle: ${CPU}x`)
}

await send('Page.navigate', { url: URL })

// Readiness gate: wait for the SPA to mount (default), unless an explicit fixed --wait is given.
if (has('--wait')) await sleep(FIXED_WAIT)
else await waitFor('!!document.querySelector("#root") && document.querySelector("#root").children.length>0', 'app mount (#root)')
await sleep(SETTLE)

// (Nothing to dismiss here any more — the blocking audio modal is gone. See the Notes at the top.)

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
  // JPEG when the output path is .jpg/.jpeg (matches docs/ui-reference baseline); else PNG.
  const isJpeg = /\.jpe?g$/i.test(OUT)
  let params = isJpeg ? { format: 'jpeg', quality: parseInt(opt('--quality', '85'), 10) } : { format: 'png' }
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

if (has('--perf')) {
  const p = await evaluate(`(()=>{const t=performance.getEntriesByType('navigation')[0]||{};
    const fcp=(performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime||0;
    const f=(window.__perf&&window.__perf.frames||[]).slice(10); // drop warm-up frames
    const sorted=f.slice().sort((a,b)=>a-b);
    const long=(window.__perf&&window.__perf.long)||[];
    return JSON.stringify({
      fcp:Math.round(fcp), lcp:(window.__perf||{}).lcp||0,
      domReady:Math.round(t.domContentLoadedEventEnd||0), load:Math.round(t.loadEventEnd||0),
      cls:+(((window.__perf||{}).cls)||0).toFixed(3),
      longTasks:long.length, longTotalMs:long.reduce((a,b)=>a+b,0), longWorstMs:long.length?Math.max.apply(null,long):0,
      frames:f.length, medianFrameMs:sorted.length?+sorted[Math.floor(sorted.length/2)].toFixed(1):0,
      p95FrameMs:sorted.length?+sorted[Math.floor(sorted.length*0.95)].toFixed(1):0,
      jankFrames:f.filter(x=>x>50).length,
      heapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,
    })})()`)
  console.log('perf:', p)
}

if (has('--audio-report')) {
  const report = await evaluate('window.__audioProbe ? JSON.stringify(window.__audioProbe.report()) : null')
  if (!report) {
    console.error('audio: probe missing (addScriptToEvaluateOnNewDocument did not run)')
    exitCode = 1
  } else {
    const r = JSON.parse(report)
    console.log('audio verdict:', r.verdict)
    console.log('audio formats:', JSON.stringify(r.formats))
    console.log('audio media:', JSON.stringify(r.media))
    console.log('audio webaudio:', JSON.stringify(r.webaudio))
    if (r.notes.length) console.log('audio notes:', JSON.stringify(r.notes))
    if (/^SILENT/.test(r.verdict)) exitCode = 1
  }
}

console.log(`console errors: ${consoleErrors.length}${consoleErrors.length ? ' ' + JSON.stringify(consoleErrors.slice(0, 5)) : ''}`)
console.log(`page exceptions: ${exceptions.length}${exceptions.length ? ' ' + JSON.stringify(exceptions.slice(0, 5)) : ''}`)

ws.close(); chrome.kill(); await sleep(200)
process.exit(exitCode)
