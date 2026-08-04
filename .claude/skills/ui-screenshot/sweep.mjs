// App-wide verification sweep: orchestrates cdp.mjs / webkit.mjs across every route, in parallel, with
// REAL accounting. Use it instead of a shell `for` loop.
//
// WHY IT EXISTS: a shell loop over the drivers lies in two directions that both read as success.
//   * A dead iteration (Chrome hadn't released its port) prints nothing and the loop carries on — so a
//     sweep "covering 5 viewports" silently covered 3. This runner PLANS every job up front and each
//     one must end in PASS or FAIL; anything else is DEAD, retried once, then reported as DEAD.
//   * A crashed route or a mistyped URL satisfies --wait-for and passes vacuously (AppErrorBoundary's
//     "Prøv igen" and NotFound's "Hjem" are both real buttons). So every job asserts the route's OWN
//     expected Danish title, read from categoryThemes.ts — a 404 or a crash cannot produce it.
//
// Usage:
//   node .claude/skills/ui-screenshot/sweep.mjs --phase smoke  [--engine chrome|webkit|both]
//   node .claude/skills/ui-screenshot/sweep.mjs --phase audio  [--engine chrome|webkit]
//   node .claude/skills/ui-screenshot/sweep.mjs --phase layout [--engine chrome|webkit]
//   node .claude/skills/ui-screenshot/sweep.mjs --selftest      <- proves the guards actually fire
//
//   --concurrency <n>  parallel jobs (default 3; each Chrome job gets its own CDP port)
//   --only <substr>    restrict to routes containing substr
//   --json <file>      write the full result set
//
// Dev servers must be running (Windows PowerShell, not WSL).

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')
const args = process.argv.slice(2)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d }
const has = (n) => args.includes(n)

const BASE = opt('--base', 'http://127.0.0.1:5173')
const PHASE = opt('--phase', 'smoke')
const ENGINE = opt('--engine', 'chrome')
const CONC = parseInt(opt('--concurrency', '3'), 10)
const ONLY = opt('--only')

// ---- route inventory, DERIVED from source (never hand-copied: a stale list is a silent coverage hole)
function inventory() {
  const src = readFileSync(join(repo, 'src', 'config', 'categoryThemes.ts'), 'utf8')
  const games = []
  const re = /title:\s*'([^']+)',\s*\n\s*route:\s*'([^']+)'/g
  let m
  while ((m = re.exec(src))) games.push({ route: m[2], expect: m[1], kind: 'game' })
  const sectionNames = [...src.matchAll(/^\s{4}name:\s*'([^']+)'/gm)].map((x) => x[1])
  const sectionRoutes = ['/alphabet', '/math', '/farver', '/english', '/ordleg']
  const menus = sectionRoutes.map((r, i) => ({ route: r, expect: sectionNames[i], kind: 'menu' }))
  return [
    { route: '/', expect: 'Børnelæring', kind: 'menu' },
    ...menus,
    ...games,
    { route: '/album', expect: 'Min Bog', kind: 'menu' },
  ]
}

// Difficulty exemptions, DERIVED from src/config/difficulty.ts's own EXEMPT map (with its reason
// strings) rather than hand-listed here — a game added to that map must stop being reported as a defect
// without anyone editing this file. Route→gameId because the map is keyed by gameId.
function parseMap(name) {
  const src = readFileSync(join(repo, 'src', 'config', 'difficulty.ts'), 'utf8')
  const start = src.indexOf(`export const ${name}`)
  const block = src.slice(start, src.indexOf('\n}', start))
  const out = {}
  for (const m of block.matchAll(/'([a-z]+\.[a-z-]+)':\s*'([^']+)'/g)) out[m[1]] = m[2]
  return out
}
const EXEMPT_BY_GAMEID = parseMap('EXEMPT')
// Games that express difficulty on a NON-tile axis, with difficulty.ts's own reason strings. Most of
// those axes ARE observable (item count, tray slots, board pairs) and the probe measures them; the
// exception is Ram Farven's target POOL, which cannot be seen in a single board.
const TILE_AXIS_EXEMPT = parseMap('TILE_AXIS_EXEMPT')
const ROUTE_TO_GAMEID = {
  '/alphabet/learn': 'alphabet.learn', '/math/numbers': 'math.learn',
  '/english/learn': 'english.learn', '/farver/laer': 'colors.learn', '/ordleg/mic': 'ordleg.mic',
}
// The one axis a single board cannot show. Reason string comes from difficulty.ts, not from here.
const DIFFICULTY_UNOBSERVABLE = {
  '/farver/ram-farven': `${TILE_AXIS_EXEMPT['colors.ramfarven'] || 'axis is the target pool'} — invisible in one board; audit by SAMPLING the source, not the DOM`,
}
// Routes where a DIV-COUNT delta is the legitimate signal rather than ambient noise, per SKILL.md's
// per-game observable table: Hukommelse's axis is board size, and Hvilken Farve's is swatch count —
// "neither of the above; a div count delta shows it". Excluding divs everywhere reported both as a
// broken setting when both were working.
const BOARD_SIZE_IS_THE_AXIS = new Set([
  '/learning/memory/letters', '/learning/memory/numbers', '/farver/quiz',
])

// Two memory routes share one title; dedupe by route, not title.
const ROUTES = inventory().filter((r, i, a) => a.findIndex((x) => x.route === r.route) === i)
  .filter((r) => !ONLY || r.route.includes(ONLY))

// ---- the page-side guard. Returns the facts; the runner decides pass/fail.
const GUARD = `(()=>{const t=(document.body.innerText||'');
 return JSON.stringify({
  crashed: /Noget gik galt|Ups!/.test(t),
  notFound: /Denne side findes ikke/.test(t),
  rootKids: (document.querySelector('#root')||{children:[]}).children.length,
  buttons: document.querySelectorAll('button').length,
  tiles: document.querySelectorAll('[data-answer-tile]').length,
  drags: document.querySelectorAll('[aria-roledescription="draggable"]').length,
  text: t.replace(/\\s+/g,' ').slice(0,160)
 })})()`

// Bounds guard: every interactive element must sit inside the viewport. GameShell's root is
// overflow:hidden, so overflowing content is CLIPPED, not scrollable — scrollWidth proves nothing.
// It ALSO returns the crash/404/title facts, because "nothing is off-screen" is trivially true on a page
// that rendered almost nothing — a crashed route would otherwise sail through the layout phase.
const BOUNDS = `(()=>{const bad=[];const W=innerWidth,H=innerHeight;const t=(document.body.innerText||'');
 document.querySelectorAll('button,[data-answer-tile],[aria-roledescription="draggable"],[data-prompt-focus]').forEach(e=>{
  const r=e.getBoundingClientRect(); if(r.width<2||r.height<2) return;
  if(r.left<-1||r.right>W+1||r.top<-1||r.bottom>H+1)
   bad.push({t:(e.getAttribute('aria-label')||e.textContent||e.tagName).replace(/\\s+/g,' ').slice(0,32),
             l:Math.round(r.left),r:Math.round(r.right),tp:Math.round(r.top),b:Math.round(r.bottom)});
 });
 return JSON.stringify({W:W,H:H,off:bad.slice(0,8),offCount:bad.length,
  crashed:/Noget gik galt|Ups!/.test(t), notFound:/Denne side findes ikke/.test(t),
  rootKids:(document.querySelector('#root')||{children:[]}).children.length,
  text:t.replace(/\\s+/g,' ').slice(0,160)})})()`

// Which narration trigger each screen offers. Discovered, not assumed: quizzes carry RepeatButton
// ("Hør igen"), browses narrate on tapping an item, and Sig et Ord is speech INPUT with nothing to
// replay. A screen with no trigger must report N/A — counting it FAIL invents defects, counting it PASS
// claims audio coverage we never exercised.
const TRIGGERS = `(()=>{const q=s=>document.querySelectorAll(s).length;
 return JSON.stringify({repeat:q('[aria-label="Hør igen"]'),tiles:q('[data-answer-tile]'),
  drags:q('[aria-roledescription="draggable"]'),focus:q('[data-prompt-focus]'),
  labelled:[...document.querySelectorAll('button[aria-label]')].map(b=>b.getAttribute('aria-label')).slice(0,10)})})()`

// Ordered candidate triggers, discovered via --phase triggers. Clicked from --eval (which cdp.mjs runs
// BEFORE printing the audio report), so the verdict reflects the tap. Screens with no candidate report
// N/A — e.g. Sig et Ord is speech INPUT, and Læs Ordet deliberately has no replay because it must not
// read the prompt word aloud (owner: he can't spell yet). Both are correct, not defects.
const AUDIO_TRIGGER = `(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 // NOTE: '[aria-label="Tryk på figuren"]' (the in-game mascot) is deliberately NOT here — its handler
 // is animation-only (Mascot.tsx handleTap), so using it as a trigger reported Læs Ordet and Sig et Ord
 // as silent when both are correct. A trigger candidate must actually be a narration control.
 const cands=['[aria-label="Hør igen"]','[aria-label="Hør alfabetet"]','[aria-label="Hør tallene"]',
              '[aria-label="Snak med figuren"]'];
 let used=null;
 for(const s of cands){const e=document.querySelector(s); if(e){e.click(); used=s; break}}
 if(!used){const skip=/Til de voksne|Tilbage|Min Bog|Luk|Hjem/i;
  const b=[...document.querySelectorAll('button')].find(x=>!skip.test(x.getAttribute('aria-label')||x.textContent||''));
  if(b){b.click(); used='first-content-button'}}
 await sleep(4500);
 return JSON.stringify({trigger:used,text:(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,160)})})()`

// Mirrors src/config/referenceViewports.ts. Leads with THE TARGET DEVICE — the child's iPad Pro 12.9"
// 2nd gen on iPadOS 17.7.11 (12.9" confirmed by the owner). See docs/device-testing.md.
const VIEWPORTS = [
  { name: 'iPadPro-land', w: 1366, h: 992, device: 'ipad-pro' },
  { name: 'iPadPro-port', w: 1024, h: 1334, device: 'ipad-pro-portrait' },
  { name: 'iPadPro-split', w: 678, h: 992, device: 'ipad-pro-split' },
  { name: 'ipad-land', w: 1024, h: 768, device: 'ipad' },
  { name: 'ipad-port', w: 768, h: 1024, device: 'ipad-portrait' },
  { name: 'wide', w: 1254, h: 872, device: 'wide' },
  { name: 'phone-land', w: 844, h: 390, device: 'iphone-landscape' },
  { name: 'phone-port', w: 390, h: 844, device: 'iphone' },
]

function run(cmd) {
  return new Promise((res) => {
    const p = spawn(process.execPath, cmd, { cwd: repo })
    let out = '', err = ''
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    p.on('close', (code) => res({ code, out, err }))
    p.on('error', (e) => res({ code: -1, out, err: String(e) }))
  })
}

function parseEval(out) {
  const m = out.match(/^eval: (.*)$/m)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}
const countOf = (out, re) => { const m = out.match(re); return m ? parseInt(m[1], 10) : null }

function jobsFor() {
  const jobs = []
  const engines = ENGINE === 'both' ? ['chrome', 'webkit'] : [ENGINE]
  // Rounds and difficulty only exist inside games — running them over menus just manufactures N/A rows.
  const routes = (PHASE === 'round' || PHASE === 'difficulty') ? ROUTES.filter((r) => r.kind === 'game') : ROUTES
  for (const eng of engines) {
    for (const r of routes) {
      if (PHASE === 'layout') {
        for (const v of VIEWPORTS) jobs.push({ eng, route: r, vp: v })
      } else {
        jobs.push({ eng, route: r, vp: VIEWPORTS[0] })
      }
    }
  }
  return jobs
}

function cmdFor(job, port) {
  const url = `${BASE}${job.route.route.replace(':type', 'letters')}?nogate=1`
  const settle = PHASE === 'audio' ? '2500' : '4000' // math boards need time to generate
  const evalJs = PHASE === 'layout' ? BOUNDS : PHASE === 'triggers' ? TRIGGERS
    : PHASE === 'audio' ? AUDIO_TRIGGER
    : PHASE === 'round' ? readFileSync(join(here, 'round-probe.js'), 'utf8')
    : PHASE === 'difficulty' ? readFileSync(join(here, 'difficulty-probe.js'), 'utf8') : GUARD
  if (job.eng === 'webkit') {
    const c = [join(here, 'webkit.mjs'), '--url', url, '--device', job.vp.device, '--settle', settle, '--eval', evalJs]
    if (PHASE === 'audio') c.push('--audio-report')
    return c
  }
  const c = [join(here, 'cdp.mjs'), '--url', url, '--w', String(job.vp.w), '--h', String(job.vp.h),
    '--settle', settle, '--port', String(port), '--eval', evalJs]
  if (PHASE === 'audio') c.push('--audio-report')
  return c
}

function judge(job, r) {
  let g = parseEval(r.out)
  const cerr = countOf(r.out, /console errors: (\d+)/)
  const pexc = countOf(r.out, /page exceptions: (\d+)/)
  // DEAD = the run never produced its own telemetry. Never fold this into FAIL: it means "we learned
  // nothing", and a retry usually fixes it (port contention). Counting it as FAIL invents defects;
  // counting it as PASS hides holes.
  if (g === null || cerr === null) return { status: 'DEAD', why: (r.err || r.out).split('\n').filter(Boolean).slice(-1)[0] || 'no output' }
  if (PHASE === 'triggers') return { status: 'PASS', why: JSON.stringify(g), guard: g }
  // The audio phase's --eval returns {trigger,text}, NOT the GUARD shape — so it must be judged here,
  // before the GUARD field checks below (they would read undefined and invent "#root empty").
  if (PHASE === 'audio') {
    const v = (r.out.match(/^audio verdict: (.*)$/m) || [])[1] || ''
    // Screens with nothing to replay, by design. Sig et Ord is speech INPUT — it reads back a word the
    // child speaks first, so there is no clip to trigger and its only button is the mic.
    if (job.route.route === '/ordleg/mic') return { status: 'N/A', why: 'speech INPUT screen — reads back what the child says, nothing to replay', guard: g }
    if (!g.trigger) return { status: 'N/A', why: 'no narration trigger on this screen (by design)', guard: g }
    const w = []
    if (pexc) w.push(`${pexc} page exception(s)`)
    if (cerr) w.push(`${cerr} console error(s)`)
    if (/^SILENT/.test(v)) w.push(`audio ${v}`)
    else if (/NO AUDIO/.test(v)) w.push(`audio NO AUDIO ATTEMPTED despite trigger ${g.trigger}`)
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | '), guard: g, audio: `${g.trigger} → ${v}` }
  }
  // Same shape trap as the audio phase: the layout --eval returns {W,H,off,offCount}, so the GUARD field
  // checks below would read undefined `rootKids` and report "#root empty" on every healthy page. Any
  // phase with its own --eval payload must be judged on its OWN fields.
  if (PHASE === 'layout') {
    const w = []
    if (g.crashed) w.push('CRASH BOUNDARY')
    if (g.notFound) w.push('NOT FOUND (bad route)')
    if (!g.rootKids) w.push('#root empty')
    if (!new RegExp(job.route.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(g.text || ''))
      w.push(`expected title "${job.route.expect}" not on screen`)
    if (pexc) w.push(`${pexc} page exception(s)`)
    if (cerr) w.push(`${cerr} console error(s)`)
    if (g.offCount) w.push(`${g.offCount} element(s) off-screen: ${JSON.stringify(g.off)}`)
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | '), guard: g }
  }
  // Each of these phases returns its OWN payload shape, so each is judged on its own fields (the trap
  // that made the layout phase report "#root empty" on healthy pages).
  if (PHASE === 'round') {
    if (g.notCovered) return { status: 'N/A', why: g.notCovered, guard: g }
    // Games blind candidate-cycling cannot SOLVE. Not defects and not coverage either — UNKNOWN, so they
    // stay visible as unverified instead of being laundered into a pass or invented as a failure.
    const UNSOLVABLE_BY_CYCLING = {
      '/farver/ram-farven': 'colour MIXING toward a target — droplets register (60 board changes observed) but a task can only be completed by choosing the right combination, which cycling cannot do',
      '/farver/quiz': 'the prompt object must be DRAGGED onto a swatch (its solved signal is an <img> appearing inside the swatch droppable); a tap on the swatch alone does not resolve',
    }
    if (!g.resultScreen && UNSOLVABLE_BY_CYCLING[job.route.route]) {
      return { status: 'UNKNOWN', why: `not driveable by this probe: ${UNSOLVABLE_BY_CYCLING[job.route.route]}`, guard: g }
    }
    const w = []
    if (g.crashed) w.push('CRASH BOUNDARY mid-round')
    if (pexc) w.push(`${pexc} page exception(s)`)
    if (cerr) w.push(`${cerr} console error(s)`)
    if (!g.resultScreen) w.push(`round never ended: ${g.stuck || `${g.advances} advance(s), ${g.clicks} clicks, no RoundResultScreen`}`)
    // A round that ends must pay about ONE REWARD's worth of XP. `xpAfter > xpBefore` is NOT enough:
    // with `taskXp` zeroed the round still credited 8 (bonuses only) and that loose check passed on a
    // broken product. REWARD_XP is 40 and taskXp normalises so any completed round lands near it, so a
    // floor of 30 catches per-task XP dying while tolerating a short round and lost first-try bonuses.
    // UNKNOWN, not FAIL, when the store was never readable — see the note in round-probe.js.
    if (g.xpBefore === null || g.xpAfter === null) {
      return { status: 'UNKNOWN', why: 'progressStore unreadable — XP could not be judged (round itself: ' + (g.resultScreen ? 'completed' : 'did not complete') + ')', guard: g }
    }
    const gain = g.xpAfter - g.xpBefore
    if (g.resultScreen && gain < 30) w.push(`round ended but paid only ${gain} XP (expected ~40 = one reward; per-task XP may be broken)`)
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | '), guard: g,
      audio: `${g.advances} advances / ${g.clicks} clicks, xp ${g.xpBefore}→${g.xpAfter}` }
  }
  if (PHASE === 'difficulty') {
    const rt = job.route.route
    // Hukommelse's axis IS its board size, so the div-count delta the probe treats as weak elsewhere is
    // the real signal here. Promote it rather than calling a working setting broken.
    const moved = g.moved || (BOARD_SIZE_IS_THE_AXIS.has(rt) && (g.changedKeys || []).includes('divs'))
    g = { ...g, moved }
    const exemptReason = EXEMPT_BY_GAMEID[ROUTE_TO_GAMEID[rt]] || DIFFICULTY_UNOBSERVABLE[rt]
    // An exempt game must still be REPORTED (with its reason), never silently skipped — but only when it
    // genuinely showed no change. If an "exempt" game DID move, that is worth seeing, so fall through.
    if (exemptReason && !g.moved) return { status: 'N/A', why: exemptReason, guard: g }
    const w = []
    if (g.error) w.push(`probe error: ${g.error}`)
    if (!g.moved) w.push(`difficulty did not change anything observable${g.note ? ` (${g.note})` : ''}`)
    if (pexc) w.push(`${pexc} page exception(s)`)
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | '), guard: g,
      audio: `moved via: ${(g.changedKeys || []).join(',') || 'nothing'}` }
  }
  const why = []
  if (g.crashed) why.push('CRASH BOUNDARY (Noget gik galt/Ups)')
  if (g.notFound) why.push('NOT FOUND (bad route)')
  if (!g.rootKids) why.push('#root empty')
  if (pexc) why.push(`${pexc} page exception(s)`)
  if (cerr) why.push(`${cerr} console error(s)`)
  if (!new RegExp(job.route.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(g.text || ''))
    why.push(`expected title "${job.route.expect}" not on screen`)
  return { status: why.length ? 'FAIL' : 'PASS', why: why.join(' | '), guard: g, audio: (r.out.match(/^audio verdict: (.*)$/m) || [])[1] }
}

async function selftest() {
  // Prove the two guards that make every other green trustworthy. If these do not go RED, the sweep
  // is decoration. (CLAUDE.md: re-break the code and require THAT check to fail.)
  console.log('SELFTEST — both must report FAIL:')
  const crashJob = { eng: 'chrome', route: { route: '/alphabet/quiz', expect: 'Bogstav Quiz', kind: 'game' }, vp: VIEWPORTS[0] }
  const c1 = cmdFor(crashJob, 9500)
  c1[c1.indexOf('--url') + 1] += '&crash-test=1'
  const r1 = judge(crashJob, await run(c1))
  console.log(`  crash guard (?crash-test=1): ${r1.status} — ${r1.why}`)
  const badJob = { eng: 'chrome', route: { route: '/alphabet/quiz', expect: 'ThisTitleCannotExist', kind: 'game' }, vp: VIEWPORTS[0] }
  const r2 = judge(badJob, await run(cmdFor(badJob, 9501)))
  console.log(`  title guard (impossible title): ${r2.status} — ${r2.why}`)
  const bad404 = { eng: 'chrome', route: { route: '/math/plus', expect: 'Plus Opgaver', kind: 'game' }, vp: VIEWPORTS[0] }
  const r3 = judge(bad404, await run(cmdFor(bad404, 9502)))
  console.log(`  404 guard (/math/plus): ${r3.status} — ${r3.why}`)
  const ok = r1.status === 'FAIL' && r2.status === 'FAIL' && r3.status === 'FAIL'
  console.log(ok ? 'SELFTEST PASSED (guards are load-bearing)' : 'SELFTEST FAILED — do not trust this sweep')
  process.exit(ok ? 0 : 1)
}

if (has('--selftest')) await selftest()

const jobs = jobsFor()
console.log(`sweep phase=${PHASE} engine=${ENGINE} jobs=${jobs.length} concurrency=${CONC}`)
const results = []
let next = 0
async function worker(id) {
  const port = 9400 + id
  for (;;) {
    const i = next++
    if (i >= jobs.length) return
    const job = jobs[i]
    let r = judge(job, await run(cmdFor(job, port)))
    if (r.status === 'DEAD') { // one retry: port contention is not a finding
      await new Promise((s) => setTimeout(s, 2000))
      r = judge(job, await run(cmdFor(job, port)))
    }
    results.push({ ...r, route: job.route.route, engine: job.eng, vp: job.vp.name })
    const tag = r.status === 'PASS' ? 'ok  ' : r.status === 'FAIL' ? 'FAIL'
      : r.status === 'N/A' ? 'n/a ' : r.status === 'UNKNOWN' ? '??? ' : 'DEAD'
    console.log(`${tag} ${job.eng.padEnd(6)} ${job.vp.name.padEnd(10)} ${job.route.route.padEnd(28)} ${r.status === 'PASS' ? (r.audio || '') : r.why}`)
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONC) }, (_, i) => worker(i)))

const by = (s) => results.filter((r) => r.status === s)
console.log(`\nplanned ${jobs.length} · ran ${results.length} · PASS ${by('PASS').length} · FAIL ${by('FAIL').length} · N/A ${by('N/A').length} · DEAD ${by('DEAD').length}`)
for (const r of by('N/A')) console.log(`n/a  ${r.route}: ${r.why}`)
for (const r of by('UNKNOWN')) console.log(`???  ${r.route}: ${r.why}`)
if (results.length !== jobs.length) console.log('!! ran ≠ planned — coverage hole, do not report this sweep as complete')
for (const r of by('FAIL')) console.log(`FAIL ${r.engine} ${r.vp} ${r.route}: ${r.why}`)
for (const r of by('DEAD')) console.log(`DEAD ${r.engine} ${r.vp} ${r.route}: ${r.why}`)
const jsonOut = opt('--json')
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2))
process.exit(by('FAIL').length || by('DEAD').length || by('UNKNOWN').length ? 1 : 0)
