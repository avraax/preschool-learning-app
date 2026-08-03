# PRD — Reward Pacing: a slower book, an unobstructed ring, a focused ceremony

Status: authored 2026-08-03, **IMPLEMENTED 2026-08-03** — W1–W7 on `master`
(`6afa0b8` xpForSlots · `4b47b46` the curve · `68bfc55` the gauge ring · `27fb94f` the ceremony ·
`31c3ec7` the quiet crossing · `db11c6d` CLAUDE.md · `0403748` + `28a5f8a` probe hooks and guards).
Chapters 9–10 (§10, D8) are **spec only** as intended — no renders, no prebake. Two deliberate
deviations are recorded in §6.4 and §13 below.

Extends Reward Horizon PRD-01 (which set the model — one number, one book, one ring, one door) by
re-tuning its **economy** and simplifying its **ceremony**. Every Reward Horizon decision D1–D7
survives; only the curve constants, the ring's geometry and the overlay's element list change.

---

## 1. Context — why this change

The owner has been play-testing at a 5-year-old's level (his son, ~5, counts to 60–70) and reports
three linked complaints. All three are arithmetic, not perception — each was measured before this
PRD was written.

### 1.1 The ring completes more than one revolution per round

A reward slot costs `REWARD_XP = 40`. A normal 8-question round pays `8 × taskXp(8, …)`, i.e. 40 XP
flat plus **+1 per first-try answer**, plus up to 14 in round-end bonuses (`roundXp`: +6 perfect,
+8 new best). So an ordinary round is **~46 XP against a 40 XP slot**.

| | today |
|---|---|
| one answer moves the arc | **12.5 – 15 %** |
| one round moves the arc | **~115 %** (i.e. past full) |

The ring is therefore not a progress meter at this rate — it is a spinner that resets. The
goal-gradient effect (§2.3) lives entirely in *visible nearness to a goal*, and nearness that is
re-established every 90 seconds carries no information.

### 1.2 The book will be finished in weeks

`xpForSlots(72) = 18 × 40 + 54 × 80 = 5040 XP`.

| play rate | today |
|---|---|
| rounds to fill the book | **81 – 126** (mid ≈ 110) |
| at 3 rounds/day | **~5 weeks** |
| at 10 rounds/day (a rainy weekend) | **~11 days** |

Worse, chapters 1–2 are **one sticker per round**, so a single 20-minute sitting can empty most of a
page. A finite collection's pull is *set completion* (§2.6); a set that completes in a fortnight
spends most of its life completed.

### 1.3 The number hides the progress it sits on

`RewardRing`'s count badge is `max(20, round(size × 0.46))` — 21px at the default `size = 46` — offset
`right/bottom: −round(size × 0.06)`, i.e. centred at `(38.5, 38.5)` in a 46px box.

- ring centre `(23, 23)`, radius `r = 20.5`, stroke 5 → the arc band is `r ∈ [18, 23]`
- badge centre is `√(15.5² + 15.5²) = 21.9px` from the ring centre — **inside the band**
- the badge subtends `asin(10.5 / 21.9) ≈ 28.7°` either side of the 45° diagonal → it covers
  **16° – 74°** of the lower-right quadrant
- the fill sweeps clockwise from 12 o'clock, so that is **fill 29 % → 46 %**

The badge occludes a quarter of the range, in the middle of it, and the arc carries a
`drop-shadow(0 0 4px)` glow that makes the interruption wider than the disc. It is the worst
available placement, and no offset tuning fixes it — the badge is *inside* the swept path by
construction.

### 1.4 The ceremony has eight layers and a see-through scrim

The owner's screenshot (a chapter completion on the Alfabetet menu, Regnbue skin) shows, stacked in
one column: **"Nyt klistermærke!" banner · the sticker · its label · a 3×3 dot grid · the count disc ·
the companion · "Hele siden er samlet!" · confetti** — over a
`radial-gradient(… rgba(255,250,235,0.92) …)` scrim through which the menu's game tiles, back button,
reward ring and corner mascot all remain readable. The sticker itself is 150px in a 768px-tall
viewport.

The plain (non-chapter) grant is the same minus the companion and the headline — still six layers.

**Intended outcome**

> The ring climbs about a third per round. A sticker takes about three rounds. When it lands, the
> picture is the only thing on the screen.

---

## 2. The evidence

Gathered 2026-08-03. Every claim carries a URL; sources labelled *research* (peer-reviewed or
review-of-literature), *regulation*, or *practice* (clinical/industry convention). The relevant
finding here is that **every line of evidence points the same way** — fewer, slower, plainer — which
is unusual and worth recording, because it means this change needs no owner override the way Reward
Horizon's number did.

### 2.1 Schedule thinning is exactly this change — *practice*

Token systems in applied behaviour analysis begin at **continuous reinforcement** to establish the
behaviour, then **thin** the schedule to intermittent so the behaviour is maintained without
dependence on the token. Thinning "decreases reinforcement density once a target behaviour is
established … prevents over-reliance on artificial rewards and supports long-term maintenance."

- <https://www.praxisnotes.com/resources/reinforcement-schedule-thinning-guide>
- <https://centralreach.com/blog/token-economy-aba/>

Consequence for the design: **keep chapter 1 dense and thin everything after it.** The two-tier curve
is not a compromise between "fast" and "slow" — dense-then-thin *is* the recommended shape. §3.2 is
this paragraph turned into a constant.

### 2.2 Expected rewards undermine intrinsic interest — *research*

Lepper, Greene & Nisbett (1973), run on **preschoolers** and an activity they already enjoyed
(drawing): the group told in advance they would be rewarded showed a marked decline in later
voluntary engagement; the group rewarded *unexpectedly* showed none. Learners with initially **high**
intrinsic interest are the most susceptible.

- <https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Motivation/Lepper_et_al_Undermining_Childrens_Intrinsic_Interest.pdf>

Consequence: the risk runs in one direction only. Slowing the reward rate cannot overshoot into harm;
raising it can. Any doubt about how far to slow should resolve toward slower.

### 2.3 Goal gradient + endowed progress — *research*

Kivetz, Urminsky & Zheng (2006) resurrected Hull's goal-gradient hypothesis in real reward programs
(café punch cards, a song-rating site): effort **accelerates measurably as a visible goal nears**,
and — directly relevant here — participants **reduced engagement immediately after collecting a
reward** before re-accelerating toward the next one. Nunes & Drèze's endowed-progress effect adds
that *perceived* progress, not actual progress, drives the slope.

- <https://business.columbia.edu/insights/chazen-global-insights/goal-gradient-hypothesis-resurrected-purchase-acceleration>
- <https://www.columbia.edu/~rk566/Session4/Goal-Gradient_Illusionary_Goal_Progress.pdf>

Consequence: **the ring's fill is the motivational instrument, not the reward rate.** A 120 XP slot
gives the gradient a shape a child can be inside of for three rounds. It also predicts the
post-reward dip is normal and should not be "fixed" by making the next reward cheaper.

### 2.4 Reward loops and children — *regulation*

ICO Children's Code, standard 13 (nudge techniques): services should not "use reward loops … that
exploit human susceptibility to reward/pleasure-seeking behaviours in order to keep children engaged
in their game", and lists "strategies used to extend user engagement" as potentially detrimental. The
same standard explicitly *endorses* nudges that support wellbeing.

- <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/>

Consequence, and it is a design constraint rather than a nicety: **slowing the loop moves with this
standard; a daily cap, streak, or come-back-tomorrow mechanic would move against it.** That is why
§9 permanently excludes the time-based levers even though they would also solve §1.2.

### 2.5 The session budget the curve must be tuned against — *research*

AAP/WHO guidance is ~1 hour/day of high-quality screen use at ages 2–5; several bodies say 30
minutes. Children using apps **more than 30 min/day scored lower on inhibition** than lighter users.

- <https://pmc.ncbi.nlm.nih.gov/articles/PMC10186096/>
- <https://kidshealth.org/en/parents/screentime-preschool.html>

Consequence: the realistic unit is **10–20 minutes ≈ 3–8 rounds**. A curve should be judged by "what
happens in one sitting", and today's answer is "up to 8 stickers, most of a chapter".

### 2.6 Set completion, and fewer symbolic elements — *research*

A systematic review of gamification in preschool/early-primary education finds points, levels and
immediate feedback do sustain repeated practice, and that benefits are **stronger in preschoolers
than in K–3** — but records that "particular game elements, such as competition or badges, appeared
to produce stress for some children."

- <https://www.mdpi.com/2073-431X/15/7/464>

Consequence: the ceremony should carry the *picture*, and shed the symbolic instrumentation around
it. This is the evidence behind §5, not just taste.

### 2.7 What "9" means to a 5-year-old — *research*

Most 5-year-olds recite past 20 and identify multi-digit numerals above chance; precise 0–100
magnitude is a 6–8-year-old competence acquired through counting and two-digit arithmetic.

- <https://siegler.tc.columbia.edu/wp-content/uploads/2019/02/Siegler2016-magknow.pdf>
- <https://www.child-encyclopedia.com/numeracy/according-experts/numerical-knowledge-early-childhood>

Consequence: this child can *read* the badge, but its meaning is inferred. It earns **one small
element attached to the thing it counts** — not a row of its own in the ceremony. This is the
narrowest possible reading of Reward Horizon D1, and it keeps that decision intact.

---

## 3. Owner decisions

| # | Decision |
|---|---|
| **D1** | **A sticker costs ~3 rounds.** `xpToNext = level <= FAST_SLOTS ? REWARD_XP : REWARD_XP * 3` (40 → 120). |
| **D2** | **`FAST_SLOTS` becomes 9** (was 18). Chapter 1 is the tutorial page: one sticker per round. Slot 10 onward costs 3 rounds. |
| **D3** | **Exactly two tiers, still.** CLAUDE.md's "two tiers only, never a third" is unchanged — only the multiplier and the boundary move. |
| **D4** | **The ring becomes a gauge with a gap at the bottom**, the badge seated in the gap. Occlusion becomes structurally impossible. |
| **D5** | **The "+N" flyer is deleted.** At ~4 % per answer the numeral is meaningless to a pre-reader, and it is the second number on a 46px control. |
| **D6** | **The ceremony is one picture on a solid screen.** Dot grid deleted, "Nyt klistermærke!" banner deleted, the count folded into the sticker frame, chapter/book completion split into a *second* beat, scrim made near-solid, sticker grown 150 → 230px. |
| **D7** | **The mid-game crossing goes quiet.** Keep the full-colour flash and ring pop; drop the in-game confetti burst. One quiet promise, one loud payoff. |
| **D8** | **Chapters 9–10 are specified, not rendered.** Subjects, ids, labels and silhouette risks are settled here so extending later is data + art + prebake with no design work left. |
| **D9** | **`xpForSlots(n)` becomes a real export.** The formula is currently hand-copied in four places, one of them shipping code. |

Owner answers given during planning, recorded so they are not re-litigated: pace = ~3 rounds per
sticker; content = pace change now, next chapters planned not shipped; ring number = gap in the ring;
ceremony = "do whatever you recommend … keep it simple and focused for the enduser."

Two refinements were made *on top of* those answers and must be read as deliberate:

- **`FAST_SLOTS = 9`, not the previewed 4.** "The first page is fast" is a rule the child can
  experience (chapter 1 fills, the page-complete beat is taught early); "the first four" is not.
  Totals differ by <5 % either way — see §4.1.
- **The gap is centred at the bottom (6 o'clock), not bottom-right.** Symmetric, stable at every
  `size`, and bottom-centre is the one edge of the ring nothing else in the header competes for.

---

## 4. The economy

### 4.1 The new curve

```ts
export const REWARD_XP = 40   // unchanged — one completed round
export const FAST_SLOTS = 9   // was 18: chapter 1 lands one-per-round
export const xpToNext = (level: number): number =>
  level <= FAST_SLOTS ? REWARD_XP : REWARD_XP * 3   // was * 2
```

`taskXp`, `roundXp`, `BROWSE_TASK_XP`, `collectedFromLevel`, `BLOOM_STAGE_XP` and every derived read
model are **untouched**. The whole change is one ternary.

| | today | after D1+D2 | after chapters 9–10 |
|---|---|---|---|
| XP for the full book | 5 040 | **7 920** | 10 080 |
| slots | 72 | 72 | 90 |
| rounds of ordinary play (≈46 XP) | ~110 | **~172** | ~219 |
| range (62 XP best → 40 XP flat) | 81 – 126 | **128 – 198** | 163 – 252 |
| at 3 rounds/day | ~5 weeks | **~8 weeks** | ~10 weeks |
| at 10 rounds/day | ~11 days | **~17 days** | ~22 days |
| arc per answer | 12.5 – 15 % | **4.2 – 5 %** | — |
| arc per round | ~115 % | **~38 %** | — |

Read the last two columns honestly: **the pace change alone buys ~1.6×, and a hard player still
finishes in under three weeks.** Pacing is the fix for how the ring *feels*; content is the only real
fix for the horizon. That is why D8 pre-specifies chapters 9–10 rather than leaving them to a future
design pass.

### 4.2 What the multi-grant path becomes

`MAX_ROUND_XP = 62`. A single round can cross two slots only while a slot costs ≤ 62 — i.e. **only
inside the fast tier**. Past slot 9 the trailing-grants path in `RewardOverlay` becomes unreachable
from play.

**Keep the code anyway.** It is still the net for a cross-device CRDT merge (the XP ledger is a
G-Counter; two devices that each played offline sum), and `grantPendingRewards()` handing over every
owed slot in one commit is a load-bearing invariant, not an optimisation. Update the comment at
`progression.ts:120-128` to say so.

### 4.3 `xpForSlots` — the four hand-copies (D9)

`min(n, FAST_SLOTS) × REWARD_XP + max(0, n − FAST_SLOTS) × REWARD_XP × 2` appears verbatim in:

| file | line | kind |
|---|---|---|
| `src/utils/devHarness.ts` | 85 | **shipping code** — the `?rewards=n` seed |
| `src/services/progressStore.test.ts` | 26 | test helper |
| `src/config/progressSchema.test.ts` | 31 | test helper |
| `src/config/progressMerge.test.ts` | 27 | test helper |

The `× 2` is precisely what D1 changes. Left alone, the dev harness would silently seed the wrong XP
for every seeded screenshot and verification walk in §8 — a wrong *baseline*, which is worse than a
failing test. So W1 lands this first, green against the current curve, as its own commit.

```ts
// Total lifetime XP needed to have been AWARDED n reward slots. Derived by walking the curve so a
// tier change can never leave a hand-copied multiplier behind (it was copied in 4 places, one of
// them the ?rewards=n dev seed).
export const xpForSlots = (slots: number): number => {
  let xp = 0
  for (let level = 1; level <= Math.max(0, Math.floor(slots)); level++) xp += xpToNext(level)
  return xp
}
```

---

## 5. The ring (D4, D5)

### 5.1 The gauge

`src/components/common/RewardRing.tsx`. A 260–270° arc with the gap centred at the **bottom**; the
badge sits in the gap.

```
      ▁▁▁▁▁▁▁
   ▟           ▙        arc starts bottom-left, sweeps CLOCKWISE
  █      🐻      █       up the left, over the top, down to bottom-right
   ▜           ▛
      ▔  (9)  ▔         badge seated in the gap — never under the arc
```

SVG implementation:

- `transform: rotate(${90 + gapDeg / 2}deg)` — a `<circle>`'s dash pattern starts at 3 o'clock, so
  this puts the arc's start at the gap's trailing edge, sweeping clockwise.
- track: `strokeDasharray: '${c * sweepFrac} ${c * (1 - sweepFrac)}'` where
  `sweepFrac = (360 − gapDeg) / 360`
- fill: `strokeDashoffset: c * (1 − sweepFrac * fill)` (today's `c * (1 − fill)`)
- everything else — `strokeLinecap: 'round'`, the 0.6s overshoot easing, the glow — unchanged.

### 5.2 The gap is DERIVED from the badge, not tuned

The repo's standing rule (`.claude/rules/responsive-design.md`: *reserve the space, don't tune a
percentage*) applies literally. A fixed 90° gap **fails at the smallest shipped size**: at
`size = 34` (phone landscape) `r = 15` and the badge floor is 20px, so the badge subtends
`2 · asin(10 / 15) = 83.7°` and would sit 6° from touching the arc on both sides.

```ts
// Half-angle the badge occupies as seen from the ring centre, + a stroke's breathing room.
const gapDeg = clamp(90, 2 * degrees(Math.asin((badgeSize / 2 + 3) / r)), 120)
```

and **lower the badge floor to 16px when `compact`** — 20px on a 34px ring is 59 % of the diameter,
which is the actual defect behind the tight fit. With that: `size 34 → gap ≈ 94°`, `size 46 → 90°`,
`size 52 → 90°`.

Guard it with a **pure geometry unit test** (no DOM): for every shipped size — 34, 44, 46, 48, 52 —
assert `badgeSubtend(size) + 8° ≤ gapDeg(size)`. Sizes come from the three call sites
(`GameShell.tsx:148-154`, `GameSelectionLayout.tsx:156-160`, `HomePage.tsx:229-234`); pin them as a
literal list in the test with a comment naming the sites, so adding a fourth size at a new size
fails loudly.

### 5.3 The flyer goes (D5)

Delete the `<AnimatePresence>` flyer block (`RewardRing.tsx:251-280`), the `flyers` / `flyerId` state,
and the now-unused `compact` branch that existed only to suppress it. `compact` survives — it still
drives `size` and now the badge floor.

The ring's transient beats after this: the pop/tick on every grant, and the 900ms full-colour flash
on a crossing. Both keep working off `xpBus`.

---

## 6. The ceremony (D6)

`src/components/common/RewardOverlay.tsx` + `src/components/common/StickerReveal.tsx`.

### 6.1 What the plain grant looks like

Near-solid scrim → **the sticker at ~230px, its Danish name, and a small count badge on the frame's
corner** → confetti → one spoken line. Nothing else.

| element | today | after |
|---|---|---|
| scrim | `rgba(255,250,235,0.92)` radial, menu readable through it | **near-solid** (~0.99, keep the warm/dark split, drop the see-through gradient) |
| "Nyt klistermærke!" banner | `StickerReveal.tsx:69` | **deleted** — two texts around one picture is the clutter, and the spoken line already says it |
| the sticker | 150px (96 phone-landscape) | **~230px** (~120 phone-landscape, re-measured) |
| its label | kept | **kept** — it is what is spoken, and what appears in the book |
| 3×3 dot grid | `RewardOverlay.tsx:249-288` | **deleted** — a 5-year-old cannot read "4th of 9"; the book is one tap away and shows it properly |
| count disc | its own row, `:296-304` | **folded into the sticker frame** as a corner badge |
| companion + headline | stacked in the same column | **a second beat** (§6.3) |

### 6.2 The count badge, folded in

Keep `RewardCounter` as a component — it owns its own timers, carries `data-reward-count`, and the
tick-up *is* Reward Horizon §4.4's beat ("a sticker landed" and "the number grew" are one event").
Render it **inside `StickerReveal`'s frame**, bottom-right corner, same flat-disc grammar as the ring
badge. One object with a number on it, exactly like the ring — so the child recognises it as the same
thing, and the ceremony loses a row without losing the beat.

Do **not** delete the number. It would then change while nobody is looking (the grant happens at the
start of the beats effect, so the ring behind the scrim has already ticked by dismiss), which is the
one failure mode Reward Horizon D6 exists to prevent.

### 6.3 Chapter and book completion become a second beat

Today a chapter close renders reveal + dots + counter + companion + headline in one column — the
owner's screenshot. Instead: **two states in the overlay.**

1. `'sticker'` — exactly §6.1, identical to a plain grant. Dwells `STICKER_MS`.
2. `'chapter'` — replaces it: the `ProgressionCompanion` stepping up, and
   `Hele siden er samlet!` / `Hele bogen er samlet!`. Dwells `CHAPTER_BEAT_MS`, then dismisses.

A plain grant never enters state 2. `celebrateTier` moves with the beat: `'levelup'` on state 1,
`'page'` on state 2 for a chapter (book-done keeps `'levelup'` for the finale).

### 6.4 Audio — the one real risk in this PRD

Today the ceremony speaks **exactly one** line, and a chapter close *replaces* the reward name with
`CHAPTER_DONE_LINE`. Splitting the beats means the child can hear both:

- state 1 speaks `rewardLine(headline.reward.label)` — always, so they always hear what they got
- state 2 speaks `CHAPTER_DONE_LINE` / `BOOK_DONE_LINE` on mount

There is **one TTS channel and no queue** — new audio cancels current. So `STICKER_MS` must be **≥
the measured length of the reward-name clip plus the shared `<audio>` element's ~250ms startup**, or
the chapter line truncates the sticker's name mid-word.

Per `.claude/rules/audio-system.md`: **measure it, don't guess, and never `await` narration to pace
the transition.** These are already-prebaked clips, so:

```bash
# longest rewardLine clip across all 72 labels
node -e "…" # resolve the cache keys, then per file:
ffmpeg -i public/sounds/tts/<key>.mp3 -af silencedetect=noise=-45dB:d=0.04 -f null - 2>&1
```

Take the max spoken end across the 72 `rewardLine` clips, add the 250ms startup, round up, and put
that number in a named constant with the measurement in the comment. **No new strings are introduced,
so no prebake pass and no audit sign-off is needed.**

If the measurement comes out awkwardly long (> ~3s), the fallback is to keep today's single-line
behaviour (chapter close replaces the name) and let state 2 be silent. Take that fallback rather than
shipping a truncation.

> **MEASURED, and the FALLBACK WAS TAKEN.** `ffmpeg silencedetect=noise=-45dB:d=0.04` over all 72
> prebaked `rewardLine` clips: longest spoken end **3.054s** ("Nyt klistermærke! Mariehøne"; its mp3 is
> 3.96s, the remainder is Azure padding), shortest 2.532s ("And"). Plus the ~250ms element startup that
> is **3.304s — over the ~3s bar**, and splitting the audio would have made a chapter ceremony 6.5s+ of
> two utterances. So state 2 is silent and the chapter line plays across both beats. Still exactly one
> spoken line per ceremony.
>
> `STICKER_MS = 3400` comes from the same measurement. Note the old `DISMISS_MS = 3200` was already
> below it — the longest names were being cut off ON SCREEN, though not in the audio: nothing stops
> `SimplifiedAudioController` when the overlay unmounts, so the clip finished playing regardless.

### 6.5 Layout budget

`RewardOverlay` sizes by prop, not `transform: scale()`, because the tall variant already overflowed a
390px-tall viewport once (see the comment at `RewardOverlay.tsx:97-100`). Splitting the beats *removes*
the tall variant, which is most of the headroom — but the sticker growing to 230px spends it again. So
re-measure both states at all three viewports (§8.4). Phone-landscape sticker is a re-measured value,
not `230 × ratio`.

---

## 7. The quiet crossing (D7)

`RewardRing.tsx:135` — a `flourish` (in-game) crossing currently fires
`celebrateTier('levelup-mini')`: confetti + the `level-up` cue, mid-play. The full ceremony then fires
minutes later on the result screen or the next menu. **Two celebrations for one event**, and with the
old pacing they happened every round.

After D1 a crossing happens roughly every third round, which makes it worth marking — but as a
*promise*, not a payoff. Keep the ring pop and the 900ms full-colour flash (that beat teaches the
whole model); replace the tier call with a **soft cue only**.

While in there: `CelebrationEffect.tsx:175-200` already defines `round`, `best` and `sticker` tiers
with **no call sites anywhere** — `sticker` has been dead since the reveal moved into the overlay.
Note it in the commit message; **do not prune them in this PRD** (it is a separate, wider cleanup and
`celebrateTier` is public API).

---

## 8. Verification

### 8.1 The suite

`npm run build && npm test && npm run lint`. Expect real edits — not number bumps — in:

- `src/config/progression.test.ts` — line 28 asserts `FAST_SLOTS === CHAPTER_SIZE * 2` (→ `* 1`); the
  `xpToNext` / `levelFromXp` literals at 38–70 and the tier-boundary probes at 145–161 must be
  **re-derived from `xpForSlots`**, not re-typed. `levelFromXp(62).xpIntoLevel === 22` stays true
  (level 1 still costs 40).
- `src/services/progressStore.test.ts` — the `FAST_SLOTS`-boundary grant walk at 191–210.
- `src/config/progressSchema.test.ts`, `src/config/progressMerge.test.ts` — via `xpForSlots`.
- `src/components/rewardSurfaces.test.ts:109-120` — asserts the ring contains `+{f.amount}`. That
  assertion **must be replaced, not just removed**, by one pinning the gauge (a gap exists; the fill
  offset uses `sweepFrac`). It still must assert the ring contains no `REWARD_SLOTS` and no
  `xpToNextLevel` — no distance on the ring, ever.

### 8.2 Pacing, by simulation

Extend `progression.test.ts`'s round-walk (~line 251) to pin the new economy **as literals**:

- `xpForSlots(REWARD_SLOTS) === 7920`
- a flat-40 walk fills the book in 198 rounds; a 62-XP walk in 128
- `MAX_ROUND_XP < xpToNext(FAST_SLOTS + 1)` → no single round crosses two slots past the fast tier
- a round *can* still cross two inside the fast tier (keeps the trailing-grant path honest)

### 8.3 Ring geometry, by measurement

- the pure geometry test from §5.2 (all five shipped sizes)
- then in the browser with `?rewards=n`: screenshot the ring at fills ~0.1 → ~0.9 and assert the
  badge's rect **does not intersect the swept arc band**, at every size and on **all 4 skins** — the
  arc colour is a per-skin token (`theme.scene.progressionCompanion.ringColor`) and `scene.dark` flips
  the silhouette treatment. Use the `ui-screenshot` skill's `--measure`, never eyes.

### 8.4 The ceremony, at three viewports

`1024×768`, `844×390`, `667×375` × {a light skin, a dark skin} × {plain grant, chapter close}.

- Regnbue or Havet specifically for the light case — the current scrim's failure is cream-on-cream.
- assert the column's bottom is inside the viewport (the overflow this file was already burned by)
- **hit-test** `document.elementFromPoint(cx, cy)` at the scrim centre → the overlay, not a menu tile
- assert the menu is *not* legible behind the scrim: sample a pixel where a game tile sits and check
  it against the scrim colour

Seeds: `?rewards=8` then finish a round → plain grant; cross into slot 9 → chapter close;
`?rewards=71` → book close. `?rewards=n&celebrate=0` suppresses the overlay for baseline shots.
Verify `?rewards=n` seeds correctly *after* W1 — that is the whole point of doing W1 first.

### 8.5 Re-break — mandatory

Run `/re-break`. Each new guard must go red when **its own** fix is reverted:

- revert `xpToNext`'s `* 3` → the §8.2 pacing pin fails
- put the badge back at bottom-right → the §5.2 geometry test fails
- restore the fixed-90° gap → the geometry test fails at `size = 34`

Breaking something adjacent and watching the suite stay green proves nothing — that is how two
vacuous tests survived a re-break pass in the accounts session. And the surface-reading assertions
**strip comments before matching**: a prose comment explaining a fix has satisfied an
`includes()` check here before, leaving the deleted fix green.

### 8.6 Play-test

On the iPad (iPadOS 17.7 floor, Safari **and** installed PWA): the ring should move about a third per
round, a sticker should take about three, and the ceremony should show one picture.

---

## 9. Out of scope — permanently

Carried forward from Reward Horizon §9, plus what this PRD adds:

- **No third XP tier.** Two only. That is what the extra chapters exist to avoid.
- **No difficulty-dependent XP.** A harder level must never cost rewards (mirrors the star
  thresholds, where Svær is deliberately *more* forgiving).
- **No time-based levers**: no daily cap, no "one sticker per session", no streaks, no daily goals,
  no come-back-tomorrow. They would solve §1.2 and they are precisely what ICO standard 13 names
  (§2.4). A slower loop is the allowed instrument.
- **No randomness in the path.** No mystery rewards, no loot-box shape, no `shuffle()` — determinism
  is what lets the ring preview a prize before it is earned.
- **No currency and no shop.** (ABCmouse's ticket store is the obvious comparable; it is a second
  economy and a second number.)
- **No second door to Min Bog** on any surface.
- **No reordering or inserting** in `REWARD_PATH`. Append-only, forever.
- **The gold pass stays deleted.** A full book means it is time to add a chapter, not to recycle a
  prize.

---

## 10. Chapters 9–10 — the spec (D8)

Not built here. Settled here so building it later is data + art + prebake, per Reward Horizon §10.

**Chapter 9 — `toej` "Tøj"**

| slot | id | label |
|---|---|---|
| 73 | `toej-stoevle` | Støvle |
| 74 | `toej-hat` | Hat |
| 75 | `toej-sok` | Sok |
| 76 | `toej-troeje` | Trøje |
| 77 | `toej-bukser` | Bukser |
| 78 | `toej-jakke` | Jakke |
| 79 | `toej-vante` | Vante |
| 80 | `toej-paraply` | Paraply |
| 81 | `toej-briller` | Briller |

**Chapter 10 — `vejr` "Vejr og himmel"**

| slot | id | label |
|---|---|---|
| 82 | `vejr-sol` | Sol |
| 83 | `vejr-maane` | Måne |
| 84 | `vejr-sky` | Sky |
| 85 | `vejr-regnbue` | Regnbue |
| 86 | `vejr-lyn` | Lyn |
| 87 | `vejr-regndraabe` | Regndråbe |
| 88 | `vejr-snemand` | Snemand |
| 89 | `vejr-drage` | Drage |
| 90 | `vejr-vindmoelle` | Vindmølle |

Ids are ASCII-folded, matching the existing convention (`dyr-faar`, `kt-baad`, `hj-doer`, `sk-hoene`).

**Silhouette risks** — `.claude/rules/scene-assets.md`: the ~24px ring silhouette **is** the
acceptance test, not the thumbnail. That is why `leg-floejte` became `leg-xylofon`. Check these pairs
before accepting renders, and swap the subject rather than re-rendering a losing shape:

- Hat vs Vante (both soft blobs) — give the hat a brim
- Sol vs Regnbue (both radial) — the rainbow must read as an open arc
- Sky vs Snemand (both lobed) — the snowman needs two clear stacked circles

Subjects deliberately **avoided** for this reason: Sko (vs Støvle), Hue (vs Hat), Stjerne and Snefnug
(vs Sol, and vs each other).

**Landing them:** append to `REWARD_CHAPTERS`; render 18 keyed soft-3D WebP (≤20 KB each) into
`src/assets/rewards/` — `rewardArtCoverage.test.ts` is red until every id resolves, which is the gate
working; bump the two pinned literals in `stickers.test.ts` (72 → 90, 8 → 10) leaving `FROZEN_FIRST_45`
untouched; `npm run tts:prebake` (18 labels × `rewardLine` + bare label = 36 clips) and commit the
mp3s + `prebakedTts.ts`; `npm run audit:check` → `npm run audit:approve-all` → commit `docs/audit/*`.
No code.

---

## 11. Work packages

Ordered so each lands green on its own. Nothing here needs art.

| W | Scope |
|---|---|
| **W0** | Land this PRD (and fix the Reward Horizon PRD's stale `NOT implemented` header + W-table — the whole release shipped in `4d283e1` / `b5dbbff` / `34935a1`). |
| **W1** | **`xpForSlots` (D9).** Add it to `progression.ts`; replace the four hand-copies. **Green against the current curve** — its own commit, so W2's blast radius is visible. |
| **W2** | **The curve (D1–D3).** `FAST_SLOTS = 9`, `* 3`. Update the header comment's pacing promise and the `MAX_ROUND_XP` note (§4.2). Re-derive the four affected test files (§8.1) + the §8.2 pins. |
| **W3** | **The ring (D4, D5).** Derived gap, bottom-centre badge, compact badge floor 16, delete the flyer. Pure geometry test + replace the `rewardSurfaces` flyer assertion. |
| **W4** | **The ceremony (D6).** Solid scrim, drop the dots and the banner, fold the counter into the frame, split the chapter beat, re-time the dwells off a **measured** clip length (§6.4). |
| **W5** | **The quiet crossing (D7).** Soft cue instead of `levelup-mini`; note the three dead tiers without pruning them. |
| **W6** | **Docs.** CLAUDE.md's Reward Book bullet: curve numbers, ceremony element list, ring gauge/badge. Keep the "two tiers only" wording — it is still true. |
| **W7** | **Verification** (§8) incl. the `/re-break` pass, then the owner iPad play-test. |

### Files touched

- `src/config/progression.ts` · `progression.test.ts`
- `src/utils/devHarness.ts`
- `src/services/progressStore.test.ts` · `src/config/progressSchema.test.ts` · `src/config/progressMerge.test.ts`
- `src/components/common/RewardRing.tsx` · `RewardOverlay.tsx` · `StickerReveal.tsx`
- `src/components/rewardSurfaces.test.ts`
- `CLAUDE.md` · `plans/reward-horizon/tmp-prd-reward-horizon-01-one-number-one-book.md` (header only)

Deliberately **not** touched: `progressStore.ts`, `progressSchema.ts`, `progressMerge.ts`,
`stickers.ts`, `StickerAlbum.tsx`, `RoundResultScreen.tsx`, `api/progress.ts`. The persisted schema,
the CRDT merge and the reward path are all unchanged — this is a curve constant, a stroke geometry
and an overlay's element list.

---

## 12. Invariants that must survive

All currently guarded; none of them is relaxed by this PRD.

- `collectedFromLevel(level) = level − 1`. The invariant is an **inequality**
  (`grantedSlots ≤ collectedFromLevel(globalLevel())`) and the gap **is** a pending ceremony.
- The child-facing number is `grantedSlots`. **`globalLevel()` appears nowhere**, child- or
  adult-facing.
- The number is **never a distance** — no denominator, percentage or "n to go" on a child surface.
  `BarnPane`'s `n af 72` stays adult-only.
- **Exactly one door** to `/album` per surface; the ring is it. The in-game ring keeps its handler
  (owner, 2026-08-03 — don't re-mute it).
- The in-game header holds **the ring and nothing else**.
- `taskXp` stays normalised — "a round is a round" — and XP is **never** difficulty-dependent.
- `REWARD_PATH` is **append-only and never shuffled**; `FROZEN_FIRST_45` untouched.
- Rewards are granted **only** by the ceremony, every owed slot in one commit; `RewardWatcher` stays
  gated off `game` routes so play is never interrupted.
- **Two tiers only.** Still true.

---

## 12b. What the implementation found that this document did not predict

- **The curve is CONVEX, so `progressMerge`'s level clamp is not "repair-only".** That comment carried a
  proof stated over `max_i slots_i`, but the cursor is `Σ slots_i`, and Σ`xpForSlots(nᵢ)` <
  `xpForSlots(Σnᵢ)` — so two perfectly valid offline devices can sum to more slots than their summed XP
  justifies and the clamp fires on good data. **Not introduced here**: the old 18/×2 curve did it at
  15 + 15 slots; 9/×3 moves the threshold down to 5 + 5. The merge LOGIC is untouched (§11's "not
  touched" holds) — the false proof is corrected in a comment and the behaviour is now pinned by a
  CONVEXITY test rather than waiting to surface as a bug report. Three existing merge tests used
  slot counts that straddle the new boundary and were re-based inside the fast tier, since they measure
  `newIds` / `rev` / the G-Counter, not the clamp.
- **§5.2's `badgeSubtend + 8° ≤ gapDeg` omits the rounded linecap**, which is real paint: at `size = 34`
  it is 7.6° per end, most of the clearance that formulation thinks it has. The shipped geometry test
  asserts the cap-aware clearance instead and keeps the PRD's simpler form alongside it.
- **Neither half of the size-34 fix breaks the clearance assertion alone** — a fixed 90° gap with the
  16px floor still clears (5.1°), and a 20px floor with the derived gap opens it to 120° and also
  clears. Only both together fail (−4.5°). The re-break covers all three.
- **The count badge can never reach three digits, and the derived gap does not allow for it.** The pill
  widens by 8px at 3 digits, which is not in `badgeSubtendDeg`; at `size = 34` that pill subtends 106°
  against its own 94° gap. `REWARD_SLOTS < 100` is guarded — chapters 9–10 take it to 90.

## 13. Two-liner prompt to start implementation

> Implement `plans/reward-pacing/tmp-prd-reward-pacing-01-slower-book-focused-ceremony.md` end to end
> on master, W1→W7 in order (chapters 9–10 are spec only — no renders, no prebake).
> Run `npm run build && npm test && npm run lint`, verify the ring and both ceremony states at
> 1024×768 / 844×390 / 667×375 on a light and a dark skin, and use `/re-break` to prove the new
> pacing pin and the ring-geometry guard actually go red when their own fix is reverted.
