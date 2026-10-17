import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Source guards for the anonymous usage counter.
//
// `api/**` is not in the `npm test` glob, so this lives in `lib/` — the same reason
// `lib/serverImports.test.ts` checks `api/` from here.
//
// WHAT THESE DEFEND. `docs/usage-analytics.md` claims the counter is anonymous BY CONSTRUCTION: no
// column holds a person, nothing identifying is transmitted, and the increment cannot be chosen by
// the caller. That claim is what keeps the feature outside GDPR (Recital 26) and inside Apple's Kids
// Category rules, and it is repeated in the shipped privacy policy. A future edit that adds a
// profile id "just for debugging" would silently falsify all three. These tests are the mechanical
// version of that promise.

const endpoint = readFileSync(new URL('../api/usage.ts', import.meta.url), 'utf8')
const service = readFileSync(new URL('../src/services/usagePing.ts', import.meta.url), 'utf8')

/**
 * COMMENTS MUST GO FIRST. Both files discuss IP addresses and identifiers at length, precisely
 * because they must not store them — so a naive grep matches the prose that explains the rule and
 * passes forever regardless of the code. A guard that greps source is worthless until it strips
 * what it is not judging.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const endpointCode = code(endpoint)
const serviceCode = code(service)

test('comment stripping actually works — BOTH forms', () => {
  // If either stripper regressed to a no-op, every assertion below would be vacuous for the comment
  // form it no longer handles. Caught by the re-break pass: the first version of this test used a
  // fixture that lives in a `//` comment to prove `/* */` stripping, so disabling the block-comment
  // regex left the suite green. One fixture per form, and each must come from the form it tests.
  const LINE_FIXTURE = 'WHAT IS HONESTLY NOT SOLVED' // in a `//` header comment
  const BLOCK_FIXTURE = 'DDL on demand rather than a migration script' // in a `/** */` block

  assert.ok(endpoint.includes(LINE_FIXTURE), 'line-comment fixture vanished from api/usage.ts')
  assert.ok(endpoint.includes(BLOCK_FIXTURE), 'block-comment fixture vanished from api/usage.ts')
  assert.ok(!endpointCode.includes(LINE_FIXTURE), 'line comments were not stripped')
  assert.ok(!endpointCode.includes(BLOCK_FIXTURE), 'block comments were not stripped')
  assert.ok(!serviceCode.includes('FIRE AND FORGET, ALWAYS'), 'line comments were not stripped')
})

test('the endpoint never touches an identifier', () => {
  // `clientIp` is the sharp one: `rateLimit` uses it INTERNALLY for its in-memory bucket, which is
  // fine, but this file calling it would mean an IP is in scope here and one line from being stored.
  for (const forbidden of [
    'clientIp',
    'x-forwarded-for',
    'profileId',
    'userId',
    'deviceId',
    'sessionId',
    'ipAddress',
    'userAgent',
    'user-agent',
  ]) {
    const re = new RegExp(`\\b${forbidden.replace(/[-]/g, '[-]')}\\b`)
    assert.ok(!re.test(endpointCode), `api/usage.ts references ${forbidden}`)
  }
})

test('the client sends only the events and the version', () => {
  const body = /JSON\.stringify\(\{([^}]*)\}\)/.exec(serviceCode)
  assert.ok(body, 'could not find the request body in usagePing.ts')
  const keys = body![1]
    .split(',')
    .map((k) => k.split(':')[0].trim())
    .filter(Boolean)
  assert.deepEqual(keys.sort(), ['appVersion', 'events'], `body carries unexpected keys: ${keys}`)
})

test('the client never persists the batch — it would re-trigger ePrivacy 5(3)', () => {
  // The buffer is the one part of this feature that COULD legally have been written to the device,
  // and doing so would be "storing information on terminal equipment" for a non-essential purpose:
  // consent required, and the consent-free basis in docs/usage-analytics.md gone. Losing a buffer on
  // a hard kill is the accepted price, which is also why `app_open` is not in it.
  for (const store of ['localStorage', 'sessionStorage', 'indexedDB', 'document\\.cookie']) {
    assert.ok(
      !new RegExp(store).test(serviceCode),
      `usagePing.ts persists the batch via ${store.replace('\\', '')}`,
    )
  }
})

test('the client never inspects the response', () => {
  // Owner requirement, 2026-09-18: nothing about a usage ping may reach the UI. Because every path in
  // `usagePing.ts` is caught, reading the response cannot produce an OBSERVABLE failure — a behavioural
  // test for this is vacuous, which the re-break pass demonstrated. So the invariant is pinned here, on
  // the source, where it is real: the module fires and forgets, and never branches on what came back.
  for (const forbidden of ['\\.ok\\b', '\\.json\\(', '\\.status\\b', '\\.text\\(', '\\.headers\\b']) {
    assert.ok(
      !new RegExp(forbidden).test(serviceCode),
      `usagePing.ts inspects the response (${forbidden})`,
    )
  }
})

test('the client addresses the API through apiUrl()', () => {
  // A bare '/api/usage' is answered by the app BUNDLE inside the native shell — 200, index.html, no
  // error, and the ping silently never reaches a server. See src/config/apiBase.ts.
  assert.match(serviceCode, /fetch\(\s*apiUrl\(/, 'usagePing must fetch through apiUrl()')
  assert.ok(!/fetch\(\s*['"`]\//.test(serviceCode), 'usagePing fetches a bare absolute path')
})

test('the increment is counted by the SERVER, never taken from the request', () => {
  // Batching made this the sharpest guard in the file. The request carries event NAMES; the server
  // tallies them. A `{event, count}` shape would hand the caller the increment directly, so a single
  // poisoned request could add 999999 instead of at most MAX_EVENTS_PER_REQUEST.
  assert.match(endpointCode, /DO UPDATE SET n = usage_counter\.n \+ EXCLUDED\.n/)
  // The counts passed to the query must come from our own Map, not from the body.
  assert.match(endpointCode, /counts\.set\([^)]*\(counts\.get\([^)]*\)\s*\?\?\s*0\)\s*\+\s*1\)/,
    'the endpoint does not tally the events itself')
  assert.match(endpointCode, /\[\.\.\.counts\.values\(\)\]/, 'the query does not use the server tally')
  // And nothing anywhere reads a count off the request.
  assert.ok(!/body\.(count|n)\b/.test(endpointCode), 'the endpoint reads a count from the body')
})

test('the batch is bounded by the shared cap', () => {
  // The third dimension of a poisoned request: the allow-list caps WHICH rows exist, the rate limit
  // caps how many requests arrive, and this caps how much one request can add.
  assert.match(endpointCode, /slice\(0,\s*MAX_EVENTS_PER_REQUEST\)/, 'the event array is unbounded')
  const shared = readFileSync(new URL('../src/config/usageEvents.ts', import.meta.url), 'utf8')
  assert.match(shared, /export const MAX_EVENTS_PER_REQUEST\s*=\s*\d+/, 'the cap is not shared')
})

test('the INSERT is parameterised', () => {
  const insert = /INSERT INTO usage_counter[\s\S]*?`/.exec(endpointCode)
  assert.ok(insert, 'could not find the INSERT')
  assert.ok(insert![0].includes('$1') && insert![0].includes('$2'), 'INSERT is not parameterised')
  assert.ok(!/\$\{/.test(insert![0]), 'INSERT interpolates a template expression')
})

test('the table has no column that could hold a person', () => {
  const ddl = /CREATE TABLE IF NOT EXISTS usage_counter\s*\(([\s\S]*?)\)\s*`/.exec(endpointCode)
  assert.ok(ddl, 'could not find the CREATE TABLE')
  const columns = ddl![1]
    .split('\n')
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((c) => c && c !== 'PRIMARY')
  assert.deepEqual(columns.sort(), ['app_version', 'day', 'event', 'n'])
})

test('the endpoint applies the shared trust-boundary helpers', () => {
  for (const helper of ['applyCors', 'isAllowedOrigin', 'rateLimit']) {
    assert.ok(endpointCode.includes(helper), `api/usage.ts does not call ${helper}`)
  }
  assert.match(endpointCode, /req\.method !== 'POST'[\s\S]{0,80}405/, 'non-POST is not refused')
})

test('the dev server mirrors the endpoint', () => {
  // An endpoint that only exists on Vercel cannot be tested before it is deployed.
  const dev = readFileSync(new URL('../dev-server.js', import.meta.url), 'utf8')
  assert.match(dev, /app\.post\('\/api\/usage'/, 'dev-server.js has no /api/usage mirror')
  assert.match(dev, /ON CONFLICT \(day, event, app_version\)/, 'the dev mirror does not increment')
})

// `code()` is wrong for dev-server.js: its Express globs ('/x/*splat') open a false /* block and swallow
// real code. Line comments are the only prose that could hold these exact strings, so strip just those.
const devSource = () =>
  readFileSync(new URL('../dev-server.js', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n')

test('the kill switch drops a write BEFORE any database call, in both copies', () => {
  // Neon Free suspends the app's database for the month once its compute allowance is spent, and the
  // shell has no OTA path — an env switch is the only brake on binaries already in the field.
  const devCode = devSource()
  for (const [name, src, sw] of [
    ['api/usage.ts', endpointCode, "optionalEnv('USAGE_COUNTER') === 'off'"],
    ['dev-server.js', devCode.slice(devCode.indexOf("app.post('/api/usage'")), "process.env.USAGE_COUNTER?.trim() === 'off'"],
  ] as const) {
    const at = src.indexOf(sw)
    assert.ok(at >= 0, `${name} has no USAGE_COUNTER=off switch`)
    assert.ok(at < src.indexOf('INSERT INTO usage_counter'), `${name} checks the switch after the write`)
  }
})

test('USAGE_DATABASE_URL routes every counter statement away from the main pool', () => {
  assert.match(endpointCode, /optionalEnv\('USAGE_DATABASE_URL'\)/, 'api/usage.ts ignores USAGE_DATABASE_URL')
  assert.ok(!/from '\.\.\/lib\/db\.js'[^\n]*\bquery\b(?! as)/.test(endpointCode), 'the bare main-pool query is still imported')
  const devCode = devSource()
  const block = devCode.slice(devCode.indexOf("app.post('/api/usage'"), devCode.indexOf("app.all('/api/usage'"))
  assert.ok(!block.includes('dbQuery('), 'the dev mirror still writes through the main pool')
  assert.ok(devCode.includes("process.env.USAGE_DATABASE_URL"), 'dev-server.js ignores USAGE_DATABASE_URL')
})

test('the adult-door funnel is actually wired to its three surfaces', () => {
  // The counter goes quiet silently if a refactor drops a call — there is no error, just a number that
  // stops moving, which is indistinguishable from "no adult ever tried". Pin the call sites.
  const read = (rel: string) => code(readFileSync(new URL(rel, import.meta.url), 'utf8'))

  const chip = read('../src/components/common/ProfileChip.tsx')
  assert.match(chip, /reportAdultStep\('chip'\)/, 'the identity pill no longer reports')
  // Both the tap and the keyboard path must go through one helper, or the count drifts from reality.
  assert.equal((chip.match(/setOpen\(true\)/g) ?? []).length, 1,
    'ProfileChip opens the sheet from more than one place — route them through openSheet()')

  const sheet = read('../src/components/auth/WhoIsPlayingSheet.tsx')
  assert.match(sheet, /reportAdultStep\('door'\)/, 'the Indstillinger row no longer reports')

  const surface = read('../src/components/adult/AdultSurface.tsx')
  assert.match(surface, /reportAdultStep\('gateOk'\)/, 'opening the adult surface no longer reports')
  assert.match(surface, /reportAdultStep\('gateFail'\)/, 'a refused gate no longer reports')
  // gateOk must follow the gate, not precede it — otherwise a cancelled PIN counts as getting in.
  assert.ok(
    surface.indexOf("reportAdultStep('gateOk')") > surface.indexOf("requirePin('adultMenu'"),
    'gateOk is reported before the gate resolves',
  )
})

test('the route reporter is handed the LIVE front-page flag, not a literal', () => {
  // One build renders both front pages — the doors ride the Krea gate, and `master` deploys the web
  // days before the 1.3 binary clears review. Pass `true` here and every six-card page on
  // production starts filing door rows; pass nothing and the doors are invisible once they open.
  // Only `fourDoorsShown()` tracks what the child is actually looking at.
  const app = code(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'))
  assert.match(
    app,
    /reportRoute\(location\.pathname,\s*fourDoorsShown\(\)\)/,
    'App.tsx no longer reports the route against the live four-door flag',
  )
  assert.match(app, /import \{ fourDoorsShown \}/, 'App.tsx defines the flag locally instead of importing it')
  // The default must stay the GATED world: a forgotten argument may under-report a door, never
  // attribute a six-card screen to one.
  assert.match(
    code(readFileSync(new URL('../src/config/usageEvents.ts', import.meta.url), 'utf8')),
    /function eventForPath\(pathname: string, fourDoors = false\)/,
    'eventForPath no longer defaults to the pre-door names',
  )
})

test('the sign-in offer counts being SEEN as well as being tapped', () => {
  // The pair only answers anything together: `offer` alone cannot say whether adults decline, `tap`
  // alone cannot say whether they ever got the chance. Losing either silently turns the other into a
  // number with no denominator — which is exactly the state that made this worth building.
  const read = (rel: string) => code(readFileSync(new URL(rel, import.meta.url), 'utf8'))
  const offer = read('../src/components/adult/panes/konto/SignInOffer.tsx')

  assert.match(offer, /reportSignInStep\('offer'\)/, 'the offer no longer counts being seen')
  assert.match(offer, /reportSignInStep\('tap'\)/, 'the sign-in buttons no longer count a press')
  // Once per open, not once per render: the effect must have an EMPTY dep array, or a re-render from
  // the reward count or a busy flag inflates the impression count without anyone seeing anything.
  assert.match(
    offer,
    /useEffect\(\s*\(\)\s*=>\s*\{\s*reportSignInStep\('offer'\)\s*\}\s*,\s*\[\]\s*\)/,
    'the offer impression is not a once-per-mount effect with an empty dep array',
  )
  // The press is counted BEFORE the provider call: on the web that call ends in `location.assign`
  // and deliberately never settles, so anything reported after it is never sent.
  assert.ok(
    offer.indexOf("reportSignInStep('tap')") < offer.indexOf('await startSocialSignIn'),
    'the tap is counted after the call that navigates away',
  )
})

test('a finished Krea piece is counted in each activity that HAS a finish, and nowhere else', () => {
  // `route:krea_*` counts openings; without these there is no completion rate, and "opened and
  // abandoned" looks identical to "played happily".
  const read = (rel: string) => code(readFileSync(new URL(rel, import.meta.url), 'utf8'))

  for (const [file, piece] of [
    ['TegnMedMigGame', 'guide'],
    ['FarvelaegGame', 'color'],
    ['PerlepladeGame', 'beads'],
  ] as const) {
    const game = read(`../src/components/krea/${file}.tsx`)
    assert.match(game, new RegExp(`reportKreaFinished\\('${piece}'\\)`), `${file} no longer counts a finish`)
    // Exactly one, beside the one `completeTask` — a second would double-count a piece.
    assert.equal((game.match(/reportKreaFinished\(/g) ?? []).length, 1,
      `${file} reports a finish from more than one place`)
    assert.equal((game.match(/completeTask\(/g) ?? []).length, 1,
      `${file} grants XP from more than one place — the finish count would drift from the XP`)
  }

  // FRI TEGNING HAS NO FINISH AND MUST NOT GET ONE. It earns nothing by design (Lepper 1973), and a
  // counter is the cheapest way for a future session to start treating it as if it did.
  const fri = read('../src/components/krea/FriTegningGame.tsx')
  assert.ok(!fri.includes('reportKreaFinished'), 'Fri Tegning now reports a finish it does not have')
  assert.ok(!fri.includes('completeTask('), 'Fri Tegning now grants a task reward')
})

test('the weekly-reminder funnel is wired to every step it counts', () => {
  // Re-engagement PRD-01 W4. Same failure shape as the adult funnel above: drop a call and the number
  // simply stops moving, which reads exactly like "nobody opted in". Every NOTIFY_EVENTS key must be
  // reported somewhere, and through the service's one reporter rather than an ad-hoc string.
  const read = (rel: string) => code(readFileSync(new URL(rel, import.meta.url), 'utf8'))
  const svc = read('../src/services/reminders.ts')
  for (const step of ['offered', 'yes', 'notNow', 'granted', 'denied', 'tapOpen', 'toggleOn', 'toggleOff']) {
    // Inside a report( … ) call, so a mention in a type or a prefs literal cannot satisfy it.
    assert.ok(new RegExp(`report\\([^)]*'${step}'`).test(svc), `reminders.ts never reports ${step}`)
  }
  assert.match(svc, /report: reportNotifyStep/, 'the live env does not report through reportNotifyStep')
  // `yes` is counted BEFORE the iOS dialog — a never-answered dialog must still show up as a yes.
  assert.ok(svc.indexOf("this.env.report('yes')") < svc.indexOf('return this.requestAndApply()'), 'yes is counted after the dialog')
  const prompt = read('../src/components/reminders/ReminderPrompt.tsx')
  assert.match(prompt, /reminders\.noteOffered\(\)/, 'the card no longer counts being shown')
  const app = read('../src/App.tsx')
  assert.match(app, /reminders\.start\(\)/, 'App no longer starts the reminder service — no tap is ever counted')
})
