# Liveliness PRD — Progression Foundation (global level + world bloom)

**Date:** 2026-07-15
**Part of:** Liveliness & Journey Overhaul (see `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md`).
**Implement FIRST.** PRD-02 (visible bloom) and PRD-03 (level-up handoff) depend on the selectors defined here.

---

## Context

Playing games today doesn't visibly accumulate into anything the child *feels* app-wide. The owner wants a
**purely rewarding progression/journey layer** with two parts:

1. **Global level (cross-game XP)** — playing *any* game ramps the child up. "Playing games rewards you in
   general." Shown to a ~5-year-old **pre-reader** as BOTH a growing companion + filling ring AND a level
   **number** badge. A level-up is a **big celebratory moment** (confetti + mascot cheer + reward reveal +
   spoken Danish praise).
2. **Per-section "world bloom"** — each of the 5 sections has a "life" level that grows as *that* section is
   played, driving how alive its menu world looks (PRD-02 renders it).

**Never locks content** — everything is always playable; progression is only a carrot. **Wiping already-earned
rewards on the schema bump is acceptable** (owner granted this), so migration stays trivial.

**Success looks like:** he finishes a round, watches an XP ring fill, and every few rounds his companion grows
a stage with a joyful "Sådan! Du er nået til trin 4!" — and coming back later, his home companion and each
section's world are visibly further along than he left them.

---

## Guardrails (from roadmap, repeated for self-containment)

- Single child, single profile — no accounts. Danish child-facing text, Comic Sans MS, 44px+ targets,
  iPad-first + responsive no-scroll, token-driven theming.
- One TTS at a time (no queue); SFX a separate short channel; new spoken phrases prebaked + auditioned.
- **Reduced-motion**: remove motion, keep reward + spoken praise.
- **No adaptive difficulty** — and critically, **XP must not depend on the difficulty setting** (fairness).

---

## Verified grounding (current code)

- `progressStore` (`src/services/progressStore.ts`) is a headless singleton: versioned `ProgressState`
  (`SCHEMA_VERSION = 1`), forward-normalising `normalize()` that **currently resets on any version mismatch**
  (`if (r.version !== SCHEMA_VERSION) return base`, line 130), 250ms debounced writes + `flush()` on
  `pagehide`/`visibilitychange:hidden`, cross-tab rehydrate on `storage` (last-writer-wins, `onStorage`),
  private-mode-safe try/catch, `commit(next)` replaces the state reference → saves → notifies.
- `SectionId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'` — **the id is `'colors'`, not
  `'farver'`** (route is `/farver`, gameIds are `colors.*`).
- `structuredCloneState()` (line 457) deep-copies each nested slice; **must be extended** to clone `progression`.
- `recordRoundResult(gameId, input, options) → RoundOutcome` (line 364) is the single round commit; it already
  returns rich data (`stickers`, `pageCompleted`, `anyNewBest`, `newBests`) — fold XP into the same commit.
- `resetAll()` (line 449) rebuilds from `defaultState()` carrying only `settings` → once `progression` is in
  `defaultState()`, reset clears it automatically.
- `useProgress()` (`src/hooks/useProgress.ts`) wraps the store via `useSyncExternalStore` (snapshot-based).
- `RoundResultScreen.tsx` runs a timed ceremony reading a `RoundOutcome`, fires SFX, `mascotBus.emit(...)`,
  one composed Danish TTS line, honors `useReducedMotion()`, has a tap-to-fast-forward keyed-remount pattern.
- `useCelebration()` / `celebrateTier(tier)` (`CelebrationEffect.tsx`): `TIER_MAP` maps
  `micro|streak|round|best|sticker|page` → `{ intensity, duration, sfx }`; reduced-motion handled inside.
- Calm browse screens (e.g. `AlphabetLearning`) award milestone stickers via `progressStore.awardSticker(setId)`
  every N **distinct** taps (a `Set` gate) — the natural hook for browse XP.
- HomePage (inline in `App.tsx`, ~98–457) already reads `useProgress()` and shows the "Min Bog" album fill.

---

## Technical design

### 1. Data model — new `progression` slice

All XP lives in one new top-level slice (clean reset, no pollution of `totals`). Global level and bloom
stage/fill are **DERIVED** (pure functions of XP) so they can never desync from the curve; the only stored
cursor is `lastCelebratedLevel` (fires the level-up ceremony exactly once, even across reload/tabs).

```ts
export interface SectionBloom { xp: number; updatedAt: number }

export interface ProgressionState {
  globalXp: number              // lifetime global XP (monotonic)
  lastCelebratedLevel: number   // highest level the ceremony has already fired for
  bloom: Record<SectionId, SectionBloom>
  updatedAt: number
}

// add to ProgressState:
export interface ProgressState {
  version: 2                    // BUMPED from 1
  stickers: { ... }             // unchanged
  perGame: Record<string, PerGameStats>   // unchanged
  totals: { totalStars: number; totalStickers: number }   // unchanged
  progression: ProgressionState // NEW
  settings: ProgressSettings    // unchanged
}
```

Helpers in `progressStore.ts`:
```ts
const SECTION_IDS: SectionId[] = ['alphabet','math','colors','english','ordleg']
const defaultBloom = (): SectionBloom => ({ xp: 0, updatedAt: 0 })
const defaultProgression = (): ProgressionState => ({
  globalXp: 0, lastCelebratedLevel: 0,
  bloom: Object.fromEntries(SECTION_IDS.map(s => [s, defaultBloom()])) as Record<SectionId, SectionBloom>,
  updatedAt: 0,
})
```

Add `progression: defaultProgression()` to `defaultState()`. Extend `structuredCloneState()` to deep-copy it
(fresh `bloom` objects) so the "replace the reference" contract holds.

### 2. Migration (kept trivial — wipe is acceptable)

Bump `SCHEMA_VERSION` to `2`. **Keep the existing wipe-on-mismatch behavior** — the owner accepts losing
already-earned stickers/stars. So `normalize()`'s `if (r.version !== SCHEMA_VERSION) return base` stays as-is;
v1 blobs simply reset to a fresh v2 default (empty stickers, trin 1, bare worlds). Just ensure `defaultState()`
includes `progression`, and that the v2 read path fills `progression` defensively (each numeric field
`Math.max(0, Math.floor(Number(x)||0))`, missing sections from `defaultBloom()`, unknown section keys dropped —
same style already used for `perGame`/`settings`).

> If a future PRD needs to preserve data across a bump, switch to additive migration then. Not now.

### 3. Curves — new pure module `src/config/progression.ts`

Pure + unit-testable (build scripts import `src/**/*.ts` directly). No imports from the store.

```ts
// Global level curve: 1-based level → XP required to reach the NEXT level.
export const xpToNext = (level: number): number =>
  Math.min(260, Math.max(20, Math.round(20 + 15 * Math.pow(Math.max(0, level - 1), 1.25))))

export interface LevelInfo {
  level: number; xpIntoLevel: number; xpForThisLevel: number; xpToNextLevel: number
}
export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1, remaining = Math.max(0, Math.floor(totalXp))
  while (remaining >= xpToNext(level)) { remaining -= xpToNext(level); level++ }
  const need = xpToNext(level)
  return { level, xpIntoLevel: remaining, xpForThisLevel: need, xpToNextLevel: need - remaining }
}

// Per-section bloom.
export const BLOOM_STAGE_XP = [0, 40, 120, 260, 480] as const   // stages 0..4
export const BLOOM_MAX_XP = 480
export const bloomStage = (xp: number): number =>
  BLOOM_STAGE_XP.reduce((acc, t, i) => (xp >= t ? i : acc), 0)
export const bloomFill = (xp: number): number => Math.min(1, Math.max(0, xp) / BLOOM_MAX_XP)
```

Tuning intent (per-round budget ≈ 20–35 XP, see §4):

| Level | XP to next | ~Rounds @~25 XP |
|--:|--:|--:|
| 1→2 | 20 | ~1 (often mid-first-round) |
| 2→3 | 35 | ~1.5 |
| 3→4 | 55 | ~2 |
| 4→5 | 77 | ~3 |
| 5→6 | 100 | ~4 |
| 9→10 | 198 | ~8 |
| 15→16 | 260 (cap) | ~10 each |

First level-up almost always inside the first completed round; 3–4 level-ups in the first ~10 rounds; then
~one per ~8–10 rounds forever (the 260 cap keeps late levels reachable in a session or two, never asymptotic).

Bloom: first new decorations after ~2 section rounds (stage 1 @ 40), full bloom (~stage 4) after ~20–25 rounds.

Round-XP helper (also pure, in this module):
```ts
export interface RoundXpInput { correct: number; total: number; mistakes: number
  anyNewBest: boolean; stickerCount: number; pageCompleted: boolean }
export function roundXp(i: RoundXpInput): number {
  let xp = 8                       // base for completing a round
  xp += 2 * Math.max(0, i.correct) // per first-try-correct
  if (i.mistakes === 0) xp += 6    // perfect-round bonus
  if (i.anyNewBest) xp += 8        // new personal best
  xp += 3 * Math.max(0, i.stickerCount)
  if (i.pageCompleted) xp += 15
  return xp
}
```

### 4. XP earning rules

**One play feeds BOTH layers.** Every grant is attributed to a `section`; the amount adds to `globalXp` **and**
`bloom[section].xp`. Global level is genuinely cross-game; bloom is per-section.

- **Bounded-round quizzes** — computed by `roundXp()` from the `RoundOutcome` the store already builds
  (≈20–35 XP typical; a weak round still ~12–15 → always visible movement, no failure state).
- **Calm browse screens** — grant a flat **+6** (`grantXp(section, 6, 'browse-milestone')`) at each existing
  distinct-tap milestone (piggyback the same `Set`-gated call site that does `awardSticker`). Distinct-tap
  gating is the anti-farm — re-tapping one tile earns nothing.
- **Fairness:** XP derives from round *structure* (length, first-try count, new-best, stickers, page), **never**
  from the difficulty setting or star thresholds. No difficulty multiplier.
- **Anti-abuse:** round XP is bounded by round structure; the engine's one-`recordRoundResult`-per-round advance
  lock prevents double grants; browse XP is distinct-tap-only. No time/daily caps (would punish engagement).

### 5. API surface (progressStore + useProgress)

```ts
export type XpReason = 'round' | 'browse-milestone' | 'sticker' | 'best' | 'page'

export interface XpGrantResult {
  granted: number; section: SectionId
  global: { xpBefore: number; xpAfter: number; levelBefore: number; levelAfter: number; leveledUp: boolean
            xpIntoLevel: number; xpToNextLevel: number; xpForThisLevel: number }
  bloom:  { xpBefore: number; xpAfter: number; stageBefore: number; stageAfter: number
            stageAdvanced: boolean; fillBefore: number; fillAfter: number }
}

// on ProgressStore:
grantXp(section: SectionId, amount: number, reason: XpReason): XpGrantResult  // feeds BOTH layers, one commit
globalLevel(): number
xpProgressToNextLevel(): { level: number; xpIntoLevel: number; xpToNextLevel: number; xpForThisLevel: number; fill: number }
bloomFor(section: SectionId): { xp: number; stage: number; fill: number }
markLevelCelebrated(level: number): void   // idempotent; only advances forward
```

- `grantXp`: clone → add to `globalXp` + `bloom[section].xp`, stamp `updatedAt` → `commit`. Compute
  `levelBefore/After` via `levelFromXp`. **Do NOT** auto-advance `lastCelebratedLevel` here — that's the UI's
  job via `markLevelCelebrated` after the ceremony plays (decouples "XP recorded" from "ceremony shown", which
  is what makes reload/cross-tab correct).
- `markLevelCelebrated(level)`: `if (level > state.progression.lastCelebratedLevel)` set it and commit.

**Fold round XP into `recordRoundResult`** (single atomic commit, zero new plumbing downstream):
```ts
export interface RoundOutcome { /* ...existing... */  xp: XpGrantResult }   // NEW field
```
Inside `recordRoundResult`, after stickers/bests are computed on the draft, derive
`section = gameId.split('.')[0] as SectionId` (colors.* → `colors`, correct), compute
`roundXp({ correct, total, mistakes, anyNewBest, stickerCount: stickers.length, pageCompleted: !!pageCompleted })`,
and apply it to the **same draft** before `commit(draft)` (compute the `XpGrantResult` off the draft numbers so
it reflects the atomic post-round state). Attach as `outcome.xp`.

`useProgress()` additions: expose `grantXp`, `globalLevel`, `xpProgress` (= `xpProgressToNextLevel()`),
`bloomFor`, `markLevelCelebrated`. Since it's `useSyncExternalStore`, every `grantXp → commit` re-renders
consumers automatically (home badge fill + section bloom update with no extra wiring).

### 6. Level-up signal (exactly-once, reload/tab-safe)

Two layers:
1. **Primary (synchronous):** `grantXp`/`recordRoundResult` **return** `leveledUp` + old/new level. The caller
   (quiz `finishRound`, browse handler) that triggered the play fires the overlay imperatively — same
   return-value pattern `recordRoundResult` already uses for `pageCompleted`.
2. **Safety net (eventually-consistent):** a mounted `<LevelUpWatcher/>` subscribes via `useProgress()` and on
   each snapshot compares `globalLevel() > state.progression.lastCelebratedLevel`; if so and no overlay is
   showing, it fires the ceremony, then calls `markLevelCelebrated(globalLevel())`. Guarantees the celebration
   survives a tab-close inside the 250ms debounce, a reload before the overlay played, or a cross-tab grant.
   `lastCelebratedLevel` is exactly what makes last-writer-wins safe (whichever tab celebrated advances the
   cursor; the other rehydrates on `storage` and stays quiet).

### 7. Level-up ceremony

A **dedicated full-screen overlay** (`LevelUpOverlay`) so it fires from any context (round end, browse, memory)
with one implementation. Mounted once at app root (sibling of `PersistentWorld` in `App.tsx`), driven by a
tiny `levelUpBus` (mirror `mascotBus`):

```ts
// src/services/levelUpBus.ts
type LevelUpEvent = { level: number; section: SectionId | null }
export const levelUpBus = { emit(e: LevelUpEvent){…}, subscribe(cb){…} }
```

Beats (reuse existing machinery; honor `useReducedMotion()` — collapse stagger to ~0, skip confetti/growth
animation, but keep reward + spoken praise):
1. Scrim + pointer-inert gate (RoundResultScreen's buttons-inert pattern).
2. `celebrateTier('levelup')` — biggest confetti + fanfare SFX.
3. `mascotBus.emit('round')` (or a new `'levelup'` event) → corner/menu mascot cheers.
4. **Growth reveal** — the companion (§8) animates old→new stage, enlarged center-screen; the ring fills + pops.
5. Level number badge pops `levelBefore → levelAfter`.
6. One spoken Danish praise line via `speakLevelUp(level)` (§below), guarded by a `spokenRef` so a
   fast-forward can't double-speak.
7. Auto-dismiss ~3.2s or tap-to-skip → on dismiss call `markLevelCelebrated(level)`.

**Add a tier** to `TIER_MAP` in `CelebrationEffect.tsx`:
`levelup: { intensity: 'high', duration: 3400, sfx: 'level-up' }` (add a `level-up` SfxCue in PRD-02's SFX work,
or alias `page-complete` initially).

**Composition with RoundResultScreen:** it runs its normal beats reading `outcome`, PLUS a new **XP-meter beat**
(a filling ring/bar mirroring the home badge, animating `xpIntoLevel` before→after, placed after the sticker
beat) on *every* round. If `outcome.xp.global.leveledUp`, RoundResultScreen does **not** draw the level-up
itself — when it reaches buttons-ready (or on fast-forward) it emits
`levelUpBus.emit({ level: outcome.xp.global.levelAfter, section })`; the overlay takes over on top as the
climactic final beat, then returns to the buttons. Keeps the result screen's tight no-scroll timeline
uncrowded and lets browse/memory reuse the same overlay.

### 8. Child-facing growth display

**Metaphor: a growing companion.** A filling **ring** wrapped around a small creature that **grows in discrete
stages** (and gains small accessories at level milestones), plus a **number badge**:

- **Ring** fills with `xpProgress.fill` (0..1 within the current level); each round nudges it, a level-up
  completes + resets it.
- **Companion** scales in steps + gains decorations every ~3 levels (theme-appropriate: e.g. sprout→plant→flower
  or egg→chick→bird). Glanceable "I'm growing" signal for a pre-reader.
- **Number badge** shows `globalLevel()`.

**Token-driven** like `scene.mascot` — add an OPTIONAL token so flat skins fall back to a generic companion:
```ts
// on SceneTokens (src/theme/tokens/types.ts), optional:
progressionCompanion?: { stages: string[] /* asset urls or emoji fallbacks */; ringColor: string }
```
Default in `buildTheme` when absent (generic companion + `theme.categories`-derived ring color).

**Placement:**
- **Home page** — a prominent tappable companion + ring + badge in a corner (HomePage already reads
  `useProgress()` + shows album fill — sit alongside it). Tapping speaks `speakLevelUp`-style
  "Du er på trin {n}!". This is the "home base" where the child watches growth between sessions.
- **RoundResultScreen** — the inline XP-meter beat (§7).
- A persistent HUD corner is **out of scope for v1** (respect no-scroll/landscape); home + result meter +
  overlay is enough.

Reduced motion → companion/badge render statically (no growth animation).

### 9. Spoken Danish praise

New controller method per the audio rules (add to `SimplifiedAudioController`, expose via the audio hook, list
in `STABLE_AUDIO_METHODS`):
```ts
async speakLevelUp(level: number): Promise<string>  // one call, single TTS channel
```
Implement via the existing `playAudio(...)` → `ttsClient.synthesizeAndPlay` path; call
`updateUserInteraction()` first. The praise **prefix phrases are a closed set → prebake + audition**; the
trailing level number rides live Azure. If mixing prebaked prefix + live number on one channel is awkward for
v1, speak the whole line via live Azure (still one call).

### 10. Reset

XP/level/bloom are unambiguously *fremgang* → **reset MUST clear `progression`** to `defaultProgression()`.
Because `resetAll()` rebuilds from `defaultState()` (carrying only `settings`), this happens automatically once
`progression` is in `defaultState()` — just verify nothing else re-seeds it. **Update the AdultGate reset copy**
to mention "trin" so the companion doesn't silently shrink unexpectedly:
> "Dette sletter alle klistermærker, rekorder, stjerner og trin."

---

## Danish copy

Use **"trin"** (warm, concrete; avoids formal "niveau"). Level number spoken.

Level-up praise (rotate):
- "Sådan! Du er nået til trin {n}!"
- "Wow! Du voksede til trin {n}!"
- "Se dig! Trin {n}!"
- "Du bliver dygtigere! Trin {n}!"

Companion / badge:
- Tap label (spoken): "Du er på trin {n}!"
- Growth line (optional, spoken/visual): "Din ven voksede!"

Bloom (optional, spoken rarely — e.g. first time a section reaches a new stage):
- "Din verden vokser!"
- "Se, hvor levende det er blevet!"

Reset gate copy: "Dette sletter alle klistermærker, rekorder, stjerner og trin."

The XP meter itself is text-free (pre-reader) — a filling ring only; the sole number is the level integer.
Prebake + audition all fixed phrases.

---

## Files to touch

**Create**
- `src/config/progression.ts` — `xpToNext`, `levelFromXp`, bloom helpers, `roundXp` (pure).
- `src/config/progression.test.ts` — unit tests for the curves (level thresholds, bloom stages, roundXp).
- `src/services/levelUpBus.ts` — tiny emitter (mirror `src/services/mascotBus.ts`).
- `src/components/common/LevelUpOverlay.tsx` — the full-screen ceremony.
- `src/components/common/LevelUpWatcher.tsx` — snapshot-diff safety net → fires overlay + `markLevelCelebrated`.
- `src/components/common/ProgressionCompanion.tsx` — home companion + ring + level badge (tappable).

**Edit**
- `src/services/progressStore.ts` — v2 slice, `defaultProgression`, `structuredCloneState` deep-copy, `grantXp`,
  selectors, `markLevelCelebrated`, fold XP into `recordRoundResult` (`outcome.xp`), `RoundOutcome.xp` field.
- `src/hooks/useProgress.ts` — expose the new API.
- `src/utils/SimplifiedAudioController.ts` (+ the audio hook + `STABLE_AUDIO_METHODS`) — `speakLevelUp`.
- `src/components/common/CelebrationEffect.tsx` — add `'levelup'` to `TIER_MAP`.
- `src/components/common/RoundResultScreen.tsx` — XP-meter beat + `levelUpBus.emit` on level-up.
- `src/App.tsx` — mount `<LevelUpOverlay/>` + `<LevelUpWatcher/>` at app root; render `<ProgressionCompanion/>`
  on the home page.
- Browse screens (e.g. `AlphabetLearning`, `NumberLearning`, `FarverLearning`, `EnglishLearning`) — add
  `grantXp(section, 6, 'browse-milestone')` beside the milestone `awardSticker` call.
- The AdultGate reset copy (wherever "Nulstil al fremgang" text lives).
- Prebake manifest — run `npm run tts:prebake` after adding `speakLevelUp` phrases; commit the output.

---

## Verification

- `npm run dev` + `npm run dev:api` in **Windows PowerShell**.
- `npm test` (or the repo's test runner) green for `src/config/progression.test.ts` — assert: level 1 needs 20
  XP, cumulative thresholds match the table, `bloomStage(40)===1`, `bloomStage(480)===4`, `roundXp` of a
  perfect 8/8 no-best-no-page round.
- `npm run build` + `npm run lint` clean.
- With `ui-screenshot` on an iPad viewport:
  - Play one quiz round → confirm the XP-meter beat animates on RoundResultScreen and the home companion ring
    advanced afterward.
  - **Force a level-up** (e.g. via `window.__progress.grantXp('math', 500, 'round')` in the dev console, or
    play enough rounds) → confirm `LevelUpOverlay` fires once, plays confetti + spoken "trin {n}", the companion
    grows, and does **not** re-fire on reload.
  - Tap the home companion → hears "Du er på trin {n}!".
  - Toggle `prefers-reduced-motion` → overlay still shows reward + speaks, no motion; no console errors.
  - Parent reset → companion returns to trin 1, worlds bare.

---

## Embedded implementation reference (Appendix A) — verbatim current signatures

From `src/services/progressStore.ts`:
```ts
export type SectionId = 'alphabet' | 'math' | 'colors' | 'english' | 'ordleg'
const STORAGE_KEY = 'bornelaering-progress'
const SCHEMA_VERSION = 1 as const   // → change to 2

export interface RoundResultInput { correct: number; total: number; longestStreak: number }
export interface RoundResultOptions { starThresholds?: { three: number; two: number }; stickerSetId?: string }
export interface RoundOutcome {
  gameId: string; correct: number; total: number; mistakes: number; stars: number; longestStreak: number
  previousBests: { streak: number; stars: number; count: number }
  newBests: { streak: boolean; stars: boolean; count: boolean }; anyNewBest: boolean
  stickers: StickerAward[]; pageCompleted: { id: string; title: string; emoji: string } | null
  totals: { totalStars: number; totalStickers: number }
}
// class ProgressStore methods (current):
get(): ProgressState
getGame(gameId: string): PerGameStats
difficultyFor(section: SectionId): DifficultyLevel
subscribe(listener: () => void): () => void
awardSticker(setId?: string): StickerAward
recordRoundResult(gameId, input, options?): RoundOutcome
markStickersSeen(): void
setSetting<K>(key, value): void
resetAll(): void
flush(): void
// singleton export + dev handle:
export const progressStore = new ProgressStore()
// window.__progress in DEV
```

`normalize()` mismatch line (keep as-is; v1 → reset): `if (r.version !== SCHEMA_VERSION) return base` (line 130).
`defaultState()` at line 115. `structuredCloneState()` at line 457. `recordRoundResult` at line 364,
`this.commit(draft)` at line 412. `resetAll()` at line 449.

From `CelebrationEffect.tsx` (current `TIER_MAP` keys): `micro | streak | round | best | sticker | page`;
`useCelebration()` returns `{ showCelebration, celebrate, celebrateTier, stopCelebration, ... }`.

`mascotBus` events (mirror for `levelUpBus`): `welcome | idle | correct | wrong | streak | round | hint | sticker`.
