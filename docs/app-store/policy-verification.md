# Is the privacy policy TRUE, and is it VALID? — the audit, so you don't have to read it all

Done 2026-08-06, against the code in this repo and the published rules. Companion to `phase-a.md`.

**The split that matters.** Three different questions were bundled together, and only two of them are
answerable by me:

| Question | Answerable? | By what |
|---|---|---|
| Is every factual claim TRUE of this app? | **Yes, mechanically** | Reading the code. Done below, and pinned by `src/config/legalContent.test.ts` |
| Does it contain what Apple and the GDPR REQUIRE? | **Yes, as a checklist** | Apple's guidelines + GDPR Art. 13, item by item. Done below |
| Is it legally SUFFICIENT for you, in Denmark? | **No** | That is a determination about your circumstances, not a fact about the code. Nothing here is legal advice |

The third is genuinely smaller than it looks, because the first two remove almost all of it: what is left
is "am I the controller and is this enough", not "does this document describe the app".

---

## 1. Every claim, checked against the code

Sources are files in this repo. **Four claims were wrong and are now fixed** — those are the rows worth
your attention.

| Claim | Verdict | Evidence |
|---|---|---|
| No ads, no tracking, no analytics SDK | **TRUE** | No analytics/ads package in `package.json`. The apparent `amplitude` matches are the parallax token |
| Never asks for birthdate, address, phone, location; no camera, no contacts | **TRUE** | No `navigator.geolocation`, no contacts API, no `video` constraint anywhere in `src/` |
| The recording is not stored | **TRUE** on our side | `api/stt.ts` performs no write of any kind — it forwards and returns a transcript |
| Speech recognition runs in the EU | **TRUE** | `STT_LOCATION = 'eu'`, `eu-speech.googleapis.com` (`api/stt.ts`) |
| Database is in the EU | **TRUE** | Neon `eu-central-1` (Frankfurt) |
| **Bug reports are in the EU** | **WAS FALSE → fixed** | Reports carry a screenshot of the child's screen. The Blob store defaulted to `iad1` (Virginia) and stayed there for 27 days, unnoticed **because this table had no row for it** — "database" did not cover it. Now Blob store `bornelaering-bug-reports-eu` in `fra1`; a store's region cannot be changed, so it was recreated and the 25 reports copied across |
| Speech synthesis region | **TRUE** | Azure `westeurope` |
| Server functions in Frankfurt | **TRUE** | `vercel.json` `"regions": ["fra1"]` |
| Deleting the account deletes the server rows | **TRUE** | Every family table declares `onDelete: 'cascade'` against `user` (`lib/auth-family-plugin.ts`) |
| Mic off by default and unreachable until consent | **TRUE** | `utils/micConsent.ts` + both gates, pinned by `micConsent.test.ts` |
| Consent can be withdrawn in one tap | **TRUE** | `PrivatlivPane` revokes with no dialog; the IA test forbids marking the row destructive |
| **"Der sendes ingen personoplysninger nogen steder" (guest)** | **WAS FALSE → fixed** | The app still fetches itself from Vercel and polls `/api/version` every 10 min. A server seeing an IP address is processing personal data. Now says no data *about the child* is sent, and admits the IP |
| **The list of what gets uploaded** | **WAS INCOMPLETE → fixed** | `services/authDiagnostics.ts` auto-uploads a report **with a screenshot** on a failed sign-in, with no user action. Disclosed nowhere. Now disclosed in both languages |
| **"spillene virker uden internet"** | **NOT TRUE YET** | Prebaked audio is fetched from `/sounds/tts/` and there is no service worker, so a cold launch offline fails. Becomes true when Phase B1 bundles the assets into the binary. **Cut the line if B1 slips** |
| **The voice** | **WAS UNDISCLOSED → fixed** | See §3 — Microsoft requires disclosing that it is synthetic, and the listing said "en rigtig dansk stemme" |

## 2. Against the rules, item by item

### GDPR Article 13 — the required contents of a privacy notice
Checked against the article text (https://gdpr-info.eu/art-13-gdpr/, read 2026-08-06).

| Item | Before | Now |
|---|---|---|
| 13(1)(a) controller identity + contact | present | present |
| 13(1)(b) DPO | n/a — no DPO required for this scale | — |
| **13(1)(c) purposes AND legal basis** | purposes only — **basis MISSING** | a "Retsgrundlag" section naming 6(1)(a), (b) and (f) per purpose |
| 13(1)(d) legitimate interests, if relied on | — | stated for error reports |
| 13(1)(e) recipients | present (four processors) | unchanged |
| **13(1)(f) third-country transfers** | **MISSING** | a "Behandling uden for EU" section naming SCCs and the EU-US Data Privacy Framework |
| 13(2)(a) retention | present | unchanged |
| **13(2)(b) rights: access, rectification, erasure, restriction, portability** | first three only | all five |
| 13(2)(c) right to withdraw consent | present | unchanged |
| 13(2)(d) right to complain | present (Datatilsynet) | unchanged |
| 13(2)(e) whether provision is required | implicit | explicit ("en konto er frivillig") |
| **13(2)(f) automated decision-making** | **MISSING** | "ingen automatiske afgørelser … ingen profilering" |

### Apple, App Review Guidelines (read 2026-08-06)

| Requirement | Status |
|---|---|
| 5.1.4(b) — a Kids Category app must include a privacy policy | met |
| 5.1.1(i) — policy linked in ASC **and** in-app, easily accessible | met: `/privatliv` is a public URL and a pane in "Til de voksne" |
| 5.1.1(i) — identify data collected, how, and all uses | met |
| 5.1.1(i) — **equal-protection confirmation** for every third party | met, and pinned by a test |
| 5.1.1(i) — retention/deletion and how to revoke consent | met |
| 5.1.2(i) — disclose sharing with third parties incl. third-party AI, and obtain explicit permission | met: the consent screen names Google before the mic can be switched on |
| 1.3 — no links out of a Kids app except behind the parental gate | met: the text renders in-app; the only outbound thing is an email address, behind the gate |

## 3. The Azure question — answered, and it produced a listing change

**The Azure licence blocker is substantially resolved, and it is better news than expected.**

Microsoft's **Code of Conduct for Microsoft AI Services** (v4.0, dated 2026-05-01, read 2026-08-06 at
`learn.microsoft.com/en-us/legal/cognitive-services/speech-service/tts-code-of-conduct`) is the
first-party legal document governing Azure Speech text to speech. Findings:

- **It contains no prohibition on shipping synthesized audio inside your own application.** Its
  voice-specific section applies only where an app offers "personalized or AI-generated voice features"
  to external users who submit voice-model training data — i.e. **custom voices**. Børnelæring uses
  Microsoft's own prebuilt voices (da-DK Christel, en-US Ava) and trains nothing, so that whole block
  does not apply.
- **It does impose a disclosure duty that the app was failing.** Responsible AI requirement 3, verbatim:
  > "Disclose when the output, decisions, or actions are generated by AI, **including the synthetic
  > nature of generated voices**, images, and/or videos, such that users are not likely to be deceived…"

  Nothing in the app or the listing said the voice was synthetic — and the description actively said the
  opposite: **"en rigtig dansk stemme"** ("a real Danish voice"). Fixed in three places: the policy
  (both languages), the app description (both languages) and the promotional text. "Rigtig" → "tydelig",
  and the speech bullet now says "syntetisk".
- Requirement 6 ("establish feedback channels that allow users to report abuse or issues") is met by the
  in-app problem report and `/support`.

**Residual UNKNOWN, and it is small:** the Code of Conduct sits *on top of* the Microsoft Product Terms,
and the Product Terms themselves were not read (microsoft.com/licensing/terms is a JS application). A
community Microsoft Q&A says caching generated audio "is generally considered acceptable as long as it's
within your app" and that you must not "redistribute or resell the audio outside your application" —
consistent with shipping it inside the binary, but that is a **search-snippet-level source, not
contractual language**. Treat as soft-confirmed.

## 4. Google STT data logging — resolved from first-party docs

Google's own documentation (`docs.cloud.google.com/speech-to-text/docs/data-logging`, read 2026-08-06):

> "**By default, Cloud Speech-to-Text does not log customer audio data or transcripts.**"
> "However, to help Cloud Speech-to-Text better suit your needs, you can **opt into** the *data logging*
> program."

So the policy's claim is the documented default, and enabling it is a deliberate opt-in tied to
discounted pricing. **What I could not do is read your project's setting** — there is no API for it and
the repo's own rules forbid probing your live services on a guess. If you never ticked that box, it is
off. One look in the Cloud console closes it for good.

## 5. What is still genuinely yours

1. **Confirm the Google data-logging box is unticked** (§4). One glance.
2. **Decide whether you are the controller and whether this is enough for you.** The document now
   describes the app accurately and contains every element Art. 13 lists — but "accurate and complete"
   is not the same as "legally sufficient for my situation", and I am not able to certify the second.
3. **EU DSA trader status** (PRD §3.7) — still a legal determination and still yours.
4. **Cut the "virker uden internet" line if Phase B1 slips** (§1).

## 6. Why you can trust the mechanical half tomorrow

Every claim in §1 and every Art. 13 item in §2 is pinned by a test in
`src/config/legalContent.test.ts` — 532 tests pass. The four that were wrong are pinned in the direction
that failed: the absolute guest claim is forbidden by name, the failed-sign-in upload must be disclosed
in both languages, the word "syntetisk"/"synthetic" must be present, and the transfer safeguard must be
named. An edit that quietly removes any of them turns the build red.
