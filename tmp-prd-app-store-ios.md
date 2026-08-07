# PRD — Børnelæring on the Apple App Store, from a Windows-only setup

**Status:** authored 2026-08-06, NOT implemented. No app code has been changed by this document.
**Scope:** iOS/iPadOS App Store only. Android is explicitly out of scope.
**Audience:** a fresh session with no memory of the research conversation. Everything needed is here.

Every external claim below carries its source URL and the date it was read. All Apple, Google, Capacitor,
Codemagic and GitHub pages cited were read **2026-08-06**. Apple changes these rules often — a session
picking this up more than a few weeks later should re-read §6's list before trusting §1 and §3.

**A doc fetch that rate-limits, 403s or returns a partial page is UNKNOWN, not a finding.** Several items
below are marked UNKNOWN for exactly that reason; they are collected in §6. Do not smooth them over.

---

## 0. The situation being planned for

- The app is this repo: React 19 + Vite 8 + MUI, deployed on Vercel. Network-only PWA, hand-authored
  `public/manifest.json`, **deliberately no service worker**. Danish, five sections, 24 games.
- Backend is Vercel serverless functions under `api/`: Azure AI Speech for TTS (most lines prebaked to
  `public/sounds/tts/`, 31 MB; `public/sounds` total 54 MB) and Google Cloud STT for one speech-input game
  (Sig et Ord), which needs the microphone. Both are third-party processors receiving audio.
- Auth is `better-auth`: one adult account via Google OIDC plus passkeys, N child profiles. The whole app
  is hard-gated by `AuthGate`. `/api/tts-azure` and `/api/stt` require a 15-minute access JWT.
- Compatibility floor: the owner's son's **iPad Pro 2nd gen (12.9") on iPadOS 17.7.11**.
- Owner's machine is **Windows 11. No macOS hardware at all.** Apple ID exists; no Developer Program
  membership. Prefer free tiers and one-off costs; recurring costs must be flagged.
- Once listed: public, **Kids Category**, free, no in-app purchases.
- A thin native shell (Capacitor) plus native plugins is acceptable. The React app stays as it is.

### Owner decisions already taken (do not re-litigate)

1. **Sig et Ord ships in v1**, microphone off by default, enabled behind the parental gate with an explicit
   consent screen naming Google. The alternative (ship v1 without the mic game) was offered and declined.
2. **Universal app — iPad *and* iPhone.** iPad-only was recommended and declined. The consequences are
   real and are carried through this document: a mandatory 6.9" iPhone screenshot set, and iPhone layouts
   that can never reach rung 3 because the owner has no iPhone. See §3.9 and §5.5.

---

## 1. The route

### 1.1 The headline

**A Mac is unavoidable for exactly one step — compiling the `.ipa` — and it can be rented for free rather
than owned.** Every other step in the pipeline is doable from Windows or from the owner's iPad. This is
stated plainly because the owner asked for it plainly: there is no route in which no macOS machine ever
touches this code. There is a route in which the owner never buys, borrows or logs into one.

### 1.2 Recommended route

> **Capacitor shell with the web build bundled into the binary → built on Codemagic's free macOS tier with
> automatic signing from an App Store Connect API key → TestFlight → submitted from the App Store Connect
> web UI on Windows.**

Why each piece:

- **Bundled, not remote-loaded.** Non-negotiable; see §3.1. This is the single most important architectural
  decision in the document.
- **Codemagic.** Free tier is **"500 free macOS M2 minutes / month", max 1 concurrent build, 120-minute
  build cap** — https://codemagic.io/pricing/ (read 2026-08-06). A Capacitor build is on the order of
  10–20 minutes, so the free tier is roughly 25–50 builds a month at zero cost.
- **It has a published Capacitor recipe.** Codemagic documents an Ionic/Capacitor iOS workflow running on
  `instance_type: mac_mini_m2` that executes `npx cap sync`, `cd ios/App && pod install`,
  `xcode-project use-profiles`, then publishes to App Store Connect/TestFlight —
  https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/ (read 2026-08-06).
- **Automatic signing removes the CSR and the Keychain entirely.** You upload an App Store Connect API
  `.p8` key once (Team integrations → Developer Portal → Manage keys) and Codemagic generates the
  distribution certificate and provisioning profile for you —
  https://docs.codemagic.io/yaml-code-signing/signing-ios/ (read 2026-08-06). This matters because Apple's
  own CSR page documents only Keychain Access on a Mac (see §2.3), so avoiding the CSR is worth more than
  solving it.

### 1.3 Runner-up: GitHub Actions `macos-latest`

Lost, but close. It is the cheapest and the most self-owned.

- **Free for public repositories:** "GitHub Actions usage is free for standard GitHub-hosted runners in
  public repositories" — https://docs.github.com/en/actions/concepts/billing-and-usage (read 2026-08-06).
- Private-repo included minutes on the Free plan: **2,000/month**; macOS standard runners bill at
  **$0.062/minute** — https://docs.github.com/en/billing/reference/actions-minute-multipliers and
  https://docs.github.com/en/billing/concepts/product-billing/github-actions (read 2026-08-06).
- **UNKNOWN:** whether the Free plan's 2,000 included minutes can be spent on macOS at all, and at what
  multiplier. Despite that page's URL slug it now publishes per-minute USD rates and contains **no OS
  multiplier table**. Do not assume the historical 10× rule still holds.

**Why it lost:** you write and own the whole chain by hand — `npx cap sync`, `pod install`,
`xcodebuild -archive`, `-exportArchive` with a correct `exportOptions.plist`, certificate import into a
temporary keychain, then upload. Neither GitHub nor Capacitor publishes an official Capacitor recipe for it
(**UNKNOWN as an official path**). For someone who has never opened Xcode, that is several days of
debugging signing errors on a remote machine they cannot inspect. Secondly, the free tier requires making
this repository **public** — which would expose a family project, and note `.gitignore`'s blanket `*.json`
rule has already been the reason credentials stayed untracked; a visibility change deserves its own audit.

If Codemagic's free minutes ever prove insufficient, this is the fallback, not a rewrite.

### 1.4 Explicitly killed options

- **Xcode Cloud — killed, and it is the painful one.** It is Apple's own service, it is the cheapest on
  paper (**25 compute hours/month included with membership**, then 100 h for US$49.99/mo —
  https://developer.apple.com/xcode-cloud/, read 2026-08-06), and it cannot be used. Verbatim: **"You need
  to configure your first Xcode Cloud workflow in Xcode."** App Store Connect can view, edit and create
  *additional* workflows, but only after the first one exists —
  https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow
  (read 2026-08-06). Second, independent blocker for Capacitor: **"Xcode Cloud requires a consistent Xcode
  project or workspace that's continuously present. If you use a third-party tool that dynamically
  generates or edits your project or workspace, the initial configuration of Xcode Cloud and subsequent
  builds may fail."** — https://developer.apple.com/documentation/xcode/setting-up-your-project-to-use-xcode-cloud
  (read 2026-08-06). *If the owner ever borrows a Mac for one afternoon, bootstrapping Xcode Cloud there is
  the cheapest long-run answer.* That is the only reason to borrow one.
- **Remote-loading the Vercel site via Capacitor `server.url` — killed twice over.** Apple's 4.2/2.5.2
  exposure is §3.1; separately, Capacitor's own docs say `server.url` is for live-reload servers and state
  **twice** that it is "not intended for use in production" — https://capacitorjs.com/docs/config
  (read 2026-08-06).
- **Ionic Appflow — do not choose.** Discontinued for new customers 2025-02-11, commercial line ending
  2027-12-31. Sources are third-party only (capawesome.io, yasha.solutions, read 2026-08-06) — **no
  ionic.io first-party confirmation was fetched, so treat the dates as soft-confirmed.** Note Capacitor's
  own environment-setup page still recommends Appflow for Mac-less iOS builds
  (https://capacitorjs.com/docs/getting-started/environment-setup, read 2026-08-06); **that doc is stale.**
- **Expo EAS — not applicable.** No Expo doc read mentions Capacitor; Expo's model is React Native
  prebuild. **UNKNOWN/effectively unsupported.**
- **Bitrise — capable, opaque free tier.** Free "Hobby" plan is 300 credits/month, 90-minute build timeout
  — https://bitrise.io/pricing (read 2026-08-06). The credit→macOS-minute conversion is **UNKNOWN**, so it
  cannot be compared honestly against Codemagic's 500 minutes.
- **Capawesome Cloud — viable, but paid.** Capacitor-native (built by the community-plugin maintainers,
  positioned as the Appflow replacement). Starter **$19/mo** for 200 build minutes; 14-day trial; **no
  permanent free tier** — https://capawesome.io/pricing (read 2026-08-06). Simplest mental model of any
  option, but it is a recurring cost where Codemagic is free.

### 1.5 The honest one-off alternative: buy a Mac

The owner asked to prefer one-off costs over recurring ones, and this is the one place where spending money
genuinely simplifies everything. A used or refurbished **Mac mini (M4 or M2)** is roughly **$500–600
one-off** (street price, not from a doc read — **UNKNOWN as a cited figure**), and it collapses this
document's whole §2: local `npx cap add ios`, local `pod install`, local Xcode archive and upload, real
Simulator testing, and Xcode Cloud unlocked afterwards. It requires macOS able to run **Xcode 26.x**, which
needs **macOS Sequoia 15.6 through macOS Tahoe 26.x** depending on the point release
(https://developer.apple.com/support/xcode/, read 2026-08-06) — any current-model Mac mini satisfies this.

Ranked by simplicity, ignoring cost: (1) own a Mac mini, (2) Codemagic, (3) Capawesome, (4) GitHub Actions,
(5) Bitrise, (6) Xcode Cloud after borrowing a Mac once. Ranked by cost, Codemagic wins outright. **The
recommendation is Codemagic**, on the grounds that the owner asked to prefer free tiers, and that the only
thing a Mac buys over Codemagic is convenience the free tier already provides.

### 1.6 Costs, complete

| Item | Cost | Recurring? |
|---|---|---|
| Apple Developer Program | **99 USD/year** | **YES — annual, mandatory, unavoidable** |
| Codemagic | 0 (500 macOS-M2 min/month free) | no |
| Everything else new | 0 | — |
| Existing Vercel / Azure / Google Cloud / Neon | unchanged | unchanged |

Membership fee source: "The Apple Developer Program annual fee is 99 USD… in local currency where
available. Prices may vary by region" — https://developer.apple.com/support/enrollment/ (read 2026-08-06).
**The DKK/EUR figure is UNKNOWN** — it is only revealed inside the checkout flow, and
`https://developer.apple.com/dk/programs/enroll/` returns HTTP 404 (read 2026-08-06). Do not put a
converted number in front of the owner.

If Codemagic's free minutes are exceeded, pay-as-you-go is **$0.095/min on Mac mini M2** (same pricing
page, read 2026-08-06) — usage-based, not a subscription.

---

## 2. Where a Mac is and is not needed

### 2.1 The table

Each step is marked **W** (Windows), **iPad** (the owner's existing device), or **macOS**.

| Step | Where | Evidence (all read 2026-08-06) |
|---|---|---|
| Developer Program enrolment | **W** (web), possibly **iPad** for photo-ID verification | developer.apple.com/support/enrollment/ ; .../help/account/membership/identity-verification |
| Accept Program License Agreement | **W** | .../help/account/membership/program-enrollment/ |
| Agreements / tax / banking in ASC | **W** | .../help/app-store-connect/manage-agreements/sign-and-update-agreements/ |
| EU DSA trader status declaration | **W** | .../help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/ |
| Register Bundle ID | **W** (web portal or `POST /v1/bundleIds`) | .../documentation/appstoreconnectapi/post-v1-bundleids |
| Distribution certificate | **W** (`POST /v1/certificates` from a CSR — or let Codemagic do it) | .../documentation/appstoreconnectapi/post-v1-certificates |
| Provisioning profile | **W** (web portal or `POST /v1/profiles`) | .../help/account/provisioning-profiles/... |
| Create app record in ASC | **W** | .../help/app-store-connect/... |
| `npx cap add ios` | **UNKNOWN on Windows** | capacitorjs.com/docs/cli/commands/add — not documented either way |
| `pod install` (CocoaPods) | **macOS in practice** | capacitorjs.com/docs/ios |
| **Archive / compile the `.ipa`** | **macOS. THE ONE UNAVOIDABLE STEP.** | capacitorjs.com/docs/getting-started/environment-setup: "To build iOS apps, you will need macOS" |
| Upload the `.ipa` | **W** — `iTMSTransporter` runs on Windows 11 | help.apple.com/itc/transporteruserguide/en.lproj/static.html |
| TestFlight setup + internal testers | **W** | .../help/app-store-connect/test-a-beta-version/add-internal-testers/ |
| Install and play-test the build | **iPad** (TestFlight app) | same page |
| Screenshots + metadata | **W** (upload) / **iPad** (capture) | .../help/app-store-connect/reference/screenshot-specifications/ |
| Submit to App Review | **W** (web) or **iPad** (ASC app) | developer.apple.com/app-store-connect/ |

Because Codemagic performs the archive step, `npx cap add ios` and `pod install` also happen on its macOS
runner. Their Windows status is therefore interesting but not load-bearing: **commit the generated
`ios/` directory to the repo** and the CI runner regenerates nothing it cannot handle.

### 2.2 Uploading from Windows is genuinely possible

Worth knowing even though Codemagic makes it unnecessary — it is the escape hatch if CI publishing breaks.

- `iTMSTransporter` system requirements list **"Microsoft Windows 11 or later (64-bit system)"** alongside
  macOS and RHEL; the Windows installer is a self-extracting
  `iTMSTransporterToolInstaller_4.2.0.<build>.exe` installing to `C:\Program Files\itms` —
  https://help.apple.com/itc/transporteruserguide/en.lproj/static.html (read 2026-08-06).
- It accepts App Store Connect API-key auth: `-apiKey <key> -apiIssuer <issuer>`, and "The options `-u`,
  `-p`, or `-asc_provider` are not allowed with the `-apiKey` and `-apiIssuer` option pair" (same page).
  No Apple ID password needed.
- Form: `iTMSTransporter -m upload -assetFile <path.ipa> …`, and **"For Linux and Windows,
  `-assetDescription` is required"** (same page). That extra metadata file is the Windows-specific wrinkle.
- The **GUI** Transporter is macOS-only (it is a Mac App Store app) —
  https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds (read 2026-08-06).
- `altool` and `notarytool` are `xcrun` tools bundled with Xcode, therefore **macOS only** (same page, plus
  https://developer.apple.com/documentation/xcode/installing-the-command-line-tools). Notarization applies
  to Mac software, not iOS App Store builds, so `notarytool` is irrelevant here.
- **The App Store Connect API cannot upload a build.** The uploadable asset types are exhaustively listed
  and no app binary is among them (screenshots, app previews, App Clip cards, App Review attachments,
  Game Center images, IAP review screenshots, routing coverage files) —
  https://developer.apple.com/documentation/appstoreconnectapi/uploading-assets-to-app-store-connect
  (read 2026-08-06). Do not plan around an API upload; it does not exist.
- Soft-confirmed (search-snippet level, not a direct page read, 2026-08-06): "Starting in 2026, you'll be
  required to use the `-assetFile` command instead of the `-f` command." Treat as likely, verify if used.

### 2.3 Certificates from Windows — the one gap

- Apple's CSR page documents **Keychain Access on a Mac**, and gives explicit OpenSSL command lines only
  for Apple Pay Payment Processing and App License Delivery certificates —
  https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/
  (read 2026-08-06). The page contains **no statement that Keychain is required**, but it also does not
  bless OpenSSL for an *iOS Distribution* certificate. → **Whether Apple accepts an OpenSSL-generated CSR
  for an iOS distribution certificate is UNKNOWN.**
- What is confirmed: `POST /v1/certificates` — "Create a new certificate using a certificate signing
  request" — https://developer.apple.com/documentation/appstoreconnectapi/post-v1-certificates
  (read 2026-08-06). The request-body attribute names did not render in the fetched doc (**UNKNOWN**), but
  the endpoint and its CSR semantics are confirmed.
- **This gap is why the recommended route uses Codemagic's automatic signing.** It sidesteps the question
  rather than answering it. If automatic signing is ever abandoned, resolving this UNKNOWN becomes a
  blocker.

### 2.4 Enrolment may need the iPad

- "Verification of your legal identity is currently required in order to enroll" and "Developers around
  the world can enroll and/or verify their identity using the Apple Developer app" —
  https://developer.apple.com/help/account/membership/identity-verification (read 2026-08-06).
- The app path is explicitly a device operation: it requires an iPhone/iPad with Touch ID, Face ID or a
  passcode (or a Mac with T2/Apple silicon), **the same device throughout**, and photographing a
  government photo ID — https://developer.apple.com/help/account/membership/enrolling-in-the-app/
  (read 2026-08-06).
- **UNKNOWN:** whether an individual enrolling purely on the web is *always* redirected into the app for
  the photo-ID step. No page read states it. Practically moot — the owner has an iPad.
- Enrol as an **individual**, not an organization: individual needs only an Apple Account with 2FA and
  legal age of majority; organization needs a **D-U-N-S Number**, a legal entity, and a public website on
  the org's domain — https://developer.apple.com/support/enrollment/ (read 2026-08-06). Note the
  consequence: "your personal legal name will be listed as the seller on the App Store" (same page).

---

## 3. What the app is missing to be listable at all

Ordered by rejection risk, worst first. §3.1 and §3.2 are architectural and must be decided before any
native work starts.

### 3.1 BLOCKER — the web build must be bundled into the binary (Guideline 4.2 / 2.5.2)

**4.2 preamble, verbatim** — https://developer.apple.com/app-store/review/guidelines/ (read 2026-08-06):

> Your app should include features, content, and UI that **elevate it beyond a repackaged website**. If
> your app is not particularly useful, unique, or "app-like," it doesn't belong on the App Store. If your
> App doesn't provide some sort of lasting entertainment value or adequate utility, it may not be accepted.

> **4.2.2** Other than catalogs, apps shouldn't primarily be marketing materials, advertisements, web
> clippings, content aggregators, or a collection of links.

> **4.2.3 (i)** Your app should work on its own without requiring installation of another app to function.
> **(ii)** If your app needs to download additional resources in order to function on initial launch,
> disclose the size of the download and prompt users before doing so.

> **4.2.7 (e)** Thin clients for cloud-based apps are not appropriate for the App Store.

**2.5.2, verbatim** (same URL, read 2026-08-06):

> Apps should be self-contained in their bundles, and may not read or write data outside the designated
> container area, **nor may they download, install, or execute code which introduces or changes features
> or functionality of the app, including other apps.** Educational apps designed to teach, develop, or
> allow students to test executable code may, in limited circumstances, download code provided that such
> code is not used for other purposes. Such apps must make the source code provided by the app completely
> viewable and editable by the user.

The 2.5.2 educational carve-out **does not apply** — it is for apps that teach coding and expose editable
source, not for educational apps generally. Do not reach for it.

**The decision.** The Capacitor shell serves the web build from `capacitor://localhost` out of the app
bundle (`webDir`). It does **not** point `server.url` at the Vercel deployment. Consequences:

- `dist/assets` (9.5 MB) **and** `public/sounds` (54 MB, of which `sounds/tts` is 31 MB) ship inside the
  binary. Total on the order of 65–70 MB, which is unremarkable for an App Store app.
- **The games then work with no network at all**, because every line the app speaks is prebaked except Sig
  et Ord's read-back. Combined with the guest-play path in §3.2, the app genuinely functions offline. This
  is the strongest available 4.2 argument, and it is also simply better for a child on an iPad.
- **This deliberately inverts `CLAUDE.md`'s "never design a feature around works offline" — for the native
  shell only.** The web deployment on Vercel keeps its network-only, no-service-worker design unchanged.
  Two delivery targets, two rules. Record this in `.claude/rules/pwa-and-device.md` when implementing, or a
  later session will "fix" it back.
- **Never add an OTA / live-update service** (Capawesome Live Updates, Appflow Live Updates, or similar).
  Remote-loaded JS that changes app functionality is exactly what 2.5.2's second clause forbids. Every
  change ships as a new build through review. State this in the repo rules.
- What still needs the network: sign-in, progress sync, and Sig et Ord. Nothing else.

**Also strengthen the "app-like" case with real native integrations**, since 4.2 asks for features that
"elevate it beyond a repackaged website": native microphone capture, native audio-session category
management (which would also help the class of iOS `AudioContext.resume()` bug already in this repo's
history), Sign in with Apple via native `ASAuthorization` rather than a webview round-trip, and native
haptics. Each is a defensible answer to a 4.2 rejection.

**Avoid tripping 4.7.** Guideline 4.7 governs apps that *offer* "HTML5 and JavaScript mini apps and mini
games" to users, and brings a whole checklist (content filtering, an index with universal links, age
restriction). A single bundled web app that *is* the app is not "software offered in your app" — but a
shell that loads arbitrary remote content lets a reviewer reach for 4.7. Another reason to bundle.

**UNKNOWN:** no guideline read flatly forbids an app from requiring network connectivity. 4.2.3(ii) only
governs download disclosure. So "needs the network" is **not a rule violation but is a real review risk** —
an app that shows nothing without connectivity reads as a web clipping under 4.2, and reviewers do test on
constrained networks.

### 3.2 BLOCKER — remove the hard login gate (Guideline 5.1.1(v))

**Verbatim** — https://developer.apple.com/app-store/review/guidelines/ (read 2026-08-06):

> If your app doesn't include significant account-based features, let people use it without a login. If
> your app supports account creation, **you must also offer account deletion within the app.** **Apps may
> not require users to enter personal information to function, except when directly relevant to the core
> functionality of the app or required by law.**
> … **An app may not store credentials or tokens to social networks off of the device** and may only use
> such credentials or tokens to directly connect to the social network from the app itself while the app
> is in use.

And **5.1.1(x)**, same URL:

> Apps may request basic contact information (such as name and email address) so long as the request is
> optional for the user, features and services are not conditional on providing the information, and it
> complies with all other provisions of these guidelines, **including limitations on collecting
> information from kids.**

**The problem.** `AuthGate` currently blocks the entire app. A reviewer opening a free Danish alphabet game
and hitting a mandatory Google sign-in is precisely the pattern 5.1.1(v) exists to stop. Multi-child
profiles and cross-device sync are a genuine account-based feature set, so an argument exists — but it is
an argument, and it is the second-most-likely rejection after 4.2.

**The work.** Add a **guest / local-play path**: the app opens playable with no account, progress kept in
local storage only, and signing in becomes the opt-in reason to sync across devices and add child profiles.
This is architecturally cheap here because **`progressStore` is already inert until
`profileStore.attach()`** — a local guest profile is a new caller of existing machinery, not a rewrite.
`src/contexts/authGatePolicy.ts` is where the gate decision lives.

Two side benefits: it makes the app work fully offline (§3.1), and it largely dissolves the demo-account
problem (§3.8) because the reviewer can simply play.

**Two further 5.1.1 items:**
- **Account deletion in-app is mandatory** where account creation exists. Already implemented (fixed-word
  type-to-confirm in "Til de voksne", per the settings rework). Verify it is reachable by a reviewer and
  that it actually deletes the server-side Neon rows, not just the local jar.
- **Token storage.** "An app may not store credentials or tokens to social networks off of the device."
  **UNKNOWN** whether Apple reads "social networks" as covering Google-as-identity-provider. The safe
  design, which costs nothing: exchange the Google assertion at sign-in and **never persist Google refresh
  tokens server-side in Neon.** Audit `lib/auth.ts` and the better-auth account table for this.

### 3.3 BLOCKER — Google sign-in and passkeys both break inside the shell

Neither of these was on the owner's suspect list, and both are certain, not speculative.

**Google OAuth in a WKWebView is blocked by Google.** From Google's own native-app OAuth doc, the
`disallowed_useragent` error is defined as "The authorization endpoint is displayed inside an embedded
user-agent disallowed by Google's OAuth 2.0 Policies", and the required approach is the system browser:
"Developers should instead use iOS libraries such as Google Sign-In for iOS or OpenID Foundation's AppAuth
for iOS… The SFSafariViewController library is also a supported option" —
https://developers.google.com/identity/protocols/oauth2/native-app (read 2026-08-06). Google's blog post
announcing enforcement in embedded webviews names `WKWebView` explicitly —
https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
(read 2026-08-06).

→ **Work:** move the Google sign-in launch to `@capacitor/browser` (which uses
`SFSafariViewController`/`ASWebAuthenticationSession`) and return via a deep link — a Universal Link on the
Vercel domain, or a custom scheme. `src/services/authStore.ts` already reasons about OAuth redirects and
bearer transport, so this is a launch-and-return change, not an auth redesign. Do not attempt the Google
flow inside the app's own webview; it will fail with a 403 the owner cannot work around.

**Passkeys will fail origin validation in the shell.** Production `rpID` is
**`preschool-learning-app.vercel.app`** with `origins: ['https://preschool-learning-app.vercel.app']`
(`lib/env.ts`, asserted in `lib/env.test.ts`). The shell's webview origin is **`capacitor://localhost`**,
which matches neither. Passkeys in a WKWebView additionally require the app to declare an **Associated
Domains** entitlement (`webcredentials:<domain>`) with an `apple-app-site-association` file served from
`/.well-known/` — the RP must be a verified domain linked to the app. (Sources here are community/vendor —
passkeys.dev iOS reference, corbado.com — read 2026-08-06; **no first-party Apple page was fetched for the
WKWebView-specific behaviour, so treat the mechanism as soft-confirmed, though the origin mismatch itself
is a certainty from this repo's own config.**)

→ **Decision for v1: drop passkeys inside the native shell.** Google (via system browser) plus Sign in
with Apple (§3.4) plus the existing adult PIN fully covers adult authentication. Native passkeys via
`ASAuthorizationPlatformPublicKeyCredential` plus Associated Domains are a real feature in their own right
and belong in a later version, not in the submission that is trying to clear review. Passkeys continue to
work on the web deployment, unchanged.

### 3.4 Sign in with Apple is required (Guideline 4.8)

The guideline is now headed **"4.8 Login Services"** and is written capability-first — **Sign in with Apple
is never named in it.** Verbatim — https://developer.apple.com/app-store/review/guidelines/
(read 2026-08-06):

> Apps that use a third-party or social login service (such as Facebook Login, **Google Sign-In**, Log in
> with X, Sign In with LinkedIn, Login with Amazon, or WeChat Login) to set up or authenticate the user's
> primary account with the app must also offer as an equivalent option another login service with the
> following features:
> - the login service limits data collection to the user's name and email address;
> - the login service allows users to keep their email address private as part of setting up their account;
>   and
> - the login service does not collect interactions with your app for advertising purposes without consent.
>
> Another login service is not required if:
> - Your app exclusively uses your company's own account setup and sign-in systems.
> - Your app is an alternative app marketplace, or an app distributed from an alternative app marketplace…
> - Your app is an education, enterprise, or business app that requires the user to sign in with an
>   existing education or enterprise account.
> - Your app uses a government or industry-backed citizen identification system or electronic ID…
> - Your app is a client for a specific third-party service and users are required to sign in to their
>   mail, social media, or other third-party account directly to access their content.

**Verdict: 4.8 is triggered and none of the five exemptions fit.** Google Sign-In is named in the first
sentence. "Exclusively uses your company's own account setup" fails on *exclusively*. The
education/enterprise exemption is for apps requiring an existing institutional account — this is a consumer
app. So a second login service is required.

**UNKNOWN as a cited claim:** that Sign in with Apple satisfies 4.8. Both
https://developer.apple.com/sign-in-with-apple/ and the Sign in with Apple JS doc returned JS-shell/empty
content on 2026-08-06, so no Apple sentence is in hand. The conclusion follows from mapping 4.8's three
bullets onto SIWA's known feature set (name+email only, Hide My Email, no ad tracking) — low-risk
inference, but flagged.

An alternative reading — that the app's own passkey/account path *is* the compliant "another login
service" — is plausible on the text but is an interpretation, not an Apple statement, and §3.3 drops
passkeys from the shell anyway. **Add Sign in with Apple. It is cheap and certain.**

**Work:** better-auth Apple provider, plus native `ASAuthorization` in the shell. **This step is gated on
the owner having paid for membership**, because Sign in with Apple is a capability enabled on the App ID
in the Developer portal (and, for any web flow, needs a Services ID and a key).

### 3.5 BLOCKER — a privacy policy must be written; none exists

There is **no privacy policy anywhere in the repo** (verified 2026-08-06: no match for
`privatlivspolitik` or `privacy polic` across `src/`, `public/`, `docs/`). For a Kids Category app this is
required twice over.

**5.1.4(b), verbatim** — https://developer.apple.com/app-store/review/guidelines/ (read 2026-08-06):

> apps in the Kids Category or those that collect, transmit, or have the capability to share personal
> information (e.g. name, address, email, location, photos, videos, drawings, the ability to chat, other
> personal data, or persistent identifiers used in combination with any of the above) from a minor **must
> include a privacy policy and must comply with all applicable children's privacy statutes.** For the sake
> of clarity, **the parental gate requirement for the Kid's Category is generally not the same as securing
> parental consent to collect personal data under these privacy statutes.**

**5.1.1(i)** requires the policy link **both** in App Store Connect metadata **and** inside the app "in an
easily accessible manner", and requires the policy to: identify what data is collected, how, and all uses;
**confirm that every third party it is shared with "will provide the same or equal protection of user data
as stated in the app's privacy policy and required by these Guidelines"**; and "Explain its data
retention/deletion policies and describe how a user can revoke consent and/or request deletion of the
user's data."

**5.1.2(i), verbatim** (same URL) — directly on point for cloud speech:

> You must clearly disclose where personal data will be shared with third parties, **including with
> third-party AI, and obtain explicit permission before doing so.**

**Work.** Author a Danish privacy policy (plus English, for reviewers) that:
- names **Google Cloud Speech-to-Text**, **Azure AI Speech**, **Neon** (Postgres, EU region) and **Vercel**
  as recipients/processors, with the equal-protection confirmation;
- states what leaves the device and when: the child's recorded audio only while Sig et Ord is enabled; the
  text to be spoken; the adult's email from Google/Apple sign-in; child profile names; progress rows;
- states retention and deletion, and points at the existing in-app account deletion;
- explains how to withdraw consent (i.e. turn the microphone game back off).

Host it as a route in the app **and** at a stable public URL for the App Store Connect metadata field.
Note the tension with Guideline 1.3's ban on links out of the app: put any outbound link **inside the
adult area behind the parental gate**, and satisfy "easily accessible" by rendering the policy text in-app
rather than only linking out.

### 3.6 BLOCKER-ADJACENT — Kids Category third-party transmission (Guideline 1.3 / 5.1.4)

**This is the plan's largest irreducible risk.** Read it carefully before designing the consent screen.

**1.3, verbatim** — https://developer.apple.com/app-store/review/guidelines/ (read 2026-08-06):

> These apps must not include links out of the app, purchasing opportunities, or other distractions to kids
> unless reserved for a designated area behind a parental gate. Keep in mind that once customers expect
> your app to follow the Kids Category requirements, it will need to continue to meet these guidelines in
> subsequent updates, **even if you decide to deselect the category.**
>
> You must comply with applicable privacy laws around the world relating to the collection of data from
> children online… In addition, **Kids Category apps may not send personally identifiable information or
> device information to third parties.** Apps in the Kids Category should not include third-party analytics
> or third-party advertising. This provides a safer experience for kids. In limited cases, third-party
> analytics may be permitted provided that the services do not collect or transmit the IDFA or any
> identifiable information about children (such as name, date of birth, email address), their location, or
> their devices…

**The sentence is flat and unqualified.** The only qualifier found anywhere in Apple's material is on the
kids-apps page: "Kids apps should not transmit personally identifiable information or device information to
third parties — **even in sections intended for adults** — unless the parent explicitly consents." —
https://developer.apple.com/app-store/kids-apps/ and https://developer.apple.com/kids/ (read 2026-08-06).

**Apple's published text nowhere carves out service providers, processors or sub-processors.** Sending a
child's recorded voice to Google Cloud STT is, on the face of the rule, transmission to a third party.
**Whether a data-processor relationship plus explicit parental consent satisfies a reviewer is UNKNOWN** —
no page read addresses processors at all. Do not present this as settled to the owner.

**Design that gives the best chance, per the owner's decision to ship the game:**
1. **Sig et Ord's microphone is OFF by default.** The game is not reachable until an adult enables it.
2. Enabling it lives in **"Til de voksne" behind the existing PIN**, on a dedicated consent screen that
   states plainly, in Danish, that the child's voice recording is sent to Google for recognition, is not
   stored, and can be turned off again at any time. This is the "parent explicitly consents" path.
3. **Verify Google Cloud STT data logging / model-improvement is OFF** on the project. Guideline 5.1.2(ii):
   "Data collected for one purpose may not be repurposed without further consent." This is an owner action
   in the Google Cloud console — see §4.3.
4. **Ship no analytics SDK at all.** Confirmed 2026-08-06 that the repo currently has none (the apparent
   matches for `amplitude` are the parallax `amplitude` token). Keep it that way; 1.3's analytics exception
   is too narrow to be worth using.
5. **Degrade gracefully when the microphone is denied** (5.1.1(iv): "Where possible, provide alternative
   solutions for users who don't grant consent"). Sig et Ord must not dead-end.

**Also from 5.1.4(a):** "Apps may ask for birthdate and parental contact information only for the purpose
of complying with these statutes, but must include some useful functionality or entertainment value
regardless of a person's age."

**Parental gates.** Apple's definition: "adult-level tasks that must be completed in order to continue
using your app or game" — https://developer.apple.com/kids/ (read 2026-08-06). And directly relevant to a
5-year-old: **"If your app is intended for pre-literate children, consider using a voiceover prompt to help
kids know that they need to involve their parent."** The existing PIN pad is the right shape; consider
adding the spoken prompt (which fits this app's prebaked-narration protocol).

**Verifiable parental consent.** Apple requires compliance with COPPA/GDPR ("must comply with all
applicable children's privacy statutes") but **does not implement or verify VPC itself**, and explicitly
warns the parental gate is not consent (5.1.4(b), quoted in §3.5). Danish/GDPR-K specifics are outside
Apple's documentation — **UNKNOWN from Apple sources**, and a legal question rather than an engineering one.

### 3.7 App Store Connect declarations

**Age band.** Kids Category bands are **"5 and under, 6-8, or 9-11"** —
https://developer.apple.com/kids/ and
https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
(read 2026-08-06). Three bands, unchanged. A 5–7 audience straddles two; **choose 6-8.**

**"Made for Kids" is permanent.** It is available only for apps whose calculated rating is 4+ or 9+, and
the selection **cannot be changed after App Review approval** (same ASC page, read 2026-08-06). Combined
with 1.3's "even if you decide to deselect the category", this is a one-way door. The owner should know
that before the first submission.

**The 2025 age-rating change is real and already in force.** Apple's news post of 2025-07-24: "The updated
age rating system adds **13+, 16+, and 18+** to the existing 4+ and 9+ ratings" with new questionnaire
topics (in-app controls; capabilities; medical or wellness topics; violent themes) —
https://developer.apple.com/news/?id=ks775ehf (read 2026-08-06). The upcoming-requirements page confirms it
is past: "**Age Rating Updates — Since: January 31, 2026**" —
https://developer.apple.com/news/upcoming-requirements/ (read 2026-08-06). Expect the newer questionnaire.
**UNKNOWN:** the exact mapping table between the OS-26 bands and the pre-26 bands (the page truncated).

**App Privacy questionnaire.** The load-bearing definition, verbatim —
https://developer.apple.com/app-store/app-privacy-details/ (read 2026-08-06):

> "Collect" refers to transmitting data off the device in a way that allows you and/or your third-party
> partners to access it for a period longer than what is necessary to service the transmitted request in
> real time.
> … Data that is processed only on device is not "collected" and does not need to be disclosed in your
> answers.

Declare, all with purpose **App Functionality** and **Linked to the user**:

| Data | Apple data type | Note |
|---|---|---|
| Adult email from Google/Apple sign-in | **Email Address** (Contact Info) | collected — it persists |
| Account + child profile IDs | **User ID** (Identifiers) | collected |
| Progress / XP / rewards synced to Neon | **Gameplay Content** (User Content) | collected — it persists |
| Child's voice → Google STT | **Audio Data** (User Content) | **see below** |
| Crash / error logs (`api/log-error.ts`) | **Crash Data** (Diagnostics) | check what it actually stores |

**On Audio Data:** audio streamed to STT and retained by nobody beyond servicing the request in real time
is, on Apple's own definition, arguably **not "collected."** That reading hinges entirely on Google Cloud's
retention configuration being verified off (§3.6 item 3) and on `api/stt.ts` not persisting the audio.
**It does not help with Guideline 1.3, which prohibits *sending*, not *storing*.** Given the uncertainty and
that over-disclosure is never a rejection reason, **declare Audio Data.** Answer **no** to Device ID.

**Tracking:** answer **no**. Apple's definition is linking data with third-party data for targeted
advertising, or sharing with a data broker (same page). Set `NSPrivacyTracking = false` with an empty
`NSPrivacyTrackingDomains`.

**Optional disclosure does not apply to anything here.** The four criteria must *all* be met, including
"Collection of the data occurs only in infrequent cases that are not part of your app's primary
functionality, and which are optional for the user" and a per-submission affirmative choice with the
account name displayed. Progress sync and sign-in email fail both. **Declare everything.**

**EU DSA trader status — a mandatory step the owner has not encountered.** "Even if you don't distribute
apps in the EU, you'll still need to declare a trader status." If declaring **trader**, an individual must
provide address or **P.O. Box**, phone and email, verified by 2FA plus documentation upload, and "Once
verified, Apple will publish this information on your App Store product page when your app is distributed
in any of the 27 territories of the EU." If declaring **non-trader**, no contact information is needed, but
"consumers in the EU will be informed that consumer rights stemming from applicable consumer protection
laws won't apply to contracts between you and them." —
https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
(read 2026-08-06). Enforcement is not theoretical: apps without verified trader status were **removed from
the EU App Store** from 2025-02-18 (https://developer.apple.com/news/upcoming-requirements/, read
2026-08-06).

→ A free app by a private individual with no commercial activity plausibly qualifies as **non-trader**,
which avoids publishing a home address. **But whether he is a trader is a legal determination, not
Apple's and not this document's — UNKNOWN, and explicitly the owner's call.** If he does declare trader,
note that a **P.O. Box is accepted here** (unlike Developer Program enrolment, which forbids P.O. boxes).

### 3.8 Review access for an account-gated app (Guideline 2.1)

**Verbatim** — https://developer.apple.com/app-store/review/guidelines/ (read 2026-08-06):

> Submissions to App Review… should be final versions with all necessary metadata and fully functional URLs
> included; placeholder text, empty websites, and other temporary content should be scrubbed before
> submission… and **include demo account info (and turn on your back-end service!) if your app includes a
> login.** If you are unable to provide a demo account due to legal or security obligations, you may
> include a built-in demo mode in lieu of a demo account **with prior approval by Apple.**

Three specific traps:
- A **Google-OIDC-only** login is hostile to review — a reviewer may not be able to sign into an arbitrary
  Google account. Once §3.2's guest path exists this mostly evaporates: the reviewer just plays. Still
  provide either a credential that works without Google, or clear notes saying no account is needed.
- **`?nogate=1` will not help a reviewer.** It is `DEV &&`-gated and `__HARNESS__` is statically false in
  any deploy build, so a production build contains zero occurrences of `nogate`. Do not mention it in
  review notes, and never ship the harness build.
- The Vercel functions, Neon DB, Azure and Google Cloud must be **live throughout review**.

Also: **write the review notes in English.** Apple's review correspondence is in English, and a Danish-only
app needs the reviewer told what they are looking at, that no account is required, where the parental gate
is, and that the microphone game is intentionally off by default.

### 3.9 Native project requirements

**Minimum SDK — confirmed, and it does NOT break the 17.7 iPad.** Since **2026-04-28**: "Apps uploaded to
App Store Connect must be built with Xcode 26 or later using an SDK for iOS 26, iPadOS 26, tvOS 26,
visionOS 26, or watchOS 26" — https://developer.apple.com/news/upcoming-requirements/ (read 2026-08-06),
announced 2026-02-03 at https://developer.apple.com/news/?id=ueeok6yw (read 2026-08-06).

The SDK and the deployment target are independent. Apple's Xcode support matrix lists, for **Xcode 26 and
every 26.x release**, minimum deployment targets of **iOS 15**, tvOS 15, watchOS 8, visionOS 1 —
https://developer.apple.com/support/xcode/ (read 2026-08-06). So: build with the iOS 26 SDK, set
**`IPHONEOS_DEPLOYMENT_TARGET = 17.0`** (matching the existing Vite target `['safari17','ios17']`), and the
app installs and runs on iPadOS 17.7.11. *Note the "your existing users on iOS 17 are unaffected" wording
appears only in third-party coverage, not on developer.apple.com — the conclusion rests on the support
matrix, which is solid.*

**Privacy manifest — `PrivacyInfo.xcprivacy` at the root of the app bundle.** Verbatim: "If you upload an
app to App Store Connect that uses required reason API without describing the reason in its privacy
manifest file, Apple sends you an email reminding you… **Starting May 1, 2024, apps that don't describe
their use of required reason API in their privacy manifest file aren't accepted by App Store Connect.**" —
https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
(read 2026-08-06). Top-level keys are `NSPrivacyTracking`, `NSPrivacyTrackingDomains`,
`NSPrivacyCollectedDataTypes`, `NSPrivacyAccessedAPITypes`; iOS location is the app-bundle root —
https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk
(read 2026-08-06).

For this app:
- `NSPrivacyTracking = false`, `NSPrivacyTrackingDomains = []`.
- `NSPrivacyAccessedAPICategoryUserDefaults` with reason **`CA92.1`** — "Declare this reason to access user
  defaults to read and write information that is only accessible to the app itself." A Capacitor/WKWebView
  app will touch UserDefaults. **Do not use `C56D.1`**, which is explicitly third-party-SDK-only. `1C8F.1`
  applies only with an App Group. Source:
  https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons
  (read 2026-08-06).
- `NSPrivacyCollectedDataTypes` mirroring §3.7's table.
- The other required-reason categories (File timestamp, System boot time, Disk space, Active keyboards) are
  unlikely to apply, but **check what Capacitor plugins actually call** before signing off. Apple notes it
  "continually reviews the list… and will update this article from time to time" — re-read at submission.

**Capacitor is on Apple's list of SDKs requiring a privacy manifest and signature.** Verbatim: "You must
include the privacy manifest for any SDK listed below when you submit new apps in App Store Connect that
include those SDKs… Signatures are also required in these cases where the listed SDKs are used as binary
dependencies." The list explicitly includes **`Capacitor`** and `Cordova` (also `GoogleSignIn`, `AppAuth`,
`GTMAppAuth`, the Firebase family) — https://developer.apple.com/support/third-party-SDK-requirements/
(read 2026-08-06). `WebKit`/`WKWebView` is not on the list (first-party framework). Practical effect: use
official Capacitor releases so their manifest and signature come along; if native Google Sign-In or AppAuth
is added, those are on the list too. **UNKNOWN:** whether the current Capacitor iOS pod ships its own
`PrivacyInfo.xcprivacy` — verify in the generated `ios/` tree rather than assuming.

**Microphone permission string.** `NSMicrophoneUsageDescription` is required, and the failure mode is
severe: "**If your app attempts to access any of the device's microphones without a corresponding purpose
string, your app exits.**" —
https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html
(read 2026-08-06); key reference at
https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription
(read 2026-08-06) — "This key is required if your app uses APIs that access the device's microphone."
Behaviour of an **empty** string is **UNKNOWN from Apple docs**; treat it as equivalent to missing.
Guideline 5.1.1(ii) also requires purpose strings to "clearly and completely describe your use of the
data" — so the Danish string must say the recording is sent to a speech-recognition service, not merely
"we need the microphone".

**Danish localization of the permission string.** "Localized values are stored in a strings file named
**`InfoPlist.strings`**… If a localized version of a key does not exist, the routines return the value
stored in the `Info.plist` file." —
https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AboutInformationPropertyListFiles.html
(read 2026-08-06). Create `da.lproj/InfoPlist.strings` with
`"NSMicrophoneUsageDescription" = "…dansk tekst…";`, keep the `Info.plist` value as the English fallback,
and **add `da` to the project's localizations** or the `.lproj` is silently not built into the bundle.
These files contain `æøå` — **write them with the Edit/Write tool, never a shell pipeline**, per the
standing rule in `.claude/rules/working-in-this-tree.md`.

**Danish as App Store primary language.** Primary language is "The default language for the metadata that
appears on App Store product pages… You can change the primary language at any time" —
https://developer.apple.com/help/app-store-connect/reference/app-information/ (read 2026-08-06). Set it to
Danish on the app record. **UNKNOWN:** whether Apple requires the binary to declare a matching
`CFBundleDevelopmentRegion` for the listing to use Danish as primary — the App Store localizations
reference page was not read.

**Webview configuration.** Keep Capacitor's defaults: `iosScheme: 'capacitor'`, `hostname: 'localhost'`.
Capacitor's docs say keeping the hostname as `localhost` "allows the use of Web APIs that would otherwise
require a secure context such as `navigator.geolocation` and `MediaDevices.getUserMedia`" —
https://capacitorjs.com/docs/config (read 2026-08-06). This is what makes `useSpeechInput`'s
`getUserMedia` + `MediaRecorder` path viable at all without a native rewrite.

**Universal-app consequences (the owner chose universal).** Set `TARGETED_DEVICE_FAMILY = 1,2`. Recommend
locking **iPhone to landscape** via `UISupportedInterfaceOrientations~iphone` to match the landscape-first
design, leaving iPad unrestricted. An iPhone layout pass is required work (§4.2) and can only ever reach
rung 2 (§5.5).

### 3.10 What bundling breaks in the existing web app

A bundled shell changes the meaning of four things that currently assume a network-served SPA. Audit each:

- **`utils/swCleanup.ts`** — the one-time legacy service-worker unregister and cache sweep. Harmless but
  pointless in the shell; confirm it cannot throw from a `capacitor://` origin.
- **`lazyWithReload`** — reloads once on a stale-chunk/dynamic-import failure. In a bundled app the chunks
  are local and can never be stale, so a reload loop would be pure harm. Confirm the sessionStorage guard
  holds under `capacitor://localhost`, or bypass the reload path in the shell.
- **The update banner and `/api/version`** — currently compares the running commit against the deployed
  one. In the shell the binary's version is decoupled from the Vercel deployment, so this check becomes
  meaningless at best and shows a permanent false "update available" pill at worst. Native updates come
  from the App Store; the banner must be disabled in the shell.
- **`vercel.json` caching headers** — irrelevant for bundled assets, still relevant for `api/`. No change
  needed, just do not reason about the two together.
- **`vite-plugin-pwa` is in `dependencies`** while the project deliberately has no service worker. Confirm
  it does not start emitting one in the shell build; a service worker inside a Capacitor webview is a
  category of bug nobody wants to debug remotely.

### 3.11 Azure AI Speech: shipping the prebaked MP3s is permitted, and owes one disclosure

Researched 2026-08-06 because Phase B's whole premise is putting ~2000 synthesized MP3s inside a
distributed binary, which is a different act from synthesizing on demand. **Verdict: permitted.** Two
things follow from it, one a check and one a piece of work.

The grant is in the Microsoft Product Terms → Microsoft Azure → *Foundry Tools and Content Safety* →
**Text-to-Speech (TTS) Services**, verbatim
(https://www.microsoft.com/licensing/terms/productoffering/MicrosoftAzure/EAEAS, and identically in the
`MCA` and `MOSA` program views — read 2026-08-06):

> **TTS Service output use rights**: For Customers of the paid tier TTS Service only, Customer may use the
> audio output of prebuilt neural voices generated using the TTS Service, including for commercial
> purposes.

No caching restriction, no redistribution restriction, and nothing requiring runtime synthesis. That
absence is meaningful rather than accidental: the **same document** restricts caching explicitly for Bing
Search ("must not cache or copy results") and Azure Maps ("may not cache or store results… longer than…
6 months"), so Microsoft writes such clauses when it means them. A full-text scan for `cach*` across the
Azure Product Terms hits Bing once and Azure Maps twice, and TTS zero times. The only limit on output use
is a competing-product clause ("will not use… to create, train, or improve… a similar or competing product
or service"), which a Danish preschool app does not approach.

**da-DK Christel and en-US Ava are prebuilt neural voices**, which is the permissive path. **Custom neural
voice is a Limited Access Service** with a wall of extra obligations (voice-talent written permission,
acknowledgement recordings, Microsoft retaining a copy of the synthetic voice) — never migrate this app to
one without re-reading all of it. The Transparency Note confirms the split: "**No registration or
pre-approval is required for additional use cases for prebuilt neural voice**"
(https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/transparency-note,
read 2026-08-06).

**THE CHECK — RESOLVED 2026-08-07, and the answer was the bad one.** The grant reads "For Customers of the
paid tier TTS Service **only**", and the Product Terms **never define "paid tier"** (one occurrence of the
phrase, zero of "free tier").

The resource — `preschool-tts`, Speech service, resource group `preschool-audio`, West Europe — was on
**Pricing tier: Free (F0)**. So the entire original prebake was generated outside the output-use grant.
This was invisible from the repo, which is why it needed a portal check rather than a code read.

Fixed the same day: the resource was switched **in place to Standard (S0)** — the key and endpoint are
unchanged, so no `.env.local` or Vercel env edit was needed — the 1884 MP3s were **deleted** and
`npm run tts:prebake` re-ran, writing 1884/1884 with 0 failures.

Two things worth knowing if this ever has to be redone:

- **Deleting the audio first is mandatory, not tidiness.** `prebake-tts.mjs` treats an existing non-empty
  file as done ("resumable across throttled runs", line ~91). A re-run against a populated directory
  synthesizes **nothing**, prints a successful-looking summary, and leaves the old clips in place. That is
  the silent no-op that would make this look fixed while it wasn't.
- **Only 124 of 1884 files changed bytes**, and `src/config/prebakedTts.ts` came back byte-identical.
  Azure's neural synthesis is near-deterministic for the same text, voice and settings, so *git cannot
  show you that this was done*. The regeneration is what satisfies the grant; the diff size is not
  evidence either way. Do not read a small diff as "the re-run didn't work".

Note the tier change ends the free allowance: S0 bills per character. The one-off prebake is a trivial
amount, and steady-state spend stays near zero because prebaked files mean the live API is only reached for
Sig et Ord's read-back. Exact per-character rates were not verified — see UNKNOWN 28.

**THE WORK — an AI-voice disclosure for parents.** This is a real obligation, it is not in Phase A, and it
survives prebaking, because the audio is still synthetic when it plays off local disk. The Code of Conduct
for Microsoft AI Services (v4.0, dated 2026-05-01;
https://learn.microsoft.com/en-us/legal/cognitive-services/speech-service/tts-code-of-conduct → the
unified `ai-code-of-conduct`, read 2026-08-06), Responsible AI requirement #3, says customers must:

> Disclose when the output, decisions, or actions are generated by AI, including the synthetic nature of
> generated voices, images, and/or videos, such that users are not likely to be deceived or duped…

And the Transparency Note aims a paragraph squarely at this app's audience:

> Consider proper disclosure to parents or other parties with use cases that are designed for or may be
> used in situations involving minors and children. If your use case is intended for minors or children,
> you'll need to ensure that your disclosure is clear and transparent so that parents or legal guardians
> can understand the role of synthetic media and make an informed decision on behalf of minors or children
> about whether to use the experience.

Implement as **one line of Danish text on the adult surface**, not on any child-facing screen — the child
is not the audience for it and it would violate nothing to omit it there. Suggested wording:

> Talen i appen er kunstigt fremstillet (AI-genereret tale fra Microsoft Azure).

Natural home is the **Privatliv** group in "Til de voksne" (created in Phase A3), beside the microphone
switch and the `/privatliv` text — a parent reading what the app sends where is exactly the parent this
disclosure is for. It needs no Microsoft branding; it needs to be true about synthesis. **Add the sentence
to `src/config/legalContent.ts` so the existing guard covers it**, rather than as JSX, for the same reason
A2 put the policy text in config: prose in a component cannot be asserted, and a tidy-up that deletes it is
invisible.

**Two caveats.** If the owner's Azure subscription sits under a negotiated, reseller or CSP agreement,
**that** agreement controls and may differ — the above is the standard published terms as served on
2026-08-06 (the Product Terms site embeds no publication date, so that is the strongest date claim
available). And Microsoft stores nothing itself ("Neither input text nor output audio content is stored in
Microsoft logs"), so no retention obligation flows back — that is about Microsoft's storage, not a limit on
ours.

---

## 4. The work, in order

Phases A and B are engineering. Phase C mixes engineering with **owner-only steps that this document stops
at.** Phase D is waiting.

### 4.0 Where this stands — read this first

Updated **2026-08-07**. Keep it updated; it is what lets a fresh session start from a two-line prompt
instead of a briefing.

**All work lives on the branch `feat/app-store-ios`** (pushed to origin). Never commit App Store work to
`master`, and do not merge without asking — `master` is the deploy trigger.

| | State |
|---|---|
| **Phase A** | **DONE** and on the branch. Guest play, `/privatliv` + `/support`, mic consent gate, offline-readiness audit, iPhone 6.9" pass, Google-token audit. Not merged to master, therefore **not deployed** — which is why the Support URL would 404 if Apple fetched it today. |
| **Phase B** | **DONE 2026-08-07** (B1–B9), commits `14d5a83` + `94bb491`, plus `78841cb` — see the API-origin note below, which was a genuine gap in B and is now closed. The `ios/` tree is committed; **nothing has been compiled** — no Mac has touched it. Deviations below. |
| **C7** Codemagic | **`codemagic.yaml` DONE** (`7c1908e`). Remaining is **OWNER**: connect the repo, and add the C6 `.p8` under the integration name **`bornelaering-asc`** (or rename it in the yaml). |
| **C0** Azure paid tier | **DONE 2026-08-07.** Was F0; now S0, all 1884 clips re-synthesized. §3.11. |
| **C1** enrolment | **DONE.** Individual, 99 USD paid. |
| Free Apps Agreement | **Active.** Paid Apps Agreement deliberately left unsigned — the app is free. |
| **C2** DSA trader status | **Submitted 2026-08-07, "In Review" with Apple.** Trader path, so the address will publish on the EU product page once verified. Gates EU *distribution*, not building. |
| **C4** Bundle ID | **`com.vraa.earlylearning`** — Sign in with Apple enabled, **no other capabilities**. Permanent. |
| **C5** App record | **Created.** Name `Børnelæring: ABC, tal, engelsk` (was available), primary language Danish, SKU `earlylearning`. Version 1.0 metadata, promo text, keywords, copyright and all 12 screenshots uploaded. "Sign-in required" **unticked** (guest play), release set to **Manual**. |
| **C6** ASC API key | **Created** — Team key, Admin role. The `.p8` lives on the owner's machine **outside the repo**; he uploads it to Codemagic himself. **Never ask him to paste its contents.** Key ID and Issuer ID are safe to handle. |
| Still unset in ASC | Age rating, **"Made for Kids"** (permanent once approved — do deliberately), the App Privacy questionnaire, and Denmark-only availability. None block Phase B. |

**What Phase B settled, and what it deliberately did differently.** Three deviations, all recorded in
the commits; none needs re-deciding, but a reader of §4.3 will notice them.

1. **No deep link for the Google return (B5).** The system browser is used, as required — but the
   `flowId` claim already makes the return URL carry nothing load-bearing, which is exactly what
   `OAuthReturnHandler`'s poll was built for. The sheet's `browserFinished` event is wired as a nudge
   that claims immediately; the poll is still the guarantee. This buys the deep link's behaviour with
   **no custom URL scheme, no second Google client and no server change** — so the Google Cloud console
   needs no new redirect URI.
2. **Capacitor 8 uses Swift Package Manager, not CocoaPods.** §3.9's "pod" wording is stale: there is no
   `Podfile`, and CI needs no `pod install`. Capacitor is a **binary** dependency (a checksum-pinned
   `Capacitor.xcframework`), which is the case where Apple also requires a signature — satisfied, see
   below.
3. **`ITSAppUsesNonExemptEncryption = false` is set in `Info.plist`.** The app uses only standard HTTPS,
   which is exempt, and without the key **every** TestFlight upload stops for a manual questionnaire.
   It is nevertheless an export-compliance declaration → **OWNER should confirm it**; deleting the key
   is the only change needed to revert.

**THE GAP PHASE B NEARLY SHIPPED — §3.1 says what still needs the network but never said how it is
ADDRESSED.** Inside the shell the page origin is `capacitor://localhost`, so every relative
`fetch('/api/…')` resolves against the app bundle, and Capacitor's local server answers it with the
SPA's `index.html` instead of failing. No 404, no exception, no console error — sign-in, sync, Sig et
Ord and bug reports would silently never have reached a server, while every game kept working, because
the games are offline by design. **A build like that passes every check and is dead.** Closed in
`78841cb`, and it needed three halves, not one: absolute URLs client-side (`src/config/apiBase.ts`),
`capacitor://localhost` in better-auth's `trustedOrigins()` (it validates Origin and would have refused
the app anyway), and a widened `Access-Control-Allow-Methods` (the shell preflights *everything*,
because every call carries `Authorization`).

One consequence worth carrying into any future domain move: **`SHELL_API_ORIGIN` is the one value in
the app that cannot be an environment variable**, because it is compiled into a reviewed binary. The
web follows a move on the next request; an installed shell never can. So the old host must keep
answering until every install has been replaced *through review*.

**UNKNOWNs closed by Phase B** (both were §3.9's, both resolved from the artifact that actually ships,
not from community reports):

- **The Capacitor bridge DOES implement** `webView:requestMediaCapturePermissionForOrigin:…` and calls
  `decisionHandler(.grant)` unconditionally, so a WKWebView `getUserMedia` will not prompt per call or
  refuse silently. Confirmed in 8.5.0's source **and** as a selector in the shipped `ios-arm64` Mach-O
  inside the checksum-matched xcframework. Pinned by `capacitorConfig.test.ts`.
- **Capacitor's xcframework carries its own `PrivacyInfo.xcprivacy` per slice and is code-signed**, which
  is what Apple requires of a listed SDK used as a binary dependency.

**Still UNKNOWN, and only the iPad can answer it (rung 3):** whether `getUserMedia` + `MediaRecorder`
actually capture usable audio from `capacitor://localhost` on iPadOS 17.7 — the OS permission prompt, the
`AVAudioSession` category interaction with Howler and the Web Audio graph, and the recorded codec. The JS
path is unchanged from Safari (`MIME_CANDIDATES` already falls back to `audio/mp4`), so the *code* risk is
low; the *device* risk is untested. Fallback if it fails is unchanged: capture in a native plugin and keep
`useSpeechInput`'s API shape.

**Decisions already taken — do not re-litigate:** the web build is **bundled**, never `server.url` (§3.1);
deployment target **17.0** against the iOS 26 SDK (§3.9); **universal**, iPhone landscape-locked; passkeys
**dropped from the shell** for v1 (§3.3); listing is **Danish-only, Denmark-only**; **no OTA live updates,
ever** (§3.1).

### 4.1 Phase A — web app changes (all doable and testable on Windows)

| # | Work | Notes |
|---|---|---|
| A1 | **Guest / local-play path** — app opens playable with no account | §3.2. `src/contexts/authGatePolicy.ts`, `AuthGate.tsx`; reuse `progressStore`'s inert-until-`attach()` design |
| A2 | **Privacy policy** — Danish + English, in-app route and public URL | §3.5. Names Google STT, Azure Speech, Neon, Vercel; retention, deletion, withdrawal |
| A3 | **Microphone consent gate** — Sig et Ord off by default, enabled in "Til de voksne" behind the PIN | §3.6. Plus graceful degradation when the mic is denied |
| A4 | **Offline-readiness audit** — the four items in §3.10 | Behaviour changes only; no new features |
| A5 | **iPhone 6.9" layout pass** | §4.2 below |
| A6 | **Sign in with Apple** — better-auth Apple provider | §3.4. **Blocked until membership is paid** (App ID capability). Sequence it after C1 |
| A7 | **Audit that no Google refresh token is persisted server-side** | §3.2. `lib/auth.ts` + better-auth account table |

A1–A5 and A7 can all proceed before a single dollar is spent. A6 cannot.

### 4.2 The iPhone problem, concretely

The owner chose universal, so the **6.9" iPhone screenshot set is mandatory** and Apple's reviewer will test
on an iPhone. He owns no iPhone.

- **Layout verification** uses the existing WebKit harness at 6.9" geometry — CSS **956×440 landscape**
  (or 440×956 portrait) at dpr 3, which is exactly 2868×1320:
  `.claude/skills/ui-screenshot/webkit.mjs --device iphone-landscape --w 956 --h 440`.
  The harness's built-in `iphone`/`iphone-landscape` presets are **390×844 @dpr 3 = 6.1" geometry, not
  6.9"** — the override is required. Consider adding a permanent `iphone-69` preset while doing this.
- **Screenshots** come from the same harness. These are genuine renders of the real app in real WebKit, not
  mockups, so they legitimately represent the app.
- **This is rung 2 forever.** Real iPhone touch feel, true iOS behaviour and any iPhone-specific WebKit
  quirk stay **UNKNOWN**. Say UNKNOWN; do not let a green harness run be reported as an iPhone verdict.

### 4.3 Phase B — the native shell

**ALL DONE 2026-08-07** (`14d5a83`, `94bb491`) — see §4.0 for the deviations and the UNKNOWNs it closed.
The table is kept as the record of what each item was.

Three things bit that are worth knowing before touching this tree again, all with the same shape — right
on Windows, wrong on the Mac, and invisible from here:

- **`.gitignore`'s blanket `*.json` swallowed the asset catalog's `Contents.json` files**, i.e. the ones
  naming which PNG is the app icon. An upload with no icon is rejected. Negated in `.gitignore`; the same
  trap as the `public/manifest.json` outage.
- **`npx cap sync ios` writes plugin paths into `Package.swift` with the HOST separator**, so a sync run
  on Windows emits backslashes that SPM on macOS cannot resolve. Use **`npm run cap:sync`**, never the
  bare CLI command; `capacitorConfig.test.ts` fails if a backslash returns.
- **Capacitor scaffolds a placeholder app icon** that is a perfectly valid PNG, so nothing complains
  locally. Replaced with `art-src/logo/app-store-icon-1024.png`, flattened — alpha is an upload
  rejection.

| # | Work | Notes |
|---|---|---|
| B1 | Capacitor scaffold; `webDir` = `dist`; **bundle `public/sounds` into the binary**; commit the generated `ios/` tree | §3.1. Do NOT set `server.url` |
| B2 | `Info.plist`: `NSMicrophoneUsageDescription`, deployment target **17.0**, `TARGETED_DEVICE_FAMILY = 1,2`, iPhone landscape lock | §3.9 |
| B3 | `da.lproj/InfoPlist.strings` with the Danish mic string; add `da` to project localizations | §3.9. Edit tool only — `æøå` |
| B4 | `PrivacyInfo.xcprivacy`: tracking false, `CA92.1`, collected data types; verify Capacitor's own manifest is present | §3.9 |
| B5 | Google sign-in via `@capacitor/browser` + deep-link return | §3.3. Must not run in the app's webview |
| B6 | Remove passkeys from the shell's sign-in options (web deployment keeps them) | §3.3 |
| B7 | **Mic spike** — verify `getUserMedia` + `MediaRecorder` actually work from `capacitor://localhost` on iPadOS 17.7 | see below |
| B8 | Disable the update banner in the shell | §3.10 |
| B9 | **AI-voice disclosure** — one Danish line in the Privatliv group, via `legalContent.ts` so the guard covers it | §3.11. Microsoft Code of Conduct obligation, not an Apple one. Not native work; it is here only because Phase A had shipped before it was found |

**B7 was a genuine spike, and its static half came back clean.** Capacitor's docs say `localhost` grants
the secure context `getUserMedia` needs (§3.9), and `NSMicrophoneUsageDescription` covers the OS
permission. What was **UNKNOWN from first-party sources** was whether Capacitor's bridge implements the
iOS 15+ WKUIDelegate method `webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:
decisionHandler:`; without it, a WKWebView can prompt on every `getUserMedia` call or refuse silently.
Community reports pointed both ways (Apple Developer Forums threads 734363 and 692421;
ionic-team/capacitor issues 5071 and 6759 — read 2026-08-06), which is why it needed a spike rather than
a search.

**Resolved 2026-08-07: it implements it and grants unconditionally** — in 8.5.0's source and as a selector
in the shipped `ios-arm64` binary (§4.0). **The device half stays UNKNOWN and is rung 3.** The fallback is
unchanged if it fails on the iPad: capture audio in a native plugin and hand the buffer to the webview,
keeping `useSpeechInput`'s API shape.

The whole of Phase B can only be *compiled* on Codemagic, so expect the loop "push → CI build → read log"
rather than local iteration — **nothing in Phase B has been compiled yet.** B1–B9 were kept small and
independently pushable for that reason. B9 was the exception — a plain text change needing no build.

### 4.4 Phase C — turning that into a submitted build

**Owner-only steps are marked OWNER. This document stops at each of them.**

| # | Step | Who |
|---|---|---|
| C0 | ~~Confirm the TTS prebake ran on a PAID (S0) Azure resource~~ — **DONE 2026-08-07.** It was **F0**; resource switched in place to **S0**, all 1884 clips deleted and re-synthesized (1884/1884, 0 failed), audit clean. §3.11 | done |
| C1 | **Enrol in the Apple Developer Program — 99 USD/year.** May require the iPad for photo-ID verification (§2.4). Enrol as an **individual**; note the legal name becomes the App Store seller name | **OWNER — payment and a legal agreement** |
| C2 | **Declare EU DSA trader status.** Non-trader vs trader is a legal determination and his call (§3.7) | **OWNER — legal declaration** |
| C3 | Accept the Program License Agreement; free-only apps need no Paid Apps agreement, tax or banking forms | **OWNER — legal agreement** |
| C4 | Register the Bundle ID; enable the Sign in with Apple capability on it | either (web) |
| C5 | Create the app record in App Store Connect; primary language **Danish** | either (web) |
| C6 | Create an **App Store Connect API key** (Users and Access → Integrations) and hand the `.p8` to Codemagic | **OWNER — credential creation** |
| C7 | Connect the repo to Codemagic; author `codemagic.yaml` from its Ionic/Capacitor recipe; ASC API key integration for automatic signing. **No `pod install` step — Capacitor 8 is SPM.** Run **`npx cap sync ios`** in CI (on macOS it rewrites `Package.swift`'s paths correctly anyway) after `npm ci && npm run build` | agent |
| C8 | First successful build → uploaded to TestFlight | agent (CI) |
| C9 | **Install via TestFlight on the iPad and play-test.** Internal testers accept by email and install with the TestFlight app; builds last 90 days | **OWNER — tapping a device** |
| C10 | Metadata + screenshots + questionnaires (see below) | either |
| C11 | **Submit for review** | **OWNER — his submission** |

TestFlight needs no Mac: up to 100 internal testers, invited by email, installing via the TestFlight app —
https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/
(read 2026-08-06). **UNKNOWN:** whether internal testing formally skips Beta App Review; that page does not
mention it either way.

**C10 in detail.** Screenshot specs from
https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/ (read 2026-08-06):
one to ten per display size, `.jpeg`/`.jpg`/`.png`, no alpha or transparency.

- **iPad 13" — "Required if app runs on iPad".** Accepted: 2064×2752 / 2752×2064 **or 2048×2732 /
  2732×2048.** The owner's 12.9" iPad Pro captures natively at 2048×2732 (portrait) / **2732×2048
  (landscape)** — so screenshots taken straight off his son's iPad satisfy the mandatory slot with no
  simulator, no Mac and no resizing. Landscape is explicitly accepted, which suits the design.
- **iPhone 6.9" — "Required if app runs on iPhone".** Accepted: 1320×2868 portrait or **2868×1320
  landscape.** Produce these from the WebKit harness per §4.2.
- All smaller iPad and iPhone sizes are optional and auto-scaled from the 13" / 6.9" sets.

Also in C10: age band **6-8**; **"Made for Kids"** (permanent — §3.7); the App Privacy questionnaire per
§3.7; the privacy policy URL; the updated age-rating questionnaire; and **English review notes** naming the
guest path, the parental gate, and the intentionally-off microphone (§3.8).

### 4.5 Phase D — submission to listed

Little of this is engineering; it is included so the owner is not surprised.

- Apple reviews the build. Review duration is **UNKNOWN** — no first-party current figure was read; do not
  quote a number from memory.
- **Expect at least one rejection.** For a first Kids Category submission with a webview shell and an
  account system, §5 lists five plausible grounds. A rejection arrives as a message in App Store Connect
  with a guideline number; you reply in the same thread, fix, and upload a new build. This is a normal loop,
  not a failure.
- Once approved, the owner controls release (manual or automatic). The app appears on the Danish App Store,
  with EU trader information shown or the non-trader consumer-rights notice, per C2.
- After approval, the **Kids Category selection cannot be undone**, and the Kids guidelines continue to
  bind every future update even if the category is later deselected (§3.7).

---

## 5. Where this can still fail review

Honest, ranked. Nothing here is fully mitigable by writing code.

1. **Guideline 1.3 — the child's voice going to Google STT.** Apple's text prohibits sending PII or device
   information to third parties with **no processor carve-out**, and no page read addresses processors at
   all. The mitigations in §3.6 (off by default, adult consent behind the PIN, no retention at Google, no
   analytics) are the strongest available and are still **UNKNOWN** against a reviewer's reading. If
   rejected here, the fallback is to ship without Sig et Ord and re-add it after a conversation with
   App Review — which is why §3.6's design keeps the game behind a switch that can be defaulted off.
2. **Guideline 4.2 — "beyond a repackaged website."** Bundling, genuine offline play, and native
   mic/auth/haptics make a strong case, but 4.2 is a judgement call and a webview shell always attracts it.
   24 games with authored art and Danish narration is a good answer; be ready to make it in writing.
3. **Guideline 5.1.1(v) — the login gate.** Mitigated by the guest path (§3.2). Residual risk if the guest
   path is partial — e.g. if some sections still demand an account.
4. **Guideline 2.1 — review access.** Mostly dissolved by the guest path, but a reviewer who cannot get
   past a sign-in screen rejects on sight. Verify on the TestFlight build, not on dev.
5. **iPhone layouts that no human has ever seen.** Universal means the reviewer tests on an iPhone. Rung 2
   is the ceiling (§4.2); a landscape-first design at 6.9" may have real defects that only surface in
   review. This risk was accepted knowingly and is the price of choosing universal.

Not a risk, confirmed: the iOS 26 SDK requirement versus the 17.7.11 device (§3.9).

---

## 6. UNKNOWNs, collected

Re-check these rather than re-deriving them. Each is UNKNOWN because a fetch failed or because Apple's
documentation is silent — not because nobody looked.

**Cost and enrolment**
1. The Developer Program fee in **DKK/EUR** — shown only inside checkout; `developer.apple.com/dk/programs/enroll/` 404s.
2. Whether **individual web enrolment** always redirects into the Apple Developer app for photo-ID verification.
3. Street price of a used/refurbished Mac mini (§1.5) — not from a doc read.

**Signing and CI**
4. Whether Apple accepts an **OpenSSL-generated CSR for an iOS *distribution* certificate**. Apple's page documents only Keychain.
5. The `POST /v1/certificates` request-body attribute names — the doc did not render them.
6. **GitHub's current macOS minute multiplier**, and whether Free-plan included minutes may be spent on macOS at all.
7. **Bitrise's credit→macOS-minute conversion.**
8. Whether `npx cap add ios` works on **Windows** (moot while CI does the archive).
9. Ionic **Appflow's** shutdown dates — third-party sources only.
10. Whether **Expo EAS** supports Capacitor at all (no Expo doc mentions it).
11. The soft-confirmed `iTMSTransporter` `-assetFile`-required-in-2026 change (search snippet, not a page read).

**Review and store**
12. **Whether a data-processor relationship satisfies Guideline 1.3.** The most consequential UNKNOWN in this document.
13. Whether **Sign in with Apple** is documented by Apple as satisfying 4.8 — the SIWA pages returned JS shells.
14. Whether internal **TestFlight** testing formally skips Beta App Review.
15. **App Review duration** — no current first-party figure read.
16. The mapping table between the **OS-26 age bands and the pre-26 bands** (page truncated).
17. Whether the binary must declare a matching **`CFBundleDevelopmentRegion`** for Danish to work as the store's primary language.
18. Whether "**social networks**" in 5.1.1(v)'s token-storage clause covers Google-as-identity-provider.
19. Apple's **account-deletion** support page mechanics (linked from 5.1.1(v), not read).
20. Whether the owner is a **trader** under the EU DSA — a legal question, and his to answer.

**Native behaviour**
21. Whether Capacitor's bridge implements **`requestMediaCapturePermissionForOrigin`**, i.e. whether `getUserMedia` behaves in the shell. This is spike B7.
22. Whether the current **Capacitor iOS pod ships its own `PrivacyInfo.xcprivacy`.**
23. iOS behaviour of an **empty** `NSMicrophoneUsageDescription` string (treat as equivalent to missing).
24. Everything about **real iPhone** behaviour — permanently rung-2 at best (§4.2).
25. Whether the **native `AVAudioSession` category reaches the webview at all.** WebKit bug 167788 is titled "WKWebView seems to ignore AVAudioSession category settings in iOS app", reports go both ways, and Apple's own category doc rendered as a JS shell. So "a native shell fixes the ringer-switch silencing narration" is **NOT established** — it is a lever whose connection to anything here is a **rung-3 device test** in TestFlight. Cheap to try in Phase B; do not design around it, and do not repeat the claim that it helps the `resume()` class of bug, for which there is no evidence either.

**Third-party licensing**
26. ~~Whether the prebaked TTS was synthesized on a PAID Azure tier.~~ **RESOLVED 2026-08-07: it was NOT — the resource was F0.** Switched to S0 and all 1884 clips re-synthesized. §3.11. *(The larger question — whether shipping the MP3s in a binary is allowed at all — was resolved 2026-08-06: it is.)*
27. Whether the owner's Azure subscription is under a **negotiated / reseller / CSP agreement**, which would control instead of the published Product Terms (§3.11).
28. **Azure's current per-character TTS rate.** Never verified against a live pricing page; the "a dollar or two for a full prebake" figure quoted in conversation was an estimate, not a source. Only matters if prebake volume grows a lot — the steady state is near zero.

---

## 7. Sources

All read **2026-08-06**.

**Apple — review and policy:** [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) ·
[Kids apps](https://developer.apple.com/app-store/kids-apps/) ·
[Design safe and age-appropriate experiences](https://developer.apple.com/kids/) ·
[App privacy details](https://developer.apple.com/app-store/app-privacy-details/) ·
[User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/) ·
[Age assurance](https://developer.apple.com/support/age-assurance/) ·
[Updated age ratings (2025-07-24)](https://developer.apple.com/news/?id=ks775ehf) ·
[Age rating values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) ·
[Set an app age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/) ·
[EU DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)

**Apple — technical:** [Upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) ·
[SDK minimum requirements (2026-02-03)](https://developer.apple.com/news/?id=ueeok6yw) ·
[Xcode support matrix](https://developer.apple.com/support/xcode/) ·
[Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) ·
[Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api) ·
[Required-reason API reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons) ·
[Adding a privacy manifest](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk) ·
[Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/) ·
[Privacy requirement starts May 1 (2024-04-26)](https://developer.apple.com/news/?id=pvszzano) ·
[NSMicrophoneUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsmicrophoneusagedescription) ·
[Cocoa Keys (archive)](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CocoaKeys.html) ·
[About Info.plist files (archive)](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AboutInformationPropertyListFiles.html)

**Apple — enrolment, signing, delivery:** [Enrollment](https://developer.apple.com/support/enrollment/) ·
[Identity verification](https://developer.apple.com/help/account/membership/identity-verification) ·
[Enrolling in the app](https://developer.apple.com/help/account/membership/enrolling-in-the-app/) ·
[Create a CSR](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request/) ·
[App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi) ·
[POST /v1/certificates](https://developer.apple.com/documentation/appstoreconnectapi/post-v1-certificates) ·
[Uploading assets to ASC](https://developer.apple.com/documentation/appstoreconnectapi/uploading-assets-to-app-store-connect) ·
[Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds) ·
[Transporter User Guide](https://help.apple.com/itc/transporteruserguide/en.lproj/static.html) ·
[Add internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/) ·
[Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) ·
[App information reference](https://developer.apple.com/help/app-store-connect/reference/app-information/) ·
[Xcode Cloud](https://developer.apple.com/xcode-cloud/) ·
[Configuring your first Xcode Cloud workflow](https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow) ·
[Setting up your project for Xcode Cloud](https://developer.apple.com/documentation/xcode/setting-up-your-project-to-use-xcode-cloud)

**Non-Apple:** [Codemagic pricing](https://codemagic.io/pricing/) ·
[Codemagic Ionic/Capacitor build](https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/) ·
[Codemagic iOS signing](https://docs.codemagic.io/yaml-code-signing/signing-ios/) ·
[GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage) ·
[GitHub Actions rates](https://docs.github.com/en/billing/reference/actions-minute-multipliers) ·
[Bitrise pricing](https://bitrise.io/pricing) ·
[Capawesome pricing](https://capawesome.io/pricing) ·
[Capacitor config](https://capacitorjs.com/docs/config) ·
[Capacitor iOS](https://capacitorjs.com/docs/ios) ·
[Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup) ·
[Google OAuth for native apps](https://developers.google.com/identity/protocols/oauth2/native-app) ·
[Google embedded-webview OAuth changes](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/)
