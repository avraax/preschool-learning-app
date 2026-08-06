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

| # | Candidate | Chars | Note |
|---|---|---|---|
| **A** | **`Børnelæring: Alfabetet og Tal`** | **29** | **Recommended.** Brand first, then the two highest-value search terms. Apple indexes the name, so this is free keyword weight. |
| B | `Børnelæring` | 11 | Cleanest, most brandable, and worst for discovery — a parent searching "alfabet dansk" never finds it. |
| C | `Børnelæring - Bogstaver og Tal` | 30 | Exactly at the limit, so any future tweak breaks it. Prefer A's colon. |

**Name availability is the one thing that can force a change, and it can only be settled in App Store
Connect** — the name is reserved when the app record is created, and "Børnelæring" is an ordinary Danish
compound noun, so a collision is plausible. **UNKNOWN until you try it.** Have B as the fallback, or
`Børnelæring ABC` / `Min Børnelæring` if the bare word is taken.

### 1.2 Subtitle — 30 char limit

| # | Candidate | Chars | Note |
|---|---|---|---|
| **A** | **`Lær bogstaver, tal og farver`** | **28** | **Recommended.** Adds three indexed words the name doesn't have. Says what the app *is*. |
| B | `24 rolige spil for 5-8 år` | 25 | Leads with scale and age. Good for a browsing parent, weaker for search. |
| C | `Dansk tale, ingen reklamer` | 26 | Leads with the differentiator. Tempting, but spends both indexed slots on words nobody searches. |

Do not repeat name words in the subtitle — Apple indexes name, subtitle and keywords as one pool, so a
repeat is a wasted slot.

### 1.3 Keywords — 100 char limit, comma-separated

```
stavning,regning,matematik,dansk,engelsk,førskole,indskoling,memory,læsning,plus,minus
```

**86 characters, 14 spare.** Rules applied: no space after commas (a space is a wasted character), no
word already in the name or subtitle (`børn`, `alfabet`, `tal`, `bogstaver`, `farver`, `lær`), no plurals
of words already present, no competitor names, no "app"/"spil"/"gratis" (Apple ignores or penalises
these). Candidates for the 14 spare characters once you see real search behaviour: `hukommelse`,
`ordleg`, `abc`.

### 1.4 Description — Danish (primary), 1257 characters

Paste as-is. The bullet character is `•` (U+2022), not an emoji, so it is consistent with the app's
no-emoji rule.

```
Børnelæring er en rolig, dansk læringsapp til børn i førskole- og indskolingsalderen. Fem verdener, 24 spil og en rigtig dansk stemme, der læser alt højt — så barnet kan spille selv, også før det kan læse.

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
• Al tale er dansk og indtalt på forhånd, så spillene virker uden internet

FOR DE VOKSNE
Bag en talkode kan du vælge sværhedsgrad, oprette flere børneprofiler og slå mikrofonspillet til eller fra. Mikrofonen er slået fra som standard. Mikrofonspillet og synkronisering mellem enheder kræver internet.

Appen er skrevet til en 5-årig dreng af hans far, og er tænkt til børn på 5-8 år.
```

**Two lines were promises the app could not keep.** Status as of 2026-08-06:

- **"Ingen konto nødvendig for at spille" is now TRUE** — the guest path shipped in Phase A1.
- **"Al tale … så spillene virker uden internet" is still NOT true** and depends on Phase B1 bundling the
  assets into the binary. **If B1 slips, delete that line before submitting** — a description that
  overstates the app is a Guideline 2.3.1 rejection, and the easiest possible one to avoid. The same
  sentence appears in the English copy in §1.5. A description that overstates the app is a Guideline 2.3.1 rejection, and it is the
easiest possible one to avoid.

The last line is deliberate. "Skrevet til en 5-årig dreng af hans far" is true, it explains the absence of
monetisation better than any feature bullet, and reviewers read descriptions.

### 1.5 Description — English (en-US locale, and useful context for the reviewer)

```
Børnelæring is a calm Danish learning app for children in preschool and the first school years. Five worlds, 24 games, and a real Danish voice that reads everything aloud — so a child can play alone, even before learning to read.

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
• All speech is Danish and pre-recorded, so the games work without internet

FOR GROWN-UPS
Behind a passcode you can set the difficulty, add more child profiles, and turn the microphone game on or
off. The microphone is off by default. The microphone game and cross-device sync need internet.

Written for a five-year-old boy by his father, and intended for children aged 5-8.
```

**The app itself stays Danish-only.** This is App Store metadata for the en-US locale, not a translation
of the UI. Note the tension worth being deliberate about: shipping an English listing invites English
speakers to download a Danish-only app, which earns one-star reviews. **Recommendation: ship the Danish
listing only, and restrict availability to Denmark** (and optionally Norway/Sweden/Germany, where Danish
speakers live). Keep this English copy for App Review, not for the store.

### 1.6 Promotional text — 170 char limit, editable without a new build

```
Fem verdener, 24 spil og en rigtig dansk stemme. Ingen reklamer, ingen køb inde i appen og ingen sporing - bare bogstaver, tal og farver i dit barns eget tempo.
```

**160 characters.** This field is the only listing copy you can change without submitting a build, so keep
it for news ("Nu med engelsk", "Nye klistermærker") rather than permanent description material.

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

### 2.2 Screenshots — CAPTURED 2026-08-06, in `docs/app-store/shots/`

Twelve files, `<slot>-<n>-<name>.png`. **Verified programmatically before upload: exact pixel size, PNG,
3 channels, no alpha** — `ipad-*` are 2732×2048 and `iphone-*` are 2868×1320, all landscape.

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
| **Availability** | **Denmark only** (see §1.5). Widen later; narrowing after launch is the awkward direction. |
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
- **Content rights.** Confirm the app contains no third-party content. Worth a moment's thought: the baked
  art is AI-generated by the owner, the Danish voice is licensed from Azure AI Speech, and the fonts ship
  via `@fontsource`. **Check the Azure AI Speech terms cover distributing synthesized audio in a shipped
  app** — the prebaked MP3s in `public/sounds/tts/` are recordings of a licensed voice, redistributed
  inside a binary. **UNKNOWN and worth resolving before submitting**; it is the kind of thing that is fine
  in practice and expensive to be wrong about.
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
| Azure voice redistribution rights | **UNKNOWN** — needs a licence read |
| Export compliance answer | **UNKNOWN** — read Apple's page at submission time |
| Everything requiring the account | **Waiting on you** — enrolment, 99 USD, trader status |

Two of the three description promises ("ingen konto", "virker uden internet") are only true after Phase A
and B. If either slips, cut the line rather than shipping copy the app does not honour.
