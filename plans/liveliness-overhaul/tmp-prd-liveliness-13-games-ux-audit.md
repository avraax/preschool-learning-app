# Games UX & Learning Audit (post-uplift) — findings + prioritized backlog

**Date:** 2026-07-17
**Why:** The Games Visual Uplift (PRD-06→-12) delivered the *material/visual* overhaul comprehensively (tactile
clay, baked art, in-world focal zone, unified HUD, zero emoji). It did **not** deliver the second half of the
owner's mandate — *reorganize elements + lift UX and the learning experience per game*. Only 3 games (Farvejagt,
Ram Farven) got a real structural rework; the other ~21 were excellent re-skins with original layout,
flow, and pedagogy intact. This audit looks at **every current board** and finds what to rework, **learning
experience first, UI/UX second**.
**Method:** all 21 boards captured on the live build (iPad 1180×820) + read against source by 5 section reviewers.
**Target user:** one ~5-year-old boy, iPad, pre-reader; knows all letters; counts ~60–70; adds to 20 on fingers;
basic subtraction. No adaptive difficulty (static, manual). Nothing gates on reading. 44px targets.
*Capture note:* several quiz/hand-rolled boards first rendered blank in headless capture (Vite slow-compile of
`MathOperationGame`/`ComparisonGame` + pre-`gameReady` timing) — all re-captured clean, **0 console errors**. Not
product bugs; a harness-timing artifact (raise the wait for those chunks).

---

## A. Cross-cutting themes (fix once → many games improve — highest leverage)

**A1. [UX, all 5 sections] The shared prompt→answer layout strands tiles at the bottom.** Every `UnifiedQuizGame`
board (and the hand-rolled ones that mirror it) shows the prompt high in the focal zone and pins the answer tiles to
the very bottom third, with a large empty **dead mid-band** on iPad-landscape. Flagged independently by Alphabet,
Math, English, Farver, Ordleg. **One fix in `GameShell`'s promptStage/body split + `PromptFocus` sizing improves ~13
games at once** (tighten vertical rhythm; cap the focal zone; let answers sit closer beneath; enlarge stranded tiles).

**A2. [LEARNING, 4 games] Distractors are too random / below level, so a correct answer doesn't *mean* anything.**
The engine's near-confusable logic exists but isn't the default: Bogstav Quiz (random letters vs a letter-knower),
Læs Ordet (distractors can share the target's initial letter → defeats silent first-sound decoding), Tal Quiz
small-n (far outliers like 13 vs target 3), Hvad Mangler (+10 far option). **Make near/confusable distractors the
default** so wrong options represent real errors, not obvious outliers.

**A3. [LEARNING, ~1 game + 1 browse] "Reinforce the skill on the correct answer" is underused.** Math, Sammenlign,
Hvad Mangler already speak the *completed fact* on correct (great). **Bogstav Quiz** still echoes the bare letter
name — it should speak "Wienerbrød starter med W" via the engine's existing `speakCorrectFact`. **Lær Alfabetet**
speaks only the letter name on tap (dead for a child who knows letters) — it should speak the word/sound association
(the memory game already does "A som Abe"). Both are near-zero-cost, high-value.

**A4. [LEARNING, 4 games] Board length/range outruns his developmental level.** All four **Memory** games default to
**20 pairs (40 cards)** — well beyond a 5yo's working memory; the **10-pair route already exists** and should be the
surfaced default (20 = optional "harder"). **Lær Tal** spans 1–100 (his ceiling ~70) with sub-44px grid tiles.

**A5. [LEARNING/UX, 2 games] Text a pre-reader can't read = clutter, not content.** Memory card faces carry a word
label (unreadable + noise on tiny cards); Sammenlign cards carry "fem fugle / tre bolde" captions. Drop/reduce — the
picture + numeral + audio already carry the lesson.

**A6. [UX, 3 drag games] Faint drop-zones.** Farvejagt well, Ram Farven pot, Nuancer slots are all low-contrast
dashed outlines — "where do I drop?" deserves a higher-contrast, inviting destination across the drag section.

**A7. [LEARNING, 2 games] A pre-reader is asked to select written English text with no way to hear it first.** See §D
— the single biggest *learning defect* found. Cross-listed here because the fix (hear-before-commit on answer tiles)
is an engine-level change.

---

## B. Alphabet

- **Bogstav Quiz** *(HIGH)* — the core sound↔letter game under-teaches: echoes bare letter name (add
  `speakCorrectFact` "{word} starter med {letter}"), and default random distractors sit below a letter-knower (make
  the `CONFUSABLE_GROUPS` bias the Normal default). Audit picture subjects whose child-name ≠ the target word
  (pastry→"snegl" not "wienerbrød"), which makes the picture fight the audio.
- **Lær Alfabetet** *(HIGH, trivial fix)* — tapping a letter speaks only its name → zero new info for him; speak the
  word/sound association instead. Enlarge the small high-floating bloom into the dead band.
- **Hukommelse Bogstaver** *(MED)* — default to 10 pairs; drop the unreadable word label on the tiny faces; optional
  upgrade: a **glyph↔picture** pairing variant so memory also drills letter→word (mechanic unchanged).

## C. Math

- **Plus & Minus Opgaver** *(HIGH — biggest math gap)* — a finger-counter is given **symbol-only, crossing-ten**
  problems with nothing to count. Add an optional **concrete quantity layer** (dot-groups / ten-frame under the
  number sentence; subtraction = cross-out) so he can *solve*, not guess. Range is well-calibrated; only the concrete
  support is missing. Minor: let the equation out-size the answer tiles.
- **Hukommelse Tal** *(HIGH)* — surface the **10-pair** board as default (20 exceeds 5yo working memory).
- **Sammenlign Tal** *(MED)* — enlarge/center the **crocodile** so the >/< "eats the bigger" mnemonic actually reads
  (it's a tiny blob at rest today); drop the unreadable "fem fugle" captions; pull "Hør igen" up to close the band.
- **Lær Tal** *(MED)* — switch to a **10-column** hundreds-chart layout (base-10 pattern becomes visible) and cap the
  range (~1–60) to keep tiles ≥44px tall (they're ~34–40px now).
- **Tal Quiz** *(MED/LOW)* — scale counting objects **up** at low n (they're tiny in a mostly-empty pool); bias
  small-n distractors to ±1/±2. The honest two-mode design is the section highlight — keep conceptually.
- **Hvad Mangler?** *(LOW)* — near-value numeric distractors; otherwise among the best-composed boards.

## D. English

- **Find det Engelske Ord + Dansk til Engelsk** *(HIGHEST learning defect; treat together)* — both ask a confirmed
  pre-reader to tap a **written English word**, and the answer tiles are **silent until the tap commits** — so his
  only strategies are blind guess, rote word-shape memory, or wait for the never-fail pulse. The audio scaffolds the
  *prompt*, never the *choice*. Fix = **hear-before-commit** (first tap auditions the tile's English word, second tap
  commits — or a per-tile speaker), turning an unreadable guess into real auditory matching. Also: the two games are
  **near-duplicates** for this user — differentiate them (e.g. one audio-bridge, one emerging-print) or fold into one.
- **Lyt og Find** *(MED)* — pedagogically the correct game (audio-in → picture-out); only needs UX: a **real
  playback indicator** (equalizer synced to actual audio) and tighter vertical balance.
- **Lær Engelsk** *(MED)* — strongest screen; lighten the 9-chip navigator (icon-forward for a non-reader) and add a
  soft bridge *from* a rough quiz round *into* the matching theme here.

## E. Farver

- **Nuancer** *(HIGH within section)* — worst vertical balance (whole task crammed in the top ~55%, empty lower
  third) + no **spatial** ordering cue; add a soft **light→dark gradient track** under the slots and center the
  cluster.
- **Farvejagt** *(MED-HIGH)* — real drag friction: objects scatter to edges/corners/over the mascot → long diagonal
  drags; constrain the scatter to a reachable band; make the collection **well** a high-contrast "basket"; make
  collected **progress perceptible** (it fills). Keep the excellent instructive wrong-drop echo.
- **Ram Farven** *(MED)* — the reworked goal→pot bench is genuinely good; remaining wins: a **neutral backing disc**
  behind the goal so **pale-tint targets** (lysegul/lyseblå) are perceptible against the pale world; balance the
  5-droplet tray (single row/arc, not a 2+2+1 orphan grid).
- **Lær Farver** *(MED, low stakes)* — pre-teach the **light→dark** direction it will be tested on in Nuancer;
  enlarge the tiny un-grounded example objects; fill the mid dead-zone.
- **Hvilken Farve?** *(LOW)* — already the clearest game; only tighten the object↔swatch spacing; optionally prefer
  mid-tone objects so the dragged object matches the canonical swatch.

## F. Ordleg

- **Læs Ordet** *(HIGH within section)* — constrain distractors so the correct word's **initial letter is unique**
  among options (preserves silent decoding, makes first-sound decoding a *winning* strategy vs a trap); tint/enlarge
  the **first letter** of the prompt as a silent decode cue; drop to 3 options at Let.
- **Stav Ordet** *(MED — layout only)* — pedagogically the strongest game; just pull the slots+tiles block up to kill
  the dead mid-band. No learning change.

---

## G. Prioritized backlog (learning-first)

**HIGH (learning impact for this child):**
1. **English "tap the word" pair** — hear-before-commit on answer tiles + differentiate the two games. *(D)*
2. **Plus & Minus** — add a concrete quantity/ten-frame layer. *(C)*
3. **Læs Ordet** — unique-initial-letter distractors + first-letter cue. *(F)*
4. **Bogstav Quiz** — `speakCorrectFact` + confusable-distractor default. *(B)*
5. **Lær Alfabetet** — speak the word/sound association on tap. *(B)*
6. **Memory ×4** — default to 10 pairs. *(A4)*

**MEDIUM:**
7. **Shared layout dead-band** — tighten `GameShell`/`PromptFocus` vertical rhythm (helps ~13 games). *(A1)*
8. **Sammenlign** — enlarge crocodile + drop captions. **Nuancer** — rebalance + gradient track. **Farvejagt** —
   scatter/well/progress. **Lær Tal** — 10-col + 44px + range cap. **Tal Quiz** — bigger low-n objects + near
   distractors. **Lær Farver** — light→dark pre-teach. **Lær Engelsk** — chip navigator + quiz→browse bridge.
   **Lyt og Find** — real playback indicator.

**LOW (polish):**
9. Stav Ordet layout; Hvad Mangler distractors; Hvilken Farve spacing; Ram Farven
   pale-target backing + tray balance; faint drop-zones shared pass *(A6)*; Memory glyph↔picture variant.

---

## H. What's already good — do NOT touch
Honest counting (Tal Quiz two-mode), spoken completed-fact reinforcement (Math/Sammenlign/Hvad Mangler), the
Ram Farven's goal→pot bench + recipe reveal, Hvilken Farve's single-object clarity, Lyt og
Find's answer-hiding audio-first model, Lær Engelsk's triple-encoded cards, every game's never-fail hint +
non-punishing rounds, gender-correct spoken colour echoes, kidCollision spring-back. And the entire visual/material
uplift (PRD-06→-12) — that layer is done and strong.

---

## I. Proposed next step (turn this into rework PRDs)
This audit is the input; the reworks split cleanly into:
- **PRD-14 — Shared learning+layout engine pass:** A1 (vertical rhythm), A2 (near-distractor defaults across the 4
  quizzes), A3 (`speakCorrectFact`/browse audio), A4 (memory 10-pair default), A5 (drop unreadable text), A6 (drop
  zones), and the English **hear-before-commit** engine change (D). One session, broad payoff, mostly engine-level.
- **PRD-15…N — per-game concrete reworks** (art/mechanic-touching, some art-gated): Plus/Minus ten-frame; Sammenlign
  crocodile; Nuancer gradient track; Farvejagt scatter/well; Lær Tal hundreds-chart; English game differentiation;
  Bogstav Quiz picture-manifest audit. Ordered by the §G backlog, play-tested between.

*Learning-first ordering is deliberate: §G HIGH items change what/whether he learns; MED/LOW improve how it feels.*
