import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { allReturnSchemes, returnSchemeFor, returnSchemeUrl } from './oauth-return-scheme.ts'
import { BUILD_TIERS } from '../scripts/set-build-tier.mjs'

// THE SCHEME IS WRITTEN IN TWO PLACES AND THEY CANNOT BE ALLOWED TO DRIFT.
//
// The SERVER redirects a finished shell sign-in to `<scheme>://auth?ok=1`; the BINARY claims that scheme
// in `CFBundleURLTypes`, which `scripts/set-build-tier.mjs` writes per tier. If the two disagree, iOS
// hands the link to no app and a SUCCESSFUL sign-in ends on Safari's "the address is invalid" — after
// the session already exists, on a device, with every local check green.
//
// It also cannot be answered by reading either file alone, which is why the tables are compared rather
// than restated.

test('the server table and the build table name the same schemes', () => {
  for (const [tier, target] of Object.entries(BUILD_TIERS)) {
    assert.equal(
      returnSchemeFor(tier as 'staging' | 'production'),
      target.returnScheme,
      `tier "${tier}": the server would redirect to a scheme the binary does not claim`,
    )
  }
  assert.deepEqual(
    [...allReturnSchemes()].sort(),
    Object.values(BUILD_TIERS)
      .map((t) => t.returnScheme)
      .sort(),
    'one table knows about a tier the other does not',
  )
})

test('the two tiers claim DIFFERENT schemes', () => {
  // Both apps are installed on the owner's iPad. iOS leaves it UNDEFINED which app wins a scheme two
  // apps claim, so a shared scheme is a staging sign-in that may open production — a cross-tier session
  // hand-off that would look like a ghost.
  const schemes = Object.values(BUILD_TIERS).map((t) => t.returnScheme)
  assert.equal(new Set(schemes).size, schemes.length, `two tiers share a URL scheme: ${schemes.join(', ')}`)
})

test('the committed plist claims PRODUCTION’s scheme', () => {
  // Same rule as the bundle id and the display name: the committed tree is always production's, and CI
  // rewrites a checkout for staging. A staging scheme left behind here would ship in a release build.
  const plist = readFileSync('ios/App/App/Info.plist', 'utf8').replace(/<!--[\s\S]*?-->/g, ' ')
  const m = plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>([^<]*)<\/string>/)
  assert.ok(m, 'Info.plist declares no CFBundleURLTypes — the shell cannot be returned to at all')
  assert.equal(m![1], BUILD_TIERS.production.returnScheme)
})

test('the return URL carries no secret', () => {
  // The claim credential is the flowId this app already holds in ITS OWN localStorage. Putting anything
  // claimable in the return URL would recreate the session-theft hole the whole cookie-free design
  // exists to avoid: the link is handed to whichever app claims the scheme.
  for (const tier of ['staging', 'production'] as const) {
    const url = returnSchemeUrl(tier)
    assert.match(url, /^[a-z-]+:\/\/auth\?ok=1$/, `${tier}: unexpected return URL ${url}`)
  }
})

test('@capacitor/app is a real dependency of the shell', () => {
  // Without the plugin there is no `appUrlOpen`, so the listener never registers, the client never says
  // `shell-scheme`, and the whole layer degrades silently to the terminal page. That degradation is
  // correct — but it should be a decision, not a missing dependency nobody noticed.
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>
  }
  assert.ok(pkg.dependencies['@capacitor/app'], '@capacitor/app is not installed')
})
