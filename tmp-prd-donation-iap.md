# PRD — "Støt appen": a voluntary donation, shipped as 1.1

Authored 2026-08-07. **NOT implemented.** Self-contained: a fresh session should be able to build this
without re-reading the App Store PRD, and without re-researching Apple's rules — every rule below is
quoted with its source and read date.

Companion to `tmp-prd-app-store-ios.md` (the route to the store) and `docs/app-store/listing.md` (the
copy). **This PRD may not be implemented until v1.0 is approved and live.** §7 explains why that is a
hard ordering and not a preference.

---

## 1. What this is, and what it deliberately is not

The owner wants a way to **cover running costs**. Not income. Decisions taken 2026-08-07, all his:

| Decision | Value |
|---|---|
| Goal | Cover running costs. Break-even is success |
| Paywall | **None, ever.** Every game stays free for everyone |
| Route | **In-app purchase tip jar**, inside "Til de voksne" |
| Timing | **After v1.0 is approved** — this is 1.1 |
| Give-back | **Nothing at all.** A donation buys nothing, unlocks nothing |
| Entity | Private individual, no CVR |

**The target number, so nobody plans against a fantasy.** The only recurring cost this app has is the
**Apple Developer Program, 99 USD/yr (~700 kr)**. Vercel Hobby, Neon and Codemagic are free tiers; the
Azure prebake is a one-off with a near-zero steady state (App Store PRD §1213); the one per-use cost is
Google STT for Sig et Ord, and that is already gated behind an account. So the goal is **~700–800
kr/yr**, which a handful of donations covers. A free Danish-only app, available in Denmark only, for a
cohort of ~60k children, will not do materially better than that — and it does not need to.

**Not doing, and each for a reason that is not taste:**

- **No paid tier, no subscription, no cosmetic extras, no sticker chapters for money.** The reward
  system is *"one track, one reward slot"* and XP is never difficulty-dependent (`CLAUDE.md`). Money
  inside that loop would put a "buy me" in front of a five-year-old. The owner ruled it out.
- **No web donation page, no MobilePay, no Stripe.** See §2.2 — the iOS app may not link to it, so it
  would be undiscoverable, and MobilePay Erhverv needs a CVR the owner does not want.
- **No RevenueCat or any purchase SDK with a backend.** See §3.1 — it is a Kids Category violation.

## 2. The rules that decide the shape

### 2.1 A donation must be an in-app purchase

Apple's Guideline **3.1.1**, verbatim (https://developer.apple.com/app-store/review/guidelines/, read
2026-08-07):

> Apps may use in-app purchase currencies to enable customers to "tip" the developer or digital content
> providers in the app.

The donation-specific exemption, **3.2.1(vi)**, is scoped to *"Approved nonprofits"* who *"may fundraise
directly within their own apps … provided those fundraising campaigns … offer Apple Pay support"*. The
owner is a private individual, not an approved nonprofit, so it does not apply. **3.2.1(vii)** covers
person-to-person gifts *"provided that … 100% of the funds go to the receiver of the gift"* — that is
user-to-user gifting, not user-to-developer.

**The external-link escape does not reach Denmark.** Apple's May 2025 guideline change, which permits
buttons and links to outside payment without the StoreKit External Purchase Link Entitlement, is
**United States storefront only**; every other storefront still requires the entitlement where Apple
offers it. Denmark would need the EU DMA entitlement — notarisation, a separate agreement, and the
alternative fee terms. Disproportionate for 700 kr/yr. **Ruled out, do not revisit without a reason.**

→ **Therefore: a consumable IAP.**

### 2.2 …and it may not be steered anywhere else

Guideline **1.3** forbids *"links out of the app … unless reserved for a designated area behind a
parental gate."* Even placed behind the gate, pointing a Danish user at an external payment page is the
anti-steering case that §2.1 just ruled out. So the web version gets nothing (§3.3), and the app never
mentions any other way to give.

### 2.3 Kids Category is not an obstacle — the gate already exists

Guideline **1.3**, verbatim:

> These apps must not include links out of the app, purchasing opportunities, or other distractions to
> kids unless reserved for a designated area behind a parental gate.

"Designated area behind a parental gate" **is a description of "Til de voksne"**. The gate is already
built and already Apple-shaped: `src/config/guestAdultGate.ts` is a two-digit multiplication challenge
for guests, calibrated against a real five-year-old who cannot multiply; account holders get the PIN,
which is stronger. Apple's own parental-gate page
(https://developer.apple.com/app-store/kids-apps/, read 2026-08-07) defines a gate as *"adult-level
tasks that must be completed in order to continue"* and illustrates it with **a maths task**.

Nothing new needs building for compliance. The purchase simply has to live inside that area.

### 2.4 The half of IAP that disappears

**Because the donation grants nothing, there is no entitlement.** No receipt validation (nothing to
defend), no server involvement, no restore-purchases flow (a consumable is not restorable, and Apple's
kids guidance only requires a gate before a restore *if there is one*). The whole feature is
`Product.products(for:)` → `product.purchase()` → `transaction.finish()` → a thank-you line.

If a future session finds itself writing entitlement storage or a validation endpoint, it has
misunderstood this PRD.

---

## 3. What gets built

### 3.1 W1 — A native purchase bridge with no third party in it

Guideline **1.3**, verbatim, and this is the sentence that decides the dependency:

> Kids Category apps may not send personally identifiable information or device information to third
> parties.

**This rules out RevenueCat**, Adapty, Superwall and every other purchase SDK with a backend: they
receive device identifiers by design, which is the thing the sentence forbids. Reaching for one is the
default instinct and it is wrong here.

Write a **first-party Capacitor plugin** in `ios/App/App/`, Swift, **StoreKit 2**. The deployment
target is already `IPHONEOS_DEPLOYMENT_TARGET = 17.0` (`ios/App/App.xcodeproj/project.pbxproj`), well
above StoreKit 2's iOS 15 floor. Three calls, nothing more:

| Call | Returns |
|---|---|
| `isAvailable()` | `{ available: boolean }` — false on web and if StoreKit is unreachable |
| `getProducts()` | `{ products: { id, displayName, displayPrice }[] }` — **`displayPrice` comes from StoreKit, never from us.** Apple formats the currency; hardcoding "25 kr" would be wrong in every other storefront and wrong after any price change |
| `purchase(id)` | `{ outcome: 'success' \| 'cancelled' \| 'pending' \| 'failed' }` |

~100 lines, no npm dependency, and nothing leaves the device except to Apple. Acceptable fallback if a
session would rather not maintain Swift: **`Cap-go/capacitor-native-purchases`** (MIT, StoreKit 2, no
backend of its own). Still no third-party server, so still compliant.

**This is the app's first use of a Capacitor JS API** — `grep` finds no `Capacitor.isNativePlatform()`
anywhere in `src/` today (checked 2026-08-07). Add one `src/services/platform.ts` helper rather than
scattering the check; W3 needs it too, and a second call site is how these things sprawl.

### 3.2 W2 — Three consumable products

Danish display names. Prices chosen from ASC's DKK price points nearest **~25 kr / ~75 kr / ~150 kr** —
pick the real tiers in App Store Connect, do not invent them here.

| Product ID | Rough price | Danish name |
|---|---|---|
| `com.vraa.earlylearning.stoette.lille` | ~25 kr | `En lille tak` |
| `com.vraa.earlylearning.stoette.mellem` | ~75 kr | `En stor tak` |
| `com.vraa.earlylearning.stoette.stor` | ~150 kr | `En meget stor tak` |

All three are **Consumable**, and buying the same one twice must work. The IDs belong in a pure,
Node-importable `src/config/donation.ts` so a test can read them (§3.6) — the same shape as
`adultSettingsIa.ts`: declaration as data, implementation elsewhere.

### 3.3 W3 — A seventh group in "Til de voksne"

The adult IA is **data and is guarded**: `src/config/adultSettingsIa.ts`, with
`adultSettingsIa.test.ts` pinning *"the surface has exactly the six groups, in rail order"*. Adding a
group means editing the test **deliberately** — exactly the move the App Store PRD made when it added
`privatliv` as the sixth. The comment block above that group is the template for how to explain a new
one; write a comparable one, because the next session will ask why the count changed again.

- New group `stoette`, label **`Støtte`**, **last in the rail**. A single-word Danish noun, so it
  passes the `AMBIGUOUS_LABELS` guard.
- Items: `stoette.why` (read-only — what the money pays for, in two plain sentences) and
  `stoette.give` (the three amounts).
- **Not `destructive`, no `verify`, no `typeToConfirm`.** A donation destroys nothing, and the gate has
  already proved the adult. A second gate here would be the mirror of the mistake the neighbouring
  `privatliv` group documents — friction pointed at the safe direction.
- New `src/components/adult/panes/StoettePane.tsx`, built from `paneParts.tsx` like its six siblings.
  `lucide-react` icons only; `noEmoji.test.ts` has an empty allowlist and covers it.

**The group must not render on web.** Gate it on `isNativePlatform()`. The Vercel build has no
StoreKit, so every button would be dead — and hiding it keeps the web app honestly purchase-free.

### 3.4 W4 — Degrade quietly, because the app is offline by design

Everything ships inside the binary and there is no `server.url` (`capacitor.config.ts`), so the games
work with no network at all. **StoreKit does not.** If `getProducts()` throws or returns empty, the
pane shows one calm Danish line — **"Kræver internet"** — and no buttons.

Never an error dialog, never a retry loop, and never anything that suggests the app is broken. A
`cancelled` outcome shows nothing at all; the adult changed their mind, which is not an event.

### 3.5 W5 — The copy that becomes false the moment this ships

Four places claim there are no purchases. Once an IAP exists, the App Store product page carries a
**"Køb i appen"** badge automatically, and a description that contradicts it is the easiest Guideline
**2.3.1** rejection there is.

| File | Line (2026-08-07) | Change |
|---|---|---|
| `docs/app-store/listing.md` | 90 | `• Ingen køb inde i appen` → `• Intet skal købes — alle spil er gratis` |
| `docs/app-store/listing.md` | 130 | `• No in-app purchases` → the English equivalent (review notes only; there is no en-US locale) |
| `docs/app-store/listing.md` | 161 | promotional text: drop `ingen køb inde i appen`, keep `ingen reklamer` and `ingen sporing` |
| `src/config/legalContent.ts` | 333 | in-app FAQ: `uden køb inde i appen` → `alt indhold er gratis; man kan frivilligt donere` |

**All four change in the same commit as W1–W3. Not before** — the v1.0 listing is true today and must
stay true until the build with the IAP is the live one. **Not after** — a live app whose description
denies its own purchases is the rejection above.

Also add to the privacy policy in `legalContent.ts`: **donations are handled by Apple; the app never
learns who donated and receives no payment data.** That is true (nothing in this feature touches our
own API surface at all) and it is precisely the class of claim `legalContent.test.ts` exists to pin.

### 3.6 W6 — Tests, then prove they bite

- `adultSettingsIa.test.ts` — seven groups, `stoette` last, its items non-destructive.
- New `src/config/donation.test.ts` — the three product IDs are unique, all prefixed with the bundle ID
  `com.vraa.earlylearning`, all declared consumable.
- `legalContent.test.ts` — **the FAQ may not claim the app has no purchases** (assert the phrase is
  absent, so a revert turns the build red), and the Apple-donation line is present.
- `contextBudget.test.ts` is unaffected: this PRD is not a loaded guardrail.

Then run **`/re-break`**. The repo rule: *"After fixing a bug, re-break the code to prove the new test
actually fails"* — and a guard that greps source must strip comments first, or a mention in a comment
keeps it green while the shipped string is wrong.

---

## 4. What only the owner can do

W1–W6 are inert without all six of these. None is code.

1. **Accept the Paid Applications Agreement (Schedule 2)** in App Store Connect — required even for a
   free app that offers IAP.
2. **Bank details and tax forms** — a Danish bank account plus the US tax form (**W-8BEN**, individual).
   Personal legal name, consistent with the individual enrolment already made.
3. **Enrol in the App Store Small Business Program** — **15%** instead of 30%; eligibility is under
   **$1M USD proceeds** in the prior calendar year and *"developers new to the App Store also qualify"*
   (https://developer.apple.com/app-store/small-business-program/, read 2026-08-07). It takes effect
   **15 days after the end of the fiscal month in which enrolment is approved**, so do it early or the
   first donations pay 30%.
4. **Create the three IAP products in ASC** and submit them for review **with the build**. Each needs a
   screenshot and review notes.
5. **Update the App Review notes** (they already exist per `docs/app-store/listing.md` §3.3): state that
   the donation is optional, buys nothing, unlocks nothing, and sits behind the parental gate — and
   tell the reviewer the gate is a two-digit multiplication task. A Kids app with an IAP gets its gate
   checked; make it findable.
6. **Declare in-app purchases** in the ASC app record.

**The money, concretely.** Apple is merchant of record and remits Danish VAT (25%), then takes 15%
under the Small Business Program. **A 25 kr donation nets roughly 17 kr.** Income is personal; how it
is declared to SKAT is the owner's call and is not a determination this document can make.

**One flag, not a blocker.** Vercel's Hobby plan is for non-commercial use. The donation flows through
Apple and never touches Vercel, and the app itself stays free — but whether accepting donations makes
the deployment "commercial" is a reading of Vercel's terms, **UNKNOWN**, and worth one look before the
money starts. Vercel Pro at $20/mo would cost more than the donations bring in, which would invert the
entire point of this PRD.

---

## 5. Verification

Rungs per `CLAUDE.md` — **a claim must name the rung it came from.**

1. **Rung 1.** `npm test` and `npm run lint` green, including the new guards, and `/re-break` shows each
   new assertion going red for the right reason.
2. **Rung 1.** `npm run dev` → "Til de voksne" → solve the gate → **no Støtte group appears**. That is
   W3's platform gate working, and it is the only part of this feature observable without a device.
3. **Rung 3 — needs the iPad.** Codemagic build → TestFlight → a **StoreKit sandbox account**: the
   three amounts render with real DKK prices from StoreKit, a purchase completes, the thank-you shows,
   and buying the same product a second time works. Sandbox purchases cost nothing.
4. **Rung 3.** Airplane mode → the pane says "Kræver internet" with no buttons, and every game still
   works fully offline. That last part is a v1.0 promise and this feature must not dent it.

Steps 3 and 4 cannot be faked by the harness — the WebKit driver has no StoreKit. Say UNKNOWN until the
owner has run them.

---

## 6. Open questions

1. **Exact DKK price points** — only visible in ASC. §3.2's numbers are targets, not tiers.
2. **Whether the App Privacy questionnaire needs a "Purchases" data type.** Apple collects it; we
   receive nothing. Likely "not collected" *by us*, but read the ASC wording at submission time rather
   than guessing — the same discipline §3.3 of `listing.md` applies to export compliance.
3. **Vercel Hobby commercial-use reading** (§4).

## 7. Why this cannot go into v1.0

Not a preference — three concrete reasons:

- The v1.0 listing copy is **already written and already true** (`docs/app-store/listing.md`). Changing
  it now means changing the description, the promotional text, the ASC purchase declarations and the
  review notes for a feature that does not exist yet.
- **A Kids Category app with an in-app purchase gets a harder first review.** The gate is checked, the
  products are reviewed alongside the binary, and every extra surface is another rejection to argue.
  Clear review once on the simplest possible app.
- **The Paid Applications Agreement, the bank details and the tax forms have their own latency**, and
  the Small Business Program only takes effect 15 days after the fiscal month of approval (§4.3). Those
  can all be done by the owner *while v1.0 is in review*, which is free parallelism.

## 8. Sources

[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (1.3, 3.1.1,
3.2.1(vi)/(vii), 5.1.4 — read 2026-08-07) ·
[Parental gates](https://developer.apple.com/app-store/kids-apps/) (read 2026-08-07) ·
[Small Business Program](https://developer.apple.com/app-store/small-business-program/) (read
2026-08-07) · [Cap-go/capacitor-native-purchases](https://github.com/Cap-go/capacitor-native-purchases)
(fallback plugin) · in-repo: `tmp-prd-app-store-ios.md`, `docs/app-store/listing.md`,
`docs/app-store/policy-verification.md`, `src/config/adultSettingsIa.ts`, `src/config/guestAdultGate.ts`
