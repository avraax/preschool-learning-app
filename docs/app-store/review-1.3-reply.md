# Reply to App Review — Guideline 1.3 (Kids Category) questionnaire

Submission `aa69dd0f-9761-403c-abba-5fb5ef7f5c32`, App Version 1.0, received 2026-09-07.
Apple asked four questions; the paste-ready answer is below. Every claim in it is sourced from this repo
and cross-checked against `docs/app-store/policy-verification.md` (which is itself pinned by
`src/config/legalContent.test.ts`). If the app changes, update both.

---

## Paste this into the App Store Connect review message

Hello,

Thank you for the questions. Answers below, in order. The app is a free Danish learning app for
children aged 5–8, written by a single developer for his own son. There is no advertising, no tracking,
no analytics and no in-app purchase. The full privacy policy is at https://boernelaering.dk/privatliv
and is also rendered inside the app under "Indstillinger" → "Privatliv" (rendered in-app rather than
linked out, per Guideline 1.3).

**1. Does the app include third-party analytics?**

No. The app contains no analytics SDK of any kind — no third-party statistics, measurement, attribution
or crash-reporting SDK, and no advertising identifier. The only third-party frameworks in the binary are
Capacitor (`@capacitor/core`, `@capacitor/app`, `@capacitor/browser`), which provide the WebView shell
and open the OAuth sign-in page; none of them collects or transmits data. There is a developer-only
console-forwarding path in the source, and it is hard-gated to `localhost` builds, so it is inert in the
shipped app.

**2. Does the app include third-party advertising?**

No. The app contains no ad network, no ad SDK and no ads of any kind. It never presents the App Tracking
Transparency prompt because it does no tracking, and it has no in-app purchases.

**3. Will the data be shared with any third parties?**

Data is never sold, never shared with data brokers, never used for advertising and never used to train
any model. The app uses four service providers, all acting strictly as data processors on our
instruction under contract, all configured to run in the EU:

- **Vercel** (hosting, region `fra1`, Frankfurt) — serves the app's server functions and stores
  user-initiated problem reports (EU Blob store, Frankfurt).
- **Neon** (PostgreSQL, `eu-central-1`, Frankfurt) — only if the adult chooses to create an account:
  the adult's email address, child profile names and chosen characters, and the child's learning
  progress.
- **Microsoft Azure AI Speech** (West Europe) — receives *text only*, in the rare case a spoken line is
  not already pre-recorded inside the app. No audio from the child is ever sent here. All speech in the
  app is synthetic (computer-generated), generated in advance and shipped inside the binary; this is
  disclosed in the app and in the policy.
- **Google Cloud Speech-to-Text** (Google's EU region, `eu`) — receives the child's voice audio from one
  game ("Sig et Ord"), and *only* if an adult has explicitly switched the microphone on (see question 4).
  The audio is used to recognise the single spoken word, a text transcript is returned, and nothing is
  stored on our side. Google's audio data-logging program is an opt-in; it is disabled on our project,
  and Google does not offer it at all for the V2 API that the app calls.

Each of these providers is contractually bound to provide the same or equal protection of user data as
our privacy policy describes and as the App Review Guidelines require, and none may use the data for
their own purposes, for advertising, or for model training. All four are named in the privacy policy
with a statement of exactly what each receives.

Google, Microsoft and Vercel are US-headquartered, so access from the US cannot be entirely excluded
(for example during support). Any such transfer relies on the European Commission's Standard
Contractual Clauses and those companies' EU-US Data Privacy Framework certification. This is disclosed
in the policy.

**4. Is the app collecting any user or device data for purposes beyond third-party analytics or
third-party advertising? If so, a complete and clear explanation of all planned uses.**

Yes — a small amount, all of it for the app's own function, listed exhaustively:

*By default (no account, microphone off), nothing about the child leaves the device.* All progress,
rewards, difficulty settings and preferences are stored in device storage only. The app is a bundled
build (no remote code loading, no live updates), so the games run with no network at all. Like any
network request, our own server sees a standard IP address and user-agent when the app checks for a
newer version; that is not linked to a child, not retained for any other purpose and not shared.

- **Optional adult account** — a sign-in with Apple or Google, chosen by an adult, and only ever
  optional; the whole app is playable without it. We receive the adult's email address and name from the
  identity provider, plus a child profile display name (free text the adult types — no real name is
  required) with a chosen cartoon character, and the child's learning progress (points, level, collected
  rewards, difficulty settings). If the adult chooses to add a passkey, the passkey's public key is
  stored with the account so they can sign in again on that device; no biometric data ever reaches us.
  *Purpose:* the two things the account buys — more than one child
  profile, and progress that follows the child to another device. *Legal basis:* performance of the
  contract with the adult, GDPR Art. 6(1)(b). *Deletion:* one action inside the app, "Indstillinger" →
  "Konto" → "Slet kontoen helt", which cascade-deletes the account, all child profiles and all progress
  from the server.

- **Microphone, one game only ("Sig et Ord")** — the child says a single Danish word and the game
  checks it. The microphone is **OFF on installation** and a child cannot switch it on. An adult must
  open the grown-ups area behind a passcode gate, read a consent screen that names Google Cloud
  Speech-to-Text explicitly, states that the recording is not stored, and states that it can be turned
  off again — and then actively consent. Audio is captured only while the child holds the microphone
  button down. *Purpose:* recognising the one spoken word, nothing else. *Legal basis:* the adult's
  explicit consent, Art. 6(1)(a), withdrawable in one tap in the same place. No recording is retained.

- **Problem reports — only when an adult taps "Rapportér et problem"** in the grown-ups area. The report
  contains a screenshot of the current screen plus technical state: app version and build, current
  route, device model and OS version, screen and viewport size, language, timezone, the audio
  subsystem's status, and the local progress values. It contains no email address and no name.
  *Purpose:* diagnosing the bug the adult is reporting. *Legal basis:* legitimate interest in being able
  to fix the app, Art. 6(1)(f). Reports are deleted on request to the address in the policy.

- **Crash reports** — if the app crashes, a technical error description is sent. No screenshot. Same
  purpose and basis as above.

- **Failed sign-in diagnostic** — if an adult's sign-in fails, a technical report with a screenshot of
  the sign-in screen is sent automatically, because these failures are otherwise impossible to
  reproduce. The passcode and any credential fields are stripped from the image first, and the report
  never contains the email address or the passcode. This automatic upload is disclosed in the privacy
  policy in both Danish and English.

For completeness, what the app never does: it never asks for date of birth, address, phone number or
location; it uses neither camera nor contacts; it has no chat, no messaging, no user-generated content
and no social features; nothing a child does is shared with anyone; there are no links out of the app
except an email address behind the parental gate; and no data is sold or used for model training.

The data controller is Allan Brink Vraa, allanvraa@gmail.com, and the policy states the rights of
access, rectification, erasure, restriction and portability, the right to withdraw consent, and the
right to complain to the Danish Data Protection Agency (Datatilsynet).

Happy to answer anything further.

Best regards,
Allan Brink Vraa
