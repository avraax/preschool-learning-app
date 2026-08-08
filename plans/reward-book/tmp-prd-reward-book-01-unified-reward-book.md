# Reward Book PRD-01 — merge trin + klistermærkebog into ONE reward system

> **SUPERSEDED IN PART, 2026-08-08 — `plans/endless-play/tmp-prd-endless-play-01-no-round-end.md`.**
> W7's round-result handoff is gone with `RoundResultScreen` itself: the ceremony fires **in-game at
> the seam**, from `useRewardCeremony`. `useRound` is now `useTaskRun`, and stars / personal bests /
> round-end bonus XP are deleted. The one-track model, the path, the curve and the ceremony's design
> are unchanged.

**Date:** 2026-07-31
**Part of:** Reward Book program (new; supersedes the *earning + visibility* halves of
`plans/liveliness-overhaul/tmp-prd-liveliness-01-progression-foundation.md` and
`tmp-prd-liveliness-04-live-xp-progression.md`, and closes `docs/prd/PRD-09-reward-and-result-ux.md` P3)
**Owner:** Allan. **Target user:** ~5-year-old Danish boy, iPad landscape, pre-reader, plays a lot of Roblox.
**Art:** art-GATED — 45 baked soft-3D reward renders (owner generates in Gemini). W1–W7 ship fully
playable on the existing emoji, so nothing blocks on art.

> Two reward economies were built in separate sessions and it shows. This PRD collapses them into
> one: **trin ≡ sticker slot number**. The ring in the corner of every game is literally the ring
> around the next prize, and that same prize is the next slot in the book. Nothing has to be
> explained, because both surfaces show the identical object.

---

## 1. Context — why

| | Trin (level) | Klistermærker (book) |
|---|---|---|
| Earned | live per completed task, XP-weighted | one per level-up |
| Shown | `LevelRingMini` in every game header + the 5 section menus; `ProgressionCompanion` on home | only inside `/album` |
| Number | `trin 12` | `12 / 63` + a third `⭐ 0` |
| Ceremony | `LevelUpOverlay` "Trin 12! 🎉" | a sticker revealed *inside* that ceremony |

They reference each other (Liveliness PRD-04 made the sticker the trophy of a level-up, intending the
album to become "a timeline of levels") but nothing lines up: the ring never hints a sticker is
coming, the book never says which trin a sticker came from, the award is random-from-global-pool so
the order is meaningless, and the child is asked to track **four** counters (trin, stickers, lifetime
stars, per-game bests). A 5-year-old pre-reader cannot assemble that into a mental model — so the
ring is currently decoration that occasionally triggers an unrelated surprise.

**Target outcome:** one number, one collection, one visible cause-and-effect chain nobody has to
teach — *play → the ring around the next prize fills → it's full → that prize is mine, in my book.*
Roblox-style reward-track anticipation (you can always see the next prize), zero reading required.

This also clears the drift the split left behind, all verified in the current code:
- `grantLevelUpSticker()` (`progressStore.ts:600`) passes **no `setId`**, so the whole per-section
  page-bias plumbing — `stickerSetForSection` threaded through `useRound`/`UnifiedQuizGame`/
  `UnifiedMemoryGame` and 14 game files into `RoundResultOptions.stickerSetId` — is **dead code**.
- `awardSticker()` (`progressStore.ts:443`) has 0 callers; `celebrateTier('sticker')` has 0 callers;
  `RoundResultScreen`'s entire sticker choreography is unreachable (`outcome.stickers` is hardcoded
  `[]` at `progressStore.ts:488`), including an unconditional `sfx.play('sticker-reveal')`.
- `roundXp`'s `pageCompleted` (+15) and `stickerCount` terms can never fire.
- 63 prebaked `"Nyt klistermærke! {label}"` clips are orphaned; this PRD puts **45 back to work**.
- `StickerRarity`/`Sticker.rarity` are declared but never populated ("shiny" is `count > 1`).
- `useBrowseXp`'s `explored` set is a component-local `useRef` → browse XP is re-farmable on every
  re-entry.

## 2. Owner decisions (locked — do not re-litigate)

| # | Decision |
|---|---|
| D1 | **trin ≡ sticker slot number.** Level-up N awards path slot N. One track, one number. |
| D2 | **The next reward is always previewed** as a silhouette — in the book *and* inside the corner ring. Slots after it stay blank (no hint). |
| D3 | **45 rewards in 5 chapters of 9**, keeping the existing sets Dyr / Køretøjer / Mad / Natur / Havet. `smaakryb` + `legetoej` are dropped. Chapters map **1:1 onto the 5 companion growth stages**. |
| D4 | **All 45 rewards become baked soft-3D WebP art** (owner generates in Gemini; implementer hands over the prompt doc first). Art-gated: mechanics ship on emoji, art swaps in per-subject. |
| D5 | **Pacing:** one reward per completed round for slots 1–18 (chapters 1–2), then one per ~2 rounds for slots 19–45. ≈72 rounds to fill the book. |
| D6 | **Chapter completion is the only extra ceremony tier** (bigger celebration + companion stage-up). |
| D7 | **Nothing new goes into the world.** Verified by screenshot during planning: bloom scenery only ever contains *theme-native* objects (flower on the cloud bank in Regnbue, star cluster + rocket among the asteroids in Rummet, starfish on the sand in Havet) — a dog or a pizza there would read as a bug. World + per-section bloom stay exactly as they are. |
| D8 | **Schema v3 = hard reset** (the precedent from v2), keeping sound/music/difficulty settings. |
| D9 | **The corner ring shows the silhouette only — no trin number.** The only number anywhere is "stickers collected", identical to the book's count. The word *trin* leaves the app. |
| D10 | Counters kept: per-round ⭐⭐⭐, "Ny rekord!" bests, per-section bloom. **Removed: the lifetime `⭐ totalStars` pill** (a third score with no purpose). |

## 3. Guardrails (repeated verbatim for self-containment)

- Target user as above. Minimum 44px touch targets, Comic Sans MS for child-facing text, Danish for
  all user-facing copy.
- **No adaptive difficulty, ever.** Every number here is difficulty-independent —
  `progressStore.difficultyFor` must not leak into any XP or pacing value.
- Rewards are **purely rewarding** — never a fail state, never gated on perfection. Any *completed*
  round grants a reward in chapters 1–2 even with mistakes; bonuses only carry into the next one.
- One audio channel, **no queue** (new audio cancels current) — a ceremony speaks exactly **one**
  utterance. A new spoken template must be added to `shared-narration-clips.js`, prebaked
  (`npm run tts:prebake`, commit the mp3s + `prebakedTts.ts`) and auditioned (`npm run audit:check`
  → `/audit` → sign off), or it silently falls back to live Azure and is never reviewed.
- All audio ships as **MP3** (iPadOS 17.7 floor — Ogg is undecodable there).
- Full-viewport, no-scroll layouts; phone-compact variants via `PHONE_LANDSCAPE` / `PHONE_ANY`
  (`src/theme/phoneMedia.ts`). Verify at 844×390.
- Token-driven theming: no hardcoded colours. Accent text on white surfaces uses `theme.onTileColor`;
  focal/scene text uses `scene.dark ? accentColor : onTileColor`; frosted cards use `onCardColor`;
  use `getCategoryTheme(id)`, never the static `categoryThemes` map.
- Navigation goes through `useTransitionNav()`; celebrations through `celebrateTier` (never legacy
  `celebrate`). Raw `navigate()` only where it already exists (`RoundResultScreen`).

## 4. The model (what the child experiences)

```
IN ANY GAME (top-right corner)              MIN BOG  (/album)
                                     [🐾 Dyr ✅][🚗 Køretøjer ←][🍎][🌳][🌊]
      .-████████-.                            12 / 45
     █            █                     🚗   🚌   🚂
     █    ▓🦊▓    █  ← next prize,      ✈️   ⛵   ⟨🚲⟩  ← next: silhouette + glow
     █            █    ring fills       ▢    ▢    ▢     ← locked: blank plates
      '-████████-'     around it
                                     Chapter tab auto-opens where he is.
  ring full → prize flashes to full colour
           → round ends → ceremony → it's in the book
```

- Every completed task fills a visible slice of the ring (~1/8) and flies a `+5`.
- The ring's centre **is** the prize; the book shows the same silhouette in the same next slot.
- Finishing a chapter (slots 9 / 18 / 27 / 36 / 45) grows the home companion one stage — five
  chapters, five stages, so the companion is a picture of how far through the book he is.

## 5. Numbers (the whole economy on one page)

`src/config/progression.ts` stays the single pure source (Node-importable, no side effects).

```ts
export const REWARD_XP = 40          // XP that equals one completed round
export const FAST_SLOTS = 18         // slots 1..18 land one-per-round (chapters 1-2)
export const CHAPTER_SIZE = 9
export const CHAPTER_COUNT = 5
export const REWARD_SLOTS = 45       // CHAPTER_SIZE * CHAPTER_COUNT

// Climbing FROM `level` (level 1 = empty book). Reaching level N+1 awards slot N.
export const xpToNext = (level: number): number =>
  level <= FAST_SLOTS ? REWARD_XP : REWARD_XP * 2

// One task's worth of XP, normalised so ANY full round ≈ REWARD_XP regardless of round length.
export const taskXp = (tasksInRound: number, firstTry: boolean): number =>
  Math.max(1, Math.ceil(REWARD_XP / Math.max(1, tasksInRound))) + (firstTry ? 1 : 0)

export const collectedFromLevel = (level: number) => Math.max(0, level - 1)  // ← the ONE mapping
export const chapterOfSlot = (slotIndex0: number) => Math.floor(slotIndex0 / CHAPTER_SIZE) // 0..4
export const companionStageForCollected = (collected: number) =>
  Math.min(CHAPTER_COUNT - 1, Math.floor(collected / CHAPTER_SIZE))

export const roundXp = (i: { mistakes: number; anyNewBest: boolean }): number =>
  (i.mistakes === 0 ? 6 : 0) + (i.anyNewBest ? 8 : 0)   // bonuses only → carry into the next prize
```

`levelFromXp(totalXp): LevelInfo` keeps its current shape and linear walk (it already handles a
variable `xpToNext`). `BLOOM_STAGE_XP` / `bloomStage` / `bloomFill` are **unchanged** (D7).

**`taskXp` replaces the entire per-game `TASK_XP` weight table.** Today's hand-tuned weights make a
Ram Farven round worth 56 XP and a 10-pair memory board 20, so "one reward per round" would be wildly
uneven. "A round is a round" is fairer *and* self-balancing:

| Game(s) | tasks/round | XP per task | full round |
|---|---|---|---|
| the 13 eight-task rounds (`alphabet.quiz`, `math.counting`/`patterns`/`comparison`/add/sub, `english.listen`/`word`/`translate`, `ordleg.read`/`mic`/`spelling`, `colors.quiz`, `colors.ramfarven`, `colors.nuancer`) | 8 | 5 (+1) | 40–48 |
| `colors.farvejagt` | 5 boards | 8 (+1) | 40–45 |
| `memory.*.10` | 10 pairs | 4 | 40 |
| `memory.*.20` | 20 pairs | 2 | 40 |
| browse screens | — | **2 per NEW item, once ever** | 29 letters = 58 |

Consequences, all intentional:
- Any completed round ≥ 40 → in chapters 1–2 **a reward always lands**, mistakes or not (guardrail).
- Max round = 54 (48 + perfect 6, or + new best 8) < 80 → **a single round can never skip a slot**.
  The multi-slot grant path in §8/W4 exists only as a safety net (e.g. a browse binge crossing two).
- Chapters 3–5 need 80 → ~2 rounds per prize, invisible to the child (the ring just moves ~half as
  far per question).
- Rough shape of the journey: 18 rounds for chapters 1–2, then 54 for chapters 3–5 ⇒ **≈72 rounds**.

## 6. Reward data (`src/config/stickers.ts` → the path)

Keep the 5 chapters and their 45 existing Danish labels + emoji **verbatim** (already prebaked and
auditioned; the 45 `"Nyt klistermærke! {label}"` clips come straight back into use). Changes:

1. **Delete** the `smaakryb` and `legetoej` sets (18 stickers), `StickerRarity` + `Sticker.rarity`,
   and `stickerSetForSection` + the `StickerSection` type.
2. Rename `StickerSet` → `RewardChapter` (`{ id, title, emoji, rewards }`) and `Sticker` → `Reward`,
   and add the art hook: `art?: string` — a WebP URL from `src/assets/rewards/index.ts`; absent →
   render `emoji`. This single optional field is what makes the PRD art-gated.
3. Add the flat ordered path + lookups. **The order IS the journey and must never be shuffled** — no
   `shuffle()`, no random pick, anywhere in this system:

```ts
export const REWARD_CHAPTERS: RewardChapter[] = [dyr, koeretoejer, mad, natur, havet]  // 5 × 9
export const REWARD_PATH: Reward[] = REWARD_CHAPTERS.flatMap(c => c.rewards)           // 45
export const rewardAt     = (slotIndex0: number) => REWARD_PATH[slotIndex0] ?? null
export const chapterAt    = (slotIndex0: number) => REWARD_CHAPTERS[chapterOfSlot(slotIndex0)]
export const slotOfReward = (id: string) => REWARD_PATH.findIndex(r => r.id === id)
```

Slot map: **1–9 Dyr · 10–18 Køretøjer · 19–27 Mad · 28–36 Natur · 37–45 Havet.**
Existing ids are kept as-is (`dyr-hund`, `kt-bil`, `mad-aeble`, `natur-trae`, `hav-fisk`, …).

**Past 45 (gold pass):** slot 46+ awards a **gold** duplicate of `REWARD_PATH[(collected - 45) % 45]`
— deterministic, so it is still a path, not a random duplicate. `gold: true` drives the shiny visuals
already built into `StickerReveal` (gold rim, ✨ badge, shimmer sweep, `×count`) and `StickerAlbum`.

## 7. Store (`src/services/progressStore.ts` → schema v3)

`SCHEMA_VERSION = 3`. `normalize()` keeps its hard-reset-on-mismatch behaviour (D8); `resetAll()`
already preserves `settings`, so sound/music/difficulty survive the bump. Keep everything else that
works today: debounced 250ms writes, `pagehide`/`visibilitychange:hidden` sync flush, cross-tab
`storage` re-hydration, `window.__progress` in DEV.

```ts
interface ProgressionState {
  globalXp: number
  lastCelebratedLevel: number           // starts at 1 → trin 1 is never celebrated
  bloom: Record<SectionId, SectionBloom>
  explored: Record<SectionId, string[]> // NEW: browse keys that already paid out (anti-farm)
  updatedAt: number
}
```
`stickers: { collected: Record<id, {count, firstAt}>, newIds: string[] }` and `totals` keep their
shape (`totalStars` stays in the data; only its UI pill goes, D10).

| Was | Becomes |
|---|---|
| `grantTaskXp(gameId, {firstTry, section?})` using `TASK_XP[gameId]` | `grantTaskXp(gameId, {firstTry, tasksInRound, section?})` → `taskXp(tasksInRound, firstTry)`; `tasksInRound` defaults to 8 |
| `grantLevelUpSticker(): {award, pageCompleted}` | `grantPendingRewards(): RewardGrant[]` — awards **every** owed slot (`collectedFromLevel(globalLevel()) - collectedCount()`, ≥0) in ONE commit; each `{ reward, slot, chapter, chapterCompleted, bookCompleted, gold, isNew }` |
| `private grantSticker(draft, setId?)` (random pick + global fallback) | `private grantSlot(draft, slotIndex0)` — deterministic `rewardAt()` / gold-pass wrap. All randomness gone |
| `awardSticker()` (0 callers) | **deleted** |
| `recordRoundResult(gameId, input, {starThresholds, stickerSetId})` | drop `stickerSetId`; delete `stickers` + `pageCompleted` from `RoundOutcome` (always empty today) |
| — | `markBrowsed(section, key): boolean` — persists into `progression.explored`; true only the first time ever |
| `XpReason` union + `grantXp(section, amount, reason)` | keep `grantXp(section, amount)` (dev/seed harness), drop the ignored `reason` and the union |
| — | `collectedCount(): number` and `nextReward(): { reward, slot, chapter } \| null` — the single source for ring + book + home + result meter |

`sectionForGameId`, `setDifficulty`, `setSetting`, `markStickersSeen`, `markLevelCelebrated`
(idempotent, forward-only), `globalLevel`, `xpProgressToNextLevel`, `bloomFor` all stay.

`useProgress()` (`src/hooks/useProgress.ts`) additionally exposes `collectedCount`, `nextReward`,
`companionStage`; keep the `useSyncExternalStore` wiring untouched.

**Invariant, asserted in tests:** `collectedCount() === collectedFromLevel(globalLevel())` once a
ceremony has settled — the book and the ring can never disagree.

## 8. Workstreams

### W0 — Art prompt doc (FIRST deliverable, before any code)
Per `.claude/rules/scene-assets.md`, produce `plans/reward-book/reward-book-art-prompts.md` and hand
it to the owner: **45 self-contained Gemini prompts**, one per reward, each = a subject line + the
full style guide inlined (soft-3D claymation / Pixar-lite, rounded matte clay, soft top-left key +
rim light, soft contact shadow, warm & child-safe, slight 3/4 top-down, single centered subject, no
text/letters, flat solid `#00FF00` background edge-to-edge, 1:1, highest-res PNG). Include:
- attach 2–3 existing `src/assets/themes/icons/*.webp` (or `art-src/icons/*.png`) as STYLE references
  on **every** generation, and re-use the first good render as the consistency anchor for the batch;
- per-subject child-safety notes where they matter (Haj/Edderkop friendly, no sharp teeth or menace);
- the download gotcha: **right-click → "Save image as…", NOT the button embedded on the image** (that
  export stamps the ✦ sparkle and can composite in stray extra elements), and verify full-size (the
  in-chat preview crops);
- file naming by reward id (`dyr-hund.png`, `kt-bil.png`, …), **grouped by chapter** so the owner can
  generate one chapter at a time and the app fills in progressively.

Keying (implementer, as renders land): green-**excess** `g - max(r,b)` hysteresis flood-fill (seed
from the border through vivid screen, grow through faint green to eat the baked contact shadow);
**sprites TRIM + square-contain** (not full-frame); size-capped despeckle to drop the ✦; verify over
**magenta** before wiring. Output `src/assets/rewards/<rewardId>.webp`, 256×256, ≤20KB each; wire a
static `Record<string, string>` map in `src/assets/rewards/index.ts` following the existing
`src/assets/themes/icons/index.ts` pattern, then set `art:` on each `Reward`. Put the temp `sharp`
`.mjs` in the **repo root** and delete it after (a failed `node x.mjs && rm x.mjs` leaves it behind).

### W1 — Curve + data + store (foundation; nothing visible yet)
`progression.ts` per §5, `stickers.ts` per §6, `progressStore.ts` per §7. Extend
`src/config/progression.test.ts`: the two-tier curve (`xpToNext` at 1/18/19/45/60), `taskXp`
normalisation for 5/8/10/20 tasks, `collectedFromLevel`, `chapterOfSlot`,
`companionStageForCollected` boundaries, "a max round (54 XP) can never cross two slots", the
gold-pass wrap, and monotonicity of `levelFromXp` across the tier change. Add a **new**
`src/services/progressStore.test.ts` (there is none today) for `grantPendingRewards`: single slot,
owed-two, chapter completion at 9/18, book completion at 45, gold pass at 46, and the
`collectedCount() === globalLevel() - 1` invariant.

### W2 — XP call sites
- `src/hooks/useRound.ts:72-75` → `grantTaskXp(config.gameId, { firstTry, tasksInRound: config.length })`
  (the length is already in scope); delete `RoundConfig.stickerSetId`. One edit covers all 13 rounds.
- `src/components/common/UnifiedMemoryGame.tsx:383` → `{ firstTry: false, tasksInRound: boardPairs }`.
- `src/hooks/useBrowseXp.ts` → gate on `progressStore.markBrowsed(section, key)` instead of the
  component-local `useRef<Set<string>>`; 2 XP per new key. Keep the `xpBus.emit`.
- Remove the dead `stickerSetForSection` import + `stickerSetId` argument from the 16 call sites:
  `AlphabetGame.tsx:119`, `MathGame.tsx:202`, `MathOperationGame.tsx:475`, `ComparisonGame.tsx:283`,
  `HvadManglerGame.tsx:229`, `FarveQuizGame.tsx:199`, `FarvejagtGame.tsx:333`, `RamFarvenGame.tsx:306`,
  `NuancerGame.tsx:222`, `EnglishListenGame.tsx:85`, `EnglishWordGame.tsx:91`,
  `EnglishTranslateGame.tsx:92`, `LaesOrdetGame.tsx:143`, `SpellingGame.tsx:304`,
  `SpeakWordGame.tsx:462`, `MemoryGame.tsx:45,89`, plus `UnifiedQuizGame.tsx:534`.

### W3 — `RewardRing` (rename of `LevelRingMini`) — the in-game half of the model
`src/components/common/LevelRingMini.tsx` → `RewardRing.tsx`. Ring geometry and motion stay exactly
as they are: stroke `max(4, size*0.1)`, rotated -90°, animated `strokeDashoffset` over 0.6s
`[0.34,1.56,0.64,1]`, `drop-shadow`, track `rgba(255,255,255,0.22)` on dark / `rgba(0,0,0,0.12)` on
light, ring colour `theme.scene.progressionCompanion.ringColor ?? palette.primary.main`, the `xpBus`
pop (`[1,1.14,1]` / `[1,1.35,1]` on level), the `+X` flyer (0.9s, auto-removed at 1000ms, suppressed
when `compact`), `celebrateTier('levelup-mini')` when `leveledUp && flourish`, reduced-motion → no
flyer/pop but the fill still updates, and `aria-hidden`.

The **centre** changes from the trin integer to the next reward's silhouette:
- `nextReward()?.reward.art` → `<img>` at `size * 0.52`; no art yet → the emoji at `size * 0.44`.
- Silhouette treatment: `scene.dark` → `filter: brightness(0) invert(1)` @ `opacity .45` (white shape
  on a dark world); light → `brightness(0)` @ `opacity .30`. The real colours must never read — it has
  to be obviously "not mine yet".
- On a `leveledUp` tick: drop the filter for ~900ms so the prize flashes to full colour, then render
  the NEW next silhouette. **This is the beat that teaches the whole system** — keep it.
- Book full → a gold ✨ glyph instead of a silhouette.
- Both call sites keep their sizes: `GameShell.tsx:133` (`flourish compact`, 34px phone-landscape /
  46px) and `GameSelectionLayout.tsx:153` (44px).

### W4 — `RewardOverlay` (rework of `LevelUpOverlay`) — the ceremony
Rename `LevelUpOverlay.tsx` → `RewardOverlay.tsx`, `levelUpBus.ts` → `rewardBus.ts` (keep the DEV
`window.__rewardBus`), `LevelUpWatcher.tsx` → `RewardWatcher.tsx` — keeping its `routeKind`
gating **off `game` routes** and the 2500ms grace, so a mid-round crossing never interrupts play and
fires on the next menu instead. Keep the app-root mount (`App.tsx:245-246`), the opaque radial scrim
(dark/light variants), `zIndex 12000+`, tap-anywhere-to-dismiss, the multi-level collapse
(`Math.max(prev.level, e.level)`), and `DISMISS_MS = 3200`.

Beats:
1. `progressStore.grantPendingRewards()` once per ceremony (`grantedRef`) → grants array.
2. `sfx.play('level-up')`, `mascotBus.emit('round')`.
3. **The reward is the headline** — `StickerReveal` at `size 150` (phone-landscape 110), banner
   `Nyt klistermærke!` / gold `Skinnende! ✨`. The `Trin {level}! 🎉` headline is **deleted** (D9).
4. Under it a 9-dot chapter strip with the just-filled dot popping — position without reading.
5. Speak exactly **one** prebaked line (§9). Extra owed slots (rare) reveal as a fast 400ms trail
   after the first, with no extra speech.
6. **Chapter completed** → `celebrateTier('page')` instead of `'levelup'`, banner
   `🎉 Hele siden er samlet!`, the `ProgressionCompanion` stage-up plays inside the ceremony,
   `DISMISS_MS = 4600`, and the chapter line is spoken *instead of* the reward line.
7. **Book completed** (slot 45) → one-time finale: `celebrateTier('levelup')` at full intensity,
   `Hele bogen er samlet!`, companion at final form.
8. Dismiss → `markLevelCelebrated(event.level)`; clear event/trophy/refs.

Delete `LEVEL_UP_PRAISE`, `LEVEL_UP_TAP`, `levelUpLine`, `LEVELUP_PREBAKE_MAX` from
`src/config/danish-phrases.ts` and `speakLevelUp` from `SimplifiedAudioController` (add
`speakReward(text)` there, or reuse `speak` — either way it must go through the controller, per
`.claude/rules/audio-system.md`).

### W5 — Min Bog (rework of `src/components/hub/StickerAlbum.tsx`)
Route stays `/album` (keep `musicClient`'s menu-music exception and the scene's `game` classification).
Title becomes **`📖 Min Bog`** — one name for one thing (the home card already says "Min Bog").
Header: `📒 {collected} / 45` only; the `⭐ {totalStars}` pill is removed (D10).
- **5 chapter tabs** (they stop wrapping), `{emoji} {title}` + `✅` when complete (aria `komplet`).
- **Auto-open at the current chapter** (`chapterOfSlot(collectedCount)`) so "where am I" answers
  itself. Future chapters stay tappable — no locks, no walls for a 5-year-old.
- Slots render in **path order**, three states:
  - **collected** — full-colour `art` (or emoji) + Danish label; gold variant when `count > 1`;
    existing `nyt!` badge (`data-nyt-badge`, red pill rotated -8°) + the 1600ms `markStickersSeen()`
    timer unchanged; tap = pop + `sfx.play('drop-snap')` + speak the label.
  - **next** — the same silhouette treatment as the ring, plus an accent glow ring and a slow pulse
    (reduced-motion → static glow). Exactly **one** slot in the whole book is ever in this state.
  - **locked** — a blank tactile plate. **Today every uncollected slot shows its own greyed emoji plus
    a `?`, which spoils all 45 and makes the next one unremarkable — that must go.** Tap = wiggle +
    `sfx.play('tap')`, never a sad sound.
- Retire the local `#ECF1F8` gradient (`StickerAlbum.tsx:317` — the last one in the app) for
  `tileSurface` + `softShadow`/`contactShadow` from `src/theme/depth.ts`, so slots are the same clay
  material as `TactileTile` in the games.
- Keep: the 3×3 grid (`repeat(5, 1fr)` phone-landscape), the frosted page panel, the per-chapter
  `{n} / 9 samlet` line, the `albumSetShine` complete ribbon, no-scroll layout, `BackButton variant="menu"`,
  the `?nyt=1` dev harness.

### W6 — Home (`src/components/home/HomePage.tsx`, `ProgressionCompanion.tsx`)
- `ProgressionCompanion`: stage from `companionStageForCollected(collected)` (chapters ⇔ stages,
  replacing `companionStageForLevel`'s `floor((level-1)/3)`); the badge shows the **collected count**
  — the same number as the book, never trin, since that off-by-one is exactly the confusion being
  removed. Tap speaks `Du har {n} klistermærker!` (§9). At 0 collected: badge hidden, tap just pops.
  Keep the per-theme `companionStages` art loading and the ring/badge geometry.
- "Min Bog" card (`HomePage.tsx:327-410`): keep the slim shelf and the gold fill bar, show
  `{collected} / 45`, and put **the next reward's silhouette** where `⭐ {stars}` was — so home also
  shows the prize he's working toward. Total comes from `REWARD_SLOTS` (kills the three different ways
  the album total is computed today).

### W7 — Result screen (`src/components/common/RoundResultScreen.tsx`)
Keep the beat order and timing math, the keyed-`<Fragment>` fast-forward remount, the 3-star timeline
with ascending `sfx.play('star', {rate})`, the `🏆 Ny rekord!` ribbon with up to 2 `bestLines`, the
`🔥 {n} i træk!` readout, and the `Spil igen` / `Se bog` / `Tilbage` buttons with their
`pointerEvents` gate.
- **Delete** the unreachable sticker choreography: the `outcome.stickers` map, `stickerAt` timing, the
  unconditional `sfx.play('sticker-reveal')` at `:149`, every `pageCompleted` branch, and the five
  dead sticker sentences in `speakSummary`. The ceremony owns reveals now.
- The XP meter becomes the **reward meter**: replace the trin pill with the next reward's silhouette
  and fill the bar toward the slot threshold — the visible "this round earned that prize" link. Keep
  it driven by `xp.global.xpBefore/xpAfter` and clamp to 100% on a crossing.
- Keep the level-up handoff at `:175-181` **exactly** as-is: keyed on the store cursor
  (`globalLevel() > lastCelebratedLevel`), **not** `outcome.xp.global.leveledUp`, because the crossing
  is usually mid-round.

### W8 — Narration (prebake + audit)
Replace the `LEVEL_UP_*` loops in `shared-narration-clips.js:93-103` with:
```js
for (const c of REWARD_CHAPTERS) for (const r of c.rewards) {
  da('mixed', `Nyt klistermærke! ${r.label}`)        // 45 — ALREADY BAKED, back into use
  da('mixed', `Skinnende klistermærke! ${r.label}`)  // 45 — new (gold pass)
  da('mixed', r.label)                               // 45 — new (album tap; live Azure today)
}
da('levelup', 'Sådan! Hele siden er samlet!')
da('levelup', 'Wow! Hele bogen er samlet!')
da('levelup', 'Du har ét klistermærke!')
for (let n = 2; n <= REWARD_SLOTS; n++) da('levelup', `Du har ${getDanishNumberText(n)} klistermærker!`)
```
Then `npm run tts:prebake` and commit the mp3s + `prebakedTts.ts`. **The prune will DELETE the 39
`trin` clips and the 18 dropped stickers' clips — that is expected**, not a bug; confirm the pruned
keys are genuinely gone from content, then commit the deletions. Then `npm run audit:check` → listen
in `/audit` → sign off in `docs/audit/narration-audit.json` → commit.

### W9 — Dev harness + docs
- `src/utils/devHarness.ts`: add `?rewards=<n>` (DEV only) seeding the collected count + matching XP,
  so the book / ring / ceremony are capturable at 0 / 1 / 8 / 9 / 44 / 45 without playing 72 rounds.
  Keep `?nyt=1`.
- Collapse `CLAUDE.md`'s "Progress / rewards" + "Progression / journey" bullets into ONE bullet
  describing this system.
- `AdultCorner.tsx:261` reset copy: `Dette nulstiller alle klistermærker, rekorder, stjerner og trin.`
  → drop "og trin".
- Re-capture `docs/ui-reference/{ipad,phone,portrait}/album.jpg` + `home.jpg`.

## 9. Danish copy (verbatim, child-facing)

| Where | String |
|---|---|
| Book title | `📖 Min Bog` |
| Book header count | `📒 {n} / 45` |
| Chapter tabs | `🐾 Dyr` · `🚗 Køretøjer` · `🍎 Mad` · `🌳 Natur` · `🌊 Havet` (+ `✅`, aria `komplet`) |
| Per-chapter progress | `{n} / 9 samlet` |
| Chapter-complete ribbon | `🎉 Hele siden er samlet!` |
| New-slot badge | `nyt!` |
| Reveal banner | `Nyt klistermærke!` / gold: `Skinnende! ✨` |
| Home shelf | `Min Bog` |
| Spoken — reward | `Nyt klistermærke! {label}` |
| Spoken — gold | `Skinnende klistermærke! {label}` |
| Spoken — chapter done | `Sådan! Hele siden er samlet!` |
| Spoken — book done | `Wow! Hele bogen er samlet!` |
| Spoken — companion tap | `Du har ét klistermærke!` / `Du har {n} klistermærker!` (number as Danish words via `getDanishNumberText`) |
| Spoken — album tap | `{label}` |
| Result screen (unchanged) | `Færdig! 🎉` · `🏆 Ny rekord!` · `🔥 {n} i træk!` · `Spil igen` · `Se bog` · `Tilbage` |

**The word "trin" disappears from every child-facing surface** — and from the adult reset copy.

## 10. Files to touch

**Create:** `plans/reward-book/reward-book-art-prompts.md` · `src/assets/rewards/index.ts` (+ 45
`.webp` as they land) · `src/components/common/RewardRing.tsx` ·
`src/components/common/RewardOverlay.tsx` · `src/components/common/RewardWatcher.tsx` ·
`src/services/rewardBus.ts` · `src/services/progressStore.test.ts`

**Edit:** `src/config/progression.ts` (+ `progression.test.ts`) · `src/config/stickers.ts` ·
`src/config/danish-phrases.ts` · `src/services/progressStore.ts` · `src/hooks/useProgress.ts` ·
`src/hooks/useRound.ts` · `src/hooks/useBrowseXp.ts` · `src/components/common/UnifiedMemoryGame.tsx` ·
`src/components/common/UnifiedQuizGame.tsx` · `src/components/common/RoundResultScreen.tsx` ·
`src/components/common/StickerReveal.tsx` · `src/components/common/ProgressionCompanion.tsx` ·
`src/components/hub/StickerAlbum.tsx` · `src/components/home/HomePage.tsx` ·
`src/components/common/GameShell.tsx` · `src/components/common/GameSelectionLayout.tsx` ·
`src/components/adult/AdultCorner.tsx` · `src/utils/SimplifiedAudioController.ts` ·
`src/utils/devHarness.ts` · `src/App.tsx` · `shared-narration-clips.js` ·
`src/config/prebakedTts.ts` (generated) · `CLAUDE.md` · the 16 game files listed in W2 (import/arg
removal only)

**Delete:** `src/components/common/LevelRingMini.tsx` · `LevelUpOverlay.tsx` · `LevelUpWatcher.tsx` ·
`src/services/levelUpBus.ts`

## 11. Order of work

W0 (hand the prompts over so the owner can start generating) → W1 → W2 → W3 → W4 → W5 → W6 → W7 →
W8 → W9 → art swap-in per chapter as renders arrive. W1–W7 are fully playable on emoji, so the app
stays shippable throughout.

## 12. Verification (end-to-end)

1. `npm run build` · `npm run lint` · `npm test` (progression + the new store tests green).
2. Dev servers **in Windows PowerShell, not WSL** (`node --env-file=.env.local dev-server.js` +
   `node node_modules/vite/bin/vite.js --host 127.0.0.1`); drive with the `ui-screenshot` skill.
3. **Economy proofs** (one `--eval` per case; `window.__progress` is the DEV store handle):
   - Full 8-question round with 2 wrong taps → exactly **one** slot granted and it is
     `REWARD_PATH[0]` (deterministic, not random).
   - Perfect round → still one slot, and `xpIntoLevel > 0` afterwards (carryover works).
   - `?rewards=17` → the next round grants slot 18 **and** fires the chapter-2 ceremony;
     `?rewards=18` → the following reward takes two rounds (80 XP tier).
   - `?rewards=44` → book-complete finale; `?rewards=45` → next reward is a **gold** duplicate of slot 1.
   - `collectedCount() === globalLevel() - 1` after each case.
   - Enter a browse screen, leave, re-enter → the same letter pays **once** (`progression.explored`).
4. **Visual**, iPad 1180×820 and phone-landscape 844×390, across all 4 skins
   (`?theme=kid|ocean|space|dino`) and `?reduce=1`: the ring silhouette in a game header (white shape
   on the dark Rummet world, dark on the light ones); the book at 0 / 1 / 9 / 45 collected (exactly
   one glowing next slot, every later slot blank); the ceremony via
   `window.__rewardBus.emit({level, section})`; the chapter ceremony; the home companion badge equal
   to the book count. Measure rects rather than eyeballing for the 5-tab row and the slot grid.
5. **Audio**: `npm run tts:prebake` → `npm run audit:check` clean → in an `--eval`, hook
   `HTMLMediaElement.prototype.play` and collect `currentSrc` to prove the ceremony plays the
   prebaked `Nyt klistermærke! {label}` clip (map the hash back via `prebakedTts.ts`) and that
   exactly **one** utterance fires per ceremony.
6. Console errors / page exceptions = **0** on every capture.

## 13. Risks

- **The off-by-one (`collected = level - 1`)** is the one real hazard. It lives in exactly one helper
  (`collectedFromLevel`), is unit-tested, and is guarded by the
  `collectedCount() === globalLevel() - 1` store invariant — never recompute it inline.
- Renaming 4 components/buses touches many imports; do it mechanically and let `tsc` find the rest.
- The prebake prune deletes clips — verify before committing (expected: 39 `trin` lines + the 18
  dropped stickers' lines).
- 45 renders is the largest art batch yet (alphabet was 29); the per-chapter hand-off plus optional
  `art` keeps the app shippable while it lands.

## 14. Out of scope

The persistent world and per-section bloom (D7), new skins or unlocks, per-round star thresholds,
difficulty, and the games themselves.

---

## Appendix A — verbatim current signatures (anchors; line numbers are a 2026-07-31 snapshot)

```ts
// src/config/progression.ts
export const xpToNext = (level: number): number => Math.min(160, 50 + 10 * Math.max(0, level - 1))
export function levelFromXp(totalXp: number): LevelInfo                      // :25
export const BLOOM_STAGE_XP = [0, 40, 120, 260, 480] as const                // :38  (unchanged)
export const TASK_XP: Record<string, { base: number; firstTry: number }>     // :53  (DELETED)
export function taskXp(gameId: string, firstTry: boolean): number            // :64  (REPLACED)
export function roundXp(i: RoundXpInput): number                             // :78  (perfect 6 / best 8 / page 15-dead)

// src/services/progressStore.ts   (SCHEMA_VERSION = 2 at :25, key 'bornelaering-progress' at :21)
grantTaskXp(gameId: string, opts: { firstTry: boolean; section?: SectionId }): XpGrantResult   // :585
grantLevelUpSticker(): { award: StickerAward; pageCompleted: {id,title,emoji} | null }         // :598
recordRoundResult(gameId, input: RoundResultInput, options?: RoundResultOptions): RoundOutcome // :451
  //  :488  const stickers: StickerAward[] = []      ← always empty
  //  :495  applyXp(draft, sectionForGameId(gameId), roundXp({...stickerCount: 0, pageCompleted: false}))
private grantSticker(draft, setId?): StickerAward                                             // :394
awardSticker(setId?)                                                                          // :443 (0 callers)
globalLevel(): number · xpProgressToNextLevel() · bloomFor(section) · markLevelCelebrated(level)// :605-634
private applyXp(draft, section, amount): XpGrantResult                                         // :530

// src/hooks/useRound.ts
export interface RoundConfig { length: number; starThresholds?; stickerSetId?: string; gameId?: string }  // :16
//  :72-75   if (config?.gameId) { const grant = progressStore.grantTaskXp(config.gameId, { firstTry })
//                                xpBus.emit({ amount: grant.granted, leveledUp: grant.global.leveledUp }) }

// src/components/common/LevelRingMini.tsx  → RewardRing
//  props { size = 46, flourish = false, compact = false, sx }        :21
//  centre = the level integer, Comic 800, fontSize round(size*0.42)  :100-120
//  mounted: GameShell.tsx:133 (flourish compact, 34/46) · GameSelectionLayout.tsx:153 (44)

// src/components/common/ProgressionCompanion.tsx
export const COMPANION_DEFAULT_STAGES = ['🌱','🌿','🌷','🌳','🌟'] as const                    // :19
export const companionStageForLevel = (level, stageCount) => …floor((max(1,level)-1)/3)…       // :22 (REPLACED)
//  mounted: HomePage.tsx:225 (size 104/84) · LevelUpOverlay.tsx:126 (size 180)

// src/config/stickers.ts       7 sets × 9 = 63 today
export const STICKER_SETS: StickerSet[]   // dyr, koeretoejer, mad, natur, havet, smaakryb, legetoej
export const stickerSetForSection = (section: StickerSection): string                          // :144 (DELETED)
export const totalStickerCount = () => ALL_STICKERS.length                                     // :~165

// src/services/xpBus.ts        emit({ amount, leveledUp }) — listener: the ring only
// src/services/levelUpBus.ts   emit({ level, section }) → LevelUpOverlay; DEV window.__levelUpBus
```
