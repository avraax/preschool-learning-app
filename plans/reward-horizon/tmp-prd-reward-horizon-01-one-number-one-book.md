# PRD — Reward Horizon: one number, one book, one ring, one door

> **SUPERSEDED IN PART, 2026-08-08 — `plans/endless-play/tmp-prd-endless-play-01-no-round-end.md`.**
> §4.5's deferred ceremony is reversed: it now fires **in-game, at the seam**, the moment the ring
> crosses a slot, instead of waiting for a round result or the next menu. One number / one book / one
> ring / one door are all unchanged, and so is the rule that `globalLevel()` appears nowhere.

Status: authored 2026-08-02, **IMPLEMENTED 2026-08-03** — commits `4d283e1` (the release),
`7edaaa6` + `b5dbbff` (chapters 6–8 art), `34935a1` (the in-game ring opens Min Bog), `e8877dc`
(debrief). Three deliberate deviations from what is written below are listed in §5. Its **economy** was
subsequently re-tuned by Reward Pacing PRD-01
(`plans/reward-pacing/tmp-prd-reward-pacing-01-slower-book-focused-ceremony.md`) — §3.4's curve and
§4.4's ceremony layout are superseded there; every decision D1–D7 still stands.

Supersedes the child-facing parts of Reward Book PRD-01 §D9 (which deliberately removed every level
number) and Liveliness PRD-04 §7 (which de-emphasised the Min Bog shelf).

---

## 1. Context — why this change

Two things the owner is unhappy with today:

1. **There is no long-term lure.** The reward path is exactly 45 slots. Past slot 45 the system
   wraps into "gold" duplicates (`pathIndexForSlot`: `(slot - 45) % 45`) — the child re-earns
   things they already own, with a "skinnende" line instead of "nyt". That is no new information
   and no new horizon. An earlier build had an ever-rising level number ("Trin {level}! 🎉",
   deleted in commit `746d889`) which the owner liked precisely because it never ended.

2. **"Min Bog" on the front page feels disconnected.** Stickers are earned by the ring in the
   top-right corner filling up, but the book that holds them is a separate gold pill at the bottom
   of the home screen. The child has to learn that two unrelated-looking objects are the same
   system. (The pill's own code comment still describes a design — "the LEVEL is the primary
   reward" — that was removed a year of commits ago.)

**Intended outcome.** One coherent model the child can read without being told:

> **One number. One book. One ring. One door.**
> The ring fills → a sticker lands in the book → the number goes up. Tap the ring, you're in the
> book. The book keeps getting longer, so the number never stops.

### 1.1 The evidence, and the owner's ruling on it

A deep research pass — kept beside this file at
`plans/reward-horizon/research-progression-evidence-2026-08-02.md`, every claim carrying a URL and
every source labelled research / regulation / advocacy / marketing — found the case against a
child-facing number is strong:

- Rote counting range ≫ number understanding. A 5-year-old who counts to 70 still cannot construct
  or compare a set of 37 (Give-N / cardinal-principle literature).
- Number-line estimates are **logarithmic** at kindergarten age and only become linear around Grade
  2 (Siegler & Booth 2004) — a number cannot be mapped to "how far along am I".
- NN/g watched a **7**-year-old ask *"what does this '2' mean?"* on screen.
- Goal-gradient (Kivetz 2006) and endowed progress (Nunes & Drèze 2006): motivation lives in a
  **visible finite** target. An endless counter has no gradient to climb.
- "Endless counter as a long-term lure" is Zagal's **GRINDING** dark pattern, and EU Commission
  Art. 28 guidance (C/2025/5519 ¶61(b)) names *"the creation of virtual rewards for performing
  (repeated) actions"*. None of it is binding on this app (not an online platform, no commercial
  practice), but it is the standard the category is judged by.

**Owner ruling (2026-08-02): ship the number anyway, on every surface including the corner ring.**
That decision is recorded, not re-argued. This PRD implements it in the least harmful available
shape, and takes the parts of the evidence that cost nothing:

- **The number equals the sticker count.** There is no second track and no off-by-one — the number
  is literally "how many pictures are in my book", which is the one magnitude a 5-year-old *can*
  read, because it has a countable referent sitting right there.
- **The number is never a distance.** No "22 til næste", no percentage, no "n / 72" on any
  child-facing surface. Only the ring's fill signals nearness.
- **The number is plain.** A flat disc and a numeral — no soft-3D depth, no gradient, no
  embellishment (Hiniker 2016: decorating a symbolic progress element measurably *increases*
  cognitive burden for preschoolers).
- **The numeral is spoken where it appears as a total** (Sesame Workshop's rule: a numeral appears
  when it is being counted aloud). Arriving in Min Bog speaks *"Du har treogtyve klistermærker!"*.
- **The horizon is real content, not a treadmill.** The number rises because the book genuinely
  gets longer — chapters 6, 7, 8 — not because a counter increments over recycled prizes.

Also adopted, cheap and evidence-backed: the ceremony's **9-dot chapter strip becomes 3×3**
(subitizing tops out at 4–5; nine countable units invites Boyer & Levine's "seduced by counting"
failure, and a 3-row grid makes each row readable at a glance).

---

## 2. Owner decisions

| # | Decision |
|---|---|
| **D1** | The rising number ships **everywhere child-facing**, including the corner reward ring. |
| **D2** | The endless axis is **new real chapters** (6, 7, 8 …), each 9 slots. Not gold duplicates, not a world-only growth mechanic. |
| **D3** | **The ring is the ONLY door.** Tapping the reward ring on home and every section menu opens Min Bog. The front-page Min Bog pill is **deleted** — two doors to the same place on one screen taught nothing the ring doesn't, and home gets the space back. (Owner ruling 2026-08-02, revised from "restyle the pill".) |
| **D4** | **Art is not the constraint.** This PRD ships 3 new chapters (27 renders). The data model must make chapter 9+ a pure content addition. |
| **D5** | Name stays **"Min Bog"**. Nothing is renamed — the confusion was structural (two objects, one system), not lexical, and "Min Bog" is already spoken, prebaked and understood. |
| **D6** | The displayed number is **`grantedSlots`** — rewards actually handed over — never `globalLevel()`. See §3.1; this is the single largest correctness hazard in the change. |
| **D7** | **The gold pass is deleted outright** — flag, narration line, shimmer, duplicate counts, wrap. The book ends at its last authored chapter and the number stops there. See §3.5. (Owner ruling 2026-08-02.) |

---

## 3. The model

### 3.1 The number — exactly one definition, in one place

Today `collectedFromLevel(level) = level - 1`. Displaying `globalLevel()` would show *collected + 1*
— the exact off-by-one that Reward Book PRD-01 removed, and which `ProgressionCompanion.tsx:20-22`
still carries a comment warning about. Do not do that.

Add to `src/config/progression.ts`:

```ts
// THE child-facing number. Equals the count of rewards in the book, always, on every surface.
// It is grantedSlots — what the ceremony has actually handed over — NOT collectedFromLevel(level),
// which is the debt CEILING and runs one ahead during a pending ceremony.
export const rewardNumber = (grantedSlots: number): number => Math.max(0, Math.floor(grantedSlots))
```

and expose `progressStore.rewardNumber()` returning `rewardNumber(this.grantedSlots())`.

**Consequence, and it is the correct behaviour:** mid-game, when the ring crosses a slot, the ring
flashes the won prize to full colour and fires `levelup-mini` — but the **number does not move
yet**, because the sticker has not been handed over yet (`grantPendingRewards()` runs only in
`RewardOverlay`, and `RewardWatcher` is gated OFF game routes so the ceremony never interrupts
play). The number ticks up **in the ceremony**, with the sticker reveal. That is a two-beat the
child can learn: *ring full → prize flashes* … *ceremony → sticker lands and the number grows*.

The alternative (number = `collectedFromLevel(globalLevel())`) would let the ring badge and the
book header disagree by one for the 2.5 s `RewardWatcher` grace — and since D3 makes the ring the
door into the book, that is a very likely path. Rejected.

`collectedCount()` (distinct ids) stays what the **book's chapter counts** use. With the gold pass
gone (§3.5) there are no duplicates, so `rewardNumber() === collectedCount()` **always** — assert it.

### 3.2 The path becomes open-ended

`REWARD_SLOTS` and `CHAPTER_COUNT` stop being literals and become **derived from
`REWARD_CHAPTERS`**. Every consumer already imports them, so nothing else moves.

```ts
// src/config/progression.ts  — these must be derived, not typed.
export const CHAPTER_SIZE = 9
export const COMPANION_STAGES = 5   // NEW: baked companion art per world; decoupled from chapters
// REWARD_SLOTS / CHAPTER_COUNT move to stickers.ts (where REWARD_CHAPTERS lives) OR
// progression.ts imports the chapter count. Prefer: keep them in progression.ts as
//   export const CHAPTER_COUNT = REWARD_CHAPTERS.length
// which requires progression.ts → stickers.ts, but stickers.ts already imports progression.ts.
```

**Circular-import hazard — resolve it deliberately.** `stickers.ts` imports `chapterOfSlot` from
`progression.ts` today. Making `progression.ts` import `REWARD_CHAPTERS` creates a cycle that both
Vite *and* plain Node (`shared-narration-clips.js`) must tolerate. **Do not create the cycle.**
Instead:

- `progression.ts` keeps `CHAPTER_SIZE`, `COMPANION_STAGES` and all pure math, and drops
  `REWARD_SLOTS` / `CHAPTER_COUNT`.
- `stickers.ts` (which owns `REWARD_CHAPTERS`) exports:
  ```ts
  export const CHAPTER_COUNT = REWARD_CHAPTERS.length
  export const REWARD_SLOTS  = REWARD_PATH.length      // === CHAPTER_COUNT * CHAPTER_SIZE
  ```
- Every current importer of `REWARD_SLOTS`/`CHAPTER_COUNT` from `progression.ts` re-points to
  `stickers.ts`. Call sites (from `grep`): `progressSchema.ts`, `progressMerge.ts`,
  `progressStore.ts`, `StickerAlbum.tsx`, `HomePage.tsx`, `BarnPane.tsx`, `devHarness.ts`,
  `shared-narration-clips.js`, `ProgressionCompanion.tsx` (comment only).
- `companionStageForCollected` clamps on `COMPANION_STAGES - 1`, **not** `CHAPTER_COUNT - 1` —
  otherwise 8 chapters would index past the 5 baked companion stages. The companion finishes
  growing at chapter 5 and stays grown; it must never regress.

Everything downstream is already derived, so this alone makes the book extendable:
`pathIndexForSlot` wraps at 72 instead of 45, `nextReward()` stops returning `null` until 72,
`rebuildCollected` walks the longer path, `totals.totalStickers` re-derives.

**Append-only, forever.** Slots 0–44 must keep their exact rewards: `firstAt` is keyed by reward id
and `rebuildCollected` walks slots through the path, so reordering would silently re-assign every
existing child's book. New chapters are **appended after Havet**, never inserted. Guarded by a test
that pins the first 45 ids in order (§7).

*Gift, not a bug:* any child who somehow already holds gold duplicates (slot ≥ 45) will, on next
load, see those slots re-derive into the real chapter-6/7/8 rewards. Strictly better; no migration
needed. (Realistically nobody is there yet — see §3.5.)

### 3.3 The content of chapters 6–8

Chosen for **reward proximity** (Marinak & Gambrell 2008: a reward made *of the activity* beats a
decorative token — Teach Your Monster's "Trickies" are its sight words). Every label below is a
plain, high-frequency Danish noun that already overlaps the app's own word pools
(`letterWords.ts` / `ordlegWords.ts` / `englishVocab.ts`) — verify each against those pools when
implementing, and against the existing 45 for duplicates.

```ts
{ id: 'hjemmet', title: 'Hjemmet', rewards: [
  { id: 'hj-seng',   label: 'Seng'   }, { id: 'hj-stol',  label: 'Stol'  },
  { id: 'hj-bord',   label: 'Bord'   }, { id: 'hj-doer',  label: 'Dør'   },
  { id: 'hj-lampe',  label: 'Lampe'  }, { id: 'hj-ur',    label: 'Ur'    },
  { id: 'hj-kop',    label: 'Kop'    }, { id: 'hj-ske',   label: 'Ske'   },
  { id: 'hj-noegle', label: 'Nøgle'  },
]},
{ id: 'leg', title: 'Leg og musik', rewards: [
  { id: 'leg-bold',    label: 'Bold'    }, { id: 'leg-bamse',   label: 'Bamse'   },
  { id: 'leg-dukke',   label: 'Dukke'   }, { id: 'leg-klods',   label: 'Klods'   },
  { id: 'leg-ballon',  label: 'Ballon'  }, { id: 'leg-tromme',  label: 'Tromme'  },
  { id: 'leg-guitar',  label: 'Guitar'  }, { id: 'leg-floejte', label: 'Fløjte'  },
  { id: 'leg-puslespil', label: 'Puslespil' },
]},
{ id: 'smaakryb', title: 'Fugle og småkryb', rewards: [
  { id: 'sk-ugle',      label: 'Ugle'      }, { id: 'sk-and',       label: 'And'       },
  { id: 'sk-hoene',     label: 'Høne'      }, { id: 'sk-svane',     label: 'Svane'     },
  { id: 'sk-papegoeje', label: 'Papegøje'  }, { id: 'sk-sommerfugl',label: 'Sommerfugl'},
  { id: 'sk-bi',        label: 'Bi'        }, { id: 'sk-myre',      label: 'Myre'      },
  { id: 'sk-mariehoene',label: 'Mariehøne' },
]},
```

Deliberately avoids the existing chapters: `Dyr` is mammals (so birds/insects are a new set),
`Natur` already owns Sol/Måne/Stjerne/Sky/Regnbue (so no weather chapter).

### 3.4 Economy — unchanged curve, longer path

`xpToNext` stays two-tier (40 for slots 1–18, 80 thereafter). **Do not add a third, slower tier** —
that is precisely the grind the new chapters exist to avoid.

| | slots | XP | ≈ rounds |
|---|---|---|---|
| today | 45 | 2 880 | ~72 |
| after | **72** | **5 040** | **~126** |

`taskXp` / `roundXp` / `MAX_ROUND_XP` / `BROWSE_TASK_XP` / bloom: **untouched**. XP stays
difficulty-independent (fairness rule).

### 3.5 Delete the gold pass

Today, once every slot is collected the path **wraps** — `pathIndexForSlot: (slot - N) % N` — and
hands back duplicates flagged `gold`, announced "Skinnende klistermærke!" instead of "Nyt". It
carries its weight across the whole system: a `gold` flag on `RewardGrant`, a **second prebaked
narration line for every single reward** (72 clips after this PRD, essentially none of which will
ever play), the `isShiny` shimmer sweep in `StickerReveal`, the gold border + `×{count}` treatment
in `StickerAlbum`, and duplicate counting inside `rebuildCollected` — i.e. inside the CRDT-derived
layer that `api/progress.ts` shares, which is the most expensive place in this app to carry an
unexercised branch.

It also isn't a horizon. Re-earning a dog you already own is Zagal's GRINDING with a shinier
border; it is the fake version of exactly what chapters 6–8 provide for real.

**Remove it entirely.** Concretely:

- `progressSchema.ts` — delete `pathIndexForSlot` (it becomes the identity) and its call sites;
  `rebuildCollected` walks slots straight onto `REWARD_PATH` and no longer counts duplicates.
- `progressStore.grantSlot` — drop `gold`; `RewardGrant.count` is always 1 (consider deleting the
  field). **`grantPendingRewards` must now stop at the cap**: the XP ledger is a G-Counter that
  keeps climbing across devices, so `owedRewards()` has to clamp to `REWARD_SLOTS - grantedSlots`
  rather than relying on the wrap to always produce a reward. This is the one piece of real new
  logic in the removal — without it `rewardAt(slot)` returns `null` past the end.
- `danish-phrases.ts` — delete `goldRewardLine`; `shared-narration-clips.js` stops enumerating it
  (the prebake prune will delete the existing mp3s, which is expected output, not drift).
- `StickerReveal.tsx` — drop `isShiny`, the shimmer sweep and the "Skinnende!" banner.
- `StickerAlbum.tsx` — drop the gold border / sparkle / `×{count}` slot state.
- `RewardOverlay.tsx` — the `headline.gold` branch in the spoken-line choice goes.

**The book now has a real ending, and that is the point.** When the last authored chapter fills,
`nextReward()` returns `null`, the ring shows the existing full-book sparkle, `BOOK_DONE_LINE`
("Wow! Hele bogen er samlet!") fires, and the number rests. Make that state look deliberate rather
than accidental — it is a "du gjorde det", and it is the owner's cue that it's time to add chapter
9, which this PRD has made a pure data + art change. A frozen number is honest; a number that
climbs by re-handing things the child already owns is not.

*Nobody is affected.* No child is anywhere near slot 45, so there is no gold state in the wild to
migrate. If one somehow existed, `grantedSlots` re-derives from the ledger and those slots simply
resolve to the new chapters 6–8 — strictly better.

---

## 4. Surfaces

### 4.1 RewardRing — badge + door

`src/components/common/RewardRing.tsx`

- New prop `showCount?: boolean` (default `true`). Renders `progressStore.rewardNumber()` in a
  **flat, opaque disc at the bottom-right** of the ring: solid `ringColor` fill, white numeral,
  Comic Sans, no shadow, no gradient, no `softShadow`/`contactShadow`. Diameter ≈ `size * 0.46`,
  min 20 px; widens to a pill at 3 digits. Hidden when the number is 0 (an empty badge teaches
  nothing).
- Move the `+N` flyer's spawn from `left: 50%` to `left: 30%` so it does not fly through the badge.
- On a level-up the badge does **not** animate (it will not have changed — §3.1). It pops once,
  in the ceremony (§4.4).
- `onTap` stays an opt-in prop — **do not put routing inside this component**. Home and
  `GameSelectionLayout` pass `() => navigateWithTransition('/album')`; `GameShell` passes nothing,
  so a stray tap during play still does nothing.
- `ariaLabel` on the tapping instances: `` `Min Bog — ${n} klistermærker` ``.
- Phone-landscape (`compact`): badge shrinks with the ring; keep it — it is the number, not decor.

### 4.2 GameSelectionLayout + HomePage — the door

- `GameSelectionLayout.tsx:151-152` — the section-menu ring gains the navigate handler + aria label.
- `HomePage.tsx:251-256` — the header ring's `onTap` changes from *speak the count* to *navigate to
  /album*. (The count is spoken on arrival instead — §4.3.)
- `HomePage.tsx:358-485` — **delete the whole Min Bog shelf.** The pill, its `minBogShimmer` sweep,
  the gold border, `albumFill`, the `{n} / {REWARD_SLOTS}` label, its duplicate next-prize
  silhouette, and the stale "the LEVEL is the primary reward" comment all go. The corner ring is the
  only door; a second entrance to the same screen taught nothing it didn't.
- `ProgressionCompanion` loses its only home-screen mount. **Keep the component** — the ceremony
  still uses it (`RewardOverlay.tsx:246-251`) — but it is no longer on the front page. If the
  companion's growth should stay visible on home, that is a follow-up with its own placement
  decision, not a quiet re-add of the shelf.
- The freed vertical space is real: on immersive skins the world's seating area grows, so
  **re-check `theme.scene.homeAnchors` and `bloomScenery` placement** — object anchors were tuned
  against a home screen that had a pill at the bottom.
- `src/config/sceneFurniture.ts` **must lose the Min Bog shelf rect** — it is listed there as
  persistent furniture that bloom scenery has to clear, and leaving a phantom rect permanently
  reserves a strip of the world for nothing. Re-run `bloomAnchors.test.ts`.

### 4.3 Min Bog — 8+ chapters, uncapped header

`src/components/hub/StickerAlbum.tsx`

- **Header pill**: `` `${totalCollected}` `` with the book icon — **the denominator goes**. This is
  the owner's ever-rising number. (`StatPill` unchanged.)
- **On arrival, speak the count once**: `audio.speak(collectedCountLine(n))` after mount, ~400 ms
  delay so it does not fight the wipe, guarded by a ref (fires once per visit), skipped at n = 0.
  This is the "numeral appears when spoken" beat.
- **Chapter tabs become icon-only chips.** The current 5 text tabs were measured to *just* fit one
  landscape row (`StickerAlbum.tsx:171-175`); 8 will not, and `flexWrap` would push the page panel
  down. Replace with round 44 px chips showing the chapter's first reward's art (the same art the
  tabs already use), active chip scaled up + accent-filled, `Check` overlay when complete, chapters
  the child has not reached yet at reduced opacity but **still tappable** — seeing that there is
  more book to come *is* the horizon. 8 × 44 + gaps ≈ 400 px: fits iPad landscape, phone landscape
  and 390 px portrait without wrapping. Scales to 12+ chapters.
- The chapter **title** moves into the existing progress line: `Hjemmet · 4 / 9 samlet`.
- `activeIndex` seeding (`chapterOfSlot(totalCollected)`) already works for any chapter count;
  clamp it to `CHAPTER_COUNT - 1` for the post-wrap case.
- The 3×3 page panel and its `--album-ar` sizing are unchanged — re-verify against
  `.claude/rules/responsive-design.md` ("An aspect-ratio'd panel in a no-scroll column must be
  sized from BOTH axes") after the tab strip's height changes, with `--measure`, not by eye.

### 4.4 RewardOverlay — the number ticks here

`src/components/common/RewardOverlay.tsx`

- After `grantPendingRewards()`, show the number **counting up** from `n - owed` to `n` beneath the
  chapter strip, with a single spring pop on the final value. Plain disc, same treatment as the
  ring badge — the child should recognise it as the same object.
- **Do not add a spoken line.** The ceremony speaks **exactly one** line; that invariant is
  load-bearing (`spokenRef`). The number is silent here and spoken in the book.
- **Chapter strip: 9 dots → 3×3 grid** of the same dots. Purely a layout change to `CHAPTER_SIZE`
  dots; keeps `slotInChapter` fill logic.
- `BOOK_DONE_LINE` ("Wow! Hele bogen er samlet!") now fires at 72, not 45 — no code change (it is
  driven by `nowBookComplete` in `grantSlot`), but confirm it reads right at the new total.

### 4.5 RoundResultScreen — unchanged, plus the badge

`RoundResultScreen.tsx:363-436`'s reward meter stays text-free and keeps the silhouette. No number
is added to the meter (it would read as a distance). The screen's existing "Se bog" button already
routes to `/album`; leave it.

### 4.6 Adult view — the honest "how far is left"

`src/components/adult/panes/BarnPane.tsx` already renders
`SummaryRow label="Klistermærker" value={`${collected} af ${REWARD_SLOTS}`}`.

⚠️ **That file belongs to the in-flight adult-settings rework** (PRD `plans/adult-settings/`,
uncommitted as of 2026-08-02 — `src/components/adult/panes/` was untracked when this PRD was
written). W8 must be done LAST, after that work has landed, and must not be attempted against a
tree where those panes are still another session's WIP. If `BarnPane.tsx` has moved or been
renamed by then, follow it rather than recreating it.

This is where the *distance* and the *level* legitimately belong — the parent is the literate party.
Extend it with: `Klistermærker` (n af 72), `Niveau` (`globalLevel()`), `Samlet XP`, `Stjerner i alt`
(`totals.totalStars` — tracked and currently displayed nowhere), and a per-section bloom stage row.
Small, self-contained, no new panel needed.

---

## 5. Work packages

Ordered so each lands green on its own. **W1–W5 change no reward content** and can ship and be
play-tested before any art exists.

**All of W0–W9 are DONE** (see the status header). Three deviations from what is written below, all
deliberate — do not "fix" them back:

1. **§4.1 was reversed.** This PRD said `GameShell` must pass no `onTap` ("a stray tap during play
   must do nothing"). `34935a1` gave the in-game ring the `/album` handler: the shared back button
   sits ~40px away in that same header and already leaves the game on a stray tap, so muting the ring
   protected nothing and only made one control behave differently per screen. CLAUDE.md records it —
   *don't re-mute it.*
2. **§4.6 was narrowed.** `BarnPane` ships only `Klistermærker — n af 72`. The `Niveau`
   (`globalLevel()`), `Samlet XP`, `Stjerner i alt` and bloom rows shipped for one review cycle and
   were pulled; `globalLevel()` is now banned on every surface, adult included.
3. **§4.2/W4's scenery work is moot.** `sceneFurniture.ts` and `bloomAnchors.test.ts` no longer
   exist — the stage-gated `bloomScenery` sprites were deleted wholesale in `87eabc5` (owner: "it
   looks misplaced"). Bloom shows in the world as ambient **density** only.

Also: `leg-floejte` became `leg-xylofon` (`7edaaa6`) — the flute lost the 24px silhouette test.

| W | Scope |
|---|---|
| **W0** | ~~Land this PRD in the repo.~~ **Done** — committed as `plans/reward-horizon/tmp-prd-reward-horizon-01-one-number-one-book.md` alongside the evidence review. |
| **W1** | **Open-ended path.** Move `REWARD_SLOTS`/`CHAPTER_COUNT` to `stickers.ts` as derived values; add `COMPANION_STAGES`; re-point all importers; fix `companionStageForCollected`'s clamp. **No chapters added yet** — the app must be byte-for-byte identical in behaviour. Tests updated + re-break. |
| **W2** | **The number.** `rewardNumber()` in `progression.ts` + `progressStore`; `showCount` badge on `RewardRing`; flyer nudge. |
| **W3** | **The door.** `onTap` → `/album` on the home header ring and the section-menu ring; `/album` speaks the count on arrival; `collectedCountLine` enumeration widened to 1..100 (`COUNT_LINE_MAX`) + prebake + `audit:approve-all`. |
| **W4** | **Delete the home Min Bog shelf** (§4.2). Remove its rect from `src/config/sceneFurniture.ts`, re-run `bloomAnchors.test.ts`, and re-measure home on all 4 skins × all viewports — the world's seating area grows, so `homeAnchors`/`bloomScenery` need a look. |
| **W4b** | **Delete the gold pass** (§3.5). `pathIndexForSlot`, the `gold` flag, `goldRewardLine`, the shimmer/"Skinnende!" banner, the album's `×{count}` state, duplicate counting in `rebuildCollected` — and clamp `owedRewards()` to the cap so `grantPendingRewards` stops handing out slots past the last chapter. Touches `progressSchema`/`progressMerge`, which `api/progress.ts` shares — keep them free of `window`/`Date.now`/`crypto`. |
| **W5** | **Album for N chapters.** Icon-only chapter chips; uncapped header; chapter title into the progress line; dimmed-but-tappable future chapters; re-measure the page panel. **RewardOverlay**: number tick-up + 3×3 chapter strip. |
| **W6** | **Content: chapters 6–8.** Append the 27 rewards to `REWARD_CHAPTERS`. Generate 27 baked soft-3D WebP renders through `.claude/rules/scene-assets.md` (green screen + key + trim), land them in `src/assets/rewards/`. `rewardArtCoverage.test.ts` goes red until they all exist — that is the gate working. |
| **W7** | **Narration.** `npm run tts:prebake` — 27 new labels × (`rewardLine` + bare label) = 54 clips, plus the widened count lines, **minus every `goldRewardLine` clip** (the prune will delete 45 existing mp3s; that is expected output of W4b, not content drift). Commit the mp3s + `prebakedTts.ts`, then `npm run audit:check` → `npm run audit:approve-all` → commit `docs/audit/*`. Per `feedback_blanket-audit-approval`: report the clips as approved-but-unheard. |
| **W8** | **Adult view.** Extend `BarnPane` per §4.6. |
| **W9** | **Verification** (§8) + `/re-break` pass over every new invariant. |

---

## 6. Files touched

**Core model**
- `src/config/progression.ts` — `rewardNumber`, `COMPANION_STAGES`, clamp fix; `REWARD_SLOTS`/`CHAPTER_COUNT` removed
- `src/config/stickers.ts` — derived `REWARD_SLOTS`/`CHAPTER_COUNT`; **+3 chapters appended**
- `src/services/progressStore.ts` — `rewardNumber()`; import re-point
- `src/config/progressSchema.ts`, `src/config/progressMerge.ts` — import re-point only (the wrap/clamp math is already written against the constant)

**Surfaces**
- `src/components/common/RewardRing.tsx` — badge, flyer nudge
- `src/components/common/RewardOverlay.tsx` — number tick, 3×3 strip, gold branch removed
- `src/components/common/StickerReveal.tsx` — `isShiny` / shimmer / "Skinnende!" removed
- `src/components/hub/StickerAlbum.tsx` — chips, uncapped header, spoken arrival, gold slot state removed
- `src/components/home/HomePage.tsx` — ring is the only door; **Min Bog shelf deleted**
- `src/components/common/GameSelectionLayout.tsx` — ring is the door
- `src/components/common/ProgressionCompanion.tsx` — clamp fix; loses its home mount (kept for the ceremony)
- `src/config/sceneFurniture.ts` — Min Bog shelf rect removed
- `src/config/danish-phrases.ts` — `goldRewardLine` deleted
- `src/components/adult/panes/BarnPane.tsx` — adult status rows

**Content / build**
- `src/assets/rewards/` — 27 new WebP
- `shared-narration-clips.js` — count-line loop → `COUNT_LINE_MAX`
- `src/config/prebakedTts.ts` + `public/sounds/tts/` — regenerated
- `docs/audit/narration-audit.json` — re-approved
- `src/utils/devHarness.ts` — `?rewards=` clamp follows the derived total automatically

**Tests**
- `src/config/progression.test.ts`, new/extended `src/config/stickers.test.ts`,
  `src/services/progressStore.test.ts`, `src/assets/rewards/rewardArtCoverage.test.ts`

---

## 7. Invariants and tests

Add or tighten, then **re-break each one** (`/re-break`) — the specific test must go red, not a
neighbour. Two traps this repo has already been bitten by apply directly here: a test that compares
two sides which move together (app vs. the prebake enumerator) passes vacuously, so **pin the
literal value too**; and breaking something adjacent while the suite stays green proves nothing.

1. **Append-only path.** `stickers.test.ts` pins the **first 45 reward ids in exact order** as a
   literal array. Re-break: swap two of them → this test, and only this test, fails.
2. **Derived totals.** `REWARD_SLOTS === REWARD_CHAPTERS.length * CHAPTER_SIZE`; every chapter has
   exactly `CHAPTER_SIZE` rewards; all ids unique across all chapters. Pin `REWARD_SLOTS === 72`
   and `CHAPTER_COUNT === 8` as literals as well (the derivation alone is vacuous).
3. **The number is grantedSlots.** `progressStore.rewardNumber() === progressStore.grantedSlots()`
   across a seeded run, and it is **≤** `collectedFromLevel(globalLevel())` at every point — the
   gap is the pending ceremony. Re-break: point `rewardNumber()` at `globalLevel()` → red.
4. **Companion never indexes past its art.** `companionStageForCollected(n) <= COMPANION_STAGES - 1`
   for n up to 200, and is monotone non-decreasing. Re-break: restore the `CHAPTER_COUNT - 1` clamp
   → red at n ≥ 45.
5. **The book ends; it does not wrap.** `nextReward()` is non-null at `grantedSlots = 71` and
   `null` at 72. With XP seeded far past the end (simulating the G-Counter ledger),
   `grantPendingRewards()` returns exactly the slots up to 72 and then `[]` forever —
   `grantedSlots` never exceeds `REWARD_SLOTS` and `rewardAt()` is never called with `null`.
   Re-break: remove the `owedRewards()` clamp → red.
   Also assert **no duplicates exist**: `rewardNumber() === collectedCount()` at every seeded point.
6. **Art coverage.** `rewardArtCoverage.test.ts` already enumerates `allRewards()` — it picks the 27
   up for free. Confirm it is genuinely red before the renders land (that is the gate).
7. **Narration coverage.** Every new label's `rewardLine` + bare label is in the enumerated set;
   `collectedCountLine(n)` enumerated for 1..`COUNT_LINE_MAX`. Pin one literal string (e.g.
   `rewardLine('Nøgle') === 'Nyt klistermærke! Nøgle'`). Assert `goldRewardLine` no longer exists
   and that **no clip key matches `Skinnende`** — otherwise the deleted line lingers in the manifest.
8. **No emoji.** `src/config/noEmoji.test.ts` — the allowlist stays empty; the badge is a numeral,
   the chapter chips are baked art, the `Check` is lucide (adult/dev-class affordance, already
   allowed there).
9. **No child-facing distance.** Assert `StickerAlbum`'s header pill label contains no `/` and no
   `af`, and that `RewardRing` renders no text node other than the badge and the `+N` flyer.
10. **One door only.** Assert `HomePage` contains no `/album` navigation other than the ring's
    `onTap`, so the shelf can't quietly come back as a second entrance.

---

## 8. Verification

Run in a **throwaway worktree at HEAD** (`git worktree add` + a `mklink /J` junction to
`node_modules`) — another session may have uncommitted work in this tree, and verifying the working
tree would silently include it.

1. `npm run build` (tsc + vite), `npm run lint`, `npm test`.
2. `npm run audit:check` — clean after W7.
3. **Progression walk** with the dev seed, per `useProgress`/`devHarness`:
   `?rewards=0`, `8`, `9`, `44`, `45`, `46`, `53`, `54`, `71`, `72`, `90`.
   At each: the ring badge, the album header and the album chapter counts must agree; the companion
   must be at stage 4 from 36 upward and never regress. At **72 and 90** the book must be full and
   identical — sparkle in the ring, number resting at 72, no duplicate anywhere, and playing another
   round must grant nothing and celebrate nothing.
4. **Live crossing.** Play one round to a slot crossing: ring flashes → `levelup-mini` → badge
   unchanged in-game → ceremony on the next menu → sticker revealed, number ticks up, exactly one
   spoken line.
5. **The door.** Tap the ring on home and on all 5 section menus → themed wipe → Min Bog at the
   right chapter → count spoken once. Back returns to the origin. Tap the ring inside a game → nothing.
6. **Layout** via the `ui-screenshot` skill, at **1024×768, 1254×872, 768×1024, 844×390, 667×375**,
   on all 4 registered skins + `prefers-reduced-motion`:
   - Min Bog: 8 chips on one row, no wrap, 44 px targets; page panel `rect.bottom <= innerHeight`
     proved with `--measure`, not a screenshot.
   - Home: with the shelf gone, nothing is left floating where it used to sit and the world's
     seated objects still clear the mascot and the corner gear. `sceneFurniture.ts` no longer
     reserves the shelf strip — re-run `bloomAnchors.test.ts` and eyeball a bloomed home
     (`?rewards=45`) on each skin, since bloom scenery is invisible until it's earned.
   - The ring badge is legible on light **and** dark scenes (Havet/Rummet are the stress cases) —
     check against `theme.onTileColor` guidance if the accent is pale.
   - Guard the probe: bail on "Noget gik galt" and assert an expected element count, or "0 overlaps"
     is vacuously true on a crashed route.
7. **iPad 17.7 floor** — all new audio is MP3 via the existing pipeline (nothing new to check), but
   do the manual pass on the real device: PWA, ring tap, book, ceremony.
8. `/re-break` over §7.

---

## 9. Out of scope

- No streaks, daily goals, login rewards, timers, scarcity cues, random/mystery rewards, shops,
  spendable currency, leaderboards or any child-to-child comparison. Permanent exclusions.
- No adaptive difficulty; XP stays difficulty-independent.
- No change to `taskXp` / `roundXp` / bloom / the two-tier curve.
- No world-growth mechanic in this PRD (the "each chapter plants a landmark in the persistent
  world" idea is a good follow-up, but it is a separate art + `bloomScenery` anchoring job).
- No reordering or re-theming of the existing 45.
- No replacement for the gold pass. When the book fills, it is finished — the answer is a new
  chapter, not a recycled prize.
- No new home-screen entrance to Min Bog. The ring is the door.
- No schema version bump — the persisted shape does not change (v4 stays; `grantedSlots` is already
  unbounded).

---

## 10. Adding chapter 9 (and 10, and 11) later

The point of W1 is that a new chapter is **content, not engineering**. This is the whole recipe.

**Append 9 rewards to `REWARD_CHAPTERS` in `src/config/stickers.ts`.** Never insert, never reorder —
`firstAt` is keyed by reward id and `rebuildCollected` walks slots through the path, so touching the
existing order silently re-assigns every child's book (§3.2). New ids must be unique across all
chapters.

Everything below then follows with **no code change**: `REWARD_SLOTS` / `CHAPTER_COUNT`, the ring's
next-prize silhouette, the album's chapter chips and auto-opened tab, `chapterOfSlot`, the
end-of-book cap in `owedRewards()`, `BOOK_DONE_LINE`'s trigger point, and the `?rewards=n` dev seed.

What you still have to do:

1. **9 baked soft-3D WebP renders** into `src/assets/rewards/`, keyed by reward id, via
   `.claude/rules/scene-assets.md`. `rewardArtCoverage.test.ts` **fails the build until all 9
   exist** — that is the gate doing its job, not a problem to work around.
2. **`npm run tts:prebake`** (9 labels × `rewardLine` + the bare label = 18 clips), commit the mp3s
   + `prebakedTts.ts`, then `npm run audit:check` → `npm run audit:approve-all` → commit
   `docs/audit/*`. Skip this and the new labels quietly fall back to live Azure, unauditioned.
3. **Bump the two pinned literals** in `stickers.test.ts` — `REWARD_SLOTS` and `CHAPTER_COUNT`.
   They are pinned precisely so the path cannot grow by accident; updating them is the deliberate
   act of saying "yes, I meant to".

Two standing ceilings, neither urgent:

- **The companion stops at `COMPANION_STAGES` (5).** There are only 5 baked stages per world, so
  from chapter 6 onward it is fully grown and stays that way. Correct — it must never regress.
- **The spoken count is baked to `COUNT_LINE_MAX` (100).** Past 100 rewards `collectedCountLine`
  falls through to live Azure. Widen the constant and re-prebake somewhere around chapter 11.

Pacing: a chapter is 9 × 80 XP = 720 XP ≈ **18 rounds**.

---

## 11. Two-liner prompt to start implementation

```
Implement plans/reward-horizon/tmp-prd-reward-horizon-01-one-number-one-book.md — one number, one
book, one ring, one door: derive REWARD_SLOTS/CHAPTER_COUNT from REWARD_CHAPTERS, add the
child-facing rewardNumber() badge to RewardRing, make that ring the ONLY door to Min Bog (delete the
home shelf), delete the gold pass, rework the album for icon-only chapter chips, and append chapters
6-8. Work W1→W9 in order, hold the append-only path invariant, and run the /re-break pass in §7 plus
the worktree verification in §8 before reporting done.
```
