# Reply to App Review — Guideline 1.3 (Kids Category) questionnaire

Submission `aa69dd0f-9761-403c-abba-5fb5ef7f5c32`, App Version 1.0, received 2026-09-07. This is the
routine automated Kids Category questionnaire, not a rejection.

**THE FIELD IS CAPPED AT 4000 CHARACTERS.** App Store Connect's "Reply to App Review" box counts
characters and refuses to submit over the cap (it shows the overage as a negative number). The first
draft of this answer was ~7800 and could not be sent. **The block below is 3990 characters — measure
before editing it**, and prefer cutting a whole claim to shaving words, which barely moves the count:

```
node -e "const s=require('fs').readFileSync('reply.txt','utf8').replace(/\r\n/g,'\n').trimEnd();console.log([...s].length)"
```

Every claim is sourced from this repo and cross-checked against `policy-verification.md`, which is
itself pinned by `src/config/legalContent.test.ts`. If the app changes, update both.

---

## Paste this into the App Store Connect review message

Hello,

Answers in order. Børnelæring is a free Danish learning app for children aged 5-8, with no advertising, no tracking, no analytics and no in-app purchase. Privacy policy: https://boernelaering.dk/privatliv, also shown inside the app under "Indstillinger" → "Privatliv" (in-app, not linked out, per Guideline 1.3).

1. THIRD-PARTY ANALYTICS? No. No analytics, measurement, attribution or crash-reporting SDK, and no advertising identifier. The only third-party frameworks in the binary are Capacitor (core, app, browser) — the WebView shell and the sign-in page; they collect and transmit nothing.

2. THIRD-PARTY ADVERTISING? No. No ad network, no ad SDK, no ads of any kind. Nothing is tracked, so there is no App Tracking Transparency prompt. No in-app purchases.

3. SHARED WITH THIRD PARTIES? Data is never sold, never shared with data brokers, and never used for advertising or model training. Four providers act as data processors on our instruction, all configured to run in the EU, each contractually bound to give user data the same or equal protection our policy states and these Guidelines require:
- Vercel (hosting, Frankfurt): serves the app's server functions; stores problem reports.
- Neon (PostgreSQL, Frankfurt): only with an account — the adult's email, child profile names and chosen characters, the child's progress.
- Microsoft Azure AI Speech (West Europe): text only, for a line not already pre-recorded in the app. No child audio goes here.
- Google Cloud Speech-to-Text (EU region): the child's voice from one game, only if an adult switched the microphone on (see 4). Used to recognise one word; a transcript comes back and nothing is stored on our side. Google's audio data-logging is disabled on our project and unavailable for the API version we call.

4. OTHER DATA COLLECTED, AND EVERY USE. By default — no account, microphone off — nothing about the child leaves the device: progress, rewards and settings live on the device, and the build is bundled, so the games run with no network. Our server sees only the standard IP address and user-agent of a request; linked to no child, used for nothing else.
- Optional adult account (Sign in with Apple or Google; the app is fully playable without one): the adult's email and name from the provider, a child profile name the adult types (no real name required) with a chosen cartoon character, and the child's progress — points, level, rewards, difficulty. A passkey, if added, stores only its public key. Purpose: multiple child profiles, and progress that follows the child to another device. "Indstillinger" → "Konto" → "Slet kontoen helt" deletes the account, all profiles and all progress.
- Microphone, one game ("Sig et Ord"): OFF on installation, and a child cannot enable it. An adult must pass a passcode gate and consent on a screen naming Google Cloud Speech-to-Text, stating the recording is not stored and can be switched off again. Audio is captured only while the child holds the button, and only to recognise that one word. Consent is withdrawable in one tap. Nothing retained.
- Message from "Send feedback", only when an adult writes one and presses Send: the text, technical state (app version, route, device and OS, viewport, language, timezone, audio status, local progress), and a screenshot unless the adult unticks it. No email, no name. Purpose: fixing the app. Deleted on request.
- Crash: a technical error description, no screenshot, same purpose.
- Failed sign-in: a technical report plus a screenshot of the sign-in screen, sent automatically because these failures are otherwise unreproducible. Credential fields and the passcode are stripped from the image; it never contains the email or the passcode. Disclosed in the policy.

The app never asks for date of birth, address, phone number or location, uses no camera and no contacts, has no chat or user-generated content, and no links out except an email address behind the parental gate.

Best regards,
Allan Brink Vraa

---

## What was cut to fit, and why it is safe to leave out

All four questions are still answered in full; what went was material Apple did not ask for and that the
linked policy already carries. **If a follow-up asks for any of it, the source is `policy-verification.md`.**

- **The EU→US transfer paragraph** (SCCs + the providers' EU-US Data Privacy Framework certification).
  A GDPR Art. 13(1)(f) item, not an App Review one, and it is in the policy. This was the single biggest
  cut and the one that finally fit the reply under the cap.
- **The synthetic-voice disclosure** on the Azure line. It is a Microsoft Code of Conduct duty
  (`legalContent.ts`), discharged in the app and the listing — not something Apple asked here.
- **The GDPR Art. 6 legal bases** per purpose. Replaced by plain "Purpose:" statements; the bases stay
  in the policy.
- **The controller line** (name + email). Apple already has the account holder, and the policy states it.
- **The dev-only console-forwarding path**, which is hard-gated to `localhost` and inert in the shipped
  binary. Mentioning an inert code path invites a question rather than answering one; the "no analytics
  SDK" claim is true without the caveat.
