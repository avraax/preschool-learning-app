# Planning-session kickoff prompt — Narration & Pronunciation Correctness (→ PRD-11)

> Paste everything below the line into a **fresh** Claude Code session in this repo. It is a
> planning-only session: it ends by writing `docs/prd/PRD-11-narration-pronunciation-correctness.md`.
> No feature code is written in that session — only investigation, a broad interview, and the PRD.

---

You are running a **planning session** for the Danish preschool learning app (Børnelæring, ages 5–7).
The single focus is **narration & pronunciation correctness**: every letter, number, word, and phrase
the app speaks must be pronounced **correctly and in the language it is meant to be spoken in** — 100%.

**Motivating symptom:** several Danish letters are spoken wrong — e.g. the letter **J** comes out like
"joj" instead of the Danish letter name *jod*. This is not a one-off; letters, numbers, and words need
to be audited **exhaustively** across all games and app-wide, and every mispronunciation fixed.

Your job this session is to **investigate the codebase, interview me broadly, and produce a detailed,
self-contained PRD** that a future session can implement without re-asking me anything. **Do not write
any implementation code** — only the PRD (and, if it helps the interview, throwaway notes/scratch).

## Decisions already locked in (do not re-litigate these — build on them)

1. **Scope = all four narration surfaces:**
   - **Danish narration** — letter names, numbers 0–100, success/encouragement/score phrases, game
     titles/prompts, color names, shade names, object lines, sticker labels.
   - **English section** — words spoken by the `en-US` voice, and any `voiceType` routing mistakes
     (a Danish word read by the English voice, or an English word read by the Danish voice).
   - **Mixed-language clips** — single utterances that blend languages (e.g. `"Nyt klistermærke!
     {label}"`, math facts, `"{objekt} er {farve}"`).
   - **Web Speech fallback** — pronunciation quality of the browser fallback voice (lower priority,
     but in scope).
2. **Audit backbone = an in-app "audition harness."** The PRD must specify building a parent-only
   (or dev) route that plays **every clip in the closed narration set** so I — a native Danish ear —
   can listen and flag each clip OK / wrong, capturing my verdict. This is the systematic discovery
   mechanism and stays useful for re-verification after fixes.
3. **Allowed fix mechanisms:** (a) **PLS lexicon + IPA** entries in `public/da-DK.pls`; (b) **code
   text/spelling remap or inline SSML `<phoneme>`** (like the existing `J: 'jåd'` map); (c) **changing
   or adding a TTS voice** if a specific voice is the root cause. **Pre-recorded/hand-recorded audio is
   OUT of scope** — everything stays synthesized/prebaked.
4. **Deliverable:** `docs/prd/PRD-11-narration-pronunciation-correctness.md`, following the existing
   `docs/prd/` PRD style (read `docs/prd/README.md` and one or two existing PRDs, e.g. `PRD-04`,
   `PRD-06`, first so the tone/structure matches).

## Step 1 — Read before you interview (so questions are grounded, not generic)

Read these and build a mental map of **every place the app produces speech** and **how language/voice
is chosen**:

- `.claude/rules/audio-system.md` — mandatory audio rules.
- `src/config/danish-phrases.ts` — `DANISH_LETTER_NAMES` (the phonetic letter-name map, e.g.
  `J:'jåd', C:'se', Q:'ku', W:'dobbelt-ve', X:'eks', Z:'set'`), `getDanishLetterName`,
  `getDanishNumberText` (0–100, incl. compounds like `enogtyve` and `halvtreds/halvfjerds/firs/
  halvfems`, `et hundrede`), and all `DANISH_PHRASES` pools.
- `src/config/colorContent.ts` — `HUE_ORDER`, `SHADES`, `DANISH_OBJECTS`, `spokenColor` (color/shade/
  object lines).
- `src/config/englishVocab.ts` — `allEnglishWords` (English section vocabulary).
- `src/config/stickers.ts` — `STICKER_SETS` labels (spoken as `"Nyt klistermærke! {label}"`).
- `src/utils/SimplifiedAudioController.ts` — `speakLetter` / `speakNumber` / `GAME_WELCOME_MESSAGES`
  and **every `speak*` call site**; note which `voiceType` each uses.
- `src/services/ttsClient.ts` — `resolveRequest` (how `voiceType` → voice/lang/`useLexicon`/cacheKey),
  the prebaked-file lookup, and `fallbackWebSpeech`.
- `shared-tts-config.js` (`TTS_CONFIG.voices` primary=da-DK Christel, english=en-US Ava, `speakingRate`),
  `shared-azure-tts.js` (`buildSsml`, `lexiconUriForRequest`, IPA/`<phoneme>` support),
  `shared-tts-key.js` (`ttsCacheKey` — the shared cache/manifest key).
- `prebake-tts.mjs` + `src/config/prebakedTts.ts` — how the **closed narration set** is enumerated,
  synthesized to `public/sounds/tts/*.ogg`, and keyed. **Critical:** any text/lexicon/voice change
  requires `npm run tts:prebake` + committing the regenerated files, or prebaked audio drifts from the
  fix. The PRD must call this out.
- `public/da-DK.pls` — the current (minimal) lexicon and the **stød symbol rule** (use U+0294 glottal
  stop; U+02C0 is rejected by Azure da-DK; a single bad phoneme fails the whole SSML parse).

Then **grep for the full set of speak call sites and `voiceType` usages** so no narration surface is
missed (games, learning browses, RoundResultScreen, StickerReveal, welcomes, encouragement, etc.).

Summarize back to me: (a) the complete inventory of narration surfaces, (b) the likely **error
taxonomy** (categories below), and (c) which items you already suspect are wrong from the phonetic
spellings/IPA alone — before asking questions.

## Step 2 — Interview me BROADLY with `AskUserQuestion`

Go wide. Ask in batches of 2–4 questions, keep going across several rounds until every theme below is
covered, and **confirm with me that coverage is complete before writing the PRD.** Prefer concrete
options with a recommended default first; use multi-select where natural; always leave room for my
own answer. Themes to cover (not exhaustive — add what the code surfaces):

**A. Error taxonomy & priorities**
- Which categories bother you most / first: letter names, numbers, Danish words, English words,
  mixed clips, fallback voice? Rank them.
- Do you have specific known-bad items to seed the catalog right now (like J→"joj")? Capture each
  with the glyph/number/word, what it currently sounds like, and the correct target pronunciation.

**B. Danish letter names** — per-letter expected spoken name. Walk the tricky ones explicitly and get
your ruling on each: A E I O U Y Æ Ø Å (vowel quality), C, G, H (`hå`), J (`jod` vs current `jåd`),
K (`kå`), Q, R, V, W (`dobbelt-ve`), X, Z (`set` vs `zæt`). Should the app teach the modern Danish
name or a child-friendly variant? Any letters to skip?

**C. Numbers 0–100** — compounds (`enogtyve`…), the halv-tens (`halvtreds/halvfjerds/firs/halvfems`),
`nul`, `et hundrede`, and any homophone/ambiguity worries (e.g. *seks*). Should numbers be read the
"school" way? Is the `1.2×` browse rate in *Lær Tal* affecting clarity?

**D. English section & voice routing** — Confirm which content must use the `en-US` voice vs the
Danish voice. Are there English words Ava says wrong? Any Danish content currently leaking into the
English voice or vice versa? Should the Danish *intro/prompt* around an English word and the English
*word itself* be split into two clips with two voices?

**E. Mixed-language clips** — `"Nyt klistermærke! {label}"`, math facts, `"{objekt} er {farve}"`.
Which labels/objects are non-Danish or ambiguous? Rule for handling a foreign word inside a Danish
sentence.

**F. Audition harness design** — where it mounts (Til de voksne corner menu vs a dev-only route),
how the closed set is enumerated and grouped (letters / numbers / phrases / colors / English / mixed),
whether it plays prebaked or forces live synthesis, how my OK/wrong verdicts (and notes) are recorded
and exported (localStorage? downloadable JSON? a committed checklist file?), and whether it should
A/B lexicon-on vs lexicon-off and different voices per item.

**G. Fix mechanism preferences & constraints** — Default order to reach for (lexicon IPA vs code
remap vs voice change)? Any hard "don't touch" (e.g. keep Christel as the Danish voice unless proven
guilty)? Are you comfortable authoring/approving IPA, or should the PRD have Claude propose IPA for
your ear-check? Appetite for evaluating altern/voices in VoiceLab.

**H. Verification & done-definition** — What counts as "100% correct"? Sign-off = every clip flagged
OK in the harness? Regression guard so new content can't ship unaudited? Should the harness output a
committed "audited-OK" manifest?

**I. Process & sequencing** — One big fix pass or phased (letters → numbers → words → mixed →
fallback)? Should the implementing session rebuild prebaked audio and how do we verify prebake keys
didn't drift?

## Step 3 — Write the PRD

Write `docs/prd/PRD-11-narration-pronunciation-correctness.md`, self-contained and detailed enough to
implement in a fresh session with **zero** further questions to me. Include at least:

1. **Context & problem** — the mispronunciation problem, why it matters (kids learn the wrong sound),
   the four scope surfaces, and how the audio pipeline picks voice/language today (cite the files).
2. **Error taxonomy** — the categories from the interview, each with concrete examples and my rulings
   (especially the known-bad seed list with current→target pronunciation).
3. **Audition harness spec** — route/mount, enumeration of the closed set, grouping, playback source,
   A/B toggles, and how verdicts+notes are captured/exported. Enough detail to build directly.
4. **Fix strategy** — the decision order (lexicon IPA / code remap / voice change), per-category
   guidance, the verified-IPA/stød constraints, and the **mandatory prebake regen + commit** step.
5. **Per-surface work items** — letters, numbers, Danish phrases, colors/shades/objects, sticker
   labels, English words, mixed clips, `voiceType` routing audit, Web Speech fallback — each with what
   to check and how to fix.
6. **Acceptance criteria / definition of done** — what "100% correct" means and how it's verified,
   plus any regression guard.
7. **Sequencing/phasing**, risks (prebake key drift, Azure phoneme rejection, voice-change ripple),
   and out-of-scope notes (no pre-recorded audio).

Match the existing `docs/prd/` format. Number it **PRD-11**. Convert any relative dates to absolute.
Do not implement anything; end the session once the PRD is written and I've confirmed it.
