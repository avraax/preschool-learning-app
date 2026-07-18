# Liveliness PRD-16 — Farver games rework (per-game UX + learning)

**Date:** 2026-07-17
**Part of:** Games UX & Learning rework (findings: `tmp-prd-liveliness-13-games-ux-audit.md` §E; shared keystone:
`-14`; pattern: `-15`).
**Depends on:** **PRD-14 + PRD-15 merged** (both in `master`). Builds on PRD-14's W6 drop-zone contrast (Farvejagt
well, Ram Farven pot, Nuancer slots already higher-contrast — **do NOT redo that**) and W1 vertical rhythm.
**Owner:** Allan. **Target user:** ~5-year-old boy, iPad, pre-reader; 5yo motor control (short/reachable drags).
No adaptive difficulty. 44px targets. Danish copy.
**Art:** **none needed** — CSS gradient track, a backing disc, layout/tray balance, and scatter math. **Zero Gemini.**

> Second grouped per-game rework (audit §I): the **Farver** section = Lær Farver, Farvejagt, Hvilken Farve?, Ram
> Farven, Nuancer. All five are **hand-rolled @dnd-kit drag games** except Lær Farver (browse) — so every change
> here MUST honor `.claude/rules/drag-and-drop.md`. **Learning first**, then UX.

> **DRAG SAFETY (load-bearing):** do NOT touch any collision/commit logic. Keep `kidCollision` (never
> `closestCenter`), spring-back on `!over`/wrong, the advance-guard refs, `MeasuringStrategy.Always` (Nuancer's
> floating slots), `sx`-not-raw-`style`, non-mutating `shuffle()`, and the null-seeded anti-repeat. Everything below
> is **layout / styling / position-math only.** After any change, run the dnd **abort + positive-control** probes.

---

## 1. Scope (5 workstreams)

| WS | Game | Change | Priority |
|---|---|---|---|
| **W1** | **Nuancer** | **light→dark gradient track** under the slots (spatial ordering cue) + center the cluster | HIGH (in section) |
| **W2** | **Farvejagt** | **constrain the scatter** to a reachable band (exclude edges + the mascot corner) + **perceptible progress** (well visibly fills) | MED-HIGH |
| **W3** | **Ram Farven** | **neutral backing disc** behind the goal swatch (pale-tint targets perceptible) + **balance the droplet tray** | MED |
| **W4** | **Lær Farver** | pre-teach **light→dark** (reuse the sun→moon cue) + **enlarge the tiny example objects** | MED |
| **W5** | **Hvilken Farve?** | tighten the object↔swatch cluster spacing (minor) | LOW |

Already handled by PRD-14 (do NOT redo): drop-zone contrast on all three drop targets (W6), the shared vertical-rhythm
baseline (W1). Educational colour content stays data (untouched).

## 2. Guardrails
iPad-first no-scroll; 44px; Danish; token-driven (all 4 skins + flat; test dark `space`); reduced-motion (motion off,
layout + audio kept); no adaptivity; **educational colour hexes stay data** (`colorContent.ts` untouched for content);
gender-correct spoken echoes unchanged. **Drag rules above are mandatory.** No new narration.

## 3. Workstream design

### W1 — Nuancer: light→dark gradient track + centered cluster (LEARNING, flagship)
**Problem (PRD-13 §E):** the ordering rule (left = lightest → right = darkest) is carried ONLY by the sun/moon hint
text + the slot sequence; three identical dashed boxes don't themselves communicate a gradient, so a pre-reader has
no *spatial* model of the ordering. (PRD-14 W1 helped the top-loading; confirm whether the cluster still floats high.)
**Change:**
- Add a soft **light→dark gradient baseline/track under the slot row** — a low, wide strip fading light→dark
  left→right (token-driven; a neutral or accent-tinted gradient). It makes the ordering rule *visible*: the slots sit
  on a ramp from light to dark, so "lightest goes on the light end" is spatial, not just spoken.
- Keep the existing **sun ☀ (left) → moon ☾ (right)** direction hint (it's a good language-light cue) — the track
  reinforces it.
- Ensure the slot row + tray read as one **centered** unit (if PRD-14's rhythm pass left Nuancer still top-heavy,
  center the cluster; the slots live in `PromptFocus`, the tray below — see Appendix).
- Pure CSS; reduced-motion static. Do NOT change slot count/difficulty (2 let / 3 normal / 3+decoy svær) or the
  `DroppableZone`/`MeasuringStrategy.Always` wiring.
**Learning check:** with the track, confirm the light→dark direction is obvious *without* reading; the track must not
reduce the slot drop-target size below 44px or fight the placed-shade fill.
**Verify:** the track reads light→dark under the slots on all 4 skins; sun/moon hint intact; dnd abort+positive probes
pass; reduced-motion static.

### W2 — Farvejagt: reachable scatter + perceptible progress (UX/LEARNING)
**Problem (PRD-13 §E):** objects scatter across the whole viewport (edges, corners, over the bottom-left mascot), so
many targets need a **long diagonal drag** into the center well — hard for 5yo motor control — and some land at the
extreme edges (hard to grab). Progress is imperceptible (tiny low-contrast perimeter pips).
**Change (position + indicator only — NOT collision):**
- **Constrain the scatter band:** clamp object x/y so nothing lands in the screen-edge margins or the mascot corner
  (e.g. keep within ~18–82% and clear of the bottom-left) — shrinking max drag distance and keeping every object
  grabbable. Keep the existing **center-avoiding + non-overlapping + null-seeded anti-repeat** seed logic — just
  tighten its bounds (see Appendix for the current range).
- **Make progress perceptible:** the collection **well visibly fills** as objects land (or enlarge the pips), so the
  child feels the hunt shrinking. (The well already got higher contrast in PRD-14 W6 — build on that.)
- Do NOT change `kidCollision`, spring-back, the correct-drop snap-into-ring, or the instructive wrong-drop echo
  ("auberginen er lilla" — keep it).
**Learning check:** shorter drags + a filling well support motor skills + goal clarity; the categorization lesson
(which things are red) is unchanged.
**Verify:** no object spawns in the edge margins or over the mascot across several rounds; the well visibly fills;
dnd abort+positive probes pass; wrong-drop echo intact.

### W3 — Ram Farven: perceptible pale targets + balanced tray (UX)
**Problem (PRD-13 §E):** for pale-tint targets (lysegul, lyseblå) the goal swatch is near-white against the pale
cloud/sky world → the child can't perceive the color they're aiming for (nor distinguish the pale goal from the white
droplet). And the 5-droplet tray is a 2-column grid with an orphan (2+2+1), reading untidy next to the tidy goal→pot
pair.
**Change:**
- Put a **neutral backing disc** (soft white/grey ring or a subtle checker/contrast plate) behind the **goal swatch**
  so pale tints read as a distinct color against the world. (The reworked goal→arrow→pot bench + recipe reveal stay.)
- Give the **droplet tray a balanced arrangement** — the **portrait** tray is already a single row of 5 (fine); the
  **landscape** tray (the primary iPad surface) is `repeat(2, 1fr)` → a 2+2+1 orphan. Fix the **landscape** case to a
  single row of 5 (or a centered arc) so the 5 sources read as one palette. Keep the droplets' clay look + drag.
- Do NOT change mixing mechanics (`commitMix`/difficulty-gated target pool/no-spoken-wrong/Tøm) or the pot (PRD-14 W6).
**Verify:** a lysegul/lyseblå target is clearly perceptible against the light world; tray is balanced; mixing +
recipe reveal + Tøm unchanged; dnd probes pass.

### W4 — Lær Farver: pre-teach light→dark + enlarge examples (LEARNING/UX, low stakes)
**Problem (PRD-13 §E):** the shade trio's light→dark meaning is never made explicit here, yet Nuancer *tests* it —
this browse is the natural place to pre-teach it. Also the 4 example objects are tiny (~44–54px), un-grounded, and
read as decoration rather than tappable content.
**Change:**
- Add the same **sun→moon "lys → mørk"** cue (from Nuancer / W1) to the shade trio so the browse pre-teaches the
  ordering direction Nuancer relies on — continuity across the section.
- **Enlarge the example objects** (~64px) and ground them (contact shadow), with a one-time gentle idle-pulse on
  first mount to signal they're tappable. Keep tap-to-hear + gender echo + browse XP.
- Fill any remaining vertical dead-zone (build on PRD-14 W1).
**Verify:** the light→dark cue is present on the shade trio; example objects are larger + read as tappable; tap still
speaks with gender-correct echo.

### W5 — Hvilken Farve?: tighten the cluster (LOW, UX)
**Problem (PRD-13 §E):** already the clearest game; only a gap between "Hør igen", the dragged object, and the swatch
row spreads the pieces out and lengthens the drag.
**Change:** pull the object + swatch row into a **tighter centered cluster** (shorter drag, clearer pairing).
Optional (low): prefer the **mid-tone** member of a hue for the dragged object so it matches the canonical swatch
most closely (removes the dark-object-over-bright-swatch mismatch). Do NOT change difficulty option counts or dnd.
**Verify:** object + swatches read as one group; drag is shorter; dnd probes pass.

## 4. Danish copy
**None new.** All spoken content reused.

## 5. Files to touch
- `src/components/farver/NuancerGame.tsx` (W1)
- `src/components/farver/FarvejagtGame.tsx` (W2)
- `src/components/farver/RamFarvenGame.tsx` (W3)
- `src/components/farver/FarverLearning.tsx` (W4)
- `src/components/farver/FarveQuizGame.tsx` (W5)
**Reuse:** the sun→moon cue (from Nuancer), tactile depth helpers (`softShadow`/`contactShadow`), `getCategoryTheme('colors')`,
the `src/components/common/dnd/` primitives, `shuffle()`, `COLOR_SWATCH`/`colorContent` (read-only).

## 6. Verification (end-to-end)
- `npm run build` + `npm run lint` clean.
- `ui-screenshot`, iPad + phone, all 4 skins (incl. dark `space`): W1 gradient track reads light→dark; W2 no
  edge/mascot spawns + well fills; W3 pale target perceptible + balanced tray; W4 light→dark cue + larger examples;
  W5 tighter cluster. Reduced-motion + 0 console errors.
- **dnd probes (mandatory, per drag-and-drop rules):** run the **abort probe** (release in empty space → nothing
  scored, springs back) AND the **positive control** (drop on target → lands) for **Nuancer, Farvejagt, Hvilken
  Farve?, and Ram Farven** after the changes — proving collision/spring-back still work.
- **Then play-test** — especially W1 (does the gradient track make ordering click?) and W2 drag reachability.

## Appendix A — verbatim current signatures / anchors (current `master`, post-PRD-14/-15)

**§A1 — Nuancer (W1).** `NuancerGame.tsx` `promptStageContent` **:344–444**: the vertical stack `Box`
(`flexDirection:'column'`, **:351**) holds the **slot row `Box` :352–420** then the **sun/moon hint `Box` :422–440**
(text literally `lys → mørk` at ~:435, flanked by lucide `<Sun>` amber `#F59E0B` / `<Moon>` slate; `Sun,Moon` imported
**:4**). **W1 insert:** add the gradient-track `Box` as a **new sibling between the slot row (ends :420) and the hint
(:425)**, or an absolutely-positioned layer behind the slot row (:353). Slot `DroppableZone` sx **:377–398**
(post-PRD-14: empty = `4px dashed`, bg `rgba(255,255,255,0.72)`, `boxShadow 'inset 0 4px 10px rgba(0,0,0,0.16)'` —
don't undo). Tray **:500–551** (`alignItems:'flex-start'`, `pt`). `tileSx` (slot+tile geometry) **:312–318** (66/76/88;
land 60; phone 44; `borderRadius:'16px'`). Keep `MeasuringStrategy.Always`, `DraggableItem inline`.

**§A2 — Farvejagt (W2).** `FarvejagtGame.tsx` `generateRandomPositions` **:138–166** — scatter is
`Math.random()*80+10` → **10–90%** x & y (**:150–151**); center-avoid radius 25 around (50,50) (**:141**); min-dist
9/12, 80 attempts; **plain `Math.random()`, no mascot exclusion**. **W2:** tighten the range (e.g. ~18–82%) AND add a
**bottom-left exclusion** (the GameShell corner mascot lives there — no in-board mascot element; guide via
`guideReaction` prop **:479**) — e.g. reject positions with low-x & high-y. Positions consumed **:211/:224–225**;
anti-repeat is on the **target colour** (`selectRandomTarget` **:168–176**), not position. Progress: perimeter
**pips :625–652** (14px each, one per target, `lit = slot < collectedCount`) + the collected **ring :654–710**; well
`DroppableZone` **:595–623** already high-contrast basket (PRD-14 W6 — `5px dashed`, `${targetHex}40`, inset shadow —
keep). Header `ColorProgressChip total={ROUND_BOARDS=5}` **:480–486**. **W2 progress:** enlarge the pips and/or make
the well visibly fill; don't touch `kidCollision`/snap/wrong-echo.

**§A3 — Ram Farven (W3).** `RamFarvenGame.tsx` goal swatch **:578–627**: already has a light-pool disc **:588–593** +
`4px solid white` + contact shadow; "Mål" chip **:610–624**; `circleSizeSx` **:482–489**. **W3 backing disc:** insert
a **neutral disc** between the light-pool (:593) and the swatch `Box` (:594) — only needed for pale targets in
`possibleTargets` **:82–95** (`lyserød #FFB3BA`, `lyseblå #BFDBFE`, `lysegul #FEF9C3`, `grå #9CA3AF`). Droplet tray
**:816–897**: portrait `gridTemplateColumns:'repeat(5,1fr)'` **:821** (single row — fine); **landscape override
`repeat(2,1fr)` :831** (the 2+2+1 orphan — **fix this to a single row / arc**). Droplet size xs54→lg74; `primaryColors`
(rød/blå/gul/hvid/sort) **:74–80**. Keep mixing mechanics + pot (PRD-14 W6, `potFill` :471–475).

**§A4 — Lær Farver (W4).** `FarverLearning.tsx` shade trio **:140–179** (`alignItems:'flex-end'`; middle `i===1` big);
**NO lucide import / no light→dark cue today**. Example objects row **:181–202** (size `{xs:44, md:54}`, phone 38 —
**tiny**; `ObjectArt size="100%"`; ≤4 examples). Column stack (where a full-width cue row slots) **:111–121**; hue
headline **:126–138**. **W4:** import lucide `Sun,Moon` (like Nuancer) + add the `lys → mørk` cue near the trio;
enlarge examples to ~64 + a one-time idle-pulse. Keep `tapSpeak` gender echo + browse XP.

**§A5 — Hvilken Farve? (W5).** `FarveQuizGame.tsx` dragged-object container **:324–368** — the gap to the swatch row
is its `mb:{xs:1.5, md:2.5}` / landscape `mb:1` (**:330/:332**); object size xs92/md112/land80. Swatch row grid
**:371–384** (`gap:{xs:1.5,md:2}`, `maxWidth:640`); swatch tiles **:385–470** (xs100/md128/land92). Repeat button
above **:320–322**. **W5:** reduce the object `mb` (:330/:332) to tighten the object↔swatch cluster; don't change the
`options.length`-driven column count or dnd.

**Cross-file (PRD-14 W6 baselines — build on, don't redo):** Nuancer slot zone :377–398, Farvejagt `target-zone`
:600–622, RamFarven `mixing-zone`/`potFill` :471–475 + :671–689 all already carry the "inviting well/basket" concave
treatment.

---
*End PRD-16. Art-free; honor the drag rules; verify with dnd probes + play-test, then PRD-17 (English) is authored.*
