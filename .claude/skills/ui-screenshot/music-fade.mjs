// Music fade-out probe (rung 1, Chrome): for every game tile in every section menu, tap it and
// measure the bed through the fade GainNode (AnalyserNode RMS) against time since the tap.
// Usage: node .claude/skills/ui-screenshot/music-fade.mjs [kid|ocean|space|dino] [route-substring]
// Needs Vite on 5173 + dev:api on 3001. The first page after a cold Vite start can lag the sampler.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Source/preschool-learning-app/package.json')
const { chromium } = require('playwright')

const BASE = 'http://127.0.0.1:5173'
const THEME = process.argv[2] || 'kid'
const ONLY = process.argv[3] || null
const src = readFileSync('C:/Source/preschool-learning-app/src/config/categoryThemes.ts', 'utf8')
const MENU = { alphabet: '/alphabet', math: '/math', colors: '/farver', english: '/english', ordleg: '/ordleg' }
// Parse "<category>: { ... games: [ {title, route} ... ] }"
const games = []
for (const [cat, menu] of Object.entries(MENU)) {
  const start = src.indexOf(`\n  ${cat}: {`)
  const next = src.slice(start + 5).search(/\n  [a-z]+: \{/)
  const block = src.slice(start, next < 0 ? undefined : start + 5 + next)
  for (const m of block.matchAll(/title: '([^']+)',\s*route: '([^']+)'/g)) games.push({ cat, menu, title: m[1], route: m[2] })
}
const list = ONLY ? games.filter((g) => g.route.includes(ONLY)) : games
console.log(`theme=${THEME} games=${list.length}`)

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const results = []
for (const g of list) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text() + ' ' + (m.location()?.url ?? '')) })
  await page.goto(`${BASE}${g.menu}?nogate=1&music=1&theme=${THEME}`, { waitUntil: 'load' })
  // Music plays + fade-in finished (Howler fade-in is 800ms).
  try {
    await page.waitForFunction(() => window.__music?.getHealth().playing && window.__music.currentVolume() > 0.95, null, { timeout: 15000 })
  } catch {
    results.push({ ...g, verdict: 'UNKNOWN', why: 'music never started', health: await page.evaluate(() => window.__music?.getHealth()) })
    await page.close(); continue
  }
  await page.waitForTimeout(600)
  const r = await page.evaluate(async (title) => {
    // Find the tile: the deepest element whose own text is exactly the title, then its clickable ancestor.
    const els = [...document.querySelectorAll('body *')].filter((e) => e.childElementCount === 0 && e.textContent.trim() === title)
    if (!els.length) return { err: 'tile not found' }
    let el = els[0]
    const path0 = location.pathname
    const t0 = performance.now()
    // Real pointer sequence at the tile's centre.
    const r = el.getBoundingClientRect()
    const target = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) || el
    const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pointerId: 1, isPrimary: true, pointerType: 'touch' }
    target.dispatchEvent(new PointerEvent('pointerdown', opts))
    target.dispatchEvent(new PointerEvent('pointerup', opts))
    target.dispatchEvent(new MouseEvent('click', opts))
    const samples = []
    let routeAt = null
    let analyser = null
    let buf = null
    const ctx = window.Howler?.ctx
    await new Promise((done) => {
      const tick = () => {
        const t = performance.now() - t0
        const f = window.__music.lastFade
        if (f?.gain && !analyser && ctx) {
          analyser = ctx.createAnalyser(); analyser.fftSize = 1024; buf = new Float32Array(1024)
          f.gain.connect(analyser)
        }
        let rms = null
        if (analyser) { analyser.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; rms = Math.sqrt(s / buf.length) }
        if (routeAt == null && location.pathname !== path0) routeAt = t
        samples.push({ t: Math.round(t), rms, gain: f?.gain ? f.gain.gain.value : null, playing: window.__music.getHealth().playing, world: window.__music.playingWorld() })
        if (t < 1400) setTimeout(tick, 20); else done()
      }
      tick()
    })
    const f = window.__music.lastFade
    return { routeAt, fadeStartDelay: f ? Math.round(f.startedAt - (performance.timeOrigin + t0)) : null, mode: f?.mode, ms: f?.ms, done: f?.doneAt != null, path: location.pathname, samples, health: window.__music.getHealth(), pool: window.Howler?._html5AudioPool?.length }
  }, g.title)
  if (r.err) { results.push({ ...g, verdict: 'UNKNOWN', why: r.err }); await page.close(); continue }
  const s = r.samples.filter((x) => x.rms != null)
  if (!s.length) { results.push({ ...g, verdict: 'FAIL', why: `no gain graph to measure (mode=${r.mode})` }); await page.close(); continue }
  // The analyser buffer starts empty, so "audible" = the loudest reading in the first ~300ms.
  const peak = Math.max(...s.filter((x) => x.t <= 300).map((x) => x.rms))
  const gAt = (ms) => s.reduce((b, x) => (Math.abs(x.t - ms) < Math.abs(b.t - ms) ? x : b)).gain
  const gains = s.map((x) => x.gain)
  const monotone = gains.every((v, i) => i === 0 || v <= gains[i - 1] + 1e-6)
  const at = (ms) => s.filter((x) => x.t >= ms - 30 && x.t <= ms + 30).map((x) => x.rms)
  const rmsBy = (from, to) => { const v = s.filter((x) => x.t >= from && x.t <= to).map((x) => x.rms); return v.length ? Math.max(...v) : null }
  const mid = rmsBy(200, 300)
  const tail = rmsBy(560, 1400)
  const silentAt = s.find((x, i) => x.t > 50 && x.rms < peak * 0.02 && s.slice(i).every((y) => y.rms < peak * 0.02))?.t ?? null
  const stillPlaying = r.samples.at(-1).playing
  const checks = {
    arrived: r.path === g.route || r.path.startsWith(g.route),
    gainPath: r.mode === 'gain',
    fadeOnTap: r.fadeStartDelay != null && r.fadeStartDelay < 60,
    audibleAtTap: peak > 1e-4,
    // Equal-power curve: gain ≈ cos(π/4) = 0.71 halfway, monotone down, 0 at the end.
    curveShape: monotone && Math.abs(gAt(r.ms / 2) - Math.SQRT1_2) < 0.12 && gAt(r.ms + 40) === 0,
    silentByEnd: silentAt != null && silentAt <= r.ms + 60,
    tailSilent: tail != null && tail < 1e-5,
    stopped: !stillPlaying && r.done,
    noErrors: errors.length === 0,
  }
  const pass = Object.values(checks).every(Boolean)
  if (process.env.DUMP) console.log(s.map((x) => `${x.t}:${x.rms.toFixed(4)}/${x.gain?.toFixed(2)}`).join(' '))
  results.push({ ...g, verdict: pass ? 'PASS' : 'FAIL', checks, routeAt: Math.round(r.routeAt), fadeStartDelay: r.fadeStartDelay, peak: +peak.toFixed(5), mid: mid && +mid.toFixed(5), silentAt, errors: errors.slice(0, 3), curve: at(0).concat(at(100), at(250), at(400), at(500)).map((v) => +v.toFixed(5)).slice(0, 12) })
  await page.close()
}
await browser.close()
for (const r of results) console.log(`${r.verdict.padEnd(7)} ${r.route.padEnd(28)} ${r.verdict === 'PASS' ? `route@${r.routeAt}ms fade@+${r.fadeStartDelay}ms peak=${r.peak} silent@${r.silentAt}ms` : JSON.stringify(r.checks ?? r.why) + ' ' + JSON.stringify(r.errors ?? r.health ?? '')}`)
const n = (v) => results.filter((r) => r.verdict === v).length
console.log(`\n${THEME}: PASS ${n('PASS')} FAIL ${n('FAIL')} UNKNOWN ${n('UNKNOWN')} of ${results.length}`)
