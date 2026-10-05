# Game Depth PRD-01 — more variation in eight games, nothing more on screen

**Authored:** 2026-10-04 · **Status: FULLY IMPLEMENTED** — W0–W11 on 2026-10-04, W2 (the 12 Farver renders)
on 2026-10-05. Sources in `art-src/farver/`, keyed by `node scripts/optimize-theme-art.mjs farver` with a
per-file `FARVER_KEY_OVERRIDES` entry (the four green subjects also need `darkScreenMax`, which removes the
baked shadow whose green overlaps the subject's) · **Art sibling:** `farver-depth-art-prompts.md`

**Deviations from this document, made while implementing (each verified on screen):**
- §3.2: `SHADES` stays the 3 named steps (Lær Farver + the enumerator read it); the 5-step ramp is a NEW
  `SHADE_RAMPS` built from it. Combos are also filtered by `MIN_SHADE_STEP` (OKLab ΔL ≥ 0.035): the yellow
  midpoint is only 0.02 from lysegul/gul, so gul deals 3/4/5 orderings instead of 3/7/10.
- §3.3: the reverse task draws the two droplets in the LEFT (goal) circle and keeps the pot as the drop
  target, rather than putting them in the pot — so "drag the answer into the pot" still reads.
- §3.5: `arm` (whole-child picture) and `kop` (a mug beside `te`'s cup of tea) were dropped after seeing them
  on the board; Normal/Svær pool is 35, not 37.
- Found and fixed in the sweep (pre-existing, not caused by this PRD): Farvejagt piled Svær's objects onto
  the well on portrait phones; Ram Farven's bench ran off a 375 px portrait screen and its tray sat under the
  corner mascot.

**Supersedes, by name:**
- `difficulty.ts` → `ORDLEG_READ.let.wordMaxLen: 2` (Difficulty PRD-01 W5): Let's Læs Ordet pool is no longer
  "2-letter words only". **The 3-letter ceiling at every level survives unchanged** — that is the standing owner rule.
- `difficulty.ts` → `ORDLEG_SPELL.let` (Difficulty PRD-01 W5): Let's Stav Ordet stops being full spelling of 2-letter
  words and becomes a one-letter gap over the whole 2–3-letter pool. Normal/Svær unchanged.
- `games-farver.md` → "Nuancer: drag 3 shades" and the 3-entry `SHADES` ramps: each hue gets 5 shades.
- `letterWords.ts`' PRD-18 W2 note ("needs a re-baked Å-keyed picture … until then the OLD stream picture shows"):
  closed by reusing the eel that already ships in `src/assets/games/ordleg/aal.webp`.
- `MemoryGame.tsx`'s fixed `NUMBERS = 1..20`: the number range now follows the level.

**Survives unchanged:** no adaptivity; XP independent of difficulty; endless play; one audio at a time; every
no-giveaway rule (Tal Quiz listen-only, Hvilken Farve desaturated at every level, no countable stand-ins on a math
board, Læs Ordet never reads the prompt word); both gestures through one resolve function; `kidCollision`.

---

## §1 Why

The owner (2026-10-04): *"Some games the user is too fast through all variations the game has to offer."* Endless play
made this sharper, not softer: a level's pool size is its repeat period (`games-catalog.md`), so a small pool is now a
loop the child sees forever. Measured from the config at the default level (**Normal**) unless stated:

| Game | What a child actually cycles through | Source |
|---|---|---|
| Farvejagt | **6 boards, ever.** Each hue has exactly 4 objects and a hunt takes all 4 (`slice(0, min(6, 4))`), so red is always æble/bil/rose/jordbær — only distractors move | `FarvejagtGame.tsx:232`, `DANISH_OBJECTS` |
| Nuancer | **6 puzzles** (one fixed 3-shade ramp per hue); Let shows the same lightest+darkest pair per hue | `SHADES`, `NuancerGame.tsx:133` |
| Stav Ordet (Let) | **8 words** = its bag window, so the same 8 on a loop | `spellingWordsFor('let')` = 8 |
| Læs Ordet | Let **9** words; Svær's pool is byte-identical to Normal's (26) | `readingPromptPool` |
| Bogstav Quiz | 28 letters but **one picture per letter**, so after two passes it is "giraf = G" recall, not first-sound | `LETTER_WORDS` |
| Hvilken Farve? | Let 12 objects, Normal/Svær 18 | `quizObjectPool` |
| Hukommelse – Tal | 1–20 at every level | `MemoryGame.tsx:18` |
| Ram Farven | 10 goals is the structural ceiling (5 sources → 10 pairs, all used); one task shape | `colorMixing.ts` |
| Plus/Minus, Sammenlign, Hvad Mangler | Numerically deep, but **one task shape each** | `mathProblems.ts` |

Not researched against comparable apps in this session — the case rests on the measured pools above.

**The second constraint, owner 2026-10-04: this must work down to iPhone.** Phone landscape gives Farvejagt a
~600×230 px board and Hukommelse 62 px cards at Svær; phone portrait at 375 px wide fits Nuancer's 3 slots plus the
sun/moon (~345 px) and nothing more. So **depth comes from content and task shape, never from more elements on screen** (§3.0).

## §2 Decisions — owner, 2026-10-04 — do not re-litigate

1. **One PRD covering all eight**: Farvejagt, Nuancer, Stav Ordet, Læs Ordet, Bogstav Quiz, Hvilken Farve?,
   Hukommelse, and the math "lower priorities", plus Ram Farven.
2. **New Gemini art is approved for the gaps**, provided it is generated in the same style as the shipped set — the
   art-prompts file attaches the existing objects as reference images on every generation. Existing art is reused
   wherever it is already the right colour.
3. **Nuancer: 5 shades per hue, but only the 3 known names are ever spoken** (lyserød / rød / mørkerød …). A correct
   drop of an unnamed in-between shade plays the snap SFX and says nothing. No new narration for Nuancer.
4. **Stav Ordet Let = "missing letter" only**, over the whole 2–3-letter pool. Normal and Svær stay full spelling.
5. **Læs Ordet Let may use easy 3-letter words.** The 3-letter maximum at every level is unchanged.
6. **Hukommelse: number range by level only** (Let 1–10 · Normal 1–20 · Svær 1–30). No cross-pairs (letter↔picture,
   numeral↔dots) — considered and declined. Board sizes unchanged. Bogstaver unchanged.
7. **Math, Normal + Svær only — Let is untouched:** missing number in Plus/Minus; counting backwards in Hvad Mangler;
   "tap the SMALLER" in Sammenlign **at Svær only**.
8. **Sammenlign "mindste" has NO visual cue** — listening only; "Hør igen" repeats the current instruction.
9. **Tal Quiz is unchanged** (Let stays 1–20: Danish only inverts the number word from 21, and that split is Let's
   whole definition).
10. **Ram Farven gets a reverse task at Normal + Svær, about 1 in 3**: two droplets shown, "hvad bliver det?", tap
    the result from 3 swatches. Let stays pure mixing.
11. **Å shows the existing eel** (`ordleg/aal.webp`) everywhere the alphabet art is used.

## §3 What changes

### §3.0 Screen budget — the phone rule, per game

**No level of any game gains a visible element.** A new task shape *swaps* elements; it never adds. Measured counts
are interactive elements in the play area (header/HUD excluded).

| Game | Today (Let / Normal / Svær) | After | Note |
|---|---|---|---|
| Farvejagt | 7 / 9 / 14 objects + well | **same** | 4 targets per board stays fixed (`TARGETS_PER_BOARD`) |
| Nuancer | 2+2 / 3+3 / 3+4 (slots+tray) | **same** | Svær deliberately stays 3 slots — 4 × 78 px + sun/moon overflows 375 px portrait |
| Ram Farven (reverse task) | 4–5 droplets + pot + Mål chip + Tøm | 3 swatches + pot | droplet tray, Mål chip and Tøm are hidden for that task — fewer |
| Hvilken Farve? | 1 object + 3/4/5 swatches | **same** | |
| Stav Ordet Let | 2 slots + 3 tiles | 2–3 slots + 3 tiles | 3 slots already render at Normal on every viewport |
| Læs Ordet | word + 3/4/6 pictures | **same** | |
| Bogstav Quiz | picture + 3/4/5 letters | **same** | |
| Hukommelse | 12 / 20 / 30 cards | **same** | numerals 21–30 are 2 digits, like 10–20 today |
| Plus/Minus (missing) | `a op b = ?` + 3/4/5 tiles | `a op ? = c` + same tiles | the `?` moves; same 5 sentence parts |
| Sammenlign (mindste) | `a [?] b` | **same** | only the spoken instruction differs |
| Hvad Mangler (descending) | 5 cells + 3/4/5 tiles | **same** | |

### §3.1 Farvejagt + Hvilken Farve? — more objects per hue

Each hue grows from 4 to 6–8 objects. **Append** to each `DANISH_OBJECTS[hue]` array — never reorder (§4 trap 4).

| Hue | Added (Danish · definite · art id · source) | Canonical? | Obvious? |
|---|---|---|---|
| rød | ballon · ballonen · `balloon_red` · copy of `math/balloon.webp` | no | – |
| rød | fisk · fisken · `fish_red` · copy of `math/fish.webp` | no | – |
| rød | tomat · tomaten · `tomato` · **new render** | yes | yes |
| rød | mariehøne · mariehønen · `ladybug` · **new render** | yes | yes |
| blå | bil · bilen · `car_blue` · copy of `english/car.webp` | no | – |
| blå | sko · skoen · `shoe_blue` · copy of `english/shoe.webp` | no | – |
| blå | fugl · fuglen · `bird_blue` · copy of `english/bird.webp` | no | – |
| blå | vanddråbe · vanddråben · `water_drop` · **new render** | yes | **no** |
| grøn | frø · frøen · `frog` · **new render** | yes | yes |
| grøn | broccoli · broccolien · `broccoli` · **new render** | yes | yes |
| grøn | blad · bladet (**neuter**) · `leaf` · **new render** | yes | yes |
| grøn | ærtebælg · ærtebælgen · `pea_pod` · **new render** | yes | **no** |
| gul | kop · koppen · `cup_yellow` · copy of `english/cup.webp` | no | – |
| gul | ost · osten · `cheese` · copy of `ordleg/ost.webp` | yes | yes |
| gul | stjerne · stjernen · `star_yellow` · copy of `math/star.webp` | no | – |
| gul | citron · citronen · `lemon` · **new render** | yes | yes |
| lilla | blomme · blommen · `plum` · **new render** | yes | **no** |
| lilla | lavendel · lavendlen · `lavender` · **new render** | yes | **no** |
| lilla | paraply · paraplyen · `umbrella_purple` · **new render** | no | – |
| lilla | sommerfugl · sommerfuglen · `butterfly_purple` · **new render** | no | – |
| orange | fisk · fisken · `fish_orange` · copy of `english/fish.webp` | no | – |
| orange | blomst · blomsten · `flower_orange` · copy of `english/flower.webp` | no | – |

All added nouns are common gender except `blad` (neuter → "bladet er grønt" through `spokenColor`). Hex per object =
the canonical `COLOR_SWATCH[hue]` unless the render is visibly off it; it drives nothing child-visible in Farvejagt
except the collected ring.

Result: rød 8 · blå 8 · grøn 8 · gul 8 · lilla 8 · orange 6. Hvilken Farve? (canonical only, never `canonical:false`)
grows from 18 → 29 at Normal/Svær and from 12 → 19 at Let (`obvious`). Copies are made under hue-specific ids because
the same noun now exists in two hues (a red and a blue `bil`; a red and an orange `fisk`) — that is wanted: on a red
hunt the blue car is a distractor, so the object stops predicting the colour.

**Dealing:** a board still takes exactly 4 targets (`TARGETS_PER_BOARD = 4`, exported from `colorContent.ts`), drawn
from a **per-hue object bag** keyed by `art` (`makePromptBag` semantics, window clamped below the hue's pool), so
successive red hunts show different subsets. Distractors keep `COLORS_FARVEJAGT` (count per level) and are sampled
from the larger pools.

### §3.2 Nuancer — 5 shades per hue, dealt by spacing

`SHADES[hue]` becomes a 5-step light→dark ramp: **indices 0, 2, 4 are today's three entries, byte-identical (name +
hex)**; indices 1 and 3 are new, unnamed midpoints. Compute each midpoint once as the 50/50 **OKLab** mix of its two
named neighbours and commit it as a literal hex (no runtime colour maths). `ColorShade.name` becomes optional; the
in-betweens carry `name: undefined` and a stable `id` (`rød-1`, `rød-3`) used as the drag id — the drag id is the
shade name today (§4 trap 8).

Per level (new fields on `COLORS_NUANCER`, replacing the implicit "endpoints" rule at `NuancerGame.tsx:133`):

| Level | Slots | Which shades (indices into the 5) | Combos per hue | Puzzles |
|---|---|---|---|---|
| Let | 2 | span ≥ 3 → (0,3) (0,4) (1,4) | 3 | 18 |
| Normal | 3 | span ≥ 3 → (0,1,3) (0,1,4) (0,2,3) (0,2,4) (0,3,4) (1,2,4) (1,3,4) | 7 | 42 |
| Svær | 3 + decoy | every triple (span ≥ 2), incl. adjacent (0,1,2) | 10 | 60 |

The hue still comes from the existing hue bag; the combo comes from a **per-hue combo bag** so a hue cycles its
combos. The Svær decoy is any of another hue's 5 shades. Correct drop: `audio.speak(name)` **only if the shade has a
name**; otherwise SFX only (decision 3). `NUANCER_INSTRUCTION` unchanged.

### §3.3 Ram Farven — the reverse task (Normal + Svær)

A **format bag** (§3.10) decides per task: `mix` (today) or `reverse` (`COLORS_RAMFARVEN[level].reverse`:
Let `0`, Normal/Svær `{ alt: 1, of: 3 }`).

The reverse task: the next goal is drawn from the **same** `makeTargetBag` as today; its recipe's two source droplets
appear **in the pot, side by side and unmixed**; the droplet tray, the "Mål" goal chip and Tøm are hidden; three
colour swatches (the goal + 2 other goals from the level's pool) take the tray's place. Spoken: `colorMixQuestionText
(a, b)` → **"rød og blå, hvad bliver det?"** (new builder in `gamePhrases.ts`, recipe order as in `mixingRules`).
Answer by **tap on a swatch or drag of a swatch onto the pot** — one `resolveSwatch()` for both. Correct → the pot fills
with the result and speaks the existing `colorMixResultText(a, b, result)`; wrong → the existing fizz, no narration
(a wrong swatch is not a mix, so nothing to name). Hint after `WRONG_MIXES_BEFORE_HINT` wrong taps: the right swatch
pulses. XP/advance-lock/seam exactly as a correct mix.

### §3.4 Stav Ordet Let — one missing letter

`ORDLEG_SPELL` gains `mode: 'missing' | 'full'`: Let `{ mode: 'missing', wordMinLen: 2, wordMaxLen: 3, distractors: 2 }`,
Normal/Svær `mode: 'full'` with their current values. Let's pool becomes the whole `SPELLING_WORDS` (35).

A pure `makeMissingLetterTask(word, rnd)` in `ordlegWords.ts` returns `{ letters, blankIndex, tiles }`: the word's
letters with one blank (any position), tiles = the missing letter + 2 distractors that are **not in the word** and
**not in the missing letter's confusable pool** (`confusablePoolFor` — Let means maximally dissimilar, same policy as
Bogstav Quiz Let). The other slots render pre-filled in the existing "filled" style; the blank is the dashed slot. The
picture prompt, the spoken word on show, the letter echo, the word read-back and the 2-wrong hint
(`spellingHintLine`) are all unchanged — **no new narration**. Tap and drop onto the word row both go through
`handleTileClick`.

### §3.5 Læs Ordet — a wider Let, a bigger pool

`OrdlegWord` gains `tier?: 'easy'`. `ORDLEG_READ` replaces `wordMaxLen` with `pool: 'easy' | 'all'` (Let `easy`,
Normal/Svær `all`) and keeps a `READING_MAX_LEN = 3` constant that **every** reading word is guarded against.

- **Easy tier (Let, 19):** the 9 two-letter words + `sol bil kat hus mus bus hat ost sko ski` (spelled as they sound).
- **Added to the pool (all levels' distractor pool; Normal/Svær prompts, 26 → 37):** `hul ulv mor far bær løg arm`
  (already shipped in Stav Ordet with art + clips) and `sky kop dør træ` (art via `ordlegArt`'s english fallback:
  `cloud cup door tree`).
- **Deliberately NOT added:** `hej` (abstract), `fod` and `ben` (their picture is a whole child, which reads "dreng").

Let keeps 3 pictures and no shared initials; Svær keeps 6 and shared initials. The tapped picture's name is still the
only thing spoken.

### §3.6 Bogstav Quiz — 2–5 pictures per letter (quiz only)

New `LETTER_QUIZ_WORDS: Record<letter, { word, art: ArtRef }[]>` in `letterWords.ts`. **Entry 0 is always the
canonical `LETTER_WORDS` word**, and Lær Alfabetet + Hukommelse keep reading `LETTER_WORDS` only. `ArtRef` is a
section-qualified id (`'ordleg/bus'`, `'english/cup'`, `'farver/carrot'`, `'math/balloon'`, `'alphabet/B'`) resolved by
a new `src/assets/games/wordArt.ts` over the existing per-section maps — never copied into the alphabet dir (§4 trap 1).

| Letter | Words (entry 0 first) | Letter | Words |
|---|---|---|---|
| A | Abe · Appelsin · Agurk | M | Mus · Måne · Majs |
| B | Bil · Bus · Banan · Ballon · Bog | O | Orm · Ost |
| D | Drage · Dør | R | Raket · Ræv |
| F | Fisk · Fugl | S | Sol · Sko · Stol · Seng · Stjerne |
| G | Giraf · Gris · Ged · Gulerod · Græskar | T | Tog · Træ |
| H | Hund · Hest · Hus · Hat · Haj | Æ | Æble · Æg |
| J | Jul · Jordbær | Å | Ål (eel art, decision 11) |
| K | Kat · Ko · Kage · Kop | **unchanged (1)** | C E I N P U V W X Y Z Ø |
| L | Løve · Løg | | |

Art refs: Appelsin `farver/orange_fruit`, Agurk `farver/cucumber`, Bus `ordleg/bus`, Banan `english/banana`, Ballon
`math/balloon`, Bog `ordleg/bog`, Dør `english/door`, Fugl `english/bird`, Gris `english/pig`, Ged `ordleg/ged`, Gulerod
`farver/carrot`, Græskar `farver/pumpkin`, Hest `english/horse`, Hus `ordleg/hus`, Hat `ordleg/hat`, Haj `ordleg/haj`,
Jordbær `farver/strawberry`, Ko `ordleg/ko`, Kage `english/cake`, Kop `english/cup`, Løg `ordleg/loeg`, Måne
`english/moon`, Majs `farver/corn`, Ost `ordleg/ost`, Ræv `ordleg/raev`, Sko `ordleg/sko`, Stol `english/chair`, Seng
`english/bed`, Stjerne `math/star`, Træ `english/tree`, Æg `ordleg/aeg`. 59 prompts over the same 28 letters.

**Excluded on purpose** (a child names the picture with a different first letter): and + kylling (two yellow birds),
hval + hjerte (silent H), druer ("vindruer"), rose ("blomst"), ur ("armbåndsur"), lastbil ("bil"), te ("kop"), ulv
("hund"), kiks ("småkage"), so ("gris"), any child/body-part picture, any glass (vand/mælk).

**Dealing:** the letter bag is unchanged (pool 28, practice ledger keyed by letter). A per-letter word rotation picks
which word the drawn letter shows, cycling that letter's words. Same pool at every level; the level still moves only
the distractors.

**Å:** copy `src/assets/games/ordleg/aal.webp` over `src/assets/games/alphabet/AA.webp`; delete the PRD-18 "OLD
stream picture" note in `letterWords.ts`.

### §3.7 Hukommelse – Tal — range by level

`MEMORY_BOARD` gains `numberMax`: Let 10 · Normal 20 · Svær 30 (pool ≥ pairs at every level: 10≥6, 20≥10, 30≥15). The
numbers pool becomes `1..numberMax` for the current level. The count cluster on a matched face renders only for
`n ≤ 20` (today's maximum); 21–30 show the numeral alone (assumption — a 30-object cluster on a 48 px phone card is
unreadable). Bogstaver unchanged.

### §3.8 Plus / Minus — missing number (Normal + Svær)

`MATH_ADDITION` / `MATH_SUBTRACTION` gain `missing`: Let `0`, Normal/Svær `{ alt: 1, of: 3 }`, dealt by the format bag.
New pure generators `makeMissingAdditionProblem(level, rnd)` / `makeMissingSubtractionProblem(level, rnd)`:

- Shape `a + ? = c` / `a − ? = c` — **the second operand is always the gap** (assumption: one gap position keeps the
  sentence readable for a 5-year-old).
- **Normal Plus uses sums ≤ 10, no crossing** (assumption — "8 + ? = 15" is counting-on across the ten in reverse,
  harder than the Normal comfort target). Normal Minus keeps no-borrow. Svær uses each operation's Svær band.
- Answer = `b`. Distractors: `b ± 1`, `b ± 2`, **`c`** (the "answered the total" error) and `a`, clamped ≥ 1, distinct.
- Spoken prompt: `mathMissingPromptText(op, a, c)` → **"tre plus hvad giver syv"** / **"syv minus hvad giver tre"**.
  The correct-tap fact is the existing `mathFactText(op, a, b, c)` ("tre plus fire er syv").
- The `?` slot (drop target, `?`→answer POP) moves to the middle position; `c` renders as a plain numeral.

### §3.9 Sammenlign — "tryk på det mindste tal" (Svær only)

`MATH_COMPARISON` gains `askSmaller`: Let/Normal `0`, Svær `{ alt: 1, of: 3 }`. On such a task the spoken instruction is
`COMPARE_SMALLER_PROMPT = 'Tryk på det mindste tal.'` — on show, after the welcome, and on "Hør igen" — the correct side
is the smaller, the winner-lit/loser-recede styling follows the correct side, and the fact is
`comparisonSmallerFactText(smaller, bigger)` → **"ni er mindre end ti"**. The `<`/`>` symbol stays mathematically true.
No visual cue (decision 8).

### §3.10 Hvad Mangler — counting backwards (Normal + Svær)

`MATH_SEQUENCE` gains `descending`: Let `0` · Normal `0.15` · Svær `0.3` — the share of NUMERIC questions read
right-to-left. A descending question is an ascending spec of the same level, **reversed** (`10 9 8 _ 6`), so every
number stays inside the level's range; `missingIndex` still never 0. The read-back is `sequenceFactText` of the
reversed list. Visual patterns untouched.

### §3.11 Shared: the format bag

`src/config/formatBag.ts` (pure, seedable, `.ts` imports): `makeFormatBag({ alt, of }, rnd)` deals passes of `of`
slots containing exactly `alt` alternates, shuffled, and never lets an alternate straddle a pass seam back-to-back.
`{ alt: 0 }` (or `0`) always deals `main`. Used by Ram Farven, Plus/Minus and Sammenlign; Hvad Mangler keeps its
generator-level share because its generator already rolls per question.

### §3.12 File table

| File | Change | |
|---|---|---|
| `src/config/formatBag.ts` (+ test) | the format bag | new |
| `src/config/difficulty.ts` | `COLORS_NUANCER` combos, `COLORS_RAMFARVEN.reverse`, `ORDLEG_SPELL.mode`, `ORDLEG_READ.pool`, `MEMORY_BOARD.numberMax`, `MATH_ADDITION/SUBTRACTION.missing`, `MATH_COMPARISON.askSmaller`, `MATH_SEQUENCE.descending` | edited |
| `src/config/colorContent.ts` | 22 objects appended; 5-step `SHADES`; `TARGETS_PER_BOARD`; optional shade `name` + `id` | edited |
| `src/config/colorMixing.ts` | nothing — reverse reuses `mixingRules`/`makeTargetBag` | – |
| `src/config/gamePhrases.ts` | `colorMixQuestionText`, `mathMissingPromptText`, `COMPARE_SMALLER_PROMPT`, `comparisonSmallerFactText` | edited |
| `src/config/mathProblems.ts` | missing-number generators + distractors; descending sequences; `allSequenceSpecs` consumers bake reversed read-backs | edited |
| `src/config/letterWords.ts` | `LETTER_QUIZ_WORDS`, `ArtRef`; drop PRD-18 stale note | edited |
| `src/config/hintLines.ts` | `alphabetHintLine(letter, word)`; its table line enumerates every quiz word | edited |
| `src/config/ordlegWords.ts` | `tier`, 11 reading words, `READING_MAX_LEN`, `makeMissingLetterTask` | edited |
| `src/config/promptPools.ts` | `readingPromptPool` by tier; `spellingPromptPool('let')` = full 2–3 pool | edited |
| `src/assets/games/wordArt.ts` | section-qualified `ArtRef` resolver over the existing maps | new |
| `src/assets/games/farver/*.webp` | 10 copies (§3.1) now; 12 renders when delivered | new |
| `src/assets/games/alphabet/AA.webp` | replaced by the eel | edited |
| `src/components/farver/FarvejagtGame.tsx` | per-hue object bag, `TARGETS_PER_BOARD` | edited |
| `src/components/farver/NuancerGame.tsx` | combo bag, ids not names, silent unnamed drops | edited |
| `src/components/farver/RamFarvenGame.tsx` | reverse task (swatches, hidden Mål/Tøm/tray, `resolveSwatch`) | edited |
| `src/components/farver/FarverLearning.tsx` | **nothing** — but its `slice(0, 4)` is why §4 trap 4 exists | – |
| `src/components/ordleg/SpellingGame.tsx` | missing-letter path at Let | edited |
| `src/components/ordleg/LaesOrdetGame.tsx` | none beyond the pool function (verify) | – |
| `src/components/alphabet/AlphabetGame.tsx` | word rotation, art via `wordArt`, hint/fact take the word | edited |
| `src/components/learning/MemoryGame.tsx` + `common/UnifiedMemoryGame.tsx` | level-driven numbers pool; bag rebuild on pool change; cluster cap | edited |
| `src/components/math/MathOperationGame.tsx` | missing-number layout + prompt | edited |
| `src/components/math/ComparisonGame.tsx` | smaller task | edited |
| `src/components/math/HvadManglerGame.tsx` | none beyond the generator (verify the read-back path) | – |
| `shared-narration-clips.js` | enumerate every new line from its builder | edited |
| `public/sounds/tts/*`, `src/config/prebakedTts.ts`, `docs/audit/*` | prebake + approve-all output | regenerated |
| `.claude/rules/games-*.md` | update the per-game notes this changes | edited |

## §4 The traps — read before writing any of it

1. **The alphabet art dir is keyed by LETTER, not by word.** `alphabet/index.ts` uppercases every stem into a glyph,
   so a copied `bus.webp` would register as the letter "BUS". Bogstav Quiz's extra words resolve through
   `wordArt.ts` (section-qualified), never by copying into `alphabet/`. The only alphabet file this PRD touches is
   `AA.webp`.
2. **Section stems collide.** `car`, `fish`, `apple`, `bird`, `star`, `flower`, `hat` exist in several dirs as
   *different pictures in different colours* (farver `car` is red, english `car` is blue, math `car` light blue). An
   unqualified fallback chain like `ordlegArt` picks whichever map it checks first. That is why Farver copies under
   hue-specific ids and Bogstav uses qualified refs.
3. **`alphabetHintLine(letter)` reads `LETTER_WORDS[letter]`** — with extra words, the hint would say "Giraf starter med
   G" over a picture of a pig. It must take the shown word, and `speakCorrectFact` likewise. Enumerate both for every
   `LETTER_QUIZ_WORDS` entry.
4. **Lær Farver shows `DANISH_OBJECTS[hue].slice(0, 4)`.** Array order is load-bearing: append, never insert or sort,
   or the browse silently changes its examples (and may show a non-canonical one first).
5. **Every reused object is `canonical: false` except `ost`.** A greyed blue car has no right answer in Hvilken Farve?
   — `quizObjectPool` already filters, but the flags in §3.1 are the contract. Keep `colorContent.test.ts`'s inverted
   "no level may carry a colour reveal" test and the single bare `desaturate` site green.
6. **Same noun, two hues.** `bil` (red + blue) and `fisk` (red + orange). Anything keyed by `objectName` alone
   collides; `quizObjectKey` is `${color}-${objectName}` (fine) and the new Farvejagt object bag must key on `art`.
   The two fact lines ("fisken er rød" / "fisken er orange") are distinct clips — enumerate from data, as today.
7. **Ram Farven's reverse task must not show the answer.** The "Mål" chip is the target swatch — it IS the answer, so
   it must be hidden for that task; the pot must show the two droplets unmixed until the tap. Guard the hiding with a
   source-read test (the data being right proves nothing — `game-development.md`).
8. **Nuancer uses the shade NAME as the drag id and the slot match key** (`slots.includes(shadeName)`,
   `order[i].name`). Unnamed shades break both — switch to a stable `id` everywhere before adding them. The Svær decoy
   can now be an unnamed shade too.
9. **`colorContent.ts` is Node-pure and cannot see the Vite glob**, so a data entry whose WebP hasn't landed renders an
   empty object on the board while its fact line still bakes. Add each new-render object to `DANISH_OBJECTS` **in the
   same commit as its file**, and add a test that every `art` id exists on disk in `src/assets/games/farver/` (`fs`).
10. **The memory board bag only rebuilds when the TYPE changes** (`UnifiedMemoryGame.tsx:259`). With a level-driven
    pool, a level change would keep dealing 1–20 at Let. Rebuild when the pool's identity changes, and keep the
    existing `boardPairs` re-deal effect (`games-memory.md`: a size change must deal a new board).
11. **The memory count cluster renders `n` copies.** At 21–30 that is up to 30 objects on a 48 px phone card. Cap at
    20 (§3.7).
12. **The prebake enumerator imports `src/config/*.ts` only, with explicit `.ts` extensions.** Every new string goes
    through a builder in `gamePhrases.ts` / `letterWords.ts` / `hintLines.ts`; composing one in a `.tsx` leaves it on
    live Azure, **which for a guest is silence** (`audio-call-sites.md`). New lines join the existing narration groups
    (`letters`, `math`, `colours`, `ordleg`) — a NEW group must also be added to `AuditGroup`/`GROUP_ORDER`/
    `GROUP_LABELS` or `/audit` crashes.
13. **Hvad Mangler's read-backs are derived from `sequenceSpecsForLevel`.** Descending questions are reversals, so the
    enumerator must bake `sequenceFactText(reversed)` for every spec at levels where `descending > 0` — a superset is
    fine, a subset leaves lines live.
14. **Sammenlign speaks `COMPARE_PROMPT` from more than one place** (after the welcome, per question, on repeat).
    Every one must read the CURRENT task's instruction, or "Hør igen" asks the wrong question.
15. **The math `?` slot is the drop target** (`answer-slot`). Moving it for the missing form must move the
    `DroppableZone` with it; run the dnd abort probe + positive control.
16. **Stav Ordet's tap/drop logic is sequential** (`targetLetters[filledCount]`). The missing-letter path is a separate
    branch with one expected letter — don't thread it through `filledCount`, and keep the advance-lock set before the
    echo `await` exactly as the full path does.
17. **`difficulty.test.ts` fails the build if two levels share identical parameters** and samples the generators. Every
    new field must keep all three levels distinct, and every new generator must be added to its sampling. Audit a level
    by **sampling**, not by reading the table (`CLAUDE.md`).
18. **Never `await` narration in a tap handler** — fire, then schedule the advance on a fixed dwell.
19. **Green subjects on a green screen need the green-excess key**, not distance-to-green (art file has it).
20. **No emoji in any new code or data** (`noEmoji.test.ts`, empty allowlist).

## §5 What must NOT change

- No adaptivity; nothing reads the child's performance to choose a level or a task shape. The format bag is random
  per pass, never driven by misses.
- XP per task is identical for every task shape and level; a harder level or shape never costs rewards.
- Læs Ordet never auto-reads the prompt word; max 3 letters at every level.
- Tal Quiz untouched; no countable stand-in on any math board; Hvilken Farve? desaturated at every level.
- Let in Plus/Minus/Sammenlign/Hvad Mangler/Ram Farven generates exactly what it does today.
- Lær Farver, Lær Alfabetet and Hukommelse – Bogstaver show exactly what they show today (except Å's picture).
- Both gestures through one resolve function; `kidCollision`; advance-lock before any `await`.
- No new visible element at any level (§3.0).

## §6 Work stages — one commit each, each green on its own

Every stage that adds a spoken line runs `npm run tts:prebake` (needs Azure creds; resumable),
`npm run audit:approve-all` (owner's blanket rule — say the clips are approved-but-unheard), commits the output, and
updates its `games-*.md` note.

- **W0 — format bag.** `formatBag.ts` + test. No behaviour change.
- **W1 — Farvejagt from reused art.** The 10 copies, their 10 `DANISH_OBJECTS` entries (§3.1 rows sourced "copy of"),
  `TARGETS_PER_BOARD`, the per-hue object bag, on-disk art test. Hvilken Farve? picks up `ost` automatically.
- **W2 — Farvejagt/Hvilken Farve new renders (art-gated).** When the owner delivers the 12 files from
  `farver-depth-art-prompts.md`: key (green-excess for the 4 greens), ≤40 KB WebP, add their entries + flags, prebake.
  Can land in parts; W3+ do not depend on it.
- **W3 — Nuancer.** 5-step ramps (named entries byte-identical), ids, combo tables + bags, silent unnamed drops.
- **W4 — Ram Farven reverse.**
- **W5 — Stav Ordet Let missing letter.**
- **W6 — Læs Ordet tiers + 11 words.**
- **W7 — Bogstav Quiz words + `wordArt.ts` + Å eel.**
- **W8 — Hukommelse number range.**
- **W9 — Plus/Minus missing number.**
- **W10 — Sammenlign mindste.**
- **W11 — Hvad Mangler descending.**
- **W12 — reference screenshots** (`docs/ui-reference/`) for every changed game and task shape.

## §7 Verification

**Rung 1–2 (agent, `ui-screenshot` + `webkit.mjs`)** — for every changed game, every task shape it now has, at
**844×390, 667×375, 390×844, 375×667** and iPad **1024×768 / 768×1024**: `scrollHeight ≤ innerHeight`, no element
clipped, touch targets ≥ 44 px. Farver games also on all 4 skins + dark. Ram Farven reverse and Stav missing-letter:
dnd **abort probe** (release in empty space → nothing scored) **and positive control** (drop on target → lands), plus a
plain tap. `cdp.mjs --audio-report` on one new line per stage: it must play a `/sounds/tts/<hash>.mp3`, not a live synth.

**New guards — each to be re-broken with `/re-break`** (break what the guard measures, then confirm it goes red):
- `formatBag.test.ts`: exactly `alt` per `of`; never 3 alternates in a row; `0` never deals an alternate.
- `colorContent.test.ts`: ≥ 6 objects per hue; every `art` exists on disk; first 4 per hue pinned by name (Lær Farver);
  reused objects `canonical: false` except `ost`; Let/Normal quiz pools ≥ round; shade indices 0/2/4 pinned to today's
  names + hexes; OKLab L strictly decreasing along each ramp with adjacent ΔL ≥ 0.05.
- `difficulty.test.ts`: Nuancer combo counts 3/7/10 per hue and Let never yields span < 3; reverse/missing/askSmaller/
  descending are `0` at Let (and askSmaller `0` at Normal); levels still pairwise distinct.
- `mathProblems` sampling: Normal missing-Plus never sums > 10; Svær missing-Plus always crosses; missing-Minus Normal
  never borrows; missing distractors exclude the answer and are ≥ 1; descending sequences stay inside the level's range
  and never blank index 0.
- `gamePhrases.test.ts`: pins "tre plus hvad giver syv", "syv minus hvad giver tre", "Tryk på det mindste tal.",
  "ni er mindre end ti", "rød og blå, hvad bliver det?" — and that each is enumerated.
- `letterWords.test.ts`: every quiz word starts with its letter; none starts with `hj`/`hv`; entry 0 equals
  `LETTER_WORDS`; every `ArtRef`'s file exists; every word's question, fact and hint line is enumerated.
- `ordlegWords.test.ts`: every reading word ≤ 3 letters; easy tier pinned by membership; every pool ≥ its round;
  `makeMissingLetterTask` → one blank, answer in tray, 3 tiles, no confusable or in-word distractor.
- Source-read guards (comments stripped, `codeOf`): Ram Farven hides the Mål chip on the reverse task; Bogstav Quiz's
  `speakHint`/`speakCorrectFact` pass the shown word; the memory bag rebuilds on pool change; Nuancer matches on `id`.
- `collectNarrationClips()` → every clip in `PREBAKED_TTS` (0 missing); `npm run audit:check` clean;
  `npm run context:check`, `npm run lint`, `npm test`, `npm run build` green.

**Rung 3 (owner's iPad — say UNKNOWN until then):** the new objects read as the right thing at Farvejagt size; the
Nuancer in-between shades are distinguishable on the real screen; "… hvad giver …" and "… hvad bliver det?" sound
natural; whether "Tryk på det mindste tal" trips him at Svær; the eel reads as "ål".

## §8 Out of scope

Tal Quiz; the English quizzes; all "Lær …" browses; Hukommelse – Bogstaver and any cross-pair memory mode; more answer
tiles or bigger boards at any level; a new source colour in Ram Farven; any adaptive or miss-driven task choice;
new games.

## §9 Kickoff prompt for a fresh session

> Implement `plans/game-depth/tmp-prd-game-depth-01-variation.md`. Read `.claude/rules/games-catalog.md`, the
> `games-*.md` for each section you touch, `drag-and-drop.md`, `layout-contract.md` and `audio-system.md`'s 8-step
> protocol first. Start with W0 (the format bag the later stages share), then W1 — W2 waits for the owner's art. One
> commit per stage, prebake + `audit:approve-all` in every stage that adds a line, and re-break every guard in §7 with
> `/re-break`. Name the verification rung for every claim; the phone viewports in §7 are mandatory.
