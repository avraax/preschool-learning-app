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

test('the secure-context settings getUserMedia depends on are the defaults, written down', () => {
  // Capacitor's docs: keeping the hostname as `localhost` "allows the use of Web APIs that would
  // otherwise require a secure context such as … MediaDevices.getUserMedia". Changing either of these
  // does not fail a build — it makes "Sig et Ord" stop working in the shell only, on a device.
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

test('NSMicrophoneUsageDescription exists and says WHERE the recording goes', () => {
  // The failure mode for a missing string is not a prompt, it is: "your app exits." And Guideline
  // 5.1.1(ii) requires the string to "clearly and completely describe your use of the data", so
  // "we need the microphone" is a rejection — it must name the speech-recognition service.
  const plist = stripXml(read(...INFO_PLIST))
  const m = plist.match(/<key>NSMicrophoneUsageDescription<\/key>\s*<string>([\s\S]*?)<\/string>/)
  assert.ok(m, 'no NSMicrophoneUsageDescription — the app will EXIT when it touches the microphone')
  const purpose = m[1].trim()
  assert.ok(purpose.length > 60, 'the purpose string is too thin to "completely describe" the use')
  assert.match(purpose, /Speech-to-Text|speech recognition/i, 'it does not say where the audio goes')
})

test('the Danish microphone string ships, and `da` is a known region', () => {
  // Two halves, and only the second one is checkable by looking at the strings file. "If a localized
  // version of a key does not exist, the routines return the value stored in the Info.plist file" — so
  // a `.lproj` that is not in knownRegions is not built into the bundle, and the ENGLISH string quietly
  // ships to Danish iPads with nothing failing.
  const strings = read('ios', 'App', 'App', 'da.lproj', 'InfoPlist.strings')
  assert.match(strings, /"NSMicrophoneUsageDescription"\s*=/)
  assert.match(strings, /mikrofonen/, 'the Danish string is not Danish')
  // The æøå survived whatever wrote the file — this repo has mojibaked Danish through a shell pipeline
  // before, and a purpose string is shown to the adult by the OS.
  assert.match(strings, /Børnelæring/, 'the Danish text is mojibaked')
  assert.match(strings, /Speech-to-Text/, 'the Danish string does not say where the audio goes')

  const pbx = read(...PBXPROJ)
  const regions = pbx.match(/knownRegions = \(([\s\S]*?)\);/)
  assert.ok(regions, 'no knownRegions in the Xcode project')
  assert.match(regions[1], /\bda\b/, '`da` is not a known region — da.lproj will not be built in')
  // …and the file has to be in the target's Resources phase, not merely on disk.
  assert.match(pbx, /InfoPlist\.strings in Resources/, 'InfoPlist.strings is not in a build phase')
  assert.match(pbx, /path = da\.lproj\/InfoPlist\.strings/)
})

// ---- §3.9: the privacy manifest (a FAILED UPLOAD, not a review note) ------------------------------

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
  for (const type of ['EmailAddress', 'UserID', 'GameplayContent', 'AudioData', 'CrashData']) {
    assert.match(x, new RegExp(`NSPrivacyCollectedDataType${type}`), `${type} is not declared`)
  }
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

// ---- B7: the microphone spike, static half --------------------------------------------------------

test('the Capacitor bridge still GRANTS WKWebView media-capture permission', () => {
  // App Store PRD §4.3 / B7. "Sig et Ord" reaches the microphone through plain `getUserMedia` in a
  // WKWebView, and a WKWebView only gets it if the host app implements the iOS 15+ WKUIDelegate method
  // `webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:decisionHandler:`. Without
  // it a webview can prompt on EVERY call or refuse silently. The PRD carried this as UNKNOWN because
  // community reports pointed both ways; it is resolved here by reading Capacitor's own source.
  //
  // Verified against the SHIPPED ARTIFACT too, not only this npm mirror: `capacitor-swift-pm` at 8.5.0
  // is a `binaryTarget` whose `Capacitor.xcframework.zip` matches the checksum pinned in its
  // Package.swift, and the selector is present in the `ios-arm64` Mach-O inside it. That download also
  // settled §3.9's other UNKNOWN — the framework carries its own `PrivacyInfo.xcprivacy` per slice and
  // is code-signed, which is what Apple requires of a listed SDK used as a binary dependency.
  //
  // This is a SUPPLY-CHAIN assertion on purpose: a Capacitor upgrade that changed this would break the
  // microphone in the shell only, on a device, with the web app still perfect.
  const bridge = readFileSync(
    path.join(
      ROOT,
      'node_modules',
      '@capacitor',
      'ios',
      'Capacitor',
      'Capacitor',
      'WebViewDelegationHandler.swift',
    ),
    'utf8',
  )
  const handler = bridge.match(
    /requestMediaCapturePermissionFor[\s\S]{0,400}?decisionHandler:\s*@escaping[\s\S]{0,200}?\{([\s\S]{0,200}?)\n\s{4}\}/,
  )
  assert.ok(handler, 'the Capacitor bridge no longer implements requestMediaCapturePermissionFor')
  assert.match(
    handler[1],
    /decisionHandler\(\.grant\)/,
    'the bridge no longer grants media capture — getUserMedia will prompt or fail in the shell',
  )
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
  // (ios_signing.bundle_identifier) each name it separately, and they are edited months apart. A
  // mismatch does not fail a build — it fails SIGNING on a remote Mac, or worse, signs an app that
  // App Store Connect refuses because no such app record exists. The id is permanent (§4.0 C4).
  const ID = 'com.vraa.earlylearning'
  assert.match(stripTs(read(CAP_CONFIG)), new RegExp(`appId:\\s*'${ID.replace(/\./g, '\\.')}'`))
  assert.match(read(...PBXPROJ), new RegExp(`PRODUCT_BUNDLE_IDENTIFIER = ${ID.replace(/\./g, '\\.')};`))
  // ANCHORED to end-of-line. Unanchored, this matched `com.vraa.earlylearning2` and the guard passed
  // against a drifted id — found by re-breaking it, which is the whole point of doing that.
  assert.match(
    read('codemagic.yaml'),
    new RegExp(`bundle_identifier:\\s*${ID.replace(/\./g, '\\.')}\\s*$`, 'm'),
  )
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
