---
paths:
  - "ios/**"
  - "codemagic.yaml"
  - "capacitor.config.ts"
  - "src/config/apiBase.ts"
  - "src/config/runtimeTarget.ts"
---

# The iOS shell & App Store tooling

Design record for the native shell is `tmp-prd-app-store-ios.md` (§3.1 bundling, §3.9 the native
project, §4.0 current state). This file is the **tooling**: how to find out what Apple actually thinks,
from a Windows machine, without a build and without asking the owner to screenshot a dashboard.

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
