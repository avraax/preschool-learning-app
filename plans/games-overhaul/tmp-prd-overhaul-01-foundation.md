# Overhaul PRD — Foundation (shared systems)

**Date:** 2026-06-15
**Part of:** Game Experience Overhaul (see `plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md`).
**Implement FIRST.** Every per-game PRD depends on the systems defined here.

---

## Context

The overhaul gives all 18 game experiences a level-up across juice, motivation, depth, and learning clarity, anchored to one ~5-year-old (iPad-first). The owner chose a **persistent, shared reward hub** built on two motivators — **collecting** (a sticker album) and **beating his best** (streak / stars / personal-best). To deliver that consistently, the heavy lifting belongs in shared systems, not copied into each game.

This PRD defines five shared systems plus an app-wide quality principle:

1. **Progress store** — persistent, single-profile state (localStorage).
2. **Sticker album + reward hub** — the shared collection, earning rules, reveal moment, home-screen surface.
3. **Bounded-round + result-screen system** — turns endless quizzes into rounds that finish and reward.
4. **SFX layer** — formalizes the existing Howler/SoundManager seed into an app-wide sound system.
5. **Celebration / juice tiers** — escalating reward moments (correct → round → new best → new sticker → page complete).
6. **App-wide visual quality floor** (principle, not code).

**Success looks like:** he plays a round, sees how he did vs his best, earns a sticker with a satisfying reveal, watches his album fill across sessions, and wants "one more" — and it all feels at least as polished as today's immersive themed UI, everywhere in the app.

---

## Guardrails (from roadmap, repeated for self-containment)

- Single child, single profile — **no accounts, no multi-user, no parent dashboard** (a hidden parent reset is enough).
- **Static difficulty** — no adaptive difficulty, no level pickers.
- Danish child-facing text, Comic Sans MS, 44px+ targets, iPad-first + responsive no-scroll.
- **Token-driven theming**; educational colors stay as data.
- One TTS at a time (no queue). SFX is a separate short channel.
- Respect `prefers-reduced-motion`.

---

## Principle 0 — App-wide visual quality floor

The current immersive aesthetic — lifted/3D tiles (`AnswerTile`), themed world backdrops, mascots, soft-3D PNG section icons, custom imagery, the 6-skin token system — is the **minimum** bar. **Every surface this program adds or touches** (album, reward hub, round-result screen, sticker-reveal, any reworked game, *and the home/section menus themselves*) must **match or exceed** it.

Concretely:
- All styling via theme tokens (`useTheme()`, `getCategoryTheme(id)`, `theme.decor`, `theme.customShadows`). No hardcoded colors/shadows in components.
- New surfaces use the same depth language as `AnswerTile` (top-light gradient, colored 3D lip, layered halo+ambient shadow) — see `src/components/common/AnswerTile.tsx`.
- New surfaces render correctly in **all 6 themes** (flat *and* immersive skins) and in portrait + landscape, no scroll.
- Animations use Framer Motion, honor reduced-motion, and feel tactile (spring, not linear).
- Prefer the existing mascot/imagery assets; flag any net-new art needs explicitly in the per-game PRD.

> This principle is a review gate: a surface that looks more "utilitarian" than today's games is not done.

---

## System 1 — Progress store (persistence)

**New file:** `src/services/progressStore.ts` (singleton, mirrors the shape/discipline of `src/services/ttsClient.ts`).
**New hook:** `src/hooks/useProgress.ts` (React interface; subscribe + update).

Follows the existing localStorage pattern used in `src/theme/ThemeProvider.tsx` and `src/config/voiceOverride.ts`.

### Responsibilities
- Single source of truth for all persistent progress. Synchronous reads from an in-memory cache hydrated from localStorage on boot; writes debounced to localStorage.
- **Versioned schema** with forward-safe migration (`version` field; unknown/old → migrate or reset that slice, never crash).
- Resilient to private-mode / quota errors (wrap in try/catch; degrade to in-memory only — game still works, just doesn't persist).

### Data model (single localStorage key `bornelaering-progress`, hyphen convention matches `bornelaering-theme`; schema version lives in the JSON `version` field)
```ts
interface ProgressState {
  version: 1
  stickers: {
    collected: Record<string /* stickerId */, { count: number; firstAt: number }>
    // count>1 = duplicate (becomes "shiny"); see System 2
  }
  perGame: Record<string /* gameId */, {
    bestStreak: number          // longest correct-in-a-row ever
    bestStars: number           // best round star rating (1–3)
    bestCount: number           // most correct in one sitting
    roundsCompleted: number
    lifetimeCorrect: number
  }>
  totals: {
    totalStars: number          // lifetime stars (shown on hub)
    totalStickers: number
  }
  settings: {
    sfxEnabled: boolean         // default true
    musicEnabled: boolean       // reserved; default false (no music in v1)
  }
}
```

### API (illustrative)
```ts
progressStore.get(): ProgressState
progressStore.recordRoundResult(gameId, { correct, total, longestStreak }): RoundOutcome
//   → computes stars, detects new bests, awards sticker(s), persists, returns what to celebrate
progressStore.awardSticker(setId?): StickerAward | null   // next uncollected (see System 2)
progressStore.getGame(gameId): PerGameStats
progressStore.setSetting(key, value)
progressStore.resetAll()    // parent reset
useProgress()               // hook: returns state + bound actions, re-renders on change
```

`gameId` = stable route-derived id (e.g. `math.addition`, `alphabet.quiz`, `ordleg.spelling`).

### Parent reset
A discreet, child-resistant control (e.g. long-press / multi-tap on a version label, or a tiny gear on the home screen behind a "hold 3s") that calls `resetAll()` with a confirm. Keep out of the child's normal flow. Exact placement = decide during home-screen rework; spec the hook now.

---

## System 2 — Sticker album + reward hub

The shared collection. **This is the meta-game.** Stickers are the currency of "collecting"; the album is where pride lives; the hub is the home-screen entry point.

### Content model
**New file:** `src/config/stickers.ts`

```ts
interface StickerSet { id: string; title: string /* Danish */; emoji: string /* page icon */; stickers: Sticker[] }
interface Sticker   { id: string; label: string /* Danish */; emoji: string; rarity?: 'normal' | 'shiny' }
```

- **v1 sets (pages):** start with ~4 themed pages of 9 each = 36 stickers. Suggested: **Dyr** 🐾, **Køretøjer** 🚗, **Mad** 🍎, **Natur** 🌳. Extensible — adding a set/page is data-only.
- Stickers are emoji-based v1 (consistent with the app's emoji content) — **flag in a later session** if we want custom illustrated stickers to raise the bar further (aligns with Principle 0; would need art).
- Sets are **app-wide**, not per-section: any game can award from the global pool. (Optional later: bias a section toward a themed set.)

### Earning rules (tuned for "new sticker = magic", avoid dupe-disappointment)
- **1 sticker per completed round.** Award the **next not-yet-collected** sticker (deterministic-ish: pick a random *uncollected* one) so early play always yields novelty.
- **Bonus sticker** on a **new personal best** (streak, stars, or count) within that round.
- When the album is **full**, further awards become **duplicates** → shown as **shiny** / sparkle variants (still a positive "ooh, a shiny!" moment, never "you already have this" sadness).
- **Page-complete reward:** finishing a page triggers a bigger celebration (System 5 tier) + a one-off shiny page badge.
- Free-exploration games (Lære Tal, Lær Alfabetet, Lær Engelsk) award stickers via **exploration milestones** (e.g. every N distinct items tapped) since they have no "round" — define per-game.

### The reveal moment (the dopamine hit)
**New component:** `src/components/common/StickerReveal.tsx`
- Sticker flips/pops in with spring scale + sparkle (reuse `CelebrationEffect` particles + a dedicated `sticker-reveal` SFX).
- "Nyt klistermærke!" banner, the sticker name spoken via TTS, a satisfying landing into a slot.
- Shiny variant gets extra shimmer.
- Must hit Principle 0 quality.

### The album
**New component + route:** `src/components/hub/StickerAlbum.tsx`, route `/album` (lazy-loaded like other routes in `App.tsx`).
- Themed "book" with pages (tabs/spreads), one per set. Collected = bright sticker; uncollected = faint silhouette/`?` placeholder.
- Tap a collected sticker → it animates + speaks its name (gentle, satisfying, no fail state).
- Per-page "x / 9 samlet" progress. Reuse `LearningGrid` layout ideas but styled to the album/book metaphor at the quality floor.
- Fully themed across all 6 skins; no-scroll, tablet-first.

### The hub (home-screen integration)
- Add a prominent, kid-legible **album entry** on the home screen (e.g. a book that visibly "fills"), plus a **total stars** count (feeds "beating his best" pride).
- Must integrate with the existing home page + `ThemeSelector` + immersive backdrop **without lowering** current home-screen polish (Principle 0 explicitly covers the home/menus).
- Home-screen rework details (layout, where the book sits, parent-reset placement) are refined in a short home-screen pass — but the entry point and the data it reads are specified here.

---

## System 3 — Bounded-round + result-screen system

Converts task/quiz games from endless loops into **rounds that finish and reward**, enabling stars/best/stickers. Free-exploration games keep their open format.

### Round model
**New hook:** `src/hooks/useRound.ts` (wraps round state: question index, correct count, current streak, longest streak, done flag).

- **Round length:** default **8 questions** (config per game; keep short for a 5yo's attention). Constant, not adaptive.
- **No timer.** Wrong answers don't end the round and aren't punished mid-round (current "retry until right" feel is preserved); they only affect the **star rating**.
- **Streak** = consecutive correct *on first try*; tracked for "longest streak" best.

### Integration with the shared quiz engine
`src/components/common/UnifiedQuizGame.tsx` currently loops forever and auto-advances on correct. Extend its config (non-breaking; default off) with:
```ts
round?: {
  length: number               // e.g. 8
  starThresholds?: { three: number; two: number }  // mistakes allowed; default 3★=0, 2★≤2, else 1★
  stickerSetId?: string         // optional bias; else global pool
}
```
- **Exact injection point:** `UnifiedQuizGame.tsx` lines **260–265** — the `setTimeout(... if (isCorrect) { stopCelebration(); generateNewQuestion() })` auto-advance. Replace the `generateNewQuestion()` call with: increment an answered-counter; if `counter >= round.length` → set a `roundDone` state that renders `RoundResultScreen` (as an overlay/replacement of the grid inside `GameShell`); else `generateNewQuestion()`.
- **Counting semantics:** a "question" counts when the child advances (i.e. answers correctly — wrong answers already don't advance, line 261). **Streak** = correct **on first attempt**; track a per-question `firstAttempt` boolean (set false once any wrong tile is tapped for the current item) so a wrong-then-right does not extend the streak. Mistakes for the star rating = count of questions where `firstAttempt` was broken.
- On replay, reset the counter + `roundDone` and call `generateNewQuestion()`; on round end, call `progressStore.recordRoundResult(gameId, {...})` and feed its `RoundOutcome` to the result screen.
- This keeps all four UnifiedQuizGame-based games (English ×3, Læs Ordet) and the math/alphabet quizzes on one code path. Hand-rolled games (Stav Ordet, Sig et Ord, Farver, Memory) call `useRound` + the result screen directly.

### Result / reward screen
**New component:** `src/components/common/RoundResultScreen.tsx`
Choreography (each step is a System 5 juice beat):
1. **Stars** fly in (1–3) based on mistakes — always ≥1 (no failure state for a 5yo).
2. **"Ny rekord!"** ribbon if a new best (streak / stars / count) — the "beating his best" payoff. Show old → new.
3. **Streak readout** ("8 i træk!") spoken + shown.
4. **Sticker reveal** (System 2) — round sticker + any best-bonus sticker.
5. Big **"Spil igen"** (replay) primary button + **"Tilbage"** (menu) + a peek at the album ("Se bog").
- Spoken Danish summary (gentle, celebratory). Star thresholds and copy are config/centralized.
- Quality floor applies (this is a hero screen — it should feel like a reward, themed across all skins).

### Score → stars transition
The current `ScoreChip` (`src/components/common/ScoreChip.tsx`) stays as the **in-round** running indicator (it can show `x / length` via its `progress` format). The **between-rounds** identity shifts to **stars + album**. `useGameState` score still drives the in-round count.

---

## System 4 — SFX layer (rich sound effects)

Formalize the existing seed (`src/components/common/balloon/SoundManager.tsx`, Howler, with per-theme mascot sound packs already on disk at `public/sounds/mascots/<theme>/*.ogg`) into an app-wide system.

**New file:** `src/services/sfxClient.ts` (sibling to `ttsClient.ts`; Howler-based).

### Design rules
- **Separate channel from TTS.** SFX never cancels TTS and vice-versa. SFX are short (<~600ms) and may overlap voice; keep them subtle so they don't fight narration. (TTS rules in `.claude/rules/audio-system.md` are unchanged.)
- **Preload** the small SFX set on first user interaction (same gesture that unlocks audio). Graceful no-op if a file is missing (SoundManager already degrades to silence).
- Global **mute** via `progressStore.settings.sfxEnabled` (toggle on home/settings). Respect it everywhere.
- **Theme-aware where it adds value:** the per-theme mascot packs can voice the mascot reactions; generic UI cues (tap, correct, wrong) can be shared across themes.

### Core sound palette (define ids; source/curate files into `public/sounds/ui/`)
| Cue id | When | Feel |
|---|---|---|
| `tap` | any answer/letter/card tap | soft, quick |
| `correct` | right answer | bright, short, positive |
| `wrong` | wrong answer | **gentle**, non-punishing (no harsh buzzer) |
| `drop-snap` | item lands in target (Farvejagt, Stav Ordet slot) | satisfying click/pop |
| `flip` | memory card flip | light whoosh |
| `streak-up` | streak milestone within round | rising sparkle |
| `star` | each star on result screen | per-star "ting" (ascending) |
| `sticker-reveal` | new sticker | magical chime |
| `round-complete` | result screen entry | short happy jingle |
| `page-complete` | album page filled | bigger fanfare |

- Many suitable sounds already exist under `public/sounds/mascots/*` (boings, chimes, pops, jingles) — **curate/reuse first**, source new only for gaps. List final file choices in implementation.
- API: `sfx.play('correct')`, `sfx.preload()`, `sfx.setEnabled(bool)`.

---

## System 5 — Celebration / juice tiers

Today `CelebrationEffect` (`src/components/common/CelebrationEffect.tsx` + `useCelebration`) fires one medium confetti burst on every correct answer — same intensity always, so it stops feeling special. Replace "one size" with **escalating tiers**, so big moments feel bigger:

| Tier | Trigger | Treatment |
|---|---|---|
| **micro** | correct answer mid-round | small sparkle on tile + `correct` SFX (lighter than today's full confetti) |
| **streak** | streak milestone (e.g. every 3) | brief themed burst + `streak-up` SFX + mascot cheer |
| **round** | round complete | result-screen confetti, `round-complete` jingle |
| **best** | new personal best | extra burst + "Ny rekord!" + `star` flourish |
| **sticker** | sticker earned | `StickerReveal` + `sticker-reveal` SFX |
| **page** | album page filled | full-screen fanfare + `page-complete` |

- Extend `useCelebration` / `CelebrationEffect` to accept a tier (keep existing `intensity` working; map tiers → intensity + extras). Already reads `prefers-reduced-motion` — preserve that; reduced-motion keeps SFX + a calm visual.
- Keep theme-aware emoji/confetti sets that already exist in `CelebrationEffect`.

---

## Files (new + modified)

**New**
- `src/services/progressStore.ts` — persistent state singleton
- `src/hooks/useProgress.ts` — React interface
- `src/hooks/useRound.ts` — round state
- `src/services/sfxClient.ts` — SFX system
- `src/config/stickers.ts` — sticker set/data
- `src/components/common/RoundResultScreen.tsx` — result/reward hero screen
- `src/components/common/StickerReveal.tsx` — sticker reveal moment
- `src/components/hub/StickerAlbum.tsx` — album (route `/album`)
- `public/sounds/ui/*` — curated UI SFX (reuse from `mascots/` where possible)

**Modified**
- `src/components/common/UnifiedQuizGame.tsx` — optional `round` config → result screen path
- `src/components/common/CelebrationEffect.tsx` — celebration tiers
- `src/components/common/ScoreChip.tsx` — in-round `progress` usage (already supported; confirm)
- `src/App.tsx` — `/album` route (lazy), preload SFX on audio unlock
- Home page + `src/theme/ThemeProvider.tsx` area — album/hub entry + total-stars + parent reset hook
- `CLAUDE.md` — document `/album`, progress store, SFX system, sticker album

**Reuse (do not reinvent)**
- `GameShell`, `CelebrationEffect`/`useCelebration`, `AnswerTile` (depth language), `ScoreChip`, `RepeatButton`, `LearningGrid`, `getCategoryTheme`, theme tokens, `SoundManager`/Howler, `ttsClient` (for spoken reveal copy), `useGameState`.

---

## Verification (end-to-end, on iPad-sized viewport)

Run both dev servers in **Windows PowerShell** (`npm run dev` + `npm run dev:api` — never WSL; see project memory). Then:

1. **Persistence:** complete a round → earn sticker → reload page → album + stars + bests survive. Open in private window → still works (in-memory), no crash.
2. **Round + result:** a UnifiedQuizGame game with `round` set ends after N questions, shows correct stars for 0 / 2 / 3 mistakes, plays the choreography, replay + back work.
3. **Best detection:** beat a prior streak/stars/count → "Ny rekord!" shows old→new; not beating → no ribbon.
4. **Sticker flow:** first rounds always give new stickers; full album → shiny duplicates (no negative state); page-complete fanfare fires once.
5. **SFX:** each palette cue fires on its trigger; mute toggle silences all SFX but not TTS; missing file = silent, no error.
6. **Quality floor:** album, result screen, reveal, and home/hub render correctly and look at-or-above current game polish in **all 6 themes**, portrait + landscape, **no scroll**; reduced-motion degrades gracefully.
7. `npm run build` and `npm run lint` clean. Use the `ui-screenshot` skill to confirm layouts + zero console errors.

---

## Appendix A — Embedded implementation reference (so a clean session needs no re-exploration)

Verbatim contracts of the code this PRD extends. Cited from the repo at write time (2026-06-15).

### `UnifiedQuizGame` config + loop — `src/components/common/UnifiedQuizGame.tsx`
```ts
export interface QuizItem {
  value: string | number; display: string | number
  audioPrompt: string; repeatWord: string
  questionVisual?: { emoji: string; word?: string }
}
export interface UnifiedQuizConfig {
  quizType: 'alphabet' | 'counting' | 'arithmetic' | 'english' | 'ordleg'
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem) => QuizItem[]
  title: string; emoji: string
  teacherCharacter: 'owl' | 'fox'
  theme: CategoryTheme; backRoute: string
  ScoreChipComponent: React.ComponentType<any>
  RepeatButtonComponent: React.ComponentType<any>
  showRepeat?: boolean            // default true
  gameWelcomeType: string
  speakQuizPrompt:  (item: QuizItem, audio: any) => Promise<string>
  speakClickedItem: (item: QuizItem, audio: any) => Promise<string>
  getRepeatAudio:   (item: QuizItem, audio: any) => Promise<string>
}
```
- Add an **optional** `round?: { length: number; starThresholds?: {three:number;two:number}; stickerSetId?: string }` to this interface (non-breaking; absent → today's endless behavior).
- Correct-answer handler: `handleItemClick` (~line 219); auto-advance at **lines 260–265**. Welcome/gate logic lines 154–217 (do not disturb). Body renders inside `GameShell` (line 306); the answer grid is the `flex:'0 1 auto'` box at line 375 — render `RoundResultScreen` in its place when `roundDone`.

### `useGameState` — `src/hooks/useGameState.ts`
```ts
useGameState(initialScore=0) => { score, setScore, incrementScore, resetScore, isScoreNarrating, handleScoreClick }
// also: useTargetGameState(initialScore=0, target=10) => { ...useGameState, target, isComplete, progress }  // use for Farvejagt-style target games
```

### Celebration — `src/components/common/CelebrationEffect.tsx`
```ts
useCelebration() => { showCelebration, celebrationIntensity, celebrate(intensity?: 'low'|'medium'|'high'), stopCelebration }
// <CelebrationEffect show onComplete? confettiColors? duration=3000 intensity='medium' sx? />
```
- Already reads `prefers-reduced-motion` and pulls themed confetti/emoji from `theme.decor.confettiColors` / `theme.scene`. **Tier work:** extend `useCelebration` to accept a tier that maps internally to `{intensity, duration}` + fires the matching `sfx` cue — keep the existing `intensity` API working.

### Shell — `src/components/common/GameShell.tsx`
```tsx
<GameShell categoryId title backRoute score? guideReaction? celebration?={{show,intensity?,onComplete?}} guide? dense?>{children}</GameShell>
```
- Uses `getCategoryTheme(categoryId)`, `theme.scene.dark` (light title), `theme.scene.layers.length>0` (immersive). The result screen + sticker reveal should live **inside** this shell (so backdrop/header/score stay consistent), or as a `position:fixed` overlay above it.

### SFX seed — `src/components/common/balloon/SoundManager.tsx`
- `balloonSoundManager` (Howler singleton) + `useBalloonSound()`. Pattern to mirror in `sfxClient.ts`: `new Howl({src, html5:true, preload, onloaderror})`, a fresh `Howl` per play for overlap, graceful `console.warn` on missing file, `setVolume/mute/unmute/stopAll`.
- **Audio-rule note:** `.claude/rules/audio-system.md` forbids Howler/HTML5 Audio *inline in components* and mandates one TTS channel with no queue. SFX is the **documented Howler exception** — keep it in a **service + hook** (exactly like `balloonSoundManager`/`useBalloonSound`), never inline, and **never** route SFX through `SimplifiedAudioController` (that singleton is TTS-only and cancels on each new play). SFX is a separate, overlap-friendly channel.

### Routing + persistence — `src/App.tsx`, `src/theme/ThemeProvider.tsx`
- Routes are lazy: `const X = lazy(() => import('...'))` (lines 22–45) and registered in the `<Routes>` block (lines 737–790). Add `const StickerAlbum = lazy(...)` + `<Route path="/album" element={<StickerAlbum/>} />`.
- `NavigationAudioCleanup` (lines 600–614) cancels TTS on route change — have it call `sfx.stopAll?.()` too (optional).
- **localStorage pattern** (`ThemeProvider.tsx` lines 14, 30–48): module-const `STORAGE_KEY`, `try { localStorage.getItem/setItem } catch {}`. `progressStore` follows this exactly with key `bornelaering-progress`.
- **Home hub integration point:** `HomePage` (App.tsx ~line 103) renders `homeCards` into a `<Grid>` (lines 413–508); `ThemeSelector` is top-right (line 400); `ThemeMascot` bottom-left (line 515); `VersionDisplay` is the fixed bottom label (good anchor for a child-resistant parent-reset long-press). Add the album entry + total-stars readout here without lowering current polish (Principle 0).

## Open questions resolved this session
Collectible = **sticker album**; architecture = **one shared hub**; rounds = **bounded** (default 8); best = **streak + stars + personal-best count**, **no timers**; sound = **rich SFX**; lineup = **fully open**; quality floor = **match-or-exceed current immersive UI, app-wide**; device = **iPad-first**.

## Deferred to per-game PRDs
Per-game round lengths & star thresholds; which sticker set each game biases toward; exploration-milestone rules for the 3 browse games; exact home-screen layout + parent-reset placement; whether to commission custom illustrated stickers.
