// "Are BOTH deployments' databases in sync with the code they are running?"
//
// One command, no credentials, no env assembly — that last part is the point. On 2026-09-05 sign-in
// was dead on production for a day because four columns had shipped in code and been migrated only
// into the staging database. The check that would have caught it existed (`npm run auth:migrate`, dry
// run) but needed the production DATABASE_URL *and* the signing secrets, and Vercel will not hand
// back a SENSITIVE-flagged value at all. So verifying production meant hand-building an env file.
// Nobody does that before a release. This asks each deployment about itself instead.
//
//   npm run schema:check                 → both tiers
//   npm run schema:check -- --production → just production
//
// Exits NON-ZERO on drift or on an unreachable tier, so it can gate a release.
const TIERS = {
  staging: 'https://staging.boernelaering.dk',
  production: 'https://boernelaering.dk',
}
const only = process.argv.slice(2).map((a) => a.replace(/^--/, ''))
const wanted = only.length ? only.filter((t) => t in TIERS) : Object.keys(TIERS)
if (!wanted.length) {
  console.error(`unknown tier; expected one of ${Object.keys(TIERS).join(', ')}`)
  process.exit(2)
}

let bad = 0
for (const name of wanted) {
  const url = `${TIERS[name]}/api/schema-health`
  try {
    const ctl = AbortSignal.timeout(30000)
    const r = await fetch(url, { signal: ctl })
    const body = await r.json().catch(() => null)
    if (!r.ok || !body) {
      // A 404 here means the deployment predates this endpoint — UNKNOWN, not "in sync".
      console.log(`${name.padEnd(11)} UNKNOWN  HTTP ${r.status}${r.status === 404 ? ' (deployment predates /api/schema-health — redeploy)' : ''}`)
      bad++
      continue
    }
    if (body.inSync) {
      console.log(`${name.padEnd(11)} IN SYNC  (tier reported: ${body.tier})`)
    } else {
      const m = body.missing || {}
      console.log(`${name.padEnd(11)} DRIFT    missing ${m.tables ?? '?'} table(s), ${m.columns ?? '?'} column(s) — run: npm run auth:migrate -- --apply against THAT database`)
      bad++
    }
  } catch (e) {
    console.log(`${name.padEnd(11)} UNREACHABLE  ${e?.name || e}`)
    bad++
  }
}
process.exit(bad ? 1 : 0)
