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
//   node .claude/skills/ui-screenshot/sweep.mjs --phase round     <- drives 8 tasks; play never "ends"
//   node .claude/skills/ui-screenshot/sweep.mjs --phase ceremony  <- seeds ?rewards=8 and plays to a crossing
//   node .claude/skills/ui-screenshot/sweep.mjs --phase live      <- FAILS on any live Azure TTS call
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
  text: t.replace(/\\s+/g,' ').slice(0,800)
 })})()`

// Bounds guard: every interactive element must sit inside the viewport. GameShell's root is
// overflow:hidden, so overflowing content is CLIPPED, not scrollable — scrollWidth proves nothing.
// It ALSO returns the crash/404/title facts, because "nothing is off-screen" is trivially true on a page
// that rendered almost nothing — a crashed route would otherwise sail through the layout phase.
// It measures VISUAL bounds, not the element's own rect. Farvejagt's draggable wrapper sits at the
// scatter anchor while its only child is translate(-50%,-50%)'d away, so the wrapper's rect hangs up to
// 40px below the painted object — that reported 3 "off-screen" objects whose ink and hit-target were
// both fully inside (verified with elementFromPoint). The mirror of the documented transform trap.
// The union of DESCENDANT rects is the right measure: it follows the translate on Farvejagt, and still
// covers a card's text labels, which an <img>-only rule would have missed — that rule would have hidden
// the real Lær Engelsk overflow, where the clipped part was the label rows.
const BOUNDS = `(()=>{const bad=[];const W=innerWidth,H=innerHeight;const t=(document.body.innerText||'');
 const visualRect=(e)=>{const kids=e.querySelectorAll('*');
   if(!kids.length) return e.getBoundingClientRect();
   let l=Infinity,tp=Infinity,rt=-Infinity,b=-Infinity,seen=0;
   kids.forEach(k=>{const kr=k.getBoundingClientRect(); if(kr.width<1||kr.height<1) return;
     seen++; l=Math.min(l,kr.left); tp=Math.min(tp,kr.top); rt=Math.max(rt,kr.right); b=Math.max(b,kr.bottom)});
   return seen? {left:l,top:tp,right:rt,bottom:b,width:rt-l,height:b-tp} : e.getBoundingClientRect()};
 document.querySelectorAll('button,[data-answer-tile],[aria-roledescription="draggable"],[data-prompt-focus]').forEach(e=>{
  const r=visualRect(e); if(r.width<2||r.height<2) return;
  if(!(r.left<-1||r.right>W+1||r.top<-1||r.bottom>H+1)) return;
  // A rect that leaves the viewport is only a DEFECT if the child cannot reach the thing. Neither the
  // element's own rect nor its descendants' union is the ink: Farvejagt's wrapper sits 40px below its
  // translated child, and ObjectArt/SymbolTile scale their <img> ~2.5-3x over transparent padding, so
  // the union over-reports by that factor. Both directions produced false positives here. So confirm by
  // HIT-TESTING the on-screen part, which is the question that actually matters (SKILL.md says the same
  // about the transform trap). Reachable => not a finding; unreachable => real, and that is the shape
  // the genuine Lær Engelsk overflow had (cards wholly below an unscrollable fold).
  const cx=Math.min(W-2,Math.max(2,(Math.max(0,r.left)+Math.min(W,r.right))/2));
  const cy=Math.min(H-2,Math.max(2,(Math.max(0,r.top)+Math.min(H,r.bottom))/2));
  const hit=document.elementFromPoint(Math.round(cx),Math.round(cy));
  const reachable=!!hit && (hit===e || e.contains(hit) || hit.contains(e));
  if(!reachable)
   bad.push({t:(e.getAttribute('aria-label')||e.textContent||e.tagName).replace(/\\s+/g,' ').slice(0,32),
             l:Math.round(r.left),r:Math.round(r.right),tp:Math.round(r.top),b:Math.round(r.bottom)});
 });
 return JSON.stringify({W:W,H:H,off:bad.slice(0,8),offCount:bad.length,
  crashed:/Noget gik galt|Ups!/.test(t), notFound:/Denne side findes ikke/.test(t),
  rootKids:(document.querySelector('#root')||{children:[]}).children.length,
  // 800, not 160: the runner regexes the route's expected Danish title against this, and a denser board
  // pushed the title past a 160-char slice — reporting a title that WAS on screen as missing.
  text:t.replace(/\\s+/g,' ').slice(0,800)})})()`

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
 if(!used){const skip=/Indstillinger|Tilbage|Min Bog|Luk|Hjem/i;
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
  const routes = (PHASE === 'round' || PHASE === 'difficulty' || PHASE === 'ceremony' || PHASE === 'live')
    ? ROUTES.filter((r) => r.kind === 'game')
    : ROUTES
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
  // `?rewards=8` seeds the book one slot short of the chapter-1 boundary, so a handful of taps crosses
  // it and the ceremony probe doesn't have to play 200 questions to reach one.
  const seed = PHASE === 'ceremony' ? '&rewards=8' : ''
  const url = `${BASE}${job.route.route.replace(':type', 'letters')}?nogate=1${seed}`
  const settle = PHASE === 'audio' ? '2500' : '4000' // math boards need time to generate
  const evalJs = PHASE === 'layout' ? BOUNDS : PHASE === 'triggers' ? TRIGGERS
    : PHASE === 'audio' ? AUDIO_TRIGGER
    : PHASE === 'round' ? readFileSync(join(here, 'round-probe.js'), 'utf8')
    : PHASE === 'ceremony' ? readFileSync(join(here, 'ceremony-probe.js'), 'utf8')
    : PHASE === 'difficulty' ? readFileSync(join(here, 'difficulty-probe.js'), 'utf8')
    : PHASE === 'live' ? readFileSync(join(here, 'live-tts-probe.js'), 'utf8') : GUARD
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
  // …with ONE structural exception, checked first because it can never produce telemetry. In the
  // AUDIO phase `/ordleg/mic` redirects to `/ordleg` (the consent gate, below), the redirect drops
  // `?nogate=1`, so the app reverts to its gated state and `AUDIO_TRIGGER`'s `first-content-button`
  // fallback clicks a button on the SIGN-IN landing — which navigates and takes the eval context with
  // it. That is the consent gate working, not a hole: this route's render and no-crash are already
  // asserted by the smoke and layout phases, which reach it with their own (non-clicking) evals.
  // Left as DEAD it was a permanent unexplained row, the exact thing the N/A rule below exists for.
  if (PHASE === 'audio' && job.route.route === '/ordleg/mic' && (g === null || cerr === null)) {
    return { status: 'N/A', why: 'speech INPUT screen behind the consent gate — the trigger clicks through the sign-in landing and the eval context goes with it (§3.6)' }
  }
  if (g === null || cerr === null) return { status: 'DEAD', why: (r.err || r.out).split('\n').filter(Boolean).slice(-1)[0] || 'no output' }
  if (PHASE === 'triggers') return { status: 'PASS', why: JSON.stringify(g), guard: g }
  // `/ordleg/mic` REFUSES by design until an adult gives consent (App Store PRD §3.6): App.tsx renders
  // `micConsentGiven() ? <SpeakWordGame /> : <Navigate to="/ordleg" replace />`. So both title-asserting
  // phases land on the Ordleg menu — where the tile is ALSO hidden — and can never see "Sig et Ord" in a
  // fresh profile. It cost 1 FAIL in smoke and 8 in layout, one per viewport, all of them the consent
  // gate WORKING. Reported as N/A with the reason: a permanent red is a check people learn to ignore.
  // Still FAILs on a crash or an empty #root, so the route is not simply exempted.
  // (The redirect also drops the query string, so `?nogate=1` is lost and the app reverts to its gated
  // state — which is why probing this route by hand shows a lock screen and confuses the diagnosis.)
  if ((PHASE === 'smoke' || PHASE === 'layout') && job.route.route === '/ordleg/mic'
      && !g.crashed && !g.notFound && g.rootKids && !pexc) {
    return { status: 'N/A', why: 'refuses without adult mic consent (§3.6) — redirects to /ordleg', guard: g }
  }
  // Every line the app speaks is supposed to be PREBAKED (CLAUDE.md). A live `/api/tts-azure` call
  // means a line the enumerator never saw — which in the shipped app is not "slower" but a different
  // VOICE, because a guest has `canCallPaidApis: false` and falls through to Web Speech. Two of these
  // shipped and were caught by ear rather than by any test; this phase is the mechanical version.
  if (PHASE === 'live') {
    // Sig et Ord reads back an arbitrary spoken word — genuinely unbounded, the ONE documented
    // exception to the closed set. It can never be prebaked, so a live call there is correct.
    if (job.route.route === '/ordleg/mic') {
      return { status: 'N/A', why: 'reads back an arbitrary spoken word — the documented live-synth exception', guard: g }
    }
    const w = []
    if (pexc) w.push(`${pexc} page exception(s)`)
    if (g.liveAzure && g.liveAzure.length) {
      w.push(`LIVE Azure for ${g.liveAzure.length} line(s), so NOT prebaked: ${JSON.stringify(g.liveAzure.slice(0, 4))}`)
    }
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | ') || `${g.prebaked} prebaked clip(s), 0 live`, guard: g }
  }
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
      '/learning/memory/letters': 'Hukommelse needs flip-and-remember, not candidate cycling — the probe\'s own documented limit',
      '/learning/memory/numbers': 'Hukommelse needs flip-and-remember, not candidate cycling — the probe\'s own documented limit',
    }
    const target = g.target || 8
    // A "Lær …" browse has no task run to drive at all — its taps earn BROWSE_TASK_XP (2, once ever
    // per item), so applying a round's XP floor to it manufactures a defect out of correct behaviour.
    // The route list marks these `kind: 'game'`, so they have to be named.
    const BROWSES = {
      '/alphabet/learn': 'Lær Alfabetet is a BROWSE — no task run; taps earn BROWSE_TASK_XP once per item',
      '/math/numbers': 'Lær Tal is a BROWSE — no task run; taps earn BROWSE_TASK_XP once per item',
      '/english/learn': 'Lær Engelsk is a BROWSE — no task run; taps earn BROWSE_TASK_XP once per item',
      '/farver/laer': 'Lær Farver is a BROWSE — no task run; taps earn BROWSE_TASK_XP once per item',
    }
    if (BROWSES[job.route.route]) return { status: 'N/A', why: BROWSES[job.route.route], guard: g }
    // Checked BEFORE the advance count, not after: on these games cycling happily registers BOARD
    // CHANGES (droplets going into the pot) while never completing a single TASK, so "8 advances" is
    // not evidence of anything and the XP judge below would read correct play as broken.
    if (UNSOLVABLE_BY_CYCLING[job.route.route]) {
      return { status: 'UNKNOWN', why: `not driveable by this probe: ${UNSOLVABLE_BY_CYCLING[job.route.route]}`, guard: g }
    }
    // ONE ADVANCE IS NOT ALWAYS ONE TASK, and on these three it isn't: a Farvejagt task is a whole
    // BOARD, a Nuancer task is a complete light→dark ORDERING, a Stav Ordet task is a whole WORD — so a
    // signature change is one object landing / one shade / one letter. 8 advances is ~2 tasks, and
    // judging that against the 8-task floor reads correct play as broken per-task XP.
    // **This is a real coverage limit, stated rather than hidden**: on these three the probe can only
    // assert that XP moved AT ALL, so a per-task regression here would need the unit tests to catch it.
    const ADVANCE_IS_NOT_A_TASK = {
      '/farver/jagt': 'a task is a whole BOARD, so an advance is one object landing',
      '/farver/nuancer': 'a task is a complete light→dark ORDERING, so an advance is one shade placed',
      '/ordleg/spelling': 'a task is a whole WORD, so an advance is one letter placed',
    }
    const w = []
    if (g.crashed) w.push('CRASH BOUNDARY mid-play')
    if (pexc) w.push(`${pexc} page exception(s)`)
    if (cerr) w.push(`${cerr} console error(s)`)
    // ENDLESS PLAY (Endless Play PRD-01 W8): there is no round end to detect, so the verdict is the two
    // things play can promise — the board kept advancing, and the store paid for it. `resultScreen` is
    // GONE: it detected a `/Se bog/i` button removed on 2026-08-05, so it had been permanently false
    // and every game was being reported as "round never ended".
    if (g.advances < target) {
      w.push(`play stalled at ${g.advances}/${target} advances: ${g.stuck || `${g.clicks} clicks`}`)
    }
    // …and the XP must match the work. `xpAfter > xpBefore` is NOT enough: with `taskXp` zeroed a run
    // still credited the round bonus, and that loose check passed on a broken product. `taskXp`
    // normalises to REWARD_XP (40) per notional round, so 8 advances are worth ~40-48; the floor of 30
    // catches per-task XP dying while tolerating a short run and lost first-try bonuses.
    // UNKNOWN, not FAIL, when the store was never readable — see the note in round-probe.js.
    if (g.xpBefore === null || g.xpAfter === null) {
      return { status: 'UNKNOWN', why: `progressStore unreadable — XP could not be judged (${g.advances}/${target} advances)`, guard: g }
    }
    const gain = g.xpAfter - g.xpBefore
    const floor = ADVANCE_IS_NOT_A_TASK[job.route.route] ? 1 : 30
    if (g.advances >= target && gain < floor) {
      w.push(ADVANCE_IS_NOT_A_TASK[job.route.route]
        ? `${g.advances} advances paid NO XP at all — ${ADVANCE_IS_NOT_A_TASK[job.route.route]}, but SOME XP was still owed`
        : `${g.advances} advances paid only ${gain} XP (expected ~40 = one reward; per-task XP may be broken)`)
    }
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | '), guard: g,
      audio: `${g.advances}/${target} advances / ${g.clicks} clicks, xp ${g.xpBefore}→${g.xpAfter}${g.ceremony ? ', ceremony fired in-game' : ''}` }
  }
  // THE CEREMONY FIRES IN GAME (Endless Play PRD-01 W8). Judged on the three properties a screenshot
  // cannot show: it opened without leaving the game, it COVERS the board (hit-test), and the board did
  // not deal itself underneath it.
  if (PHASE === 'ceremony') {
    if (g.crashed) return { status: 'FAIL', why: 'CRASH BOUNDARY while driving to the crossing', guard: g }
    if (!g.ceremonyOpened) {
      // Not a defect and not coverage: the probe may simply never have reached a crossing on a game it
      // can't solve by cycling. UNKNOWN keeps it visible as unverified.
      return { status: 'UNKNOWN', why: `never reached a crossing (${g.advances} advance(s), ${g.clicks} clicks)`, guard: g }
    }
    const w = []
    if (pexc) w.push(`${pexc} page exception(s)`)
    if (cerr) w.push(`${cerr} console error(s)`)
    if (g.onGameRoute === false) w.push('the ceremony opened on another route — it must fire IN GAME')
    if (g.beat !== 'sticker') w.push(`the ceremony opened on beat "${g.beat}", expected "sticker"`)
    if (g.coversBoard === false) w.push('the overlay does NOT own the board centre — a tap would reach the tiles')
    if (g.boardHeldStill === false) w.push('the board advanced UNDERNEATH the overlay (the generator was not deferred)')
    if (!g.resumed) w.push('play did not resume after the ceremony closed')
    return { status: w.length ? 'FAIL' : 'PASS', why: w.join(' | '), guard: g,
      audio: `crossed after ${g.advances} advance(s), beat=${g.beat}, covers=${g.coversBoard}, held=${g.boardHeldStill}` }
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
