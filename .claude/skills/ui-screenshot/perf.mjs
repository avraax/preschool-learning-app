// Steady-state MAIN-THREAD + COMPOSITOR cost probe (zero-dependency CDP driver).
//
// Why this exists and not just `cdp.mjs --perf`: that one measures LOAD (FCP/LCP/long tasks) and its
// frame times are a software-raster artifact (see docs/device-testing.md). The thing that actually
// stutters on the owner's iPad Pro 2nd gen (A10X, 2017) is the app SITTING STILL — the persistent
// parallax world, the ambient field and the idle animations burning main-thread style recalculation
// every frame, plus a compositing-layer count whose textures don't fit that GPU's budget.
//
// So this measures a settled STEADY-STATE window and reports, per second:
//   • recalcStyle/s + recalcStyleMs/s   ← the number the parallax CSS-var driver moves
//   • layout/s + layoutMs/s
//   • scriptMs/s, taskMs/s → busy%      ← main-thread saturation; >~60% at 6x = visible stutter
//   • layers + layerMB                  ← compositor texture budget (scaled to the device's dpr)
//   • rAF median/p95 frame ms, jank
//
// These are all GPU-independent counters, so they are comparable run-to-run and A/B-able across a
// code change even in headless. They are a RELATIVE instrument: they rank screens and prove a fix
// moved the cost, they do not predict absolute fps on the device (rung 3 still owns that).
//
// Usage:
//   node .claude/skills/ui-screenshot/perf.mjs --url <url> [--w 1366] [--h 992] [--dpr 2]
//        [--cpu-throttle 6] [--window 5000] [--settle 2500] [--label home] [--json <file>]
//        [--click "<css>"]... [--wait-for "<css>"]...
//
// Defaults are the TARGET DEVICE: 1366x992 @ dpr 2 (iPad Pro 12.9" PWA landscape).
// Run against the HARNESS build (`npm run build:harness && npm run preview`) + `?nogate=1`,
// never the dev server.

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const all = (n) => args.reduce((a, x, i) => (x === n ? [...a, args[i + 1]] : a), [])
const has = (n) => args.includes(n)

const URL_ = opt('--url')
if (!URL_) { console.error('Missing --url'); process.exit(2) }
const W = parseInt(opt('--w', '1366'), 10)
const H = parseInt(opt('--h', '992'), 10)
const DPR = parseFloat(opt('--dpr', '2'))
const CPU = parseFloat(opt('--cpu-throttle', '0'))
const WINDOW = parseInt(opt('--window', '5000'), 10)
const SETTLE = parseInt(opt('--settle', '2500'), 10)
const LABEL = opt('--label', URL_.replace(/^https?:\/\/[^/]+/, '') || '/')
const JSONOUT = opt('--json')
const PORT = parseInt(opt('--port', '9344'), 10)
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// GPU is left ENABLED (unlike cdp.mjs) so the layer tree is built the way a real compositor builds
// it. Raster still may fall back to software on a headless box; that only affects frame times, which
// are reported but never the headline number.
const chromeArgs = [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required', '--mute-audio', `--window-size=${W},${H}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'perf-'))}`, 'about:blank',
]
const chrome = spawn(CHROME, chromeArgs, { stdio: 'ignore' })

async function getJSON(path) {
  for (let i = 0; i < 60; i++) {
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
const layerSnapshots = []
const consoleErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
  if (m.method === 'LayerTree.layerTreeDidChange' && m.params.layers) layerSnapshots.push(m.params.layers)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 160))
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
async function metrics() {
  const r = await send('Performance.getMetrics')
  const out = {}
  for (const { name, value } of r.result?.metrics ?? []) out[name] = value
  return out
}

const { result: tgt } = await send('Target.createTarget', { url: 'about:blank' }, null)
sessionId = (await send('Target.attachToTarget', { targetId: tgt.targetId, flatten: true }, null)).result.sessionId
await send('Page.enable'); await send('Runtime.enable'); await send('Performance.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false })

// ATTRIBUTION KNOBS. The point of the probe is not one number but a subtraction: run the same screen
// with a suspect switched off and the delta IS that suspect's cost.
//   --reduce-motion   prefers-reduced-motion: reduce — the app's own gate (parallax rAF off,
//                     ambient field unmounted, framer idle animations inert). This is the FLOOR.
//   --inject-css      arbitrary stylesheet, applied after mount (e.g. '*{animation:none!important}'
//                     to strip only the CSS keyframe animations and leave framer/rAF running).
if (has('--reduce-motion')) {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
}

// rAF frame sampler, installed before the app so it also covers mount.
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(function(){window.__f={frames:[],long:[],mark:0};
    try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){window.__f.long.push(Math.round(e.duration))})}).observe({type:'longtask',buffered:true})}catch(e){}
    var last=0;function t(ts){if(last)window.__f.frames.push(ts-last);last=ts;requestAnimationFrame(t)}requestAnimationFrame(t);})()`,
})
// --no-parallax-vars: neuter ONLY the `--parallax-x/y` custom-property writes, before app scripts run.
// This is the surgical A/B for the CSS-custom-property-per-frame driver: everything else (framer idle
// loops, ambient CSS animations, the layers themselves) keeps running, so the delta is that one loop.
if (has('--no-parallax-vars')) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){var sp=CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty=function(n,v,p){if(typeof n==='string'&&n.indexOf('--parallax')===0)return;return sp.call(this,n,v,p)}})()`,
  })
}
const PREJS = opt('--inject-js-pre')
if (PREJS) await send('Page.addScriptToEvaluateOnNewDocument', { source: PREJS })

if (CPU > 1) await send('Emulation.setCPUThrottlingRate', { rate: CPU })

await send('Page.navigate', { url: URL_ })
const mounted = await (async () => {
  for (let i = 0; i < 80; i++) {
    if (await evaluate('!!document.querySelector("#root") && document.querySelector("#root").children.length>0')) return true
    await sleep(250)
  }
  return false
})()
if (!mounted) { console.error(`MOUNT TIMEOUT ${LABEL}`); ws.close(); chrome.kill(); process.exit(1) }

// Dismiss the audio modal if it stands (it would sit over the screen under test).
await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Start lyd nu/i.test(x.textContent||''));if(b){b.click();return true}return false})()`)

for (const sel of all('--click')) {
  let ok = false
  for (let i = 0; i < 40 && !ok; i++) {
    ok = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e){e.click();return true}return false})()`)
    if (!ok) await sleep(200)
  }
  if (!ok) { console.error(`CLICK NOT FOUND ${sel} on ${LABEL}`); ws.close(); chrome.kill(); process.exit(1) }
  await sleep(600)
}
for (const sel of all('--wait-for')) {
  let ok = false
  for (let i = 0; i < 60 && !ok; i++) {
    ok = await evaluate(`!!document.querySelector(${JSON.stringify(sel)})`)
    if (!ok) await sleep(200)
  }
  if (!ok) { console.error(`WAIT-FOR TIMEOUT ${sel} on ${LABEL}`); ws.close(); chrome.kill(); process.exit(1) }
}

const CSSIN = opt('--inject-css')
if (CSSIN) {
  await evaluate(`(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(CSSIN)};document.head.appendChild(s);return true})()`)
}

// Let entry animations / art decode / lazy chunks finish so the window is genuinely IDLE.
await sleep(SETTLE)

// Real DOM size — CDP's `Nodes` metric under-reports for a shadow-free SPA and is not a node count
// you can reason about. Count elements directly.
const domCount = await evaluate('document.querySelectorAll("*").length')
const animCount = await evaluate(`[...document.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return c.animationName&&c.animationName!=='none'}).length`)
const willChangeCount = await evaluate(`[...document.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return c.willChange&&c.willChange!=='auto'}).length`)
const filterCount = await evaluate(`[...document.querySelectorAll('*')].filter(e=>{const c=getComputedStyle(e);return (c.filter&&c.filter!=='none')||(c.backdropFilter&&c.backdropFilter!=='none')}).length`)
const styleSheetRules = await evaluate(`[...document.styleSheets].reduce((n,s)=>{try{return n+s.cssRules.length}catch(e){return n}},0)`)

await send('LayerTree.enable')
await evaluate('(window.__f.frames.length=0)')
const before = await metrics()
const t0 = Date.now()
await sleep(WINDOW)
const after = await metrics()
const elapsed = (Date.now() - t0) / 1000
await send('LayerTree.disable')

const d = (k) => Math.max(0, (after[k] ?? 0) - (before[k] ?? 0))
const per = (k) => +(d(k) / elapsed).toFixed(1)
const perMs = (k) => +((d(k) * 1000) / elapsed).toFixed(1) // CDP durations are SECONDS

// Compositor layers: take the largest snapshot seen during the window (they arrive on change) and
// sum the texture footprint. Layer width/height are already device pixels.
const layers = layerSnapshots.length ? layerSnapshots.reduce((a, b) => (b.length > a.length ? b : a)) : []
const drawn = layers.filter((l) => l.drawsContent)
const bytes = drawn.reduce((s, l) => s + (l.width || 0) * (l.height || 0) * 4, 0)

const EV = opt('--eval')
if (EV) console.log('eval:', JSON.stringify(await evaluate(EV)))

const frames = await evaluate(`(()=>{const f=window.__f.frames.slice(5);const s=f.slice().sort((a,b)=>a-b);
  return JSON.stringify({n:f.length,
    med:s.length?+s[Math.floor(s.length/2)].toFixed(1):0,
    p95:s.length?+s[Math.floor(s.length*0.95)].toFixed(1):0,
    jank:f.filter(x=>x>50).length,
    long:window.__f.long.length})})()`)
const fr = JSON.parse(frames || '{}')
const nodes = after.Nodes ?? 0
const layoutObjects = after.LayoutObjects ?? 0

const row = {
  label: LABEL,
  cpu: CPU || 1,
  vp: `${W}x${H}@${DPR}`,
  recalcPerSec: per('RecalcStyleCount'),
  recalcMsPerSec: perMs('RecalcStyleDuration'),
  layoutPerSec: per('LayoutCount'),
  layoutMsPerSec: perMs('LayoutDuration'),
  scriptMsPerSec: perMs('ScriptDuration'),
  taskMsPerSec: perMs('TaskDuration'),
  busyPct: +((perMs('TaskDuration') / 1000) * 100).toFixed(1),
  layers: drawn.length,
  layerMB: +(bytes / 1048576).toFixed(1),
  dom: domCount,
  animated: animCount,
  willChange: willChangeCount,
  filtered: filterCount,
  cssRules: styleSheetRules,
  nodes,
  layoutObjects,
  heapMB: +((after.JSHeapUsedSize ?? 0) / 1048576).toFixed(1),
  frameMed: fr.med, frameP95: fr.p95, jank: fr.jank, longTasks: fr.long,
  consoleErrors: consoleErrors.length,
}
console.log(JSON.stringify(row))
if (JSONOUT) {
  if (!existsSync(JSONOUT)) writeFileSync(JSONOUT, '')
  appendFileSync(JSONOUT, JSON.stringify(row) + '\n')
}
ws.close(); chrome.kill(); await sleep(150)
process.exit(0)
