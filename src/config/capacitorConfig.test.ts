// The native shell's configuration, as a test (App Store PRD §3.1, §3.9 — Phase B1–B4).
//
// Everything pinned here has the same failure shape: it is correct on this Windows machine, invisible
// from here when it breaks, and only observable on a remote CI Mac or in an App Store Connect upload
// rejection. `npm run build` cannot see any of it — the web build has no idea a binary exists.
//
// A plain-Node test can read all of it because the native config is text: a TS config module, an XML
// plist, a strings file and a Swift manifest.

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..', '..')
const read = (...rel: string[]): string => readFileSync(path.join(ROOT, ...rel), 'utf8')

const CAP_CONFIG = 'capacitor.config.ts'
const INFO_PLIST = ['ios', 'App', 'App', 'Info.plist']
const PBXPROJ = ['ios', 'App', 'App.xcodeproj', 'project.pbxproj']

/** Strip comments — every guard below would otherwise be satisfied by the prose explaining it. */
const stripTs = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
const stripXml = (s: string): string => s.replace(/<!--[\s\S]*?-->/g, ' ')

// ---- §3.1: the web build is BUNDLED, never served from Vercel -------------------------------------

test('capacitor.config.ts sets NO server.url — the shell is not a thin client', () => {
  // The single most consequential line in the native config, and the one a "make iteration faster"
  // change would add. `server.url` points the shell at the deployment, which is Guideline 4.2.7(e)
  // ("thin clients for cloud-based apps are not appropriate") and makes every push a remote code load
  // under 2.5.2. It also silently kills offline play, which is the app's best 4.2 argument.
  const cfg = stripTs(read(CAP_CONFIG))
  assert.ok(!/\burl\s*:/.test(cfg), 'capacitor.config.ts declares a server.url')
  assert.match(cfg, /webDir:\s*'dist'/, 'webDir is not dist')
})

test('no OTA / live-update service is installed', () => {
  // Guideline 2.5.2 forbids downloading "code which introduces or changes features or functionality of
  // the app". These packages exist precisely to do that, and adding one is a plausible-sounding way to
  // avoid waiting for review.
  const pkg = read('package.json')
  for (const banned of ['live-update', 'capawesome', '@ionic/appflow', 'capacitor-updater']) {
    assert.ok(!pkg.includes(banned), `${banned} is an OTA updater — Guideline 2.5.2 forbids it`)
  }
})

test('the scheme and hostname are the Capacitor defaults, written down', () => {
  // Written out rather than left implicit: `iosScheme` is load-bearing for shell detection (next test),
  // and changing either would not fail a build — it would change behaviour on a device only.
  const cfg = stripTs(read(CAP_CONFIG))
  assert.match(cfg, /iosScheme:\s*'capacitor'/)
  assert.match(cfg, /hostname:\s*'localhost'/)
})

test("the shell's runtime detection matches the scheme the config actually sets", () => {
  // `runtimeTarget.ts` decides "am I in the shell?" from the page protocol, with no Capacitor import.
  // That is only correct while `iosScheme` really is `capacitor` — change the scheme and every
  // shell-gated behaviour (update banner, lazyWithReload, swCleanup, passkeys, Google sign-in) silently
  // reverts to its web branch inside the binary. Nothing else connects these two files.
  assert.match(stripTs(read(CAP_CONFIG)), /iosScheme:\s*'capacitor'/)
  assert.match(stripTs(read('src', 'config', 'runtimeTarget.ts')), /'capacitor:'/)
})

// ---- §3.9: the native project requirements --------------------------------------------------------

test('the deployment target is 17.0 — the floor device, not the SDK', () => {
  // The child's iPad Pro 2nd gen is on iPadOS 17.7.11, its terminal OS. Apple requires building against
  // the iOS 26 SDK, but SDK and deployment target are independent, and Xcode 26 supports a target as low
  // as iOS 15. Raising this past 17.0 does not fail anywhere in this repo — it makes the app refuse to
  // install on the only device that matters. 17.0 also matches vite.config.ts's ['safari17','ios17'].
  const pbx = read(...PBXPROJ)
  const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map((m) => m[1])
  assert.ok(targets.length >= 2, 'no deployment target found in the Xcode project')
  for (const t of targets) {
    assert.equal(t, '17.0', `a build configuration targets iOS ${t}, not 17.0`)
  }
})

test('the app is universal, and iPhone is locked to landscape', () => {
  // The owner chose universal (PRD §4.2), which makes the 6.9" iPhone screenshot set mandatory AND
  // means the reviewer will test on an iPhone. The design is landscape-first.
  assert.match(read(...PBXPROJ), /TARGETED_DEVICE_FAMILY = "1,2";/)
  const plist = stripXml(read(...INFO_PLIST))
  const iphone = plist.match(
    /<key>UISupportedInterfaceOrientations~iphone<\/key>\s*<array>([\s\S]*?)<\/array>/,
  )
  assert.ok(iphone, 'no iPhone-specific orientation list — iPhone inherits portrait')
  assert.ok(!/Portrait/.test(iphone[1]), 'iPhone still allows portrait')
  assert.match(iphone[1], /LandscapeLeft/)
  assert.match(iphone[1], /LandscapeRight/)
})

test('the app declares NO microphone or camera use anywhere in the native project', () => {
  // The app has no speech input and no camera. A purpose string is not harmless boilerplate: iOS shows
  // it to the adult, App Review reads it as a feature claim, and the privacy policy
  // (`legalContent.ts`) states plainly that neither device is used. So the ABSENCE is the invariant —
  // re-adding either key without re-opening that policy would make a published document false.
  const plist = stripXml(read(...INFO_PLIST))
  for (const key of [
    'NSMicrophoneUsageDescription',
    'NSCameraUsageDescription',
    'NSSpeechRecognitionUsageDescription',
  ]) {
    assert.ok(!plist.includes(key), `${key} is back in Info.plist but no feature uses it`)
  }
  // The privacy manifest must not declare audio the app cannot capture either. Comments stripped
  // first: this file's own header explains WHY there is no audio entry, and a naive `includes` would
  // be satisfied by that prose.
  const manifest = read('ios', 'App', 'App', 'PrivacyInfo.xcprivacy').replace(/<!--[\s\S]*?-->/g, ' ')
  assert.ok(
    !manifest.includes('NSPrivacyCollectedDataTypeAudioData'),
    'the privacy manifest declares audio collection the app cannot perform',
  )
  // …and no client code may reach for a capture device at all. Two shapes of self-match had to be
  // excluded, and both made the guard fail against a correct tree: `getUserMedia` appears in the prose
  // explaining WHY this guard exists (so the needle is `mediaDevices`), and this file is itself under
  // `src/` (so `:(exclude)*.test.ts` keeps the needle from matching the line that carries it). `git
  // grep` exits 1 on NO match, which is the passing case, so the throw is caught rather than fatal.
  let hits: string
  try {
    hits = execFileSync('git', ['grep', '-l', 'mediaDevices', '--', 'src', 'api', 'lib', ':(exclude)*.test.ts'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
  } catch {
    hits = ''
  }
  assert.equal(hits, '', `media capture is back in: ${hits}`)
})


test('PrivacyInfo.xcprivacy is present, at the bundle root, and in the Resources phase', () => {
  assert.ok(
    existsSync(path.join(ROOT, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy')),
    'no privacy manifest — App Store Connect rejects the upload outright',
  )
  assert.match(read(...PBXPROJ), /PrivacyInfo\.xcprivacy in Resources/)
})

test('the privacy manifest declares no tracking and the RIGHT UserDefaults reason', () => {
  const x = stripXml(read('ios', 'App', 'App', 'PrivacyInfo.xcprivacy'))
  assert.match(x, /<key>NSPrivacyTracking<\/key>\s*<false\/>/)
  assert.match(x, /NSPrivacyAccessedAPICategoryUserDefaults/)
  // CA92.1 = "information that is only accessible to the app itself". C56D.1 is third-party-SDK-ONLY
  // and 1C8F.1 requires an App Group this app does not have; either would be a false declaration.
  assert.match(x, /<string>CA92\.1<\/string>/)
  assert.ok(!x.includes('C56D.1'), 'C56D.1 is third-party-SDK-only — wrong reason for a first-party app')
  assert.ok(!x.includes('1C8F.1'), '1C8F.1 requires an App Group, which this app does not have')
})

test('the declared data types match the App Store Connect questionnaire (§3.7)', () => {
  // These two lists are answered in two different places months apart. Keeping them in one test is the
  // only thing that makes a mismatch visible.
  const x = stripXml(read('ios', 'App', 'App', 'PrivacyInfo.xcprivacy'))
  for (const type of ['EmailAddress', 'UserID', 'GameplayContent', 'ProductInteraction', 'CrashData']) {
    assert.match(x, new RegExp(`NSPrivacyCollectedDataType${type}`), `${type} is not declared`)
  }
  // AudioData must NOT be here: the app captures no audio, and declaring a type it cannot collect is a
  // false disclosure rather than harmless over-disclosure.
  assert.ok(!x.includes('NSPrivacyCollectedDataTypeAudioData'), 'AudioData is declared but nothing can capture audio')
  // Nothing is collected for tracking, and nothing may claim an advertising purpose.
  assert.ok(!/Tracking<\/key>\s*<true\/>/.test(x), 'a data type is declared as used for tracking')
  assert.ok(!/Advertising/.test(x), 'an advertising purpose is declared in a Kids Category app')
})

// ---- B1: the Windows-authored tree has to build on a Mac ------------------------------------------

test('Package.swift uses POSIX paths — `cap sync` on Windows writes backslashes', () => {
  // The owner develops on Windows and builds on a CI Mac. `npx cap sync ios` writes local plugin paths
  // with the HOST separator, so a bare sync here emits `path: "..\..\..\node_modules\@capacitor\..."`,
  // which Swift Package Manager on macOS cannot resolve. Nothing on Windows reads this file, so the
  // only symptom is a package-resolution failure in CI. `npm run cap:sync` re-normalises it.
  // Comments stripped: the header of that file QUOTES the broken Windows path as the example of what
  // must not come back, which otherwise fails this test against a correct file.
  const swift = stripTs(read('ios', 'App', 'CapApp-SPM', 'Package.swift'))
  for (const [, p] of swift.matchAll(/path:\s*"([^"]*)"/g)) {
    assert.ok(!p.includes('\\'), `Package.swift has a Windows path: ${p} — run npm run cap:sync`)
  }
})

test('the asset catalog escapes the blanket *.json gitignore', () => {
  // `.gitignore` carries a blanket `*.json` for credentials. It swallowed `public/manifest.json` once
  // and caused a production outage, because a file it eats is invisible LOCALLY BY CONSTRUCTION — the
  // tree builds fine on the machine that has it. Here it would take the asset catalog's Contents.json,
  // i.e. the file that tells Xcode which PNG is the app icon, and an upload with no icon is rejected.
  const tracked = execFileSync('git', ['ls-files', 'ios/App/App/Assets.xcassets'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  for (const needed of [
    'ios/App/App/Assets.xcassets/Contents.json',
    'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json',
  ]) {
    assert.ok(tracked.includes(needed), `${needed} is not tracked by git — the *.json rule ate it`)
  }
  // The icon PNG itself, without which the catalog is an empty promise.
  assert.match(tracked, /AppIcon\.appiconset\/AppIcon-512@2x\.png/)
})

test('the app icon is the real one, 1024², and has NO alpha channel', () => {
  // Two separate upload rejections in one file. App Store icons may not carry transparency, and
  // Capacitor scaffolds a PLACEHOLDER icon that is a perfectly valid PNG — so nothing complains locally
  // and the first thing Apple sees is either an alpha error or the Capacitor logo.
  //
  // Read straight from the PNG header rather than through sharp, so this stays a plain-Node test:
  // bytes 0-7 signature, 8-15 the IHDR chunk header, 16-19 width, 20-23 height, 24 bit depth,
  // 25 COLOUR TYPE — where 4 (grey+alpha) and 6 (RGBA) are the two that carry an alpha channel.
  const png = readFileSync(
    path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'),
  )
  assert.equal(png.readUInt32BE(16), 1024, 'the app icon is not 1024 wide')
  assert.equal(png.readUInt32BE(20), 1024, 'the app icon is not 1024 tall')
  const colourType = png.readUInt8(25)
  assert.ok(
    colourType !== 4 && colourType !== 6,
    `the app icon has an alpha channel (PNG colour type ${colourType}) — App Store Connect rejects it`,
  )
  // …and it is not Capacitor's placeholder, which ships at exactly this path and this size.
  const shipped = readFileSync(path.join(ROOT, 'art-src', 'logo', 'app-store-icon-1024.png'))
  assert.ok(png.length !== 0, 'the app icon is empty')
  assert.ok(shipped.length > 0, "the project's own 1024 icon is missing from art-src")
})

// ---- C7: the CI config, which is the only thing that ever compiles this app --------------------

test('the bundle identifier agrees across all THREE files that declare it', () => {
  // `capacitor.config.ts` (appId), the Xcode project (PRODUCT_BUNDLE_IDENTIFIER) and `codemagic.yaml`
  // (the `BUNDLE_ID` var) each name it separately, and they are edited months apart. A mismatch does
  // not fail a build — it fails SIGNING on a remote Mac, or worse, signs an app that App Store Connect
  // refuses because no such app record exists. The id is permanent (§4.0 C4).
  //
  // The yaml key MOVED: it was `ios_signing.bundle_identifier` until that block was deleted for
  // creating no certificate on a first build (see the yaml's own signing step). This guard caught the
  // rename immediately, which is what it is for — but note it can only ever check that the THREE
  // strings agree, never that the CI file still passes the id to anything.
  const ID = 'com.vraa.earlylearning'
  assert.match(stripTs(read(CAP_CONFIG)), new RegExp(`appId:\\s*'${ID.replace(/\./g, '\\.')}'`))

  // EVERY occurrence, not the first — the same shape the IPHONEOS_DEPLOYMENT_TARGET test above uses,
  // and it became load-bearing with the staging PRD (W7): `scripts/set-build-tier.mjs` rewrites all of
  // these on the CI Mac to `com.vraa.earlylearning.staging`, and it mutates a checkout, never a commit.
  // A `assert.match` on the whole file would happily pass with one configuration left mutated — i.e.
  // with a leaked staging id in the tree, so the next RELEASE would be signed as staging and rejected
  // by App Store Connect as a bundle-ID mismatch. The pbxproj has one per build configuration.
  const ids = [...read(...PBXPROJ).matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) =>
    m[1].trim().replace(/^"|"$/g, ''),
  )
  assert.ok(ids.length >= 2, 'no bundle identifier found in the Xcode project')
  for (const found of ids) {
    // Exact equality, not a prefix match: `com.vraa.earlylearning.staging` STARTS WITH the production
    // id, so anything looser accepts precisely the leak this exists to catch.
    assert.equal(found, ID, `a build configuration is signed as ${found}, not ${ID}`)
  }
  // ANCHORED to end-of-line. Unanchored, this matched `com.vraa.earlylearning2` and the guard passed
  // against a drifted id — found by re-breaking it, which is the whole point of doing that. The
  // anchoring became load-bearing again with the staging PRD: `com.vraa.earlylearning` is a PREFIX of
  // `com.vraa.earlylearning.staging`, so an unanchored match is now satisfied by the wrong tier.
  const yaml = read('codemagic.yaml')
  assert.match(yaml, new RegExp(`BUNDLE_ID:\\s*${ID.replace(/\./g, '\\.')}\\s*$`, 'm'))
  // …and that the var is actually CONSUMED. Declaring it and never passing it to
  // `fetch-signing-files` would leave all three strings agreeing while signing the wrong thing.
  assert.match(yaml, /fetch-signing-files\s+"\$BUNDLE_ID"/)
  // Which of the two workflows owns which id is `src/config/buildTiers.test.ts`'s job — this file only
  // asserts the COMMITTED tree is production's.
})

test('the committed tree is always PRODUCTION — a staging mutation must never be committed', () => {
  // `scripts/set-build-tier.mjs` rewrites the pbxproj and capacitor.config.ts on the CI Mac. It mutates
  // a checkout and nothing is pushed from CI, so the committed values must stay production's. If a
  // staging id ever lands in a commit, the next RELEASE build signs as staging and App Store Connect
  // refuses it with "Cannot determine the Apple ID from Bundle ID" — a failure that arrives at upload,
  // twenty minutes of Mac time later, and reads like a signing problem.
  const ID = 'com.vraa.earlylearning'
  const STAGING = 'com.vraa.earlylearning.staging'

  const cfg = stripTs(read(CAP_CONFIG))
  assert.ok(!cfg.includes(STAGING), 'capacitor.config.ts carries the STAGING bundle id')
  assert.match(cfg, /appName:\s*'Børnelæring'/, 'the committed appName is not production’s')

  // THE HOME-SCREEN NAME IS THIS, and only this. `capacitor.config.ts`'s `appName` is read when the
  // native project is SCAFFOLDED and never again — `cap sync` does not touch Info.plist — so renaming
  // it alone shipped two apps to the iPad both called "Børnelæring" (measured, first staging build).
  const plist = stripXml(read(...INFO_PLIST))
  const display = plist.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/)
  assert.ok(display, 'no CFBundleDisplayName — the home-screen name would fall back to the target name')
  assert.equal(display[1], 'Børnelæring', 'the committed home-screen name is not production’s')

  // The pbxproj: every occurrence, exact equality. `startsWith` would accept the staging id, since it
  // is production's plus a suffix — the whole reason the loop below compares rather than matches.
  const pbx = read(...PBXPROJ)
  const ids = [...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) =>
    m[1].trim().replace(/^"|"$/g, ''),
  )
  assert.ok(ids.length >= 2, 'no bundle identifier found in the Xcode project')
  for (const found of ids) assert.equal(found, ID, `a build configuration is committed as ${found}`)

  // And the OAuth return scheme, which set-build-tier.mjs rewrites the same way (sign-in reliability
  // PRD W5 layer 1). A staging scheme committed here ships in a RELEASE build, where the app would
  // claim `bl-staging://` and the production server would redirect to `bl://` — a successful sign-in
  // ending on "the address is invalid". The tier-vs-server cross-check is `lib/oauthReturnScheme.test.ts`.
  const scheme = plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>([^<]*)<\/string>/)
  assert.ok(scheme, 'no CFBundleURLTypes — the shell cannot be returned to by a custom scheme at all')
  assert.equal(scheme[1], 'bl', 'the committed URL scheme is not production’s')
})

test('the shell registers the plugin it needs to be returned to', () => {
  // `appUrlOpen` comes from @capacitor/app. Without it the listener never registers, the client never
  // claims `shell-scheme`, and layer 1 degrades to layer 2's terminal page — silently, and looking
  // exactly like a working build. `packageClassList` is regenerated by `cap sync` on the CI Mac (the
  // native `capacitor.config.json` is gitignored), so the DEPENDENCY is what has to be committed.
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
  assert.ok(pkg.dependencies['@capacitor/app'], '@capacitor/app is not a dependency')
  // Both native plugins must be resolvable from Package.swift, which IS committed.
  //
  // QUOTED AND WHOLE, not a bare substring: `CapacitorApp` is a PREFIX of every other plugin name that
  // could start with it, so `includes('CapacitorApp')` is satisfied by `CapacitorAppX` — the same
  // end-anchoring trap that once let `com.vraa.earlylearning2` past a bundle-id guard. Found by
  // re-breaking this assertion, which stayed green against a renamed package.
  const swift = read('ios', 'App', 'CapApp-SPM', 'Package.swift')
  for (const name of ['CapacitorApp', 'CapacitorBrowser']) {
    assert.ok(
      swift.includes(`.package(name: "${name}"`),
      `${name} is missing from Package.swift — run npm run cap:sync`,
    )
  }
})

test('CI publishes to TestFlight and NEVER auto-submits to the App Store', () => {
  // C11 is explicitly the owner's act: a submission is a legal declaration plus a one-way door on
  // "Made for Kids". `submit_to_app_store: true` is one line away from `submit_to_testflight` in every
  // Codemagic example, so its absence is worth pinning rather than trusting.
  const ci = read('codemagic.yaml').replace(/^\s*#.*$/gm, '')
  assert.match(ci, /submit_to_testflight:\s*true/)
  assert.ok(!/submit_to_app_store/.test(ci), 'CI would submit to the App Store without the owner')
  // The work domain must never appear in a file that emails build results.
  assert.ok(!/cyberpilot/i.test(ci), 'the work domain is in the CI config')
})

test('the bundled web build carries the prebaked narration', () => {
  // `webDir: 'dist'` is what puts 31 MB of prebaked TTS inside the binary, and it works only because
  // Vite copies `public/` into `dist/` wholesale. A publicDir change, or moving sounds out of public/,
  // would ship a binary whose every narration line 404s — with the web deployment still perfect, since
  // there the files are served from the same origin either way.
  const tracked = execFileSync('git', ['ls-files', 'public/sounds'], { cwd: ROOT, encoding: 'utf8' })
  assert.ok(tracked.split('\n').filter(Boolean).length > 1000, 'the prebaked clips are not in public/')
  const vite = stripTs(read('vite.config.ts'))
  assert.ok(!/publicDir/.test(vite), 'vite.config.ts overrides publicDir — check sounds still reach dist')
})
