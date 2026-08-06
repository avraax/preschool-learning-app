---
paths:
  - "src/components/farver/*.tsx"
---

# Games catalog — Farver — `colors.farvejagt/.ramfarven/.quiz/.nuancer` (+ Lær Farver browse)

One section of the games catalog. The cross-game invariants it relies on — the difficulty spine, the
no-giveaway rule, pool-vs-bag, both-gestures — are in `.claude/rules/games-catalog.md`, which loads
alongside this file.

All drag-based except the calm Lær Farver browse; hand-rolled dnd-kit — see `drag-and-drop.md`.
- Farvejagt: drag objects into the target-color circle; a correct drop snaps into a ring + spoken
  "{objektet} er {farve}".
- Ram Farven: drag 2 droplets into the pot; correct → recipe reveal + spoken "rød og blå bliver lilla";
  `Tøm` empties the pot. Wrong → fizz + **no win/lose narration** — but if the mix made a REAL colour it
  is NAMED (owner 2026-08-03): aiming for lilla and mixing rød+gul makes orange, and that discovery used
  to fizz away unnamed. Naming is identification, not feedback — the same distinction that lets the
  correct branch speak a recipe instead of "rigtigt!".
  Its recipes (`primaryColors`/`possibleTargets`/`mixingRules`/`TARGET_PRIORITY`/`makeTargetBag`) live in
  **`src/config/colorMixing.ts`** — moved out of the component 2026-08-02 because the game speaks lines
  built from them, and data stranded in a `.tsx` can never be enumerated for prebake. Three invariants
  there, all guarded by `colorMixing.test.ts`:
  - **Every unordered pair of the 5 sources maps to a goal, in BOTH orders** — 10 pairs, 10 goals, no
    dead ends. `gul+sort → mørkegul` closed the last gap (it used to fall through to an unnamed
    `color-mix()` sludge that was always wrong), which is also what makes the naming above total. The
    ceiling follows: 5 sources give 10 pairs and all 10 are used, so **more goals need a new SOURCE
    colour** — deliberately not done, since adding grøn as a droplet while teaching blå+gul=grøn is
    muddy for a 5-year-old.
  - **The level owns the TRAY as well as the pool** (`COLORS_RAMFARVEN` = targets + `sources`). Pool size
    used to be the only axis, and the side effect was that **black was a dead droplet at Let AND Normal**
    — nothing at either level uses it. Now Let offers 4 droplets (no black, so every droplet is in some
    answer), Normal introduces black AS the decoy, Svær opens all 10 goals. `primaryColors`' ORDER is
    therefore load-bearing (black last — the tray is `slice(0, sources)`), and the test that matters is
    **every goal a level asks for must be mixable from that level's droplets**; reading `TARGET_PRIORITY`
    out of the `.tsx` with a regex made a first attempt at that guard vacuous, which is why the list is
    config now. Let's 4 droplets can make 6 colours while it asks for 4 — that headroom is deliberate
    (the spare tints are what the child stumbles into and hears named), so it is a SUBSET invariant, not
    an equality.
  - **Goals are drawn from a BAG**, not sampled (`makeTargetBag`, pure + seedable). Avoiding only the
    previous target let 8 mixes from Let's 4 goals hand out lilla four times; a shuffled pass makes Let
    two clean passes and Normal show all 6 before repeating. `avoidFirst` is what stops a repeat
    straddling the seam between two bags. Let's pool (4) is intentionally BELOW the round length (8),
    contra the pool-≥-round rule above: this pool is the mixable SPACE, not a content list.
  The pale-tint goals (lyserød/lyseblå/lysegul/grå) need a neutral ring to read against the pale world,
  and it must be a **padded box that reserves its own space** — as a `118%` absolute disc it reserved
  none and measured **7.5px INSIDE the "Mål" chip** (a non-pale target measured 8px clear), the overlap
  the owner reported. It is always rendered and only painted when pale, so bench geometry stays constant
  as targets rotate. `.claude/rules/responsive-design.md`, "reserve the space, don't tune a percentage".
- Hvilken Farve?: drag the object onto the matching color swatch — and the object is **DESATURATED at
  EVERY level, with no tuning axis that can undo it** (Difficulty PRD-02; the `reveal` axis is deleted,
  not narrowed). Shown in its true colour the answer is already on the board and the child matches the
  fox's orange to the orange swatch without ever needing the word — same "a board must not restate its
  own answer" rule as Tal Quiz's removed numeral/object row and Bogstav Quiz's dropped hear-the-letter
  mode; matching is a ~2–3 year milestone, and the rest of this section already covers the 5–6 skills
  (sorting, shades, mixing). The colour comes BACK only on the copy that lands in the swatch — that pop
  is the reveal and the whole lesson, so never grey it too, and there is **exactly one `desaturate` site
  in the component, a BARE prop** (an `=` there means someone re-conditioned it on a level).
  `canonical:false` objects are askable at **no** level: a greyed car, shirt or crystal has no right
  answer, and the authored lilla `hjerte` would score rød wrong (18 of the 24 left).
  **Let is eased on four axes that leak nothing**: the `obvious` pool (12 subjects whose colour is
  unambiguous at 5 — majs, græskar, hval, skildpadde, kløver and aubergine are held back to
  Normal/Svær), 3 swatches, distractor hues kept off the answer's wheel neighbours, and the naming hint
  after ONE wrong drop instead of two. Guarded in `colorContent.test.ts` (both pools ≥ round, per-hue
  floors for each, the by-name membership of both held-back sets, an INVERTED test that no level may
  carry a colour reveal, and the `desaturate` + `hintAfter` wiring read as source — the tables being
  right proves nothing on its own).
- Nuancer: drag 3 shades into slots **light→dark** (left = lightest).
- **Educational color content is data** in `src/config/colorContent.ts` (NOT themeable); color hexes
  stay data, never themed.
- **Content-quality invariants (PRD-04):** the spoken echo must go through `spokenColor(hue, neuter)`
  so the adjective agrees in gender ("æblet er rødt", "havet er blåt" — not "rød"/"blå"); every
  `ColorObject` carries a `neuter` flag, and objects whose emoji contradict their color (⚽/👒/☁️/🌸)
  carry `quizSafe:false` so Hvilken Farve never scores the child on a misleading picture.
