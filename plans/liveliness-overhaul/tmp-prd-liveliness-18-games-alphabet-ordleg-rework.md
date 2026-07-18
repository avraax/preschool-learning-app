# Liveliness PRD-18 — Alphabet + Ordleg games rework (closers)

**Date:** 2026-07-17
**Part of:** Games UX & Learning rework (findings: `tmp-prd-liveliness-13-games-ux-audit.md` §B + §F; shared keystone:
`-14`; pattern: `-15`/`-16`/`-17`). **This is the last group — it closes the backlog.**
**Depends on:** **PRD-14 merged** (Alphabet + Ordleg already got: Bogstav Quiz `speakCorrectFact` + confusable
distractors (W3/W2), Lær Alfabetet word/sound audio (W3), Læs Ordet unique-initial-letter distractors (W2), the
shared vertical rhythm (W1), memory 10-pair default + card-word-label removal (W4/W5)). This PRD does the **remaining**
audit items only.
**Owner:** Allan. **Target user:** ~5-year-old boy, iPad, pre-reader; knows all letters; Ordleg kept at the easiest
2–3 letter words. No adaptivity. 44px targets. Danish copy.
**Art:** **art-free EXCEPT W2** — the Bogstav Quiz picture-manifest audit may swap a few subjects; each swapped subject
needs one new baked WebP (Gemini, per `.claude/rules/scene-assets.md`). Everything else is code/layout. If the owner
approves no swaps, PRD-18 is fully art-free.

> Fourth/final grouped rework (audit §I). **Learning first.** Most items are small — the big Alphabet/Ordleg learning
> fixes already shipped in PRD-14; these are the residual clarity + layout closers, plus one content audit (W2) and
> one optional upgrade (W6).

---

## 1. Scope (6 workstreams)

| WS | Game | Change | Priority |
|---|---|---|---|
| **W1** | **Læs Ordet** (Ordleg) | **Silent first-letter cue** (tint/enlarge the prompt word's first letter) + **3 options at Let** | HIGH (in group) |
| **W2** | **Bogstav Quiz** (Alphabet) | **Picture-manifest audit** — swap subjects whose everyday child-name ≠ the target word (art-gated per swap) | MED |
| **W3** | **Stav Ordet** (Ordleg) | **Tighten the layout** — pull slots+tiles up, kill the residual dead mid-band | MED |
| **W4** | **Sig et Ord** (Ordleg) | Move the idle **instruction line up next to the mic** | LOW |
| **W5** | **Lær Alfabetet** (Alphabet) | Enlarge/center the **bloom** into the dead band above the grid | LOW |
| **W6** | **Hukommelse Bogstaver** (Alphabet) | *(optional)* **glyph↔picture pairing** variant so memory also drills letter→word | LOW / owner-decision |

Already handled by PRD-14 (do NOT redo): Bogstav Quiz fact + confusable distractors; Læs Ordet distractor uniqueness;
Lær Alfabetet association audio; memory 10-pair default + face word-label removal; shared vertical rhythm. **Stav
Ordet is pedagogically the strongest game — W3 is layout only, no learning change.** Sig et Ord's mechanic is untouched.

## 2. Guardrails
iPad-first no-scroll; 44px; Danish; Comic Sans; token-driven (all 4 skins); reduced-motion (motion off, audio kept);
no adaptivity; **Læs Ordet NEVER reads the prompt word** (W1's first-letter cue is **visual only** — no audio);
**Ordleg stays at the easiest 2–3 letter words**; Sig et Ord's hold-to-talk + no-grading model untouched; no new
narration. W2 swaps use the green-screen pipeline (`.claude/rules/scene-assets.md`); glyphs stay type.

## 3. Workstream design

### W1 — Læs Ordet: silent first-letter cue + gentler floor (LEARNING)
**Problem (PRD-13 §F):** for a true pre-reader the achievable strategy is "sound out the first letter → pick the
picture starting with that sound." PRD-14 already made distractors' initial letters unique (so first-sound decoding
now *wins*); this adds the missing **cue** and a gentler option count.
**Change:**
- **Tint/enlarge the first letter** of the prompt word (e.g. render "**K**o" with the K larger / in the accent
  colour) — a **silent** visual cue that models "sound out this letter first." **Do NOT read the word aloud** (the
  invariant); the cue is purely typographic.
- **Drop to 3 options at Let** (keep 4 Normal / 6 Svær) — a gentler floor for the youngest reader, matching the
  section's easiest-level mandate.
- Reduced-motion: the enlarged/tinted letter is static styling (fine).
**Learning check:** the cue must make first-sound decoding *inviting* without turning into reading the word aloud; the
word stays fully shown (silent decoding intact).
**Verify:** the prompt word's first letter is visually emphasized; NO `/api/tts-azure` call fires for the prompt word
(capture); Let shows 3 options, Normal 4, Svær 6; distractors still never share the target's first letter (PRD-14).

### W2 — Bogstav Quiz: picture-manifest audit (LEARNING/content; art-gated per swap)
**Problem (PRD-13 §B):** some picture subjects have an everyday child-name that differs from the target word, so the
picture *fights* the spoken prompt (the audit flagged the W = "wienerbrød" pastry, which a Danish 5-year-old calls
"snegl"/"bolle"/"kage" → S/B/K, none of which are the answer). If he acts on the picture alone, it misleads.
**Change:**
- **Audit all `LETTER_WORDS` subjects** (App. §A2) for "child would spontaneously call this something else" mismatches.
  Candidate list + the owner's call in §6. For each **approved swap**, pick an unambiguous everyday Danish noun for
  that letter whose common child-name == the word, and **generate one new baked WebP** (Gemini green-screen pipeline)
  + rewire the manifest entry. (Letters with no clean unambiguous option — e.g. W — may stay as-is or be dropped as a
  quiz target, per §6.)
- Keep the word-association mechanic, the round, and PRD-14's `speakCorrectFact`/confusable distractors unchanged.
**Learning check:** every quiz-asked subject's picture should, on its own, evoke a word that **starts with the target
letter** for a Danish 5-year-old — so picture and audio agree.
**Verify:** the audited subjects render unambiguously; any swapped subject has its baked WebP wired; the quiz still
asks word-association with the fact spoken on correct.

### W3 — Stav Ordet: tighten the layout (UX) — **likely already done by PRD-14 W1; verify first**
**Status:** the signature pass shows Stav Ordet's answer-zone `Box` **already** uses `justifyContent: 'flex-start'`
+ `pt` with a PRD-14 W1 comment (App. §A3) — i.e. the slots+tiles were **already pulled up**. So **first verify** with
`ui-screenshot`: if the picture→slots→tiles column is already compact, **W3 is a no-op — skip it.** Only if a
residual dead band remains, fine-tune the `pt`/`gap` on that container (App. §A3). Layout only, no learning change.
**Verify:** confirm no big empty band; tiles ≥44px off the bottom edge; spelling loop + hint intact.

### W4 — Sig et Ord: instruction next to the mic (UX, LOW)
**Problem (PRD-13 §F):** the idle instruction "Hold knappen og sig et ord!" floats low, disconnected from the mic
(which sits high), with an empty band between — for a 5yo the call-to-action reads best adjacent to the control.
**Change:** move the idle instruction **up, directly under the mic** (or the waveform) so button + label form one
unit. Keep the whole reworked mic (static grounding, hold-to-talk, spell-back, match-bloom) untouched.
**Verify:** the instruction sits under the mic as one unit; mic behavior unchanged.

### W5 — Lær Alfabetet: enlarge/center the bloom (UX, LOW)
**Problem (PRD-13 §B):** the letter+picture bloom sits small and high with a large empty band before the grid (partly
PRD-14 W1). **Change:** enlarge/vertically-center the bloom so the tapped letter + baked picture read as the clear
hero and consume the empty band. Keep tap-to-hear + PRD-14's word/sound association audio + browse XP.
**Verify:** the bloom fills the space above the grid; grid unchanged; tap audio (association) intact.

### W6 — Hukommelse Bogstaver: glyph↔picture pairing (OPTIONAL, owner-decision)
**Problem (PRD-13 §B):** both cards of a pair are identical (glyph+picture), so success is pure visual matching —
the letters teach little. **Optional upgrade:** a variant where a **letter-glyph card matches its picture card** (match
"B" ↔ the bear), so the memory game also drills letter→word association while keeping the memory mechanic (`pairId`
already decouples pair identity from face content — App. §A6). **This changes what each card shows** — ship only if
the owner wants it (§6); otherwise leave memory as-is (it works). Keep 10-pair default (PRD-14), mismatch-scaled stars.
**Verify (if built):** a glyph card and its picture card form a matchable pair; matched → speaks the association;
stars/flip unchanged.

## 4. Danish copy
**None new.** W1's cue is typographic (silent); all spoken content reused.

## 5. Files to touch
- `src/components/ordleg/LaesOrdetGame.tsx` (W1 — first-letter cue + Let option count)
- `src/config/letterWords.ts` (W2 — swapped manifest entries) + `src/assets/games/alphabet/` (W2 — new WebP per swap)
- `src/components/ordleg/SpellingGame.tsx` (W3 — layout tighten)
- `src/components/ordleg/SpeakWordGame.tsx` (W4 — instruction placement)
- `src/components/alphabet/AlphabetLearning.tsx` (W5 — bloom size/center)
- *(optional W6)* `src/components/learning/MemoryGame.tsx` + `src/components/common/UnifiedMemoryGame.tsx`
**Reuse:** `getCategoryTheme`, `letterArt`, tactile depth helpers, the scene-assets keying pipeline (W2 only).

## 6. Owner decisions (defaults chosen)
1. **W2 manifest swaps** — [default: I list the child-name mismatch candidates from `LETTER_WORDS` (see App. §A2 after
   the audit); you approve which to swap]. Any approved swap needs one new Gemini render. Letters with no clean
   option (e.g. W) stay as-is or drop as a quiz target.
2. **W6 glyph↔picture memory variant** — [default: **skip** — memory works today]. Turn it on if you want memory to
   also teach letter→word.
3. **W1 option count** — [default: 3 at Let / 4 Normal / 6 Svær].

## 7. Verification (end-to-end)
- `npm run build` + `npm run lint` clean (+ `audit:check` only if W2 adds a swapped subject that changes narrated
  content — it shouldn't; words are reused).
- `ui-screenshot`, iPad + phone, all 4 skins: W1 first-letter cue visible + 3 options at Let; W2 audited subjects
  unambiguous; W3 compact spelling column; W4 instruction under mic; W5 bloom fills the band. Reduced-motion + 0
  console errors.
- **W1 invariant check:** capture `/api/tts-azure` — the Læs Ordet prompt word is still NEVER spoken.
- **Then play-test** — W1 (does the first-letter cue help him decode?) + W2 (do the pictures read right to him?).

## Appendix A — verbatim current signatures / anchors (current `master`, post-PRD-14)

**§A1 — Læs Ordet (W1).** `LaesOrdetGame.tsx`: prompt built in `generateQuizItem` **:88–92** as
`questionVisual: { emoji: '', word: w.word.toUpperCase() }` (**:91**) — the visible prompt is **one uppercased
string**, no per-char markup; rendered by the engine's `PromptFocus` word path. Prompt never spoken:
`speakQuizPrompt: async () => ''` (**:149**). `generateOptions` **:95–121**: `optionCount = level==='svaer' ? 6 : 4`
(**:99** — **no 3-at-Let case yet**); post-PRD-14 W2 the distractor pool filters `w.word[0] !== correctInitial` for
Let/Normal (**:106–107**) — vs the correct word's initial only (not mutual-uniqueness). **W1 build:** (a) first-letter
cue = split `w.word` at :91 into first-letter + rest and carry it in `questionVisual` (needs a shape that renders the
first letter emphasized) OR handle in the engine's word renderer — **silent, styling only, never speak the word**;
(b) `optionCount` → `level==='let' ? 3 : level==='svaer' ? 6 : 4` (:99).

**§A2 — Bogstav Quiz manifest (W2).** `letterWords.ts` `LETTER_WORDS` **:14–45** — 29 entries `{ word }` **(no art-id
column; art resolved by `letterArt(letter)` keyed by the glyph)**. `WORD_LETTERS` (askable) **:51–54** = all 29
**except Q** (28). AlphabetGame picks `WORD_LETTERS` random → `questionVisual: { art: letterArt(letter) }`
(`AlphabetGame.tsx:53–66`, art at **:64**); `speakCorrectFact` "{word} starter med {letter}" **:138–141**.
**Child-name mismatch flags (my audit — owner confirms; each approved swap needs one new baked WebP + re-run
`tts:prebake`/`/audit` since the spoken word changes):**
- **W = 'Wienerbrød'** — a child says "snegl"/"bolle"/"kanelsnegl" (→ S/B/K). Strong mismatch, but Danish has **no
  clean common child-noun for W** → recommend **keep** (accept) or **drop W as a quiz target** (leave display-only,
  remove from `WORD_LETTERS`). Owner's call.
- **Å = 'Å'** — bare glyph; the word "å" = a small stream, which a child calls "vand"/"bæk". Recommend swap **Å → 'Ål'**
  (eel — a clear, child-known picture that genuinely starts with Å). Needs a new `Å`-keyed WebP.
- **X = 'Xylofon'** — a child may say "klokkespil"; mild. Xylofon is a known toy → probably OK; owner's call.
- **D = 'Drage'** — "drage" = both *dragon* and *kite*; the baked picture disambiguates (dragon) → OK, minor.
- All others (Abe/Bil/Cykel/Elefant/Fisk/Giraf/Hund/Is/Jul/Kat/Løve/Mus/Næsehorn/Orm/Panda/Raket/Sol/Tog/Ugle/
  Vulkan/Yoyo/Zebra/Æble/Ørn) read unambiguously — **no change.** So the realistic swap set is **Å (→Ål)** + an owner
  call on **W**; ~0–2 new renders.

**§A3 — Stav Ordet (W3, verify-first).** `SpellingGame.tsx`: prompt (`PromptFocus` + `HeroArt` + repeat) **:454–467**;
**answer-zone `Box` :476–493 already `justifyContent: 'flex-start'` (**:486**), `pt:{xs:1,md:2}` (:488), `gap:{xs:1.5,
md:2.5}` (:489, land `gap:1` :490) — PRD-14 W1 comment at :483–485.** Slots row :497–539 (slot box `{xs:56,sm:64,
md:80}`); tiles tray :546–564 (`maxWidth:560`; tile `{xs:56,sm:64,md:76}`). **W3 = verify the band is gone (likely
skip); if not, tune :488–490 only.**

**§A4 — Sig et Ord (W4).** `SpeakWordGame.tsx`: mic in `promptStage` via `MicHero` (invoked **:581**; `MicHero`
defined **:69–198** — `flexDirection:'column'` mic orb :116–157 then waveform :164–195). Idle instruction is a
SEPARATE body `Typography` **:694–709** (`justifyContent:'center'` body Box :604–614), idle string
`'Hold knappen og sig et ord!'` **:705**. **W4:** move the idle-phase string into the `MicHero` column (a caption slot
under the orb/waveform) so button+label read as one unit; keep the phase strings (recording/processing/retry) logic.

**§A5 — Lær Alfabetet (W5).** `AlphabetLearning.tsx`: bloom = `promptStage` IIFE **:182–262** (`PromptFocus`, subject =
column of giant glyph + [picture + word]). Size levers: glyph `clamp(2.75rem, 15vh, 6.5rem)` **:218**, picture
`height clamp(2.5rem, 9vh, 4rem)` **:235**, word `clamp(1rem, 3.5vh, 1.6rem)` **:249**; column `gap {xs:0.5,md:1}`
:203. Vertical placement owned by `PromptFocus`. **W5:** bump the glyph/picture clamps + center so the bloom fills the
band above the grid (`LearningGrid` :265–271); Q/W/X/Å stay glyph-only (`data`/`art` gating :189–191/:225).

**§A6 — Memory (optional W6).** `UnifiedMemoryGame.tsx`: pairs built with **both cards sharing `content` + a `pairId`**
**:237–259**; match test is `firstCard.content === secondCard.content` **:362–363** (pairId exists but is NOT the match
key — only used to mark matched :370–372). Face built from `config.getDisplayData(card.content)` **:651** (only
`card.content` passed → both faces identical). Face render supports `primary` glyph (**:761–771**) AND `iconArt` image
(**:816–831**) **independently**; `secondary` word label already removed (PRD-14 W5, :842–844). `getDisplayData`
(letters) `MemoryGame.tsx:52–59` returns `{primary: letter, iconArt: letterArt(letter)}`. **W6 (if built):** match by
`pairId` (change :363), give the two cards of a pair **different content/roles** (:239–259), and pass a per-card role
to `getDisplayData` (:651 signature) so one renders the glyph, the other the picture. Real engine change — optional.

---
*End PRD-18 — the final rework group. After this + play-test, the whole games UX & learning rework (PRD-13 backlog)
is complete.*
