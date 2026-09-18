# Usage statistics: what is legal, what others do, and what we could do

Research, 2026-09-18. Nothing here is implemented. The question that prompted it: *7 people installed the
app from the App Store in a week and we cannot tell whether a single one of them opened it twice.*

**Read §1 first.** Two constraints already decide most of this, and they are ours, not the regulator's.

---

## 1. The two constraints that decide it

### 1.1 We are in the Kids Category, and we already told Apple "no analytics"

`docs/app-store/listing.md` sets **Primary category: Education, Kids Category age band 6-8**. That pulls in
**Guideline 1.3**, whose text (fetched from `developer.apple.com/app-store/review/guidelines/`, 2026-09-18)
is:

> Kids Category apps may not send personally identifiable information or device information to third
> parties. Apps in the Kids Category should not include third-party analytics or third-party advertising.
> [...] In limited cases, third-party analytics may be permitted provided that the services do not collect
> or transmit the IDFA or any identifiable information about children (such as name, date of birth, email
> address), their location, or **their devices. This includes any device, network, or other information
> that could be used directly or combined with other information to identify users and their devices.**

Guideline 5.1.4(b) applies the same terms to any app "intended primarily for kids" even outside the
category. The bolded clause is the operative one: it is not a PII test, it is a **device-and-network
identifiability** test, and a stable per-install identifier fails it however well it is hashed.

Then there is what we have already said, in three places, one of them under our name to App Review:

| Where | The words | Enforced by |
|---|---|---|
| `docs/app-store/review-1.3-reply.md` (sent 2026-09-07) | "No analytics, measurement, attribution or crash-reporting SDK" | nothing — but it is a formal answer to a Guideline 1.3 questionnaire |
| App Store listing (`listing.md:138,182`) | "Ingen sporing og ingen analyseværktøjer" / "No tracking and no analytics" | store metadata |
| Privacy policy (`legalContent.ts:184,279`) | "Ingen analyseværktøjer og ingen tredjeparts-SDK til statistik" / "No analytics and no third-party statistics SDK" | `legalContent.test.ts:97` |

The test only asserts the policy *addresses* `reklame` / `sporing` / `analyse`, so it will not catch a
weakened promise — **the test is not the guardrail here, the sentence is.** Any change to what we measure
has to change that sentence, the listing, and (if a reviewer asks again) the 1.3 answer. That is the real
cost of this feature, and it is not a technical one.

### 1.2 The app is bundled, so there is no website to measure

`capacitor.config.ts` has **no `server.url`** — `dist/` ships inside the binary and runs at
`capacitor://localhost`. Nothing loads from `boernelaering.dk` at all. Consequences:

- **Every web-analytics product is the wrong shape.** Plausible, Matomo, Umami, Fathom, Simple Analytics,
  Pirsch and Vercel Web Analytics are all page-view collectors fed by a script on a served page. In the
  shell there are no page views, only an app that already has all its assets.
- The only thing that reaches us is an **explicit `fetch` we choose to write**. So whatever we do is a
  deliberate event call, not a pixel — which is legally *helpful* (§2.2) and practically more work.
- The PWA at `boernelaering.dk` is a different surface and *could* take a page-view script. It is also the
  surface almost nobody uses now that there is a native app.

---

## 2. The EU legal frame

### 2.1 Two laws stack, and people routinely forget the first

1. **ePrivacy Directive Art. 5(3)** (in DK: the cookie order, supervised by **Erhvervsstyrelsen**) governs
   *storing information on, or gaining access to information stored in, terminal equipment.* It applies
   whether or not the data is personal, and it applies to **native apps**, not just websites. Analytics is
   not "strictly necessary", so the exemption does not reach it.
2. **GDPR** (in DK: supervised by **Datatilsynet**) governs the processing of personal data that follows.

You can clear GDPR and still fail 5(3), which is how "but it's anonymous!" arguments die.

### 2.2 EDPB Guidelines 2/2023 closed the "cookieless" loophole

Adopted **16 October 2024**. Art. 5(3) is *not* limited to cookies — it also catches tracking pixels and
links, device fingerprinting, **IoT-style reporting, certain local processing where the result leaves the
device, and IP-based tracking.**

On IP specifically, the EDPB's position is: access to an IP triggers 5(3) where the information
**originates from the user's terminal equipment**, and because IPv4/IPv6 make that hard to establish,
entities should **assume 5(3) applies unless they can show the IP did not come from the terminal**.

But the guidelines also say plainly that 5(3) applying **does not automatically mean consent is needed** —
each case still has to be checked for an exemption.

**Where that leaves a first-party event we write ourselves:** if the app sends a fetch containing only
data we generated (a route name, an app version, a coarse timestamp), stores nothing on the device for it,
and never persists or derives from the IP, then nothing is *stored on* or *read from* the terminal. That is
the strongest position available and it is a defensible reading — but it is a reading, not a ruling. The
moment you add a persistent install id to make "returning users" work, you are squarely inside 5(3) and you
need consent.

### 2.3 Children make legitimate interest much harder

Art. 6(1)(f) ends "...**in particular where the data subject is a child**." Recital 38: children "merit
specific protection", especially for profiling and for services offered directly to them. The EDPB's
Guidelines 1/2024 on legitimate interest require a documented three-part test (real interest / strictly
necessary / not overridden), and ICO guidance is explicit that the balance tips harder against you with
children.

Practically: **legitimate interest for analytics on a 5-year-old is the weakest version of an already
contested argument.** It is what the industry uses anyway (§4). It is not what I would want to defend.

### 2.4 Recital 26 — the clean exit

GDPR does not apply to genuinely anonymous information, "including for statistical purposes". The bar is
high: *no one, including us,* may be able to re-identify. A daily count of "how many times was
`/alphabet/learn` opened" with no identifier of any kind clears it easily. "How many people came back the
next day" does not, because it needs something that persists.

**This is the real fork in the whole document**, and it is a product question, not a legal one:

| You want to know | Needs a persistent identifier? | Regime |
|---|---|---|
| Is anyone opening the app at all? Which games get used? Where do they quit? | **No** | Anonymous, outside GDPR, defensible outside 5(3) |
| How many distinct children? Do they come back? Retention, funnels, cohorts | **Yes** | Personal data, 5(3) applies, needs consent from a parent |

The first row answers the question that actually prompted this. The second is what analytics products are
built to sell you.

### 2.5 CNIL is the most useful regulator to read

France has done the most concrete work.

- **Audience-measurement consent exemption.** CNIL exempts analytics from consent if: purpose strictly
  limited to audience measurement **for the publisher alone**; **no cross-referencing, no transmission to
  third parties**; cookie life ≤ 13 months; data retained ≤ 25 months; anonymous aggregate output only; no
  profiling or ad targeting; events limited to page presence, feature use and performance; and an
  objection route in the privacy policy. CNIL published an updated set of criteria on **4 July 2025**.
  **Matomo is the one tool CNIL names in its own configuration guide** for this.
- **Recommendation on mobile applications** — published 24 September 2024, revised **27 March 2025**, with
  an **investigation campaign from spring 2025** that explicitly prioritises **apps targeting children**
  and apps using tracking SDKs, using traffic analysis to catch SDKs phoning home without a consent
  dialog.

CNIL is not our regulator, but its criteria are the best available checklist and no other DPA has
contradicted them.

### 2.6 Also in scope, briefly

- **DSA Art. 28(2)**: no advertising based on profiling to minors. We have no ads; noted for completeness.
- **Schrems II / Data Privacy Framework**: any US processor still needs the transfer analysis. Relevant
  because most of §4's tooling is American.

---

## 3. Denmark specifically

**The digital-consent age is 15, not 13.** Denmark originally set Art. 8 at 13, then **raised it to 15
effective 1 January 2024** (databeskyttelsesloven § 6(3), following the Justitsministeriet bill L 79a). A
lot of secondary material online still says 13 — including two of the sources this research turned up.
For a 5-8 audience it changes nothing operationally (every user is far below either number, so consent must
come from a parent), but get the number right if it ever goes in the policy.

**Two authorities, and they have publicly disagreed.** In October 2021 **Erhvervsstyrelsen announced it
would stop prioritising enforcement of the consent requirement for simple statistical cookies**, reasoning
that the pending ePrivacy Regulation was expected to exempt them. **Datatilsynet published a response
("Ingen tilsyn med statistikcookies?") pointing out that GDPR still applies and that it still supervises
the personal-data side.** So: the 5(3) enforcement risk in Denmark for plain statistics is low by
announced policy; the GDPR risk is untouched. Do not read the first as covering the second.

**Google Analytics is effectively out.** On **21 September 2022** Datatilsynet concluded that Google
Analytics **cannot lawfully be used without supplementary measures beyond what Google offers**, following
Austria, France and Italy. Transfer breaches sit in Datatilsynet's **highest fine band**. This reaches
**Firebase/GA4 for apps** too — same identifiers, same transfers.

**Children are a stated 2025 supervision priority for Datatilsynet**, alongside AI and the right to
erasure.

**The local benchmark is DR.** DR's Ramasjang apps (LEG, LÆR, KREA, Minisjang, Øen, Naturspillet) require
**a parent to log in with a DR login before the app can be used**, and **the statistics-cookie consent the
parent gave on that login carries into the app**, withdrawable from the profile page. DR's children's apps
ask for no name, age or contact details, and use no preference cookies.

That is the most directly comparable Danish model there is, and it is *parent-consented* statistics — not
consent-free ones. It is also a heavier gate than ours: DR makes the login mandatory, we deliberately do
not (`AuthGate` gates sync, not play).

---

## 4. What comparable kids' apps actually do

Two things are true at once: the published research says the category behaves badly, and the best-regarded
apps in it behave well.

### 4.1 The base rate is bad

- **"Not Seen, Not Heard in the Digital World"** (arXiv 2303.09008), 20,195 Google Play apps: **81.25% of
  Family apps use trackers**, which the Play Families policy does not permit. 4.47% request location.
  19.25% carry inconsistent age ratings across authorities.
- **Common Sense Media, State of Kids' Privacy**: ~2 in 3 products used by young people track across the
  internet for advertising; only **26%** met minimum safeguards for all users; roughly three-quarters
  monetise family data in some way.

### 4.2 Named examples, from their own policies

| App | Who they are | What they actually run |
|---|---|---|
| **Toca Boca** | Swedish (EU) | **Google Crashlytics + Firebase + BigQuery** for analytics, **AppsFlyer** for attribution (retained 3 months), **Datadog**, AWS. Legal basis stated as **legitimate interest** for analytics, contract for crash data. |
| **Lingokids** | Spanish (EU), **kidSAFE-certified** | Names no SDK, but lists the identifiers: **IP, App Instance ID** (i.e. Firebase), **Analytics ID**, Crash Reporting ID, Child Profile ID, Session Token — for "feature usage, session length, learning engagement". Basis: contract + legitimate interest. "COPPA-compliant configuration active for all child event streams." |
| **Duolingo ABC** | US | **"Third-party analytics are disabled."** No personal information collected from children; a parent's email only; child age kept anonymously for research, not tied to identity. |
| **Sago Mini / Toca Boca Jr Classics** | Canadian | No personal data collected in the Classics app; mic/camera in *First Words* processed **ephemerally and saved only locally**. |
| **DR Ramasjang** | Danish public service | Statistics **behind a mandatory parent login**, consent inherited from that login, withdrawable. |

**The pattern:** the commercial EU studios (Toca Boca, Lingokids) run Firebase on legitimate interest and
lean on kidSAFE/COPPA configuration; the ones that take the strictest line (Duolingo ABC, Sago Mini
Classics, DR) either disable third-party analytics for children entirely or put statistics behind an
explicit parental consent. **Note that Toca Boca's AppsFlyer integration is exactly what Guideline 1.3
forbids for a Kids Category app** — which is a good clue that those apps are rated 4+ *without* being in
the Kids Category. Being in the category is a materially stricter regime than being a kids' app.

### 4.3 What is popular in mobile generally

Firebase/Google Analytics is the default by a wide margin, then Amplitude and Mixpanel for product
analytics, and AppsFlyer / Adjust / Branch / Singular for attribution. All are US-owned; Adjust is
German-founded but now part of AppLovin (US). **None of them is appropriate here** — every one is built
around a persistent device or install identifier, which is the precise thing Guideline 1.3 prohibits
transmitting to a third party.

---

## 5. The tool landscape, EU first

### 5.1 EU-owned and EU-hosted

| Tool | Company | Hosting | Shape | Notes |
|---|---|---|---|---|
| **Plausible** | Estonia (Tallinn) | Hetzner, Falkenstein DE; Bunny (SI) for CDN | Web + **server-side Events API** | Stores 7 fields/event. Visitor id = `hash(daily_salt + domain + ip + user_agent)`; **salt deleted every 24h, IP and UA never stored**. No cookies. Open source (AGPL), self-hostable. The Events API is the only reason it is usable from a bundled app. |
| **Matomo** | **InnoCraft Ltd, New Zealand** | Matomo Cloud in Germany; or fully on-premise | Web + mobile SDKs | The only tool **CNIL names** in its consent-exemption configuration guide. NZ has an EU adequacy decision, so the ownership is not a transfer problem. Heaviest product here. |
| **TelemetryDeck** | Augsburg, **Germany** | Hetzner / AWS Frankfurt | **Purpose-built app analytics** | Double-salted hash: salted+hashed **on device**, salted+hashed again on their server. **The identifier is stable across sessions and platforms by design** — that is the feature. See §5.4. |
| **Simple Analytics** | Netherlands | EU | Web | Public dashboards. |
| **Pirsch** | Germany | Germany | Web, server-side option | ~$6/site/mo. |
| **Aptabase** | Open source | EU or US region, or **self-host** | **App analytics** (Swift, Kotlin, Flutter, RN, Tauri, Electron, Unity, JS) | States it collects "minimal usage data **without using unique identifiers**", session-based, no IDFA/GAID, no fingerprinting. Closest off-the-shelf fit to what a Kids Category app can defend — but verify the claim against the SDK source before trusting it. |
| **Umami** | Open source | self-host | Web | Runs on Postgres. Would sit on our existing Neon with no new processor. |

### 5.2 US-owned with EU regions

**PostHog** (EU Cloud in Frankfurt, IP anonymisation on by default in EU projects, self-hostable, open
source) and **Mixpanel/Amplitude** EU residency. All carry the same caveat: **an EU region fixes residency,
not jurisdiction** — US ownership means the CLOUD Act reaches the parent company. Self-hosting is the only
configuration where that stops mattering.

### 5.3 Vercel Web Analytics — tempting and wrong

Attractive because **Vercel is already a declared processor** in our policy, so it adds no new name to the
§3 list. But: it identifies end users by **"a hash created from the incoming request"** — i.e. derived from
IP and user-agent, which is device-and-network information transmitted to a third party — and Vercel states
data **including IP addresses may be transferred to the US** under SCCs/DPF. That is a Guideline 1.3
problem and a transfer problem. It also would not work from `capacitor://localhost`. **Rule it out.**

### 5.4 The trap in the privacy-first app SDKs

TelemetryDeck and Aptabase both market themselves as GDPR-exempt because the data is anonymised.
TelemetryDeck goes further and says it "is not subject to the GDPR" so no consent is needed.

Be careful with that claim in *our* context. TelemetryDeck's own docs describe an identifier that is
**deliberately stable for the same install and even across platforms**. Under GDPR that is textbook
**pseudonymisation, not anonymisation** — and under **Apple Guideline 1.3** it is "information that could
be used directly or combined with other information to identify users and their devices", sent to a third
party. A vendor's assessment of its own GDPR status is not a defence to an App Review question.

Aptabase's "no unique identifiers, sessions only" claim is the better one, and self-hosting it removes the
third party entirely — which is the configuration that makes the Apple question disappear.

---

## 6. Options for Børnelæring

Ordered by how much they cost us in promises.

### A. Do nothing in the app; use App Store Connect

Zero code, zero processors, zero policy change. Apple is the controller; we see aggregates.

**But it will not answer the question.** Two documented limits: App Analytics usage data comes only from
users who enabled **"Share With App Developers"** (reported typically **20-30%**), and Apple **suppresses
any row with fewer than five users or devices**. With 7 downloads that is ~2 opted-in users and a blank
dashboard. It becomes useful somewhere in the low hundreds of installs, not now.

Worth doing regardless, because it is free and already running. It is also the honest reason the current
answer is "we can't tell".

### B. First-party, anonymous, aggregate-only counters (recommended)

An `/api/usage` endpoint on our own Vercel function writing to our own Neon. Counts only: app opened,
route entered, maybe game completed. **No identifier of any kind, nothing stored on the device, IP never
persisted or derived from, coarse day-resolution timestamps.** Output is a count per day per route.

- **GDPR**: anonymous under Recital 26 → outside the regulation.
- **ePrivacy 5(3)**: nothing written to or read from the terminal; the defensible position of §2.2.
- **Apple 1.3**: no third party at all, so the clause has no subject.
- **New processors**: none — Vercel and Neon are already in the policy, already `fra1`/Frankfurt.
- **CNIL criteria**: meets all of them comfortably.

**What it costs:** the sentence. "Ingen analyseværktøjer" stops being literally true even though "ingen
tredjeparts-SDK til statistik" still is. The policy bullet, the listing bullet and (on any follow-up) the
1.3 answer all need rewording to something like *"no third-party analytics and no tracking; the app counts
anonymously how often each game is opened, with nothing that identifies a device or a child."* That is a
better sentence than the current one anyway — it is specific and it is checkable.

**What it will not tell you:** how many distinct children, or whether anyone came back. Accept that or go
to C.

### C. Consented, parent-gated statistics (the DR model)

A toggle in **Indstillinger** behind the existing parental gate, default **off**, that enables a persistent
install id and therefore returning-user and retention numbers.

Legally clean — explicit parental consent, withdrawable, exactly how DR does it. But: default-off means
most people never turn it on, so the numbers are a biased sample of parents who opt in; it adds a consent
record to maintain; and it needs a real Art. 13 disclosure. **Only worth it if retention is a question you
will actually act on.** Today it is not.

### D. Self-hosted Matomo / Umami / Aptabase on our own infra

Third-party *software*, no third-party *processor*. CNIL-blessed in Matomo's case. Gets you a real
dashboard for free rather than hand-rolling queries.

The cost is operational: another service to run, patch and back up, holding children's usage data, for an
app with 7 users. **B gives 90% of the answer for 5% of the work.** Revisit if the install base grows
enough that a dashboard beats a SQL query.

### E. Any hosted third-party analytics (Plausible Cloud, TelemetryDeck, PostHog EU, Firebase)

**Do not, while we are in the Kids Category.** Even the EU, cookieless, privacy-first ones transmit
something device-derived to a party that is not us, which is the thing 1.3 names — and it would directly
contradict a written answer we gave App Review eleven days ago. If we ever leave the Kids Category,
**Plausible's server-side Events API proxied through our own function** is the option to revisit, because
then Plausible sees our server's IP and never the child's.

---

## 7. What I would do

**A + B.** Turn on nothing new from Apple (it is already on), and build the anonymous first-party counter.
It answers "is anyone using this, and which games", adds no processor, needs no consent, and the only real
work is rewriting one honest sentence in three places.

Leave C in the drawer with a note: the day retention matters, the parental gate already exists to put it
behind.

---

## 8. Sources

Primary (fetched directly): [Apple App Review Guidelines
1.3/5.1.4](https://developer.apple.com/app-store/review/guidelines/) · [Plausible Data
Policy](https://plausible.io/data-policy) · [Toca Boca privacy policy](https://tocaboca.com/privacy) ·
[Lingokids privacy policy](https://lingokids.com/privacy-policy) · [arXiv
2303.09008](https://arxiv.org/abs/2303.09008) · [EDPB Guidelines 2/2023
(PDF)](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)
(title/version confirmed; body not machine-readable, so its content below is from secondary analysis)

Secondary (via search summaries — **verify before quoting in anything that ships**):
[Hunton on EDPB 2/2023](https://www.hunton.com/privacy-and-cybersecurity-law-blog/edpb-adopts-guidelines-on-scope-of-eprivacy-directive)
· [BCLP on EDPB 2/2023](https://www.bclplaw.com/en-US/events-insights-news/edpb-explains-eu-eprivacy-cookie-rules-apply-to-emerging-online-tracking-tools.html)
· [CNIL sheet 16: analytics](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications)
· [CNIL Matomo exemption configuration guide (PDF)](https://www.cnil.fr/sites/cnil/files/atoms/files/matomo_analytics_-_exemption_-_guide_de_configuration.pdf)
· [CNIL recommendation on mobile applications (PDF)](https://www.cnil.fr/sites/cnil/files/2025-05/recommendation-mobiles-app.pdf)
· [Datatilsynet: cookies og lignende teknologier](https://www.datatilsynet.dk/regler-og-vejledning/cookies-og-lignende-teknologier)
· [Datatilsynet: Ingen tilsyn med statistikcookies?](https://www.datatilsynet.dk/presse-og-nyheder/nyhedsarkiv/2021/okt/ingen-tilsyn-med-statistikcookies)
· [Dansk Erhverv on the 2022 Google Analytics decision](https://www.danskerhverv.dk/presse-og-nyheder/nyheder/2022/september/afgorelse-fra-datatilsynet-vakker-opsigt-google-analytics-kan-som-udgangspunkt-ikke-benyttes-lovligt2/)
· [Folketinget L 79a — consent age 13→15](https://www.ft.dk/samling/20231/lovforslag/l79a/index.htm)
· [DR: Børn og deres data](https://www.dr.dk/om-dr/dr-og-dine-data/boern-og-deres-data)
· [Duolingo ABC privacy](https://www.duolingo.com/abc-privacy)
· [Sago Mini privacy](https://sagomini.com/privacy-policy/)
· [Common Sense: State of Kids' Privacy](https://www.commonsensemedia.org/research/the-state-of-kids-privacy-evaluating-the-safety-and-security-of-kids-tech)
· [Apple: App Store opt-in](https://developer.apple.com/documentation/analytics-reports/app-store-opt-in)
· [Apple: app usage metrics](https://developer.apple.com/help/app-store-connect-analytics/engagement/app-usage)
· [Vercel Web Analytics privacy](https://vercel.com/docs/analytics/privacy-policy)
· [TelemetryDeck anonymisation](https://telemetrydeck.com/docs/articles/anonymization-how-it-works/)
· [Aptabase](https://github.com/aptabase/aptabase)
· [PostHog GDPR docs](https://posthog.com/docs/privacy/gdpr-compliance)
· [Matomo: who is InnoCraft](https://matomo.org/faq/new-to-piwik/who-is-innocraft/)
· [EDPB Guidelines 1/2024 on legitimate interest (PDF)](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf)
· [ICO: lawful basis for children's data](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr-old/what-do-we-need-to-consider-when-choosing-a-basis-for-processing-children-s-personal-data/)
· [FTC COPPA 2025 amendments](https://www.lw.com/en/insights/ftc-publishes-updates-to-coppa-rule)

**Not legal advice.** The §2.2 and §6B reading — that a first-party anonymous counter sits outside both
GDPR and Art. 5(3) — is well supported but is an interpretation. If we ever want certainty rather than a
good argument, that is the question to put to a Danish data-protection lawyer, and it is a cheap one to ask.

### Footnote: COPPA, if the app is downloadable in the US

The **2025 COPPA amendments took effect 23 June 2025, full compliance by 22 April 2026.** The **"support
for internal operations" exception survives**: collecting a persistent identifier *and nothing else*, solely
to support internal operations (which includes analysing how the service functions), does **not** require
verifiable parental consent. The amendments add a **notice duty** — the privacy policy must state the
specific internal operations the identifier is collected for, and how it is kept from being used to contact
or profile the child. Option B collects no identifier at all, so this is moot for it; it is the escape hatch
if we ever go to C.
