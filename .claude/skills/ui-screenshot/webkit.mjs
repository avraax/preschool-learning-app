// Real-WebKit driver (Playwright) for the local dev app — the Safari-engine sibling of cdp.mjs.
//
// WHY: cdp.mjs drives headless Chrome, which never takes the app's iOS branches and never uses Safari's
// engine. This driver runs the SAME app in an actual WebKit build with an iPad/iPhone user agent, so
// `deviceDetection.ts` reports isIOS/isIPad true and the iOS-only paths execute (audio unlock, the
// permission modal, `interrupted` AudioContext handling, Safari layout). Published figures put real
// WebKit at ~80-90% of WebKit-specific rendering/JS bugs.
//
// WHAT IT STILL CANNOT SEE — do not report a green run here as "verified on iPad":
//   * This is desktop WebKit with a mobile UA, not Mobile Safari. Scroll/`fixed` behaviour, real
//     viewport-unit quirks, memory pressure and backgrounding differ.
//   * `Version/17.x` in the UA is a STRING. The engine is whatever Playwright shipped (current WebKit),
//     so it does NOT reproduce iPadOS 17.7 engine gaps. It exercises the app's 17-era CODE PATHS; it
//     does not prove Safari 17 support. Ogg-in-iOS-17 could NOT have been caught by the engine here —
//     only by the probe's `formats` snapshot on a real 17 device.
//   * iOS transient user-activation (activation consumed across an `await`) is not emulated.
// For those, the ladder in SKILL.md ends at a real device.
//
// Usage:
//   node .claude/skills/ui-screenshot/webkit.mjs --url <url> [options]
//
// Device / viewport:
//   --device <name>       ipad-pro | ipad-pro-portrait | ipad-pro-split | ipad-105  <- iPad Pro sizes;
//                         the child's device is a Pro 2nd gen on iPadOS 17.7.11 (size unconfirmed)
//                         ipad | ipad-portrait | iphone | iphone-landscape | wide  (default ipad-pro)
//                         iPad/iPhone presets set an iOS UA + touch + meta-viewport handling.
//                         Sizes mirror src/config/referenceViewports.ts.
//   --w <px> --h <px>     Override the preset's viewport.
//   --dark                prefers-color-scheme: dark.
//   --reduced-motion      prefers-reduced-motion: reduce (the scene/transition guard path).
//
// Waiting / interaction / output: same flags and meanings as cdp.mjs —
//   --wait-for, --wait-for-text, --timeout, --settle, --wait,
//   --click, --click-text, --tap, --dom-click, --type,
//   --measure, --clip, --full-page, --eval, --out, --quality
//
// Audio:
//   --audio-report        Inject audio-probe.js before app scripts and print its verdict at the end.
//                         Gate on the verdict line: OK / SILENT / NO AUDIO ATTEMPTED.
//   --keep-audio-modal    Do NOT auto-dismiss "Tænd for lyd".
//
// Notes:
//  * --click uses REAL trusted input (unlike cdp.mjs's element.click()), so it exercises the pointer
//    and touch paths dnd-kit listens on. If an overlay intercepts, fall back to --dom-click.
//  * Requires `playwright` (devDependency) + `npx playwright install webkit` (one-time).
//  * Run dev servers FIRST in Windows PowerShell (not WSL): `npm run dev` + `npm run dev:api`.
//  * The app is auth-gated — put `?nogate=1` on the URL (see SKILL.md).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webkit } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const all = (name) => args.reduce((acc, a, i) => (a === name ? [...acc, args[i + 1]] : acc), [])
const has = (name) => args.includes(name)

const URL_ = opt('--url')
if (!URL_) { console.error('Missing --url'); process.exit(2) }

// iOS UA strings are hardcoded rather than taken from Playwright's device registry: the registry's
// names and versions drift between releases, and what matters here is only that `deviceDetection.ts`
// classifies the run (it regexes /iPad|iPhone|iPod/ and parses "OS 17_7" for `version`).
const IOS_17 = 'Mozilla/5.0 (iPad; CPU OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
const IPHONE_17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15'
const DEVICES = {
  // Lead with an iPad Pro, not the generic 1024x768 (which is no current Pro at all). The child's device
  // is an iPad Pro 2nd gen (A10X, 2017) on iPadOS 17.7.11 — the compatibility floor — but WHICH SIZE is
  // unconfirmed and his iPad has never sent a bug report. The 12.9" numbers below are measured from the
  // household's M1 12.9" Pro (prod K2HXP/WSNHY); both 12.9" generations share CSS geometry, so they
  // transfer if his is the 12.9". `ipad-105` is the other candidate. See docs/device-testing.md.
  // The 992/810 heights are the ~32px status strip iOS keeps even in standalone PWA mode — not a typo.
  'ipad-pro': { w: 1366, h: 992, dsf: 2, ua: IOS_17, touch: true, mobile: true },
  'ipad-pro-portrait': { w: 1024, h: 1334, dsf: 2, ua: IOS_17, touch: true, mobile: true },
  'ipad-pro-split': { w: 678, h: 992, dsf: 2, ua: IOS_17, touch: true, mobile: true },
  'ipad-105': { w: 1112, h: 810, dsf: 2, ua: IOS_17, touch: true, mobile: true },
  ipad: { w: 1024, h: 768, dsf: 2, ua: IOS_17, touch: true, mobile: true },
  'ipad-portrait': { w: 768, h: 1024, dsf: 2, ua: IOS_17, touch: true, mobile: true },
  iphone: { w: 390, h: 844, dsf: 3, ua: IPHONE_17, touch: true, mobile: true },
  'iphone-landscape': { w: 844, h: 390, dsf: 3, ua: IPHONE_17, touch: true, mobile: true },
  wide: { w: 1254, h: 872, dsf: 1, ua: undefined, touch: false, mobile: false },
}
// Default to an iPad Pro, not the generic 1024x768 — that size is no current iPad Pro at all.
const devName = opt('--device', 'ipad-pro')
const dev = DEVICES[devName]
if (!dev) { console.error(`Unknown --device ${devName}. Use: ${Object.keys(DEVICES).join(' | ')}`); process.exit(2) }

const W = parseInt(opt('--w', String(dev.w)), 10)
const H = parseInt(opt('--h', String(dev.h)), 10)
const TIMEOUT = parseInt(opt('--timeout', '10000'), 10)
const SETTLE = parseInt(opt('--settle', '500'), 10)
const FIXED_WAIT = parseInt(opt('--wait', '3000'), 10)
const OUT = opt('--out')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let exitCode = 0

const browser = await webkit.launch()
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: dev.dsf,
  userAgent: dev.ua,
  hasTouch: dev.touch,
  isMobile: dev.mobile,
  colorScheme: has('--dark') ? 'dark' : 'light',
  reducedMotion: has('--reduced-motion') ? 'reduce' : 'no-preference',
})
const page = await context.newPage()

if (has('--audio-report')) {
  await context.addInitScript({ path: join(here, 'audio-probe.js') })
}

const consoleErrors = []
const exceptions = []
// The app's own audio diagnostics ([audio-unlock], [tts], Howler) are console.warn, not error — under
// --audio-report they are the most informative lines on the page, so collect them too.
const audioLogs = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
  if (has('--audio-report') && /warn|info/.test(m.type()) && /audio|unlock|tts|howler|speech|sound/i.test(m.text())) {
    audioLogs.push(m.type() + ': ' + m.text().slice(0, 180))
  }
})
page.on('pageerror', (e) => exceptions.push(String(e.message || e).slice(0, 200)))

async function waitFor(fn, label) {
  try {
    await page.waitForFunction(fn, undefined, { timeout: TIMEOUT })
    return true
  } catch {
    console.error(`TIMEOUT waiting for ${label}`)
    exitCode = 1
    return false
  }
}
const waitForSelector = (sel) => waitFor(`!!document.querySelector(${JSON.stringify(sel)})`, `selector ${sel}`)
const waitForText = (txt) => waitFor(
  `[...document.querySelectorAll('*')].some(e=>e.children.length===0&&(e.textContent||'').includes(${JSON.stringify(txt)}))`,
  `text "${txt}"`,
)

await page.goto(URL_, { waitUntil: 'domcontentloaded' })

if (has('--wait')) await sleep(FIXED_WAIT)
else await waitFor('!!document.querySelector("#root") && document.querySelector("#root").children.length>0', 'app mount (#root)')
await sleep(SETTLE)

console.log(`device: ${devName} ${W}x${H}@${dev.dsf}x  engine: WebKit  ua: ${dev.ua ? 'iOS' : 'default'}`)

if (!has('--keep-audio-modal')) {
  // A real click, not element.click(): the modal's dismiss rule is that only a `click` handler may
  // close it (audio-system.md tap-through rule), so a trusted click is what actually exercises it.
  const btn = page.locator('button', { hasText: /Start lyd nu/i }).first()
  if (await btn.count()) {
    await btn.click({ timeout: 2000 }).catch(() => {})
    await sleep(300)
  }
}

for (const sel of all('--click')) {
  if (!(await waitForSelector(sel))) continue
  try {
    await page.locator(sel).first().click({ timeout: TIMEOUT })
    console.log(`click ${sel}: ok`)
  } catch (e) {
    console.log(`click ${sel}: FAILED (${String(e.message || e).split('\n')[0]})`)
    exitCode = 1
  }
  await sleep(SETTLE)
}
for (const sel of all('--tap')) {
  if (!(await waitForSelector(sel))) continue
  try {
    await page.locator(sel).first().tap({ timeout: TIMEOUT })
    console.log(`tap ${sel}: ok`)
  } catch (e) {
    console.log(`tap ${sel}: FAILED (${String(e.message || e).split('\n')[0]})`)
    exitCode = 1
  }
  await sleep(SETTLE)
}
// Escape hatch matching cdp.mjs semantics: bypasses hit-testing when something overlays the target.
for (const sel of all('--dom-click')) {
  const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (e) { e.click(); return true } return false }, sel)
  console.log(`dom-click ${sel}: ${ok ? 'ok' : 'NOT FOUND'}`)
  if (!ok) exitCode = 1
  await sleep(SETTLE)
}
for (const txt of all('--click-text')) {
  const btn = page.locator('button', { hasText: txt }).first()
  try {
    await btn.click({ timeout: TIMEOUT })
    console.log(`click-text "${txt}": ok`)
  } catch (e) {
    console.log(`click-text "${txt}": FAILED (${String(e.message || e).split('\n')[0]})`)
    exitCode = 1
  }
  await sleep(SETTLE)
}
for (const spec of all('--type')) {
  const [sel, ...rest] = spec.split('::')
  const text = rest.join('::')
  await page.evaluate(({ s, t }) => {
    const e = document.querySelector(s)
    if (e) {
      e.focus()
      e.value = t
      e.dispatchEvent(new Event('input', { bubbles: true }))
      e.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, { s: sel, t: text })
  await sleep(200)
}

for (const s of all('--wait-for')) await waitForSelector(s)
for (const t of all('--wait-for-text')) await waitForText(t)
if (all('--wait-for').length || all('--wait-for-text').length) await sleep(SETTLE)

const measure = opt('--measure')
if (measure) {
  const sels = measure.split(',').map((s) => s.trim()).filter(Boolean)
  const out = await page.evaluate((list) => JSON.stringify(list.map((s) => {
    const e = document.querySelector(s)
    if (!e) return { sel: s, rect: null }
    const r = e.getBoundingClientRect()
    return { sel: s, rect: { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) } }
  })), sels)
  console.log('measure:', out)
}

const ev = opt('--eval')
if (ev) console.log('eval:', await page.evaluate(ev))

if (OUT) {
  const isJpeg = /\.jpe?g$/i.test(OUT)
  const params = isJpeg ? { type: 'jpeg', quality: parseInt(opt('--quality', '85'), 10) } : { type: 'png' }
  const clipSel = opt('--clip')
  if (clipSel) {
    const box = await page.locator(clipSel).first().boundingBox().catch(() => null)
    if (box) {
      const pad = 8
      params.clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 }
    } else { console.error(`--clip selector not found: ${clipSel}`); exitCode = 1 }
  } else if (has('--full-page')) {
    params.fullPage = true
  }
  writeFileSync(OUT, await page.screenshot(params))
  console.log(`screenshot saved: ${OUT}`)
}

if (has('--audio-report')) {
  const report = await page.evaluate(() => (window.__audioProbe ? window.__audioProbe.report() : null))
  if (!report) {
    console.error('audio: probe missing (init script did not run)')
    exitCode = 1
  } else {
    console.log('audio verdict:', report.verdict)
    console.log('audio formats:', JSON.stringify(report.formats))
    console.log('audio media:', JSON.stringify(report.media))
    console.log('audio webaudio:', JSON.stringify(report.webaudio))
    if (report.notes.length) console.log('audio notes:', JSON.stringify(report.notes))
    if (audioLogs.length) console.log('audio app-logs:', JSON.stringify(audioLogs.slice(0, 12)))
    if (/^SILENT/.test(report.verdict)) exitCode = 1
  }
}

console.log(`console errors: ${consoleErrors.length}${consoleErrors.length ? ' ' + JSON.stringify(consoleErrors.slice(0, 5)) : ''}`)
console.log(`page exceptions: ${exceptions.length}${exceptions.length ? ' ' + JSON.stringify(exceptions.slice(0, 5)) : ''}`)

await browser.close()
process.exit(exitCode)
