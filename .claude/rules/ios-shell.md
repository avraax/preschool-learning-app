---
paths:
  - "ios/**"
  - "codemagic.yaml"
  - "capacitor.config.ts"
  - "src/config/apiBase.ts"
  - "src/config/runtimeTarget.ts"
  - "src/services/shellBrowser.ts"
---

# The iOS shell & App Store tooling

Design record for the native shell is `tmp-prd-app-store-ios.md` (§3.1 bundling, §3.9 the native
project, §4.0 current state). This file is the **tooling**: how to find out what Apple actually thinks,
from a Windows machine, without a build and without asking the owner to screenshot a dashboard.

## A Capacitor plugin proxy is a THENABLE — never return one from an `async` function

`registerPlugin` returns a `Proxy` whose `get` trap answers **every** property with a method wrapper,
`then` included (`@capacitor/core` special-cases `$$typeof` and `toJSON` to dodge this class of bug,
and not `then`). So an `async` function that returns the plugin makes the promise machinery call
`Browser.then(resolve, reject)` to assimilate it — and that wrapper ignores both callbacks.

**The outer promise then never settles.** Nothing throws, so a `try/catch` around the call sees
nothing; the flow simply stops. Report BV9DJ: the shell's "Log ind med Google" disabled its button and
sat there forever, and the only reason a report existed at all is that the wrapper's own promise
rejected unheld. Box the plugin (`{ plugin }`) so assimilation is structurally impossible —
`shellBrowser.ts` shows the shape, and `shellBrowser.test.ts` asserts a bare proxy really does hang.

Generalises: **a promise that never settles is invisible to every error path there is**, and this is
the second one here after the J62KA `AudioContext.resume()` hang. When a UI is stuck with no error,
suspect an unsettled await before suspecting a thrown one.

## `app-store-connect` runs on WINDOWS — its own docs say otherwise, and they are wrong

`codemagic-cli-tools` is pip-installable and its `app-store-connect` command is a plain HTTPS client for
Apple's API: no Xcode, no Keychain, no Mac. Codemagic's docs list it under "macOS-specific" alongside
`keychain` and `xcode-project` (which genuinely are). Measured 2026-08-07: version 0.69.0 authenticated
and returned live data from this Windows box.

```bash
pip install codemagic-cli-tools     # Python >= 3.8
S="/c/Users/<user>/AppData/Roaming/Python/Python313/Scripts"   # NOT on PATH after install
A=(--issuer-id "<issuer>" --key-id "<keyid>" --private-key "@file:C:/path/AuthKey_<keyid>.p8")
"$S/app-store-connect.exe" certificates list "${A[@]}" --type IOS_DISTRIBUTION
"$S/app-store-connect.exe" profiles list "${A[@]}"
"$S/app-store-connect.exe" apps list "${A[@]}"
"$S/app-store-connect.exe" apps builds <appId> "${A[@]}"
"$S/app-store-connect.exe" bundle-ids list "${A[@]}"
"$S/app-store-connect.exe" bundle-ids capabilities <bundleIdResourceId> "${A[@]}"
```

**Two invocation traps.** The `.exe` wrappers are installed outside PATH, so invoke by full path. And
they are Windows binaries, so a Git Bash `/c/...` path passed to `--private-key` fails with "File does
not exist" — use `C:/...`. The key itself lives outside the repo (`.gitignore` refuses `*.p8`).

**This turned two guesses into facts and is why the signing loop ended.** `certificates list --type
IOS_DISTRIBUTION` returned *"Did not find any Signing Certificates"*, which proved the declarative
`ios_signing` path had nothing to match rather than merely suggesting it; and `apps list` next to
`bundle-ids list` exposed that the App Store Connect app record pointed at `com.vraa.bornelaering`
while the binary was signed as `com.vraa.earlylearning`. Neither was diagnosable from a build log.

**What it will NOT do.** No user management (no `users` subcommand at all), so App Store Connect user
invitations cannot be created or turned into codes. And `bundle-ids enable-capabilities … --capability
"Sign In with Apple"` returns **409 "Please select at least one configuration for Sign In with Apple"** —
that capability needs a primary-vs-grouped choice the API will not accept blind, so it stays a portal
click.

## For anything the CLI does not expose, sign a JWT and call the API

Relationship endpoints in particular: the CLI prints them as links and does not follow them, so
"which beta group is this build in / who are the testers" is unanswerable through it. The API is ES256
JWT — `alg ES256`, `kid` = key id, `iss` = issuer id, `aud: 'appstoreconnect-v1'`, `exp` ≤ 20 min — and
Node signs it with `createSign('SHA256')` plus **`dsaEncoding: 'ieee-p1363'`** (the default DER encoding
produces a signature Apple rejects). That is how `/v1/betaGroups/<id>/betaTesters` settled a stuck
TestFlight install: the tester's `state` was **`INVITED`**, i.e. the invite existed and had never been
accepted — not a Media & Purchases mismatch, not an Apple ID alias, not a missing build-to-group link,
all of which had been proposed first.

**`betaTesters.state` is the field to read** before theorising about a tester who "sees nothing":
`INVITED` = sent, never accepted. `INSTALLED` = it already worked.

**The API WRITES the store listing too, not just reads it** — the ASC key is
`C:/Users/<user>/Documents/AppleDeveloper/AuthKey_VR8MNH235U.p8` (contents never leave that file).
`PATCH /v1/appStoreVersionLocalizations/<id>` sets `description`, `keywords`, `promotionalText`,
`whatsNew`; name and subtitle live on `appInfoLocalizations` instead. So listing copy does not have to
be hand-pasted, which matters because **hand-pasting silently truncates**: a read on 2026-09-05 found
523 of the description's 1457 characters live, cut after the first section, with everything about ads,
purchases, tracking and the parental gate simply missing. ASC accepts a short description without
complaint and the length is only wrong against `docs/app-store/listing.md`. **Always read the field back
and compare, never assume the write (or the paste) landed** — `attributes.description === sent` is the
whole check. Keywords are frozen after submission and only change with a new version, so settle them
before Add for Review, not after.

**The age rating hangs off `appInfo`, NOT `appStoreVersion`, and the wrong parent 404s rather than
erroring.** `/v1/appStoreVersions/<id>/ageRatingDeclaration` returns 404 even when the rating is set;
`/v1/appInfos/<id>/ageRatingDeclaration` is the live one and carries `kidsAgeBand` +
`parentalControls`. A 404 there was reported to the owner as "Made for Kids did not save" — about the one
setting that cannot be undone after review — while `appStoreAgeRating: FOUR_PLUS` sat on the appInfo the
whole time. `appInfo.attributes.kidsAgeBand` is separately unreliable: it reads empty while the
declaration holds `SIX_TO_EIGHT`. **Read the declaration on the appInfo; trust nothing else.**

**A 404 from this API means "wrong parent" at least as often as "not set".** Before reporting anything
absent, dump the parent's `relationships` keys and try the ones that exist — that is what distinguished
a stale endpoint from a missing declaration here.

## TWO apps on the iPad, two workflows, one signing history (staging PRD W7)

The owner-facing "how do I ship this" version is `docs/releasing.md` — point him there rather than
re-explaining, and keep it true when this section changes.

`com.vraa.earlylearning` / `Børnelæring` (App ID `YMZ44PV8HK`, ASC record `6799119188`) and
`com.vraa.earlylearning.staging` / `BL Staging` (App ID `XU38T75JUS`, ASC record `6799489044`). They are
**different apps to iOS**: separate profiles, TestFlight tracks, icons — and separate CONTAINERS, which
is the point. A staging build cannot see, migrate or corrupt the child's real progress.

- **`scripts/set-build-tier.mjs <tier>` runs on the Mac, after `npm ci` and before `cap sync`.** It
  rewrites **every** `PRODUCT_BUNDLE_IDENTIFIER` in the pbxproj (one per build configuration — rewriting
  the first leaves a project that signs differently per configuration) plus `capacitor.config.ts`'s
  `appId`/`appName`, **and `CFBundleDisplayName` in `Info.plist`**. It mutates a CHECKOUT; nothing is
  pushed from CI, and the committed tree must always be production's (`capacitorConfig.test.ts`).
- **`capacitor.config.ts` is read when the project is SCAFFOLDED, not on sync.** `appId` still has to be
  rewritten, because `cap sync` copies the committed id back over the pbxproj — but `appName` reaches
  nothing: the home-screen name is `CFBundleDisplayName` in `ios/App/App/Info.plist`, a literal that
  `cap sync` never touches. Renaming `appName` alone shipped two apps to the iPad both called
  "Børnelæring", which is exactly what the second name exists to prevent.
- **`scripts/verify-build-tier.mjs <tier>` reads `dist/`, not the source.** The naive check is wrong:
  a STAGING bundle legitimately contains the production host, because `backendTarget.ts` declares it as
  the constant the badge compares against. The exact rule is asymmetric — production ⇒ the staging host
  appears **zero** times; staging ⇒ **at least once**.
- **`BUNDLE_ID` stays a `vars:` entry, and every guard on it is END-ANCHORED.** `com.vraa.earlylearning`
  is a PREFIX of the staging id, so an unanchored match accepts the wrong tier — the same failure that
  once let `com.vraa.earlylearning2` through.
- **`--create` works for the second App ID too**, so the staging certificate and profile appear on the
  first `ios-staging` run with no Mac, exactly as they did for production.
- **`submit_to_testflight` does NOT mean "upload".** The `app_store_connect` publishing block already
  uploads, and internal testers can install from that alone. The flag adds submission to EXTERNAL beta
  review, which requires Beta App Information + Beta App Review contact details on the app record — so
  a workflow can report RED in post-processing after a build that succeeded and is already installable.
  `ios-staging` deliberately omits it (nobody outside the household installs `BL Staging`, and it would put
  a test build in front of an Apple reviewer); `ios-release` keeps it, and `buildTiers.test.ts` pins
  exactly one occurrence.
- **`bundle-ids enable-capabilities … "Sign In with Apple"` still 409s**, so the staging App ID needed
  the same portal click production needed (verified afterwards: `XU38T75JUS_APPLE_ID_AUTH` with
  `PRIMARY_APP_CONSENT`). **In-App Purchase appears on every App ID by default and cannot be removed** —
  not a misconfiguration, don't chase it.
- **Two `.p8` keys, and they are NOT interchangeable.** `AuthKey_KLY329S52U.p8` is the *Sign in with
  Apple* key (signs the client-secret JWT; `APPLE_KEY_ID`). `AuthKey_VR8MNH235U.p8` is the *App Store
  Connect API* key (queries Apple; issuer `62ee49e8-4d0f-4dd1-bb76-84a364d09904`) and is the one
  Codemagic's `bornelaering-asc` integration uses. Both live in
  `C:/Users/AllanBrinkVraa/Documents/AppleDeveloper/`, outside the repo.

## Codemagic: four distinct causes wore the same symptom

Every first-build failure reported as broken signing, and each had a different cause. Read
`codemagic.yaml`'s own comments before changing that file — they name each one at the line that fixes it.

1. **`environment.ios_signing` only matches PRE-EXISTING files.** It is the declarative path. Nothing had
   ever created a certificate, so it matched nothing.
2. **`xcode-project use-profiles` neither fetches nor creates** — it applies profiles already on disk.
   The step was *named* "Fetch signing certificates and profiles" while doing none of it.
3. **`--create` needs `--certificate-key`.** A certificate is a public key signed by Apple, so creating
   one requires a private key to put inside it; the ASC API key authenticates and does not generate keys.
   Absent it, the step dies *after* the keychain initialises cleanly, which reads as a keychain fault.
4. **A UI variable is invisible unless its group is named** in `environment.groups`. Omit it and the
   secret is simply absent — failing identically to never having created it.

Then a fifth, outside signing entirely: **the app record's bundle ID must equal the binary's**, or
`altool` fails with "Cannot determine the Apple ID from Bundle ID". Changeable in App Store Connect only
until the first build uploads.

**`ITSAppUsesNonExemptEncryption = false`** in `Info.plist` is why uploads do not stop for a manual
export-compliance questionnaire. Confirmed on the accepted build as `usesNonExemptEncryption: false`.
Deleting the key is the only change needed to revert it — it is a declaration, so it is the owner's call.
