// TWO TIERS, AND EXACTLY TWO (staging PRD W8).
//
// Without this, a TestFlight build points at the wrong database while looking perfectly healthy — the
// games all work, because the games are offline by design. Nothing in the app, the binary or the build
// log would say otherwise; the only symptom is the child's Reward Book quietly diverging.
//
// The tuple is (BUNDLE_ID, BL_TIER, BL_API_ORIGIN) and it is declared in TWO files that are edited
// months apart: `scripts/set-build-tier.mjs`'s table (what the CI Mac writes into the native project)
// and `codemagic.yaml`'s workflow vars (what CI passes to the build). Keeping them in one test is the
// only thing that makes a mismatch visible.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { BUILD_TIERS } from '../../scripts/set-build-tier.mjs'
import { PRODUCTION_API_ORIGIN, STAGING_API_ORIGIN } from './backendTarget.ts'

const ROOT = path.join(import.meta.dirname, '..', '..')
const yaml = readFileSync(path.join(ROOT, 'codemagic.yaml'), 'utf8')
/** Comments stripped — this file's own prose names every string asserted below. */
const ci = yaml.replace(/^\s*#.*$/gm, '')

const WORKFLOW_FOR = { production: 'ios-release', staging: 'ios-staging' } as const

test('there are exactly TWO tiers, and the table agrees with backendTarget.ts', () => {
  assert.deepEqual(Object.keys(BUILD_TIERS).sort(), ['production', 'staging'])
  // The hosts live in ONE place (`backendTarget.ts`); the build table must not re-spell them.
  assert.equal(BUILD_TIERS.production.apiOrigin, PRODUCTION_API_ORIGIN)
  assert.equal(BUILD_TIERS.staging.apiOrigin, STAGING_API_ORIGIN)
  // A suffixed sibling, not a second unrelated id: staging must be production's id plus a suffix, so a
  // glance at either tells you which app it is.
  assert.equal(BUILD_TIERS.staging.bundleId, `${BUILD_TIERS.production.bundleId}.staging`)
  // …and the home-screen names must differ, because two identical icons on the one iPad is the whole
  // cost of a separate app (PRD §6.1) and the name is half of what mitigates it.
  assert.notEqual(BUILD_TIERS.production.appName, BUILD_TIERS.staging.appName)
})

test('codemagic.yaml declares exactly TWO workflows, with the two allowed names', () => {
  // A third workflow is how a tier gets added without anyone deciding to add one.
  const names = [...ci.matchAll(/^ {2}([a-z0-9-]+):$/gm)].map((m) => m[1])
  assert.deepEqual(names.sort(), ['ios-release', 'ios-staging'])
})

test('each workflow carries the RIGHT triple — not merely a valid-looking one', () => {
  for (const [tier, workflow] of Object.entries(WORKFLOW_FOR)) {
    // Slice the workflow's own block, so one workflow's vars can never satisfy the other's assertion.
    // A regex cannot see YAML structure; anchoring on the next two-space key is what bounds it.
    const start = ci.indexOf(`\n  ${workflow}:`)
    assert.ok(start > 0, `${workflow} is missing from codemagic.yaml`)
    const rest = ci.slice(start + 1)
    const nextAt = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n/)
    const block = nextAt >= 0 ? rest.slice(0, nextAt + 1) : rest

    const t = BUILD_TIERS[tier as keyof typeof BUILD_TIERS]
    // END-ANCHORED. Unanchored, `com.vraa.earlylearning` also matches inside
    // `com.vraa.earlylearning.staging` — the exact failure that once let `com.vraa.earlylearning2`
    // through, and a suffixed staging id makes it live again.
    assert.match(
      block,
      new RegExp(`BUNDLE_ID:\\s*${t.bundleId.replace(/\./g, '\\.')}\\s*$`, 'm'),
      `${workflow}: BUNDLE_ID is not ${t.bundleId}`,
    )
    assert.match(block, new RegExp(`BL_TIER:\\s*${tier}\\s*$`, 'm'), `${workflow}: BL_TIER is not ${tier}`)
    assert.match(
      block,
      new RegExp(`BL_API_ORIGIN:\\s*${t.apiOrigin.replace(/[.:/]/g, '\\$&')}\\s*$`, 'm'),
      `${workflow}: BL_API_ORIGIN is not ${t.apiOrigin}`,
    )

    // The vars are useless unless they are CONSUMED. Declaring them and never passing them anywhere
    // leaves all three strings agreeing while the build ignores them — the same shape as the
    // `fetch-signing-files "$BUNDLE_ID"` check in capacitorConfig.test.ts.
    assert.match(block, /node scripts\/set-build-tier\.mjs "\$BL_TIER"/, `${workflow}: never sets the tier`)
    assert.match(
      block,
      /node scripts\/verify-build-tier\.mjs "\$BL_TIER"/,
      `${workflow}: never verifies the built artifact`,
    )
    assert.match(block, /fetch-signing-files\s+"\$BUNDLE_ID"/, `${workflow}: signs something else`)
  }
})

test('the artifact check runs AFTER the build, or it inspects the previous one', () => {
  for (const workflow of Object.values(WORKFLOW_FOR)) {
    const start = ci.indexOf(`\n  ${workflow}:`)
    const rest = ci.slice(start + 1)
    const nextAt = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n/)
    const block = nextAt >= 0 ? rest.slice(0, nextAt + 1) : rest
    const setTier = block.indexOf('set-build-tier.mjs')
    const build = block.indexOf('npm run build')
    const verify = block.indexOf('verify-build-tier.mjs')
    const sync = block.indexOf('npx cap sync ios')
    assert.ok(setTier < build, `${workflow}: the tier is set after the web build`)
    assert.ok(build < verify, `${workflow}: dist/ is verified before it is built`)
    assert.ok(setTier < sync, `${workflow}: cap sync would copy the committed appId back over the tier`)
  }
})

test('CI still never auto-submits to the App Store — on EITHER workflow', () => {
  // C11 is explicitly the owner's act: a submission is a legal declaration plus a one-way door on
  // "Made for Kids". Adding a second workflow doubled the number of places this line could appear.
  assert.ok(!/submit_to_app_store/.test(ci), 'a workflow would submit to the App Store without the owner')

  // EXACTLY ONE `submit_to_testflight`, and it is production's. That flag submits to EXTERNAL beta
  // review; staging deliberately omits it, because nobody outside this household installs `BL Staging` and
  // it would put a test build in front of an Apple reviewer. It also fails post-processing without a
  // Beta App Review contact form the staging record has no reason to carry (measured on the first real
  // staging build — the IPA had already uploaded and installed).
  assert.equal(
    (ci.match(/submit_to_testflight:\s*true/g) ?? []).length,
    1,
    'staging must not submit to external beta review, and production must',
  )
  const releaseBlock = ci.slice(ci.indexOf('\n  ios-release:'))
  assert.match(releaseBlock, /submit_to_testflight:\s*true/, 'the release workflow stopped publishing')

  assert.ok(!/cyberpilot/i.test(yaml), 'the work domain is in the CI config')
})

test('only the STAGING workflow builds on a tag', () => {
  // A production build must stay a deliberate act started from the UI. A tag trigger on the release
  // workflow would make `git push --tags` ship a store candidate.
  const releaseAt = ci.indexOf('\n  ios-release:')
  const stagingBlock = ci.slice(0, releaseAt)
  const releaseBlock = ci.slice(releaseAt)
  assert.match(stagingBlock, /triggering:/, 'ios-staging has no tag trigger')
  assert.match(stagingBlock, /pattern: 'tf-\*'/)
  assert.ok(!/triggering:/.test(releaseBlock), 'ios-release has a trigger — production must be manual')
})

test('set-build-tier refuses anything outside the table, and rewrites EVERY occurrence', () => {
  const src = readFileSync(path.join(ROOT, 'scripts', 'set-build-tier.mjs'), 'utf8')
    .replace(/^\s*\/\*\*[\s\S]*?\*\//gm, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  // A global replace, not the first match: the pbxproj has one PRODUCT_BUNDLE_IDENTIFIER per build
  // configuration, and rewriting one leaves a project that signs differently per configuration.
  assert.match(src, /PRODUCT_BUNDLE_IDENTIFIER = \[\^;\]\+;\/g/, 'the bundle id rewrite is not global')
  assert.match(src, /if \(!target\)/, 'an unknown tier is not refused')
  assert.match(src, /refusing to write a value that is not in the table/)
  // appId must be rewritten too, or `cap sync` copies the committed id straight back over the pbxproj.
  assert.match(src, /appId:\s*'\$\{target\.bundleId\}'/)
  assert.match(src, /appName:\s*'\$\{target\.appName\}'/)
  // …and Info.plist, which is the ONLY thing that decides the home-screen name. `appName` above does
  // not reach it: Capacitor reads that when SCAFFOLDING the project, and `cap sync` leaves the plist
  // alone. Without this the two apps install under the same name — measured on the first real staging
  // build, which is the confusion the second name exists to prevent.
  assert.match(src, /CFBundleDisplayName/, 'the home-screen name is never rewritten')
  assert.match(src, /writeFileSync\(INFO_PLIST, nextPlist, 'utf8'\)/, 'the plist write is gone or not utf8')
})
