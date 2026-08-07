# App Store listing — copy, assets and the submission checklist

Companion to `tmp-prd-app-store-ios.md` (the route and the blockers). This file is the **paste-ready
store listing**: every text field, the icon, the screenshot plan, and the App Store Connect questions
nobody warns a first-time submitter about.

Character counts below were measured, not estimated. App Store Connect counts **characters, not bytes**,
so `æøå` cost one each. Field limits confirmed for **Name (30)** and **Subtitle (30)** at
https://developer.apple.com/help/app-store-connect/reference/app-information/ (read 2026-08-06). The
limits for Description (4000), Keywords (100), Promotional Text (170) and What's New (4000) are
**UNKNOWN from a first-party read** — the ASC reference page for localizable properties 404'd. Every
draft below is comfortably inside those numbers, so the risk is nil either way, but re-check in ASC,
which shows a live counter.

---

## 1. Text fields

### 1.1 App name — 30 char limit

**SETTLED. Paste these two exactly:**

| Field | Value | Chars |
|---|---|---|
| **Name** | **`Børnelæring: ABC, tal, engelsk`** | 30 / 30 |
| **Subtitle** | **`Førskole, 0. og 1. klasse`** | 25 / 30 |

**Why this split.** Apple indexes name + subtitle + keywords as a single pool, so the two fields are one
budget and neither has room for both ideas. The name therefore carries the **subjects** — including Engelsk,
which the first draft left out of the indexed pool entirely — and the subtitle carries the **school stage**,
førskole through 1. klasse, which is the actual audience. Together they cover brand, all three subjects and
the full age span, which no single 30-character field can.

The name sits **exactly at 30**, so treat it as frozen: any later tweak breaks it and needs a re-count.

Superseded, for the record: `Børnelæring: Alfabetet og Tal` / `Lær bogstaver, tal og farver` — named no
school stage and omitted Engelsk.

Danish terminology, since it decides the search terms: **børnehaveklasse** is grade 0 (age ~6) and is what
parents type; **0. klasse** is the same thing written numerically; **indskoling** is the official term for
the 0.–3. klasse span; **førskole** covers everything before that. Option A's subtitle spells out `0. og
1. klasse` because that is what a parent scanning a store page recognises, and `børnehaveklasse` and
`indskoling` are picked up by the keywords instead.

**Do not claim curriculum alignment.** "Følger Fælles Mål" or similar is a factual claim about the Danish
national curriculum that this app has never been mapped against, and metadata claims are a Guideline 2.3.1
problem. Describing the age and stage it *suits* is fine; asserting it implements the curriculum is not.

**Name availability can force a change and is only settleable in App Store Connect** — the name is reserved
when the app record is created, and "Børnelæring" is an ordinary Danish compound noun, so a collision is
plausible. **UNKNOWN until you try it.** If `Børnelæring` itself is taken, the fallbacks in order are
`Børnelæring ABC: 0.-1. klasse` (29), `Min Børnelæring: ABC og tal` (27), then bare `Børnelæring ABC` (15).
Counts verified. Keep the subtitle unchanged — a collision is on the name only.

### 1.3 Keywords — 100 char limit, comma-separated

Matched to the settled name and subtitle, so nothing here repeats `børnelæring`, `abc`, `tal`, `engelsk`,
`førskole` or `klasse`:

```
stavning,regning,matematik,dansk,børnehaveklasse,indskoling,læsning,bogstaver,farver,plus,minus
```

**95 characters, 5 spare.** `børnehaveklasse` and `indskoling` are the two that carry the school-stage
intent that would not fit in the subtitle. Rules applied: no space after commas (a space is a wasted
character), no word already in the name or subtitle, no competitor names, no `app`/`spil`/`gratis` (Apple
ignores or penalises these). If you pick option **B** instead, swap `dansk` and `matematik` out — they move
into the subtitle — and spend the freed room on `engelsk`, `førskole` and `memory`.

### 1.4 Description — Danish (primary), 1257 characters

Paste as-is. The bullet character is `•` (U+2022), not an emoji, so it is consistent with the app's
no-emoji rule.

```
Børnelæring er en rolig, dansk læringsapp til børn i førskolealderen og i 0. og 1. klasse. Fem verdener, 24 spil og en tydelig dansk stemme, der læser alt højt — så barnet kan spille selv, også før det kan læse.

FEM OMRÅDER
• Alfabetet — find bogstaver, hør deres lyd og stav korte ord
• Tal og regning — tæl, sammenlign, plus og minus med ting, man kan tælle
• Farver — kend farverne, bland dem og find dem ude i verden
• Engelsk — de første engelske ord, læst op af en engelsk stemme
• Ordleg — stav, læs og sig ord højt

EN BOG FULD AF BELØNNINGER
Barnet samler klistermærker i sin egen bog. Der er én vej og én belønning ad gangen, så det er let at se, hvad der kommer næst. Ingen point, der forsvinder, og ingen konkurrence mod andre.

LAVET TIL BØRN
• Ingen reklamer
• Ingen køb inde i appen
• Ingen sporing og ingen analyseværktøjer
• Ingen konto nødvendig for at spille
• Al tale er dansk, syntetisk og lavet på forhånd, så spillene virker uden internet

FOR DE VOKSNE
I de voksnes område kan du vælge sværhedsgrad, oprette flere børneprofiler, læse hvad appen sender hvorhen, og slå mikrofonspillet til eller fra. Området er beskyttet af en opgave, et barn ikke kan løse. Mikrofonen er slået fra som standard, og mikrofonspillet kræver både en konto og internet. Synkronisering mellem enheder kræver også en konto.

Appen er skrevet til en 5-årig dreng af hans far. Den passer til børn fra omkring 5 år, gennem børnehaveklassen og ind i 1. klasse.
```

**Two lines were promises the app could not keep.** Status as of 2026-08-06:

- **"Ingen konto nødvendig for at spille" is now TRUE** — the guest path shipped in Phase A1.
- **"Al tale … så spillene virker uden internet" is still NOT true** and depends on Phase B1 bundling the
  assets into the binary. **If B1 slips, delete that line before submitting** — a description that
  overstates the app is a Guideline 2.3.1 rejection, and the easiest possible one to avoid. The same
  sentence appears in the English copy in §1.5 — delete it in both places or neither.

The last line is deliberate. "Skrevet til en 5-årig dreng af hans far" is true, it explains the absence of
monetisation better than any feature bullet, and reviewers read descriptions.

### 1.5 Description — English (en-US locale, and useful context for the reviewer)

```
Børnelæring is a calm Danish learning app for children in preschool and the first two years of Danish primary school (børnehaveklasse and 1. klasse). Five worlds, 24 games, and a clear Danish voice that reads everything aloud — so a child can play alone, even before learning to read.

FIVE AREAS
• The alphabet — find letters, hear their sounds, spell short words
• Numbers and arithmetic — count, compare, add and subtract with countable things
• Colours — learn them, mix them, find them in the world
• English — first English words, read by an English voice
• Word play — spell, read, and say words out loud

A BOOK FULL OF REWARDS
Children collect stickers in their own book. One path, one reward at a time, so it is always clear what
comes next. Nothing expires, and there is no competition.

MADE FOR CHILDREN
• No ads
• No in-app purchases
• No tracking and no analytics
• No account needed to play
• All speech is Danish, synthetic and generated in advance, so the games work without internet

FOR GROWN-UPS
In the grown-ups' area you can set the difficulty, add child profiles, read what the app sends where, and
turn the microphone game on or off. The area is protected by a task a child cannot solve. The microphone is
off by default, and the microphone game needs both an account and internet. Cross-device sync also needs an
account.

Written for a five-year-old boy by his father. Suited to children from around five, through the Danish børnehaveklasse and into 1. klasse.
```

**If you do ship an en-US locale**, it gets its own name and subtitle. Keep the Danish brand name — the app
is Danish and renaming it in English would misrepresent it.

**SETTLED 2026-08-06: the listing ships DANISH ONLY, availability Denmark only** (owner's decision). No
en-US locale, so there is no English name, subtitle or promotional text to write. An English listing would
invite English speakers to download a Danish-only app, which earns one-star reviews.

**The English copy above therefore exists for one purpose: App Review.** Apple's reviewers work in English,
and a Danish-only product page tells them nothing about what they are looking at. Paste it into the App
Review notes field (§3.3), not into a store locale. Do not add an en-US locale later without re-reading
this paragraph.

### 1.6 Promotional text — 170 char limit, editable without a new build

**SETTLED. Paste this exactly:**

```
Fra førskole til 1. klasse: bogstaver, tal, farver og engelsk, læst højt af en tydelig dansk stemme. Ingen reklamer, ingen køb inde i appen og ingen sporing.
```

**157 characters, 13 spare.** Rewritten alongside the name and subtitle: it now names the school stage and
includes Engelsk, neither of which the first draft did ("bare bogstaver, tal og farver" actively understated
the app).

**This field's job is different from the name and subtitle.** Those three fields — name, subtitle, keywords —
are the indexed pool and are chosen for search. Promotional text appears above the description and is pure
persuasion, so "Fra førskole til 1. klasse" is here to let a parent decide in one second whether this is for
their child, not to win a keyword. `børnehaveklasse` is deliberately *not* spent here; the keywords already
carry it.

It is also the **only** listing copy you can change without submitting a build, so once launched, reuse it
for news — "Nu med engelsk", "Nye klistermærker" — rather than leaving permanent description material in it.

### 1.7 What's New

Not needed for v1 — the field only appears for updates.

---

## 2. Assets

### 2.1 App icon — DONE

**`art-src/logo/app-store-icon-1024.png`** — generated 2026-08-06 from the existing master
`art-src/logo/logo.png` by stripping the alpha channel. Verified: **1024×1024, PNG, 3 channels, no alpha,
fully opaque, no baked rounded corners.** Nothing else was changed; it is the app's own logo.

Requirements applied: 1024×1024 PNG, fully opaque with no alpha channel, and **no rounded corners** (iOS
applies its own mask). **Source is third-party, not first-party** — Apple's HIG app-icons page returned a
JS shell on 2026-08-06, so this spec is **UNKNOWN from a first-party read** although it is long-standing
and universally reported. ASC rejects a non-conforming icon at upload, which is a cheap way to find out.

Regenerate with:

```bash
node -e "require('sharp')('art-src/logo/logo.png').removeAlpha().png({compressionLevel:9}).toFile('art-src/logo/app-store-icon-1024.png')"
```

Optional improvement, not a blocker: the subject sits with generous margins, so at a home-screen size the
book is smaller than it could be. A tighter crop would read better on device. That is an art decision, and
the current icon is perfectly acceptable.

### 2.2 Screenshots — CAPTURED 2026-08-06, shot 6 RE-CAPTURED 2026-08-07, in `docs/app-store/shots/`

Twelve files, `<slot>-<n>-<name>.png`. **Verified programmatically before upload: exact pixel size, PNG,
3 channels, no alpha** — `ipad-*` are 2732×2048 and `iphone-*` are 2868×1320, all landscape.

**Shot 6 was re-taken on 2026-08-07** for the adult-login-visibility work, which added a guest-only
"Log ind" row above the rail list and `Ikke logget ind` under Konto. Only `ipad-6` changes visibly —
the iPhone slot is compact, so the pushed Læring pane covers the rail entirely — but both were re-shot
so the pair stays one capture session. Two traps that cost a run each:

- **`.click()` on the ⚙️ corner does nothing in WebKit.** Open it with `webkit.mjs --click` (real
  trusted input), then drive the arithmetic gate from `--eval`; the gate reads its own prompt, so the
  answer is computed, not hard-coded.
- **Playwright writes RGBA.** Both new files came out colour-type 6 and had to be run through
  `ffmpeg -pix_fmt rgb24`. Re-check byte 25 of the PNG header (2 = RGB) after any re-capture.

Taken after Phase A, as this section required: guest mode means shot 1 is the section menu rather than a
sign-in screen, and shot 6 is captured in **real guest mode through the arithmetic parental gate** (not
`?nogate=1`), so the adult surface shows what a reviewer actually gets — including "Barn / Gæst".

**Three deviations from the plan below, each deliberate:**

1. **Shot 3 is Plus Opgaver, not a ten-frame or counting objects.** The ten-frame was deleted on
   2026-08-02 (owner: no countable stand-ins on math boards), and `/math/counting` is Tal Quiz, which is
   deliberately listen-only — it photographs as a speaker icon and four numbers, which shows a browsing
   parent nothing.
2. **Shot 4 is Farvejagt, not the colour quiz.** This section asks for "the most visual appeal of any
   screen"; Hvilken Farve is a deliberately GREYED object beside four flat swatches (the no-giveaway
   rule), while Farvejagt is a dozen pieces of full-colour baked art.
3. **Shot 6 is the Læring pane** (difficulty), with the six-group rail visible so Privatliv — where the
   microphone switch lives — reads as a destination. The switch itself only renders for a signed-in
   account: in guest mode `/api/stt` is unreachable, so that pane honestly says the mic game needs one.
   A screenshot of a control a reviewer cannot reach would be the wrong kind of accurate.

**Both sets are the harness, not a device.** The iPad shots are real WebKit at iPad geometry, *not* the
son's iPad — capture from the device itself if you want rung 3. The iPhone shots are rung 2 permanently
(§4.2 of the PRD). And this driver cannot play audio, so ignore any audio state in a frame.

Regenerate with the scripts recorded in `docs/app-store/phase-a.md`; the presets `iphone-69` and
`iphone-69-landscape` are now permanent in `.claude/skills/ui-screenshot/webkit.mjs`.

### 2.2b The original plan (kept for the reasoning)

**Required slots** (from https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/,
read 2026-08-06 — 1 to 10 per slot, `.png`/`.jpg`, **no alpha or transparency**):

| Slot | Requirement | Landscape pixels | Source |
|---|---|---|---|
| **iPad 13"** | "Required if app runs on iPad" | **2732×2048** | The son's 12.9" iPad Pro, captured directly |
| **iPhone 6.9"** | "Required if app runs on iPhone" | **2868×1320** | The WebKit harness (you own no iPhone) |

All smaller iPad and iPhone sizes are optional and auto-scaled by Apple from these two.

**Do not capture these yet.** Both Phase A changes alter what the first screens look like: guest mode
removes the login wall, and the shots would otherwise open on a sign-in screen that is about to disappear.
Capture after Phase A lands, from the TestFlight build if possible.

**Shot list — 6 shots, same order in both slots.** Sequenced as a story a browsing parent reads in three
seconds: what it is, the breadth, the reward, the adult control.

1. **Section menu** — all five worlds visible. This is the "what is this app" shot and must be first.
2. **An alphabet game mid-round** — a letter prompt with baked art answers.
3. **A math game mid-round** — the ten-frame or the counting objects, showing something countable.
4. **A colour game** — carries the most visual appeal of any screen in the app.
5. **The Reward Book** — collected stickers. This is the shot that explains the progression model.
6. **"Til de voksne"** — the adult pane, showing difficulty and the microphone switch. Signals to a parent
   that they are in control, and pre-empts a reviewer wondering where the parental gate is.

**Capture commands.** Use the existing harness rather than anything new
(`.claude/skills/ui-screenshot/webkit.mjs`), and note the built-in `iphone` presets are **6.1" geometry
(390×844), not the required 6.9"** — the override is mandatory:

Run both dev servers first in Windows PowerShell (`npm run dev` + `npm run dev:api`), and put `?nogate=1`
on every URL — the app is auth-gated and the bypass attaches a stand-in child so the Reward Book actually
renders. The presets carry the device pixel ratio (iPad 2, iPhone 3), so overriding only `--w`/`--h` gives
the right output size:

```bash
# iPad 13" slot — 1366x1024 CSS at dpr 2 = 2732x2048
node .claude/skills/ui-screenshot/webkit.mjs --device ipad-pro --w 1366 --h 1024 \
  --url "http://localhost:5173/?nogate=1" --out docs/app-store/shots/ipad-1-menu.png

# iPhone 6.9" slot — 956x440 CSS at dpr 3 = 2868x1320
node .claude/skills/ui-screenshot/webkit.mjs --device iphone-landscape --w 956 --h 440 \
  --url "http://localhost:5173/?nogate=1" --out docs/app-store/shots/iphone-1-menu.png
```

Verify the output pixel dimensions before uploading — ASC checks them and rejects mismatches. Strip any
alpha channel the same way as the icon.

Two harness cautions that matter here. `?nogate=1` only exists in a **dev or `build:harness`** tree, never
in a deploy build — so screenshots come from the dev server, not from the shipped bundle. And this driver
**cannot play audio at all**, so ignore any "Tryk for lyd" state in a capture; it is the harness, not the
app.

**Honest limit:** the iPhone shots are real renders of the real app in real WebKit, so they legitimately
represent it — but **no human has ever seen this app on an iPhone.** That is rung 2, permanently, and it is
the price of submitting a universal app (see the PRD §4.2 and §5.5).

### 2.3 App previews (video)

Optional. Skip for v1 — they must be captured on-device and are more work than they are worth for a first
submission.

---

## 3. Everything else App Store Connect will ask for

Grouped by whether it is writing, a decision, or a thing that does not exist yet.

### 3.1 Two URLs that do not exist and are both mandatory

| Field | Status | What is needed |
|---|---|---|
| **Privacy Policy URL** | **MISSING — blocker** | PRD blocker 4. No privacy policy exists anywhere in this repo. Required in ASC **and** in-app. |
| **Support URL** | **MISSING** | A real page a parent can reach for help. Guideline 2.1(a) explicitly scrubs "empty websites", so a placeholder fails. |
| Marketing URL | optional | Skip. |

Cheapest honest fix for both: two routes on the existing Vercel deployment — `/privatliv` and `/support` —
rendered in-app and reachable by URL. That satisfies "easily accessible in the app" and gives ASC a real
link, with nothing new to host. Note Guideline 1.3 forbids links out of a Kids app except behind a parental
gate, which is another reason to render the text **in-app** rather than linking out to a browser.

### 3.2 Decisions

| Field | Recommendation |
|---|---|
| **Primary category** | **Education** |
| Secondary category | **Games** (optional; harmless and adds a browse surface) |
| **Age band (Kids Category)** | **6-8.** Bands are "5 and under, 6-8, 9-11"; a 5-7 audience straddles two and 6-8 is the closer fit. |
| **"Made for Kids"** | **Yes — and this is PERMANENT after App Review approval.** Read PRD §3.7 before ticking it. |
| **Primary language** | **Danish** |
| **Availability** | **Denmark only — SETTLED** (owner's decision, §1.5). Widen later if you want; narrowing after launch is the awkward direction. |
| **Copyright** | `2026 Allan Brink Vraa` — year then name, no `©` symbol (ASC adds it) |
| **Price** | Free, no in-app purchases |
| **Version** | `1.0` |

### 3.3 The questionnaires nobody warns you about

- **Export compliance.** ASC asks whether the app uses encryption. It uses HTTPS, which normally falls
  under the exemption for standard encryption, but the answer path changes what documentation is demanded.
  **UNKNOWN — not researched.** Do not guess in the form; read Apple's export-compliance help page at
  submission time. Getting this wrong is a common first-submission delay.
- **Advertising identifier (IDFA).** Answer **No.** The app has no ads, no attribution SDK, and no
  analytics (verified 2026-08-06: the apparent `amplitude` matches in this repo are the parallax token).
- **Content rights.** Confirm the app contains no third-party content. The baked art is AI-generated by the
  owner, the Danish voice comes from Azure AI Speech, and the fonts ship via `@fontsource`.
  **RESOLVED 2026-08-06:** Microsoft's Product Terms affirmatively grant commercial use of prebuilt
  neural-voice audio output, with no caching or redistribution restriction, so shipping the prebaked MP3s
  inside the binary is permitted — full sourcing in PRD §3.11. Two riders: the grant is scoped to the
  **paid tier**, so confirm the prebake did not run on F0 (PRD step C0), and Microsoft's Code of Conduct
  **requires disclosing that the voice is synthetic** (PRD item B9).
- **Age rating questionnaire.** Expect the 2025-updated version (new topics: in-app controls,
  capabilities, medical/wellness, violent themes). Everything here answers to the mildest option; the app
  has no violence, no user-generated content, no chat, no ads, no gambling, no web browsing.
- **App Review Information.** Contact details, plus **notes in English** stating: no account is required
  (just tap and play), the adult area is behind a passcode, the passcode for review is `<supply one>`, the
  microphone game is intentionally off by default and how to enable it, and the app is Danish-only by
  design.

### 3.4 Two account details worth knowing before you enrol

- Enrolling as an individual means **your personal legal name is the App Store seller name**
  (https://developer.apple.com/support/enrollment/, read 2026-08-06). There is no way to show a project
  name instead without an organization enrolment, which needs a D-U-N-S number and a company website.
- The **EU DSA trader declaration** is mandatory and separate. If you declare trader, your address goes on
  the public product page. See PRD §3.7 — a P.O. Box is accepted there, and non-trader is likely available
  for a free hobby app, but that is a legal call and yours to make.

---

## 4. What is ready now, and what is waiting on what

| Item | State |
|---|---|
| App icon 1024×1024 | **DONE** — `art-src/logo/app-store-icon-1024.png` |
| Name, subtitle, keywords, description, promo text (DA + EN) | **DONE** — §1, paste-ready |
| Category, age band, copyright, availability, questionnaire answers | **DONE** — §3.2, §3.3 |
| Screenshot shot list and capture commands | **DONE** — §2.2 |
| Screenshot files | **DONE** — 12 files in `docs/app-store/shots/`, dimensions and alpha verified (§2.2) |
| Privacy policy page + URL | **DONE** — `/privatliv`, in-app and public. **The owner must read it** (`phase-a.md`) |
| Support page + URL | **DONE** — `/support`, in-app and public |
| Name availability | **Only resolvable in App Store Connect** — needs the paid account |
| Azure voice redistribution rights | **RESOLVED** — permitted; see PRD §3.11 |
| Azure paid-tier vs F0 for the prebake | **Waiting on you** — Azure portal check, PRD step C0 |
| AI-voice disclosure in the adult area | **TODO** — PRD item B9 |
| Export compliance answer | **UNKNOWN** — read Apple's page at submission time |
| Everything requiring the account | **Waiting on you** — enrolment, 99 USD, trader status |

One description promise is still not true: "virker uden internet" depends on Phase B1 bundling. If B1
slips, cut the line rather than shipping copy the app does not honour.
