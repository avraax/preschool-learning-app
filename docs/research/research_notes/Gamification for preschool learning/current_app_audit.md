# Current app audit — Børnelæring gamification inventory (code research, 2026-10-13)

Sources are repo files (paths relative to `C:/Source/preschool-learning-app/`) and git commits. No web
research was done for this note. Screenshot caveat up front: `docs/ui-reference/` was captured
2026-08-01 (v1.0.45) and is **stale** for several games (it still shows the deleted Sammenlign Tal
crocodile, Tal Quiz's removed counting-object row, the removed `english-translate` game, and the old
8-dot score pill in the header).

## 1. Every game: section, gameId, core loop, input, what the child sees/hears, quiz vs browse

### Takeaway
There are 21 child-facing play surfaces across 5 sections: 16 endless task games ("quizzes") and 4 calm
"Lær …" browses, plus Memory (one tile in Alfabet, one in Matematik). Only 7 games accept drag (and all
of those also accept tap); the rest are tap-a-tile quizzes, most built on the shared `UnifiedQuizGame`
engine.

### Cited Findings
Route list and menu titles: [src/App.tsx:276-319](src/App.tsx), [src/config/categoryThemes.ts:45-200](src/config/categoryThemes.ts). gameIds: grep of `gameId:` across `src/` (math addition/subtraction ids are passed dynamically by `MathOperationGame`). Per-game behaviour: `.claude/rules/games-*.md` as cited per row.

| Section | Title (route) | gameId | Type | Input | Core loop / what the child sees & hears |
|---|---|---|---|---|---|
| Alfabet | Lær Alfabetet (`/alphabet/learn`) | — (EXEMPT browse) | browse | tap | Grid of letters; tap speaks "{bogstav} som {ord}"; "Hør alfabetet" pill autoplays A→Å bare letter names in groups; earns per-new-item browse XP, autoplay earns none — [games-alphabet.md](.claude/rules/games-alphabet.md) |
| Alfabet | Bogstav Quiz (`/alphabet/quiz`) | `alphabet.quiz` | quiz | tap only | Baked soft-3D picture shown; tap the letter the word starts with; confusable-seeded distractors at Normal/Svær; Q never asked; several pictures per letter — [games-alphabet.md](.claude/rules/games-alphabet.md) |
| Alfabet | Hukommelse (`/learning/memory/letters`) | `memory.letters` | quiz (pairs) | tap | Memory card flip; level owns board 6/10/15 pairs; endless boards dealt from a full-pool bag; flip/match SFX; streak beat every 3rd consecutive match — [games-memory.md](.claude/rules/games-memory.md) |
| Matematik | Lær Tal (`/math/numbers`) | — (EXEMPT browse) | browse | tap | 10-column number chart (1–100, 60 at Let); tap speaks number; "Hør tallene" pill counts aloud, no XP — [games-math.md](.claude/rules/games-math.md) |
| Matematik | Tal Quiz (`/math/counting`) | `math.counting` | quiz | tap only | Listen-only: spoken "Find tallet N" + Hør igen; focal zone is `ListenHero` (speaker + equalizer); tap the numeral among near-number/digit-swap distractors. Shows NOTHING of the answer — [games-math.md](.claude/rules/games-math.md); [src/components/math/MathGame.tsx:3-46](src/components/math/MathGame.tsx) |
| Matematik | Plus Opgaver (`/math/addition`) | `math.addition` (dynamic) | quiz | tap + drag (tile → `?`) | Number sentence `a + b = ?` on a clay tile; `?`→answer POP; speaks completed fact ("tre plus fire er syv"); `a+?=c` mixed shapes at Normal/Svær — [games-math.md](.claude/rules/games-math.md), [drag-and-drop.md](.claude/rules/drag-and-drop.md) |
| Matematik | Minus Opgaver (`/math/subtraction`) | `math.subtraction` (dynamic) | quiz | tap + drag | Same as Plus; never borrows below Svær — [games-math.md](.claude/rules/games-math.md) |
| Matematik | Sammenlign Tal (`/math/comparison`) | `math.comparison` | quiz | tap only | `2 [?] 8` number sentence; tap the bigger numeral (Svær: "mindste"); resolves to `<`/`>` symbol; numerals only (crocodile deleted 2026-08-03) — [games-math.md](.claude/rules/games-math.md) |
| Matematik | Hvad Mangler? (`/math/patterns`) | `math.patterns` | quiz | tap + drag (tile → `?`) | Number sequence with a gap; reads the finished sequence on correct; backwards at Normal/Svær — [games-math.md](.claude/rules/games-math.md) |
| Matematik | Hukommelse (`/learning/memory/numbers`) | `memory.numbers` | quiz (pairs) | tap | Number memory pairs; range 10/20/30 by level — [games-memory.md](.claude/rules/games-memory.md) |
| Farver | Lær Farver (`/farver/laer`) | — (EXEMPT browse) | browse | tap | Colour chips with example objects; tap to hear — [games-farver.md](.claude/rules/games-farver.md) |
| Farver | Farvejagt (`/farver/jagt`) | `colors.farvejagt` | quiz (hunt) | drag + tap | Objects scattered in world; drag (or tap) every object of the target colour into the target circle; correct drop snaps into ring + "{objektet} er {farve}"; a "task" = a board (round constant 5) — [games-farver.md](.claude/rules/games-farver.md), [src/config/promptPools.ts:45](src/config/promptPools.ts) |
| Farver | Hvilken Farve? (`/farver/quiz`) | `colors.quiz` | quiz | drag + tap (tap the swatch) | One DESATURATED object; drag it onto the right colour swatch; colour returns on the copy that lands (the reveal is the lesson) — [games-farver.md](.claude/rules/games-farver.md) |
| Farver | Ram Farven (`/farver/ram-farven`) | `colors.ramfarven` | quiz (mixing) | drag + tap | Goal colour ("Mål") + pot ("Din blanding") + droplet tray; drag 2 droplets into pot; correct → recipe reveal + "rød og blå bliver lilla"; a wrong mix that makes a real colour is NAMED; `Tøm` empties; reverse task 1-in-3 at Normal/Svær — [games-farver.md](.claude/rules/games-farver.md) |
| Farver | Nuancer (`/farver/nuancer`) | `colors.nuancer` | quiz (ordering) | drag + tap (fills leftmost empty slot) | Drag 3 shades into slots light→dark — [games-farver.md](.claude/rules/games-farver.md) |
| Engelsk | Lyt og Find (`/english/listen`) | `english.listen` | quiz | tap only | en-US Ava speaks an English word; `ListenHero` equalizer synced to real `audio.isPlaying`; tap the matching baked picture; random distractors, mixed themes — [games-english.md](.claude/rules/games-english.md) |
| Engelsk | Find det Engelske Ord (`/english/word`) | `english.word` | quiz | tap only | Baked picture shown; tap the English word (text tiles) — [games-english.md](.claude/rules/games-english.md); screenshot `docs/ui-reference/ipad/english-word.jpg` |
| Engelsk | Lær Engelsk (`/english/learn`) | — (EXEMPT browse) | browse | tap | Icon-forward word chips; tap speaks English; Danish gloss displayed, never spoken — [games-english.md](.claude/rules/games-english.md) |
| Ordleg | Læs Ordet (`/ordleg/read`) | `ordleg.read` | quiz | tap only | Plain uppercase word shown, NEVER auto-read (silent decoding is the exercise); tap the matching picture (3/4/6 options by level); correct tap speaks the picture's name; after 2 wrong the right picture pulses — [games-ordleg.md](.claude/rules/games-ordleg.md) |
| Ordleg | Stav Ordet (`/ordleg/spelling`) | `ordleg.spelling` | quiz | tap + drag (letter → word row) | Picture + word with gaps; place letter tiles; Let = one missing letter; after 2 wrong taps on a slot the right tile pulses — [games-ordleg.md](.claude/rules/games-ordleg.md) |

- Removed games (relevant history): `english.translate` "Dansk til Engelsk" removed 2026-08-03 at owner request; "Sig et Ord" speech-input game removed in full 2026-09-18 and the app now uses **no microphone or camera** (stated to parents in `src/config/legalContent.ts`) — [games-english.md](.claude/rules/games-english.md), [games-ordleg.md](.claude/rules/games-ordleg.md).
- Every quiz has a never-fail hint (`hintAfterNWrong: 2`), wrong answers are never punished (they only break the first-try flag) — [game-authoring.md:51](.claude/rules/game-authoring.md), [games-catalog.md:94-98](.claude/rules/games-catalog.md).
- Non-reward route surfaces: `/album` (Min Bog), `/privatliv`, `/support`, `/voicelab`; DEV-only `/dev/mascot`, `/dev/scene`, `/audit` — [src/App.tsx:319-333](src/App.tsx).

### Inferences
- 9 of 16 task games are "show/hear a prompt, tap one of N tiles" — the same interaction grammar with different content. The variety of verbs (drag, mix, order, hunt, flip) lives almost entirely in Farver + Memory.
- The 4 browses are near-identical "grid of things, tap to hear" surfaces.

### Gaps
- Did not open every component to confirm exact option counts per level; those live in `src/config/difficulty.ts`.

## 2. The current reward / progression system

### Takeaway
One deterministic track: every completed task adds XP live, a ring in the corner fills, and when it fills an in-game full-screen ceremony immediately hands over the next sticker from a fixed 90-slot, 10-chapter book (Min Bog). Chapter 1 pays ~one sticker per ~8 tasks; every later sticker costs ~3× that (~20–24 tasks).

### Cited Findings
- **Single source of truth**: `progressStore` (per-child localStorage key `bornelaering-progress:<profileId>`, schema v4, inert until `profileStore.attach()`); everything else derived in pure `src/config/progression.ts` — [rewards-and-progression.md:22-28](.claude/rules/rewards-and-progression.md).
- **Curve constants**: `REWARD_XP = 40` ("XP that equals one completed round"), `FAST_SLOTS = 9`, `CHAPTER_SIZE = 9`, `xpToNext(level) = level <= FAST_SLOTS ? 40 : 120` — "Exactly two tiers… There is deliberately NO third, slower tier" — [src/config/progression.ts:12-48](src/config/progression.ts).
- **Per-task XP**: `taskXp(tasksInRound, firstTry) = max(1, ceil(40 / tasksInRound)) + (firstTry ? 1 : 0)`; "NEVER difficulty-dependent" — [src/config/progression.ts:130-131](src/config/progression.ts). With `tasksInRound = 8` (most games) a task is 5 XP, 6 on first try.
- `tasksInRound` per game: 8 for Bogstav Quiz, English, Spelling, Nuancer, Hvilken Farve, Læs Ordet, all math, Ram Farven; Farvejagt 5 (a board = a task); Memory = `boardPairs` (6/10/15) — [src/config/promptPools.ts:37-45](src/config/promptPools.ts), [src/config/colorContent.ts:313](src/config/colorContent.ts), [src/config/ordlegWords.ts:36](src/config/ordlegWords.ts), component grep.
- **Browse XP**: `BROWSE_TASK_XP = 2` per NEW item, once ever (gated on persisted `markBrowsed`, not re-farmable) — [src/config/progression.ts:134](src/config/progression.ts), [rewards-and-progression.md:129-131](.claude/rules/rewards-and-progression.md).
- **Book size**: 10 chapters × 9 = `REWARD_SLOTS = 90` (pinned in `stickers.test.ts:47`); chapter titles Dyr, Køretøjer, Mad, Natur, Havet, Hjemmet, Leg og musik, Fugle og småkryb, Tøj, Vejr og årstider — [src/config/stickers.ts:58-221](src/config/stickers.ts). Whole book = 9×40 + 81×120 = **10080 XP** — [src/config/progression.test.ts:96-98](src/config/progression.test.ts).
- **Pacing claim** (from the curve's comment, written at 72 slots): "the ring moves ~38% per round instead of ~115%… the 72-slot book costs 7920 XP, ~172 rounds of ordinary play (~8 weeks at 3 rounds/day)" — [src/config/progression.ts:37-41](src/config/progression.ts). Endless play then made it "~20% slower and the owner accepted that" (round bonus XP deleted) — [rewards-and-progression.md:61-62](.claude/rules/rewards-and-progression.md).
- **Mapping**: `collectedFromLevel(level) = level - 1`; `rewardNumber()` = `grantedSlots` is the only child-facing number; never show `globalLevel()`; "The number is never a DISTANCE. No denominator, percentage or 'n to go'" — [rewards-and-progression.md:74-83](.claude/rules/rewards-and-progression.md).
- **Path is deterministic and append-only**: "The ORDER MUST NEVER BE SHUFFLED (no shuffle(), no random pick, anywhere)"; "The book ENDS at its last authored chapter" (old gold-duplicate pass deleted) — [rewards-and-progression.md:96-104](.claude/rules/rewards-and-progression.md).
- **The ring** (`RewardRing`, in game header + home + section menus): centre = the child's own book, a gauge arc with the count badge seated in a bottom gap; next-prize silhouette DELETED; crossing flash and chime DELETED; no "+N" flyer; "The ring fills, and that is all it does"; it is **the ONLY door to Min Bog**, and "In game the header holds the ring ALONE" — [rewards-and-progression.md:138-183](.claude/rules/rewards-and-progression.md).
- **The ceremony**: "Rewards are granted ONLY by the ceremony" (`progressStore.grantPendingRewards()` → app-root `RewardOverlay`); "ONE PICTURE ON A SOLID SCREEN": near-solid scrim, sticker at 230px, its Danish name, count folded into the frame corner; speaks exactly one prebaked line; `STICKER_MS = 3400`, tap armed after `TAP_ARM_MS = 700` — [rewards-and-progression.md:200-226](.claude/rules/rewards-and-progression.md), [src/components/common/RewardOverlay.tsx:63-73](src/components/common/RewardOverlay.tsx).
- **Fires at the seam**: `useTaskRun.thenContinue()` awaits the ceremony between "task completed" and "generate next question" with the advance lock held; Memory around `BOARD_TURNOVER_MS`; browses after an echo beat — [rewards-and-progression.md:47-51](.claude/rules/rewards-and-progression.md).
- **Chapter completion** = a SECOND beat: companion stage-up + headline (`celebrateTier('page')`); companion has `COMPANION_STAGES = 5` baked stages, grows one per chapter, "must never regress" — [rewards-and-progression.md:214-217](.claude/rules/rewards-and-progression.md), [src/config/progression.ts:21,101-102](src/config/progression.ts). `ProgressionCompanion` is rendered from `RewardOverlay`.
- **Min Bog** (`/album`, `StickerAlbum`): icon-only chapter chips, unreached chapters dimmed but tappable, exactly one glowing `next` silhouette, later slots blank plates — [rewards-and-progression.md:171-173](.claude/rules/rewards-and-progression.md).
- **In-game micro-feedback**: celebration tiers are now only `micro` (per correct, `correct` SFX), `streak` (every 3rd consecutive first-try, `streak-up`), `page` (chapter close), `levelup` (ceremony) — [src/components/common/CelebrationEffect.tsx:175-191](src/components/common/CelebrationEffect.tsx); streak check `r.streak % 3 === 0` in [UnifiedQuizGame.tsx:593](src/components/common/UnifiedQuizGame.tsx) and the Farver games.
- **Practice ledger** (not adaptivity): device-local per-child miss record reorders prompts inside the level's pool (a missed item re-asked a few draws later); never reads/writes a level — [games-catalog.md:28-38](.claude/rules/games-catalog.md).

### Inferences
- Sticker frequency, derived from the constants: chapter 1 → one sticker per ~7 first-try tasks (40/6) to 8 tasks; chapters 2–10 → ~20 first-try tasks (120/6) to 24 tasks per sticker. A Farvejagt board is worth 9 XP (ceil(40/5)+1), so ~5 boards early, ~14 boards later. A browse item is worth 2 XP, so ~20 new items early / 60 later.
- The entire extrinsic layer is therefore: per-answer sparkle + SFX, a 3-streak beat, a slowly-filling ring, one sticker every ~20 tasks, a companion growth step every 9 stickers. There is no in-game goal structure beyond "answer the next one" — every game is a flat endless stream.

### Gaps
- No measured data on real session lengths vs. sticker rate (see §5).

## 3. Mascot, mascotBus, scene/parallax world, ambient density, music, SFX

### Takeaway
A persistent multi-layer parallax world (4 skins) sits behind every page and is frozen/dimmed in games; a corner mascot reacts to 8 bus events; progress shows in the world only as ambient sprite density; music plays on menus only; SFX are a separate 10-cue Howler channel.

### Cited Findings
- World: `PersistentWorld` + `ThemeScene` + `AmbientField` + `ParallaxLayer`; route kinds `menu` (bright live world + idle mascot) vs `game` (dim/blur scrim, idle mascot hides); scene **freezes** on game routes and under reduced motion — [scene-and-world.md:18-26](.claude/rules/scene-and-world.md).
- Home has 5 tappable `SceneObject`s on one arc per skin — [scene-and-world.md:30-34](.claude/rules/scene-and-world.md).
- "Progress in the world is ambient DENSITY, and nothing else": `bloomFor(section)` → more drifting sprites; stage-gated scenery sprites were deleted 2026-08-03 (owner: "it looks misplaced"); "Don't re-add decor seated in the world unless its position DERIVES from the art" — [scene-and-world.md:48-61](.claude/rules/scene-and-world.md). Bloom thresholds `BLOOM_STAGE_XP = [0, 40, 120, 260, 480]` per section — [src/config/progression.ts:107-108](src/config/progression.ts).
- Skins: 4 registered themes — Regnbue, Havet, Rummet, Dinosaurer (default since 2026-10-04) — [theming.md](.claude/rules/theming.md).
- Mascot: rendered INSIDE each page (menus `ThemeMascot`, games GameShell's `Mascot`), reacts via `mascotBus`, deliberately decoupled from the world layer — [scene-and-world.md:65-70](.claude/rules/scene-and-world.md). Events: `welcome | idle | correct | wrong | streak | round | hint | sticker` — [src/services/mascotBus.ts:8-16](src/services/mascotBus.ts). Hand-rolled games must wire `tap` SFX + `streak` + `hint` by hand; `correct`/`wrong`/`welcome`/`round` come free — [game-development.md](.claude/rules/game-development.md) "Interaction-language parity".
- `useIdleAttract`: after ~8s idle on menus, mascot beckon + one card wiggle — [scene-and-world.md](.claude/rules/scene-and-world.md) "Menus & the transition wipe".
- Music: `musicClient` (HTML5 Audio) per-world bed on menu surfaces only (home, 5 section menus, `/album`), fades out entering a game; level baked into MP3s (iOS ignores `<audio>.volume`) — [scene-and-world.md:72-90](.claude/rules/scene-and-world.md).
- SFX: `sfx` (`src/services/sfxClient.ts`, Howler) separate short channel, never through `SimplifiedAudioController`; MP3 only. Shipped cues: `correct, drop-snap, flip, page-complete, round-complete, star, sticker-reveal, streak-up, tap, wrong` — [audio-system.md:94-105](.claude/rules/audio-system.md), `ls public/sounds/ui/`.
- Narration: Azure da-DK Christel / en-US Ava, prebaked to `public/sounds/tts/`; one audio at a time, no queue — [CLAUDE.md](CLAUDE.md).

### Inferences
- The world is decorative and frozen during play, so it currently contributes nothing to in-game gamification; the mascot's in-game role is a corner reaction.
- `round-complete.mp3` and `star.mp3` still ship though their celebration tiers were pruned (CelebrationEffect comment says their cues "went with them") — possible leftover; unverified.

### Gaps
- Did not inspect the mascot's pose set or per-skin mascot art in detail.

## 4. Hard design decisions/constraints a new game must respect

### Takeaway
A remake must be endless, non-adaptive, pay into the one existing track only via live per-task XP + the shared ceremony, accept tap and drag, ship no emoji, prebake every line, run on Safari 17, animate idle motion in CSS, use theme tokens and the transition nav. Many "obvious" gamification devices (stars, bests, round ends, streak counters, shops, random rewards, numbers as magnitudes) are explicitly banned by recorded decisions.

### Cited Findings
- **Endless**: "both game types are ENDLESS (Endless Play PRD-01) — no boundary the child can perceive, no 'Færdig!', no stars, no bests, no replay" — [games-catalog.md:94-98](.claude/rules/games-catalog.md). "What is gone, permanently: `RoundResultScreen` (no round-end surface of any kind, in any form, including a 'small card'), stars and star thresholds, personal bests and 'Ny rekord!', the round-end bonus XP… never reintroduce a round bonus" — [rewards-and-progression.md:42-62](.claude/rules/rewards-and-progression.md).
- **No stopping cue — a decision**: "Endless play removes it; the ceremony is now the only pause. Recorded so a future audit finds the choice, not the gap" — [rewards-and-progression.md:65-68](.claude/rules/rewards-and-progression.md).
- **No adaptivity**: "Difficulty (static, manual — no adaptivity by design)… A harder level must never cost rewards" — [CLAUDE.md](CLAUDE.md) Key Architecture; "XP never depends on difficulty" — same; "a dead level is a bug" enforced by `difficulty.test.ts` — [games-catalog.md:19-26](.claude/rules/games-catalog.md).
- **One track / one reward slot**: "Rewards are granted only by the ceremony; the ring is the only door to Min Bog and its centre is the child's book" — [CLAUDE.md](CLAUDE.md); "What must never come back is a SECOND entrance on one screen" — [rewards-and-progression.md:178-180](.claude/rules/rewards-and-progression.md). XP enters at three choke points only: `useTaskRun.completeTask`, `UnifiedMemoryGame` match branch, `useBrowseXp` — [rewards-and-progression.md:128-131](.claude/rules/rewards-and-progression.md).
- **Header holds the ring alone, nothing that measures performance** (ScoreChip pip row deleted) — [rewards-and-progression.md:180-183](.claude/rules/rewards-and-progression.md).
- **Tap + drag parity**: "A game that accepts one gesture must accept both — a 5-year-old taps — through one resolve function, and collision is `kidCollision`, never `closestCenter`" — [CLAUDE.md](CLAUDE.md); "A drag target must already exist in the prompt… a drop zone there would be invented furniture"; single `DRAG_ACTIVATION_DISTANCE` threshold — [drag-and-drop.md:12-48](.claude/rules/drag-and-drop.md).
- **A board must not restate its own answer** and "confining a giveaway to Let is not removing it" — [games-catalog.md:40-57](.claude/rules/games-catalog.md).
- **Prompt draw**: `usePromptBag` over a pool in `src/config/promptPools.ts`; "Never `Math.random()` over a content pool" (guarded by `promptDraw.test.ts`); pool ≥ the game's round constant — [game-authoring.md:99-110](.claude/rules/game-authoring.md), [games-catalog.md:61-75](.claude/rules/games-catalog.md).
- **No emoji**: "No emoji ships in the UI — baked art on child-facing surfaces, `lucide-react` on adult/dev ones… `src/config/noEmoji.test.ts` enforces it and its allowlist is empty" — [CLAUDE.md](CLAUDE.md) Conventions. Reward art has no glyph fallback; new reward subjects must pass the silhouette test — [rewards-and-progression.md:228-232](.claude/rules/rewards-and-progression.md).
- **Prebaked TTS, 8-step protocol**: "Every line the app speaks is prebaked"; steps: (1) build string in `src/config/` (`letterWords.ts` / `gamePhrases.ts`), (2) export range bounds, (3) enumerate in `shared-narration-clips.js` via the same builder, (4) test pinning the exact string, (5) `npm run tts:prebake` + commit, (6) `npm run audit:check` / sign-off, (7) only unbounded text stays live (`warmSpeech`), (8) "Never `await` narration to pace anything" — [audio-system.md:68-92](.claude/rules/audio-system.md). Also "one audio at a time — new audio cancels current, no queue" — [CLAUDE.md](CLAUDE.md).
- **Audio format**: "All shipped audio is MP3, never Ogg/Opus" (Ogg silenced the iPadOS 17.7 device) — [audio-system.md:98-105](.claude/rules/audio-system.md).
- **Safari 17 floor**: "The child plays on an iPad Pro 2nd gen (A10X, 2017) on iPadOS 17.7.11, its terminal OS. Check any new web/media API against Safari 17" — [pwa-and-device.md:140-144](.claude/rules/pwa-and-device.md). "`content-visibility` is Safari 18 → banned" — [CLAUDE.md](CLAUDE.md).
- **CSS keyframes for idle motion**: "A continuous, stateless animation is a CSS keyframe animation. Never a JS loop" — vocabulary in `src/theme/idleMotion.ts` (`idleFloat`/`idlePulse`/`hintPulse`/`idleGlow`/`equalizerBar`/`idleWobble`); `idleMotionBudget.test.ts` fails the build on a new framer `repeat: Infinity` — [animation-and-performance.md:27-40](.claude/rules/animation-and-performance.md). Origin: 25 framer loops "spent ~40% of every second recalculating style while the app sat still" — [CLAUDE.md](CLAUDE.md).
- **Theming tokens**: "No styling values are hardcoded in components"; `getCategoryTheme(id)` never `categoryThemes[id]`; accent text on white uses `theme.onTileColor`; educational colours are data, not themeable — [theming.md](.claude/rules/theming.md).
- **Transition nav**: "navigation always flows through the transition system — no raw `navigate()` from inside a game"; `useTransitionNav()` → opaque wipe overlay — [scene-and-world.md](.claude/rules/scene-and-world.md) "Menus & the transition wipe".
- **Layout**: full-viewport, no-scroll; "reserve the space rather than tuning a percentage" — [CLAUDE.md](CLAUDE.md).
- **Interaction hygiene**: synchronous `sfx.play('tap')` at the top of every tap handler; advance-lock ref set before any await; never await narration in a tap handler, advance on a fixed dwell (`DWELL_FACT`/`DWELL_CORRECT`) — [game-development.md](.claude/rules/game-development.md).
- **No network-offline features, no service worker**; app ships bundled in a Capacitor iOS shell — [CLAUDE.md](CLAUDE.md), [docs/usage-analytics.md §1.2](docs/usage-analytics.md).
- **No mic / camera**: `capacitorConfig.test.ts` fails if a purpose string or `getUserMedia` comes back — [games-ordleg.md](.claude/rules/games-ordleg.md).
- **Kids Category / store promises**: "No analytics", "Ingen køb inde i appen" (no in-app purchases) stated in listing, policy and an App Review answer — [docs/usage-analytics.md §1.1](docs/usage-analytics.md); commit `ddf7b1c`.
- **Evidence-review DO NOT DO list** (adopted design input): no streaks/daily goals/login rewards; nothing that can be lost, decay or regress (incl. a sad/hungry companion); no timers/urgency; no random/variable-ratio rewards, loot/mystery boxes, spin-wheels; no leaderboards; no shop or spendable currency; no number to be read as magnitude; no reward flashed at the moment of disengagement; no parasocial pressure from the mascot; no push notifications to bring the child back — [plans/reward-horizon/research-progression-evidence-2026-08-02.md:785-830](plans/reward-horizon/research-progression-evidence-2026-08-02.md).

### Inferences
- "Gamifying" an existing game therefore has to live mostly *inside the game's own board and verbs* (richer mechanics, world-embedded feedback, mascot involvement, content variety) rather than in new meta-layers, since nearly every common meta-layer (stars, streak counters, currencies, leaderboards, levels, timers, random drops) is either deleted or on the DO-NOT list.
- Note the opt-in weekly reminders (local notifications, parent-addressed, max 3) shipped 2026-10-09 despite item 10 of the DO-NOT list — they are addressed to the parent, not the child (memory note + commit `e356f3b`). A report should not claim push to the child exists.

### Gaps
- Did not verify which of the "affirmative" regulatory items (pause/save, adult visibility) are implemented beyond the `pagehide` flush.

## 5. Existing PRDs/docs on rewards/gamification/endless play — and WHY stars/bests/rounds were removed

### Takeaway
The reward system went through five PRD generations (Liveliness → Reward Book → Reward Horizon → Reward Pacing → Endless Play), each simplifying: from per-game stars/bests/result screens to one deterministic book with one in-game ceremony. Stars/bests/rounds were removed because the same event was announced three times and only the sticker meant anything to a 5-year-old, with the payoff arriving 30–90s after the answer that earned it.

### Cited Findings
- PRD inventory: `plans/liveliness-overhaul/` (PRD-00…18, incl. 01 progression foundation, 04 live XP), `plans/reward-book/tmp-prd-reward-book-01-unified-reward-book.md`, `plans/reward-horizon/tmp-prd-reward-horizon-01-one-number-one-book.md` + `research-progression-evidence-2026-08-02.md`, `plans/reward-pacing/tmp-prd-reward-pacing-01-slower-book-focused-ceremony.md`, `plans/endless-play/tmp-prd-endless-play-01-no-round-end.md`, `plans/practice-loop/tmp-prd-practice-loop-01-what-comes-next.md`, `plans/game-depth/tmp-prd-game-depth-01-variation.md`, `plans/re-engagement/tmp-prd-re-engagement-01-weekly-reminders.md` — directory listing.
- Git trail: `2c60e0c` "PRD-04: live cross-game XP progression + stickers-as-level-up-trophies"; `746d889` "unified Reward Book — one track… 45 rewards in 5 chapters"; `4d283e1` "reward horizon: one number, one book, one ring, one door"; `4b47b46` "a sticker costs ~3 rounds, chapter 1 stays fast"; `27fb94f` "the ceremony is one picture on a solid screen"; `e35b582` "docs(prd): stop announcing the same sticker three times"; `a4af460` "feat(play): delete the round, and pay the sticker where it was earned"; `9b0a24e` chapter 10 → 90 slots — `git log --oneline`.
- **Why rounds/stars/bests went** (Endless Play PRD §1): "The same event is announced three times": (1) the ring flashing the won prize, (2) `RoundResultScreen` — "Færdig!", three stars, "Ny rekord!", a reward meter showing the same prize, (3) the sticker itself "roughly 3–4 seconds after the round ended, and 30–90 seconds after the answer that actually earned it. For a five-year-old only (3) means anything. (1) is a promise he cannot cash, (2) is an adult's summary of a round he was not counting" — [plans/endless-play/tmp-prd-endless-play-01-no-round-end.md:16-33](plans/endless-play/tmp-prd-endless-play-01-no-round-end.md). Owner quote: "the progress in the upper right circle can just continue on another round … and the game itself can also show the celebration … and the sticker won also just pops up individually."
- Further benefits claimed (§1.2): payoff and earning answer become "the same moment, which is the whole point of a token economy at this age"; deleted the only non-prebaked composed TTS line ("Godt klaret! Du fik N stjerne(r)"); deleted the only in-game raw `navigate()` — same file:62-74.
- The rule file records the reversal explicitly: "The two-beat is an adult's sense of pacing" — "one quiet promise, one loud payoff" / "It looks like clutter and is not" **overruled** — [rewards-and-progression.md:30-40](.claude/rules/rewards-and-progression.md).
- Silhouette preview in the ring deleted: "the last survivor of the promise/payoff two-beat… 25px of art at 30% opacity under brightness(0) is not identifiable as an object anyway" — [rewards-and-progression.md:143-146](.claude/rules/rewards-and-progression.md).
- Ceremony stripped: banner and 3×3 chapter dot grid deleted — "two texts around one picture is the clutter; nine dots answer a question a 5-year-old can't read" — [rewards-and-progression.md:208-213](.claude/rules/rewards-and-progression.md).
- Pacing rationale: "dense-then-thin is the recommended shape for a token system (establish on continuous reinforcement, then thin)"; ring was "~115% [per round] — a spinner that reset, not a progress meter" — [rewards-and-progression.md:108-113](.claude/rules/rewards-and-progression.md).
- Evidence-review headline: uncapped level number rejected (children can't read large numbers as magnitude; goal-gradient needs a visible finite target; "long-term lure" is regulator vocabulary); best uncapped mechanics ranked: growing world (bloom) and new finite chapters BEST, companion growth GOOD "with a hard rule: never decay", adult-facing mastery meters GOOD, gold duplicates WEAK, seasonal collections AVOID, infinite level AVOID; "single highest-leverage change… making the collectible out of the curriculum rather than decorative (reward-proximity effect)" and process-praise wording — [research-progression-evidence-2026-08-02.md:10-24, 665-677](plans/reward-horizon/research-progression-evidence-2026-08-02.md).
- Randomness verdict: "keep the path deterministic" (Shen, Fishbach & Hsee 2015: randomness buys effort by making the pursuit the entertainment) — same file:611-651.
- Same research doc named `RoundResultScreen` as the app's "natural break" under ICO guidance; endless play removed it knowingly — [rewards-and-progression.md:65-68](.claude/rules/rewards-and-progression.md).
- Practice-loop PRD (2026-08-04) motivation: prompts drawn with replacement repeated items (Bogstav Quiz P(repeat in 8) ≈ 66%); "nothing records what he gets wrong" — led to `usePromptBag` and the practice ledger — [plans/practice-loop/tmp-prd-practice-loop-01-what-comes-next.md:12-30](plans/practice-loop/tmp-prd-practice-loop-01-what-comes-next.md).

### Inferences
- The trajectory is consistently subtractive: each gamification element was judged by "does a 5-year-old perceive and value it?" and most failed. A remake proposal that adds meta-layers will run against this recorded history; one that enriches play itself, or ties collectibles to curriculum, aligns with it.
- The research doc's "collectible out of the curriculum" recommendation appears not to be implemented — sticker chapters are generic themes (Dyr, Mad, Tøj…) unrelated to letters/numbers/colours.

### Gaps
- Did not read the full Reward Book / Horizon / Pacing PRDs; only the rule file's distillation and the Endless Play PRD intro.

## 6. Engagement signals / analytics

### Takeaway
There is an anonymous, aggregate-only, first-party usage counter (day × event × version × count) that records app opens, per-route screen entries for every game, a session-depth ladder, stickers earned and adult-door funnel steps. The data lives in the production Neon DB, not the repo; the only numbers recorded in the repo are tiny (≈7 opens/day total) and the owner's own children stopped playing at v1.0. No per-game popularity numbers are written down anywhere in the repo.

### Cited Findings
- `docs/usage-analytics.md` (research, 2026-09-18) recommended option B "First-party, anonymous, aggregate-only counters"; the table has four columns — "day, event, version, count — and no column an identifier could go in" — [api/usage.ts:9-13](api/usage.ts), [docs/usage-analytics.md:353](docs/usage-analytics.md). Implemented in commits `c3fe3ce` "count app opens and screen entries anonymously", `6f6e3ac`, `880f752`, `17e5d5c`, `eddb494`.
- Closed event set: `app_open`; `session:1min/5min/15min` (active time; "The ratio of session:1min to app_open is a bounce rate"); `reward:sticker` (counted at the ceremony); `adult:*` funnel; `notify:*` reminder funnel; and `ROUTE_EVENTS` mapping every game route to e.g. `route:farver_ram_farven`, `route:memory_letters` — [src/config/usageEvents.ts](src/config/usageEvents.ts).
- So route-entry counts per game **are** collected, which would answer "which games are played most" (entries, not time-in-game) — inference from the event list.
- Recorded numbers: "Production usage_counter: 107 app_open in 19 days, ~7 a day, the owner's son included. That is the whole user base" — commit `ddf7b1c` (2026-10-09). "route:album is climbing hard (3 -> 22 in a week)… that is children LOOKING at the book" and "the owner has confirmed his own children stopped playing at v1.0 and every event in the table is a real user" — commit `17e5d5c` (2026-10-04). "7 people installed the app from the App Store in a week" — [docs/usage-analytics.md:3](docs/usage-analytics.md).
- Session ladder and sticker events only exist from 2026-10-04 (v1.2 timeframe), so little history.
- Constraints on adding analytics: Kids Category Guideline 1.3; app publicly promises "Ingen sporing og ingen analyseværktøjer"; adding any persistent identifier moves it into consent territory — [docs/usage-analytics.md §1.1, §2.4](docs/usage-analytics.md).

### Inferences
- The owner's child stopping play at v1.0 is the strongest qualitative engagement signal in the repo and is arguably the motivating fact for a gamified remake.
- Retention/cohort questions are structurally unanswerable without breaking the anonymity design.

### Gaps
- **No per-game usage figures exist in the repo**; they would have to be queried from the production `usage_counter` table (not done — out of scope, and the DB is shared). Unknown which games are most/least entered.
- No time-in-game per game is measured.

## 7. Weakest vs richest games

### Takeaway
Weakest (most "plain text quiz"): **Find det Engelske Ord**, **Tal Quiz**, and **Læs Ordet / Lyt og Find / Sammenlign Tal** as runners-up — one prompt, 3–6 static tiles, tap, next. Richest: **Ram Farven** (mixing with discovery), **Farvejagt** (hunting/sorting in the world), **Hukommelse** (flip/match), then Nuancer and Stav Ordet.

### Cited Findings
- Find det Engelske Ord: picture → four plain text-word tiles ("bread / bird / pig / ten"); "Distractors random, themes mixed… a deliberate beginner floor"; tap-only — [games-english.md](.claude/rules/games-english.md); screenshot `docs/ui-reference/ipad/english-word.jpg`.
- Tal Quiz: "LISTEN-then-recognise, and shows NOTHING of the answer" — focal zone is a speaker+equalizer, then four numeral tiles; tap-only; the old objects row was removed as a giveaway — [games-math.md](.claude/rules/games-math.md). (The ui-reference screenshot still shows 4 toy cars — stale.)
- Sammenlign Tal: two numerals only, piles and crocodile both removed ("what does it reflect"); "don't let tile SIZE encode the values" — [games-math.md](.claude/rules/games-math.md).
- Læs Ordet: plain uniform uppercase word, no emphasis, picture tiles; "the only help this game gives is the picture-tap hint" — [games-ordleg.md](.claude/rules/games-ordleg.md).
- Lyt og Find: audio → picture tiles, ListenHero — [games-english.md](.claude/rules/games-english.md).
- Tap-only games listed by rule: "Sammenlign Tal, Tal Quiz, Bogstav Quiz, Læs Ordet and the English quizzes stay tap-only: they ask a question rather than show a gap" — [drag-and-drop.md:38-42](.claude/rules/drag-and-drop.md).
- Ram Farven: drag 2 droplets into a pot, recipe reveal, wrong-but-real mixes are named ("the spare tints are what the child stumbles into and hears named"), reverse task, `Tøm` — [games-farver.md](.claude/rules/games-farver.md); screenshot `farver-ram-farven.jpg` shows Mål circle → pot → 5 droplets.
- Farvejagt: objects-in-world scatter, drag into a target circle, snap into ring + spoken sentence, "filling well" — [games-farver.md](.claude/rules/games-farver.md), memory note PRD-16.
- Memory: flip/match, endless boards, streak beat, juice — [games-memory.md](.claude/rules/games-memory.md).

### Inferences
- The weak games are weak because of deliberate *removals* (giveaway rule, crocodile, counting aids), not neglect — the "board must not restate its answer" rule stripped their visuals. A remake must add richness that doesn't leak the answer (e.g. a narrative/world consequence of the answer, not a visual of it).
- Several of the weakest games test the same skill as a richer sibling via a duller verb (e.g. letter/number recognition as tile-tap), so they are the best remake candidates: Tal Quiz, Find det Engelske Ord, Sammenlign Tal, Bogstav Quiz, Læs Ordet.
- The four browses are also thin but are deliberately calm and ungraded (EXEMPT), so remaking them is a different question.

### Gaps
- This judgment is from code/rules and 4 viewed screenshots (2 of which are stale), not play-testing or usage data.

## 8. Shared building blocks a new game can reuse

### Takeaway
A remake has a substantial kit: a config-driven quiz engine, a memory engine, endless-run and reward hooks, dnd primitives with tap parity, board-surface components, a prompt bag, a hint hook, celebration tiers, mascot bus, SFX, CSS idle motion, and pure, test-sampled content generators.

### Cited Findings
- `UnifiedQuizGame` (config: `generateQuizItem`, `generateOptions`, `gameId`, `tasksInRound`, `hintAfterNWrong`, `renderHero`, opt-in `dragToPromptSlot`) — [game-authoring.md:19-77](.claude/rules/game-authoring.md); `UnifiedMemoryGame` + `MemoryGame` config factory — [games-memory.md](.claude/rules/games-memory.md).
- `useTaskRun` (live XP + ceremony at the seam via `thenContinue()`), `useBrowseXp`, `useRewardCeremony` — [rewards-and-progression.md:47-51](.claude/rules/rewards-and-progression.md).
- dnd primitives in `src/components/common/dnd/`: `kidCollision`, `useDragOnlySensors`, `DroppableZone`, `DraggableItem` (`inline`/`fill`, absolute scatter default), `useDragActive`, `useTapActivate`, `DRAG_ACTIVATION_DISTANCE` — [drag-and-drop.md:44-56](.claude/rules/drag-and-drop.md).
- Board surfaces: `TactileTile` (`compact`, `field`), `PromptFocus` (in GameShell's `promptStage` slot), `TactilePill`, `AnswerTile`, `RepeatButton` variants, `ListenHero`, `SymbolTile` (baked `+ − = ? > <`), `depth.ts` shadows — [game-authoring.md:114-139](.claude/rules/game-authoring.md), [games-math.md](.claude/rules/games-math.md).
- `usePromptBag` + `promptPools.ts`, `boardBag.ts`, `makeTargetBag`, `shuffle()`; `useNeverFailHint`; `hintLines.ts` per gameId — [game-authoring.md:95-112](.claude/rules/game-authoring.md).
- Juice: `celebrateTier('micro'|'streak'|'page'|'levelup')` — [CelebrationEffect.tsx:175-191](src/components/common/CelebrationEffect.tsx); `sfx` cues (tap, correct, wrong, drop-snap, flip, streak-up, page-complete, sticker-reveal…); `mascotBus` events; `src/theme/idleMotion.ts` keyframe helpers; `src/theme/motion.ts` (`DWELL_FACT`, `DWELL_CORRECT`, `EXIT_FAST`, `POP`).
- Navigation/world: `useTransitionNav()`, `GameShell`, `BackButton`, `LivingCard`, `ThemedBurst`, `useIdleAttract`, `PersistentWorld`/`bloomFor` — [scene-and-world.md](.claude/rules/scene-and-world.md).
- Pure content/generators: `src/config/mathProblems.ts` (`makeAdditionProblem`, `makeSubtractionProblem`, `makeComparisonPair`, `makeSequenceQuestion`, `pickQuizNumber`, `numberDistractors`, `farMinGap`), `src/config/difficulty.ts` (per-level tables, `MEMORY_BOARD`, `COLORS_RAMFARVEN`), `colorMixing.ts`, `colorContent.ts` (`DANISH_OBJECTS`, `SHADE_RAMPS`, `spokenColor`), `letterWords.ts` (`LETTER_WORDS`, `LETTER_QUIZ_WORDS`), `ordlegWords.ts` (`makeMissingLetterTask`), `gamePhrases.ts`, `practiceWeights.ts` — [games-math.md](.claude/rules/games-math.md), [games-farver.md](.claude/rules/games-farver.md), [games-alphabet.md](.claude/rules/games-alphabet.md), [games-ordleg.md](.claude/rules/games-ordleg.md), [audio-system.md:74-77](.claude/rules/audio-system.md).
- Baked art pipeline: `src/assets/games/<section>/index.ts` glob manifests keyed by content id (letters, words, counting objects, 24+ colour objects, English pictures) — [game-authoring.md:140-147](.claude/rules/game-authoring.md); reward art via `rewardArt(id)`.
- Dev drivers: `?rewards=<n>` book seed, `?nogate=1` — [rewards-and-progression.md:234-235](.claude/rules/rewards-and-progression.md), `docs/ui-reference/README.md`.

### Inferences
- A remake of a weak quiz can likely keep its generator, pool, XP wiring and hint, and replace only the board (verb + hero), which keeps reward, prebake and difficulty invariants intact.
- Any new spoken line still needs the full prebake protocol, and any new depicted subject needs new keyed WebP art — these are the main cost drivers, not code.

### Gaps
- Did not verify whether `GameShell` supports a full-bleed, scene-unfrozen "world" board (the scene freezes on game routes), which a world-embedded remake would need.
