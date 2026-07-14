# PRD-11 — Narration & pronunciation correctness

**Priority:** P1 (the app teaches sound; a wrong sound directly mis-teaches — but not a crash/blocker)
**Scope:** Medium–Large (one new dev tool + a full audit pass + targeted data/lexicon/code fixes + a re-bake)
**Depends on:** builds on PRD-06 (prebaked TTS pipeline). No hard dependency on other PRDs.

> Line numbers below are from the 2026-07-14 snapshot (commit `19eefa7`). Code moves — always
> `grep`/read the current file before editing. Code sketches are intent, not literal patches.

---

## 1. Context & problem

Børnelæring teaches Danish (and beginner English) to children aged 5–7 through **native audio
narration**. The child cannot read yet, so the spoken word *is* the lesson. If a clip is pronounced
wrong, or in the wrong language, the app teaches the wrong thing — the worst failure mode for this age.

**Motivating symptom:** the Danish letter **J** is spoken as *"joj"* instead of the correct Danish
letter name *jod*. This is not a one-off. Letters, numbers, words, and phrases need an **exhaustive**
audit across every game and app-wide, and every mispronunciation fixed. The owner (a native Danish ear)
has confirmed the priority order — **letter names first**, then Danish words, then English & voice
routing, then numbers — but cannot recall the full defect list from memory, so the audit must be
**systematic**, not memory-driven. That is the reason for the audition harness (§3).

### 1.1 How the audio pipeline picks voice/language today

All narration flows through `useSimplifiedAudioHook()` → `SimplifiedAudioController` singleton
(`src/utils/SimplifiedAudioController.ts`, single-audio, no queue) → `ttsClient`
(`src/services/ttsClient.ts`, the playback engine) → **Azure AI Speech** → Web Speech API fallback.

- **Voice selection** — `TtsClient.resolveRequest()` (`ttsClient.ts` ~225) maps a `voiceType`
  (`'primary' | 'backup' | 'male' | 'english'`) to an Azure voice via `TTS_CONFIG.voices`
  (`shared-tts-config.js`): `primary`/`backup` = **da-DK ChristelNeural**, `male` = da-DK JeppeNeural,
  `english` = **en-US AvaMultilingualNeural**. A live VoiceLab override (Danish only) can swap the
  Danish voice for auditioning; it changes the cache key so prebaked files miss on purpose.
- **Language/lexicon** — the da-DK PLS lexicon (`public/da-DK.pls`) is referenced in SSML **only when
  the effective locale is `da-*`** (`resolveRequest` sets `useLexicon = lang.startsWith('da')`). The
  English voice gets **no lexicon** and English words are sent with `useSSML=false` (no inline
  `<phoneme>`). SSML is built in `shared-azure-tts.js` `buildSsml()`.
- **Cache key** — `shared-tts-key.js` `ttsCacheKey({ name, lang, rate, useLexicon, text })` is the
  single source of the key. `ttsClient` and the prebake script (`prebake-tts.mjs`) must compute
  byte-identical keys or a prebaked file is silently never found.
- **Prebaked closed set** — `prebake-tts.mjs` enumerates the closed narration inventory and synthesizes
  it once (default voice/rate) into `public/sounds/tts/*.ogg`, mapped by cache key in
  `src/config/prebakedTts.ts`. `synthesizeAndPlay()` (`ttsClient.ts` ~304) plays the prebaked file
  first; only genuinely dynamic text or a non-default voice hits Azure live.

### 1.2 The four scope surfaces (locked in)

1. **Danish narration** — letter names, numbers 0–100, success/encouragement/score phrases, game
   titles/prompts, colour names, shade names, object lines, sticker labels.
2. **English section** — words spoken by the `en-US` voice, plus any `voiceType` routing mistakes.
3. **Mixed-language clips** — single utterances blending languages/loanwords
   (`"Nyt klistermærke! {label}"`, math facts, `"{objekt} er {farve}"`, `"{c1} og {c2} bliver {result}"`).
4. **Web Speech fallback** — pronunciation quality of the browser fallback (lower priority, in scope).

### 1.3 Complete narration-surface inventory (audit target)

| # | Surface | Source (files) | Voice route | Prebaked |
|---|---------|----------------|-------------|----------|
| 1 | **Danish letter names** | `DANISH_LETTER_NAMES` respelling map + `getDanishLetterName` (`src/config/danish-phrases.ts`) → `speakLetter()` | `primary` | ✅ |
| 2 | **Numbers 0–100** | `getDanishNumberText()` → `speakNumber()` | `primary` | ✅ at rate 1.05 **and** 1.2 (Lær Tal browse) |
| 3 | **Success / encouragement / score** | `DANISH_PHRASES.success/encouragement/score` | `primary` | ✅ (success, encouragement, `noPoints`, `onePoint`) |
| 4 | **Game titles / welcomes** | `GAME_WELCOME_MESSAGES` (21 titles, `SimplifiedAudioController` ~336) | `primary` | ✅ |
| 5 | **Math facts (composed)** | `speakAdditionProblem`/`speakSubtractionProblem`/`speakMathProblem`, "Hvad er X plus Y", completed-fact echoes | `primary` | ❌ dynamic |
| 6 | **Colour hue + shade names** | `HUE_ORDER`, `SHADES` (`src/config/colorContent.ts`) | `primary` | ✅ |
| 7 | **Object reinforcement** `"{objektet} er {farve}"` | `DANISH_OBJECTS` + `spokenColor()` (neuter -t agreement) | `primary` | ✅ |
| 8 | **Colour-mix reveal** `"{c1} og {c2} bliver {result}"` | `RamFarvenGame.tsx` ~388 | `primary` | ❌ dynamic composed |
| 9 | **Sticker reveal** `"Nyt klistermærke! {label}"` | `STICKER_SETS` labels (`src/config/stickers.ts`) | `primary` | ✅ |
| 10 | **English words** | `allEnglishWords[].en` (`src/config/englishVocab.ts`) → `speakEnglish()` | `english` (en-US Ava), no lexicon, no `<phoneme>` | ✅ |
| 11 | **Web Speech fallback** | `ttsClient.fallbackWebSpeech()` — first `lang`-prefix voice, rate 0.85 | device voice | n/a |

**Doc drift to correct (not a behaviour change):** `.claude/rules/audio-system.md` and the JSDoc on
`SimplifiedAudioController.speakEnglish()` (~213–217) both claim the English voice is **en-GB**, but the
real config is **en-US Ava**. The owner has ruled **en-US stays**; the fix session must correct those
two comments so the docs match reality.

---

## 2. Error taxonomy (with owner rulings)

Categories, ranked by owner priority (letter names first). Each names concrete examples and the ruling.

### 2.1 Danish letter-name respelling errors — **P0**
The letter map is a phonetic respelling hack (`DANISH_LETTER_NAMES`, `danish-phrases.ts` ~159). Neural
Christel reads some respellings wrong, and some respellings collide with real Danish words. **Ruling:
teach the modern Danish letter names for all 29 letters** (A–Å incl. the rare/loan letters C, Q, W, X,
Z — none skipped or simplified).

Seed corrections (current → target spoken name). Exact IPA/respelling to be tuned in the harness; these
are the intended targets:

| Letter | Current | Target | Reason |
|---|---|---|---|
| **J** | `jåd` | **jod** | reported "joj"; correct name is *jod* |
| **Z** | `set` | **zæt** | `set` is read as the word *set* |
| **R** | `er` | **ær** | `er` is read as the word *er* (is) |
| **Y** | `y` (bare glyph) | explicit **y** vowel (`/yˀ/`) | force Danish vowel, not English "why" |
| **C** | `se` | **se** (keep, but pin via IPA) | collides with *se* (look) |
| A E I O U Æ Ø Å | bare glyphs | explicit Danish vowel names | force da vowel quality, not word/English reading |
| H, K, Q, W, X | `hå`,`kå`,`ku`,`dobbelt-ve`,`eks` | unchanged unless harness flags | look correct |

Every letter — including the ones that "look correct" — must still be flagged OK in the harness before
sign-off; the table above is a starting hypothesis, not the final verdict.

### 2.2 Number pronunciation — in scope, exhaustive
Ruling: **audit all of 0–100 exhaustively.** Tricky zone: the halv-tens (`halvtreds`=50,
`halvfjerds`=70, `firs`=80, `halvfems`=90) and every compound (`enogtyve`…`niognitten`, built as
`${ones}og${tens}` in `getDanishNumberText`).

- **Standalone 1 → `et` (ruling).** `getDanishNumberText(1)` currently returns `'en'`; the owner wants
  the standalone number spoken as **`et`** (neuter counting form: "et, to, tre"). **Critical subtlety:**
  the compound 21 must stay **`enogtyve`** (not *etogtyve*) — Danish uses *en* inside `-og-` compounds.
  So the fix must special-case the *standalone* value 1 only, without changing the `basic[1]` used to
  build compounds. Do not blanket-edit `basic[1]`.
- **Browse rate stays 1.2×.** Lær Tal speaks numbers via `speakNumber(n, 1.2)`; the owner confirms it
  sounds fine — keep it. (Both the 1.05× and 1.2× number clips are prebaked; both must be audited.)
- **Homophones** (e.g. *seks*/6) are inherent to Danish and are **not** defects — leave as-is.

### 2.3 Danish word errors — in scope (2nd priority)
Colour names, shade names (`lyserød`, `mørkerød`, `lys lilla`…), object definite forms
(`æblet`, `jordbærret`…), sticker labels (all Danish), game titles. The lexicon is currently nearly
empty (only `hund` carries stød). Words missing stød or otherwise misread are fixed via lexicon
IPA / inline `<phoneme>`. **Loanword ruling:** words assimilated into Danish (`pizza`, `banan`,
`helikopter`, `aubergine`, …) stay in the **Danish voice, Danicized** — that is how a Dane says them.

### 2.4 English word & accent errors — in scope (3rd priority)
`allEnglishWords[].en` spoken by en-US Ava. **Ruling: keep en-US Ava** (fix the stale en-GB docs). Audit
every English word for Ava mispronunciation; fixes for English are limited to code/SSML (no da lexicon
applies to `en-*`).

### 2.5 Language-routing errors — audit, low expected yield
The owner **trusts the current routing design** (Danish text → Danish voice; English target word →
English voice) and does not expect many leaks. Ruling: still do a **lightweight call-site audit** of
every `speak*`/`voiceType` usage to confirm no Danish word is sent to Ava (or vice-versa), and fix any
leak found. Reinforced ruling: **all Danish text uses the Danish voice**, including the Danish side of
the bilingual English `numbers`/`colors` themes (`en:'one'/da:'en'`, `en:'red'/da:'rød'`).

### 2.6 Mixed-language clip errors — in scope
`"Nyt klistermærke! {label}"` (labels all Danish — OK), composed math facts, `"{objekt} er {farve}"`,
`"{c1} og {c2} bliver {result}"`. Rule per §2.3: a foreign word inside a Danish sentence stays in the
Danish voice, Danicized. Flag and fix individually only if the harness surfaces a specific bad one.

### 2.7 Web Speech fallback — lower priority, in scope
`fallbackWebSpeech` picks the first voice whose `lang` starts with the target prefix; on a device with
no Danish voice it reads Danish in an English voice. Audit the perceived quality and document the known
limits; a full fallback rework is explicitly deferred to PRD-06's scope where relevant.

---

## 3. Audition harness spec (the audit backbone)

A parent/dev tool that plays **every clip in the closed narration set** so a native ear can flag each
OK/wrong and capture the verdict. It is the systematic discovery mechanism and stays useful for
re-verification after fixes. Build this **first**.

### 3.1 Mount & route
- **Dev-only route `/audit`** (ruling). Not shipped in production builds / gated behind a dev flag —
  it is a workshop tool, not for kids or parents. Lazy-load it like other routes in `App.tsx`; guard it
  so it renders only in dev (e.g. `import.meta.env.DEV`) or behind an explicit query flag.
- No entry in the "Til de voksne" menu (the owner chose dev-only over the on-device option).

### 3.2 Enumeration & grouping
Enumerate the **same closed set the prebake script builds**, reusing the exact source modules and the
`ttsCacheKey` helper so every harness row corresponds 1:1 to a prebaked file (or a known-dynamic
clip). Factor the enumeration so `prebake-tts.mjs` and the harness share one clip-list builder if
practical (avoids drift between "what gets baked" and "what gets auditioned").

Group the list into collapsible sections so a full pass is navigable:
- **Letters** (29) · **Numbers** (0–100 at 1.05× and 1.2×) · **Phrases** (success / encouragement /
  score / game titles) · **Colours** (hue names / shade names / object lines) · **Mixed** (sticker
  reveals / a representative set of math facts / colour-mix reveals) · **English** (all words).

Each row shows: the group, the spoken text, the cache key, the target voice/lang, whether a prebaked
file exists, and the current verdict/notes.

### 3.3 Playback source
- **Default = play the prebaked `.ogg`** the child actually hears (true to production).
- **"Force live" toggle** per row (and global) → re-synthesize from Azure with the current
  text/lexicon so a candidate fix can be previewed before re-baking.

### 3.4 A/B comparison controls (per item)
Ruling — support these three (rate A/B was **not** requested, since 1.2× stays):
1. **Lexicon on vs off** — toggle the da-DK PLS lexicon to hear whether a lexeme helps/hurts.
2. **Alternate voices** — play the same clip through other Azure voices (Jeppe, other VoiceLab voices,
   a GB English voice for comparison) to test whether the *voice* is the root cause.
3. **Candidate IPA / respelling input** — a text box to type a candidate IPA or respelling and hear it
   live (via inline `<phoneme>` / substituted text) before committing it to code or the lexicon.

(These map to existing `buildSsml` knobs: `lexiconUri`, `voiceName`/`lang`, and `ipa`. The harness can
drive a small dev endpoint or reuse `/api/tts-azure` with the relevant body fields.)

### 3.5 Verdict capture & export
Ruling — **all three**, layered:
1. **localStorage** — flag OK/wrong + free-text note per clip as you listen; persists across reloads.
2. **Download JSON** — export the full defect list (clip text, cache key, verdict, note, any candidate
   IPA) as a file the fix session ingests.
3. **Committed checklist file** — the harness writes/refreshes a markdown (or JSON) checklist in the
   repo (e.g. `docs/audit/narration-audit.md`) recording per-clip OK/wrong + note, so the audit state
   is reviewable in git and the fix session reads it directly.

The exported/committed record is also the seed of the **audited-OK manifest** in §6.

---

## 4. Fix strategy

### 4.1 Decision order (ruling)
For each confirmed-wrong clip, reach for fixes in this order:
1. **Code respelling / inline IPA `<phoneme>` first** — for letters and numbers (text the code fully
   controls), fix the respelling in `DANISH_LETTER_NAMES` / `getDanishNumberText`, or wrap in an inline
   `<phoneme>`. This is precise and self-contained.
2. **PLS lexicon (`public/da-DK.pls`)** — for real dictionary words (colour/shade/object words, sticker
   labels) where a permanent, app-wide pronunciation entry is the right home.
3. **Voice change** — last resort, only if the harness A/B proves the *voice itself* is the root cause
   for many clips.

### 4.2 Voice policy (ruling)
**Keep Christel (da-DK) and Ava (en-US) unless proven guilty.** Do not switch voices to fix a handful of
clips — a voice change re-bakes the entire set and risks broad regressions. Only swap if A/B shows the
voice is systematically wrong.

### 4.3 IPA authoring (ruling)
**Claude proposes IPA/respellings; the owner ear-checks each candidate in the harness and approves
before it is committed + re-baked.** The fix session must not commit an unaudited IPA guess.

### 4.4 Verified-IPA / stød constraints (mandatory)
- **Stød = U+0294** (LATIN LETTER GLOTTAL STOP `ʔ`), **not** the look-alike U+02C0 (`ˀ`) which Azure
  da-DK rejects as "Unknown phoneme".
- **A single rejected phoneme fails the whole SSML parse** → that clip silently drops to Web Speech.
  Only use verified da-DK symbols (stød glottal stop, soft-d, uvular r, open-o, primary stress). The
  harness "candidate IPA" box is the safe place to verify a symbol before committing it.
- The SSML body must be real UTF-8 (already handled by `shared-azure-tts.js`; keep `da-DK.pls` UTF-8).
- Lexicon grapheme matching is **case-sensitive**; the app speaks word content in lowercase.

### 4.5 Mandatory prebake regen + commit (do not skip)
**Any change to narration text, the lexicon, or a voice requires `npm run tts:prebake` + committing the
regenerated `public/sounds/tts/*.ogg` AND `src/config/prebakedTts.ts`.** Otherwise the prebaked audio
drifts from the fix and the child keeps hearing the *old* pronunciation while the code looks fixed.
Prebake needs Azure creds in `.env.local` and fetches the lexicon from the public prod URL (localhost is
unreachable to Azure), so prebaked Danish audio carries the same lexicon fixes as production.

---

## 5. Per-surface work items

For each: what to check, how to fix.

1. **Danish letter names** (`danish-phrases.ts` `DANISH_LETTER_NAMES`) — audit all 29 in the harness.
   Apply the §2.1 seed corrections (J→jod, Z→zæt, R→ær, Y/vowels explicit) via code respelling/inline
   IPA. Confirm each OK. Re-bake.
2. **Numbers 0–100** (`getDanishNumberText`) — audit all values at **both** 1.05× and 1.2×.
   Special-case standalone 1 → `et` **without** breaking `enogtyve`. Verify halv-tens and every
   compound. Fix via code text / inline IPA / lexicon as needed. Re-bake.
3. **Danish phrases** (`DANISH_PHRASES.success/encouragement/score`, `GAME_WELCOME_MESSAGES`) — audit;
   fix mispronounced words via lexicon/IPA. Re-bake.
4. **Colours / shades / objects** (`colorContent.ts`) — audit hue names, all shade names, and every
   `"{objektet} er {farve}"` line (check neuter -t agreement reads naturally too). Fix via lexicon/IPA.
   Re-bake.
5. **Sticker labels** (`stickers.ts`) — audit each `"Nyt klistermærke! {label}"`. All labels Danish;
   fix any misread label via lexicon. Re-bake.
6. **English words** (`englishVocab.ts`) — audit every `en` word on Ava. Fix via SSML/text tweaks
   (no da lexicon). Keep en-US. Re-bake.
7. **Mixed clips** — math facts (`speakAdditionProblem`/`Subtraction`/`speakMathProblem` and the
   completed-fact echoes), colour-mix reveal (`RamFarvenGame` ~388). These are dynamic (not prebaked);
   verify the composed text reads correctly and that no fragment routes to the wrong voice.
8. **`voiceType` routing audit** — grep every `speak*`/`voiceType`/`synthesizeAndPlay` call site
   (`SimplifiedAudioController.ts`, the English games, browse games). Confirm Danish text → `primary`,
   English target → `english`. Fix leaks. Correct the en-GB→en-US doc drift in
   `.claude/rules/audio-system.md` and `speakEnglish()` JSDoc.
9. **Web Speech fallback** — audit perceived quality; document known limits. Full rework deferred.

---

## 6. Acceptance criteria / definition of done

Ruling — **every clip flagged OK + committed audited manifest + regression guard.**

- [ ] The `/audit` harness exists (dev-only), enumerates the full closed set grouped per §3.2, plays
      prebaked-with-force-live, supports the three A/B controls (§3.4), and captures verdicts to
      localStorage + JSON export + committed checklist (§3.5).
- [ ] **Every clip in the closed narration set is flagged OK** in the harness by the owner (no
      outstanding "wrong"). This includes letters (all 29), numbers 0–100 (both rates), phrases, colours
      /shades/objects, sticker labels, and English words.
- [ ] The specific seed bugs are fixed and verified OK: **J = jod**, **Z = zæt**, **R = ær**, Y/vowels
      read as Danish, standalone **1 = et** while **21 = enogtyve**.
- [ ] Prebaked audio was regenerated (`npm run tts:prebake`) and committed together with
      `prebakedTts.ts`; a spot-check confirms the prebaked files match the fixed text (no key drift).
- [ ] A **committed "audited-OK" manifest** records which clips (by cache key) are signed off.
- [ ] A **regression guard** exists so newly added narration content (a new sticker, English word,
      colour object, etc.) surfaces as **UNAUDITED** until listened — e.g. a check/test that compares
      the enumerated closed set against the audited-OK manifest and flags any un-signed-off key. New
      content cannot silently ship unaudited.
- [ ] The en-GB→en-US documentation drift is corrected.

**Verification method:** the audit itself is the verification (native-ear sign-off per clip in the
harness). After fixes + re-bake, re-run the harness on the prebaked files to confirm the shipped audio
(not just live synthesis) is correct — a fix that was only heard via "force live" but not re-baked does
not count as done.

---

## 7. Sequencing / phasing

Ruling — **harness first, then fix by category:**
1. **Build the audition harness** (`/audit`) + the shared clip enumeration + verdict capture/export.
2. **Full listen pass** — the owner auditions the whole set, flagging OK/wrong + notes → defect list.
3. **Fix in priority order:** letter names → Danish words → English & routing → numbers → mixed →
   fallback. Propose IPA/respellings, owner ear-checks candidates in the harness, commit approved fixes.
4. **Re-bake** (`npm run tts:prebake`) + commit regenerated files.
5. **Re-verify** the prebaked output in the harness; produce the audited-OK manifest + wire the
   regression guard.

This can be split across sessions (harness+listen, then fix+rebake) if convenient; the committed
checklist carries state between them.

---

## 8. Risks / notes

- **Prebake key drift** — if `ttsClient` and `prebake-tts.mjs` ever compute different keys, a "fixed"
  clip is never found and the app silently re-pays Azure with the *old* pronunciation. Keep both on the
  shared `ttsCacheKey` helper; have the harness show prebaked-hit/miss per row to catch drift.
- **Azure phoneme rejection** — one bad IPA symbol fails the whole SSML → silent Web Speech fallback.
  Use only verified da-DK symbols; verify every candidate in the harness before committing (§4.4).
- **Voice-change ripple** — swapping a voice re-keys and re-bakes the entire set; avoid unless proven
  necessary (§4.2).
- **Standalone-1 subtlety** — changing 1 to `et` must not turn 21 into *etogtyve* (§2.2); test the
  compounds after the change.
- **Number-1 fan-out** — `getDanishNumberText(1)` feeds score echoes and math facts too; verify those
  composed clips still read naturally after the `et` change (note `DANISH_PHRASES.score.onePoint` is
  already the fixed string "Du har et point").
- **Homophones are not bugs** — *seks*/6 and similar are inherent to Danish; do not "fix" them.

## 9. Out of scope

- **No pre-recorded / hand-recorded audio** — everything stays synthesized/prebaked (Azure).
- Replacing Azure as the provider; the STT/mic side (PRD-03); the SFX/music channels.
- A full Web Speech fallback rework beyond auditing/documenting its quality (PRD-06 territory).
