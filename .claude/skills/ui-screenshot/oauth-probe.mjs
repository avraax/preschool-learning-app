#!/usr/bin/env node
// Drive the WHOLE sign-in round trip locally, with no Google or Apple account involved.
//
//   npm run dev:staging                                   # in one terminal, but see the flag below
//   node .claude/skills/ui-screenshot/oauth-probe.mjs     # in another
//
// THE DEV SERVER MUST BE STARTED WITH `AUTH_FAKE_PROVIDER=1`, and with an allowlist you are willing to
// create a row for. Both are shell environment variables, which BEAT `--env-file`, so `.env.local` is
// never touched (the one file in this repo you must not rewrite — `.claude/rules/env-and-secrets.md`):
//
//   env AUTH_FAKE_PROVIDER=1 AUTH_ALLOWED_EMAILS="fake-probe@example.test" \
//     node --env-file=.env.local --import ./scripts/js-to-ts-resolve.mjs dev-server.js
//
// WHAT THIS IS FOR. Every fault in the sign-in reliability PRD was found from bug reports the owner sent
// from an iPad, because a real sign-in needs a real consent screen — so `start → callback → claim` had no
// automated coverage at all, and neither did any failure branch. This is rung 1 for all of it. The fake
// provider is triple-gated and cannot exist on any deployment (`fakeProviderEnabled()` in `lib/env.ts`).
//
// WHAT IT IS NOT. It does not drive the BROWSER, so it says nothing about the poll, the sheet, or the
// return into the app — those are `cdp.mjs`/`webkit.mjs` and the owner's iPad. It answers exactly one
// question: does the server behave correctly at every branch, and does the app get a decisive answer.
//
// ONE FULL RUN PER TEN MINUTES, and that is the endpoint working, not a bug. `/family/oauth/start` is
// rate-limited to 10 per 10 minutes and the limit is DATABASE-backed, so it is shared across restarts
// and cannot be cleared by bouncing the dev server. There are 8 cases below. A second run inside the
// window reports "Too many requests" for most rows — wait it out rather than "fixing" anything.
//
// `OAUTH_PROBE_EMAIL` must match the address the server was started with, or the happy path is REFUSED
// (correctly) and reads as a failure. That refusal is itself the C1 case working.
//
// THE SUCCESS CASE CREATES A REAL USER ROW in whichever database the dev server points at, which is
// staging. Delete it afterwards, re-deriving the id FROM the database (`.claude/rules/auth.md`) — or
// pass an address the allowlist refuses and skip the happy path entirely.

const BASE = process.env.OAUTH_PROBE_BASE ?? 'http://127.0.0.1:3001'
const API = `${BASE}/api/auth/family/oauth`
const HAPPY_EMAIL = process.env.OAUTH_PROBE_EMAIL ?? 'fake-probe@example.test'

const newFlowId = (n) => `probe-${n}-${Date.now()}-${'x'.repeat(20)}`

async function drive({ label, outcome, client = 'web', expect }) {
  const flowId = newFlowId(label.replace(/\W+/g, ''))
  const startRes = await fetch(`${API}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ flowId, provider: 'fake', fakeOutcome: outcome, client }),
  })
  const start = await startRes.json().catch(() => ({}))
  if (!start.authorizeUrl) {
    return { label, ok: false, why: `start failed: ${JSON.stringify(start).slice(0, 120)}` }
  }

  // Follow the fake authorize page into our own callback, exactly as a browser would.
  const page = await fetch(start.authorizeUrl, { redirect: 'follow' })
  const html = page.headers.get('content-type')?.includes('text/html') ? await page.text() : ''
  const heading = html.match(/<h1[^>]*>([^<]*)/)?.[1] ?? null
  const fejlkode = html.match(/Fejlkode: <strong[^>]*>([^<]*)/)?.[1] ?? null
  const hasLink = /<a href="\/"/.test(html)
  const hasCloseCopy = /Luk dette vindue/.test(html)

  const claimRes = await fetch(`${API}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ flowId }),
  })
  const claim = await claimRes.json().catch(() => ({}))

  const actual = {
    heading,
    fejlkode: fejlkode ? 'yes' : 'no',
    link: hasLink ? 'href-slash' : hasCloseCopy ? 'close-copy' : 'none',
    claimStatus: claimRes.status,
    claimMessage: claim.message ?? null,
    claimCode: claim.code ? 'yes' : 'no',
    token: claim.token ? 'yes' : 'no',
  }
  const failures = Object.entries(expect)
    .filter(([k, v]) => (v instanceof RegExp ? !v.test(String(actual[k])) : actual[k] !== v))
    .map(([k, v]) => `${k}: expected ${v}, got ${JSON.stringify(actual[k])}`)
  return { label, ok: failures.length === 0, why: failures.join('; '), actual }
}

// Each row names the PRD §6 scenario it is evidence for.
const CASES = [
  {
    label: 'A1/A2 happy path → session parked and claimed',
    outcome: `ok:${HAPPY_EMAIL}`,
    expect: { claimStatus: 200, token: 'yes', heading: 'null' },
  },
  {
    label: 'C1 address not on the allowlist → refusal, no Fejlkode',
    outcome: 'ok:stranger@blocked.test',
    expect: {
      heading: /ikke adgang til Børnelæring\. Adressen slutter på @blocked\.test\./,
      fejlkode: 'no',
      claimStatus: 410,
      claimCode: 'no',
      claimMessage: /blocked\.test/,
    },
  },
  {
    label: 'C2 Apple Hide My Email → named as privaterelay, not as a fault',
    outcome: 'ok:abc123@privaterelay.appleid.com',
    expect: { heading: /privaterelay\.appleid\.com/, fejlkode: 'no', claimStatus: 410, claimCode: 'no' },
  },
  {
    label: 'RC1/C3 id token fails verification → fault WITH a Fejlkode',
    outcome: 'bad-token',
    expect: { fejlkode: 'yes', claimStatus: 410, claimCode: 'yes' },
  },
  {
    label: 'C5 token exchange rejected → fault WITH a Fejlkode',
    outcome: 'reject-exchange',
    expect: { fejlkode: 'yes', claimStatus: 410, claimCode: 'yes' },
  },
  {
    label: 'B1/C4 cancelled at the provider → decisive, no fault',
    outcome: 'cancel',
    expect: { heading: /Login blev afbrudt/, fejlkode: 'no', claimStatus: 410, claimCode: 'no' },
  },
  {
    label: 'W5L2 shell failure page has NO sheet-navigating link',
    outcome: 'reject-exchange',
    client: 'shell',
    expect: { link: 'close-copy', claimStatus: 410 },
  },
  {
    label: 'W5L2 web failure page KEEPS its link',
    outcome: 'reject-exchange',
    client: 'web',
    expect: { link: 'href-slash' },
  },
]

const results = []
for (const c of CASES) {
  // Sequential on purpose: /oauth/start is rate-limited to 10 per 10 minutes (scenario C10), and a
  // parallel burst would spend the budget and report a rate-limit as a failure.
  results.push(await drive(c))
}

let failed = 0
for (const r of results) {
  if (r.ok) console.log(`  PASS  ${r.label}`)
  else {
    failed++
    console.log(`  FAIL  ${r.label}\n        ${r.why}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} branches behaved as specified`)
if (failed) {
  console.log('\nIf every row failed with "Too many requests", that is /oauth/start\'s own rate limit')
  console.log('(10 per 10 min, database-backed — scenario C10 working). Wait it out and re-run.')
  process.exit(1)
}
