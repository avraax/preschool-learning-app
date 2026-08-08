// `node scripts/verify-build-tier.mjs <tier>` — read what was BUILT, not what the source says.
//
// "Local green proves nothing about the deployed artifact" (CLAUDE.md). Two outages here were correct
// in source and broken only in what shipped, so this runs after `npm run build`, in both CI workflows
// and locally, and inspects `dist/`.
//
// THE NAIVE CHECK IS WRONG, AND IT IS WORTH SAYING WHY. The obvious rule — "the expected origin must be
// present and the other absent" — cannot hold, because `src/config/backendTarget.ts` declares
// PRODUCTION_API_ORIGIN as the constant the badge compares against. A STAGING bundle therefore contains
// the production host legitimately (measured 2026-08-08: 1 staging occurrence, 2 production ones, both
// the comparison constant). Requiring its absence would fail every staging build.
//
// The asymmetric rule that IS exact, and is measured rather than assumed:
//   production build → the STAGING origin appears ZERO times (nothing references it)
//   staging build    → the STAGING origin appears at least once (it is the compiled SHELL_API_ORIGIN)
// Since a production build contains zero staging occurrences, "at least one" proves the staging literal
// was compiled in. Both directions therefore fail if the tier vars are swapped.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { BUILD_TIERS } from './set-build-tier.mjs'

const DIST = 'dist'
const MIN_PREBAKED_CLIPS = 1800

const tier = process.argv[2]
if (!BUILD_TIERS[tier]) {
  console.error(
    `usage: node scripts/verify-build-tier.mjs <${Object.keys(BUILD_TIERS).join('|')}>`,
  )
  process.exit(2)
}

if (!existsSync(DIST)) {
  console.error(`[verify-build-tier] no ${DIST}/ — run \`npm run build\` first`)
  process.exit(1)
}

const failures = []
/** `label` says what was CHECKED; `why` says what it means when it fails. Printing the failure text on
 *  a passing line reads as an error report and makes a green run look red. */
const note = (ok, label, why) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) {
    console.log(`       ${why}`)
    failures.push(label)
  }
}

// ---- the JS bundle -------------------------------------------------------------------------------

const assets = path.join(DIST, 'assets')
const js = readdirSync(assets)
  .filter((f) => f.endsWith('.js'))
  .map((f) => readFileSync(path.join(assets, f), 'utf8'))
  .join('\n')

const count = (needle) => js.split(needle).length - 1
const stagingHits = count(BUILD_TIERS.staging.apiOrigin)

console.log(`[verify-build-tier] ${tier}`)
console.log(`  staging-origin occurrences in dist/assets/*.js: ${stagingHits}`)

if (tier === 'production') {
  note(
    stagingHits === 0,
    'the staging host is absent',
    `a production bundle must not reference ${BUILD_TIERS.staging.apiOrigin} — the tier vars are swapped`,
  )
} else {
  note(
    stagingHits > 0,
    'the staging host is compiled in',
    'a staging bundle must carry the staging host as SHELL_API_ORIGIN — this looks like a production build',
  )
}

// The production host is expected in BOTH tiers (see the header) — but it must always be there, or the
// badge's production comparison has been optimised away and every build would show a pill.
note(
  count(BUILD_TIERS.production.apiOrigin) > 0,
  'the production origin constant survives',
  'backendLabel() has nothing to compare against — every build would show a TEST pill',
)

// The harness bypass must never reach a deploy or a binary. `harnessBuild.test.ts` pins the WIRING;
// this pins the ARTIFACT, which is the half a unit test cannot see.
note(
  count('nogate') === 0,
  'the dev harness is absent',
  `found ${count('nogate')} occurrence(s) of 'nogate' — this is a harness build and must never ship`,
)

// ---- the narration ------------------------------------------------------------------------------
//
// Folded in from codemagic.yaml's own "Verify the narration actually reached dist" step so there is ONE
// implementation rather than two that drift. The failure it catches is the most expensive silent one
// available: a binary that installs, launches, renders perfectly and is MUTE, because dist/sounds/tts
// was empty — invisible in a screenshot, and the web deployment unaffected.

const ttsDir = path.join(DIST, 'sounds', 'tts')
const clips = existsSync(ttsDir) ? readdirSync(ttsDir).filter((f) => f.endsWith('.mp3')).length : 0
note(
  clips >= MIN_PREBAKED_CLIPS,
  `the prebaked narration reached dist (${clips} clips)`,
  `only ${clips} clips reached dist/sounds/tts, need >= ${MIN_PREBAKED_CLIPS} — the app would ship MUTE`,
)

if (failures.length) {
  console.error(`\n[verify-build-tier] ${failures.length} check(s) failed for tier "${tier}"`)
  process.exit(1)
}
console.log(`\n[verify-build-tier] dist/ is a valid ${tier} artifact`)
