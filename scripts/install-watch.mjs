// `npm run watch:installs` — has the institutional licence batch actually been DEPLOYED to devices?
//
// WHY THIS EXISTS. On 2026-10-21 App Store Connect recorded ONE row of 1,500 first-time downloads with
// source type "Institutional purchase" — Apple's name for an acquisition through Apple Business or
// Apple School Manager. The same day produced exactly ONE real first-time install and no movement at
// all in the usage counter. Apple exposes no buyer field anywhere (checked: App Downloads Detailed is
// the most granular report there is, and its `Source Info` / `Campaign` / `Page Title` are blank on
// that row), so we cannot ask who. What we CAN do is notice the moment those licences reach real
// iPads, because that is a step change nothing else in this app's history would produce.
//
// TWO SOURCES, because neither alone is enough:
//   * THE USAGE COUNTER is same-day and is the only thing that proves someone PLAYED. But its schema is
//     (day, event, app_version, n) — there is deliberately no device, OS or region column, so it can
//     only ever report MAGNITUDE. An earlier version of this note claimed the counter could spot "a run
//     of iPads on the same iPadOS"; it cannot, and that is the whole point of the second source.
//   * ASC PLATFORM APP INSTALLS carries Device and Platform Version, so it is where a fleet deployment
//     is actually identifiable as a fleet. It lags ~1-2 days.
//
// Exits 1 when either trips, so it can drive a scheduled check that stays silent until it matters.

import { createSign } from 'node:crypto'
import { readFileSync, writeFileSync, rmSync, mkdtempSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

const KEY_ID = process.env.ASC_KEY_ID || 'VR8MNH235U'
const ISSUER = process.env.ASC_ISSUER_ID || '62ee49e8-4d0f-4dd1-bb76-84a364d09904'
const KEY_PATH = process.env.ASC_KEY_PATH || 'C:/Users/AllanBrinkVraa/Documents/AppleDeveloper/AuthKey_VR8MNH235U.p8'

/**
 * THE TRIP RULE, and why it is a pair rather than a multiple.
 *
 * The baseline is 6-7 opens a day, so a bare "3x the baseline" fires on 20 — which one enthusiastic
 * family produces. A bare absolute threshold, on the other hand, stops meaning anything the moment the
 * app grows. Requiring BOTH keeps it quiet at today's volume and still correct at ten times it.
 */
const OPENS_MULTIPLE = 3
const OPENS_ABSOLUTE = 20
/** First-time installs in one day. No organic day in this app's history has exceeded 2. */
const INSTALLS_ABSOLUTE = 25

const arg = (f) => { const i = process.argv.indexOf(f); return i < 0 ? null : process.argv[i + 1] }

// ---- the production counter ----------------------------------------------------------------------

/**
 * `vercel env pull` OVERWRITES ITS TARGET WHOLESALE, and run against `.env.local` it silently deletes
 * every key Vercel does not know about (`.claude/rules/env-and-secrets.md`). So it only ever gets a
 * freshly made temp directory, the result is deleted in `finally`, and a target that looks like a real
 * env file is refused outright rather than trusted.
 */
async function withProdEnv(fn) {
  // `async` + `await fn(file)` is load-bearing, not style. Written synchronously around an async
  // callback, `fn(file)` returns an unresolved promise, `finally` blanks and deletes the credentials
  // immediately, and the read then fails with "no DATABASE_URL in the pulled env" — a message that
  // points at the wrong thing entirely.
  const explicit = arg('--env')
  if (explicit) return await fn(explicit)
  const dir = mkdtempSync(join(tmpdir(), 'bl-watch-'))
  const file = join(dir, 'pulled.env')
  if (/\.env\.local$/i.test(file)) throw new Error('refusing to pull onto .env.local')
  try {
    // `--cwd <scratch>` + the link file at `<scratch>/.vercel/project.json` is THE documented way to
    // pull here (`.claude/rules/env-and-secrets.md`): the CLI resolves both the project and the output
    // path from `client.cwd`, so the command stays fully linked to production while the file lands in
    // the scratch directory, and the repo's own `.env.local` is never a candidate target.
    // Two ways this goes wrong silently, both measured rather than guessed:
    //   * an ABSOLUTE path as the filename argument → the CLI exits 0 and writes nothing at all;
    //   * the link file at `<scratch>/project.json` instead of `<scratch>/.vercel/project.json` → the
    //     CLI says the directory is not linked and prints a `vercel link` suggestion.
    // Both end as "no file", which is why `existsSync` below is a hard failure and not a warning.
    mkdirSync(join(dir, '.vercel'), { recursive: true })
    copyFileSync(join(process.cwd(), '.vercel', 'project.json'), join(dir, '.vercel', 'project.json'))
    try {
      execFileSync('npx', ['vercel', 'env', 'pull', 'pulled.env', '--environment=production', '--yes',
        '--cwd', dir], { stdio: ['ignore', 'pipe', 'pipe'], shell: true, encoding: 'utf8' })
    } catch (e) {
      // Never swallow this: a failed pull must not look like "no deployment signature".
      throw new Error(`vercel env pull failed: ${String(e.stderr || e.stdout || e.message).slice(-300)}`)
    }
    if (!existsSync(file)) throw new Error(`vercel env pull exited 0 but wrote no file at ${file}`)
    return await fn(file)
  } finally {
    try { writeFileSync(file, '') } catch { /* best effort */ }
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
  }
}

async function counterCheck(envFile) {
  const { default: pg } = await import('pg')
  const text = readFileSync(envFile, 'utf8')
  const m = text.match(/^USAGE_DATABASE_URL="?([^"\n]+)/m) || text.match(/^DATABASE_URL="?([^"\n]+)/m)
  if (!m) throw new Error('no DATABASE_URL in the pulled env')
  const c = new pg.Client({ connectionString: m[1] })
  await c.connect()
  try {
    // `to_char`, never `.toISOString()` on a `date`: node-postgres parses it as LOCAL midnight, and in
    // CEST the ISO string then rolls back a day. That mis-reported the release day twice.
    const rows = (await c.query(
      `select to_char(day,'YYYY-MM-DD') d, sum(n) filter (where event='app_open')::int opens,
              sum(n)::int total
       from usage_counter where day >= current_date - 21 group by 1 order by 1`)).rows
    return rows
  } finally { await c.end() }
}

// ---- App Store Connect ----------------------------------------------------------------------------

function ascToken() {
  const pem = readFileSync(KEY_PATH, 'utf8')
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const head = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.`
    + b64({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })
  const s = createSign('SHA256'); s.update(head)
  // ieee-p1363, not DER — Apple rejects a DER signature.
  return `${head}.${s.sign({ key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}

async function installsCheck() {
  const token = ascToken()
  const api = async (p) => {
    const r = await fetch(`https://api.appstoreconnect.apple.com/v1/${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    return r.json()
  }
  const app = (await api('apps?limit=5'))?.data?.[0]
  if (!app) return { error: 'could not reach App Store Connect' }
  const reqs = (await api(`apps/${app.id}/analyticsReportRequests?limit=50`))?.data ?? []
  const rows = new Set()
  let header = null
  for (const rq of reqs) {
    const reports = (await api(`analyticsReportRequests/${rq.id}/reports?limit=200`))?.data ?? []
    const rep = reports.find((x) => x.attributes.name === 'Platform App Installs')
    if (!rep) continue
    const insts = (await api(`analyticsReports/${rep.id}/instances?limit=200`))?.data ?? []
    // Newest few only: this runs daily and the older instances never change.
    for (const inst of insts.slice(-4)) {
      const segs = (await api(`analyticsReportInstances/${inst.id}/segments?limit=50`))?.data ?? []
      for (const seg of segs) {
        const r = await fetch(seg.attributes.url)
        if (!r.ok) continue
        const buf = Buffer.from(await r.arrayBuffer())
        let txt; try { txt = gunzipSync(buf).toString('utf8') } catch { txt = buf.toString('utf8') }
        const lines = txt.split('\n').filter((l) => l.trim())
        header ??= lines[0].split('\t')
        for (const l of lines.slice(1)) rows.add(l)
      }
    }
  }
  if (!header) return { error: 'no Platform App Installs report reachable' }
  const iDay = header.indexOf('Install Day')
  const iType = header.indexOf('Install Type')
  const iDev = header.indexOf('Device')
  const iOs = header.indexOf('Platform Version')
  const iN = header.indexOf('Installs')
  const perDay = new Map()
  for (const l of rows) {
    const f = l.split('\t')
    if (f[iType] !== 'First-time install') continue
    const d = f[iDay]
    const e = perDay.get(d) ?? { n: 0, shapes: new Map() }
    e.n += Number(f[iN] || 0)
    const k = `${f[iDev]} ${f[iOs]}`
    e.shapes.set(k, (e.shapes.get(k) ?? 0) + Number(f[iN] || 0))
    perDay.set(d, e)
  }
  return { perDay }
}

// ---- report ----------------------------------------------------------------------------------------

const median = (xs) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

const counterRows = await withProdEnv((f) => counterCheck(f))
// The most recent day is still accruing, so it sets no baseline and is judged on its own.
const complete = counterRows.slice(0, -1)
const latest = counterRows.at(-1)
const baseline = median(complete.map((r) => r.opens ?? 0))

console.log('USAGE COUNTER — daily app opens (last 21 days)')
for (const r of counterRows) {
  console.log(`  ${r.d}  opens ${String(r.opens ?? 0).padStart(4)}   events ${String(r.total).padStart(5)}`)
}
console.log(`\n  baseline (median of complete days): ${baseline} opens/day`)

const needed = Math.max(baseline * OPENS_MULTIPLE, OPENS_ABSOLUTE)
const spikes = counterRows.filter((r) => (r.opens ?? 0) >= needed)
console.log(`  trip threshold: ${needed} opens in one day (${OPENS_MULTIPLE}x baseline, floor ${OPENS_ABSOLUTE})`)

const installs = await installsCheck()
let installTrip = []
if (installs.error) {
  // A probe of an external service has three outcomes — this is UNKNOWN, never "no deployment".
  console.log(`\nASC INSTALLS — UNKNOWN (${installs.error}); the counter half above still stands.`)
} else {
  const days = [...installs.perDay.entries()].sort()
  console.log('\nASC — first-time installs per day (device + OS, the fleet signature)')
  for (const [d, e] of days.slice(-12)) {
    const shape = [...e.shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, v]) => `${k}=${v}`).join(', ')
    console.log(`  ${d}  ${String(e.n).padStart(4)}   ${shape}`)
  }
  installTrip = days.filter(([, e]) => e.n >= INSTALLS_ABSOLUTE)
  console.log(`  trip threshold: ${INSTALLS_ABSOLUTE} first-time installs in one day`)
}

console.log('')
if (spikes.length || installTrip.length) {
  console.log('*** SIGNATURE TRIPPED ***')
  for (const r of spikes) console.log(`  counter: ${r.d} had ${r.opens} opens against a ${baseline}/day baseline`)
  for (const [d, e] of installTrip) {
    const shape = [...e.shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([k, v]) => `${k}=${v}`).join(', ')
    console.log(`  installs: ${d} had ${e.n} first-time installs — ${shape}`)
  }
  console.log('\n  A tripped threshold is evidence of a step change, NOT proof of who caused it.')
  console.log('  Apple exposes no buyer field; the device/OS shape above is the only clue to a fleet.')
  process.exit(1)
}
console.log('No deployment signature. The institutional licences have not reached devices.')
console.log(`Latest counter day ${latest.d}: ${latest.opens ?? 0} opens (still accruing).`)
