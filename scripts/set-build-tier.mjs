// `node scripts/set-build-tier.mjs <tier>` — point the native project at one of the two tiers.
//
// Runs ON THE CI MAC, after `npm ci` and before `npx cap sync ios`. It mutates a CHECKOUT, never a
// commit: nothing is pushed from CI, and the pbxproj going dirty here is the same expected state as
// `src/config/version.ts` after a build.
//
// THE TABLE IS THE WHOLE SCRIPT. It refuses any tier outside the two rows and refuses to write a value
// it did not compute from them, so a typo in `codemagic.yaml` cannot produce a binary signed as
// something plausible-looking. `src/config/buildTiers.test.ts` reads this table and requires the CI
// file to agree with it.
//
// For `production` it is a NO-OP THAT STILL VERIFIES — the release workflow proves the committed tree
// is clean rather than assuming it. That matters because this script is the one thing that can leave a
// staging identifier behind in a working tree.

import { readFileSync, writeFileSync } from 'node:fs'

export const BUILD_TIERS = {
  production: {
    bundleId: 'com.vraa.earlylearning',
    // The HOME-SCREEN name, not the App Store listing name. Under an icon there is room for one word.
    appName: 'Børnelæring',
    apiOrigin: 'https://boernelaering.dk',
  },
  staging: {
    bundleId: 'com.vraa.earlylearning.staging',
    // Deliberately not "Børnelæring" — two identical icons on the one iPad is the cost of a separate
    // app, and the name is half of what mitigates it (the badge is the other half).
    appName: 'BL Test',
    apiOrigin: 'https://staging.boernelaering.dk',
  },
}

const PBXPROJ = 'ios/App/App.xcodeproj/project.pbxproj'
const CAP_CONFIG = 'capacitor.config.ts'

/** Every value the table permits, for the "refuse to write anything else" check. */
const ALL_BUNDLE_IDS = Object.values(BUILD_TIERS).map((t) => t.bundleId)
const ALL_APP_NAMES = Object.values(BUILD_TIERS).map((t) => t.appName)

export function setBuildTier(tier, { dryRun = false } = {}) {
  const target = BUILD_TIERS[tier]
  if (!target) {
    throw new Error(
      `[set-build-tier] unknown tier ${JSON.stringify(tier)} — expected one of ${Object.keys(BUILD_TIERS).join(', ')}`,
    )
  }
  // Belt and braces: the value must come FROM the table, not merely be compared against it.
  if (!ALL_BUNDLE_IDS.includes(target.bundleId) || !ALL_APP_NAMES.includes(target.appName)) {
    throw new Error('[set-build-tier] refusing to write a value that is not in the table')
  }

  const changes = []

  // --- 1. EVERY PRODUCT_BUNDLE_IDENTIFIER, not the first. The pbxproj carries one per build
  //        configuration (Debug and Release, per target), and rewriting only one produces a project
  //        that signs differently depending on which configuration Xcode picks.
  const pbx = readFileSync(PBXPROJ, 'utf8')
  const found = [...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1].trim())
  if (!found.length) throw new Error(`[set-build-tier] no PRODUCT_BUNDLE_IDENTIFIER in ${PBXPROJ}`)
  for (const value of found) {
    if (!ALL_BUNDLE_IDS.includes(value.replace(/^"|"$/g, ''))) {
      throw new Error(
        `[set-build-tier] ${PBXPROJ} holds an unrecognised bundle id ${JSON.stringify(value)} — ` +
          `refusing to touch a project that is not in a known state`,
      )
    }
  }
  const nextPbx = pbx.replace(
    /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
    `PRODUCT_BUNDLE_IDENTIFIER = ${target.bundleId};`,
  )
  if (nextPbx !== pbx) changes.push(`${PBXPROJ}: ${found.length} bundle id(s) -> ${target.bundleId}`)

  // --- 2. capacitor.config.ts's appId and appName, so `cap sync` and the Info.plist display name
  //        follow. Without appId here the sync writes the committed id back over step 1.
  const cap = readFileSync(CAP_CONFIG, 'utf8')
  let nextCap = cap.replace(/appId:\s*'[^']*'/, `appId: '${target.bundleId}'`)
  nextCap = nextCap.replace(/appName:\s*'[^']*'/, `appName: '${target.appName}'`)
  if (!/appId:\s*'/.test(cap) || !/appName:\s*'/.test(cap)) {
    throw new Error(`[set-build-tier] could not find appId/appName in ${CAP_CONFIG}`)
  }
  if (nextCap !== cap) changes.push(`${CAP_CONFIG}: ${target.bundleId} / ${target.appName}`)

  if (!dryRun) {
    if (nextPbx !== pbx) writeFileSync(PBXPROJ, nextPbx)
    if (nextCap !== cap) writeFileSync(CAP_CONFIG, nextCap)
  }
  return { tier, target, changes }
}

// Only act when run directly — `buildTiers.test.ts` imports BUILD_TIERS from here, and importing a
// module must never rewrite the native project.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const tier = process.argv[2]
  const { target, changes } = setBuildTier(tier)
  console.log(`[set-build-tier] ${tier} -> ${target.bundleId} / ${target.appName} / ${target.apiOrigin}`)
  if (changes.length) {
    for (const c of changes) console.log(`  ${c}`)
  } else {
    // The production path lands here on a clean tree, and that is a PASS, not a warning: it proves the
    // committed values are already correct rather than assuming so.
    console.log('  no changes — the committed tree already matches this tier')
  }
}
