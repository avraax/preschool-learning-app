# Liveliness PRD-14 — Shared Learning + Layout Pass (games UX overhaul, keystone)

**Date:** 2026-07-17
**Part of:** Games UX & Learning rework (findings in `tmp-prd-liveliness-13-games-ux-audit.md`).
**Depends on:** PRD-06→-12 shipped (visual uplift complete — tactile clay, baked art, `PromptFocus`, unified HUD,
zero emoji). This PRD does NOT touch the material layer. It is the **first half** of the per-game UX/learning rework:
the **shared, engine-level** changes that lift many games at once and that the per-game reworks (PRD-15+) build on.
**Owner:** Allan. **Target user:** one ~5-year-old boy, iPad, pre-reader; knows all letters; counts ~60–70; adds to
20 on fingers; basic subtraction. No adaptive difficulty. Nothing gates on reading. 44px targets. Danish copy.

> **Why this is the keystone (per PRD-13 §I):** it changes the shared quiz engine + baseline layout that several
> per-game reworks assume — especially the English **hear-before-commit** mechanic (W7), the **near-distractor
> defaults** (W2), the **reinforce-on-correct** audio (W3), and the **vertical rhythm** baseline (W1). Doing it first
> avoids per-game PRDs re-spacing boards on a baseline that then shifts, and avoids multiple PRDs editing
> `GameShell`/`UnifiedQuizGame` in parallel. Implement this, play-test, then author PRD-15+.

> **LEARNING FIRST.** Every workstream states its learning rationale. Where a change is UX-only it says so. If a
> change would help visuals but risk clarity/pedagogy for a pre-reader, the learning goal wins.

---

## 1. Scope (7 workstreams, from the audit's cross-cutting themes)

| WS | Theme | Priority | Kind |
|---|---|---|---|
| **W1** | Shared prompt→answer **vertical rhythm** (kill the dead mid-band; un-strand bottom tiles) | MED | UX, engine — helps ~13 games |
| **W2** | **Near/confusable distractors as default** (Bogstav Quiz, Læs Ordet, Tal Quiz small-n, Hvad Mangler) | HIGH | LEARNING, per-config |
| **W3** | **Reinforce the skill on a correct answer** (Bogstav Quiz `speakCorrectFact`; Lær Alfabetet speak word/sound) | HIGH | LEARNING |
| **W4** | **Memory defaults to 10 pairs** (all 4 memory games; 20 = optional "harder") | HIGH | LEARNING, surfacing |
| **W5** | **Drop unreadable text** (memory card word label; Sammenlign "{n} {word}" caption) | MED | LEARNING/UX |
| **W6** | **Inviting drop-zones** (Farvejagt well, Ram Farven pot, Nuancer slots → higher-contrast destinations) | MED | UX |
| **W7** | **English hear-before-commit** engine flag (audition an answer tile before choosing) | HIGH | LEARNING, engine |

Out of scope (→ PRD-15+, per-game/art-touching): Plus/Minus ten-frame, Sammenlign crocodile enlarge, Nuancer
gradient track, Farvejagt scatter constraints, Lær Tal hundreds-chart, English game differentiation, Bogstav Quiz
picture-manifest audit, Lyt og Find playback indicator, Lær Engelsk chip navigator.

## 2. Guardrails
iPad-first no-scroll; 44px targets; Danish; token-driven (all 4 skins + flat); reduced-motion (motion off, audio +
feedback kept); **no new spoken narration** except W3's Bogstav Quiz fact + Lær Alfabetet association — both reuse
**existing** phrase patterns already in the prebaked set (letter names + `LETTER_WORDS`), but **verify** the exact
strings are prebaked/auditioned (run `npm run audit:check`; if a new closed-set string appears, `npm run tts:prebake`
+ `/audit` before shipping). Honor `.claude/rules/` (game-development advance-lock/first-try/timer hygiene;
drag-and-drop kidCollision/spring-back for W6). **No adaptive difficulty.** Preserve every existing invariant
(Læs Ordet never reads the prompt word; Sig et Ord untouched; Tal Quiz honest counting; kidCollision).

## 3. Workstream design

### W1 — Shared vertical rhythm (UX; ~13 games)
**Problem (PRD-13 §A1, all 5 sections):** on iPad-landscape the prompt sits high, answer tiles are pinned to the
bottom third, and a large empty **dead mid-band** sits between. `GameShell`'s promptStage/body split + `PromptFocus`
sizing produce this.
**Change:** tighten the split so the focal zone and the answer zone read as one connected column:
- In `GameShell` (the `promptStage`-present branch — Appendix §A1): reduce the focal zone's flex share and/or add a
  `maxHeight`/`justify` so it doesn't float high; bias the body so answers rise toward vertical center rather than
  the bottom edge. Keep the anti-void intent (no game floats in emptiness) — this is re-balancing, not removing the
  3-zone structure.
- In `PromptFocus` (Appendix §A2): cap the subject's vertical footprint / center it so the prompt sits closer to the
  answers.
- Verify per game (they inherit): quizzes (alphabet/math/english/ordleg configs), hand-rolled that render `PromptFocus`
  (MathOperation, Comparison, Nuancer, Spelling, SpeakWord), and Lær browses.
**No learning change** — purely composition. Preserve phone-landscape (30/70) behavior; re-verify 844×390.
**Verify:** screenshot 5–6 representative boards on iPad + phone; the empty mid-band is gone, tiles no longer hug the
bottom edge, nothing scrolls, 44px held.

### W2 — Near/confusable distractors as default (LEARNING)
**Problem (PRD-13 §A2):** distractors are often random outliers, so a correct tap doesn't require the actual skill.
Fix each config's `generateOptions` (Appendix §A4) so the **default** (Normal) uses near/confusable distractors:
- **Bogstav Quiz** (`AlphabetGame.tsx`): make the `CONFUSABLE_GROUPS` bias the **Normal** default (today only Svær
  uses it; Normal is random). Keep Let easier (exclude confusables), Svær hardest.
- **Læs Ordet** (`LaesOrdetGame.tsx`): constrain distractor pictures so the correct word's **initial letter is
  unique** among the options (at Let/Normal) — this preserves silent decoding but makes first-sound decoding a
  *winning* strategy instead of a trap. (Do NOT read the word — invariant.)
- **Tal Quiz** small-n (`MathGame.tsx`): bias small-count distractors to **±1/±2** (the digit-swap/±10 logic only
  engages at n≥10 today, so small counts get random top-ups like 13 vs 3). Fall back to random only if needed.
- **Hvad Mangler?** (`HvadManglerGame.tsx`): prefer **near-value** numeric distractors (±1/±2/±one-step) over +10.
**Guardrail:** still return the correct answer + `shuffle()` (non-biased); never fewer than the current option
count; no mechanic/round change. These are content-generation tweaks only.
**Verify:** drive each quiz with `?seed=` (probe a few) and inspect option sets: the correct answer's competitors are
plausibly confusable, not obvious outliers; Læs Ordet options never share the target's first letter at Let/Normal.

### W3 — Reinforce the skill on a correct answer (LEARNING)
**Problem (PRD-13 §A3):**
- **Bogstav Quiz** echoes the bare letter name on correct. Add `speakCorrectFact(item)` (the engine already supports
  it — used by math/Hvad Mangler) that speaks **"{word} starter med {bogstav}"** (e.g. "Wienerbrød starter med W").
  Config change only (Appendix §A5).
- **Lær Alfabetet** speaks only the letter name on tap → zero new info for a letter-knower. In `goToLetter`
  (Appendix §A6), when `LETTER_WORDS[letter]` exists, speak the **association** ("{bogstav} som {word}" — the exact
  string the memory game already uses via `speakMatchedItem`), else keep name-only (Q/W/X/Å).
**Audio guardrail:** both strings are built from existing closed-set content (letter names + `LETTER_WORDS`), but run
`npm run audit:check`; if "{word} starter med {letter}" is a NEW closed-set phrase, `npm run tts:prebake` + `/audit`
it before shipping (call it out — don't add silently). "{letter} som {word}" already ships (memory uses it).
**Verify:** correct tap in Bogstav Quiz speaks the fact (capture the `/api/tts-azure` text via the screenshot skill's
fetch-hook recipe); Lær Alfabetet tap speaks "A som Abe" not just "A".

### W4 — Memory defaults to 10 pairs (LEARNING, surfacing)
**Problem (PRD-13 §A4):** all four memory games default to **20 pairs (40 cards)** — beyond a 5yo's working memory;
the **10-pair route already exists**. Make 10 the primary/surfaced board; keep 20 as an explicit optional "harder".
**Change (Appendix §A7):** in the section menus (`categoryThemes.ts` memory entries) surface the **/10** route as the
primary memory tile (and, if both are shown, order 10 before 20 / label 20 as the harder one); update the size-less
default redirect (`App.tsx`) + `MemoryGame.tsx` default from 20 → **10**. No engine/mechanic change — purely which
static route is primary. Confirm with owner whether to keep the 20-pair tile at all or hide it.
**Verify:** the alphabet + math menus' primary memory tile opens a 10-pair board; a size-less bookmark → 10.

### W5 — Drop unreadable text (LEARNING/UX)
**Problem (PRD-13 §A5):** text a pre-reader can't read is noise.
- **Memory card faces** (`UnifiedMemoryGame.tsx`, Appendix §A8): drop the `displayData.secondary` (word) label on the
  face — keep the glyph (+ baked picture/count-cluster). It's unreadable and clutters the small card. (Keep speaking
  the word on match — audio is fine; it's the on-card *text* that's noise.)
- **Sammenlign** (`ComparisonGame.tsx`, Appendix §A8): drop the "{n} {word}" caption ("fem fugle") on the side cards
  — the pile + numeral + spoken fact already carry it. Keep the numeral.
**Verify:** memory faces show glyph (+picture), no word text; Sammenlign cards show pile + numeral, no caption; both
still speak on match/correct.

### W6 — Inviting drop-zones (UX; drag games)
**Problem (PRD-13 §A6):** Farvejagt well, Ram Farven pot, Nuancer slots are faint low-contrast dashed outlines — a
5yo's every drag aims at something barely visible.
**Change (Appendix §A9):** give each drop destination a **higher-contrast, inviting** treatment — raise fill
opacity/contrast, a clearer "basket/pot/slot" read, keep the existing pulse/affordance. Token-driven; works on all
skins (test on dark `space`). **Do NOT change any dnd mechanic** — `kidCollision`, spring-back, advance-guard,
`MeasuringStrategy.Always` (Nuancer) all stay exactly as-is; this is styling only.
**Verify:** run the dnd **abort probe + positive control** (per drag-and-drop rules) on each game after the style
change to prove drops still land and abortive drags still spring back; visually the destination is obvious on all 4
skins.

### W7 — English hear-before-commit (LEARNING; engine) — the flagship
**Problem (PRD-13 §D):** Find det Engelske Ord + Dansk til Engelsk ask a **pre-reader** to tap a **written English
word**, and answer tiles are **silent until the tap commits** — so he can only guess or wait for the never-fail
pulse. He needs to **hear a tile before choosing**.
**Change:** add an opt-in `previewBeforeCommit?: boolean` to `UnifiedQuizConfig`; enable it for `english.word` +
`english.translate` only (NOT Lyt og Find — its answers are pictures and already echo; NOT the glyph quizzes — he can
read letters/numbers). In `handleItemClick` (Appendix §A3), when the flag is on:
- **First tap on a tile → AUDITION:** speak that tile's English word (`speakClickedItem`), mark it visibly
  **selected/lifted** (reuse a tactile "raised" state — NOT the correct/wrong feedback colors). **No scoring, no
  advance-lock, no first-try break, no hint-counter increment.**
- **Second tap on the SAME selected tile → COMMIT:** run the existing correct/wrong path (score, first-try, hint,
  advance-lock, `speakCorrectFact`/echo).
- **Tap a DIFFERENT tile → re-audition that one** (move the selection; previous tile deselects).
- **Preserve every invariant:** the `isAdvancing` ref still guards commit; first-try only breaks on a committed
  wrong; `hintAfterNWrong` counts committed wrongs only; single audio channel (a new audition cancels prior audio);
  reduced-motion → no lift animation but audio + selected outline still apply.
**Interaction-clarity risk (flag for play-test):** "tap once to hear, tap again to choose" can cause accidental
commits for a 5yo. Mitigation shipped: the selected tile gets a clear raised/outlined state so the second tap reads
as "confirm this one." **Fallback if play-test shows confusion:** a small per-tile speaker badge (tap badge =
audition, tap tile body = commit) — more UI on small tiles; implement only if the two-tap model tests poorly.
Document the choice.
**Verify:** in english.word/translate, first tap on a tile speaks its English word and does NOT advance or score
(snapshot `bornelaering-progress` before/after → unchanged); second tap on the same tile commits and records; a wrong
committed tap still breaks first-try and arms the hint; Lyt og Find + all non-English quizzes are byte-identical
(flag absent). Capture the `/api/tts-azure` text to prove the audition speaks the tile word pre-commit.

## 4. Danish copy
- W3 Bogstav Quiz: **"{ord} starter med {bogstav}"** (e.g. "Wienerbrød starter med W"). W3 Lær Alfabetet:
  **"{bogstav} som {ord}"** (e.g. "A som Abe" — already shipped). No other new strings. Everything else reuses
  existing content.

## 5. Files to touch
`src/components/common/GameShell.tsx` (W1), `src/components/common/PromptFocus.tsx` (W1),
`src/components/common/UnifiedQuizGame.tsx` (W7 `handleItemClick` + `UnifiedQuizConfig` flag; W1 nothing),
`src/components/alphabet/AlphabetGame.tsx` (W2 distractors + W3 `speakCorrectFact`),
`src/components/alphabet/AlphabetLearning.tsx` (W3 `goToLetter`),
`src/components/math/MathGame.tsx` (W2 small-n distractors), `src/components/math/HvadManglerGame.tsx` (W2),
`src/components/ordleg/LaesOrdetGame.tsx` (W2 unique-initial-letter),
`src/components/learning/MemoryGame.tsx` + `src/App.tsx` + `src/config/categoryThemes.ts` (W4 default 10),
`src/components/common/UnifiedMemoryGame.tsx` (W5 drop word label),
`src/components/math/ComparisonGame.tsx` (W5 drop caption),
`src/components/farver/{FarvejagtGame,RamFarvenGame,NuancerGame}.tsx` (W6 drop-zones),
`src/components/english/{EnglishWordGame,EnglishTranslateGame}.tsx` (W7 set `previewBeforeCommit: true`).
**Reuse:** existing `speakCorrectFact` support, `shuffle()`, `CONFUSABLE_GROUPS`, `useNeverFailHint`, dnd primitives,
tactile depth helpers, `getCategoryTheme`.

## 6. Verification (end-to-end)
- `npm run build` + `npm run lint` clean; `npm run audit:check` (W3 audio).
- Drive on iPad + phone viewports with `ui-screenshot`: W1 mid-band gone across ≥6 boards; W6 dnd abort+positive
  probes pass on all 3 drag games (all 4 skins); W7 audition-then-commit proven via progress-snapshot + TTS-text
  capture; W2 option sets inspected via `?seed=`; W3 TTS text = the fact/association; W4 primary memory tile = 10;
  W5 no word text on memory faces / Sammenlign cards. Reduced-motion + 0 console errors.
- **Then play-test with the son** — especially W7's two-tap model (watch for accidental commits) and W2 difficulty.

## Appendix A — verbatim current signatures / anchors
*(Current tree, branch `feat/games-uplift-alphabet`. Open each file at the anchor; snippets condensed to the
load-bearing lines.)*

**§A1 — GameShell vertical split (W1).** `GameShell.tsx` promptStage-present branch **:182–200**. Prompt zone
`flex: phoneLandscape ? '30 1 0' : '40 1 0'` (**:188**), `mb: {xs:1, md:1.5}` (**:191**); body zone
`flex: phoneLandscape ? '70 1 0' : '60 1 0'` (**:197**). Container `py: dense ? {xs:1,md:2} : {xs:2,md:3}`
(**:144**); title-row `mb: promptStage ? {xs:1,md:1.5} : …` (**:155**). *W1 tuning:* lower the 40→~34 prompt share
and/or cap the focal zone so answers rise toward center; keep the 30/70 phone variant; preserve the else-branch
(centred grid) for learning/memory.

**§A2 — PromptFocus (W1).** `PromptFocus.tsx` full component **:22–167** (props **:22–31**). No intrinsic height —
root `Box height:'100%'`, `justifyContent:'center'` (**:44–52**); subject zone `flex:1, minHeight:0` (**:60–61**);
repeat pill `flex:'0 0 auto'` (**:162**). It fills GameShell's 40%/30% slot, so **W1's main lever is §A1's flex
share**; optionally cap the subject zone's max size here so it doesn't dominate.

**§A3 — UnifiedQuizGame commit + config (W7).** `handleItemClick` **:375–471**. Order: guard `isAdvancingRef`
(**:383**) → `updateUserInteraction`/`cancelCurrentAudio` → `sfx.play('tap')` (**:398**) → `isCorrect` → set lock on
correct (**:400**) → `setFeedback`/`setGuideReaction` → `await speakCorrectFact||speakClickedItem` (**:427–431**) →
mount guard (**:436**) → correct: `incrementScore`+`celebrateTier('micro')` / wrong: `firstAttemptRef=false`
(**:437**)+`sfx('wrong')`+`registerHintWrong()` (**:442**) → advance `setTimeout` (**:447+**). Refs:
`isAdvancingRef` decl **:197**, `firstAttemptRef` broken **:437**, hint threshold `config.hintAfterNWrong ?? Infinity`
**:183**. Answer-tile render **:712–770** (`item.art ? <TileArt> : item.node ? node : <Typography>`; `AnswerTile
state=tileStateFor hint=tileHintFor disabled=isAdvancingRef.current`). `UnifiedQuizConfig` **:82–141** (add
`previewBeforeCommit?: boolean` beside `hintAfterNWrong`). `QuizItem` **:59–79**.
> **W7 build note:** gate the audition on `config.previewBeforeCommit`. Add a `previewValue` state; first tap on a
> tile whose value ≠ previewValue → set previewValue + `speakClickedItem` + a "selected/lifted" visual, and
> **return before** the lock/score/feedback/hint block. Tap on the already-previewed tile → fall through to the
> existing commit path unchanged. Leave `isAdvancingRef`, `firstAttemptRef`, `registerHintWrong` exactly as-is (they
> only run on commit). Clear previewValue in per-question setup.

**§A4 — generateOptions (W2).** **AlphabetGame.tsx :68–112** — `level = progressStore.difficultyFor('alphabet')`
(**:76**); Normal branch is **fully random** (**:78–89**) ← make it use `confusablesFor(correctLetter)` like the
Svær seed (**:96–98**). **MathGame.tsx :143–163** — `confusables=[swapDigits(n),n±1,n±10]` (**:146**) engage only where
valid; small-n top-up is random (**:157–160**) ← bias small-n to ±1/±2 before random. **LaesOrdetGame.tsx :95–108** —
distractors are random `shuffle(READING_WORDS)` (**:103–107**) ← filter so no option shares the correct word's
initial letter (Let/Normal); `optionCount` 6/4 (**:99**). **HvadManglerGame.tsx :188–212** — numeric candidates
`[base-2,-1,+1,+2,+5,+10]` (**:194**) ← drop `+5/+10` (prefer ±1/±2) ; pattern branch uses `PATTERN_TOKENS` (fine).

**§A5 — Bogstav Quiz audio (W3).** `AlphabetGame.tsx :136–146` has only `speakQuizPrompt`/`speakClickedItem`
(`audio.speakLetter`)/`getRepeatAudio` — **no `speakCorrectFact`**. Add
`speakCorrectFact: async (item, audio) => audio.speak(`${LETTER_WORDS[item.value].word} starter med ${item.value}`)`
(guard letters without a `LETTER_WORDS` entry → fall back to `speakLetter`). `generateQuizItem` (**:53–66**) already
has `word`.

**§A6 — Lær Alfabetet audio (W3).** `AlphabetLearning.tsx` `goToLetter` **:103–127** speaks `audio.speakLetter(letter)`
(**:120**). `LETTER_WORDS` imported **:14**, read in render at **:184** (not in `goToLetter`). *W3:* in `goToLetter`,
`const d = LETTER_WORDS[letter]; await d ? audio.speak(`${letter} som ${d.word}`) : audio.speakLetter(letter)` (the
`"{letter} som {word}"` string already ships via the memory game).

**§A7 — Memory default 10 (W4).** `MemoryGame.tsx :26–35` — `boardPairs = size === '10' ? 10 : 20` (**:30**) ←
default the size-less/invalid case to **10** (`size === '20' ? 20 : 10`), and update the star-threshold comment.
`App.tsx :294–297` — size-less route renders `MemoryGame` directly (defaults via §A7 change). `categoryThemes.ts`
memory tiles: letters **:64–77** (`memory10`→/letters/10, `memory20`→/letters/20), numbers **:126–139**
(→/numbers/10, /20). *W4:* surface `memory10` as the primary tile (order it first / keep `memory20` as the optional
"harder"; owner confirms whether to keep the 20 tile).

**§A8 — Drop unreadable text (W5).** `UnifiedMemoryGame.tsx :840–854` renders `displayData.secondary` (word) — remove
this block (keep glyph + picture/cluster; `secondary` field decl **:71**, populated `MemoryGame.tsx :54`).
`ComparisonGame.tsx :472–474` renders `{DANISH_NUMBERS[num]} {obj.danishName}` caption beneath the numeral — remove
it (keep the numeral **:459–471**).

**§A9 — Drop-zones (W6, styling only — do NOT touch dnd).** `FarvejagtGame.tsx :600–616` well: `border:4px dashed
${targetHex}`, `backgroundColor:${targetHex}1A` (10%) + halo **:580–593**. `RamFarvenGame.tsx :665–683` pot: empty
`potFill='rgba(255,255,255,0.4)'` (**:469**), `border:4px dashed`. `NuancerGame.tsx :377–393` slot: empty
`backgroundColor:'rgba(255,255,255,0.45)'`, `border:3px dashed`, `boxShadow:'none'`. *W6:* raise fill contrast + a
clearer basket/pot/slot read (token-driven; test on `space`); keep `overColor`, pulse, and all `DroppableZone`/
`kidCollision`/`MeasuringStrategy.Always` wiring unchanged. Verify with abort + positive dnd probes.

---
*End PRD-14. Implement all 7 workstreams (W7 is the flagship), verify, play-test, then author PRD-15+ per the
`tmp-prd-liveliness-13-games-ux-audit.md` §G backlog.*
