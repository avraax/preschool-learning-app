# PRD — Fyld Båden: one game built to the highest bar

Status: authored 2026-10-13, **NOT implemented**. Owner decision session; every question in §2 was
answered by the owner before this was written.

Supersedes nothing. **Tal Quiz (`math.counting`, `MathGame.tsx`) is NOT touched** — Fyld Båden ships as
a **new, separate tile next to it** in Tal og Regning, and is meant to replace it *later*, by a separate
owner decision that is out of scope here (§8). Adds one owner-approved exception to `games-math.md`'s
"no countable layer" rule (§2.1). Research basis: `docs/research/reports/Gamification for preschool
learning.md` (section "Remake Tal Quiz as Fyld Båden") and its notes folder.

---

## 1. Why

**The app's games are flat, and that — not the reward layer — is why play stops.** The research
(2026-10-13, five tracks, committed 279ca0f) found:

- 9 of the 16 task games are one grammar: *hear/see a prompt, tap one of 3–6 tiles*. The variety of verbs
  lives almost entirely in Farver and Memory. The owner's own children stopped playing at v1.0 — a
  version with *more* reward machinery (stars, bests, round screens) than today. Rewards did not hold
  them; the core loop did not either.
- The evidence says the safe, effective levers are **game-first design** (the learning act *is* the game
  action — DragonBox Numbers' "Nooms", Fiete Math's load-the-ship, Montessori ten-bars), **informational
  feedback** (verbal feedback raises interest, d ≈ +0.33; expected tangible rewards lower it), and
  **delight after the answer, never during it** (seductive details cost learning, g ≈ −0.33).
- Danish has a learning problem other languages don't: **inverted number words from 21**
  ("syvogtredive" = seven-and-thirty) and the vigesimal tens (halvtreds, tres, halvfjerds…). Tal Quiz
  tests this by *recognition* (tap the numeral). Building the quantity from tens and ones tests whether
  the child knows what the word *means* — the inversion maps straight onto place value. The owner's son
  counts to 60–70: exactly this frontier.
- A game-first Danish number game for this age is an **open gap** in the market (no Danish Poio /
  GraphoGame / DragonBox; Danish apps are mostly hear-and-tap drills).

**The owner's bar, verbatim (2026-10-13):** *"the worst thing we can end up with is a badly looking or
poorly gameplay game. The main focus is moving this app forward with optimized and fun educational
games"* and *"I sure dont want this to look or sound too cheap. Main focus here is to nudge it up in
quality compared to other games."* **This game is the quality benchmark for the app.** No stage is done
because it works; it is done when it looks and feels better than every other game on the iPad. Learning
remains the first test of every choice (memory: education first).

## 2. Decisions — dated 2026-10-13, do not re-litigate

### 2.1 Game and learning
1. **Name: "Fyld Båden".** Tile title = GameShell title = welcome title (they must match).
2. **Crates on the board are fine.** The owner explicitly accepted that this is not the countable layer
   `games-math.md` bans: the number is *never visible* before a correct send, and the crates are the
   child's *answer*, not a counting aid beside a shown numeral. Record this as a named exception (§4.1).
3. **Core loop:** a boat arrives → narrator says **"Fyld båden med {tal}"** → the child loads **pallets
   of ten** and **single crates** onto the deck → taps the **horn** → correct: the numeral is painted on
   the sail, narrator says **the bare number again** (nothing more), boat sails out, next boat chugs in.
4. **Regrouping is automatic:** the 10th single crate makes all ten **merge into one pallet** (the
   "pallet bundling show", §2.3). This is the place-value moment — *ti enere er én tier* — and is the
   star of the game.
5. **Silent landing.** The narrator never counts crates as they land; a thud SFX only.
6. **Wrong send:** the boat bobs back, the narrator **names what is actually loaded** (bare number clip,
   e.g. "treoghalvfjerds"), then **re-asks the target** ("Fyld båden med syvogtredive") after a fixed
   beat. The mistake becomes a second fact. A wrong send only breaks first-try.
7. **Hint after 2 wrong sends:** **ghost outlines** of exactly the target load appear in the deck slots;
   the child fills them. Never-fail, still hands-on.
8. **Unload:** tap (or drag back) a loaded **pallet → it returns whole**; a crate → it returns. No
   un-bundling.
9. **Ranges = Tal Quiz's, leaning to the inverted numbers:** Let 1–20 · Normal 1–50 · Svær 1–100;
   on Normal and Svær **3 of 4 boats draw from 21+** (the rest from the full range). Static; no
   adaptivity (house rule).

### 2.2 Look and sound
10. **Art: Gemini, same soft-3D clay style as every other game — with a raised bar:** far more assets,
    built in layers for animation (§ art doc). No commissioned art now.
11. **Own full-bleed harbour background** — the first game in the app to paint its own scene instead of
    the blurred world. **One harbour for all skins** (only section accent tokens follow the skin).
12. **Layout A: quay left, boat right** (iPad landscape). The child loads land → boat, left to right;
    the boat sails out right, the next enters from the left behind the quay. Mascot on the quay.
13. **A few boat types rotate** (fiskerbåd, færge, slæbebåd, fragtskib) — pure visual variety, nothing to
    collect, nothing accumulates in the harbour.
14. **The character is the app mascot, as in every game.** No new captain.
15. **Sound: curated free SFX (CC0 / Sonniss GDC) + a harbour ambience loop** (waves, distant gulls).
    **Ambience replaces music in this game.**
16. **Delight moments (after the answer only):** a **rich send-off** (horn, wake splash, flag flutter,
    boat sails out, gulls lift off the quay, next boat chugs in) and the **pallet bundling show** (rope
    lift / clunk / puff). **Not chosen:** a streak flourish beyond the app's standard streak burst, and
    tappable harbour toys.

### 2.3 Process
17. **Budget: 0 DKK now.** Build the full free version to the highest bar; spend only where the
    play-test shows something looks cheap (candidates: Rive animator, sound designer, commissioned art).
18. **Two owner sign-offs:** (a) an **art contact sheet** of every generated asset, approved before any
    code wires it; (b) a **vertical slice on the owner's iPad** — one boat, full art/motion/sound/loop —
    approved before the rest is built.
19. **Staging only until the owner approves.** Visible in DEV and the BL Staging build; hidden on
    production until the owner says so; release is one commit that removes the gate.
20. **iPad first, phone must work** — designed for the iPad, phone landscape/portrait get a tested,
    tighter layout of the same game.

## 3. What changes in code

Identifiers: gameId **`math.boat`** (must match `/'([a-z]+\.[a-z]+)'/` — letters only, see §4),
route **`/math/boat`**, tile id **`boat`**, icon key **`math.boat`**, usage event **`route:math_boat`**.

| File | Change | |
|---|---|---|
| `src/components/math/boat/FyldBaadenGame.tsx` | The game: GameShell (no `promptStage`), DndContext, harbour layers, quay, boat, deck, horn, Hør igen (`MathRepeatButton`) | new |
| `src/components/math/boat/boatDeck.ts` | **Pure** deck model: `load(kind)`, `unload(slot)`, auto-bundle at 10 crates, caps, `loadedValue()`, `ghostFor(target)` — the ONE resolve path both gestures call | new |
| `src/components/math/boat/boatDeck.test.ts` | Truth tests of the model (§7) | new |
| `src/components/math/boat/*` | Harbour/Boat/Deck/Quay sub-components as needed | new |
| `src/utils/mathProblems.ts` | `pickBoatNumber(level, rnd)` with the 3-of-4 ≥21 lean; no `Math.random` in the component (`promptDraw.test.ts`) | edit |
| `src/config/difficulty.ts` | `MATH_BOAT` table (`max` per level + `leanFrom: 21`, `leanShare: 0.75` at Normal/Svær), `TUNING` entry, `TILE_AXIS_EXEMPT` entry with reason | edit |
| `src/config/difficulty.test.ts` | Literal-table pin (line ~88), generator sampling for `pickBoatNumber` (pattern ~367–437) | edit |
| `src/config/gamePhrases.ts` (+ test) | `fillBoatPrompt(n)` built from `getDanishNumberText(n)`, range 1–100 exported | edit |
| `shared-narration-clips.js` | Enumerate `fillBoatPrompt` 1–100 (existing group `math`/`numbers`); add "Fyld Båden" to `WELCOME_TITLES` (~56) | edit |
| `src/config/prebakedTts.ts` + `public/sounds/tts/` | `npm run tts:prebake` output | regenerated |
| `docs/audit/narration-audit.json` | `audit:approve-all` (approved-but-unheard) | regenerated |
| `src/utils/SimplifiedAudioController.ts` | `GAME_WELCOME_MESSAGES` (~382) key → "Fyld Båden" | edit |
| `src/config/hintLines.ts` (+ test `SPEAKERS` ~116) | `'math.boat'` → `fillBoatPrompt(target)` | edit |
| `src/App.tsx` | `lazy(() => import('./components/math/boat/FyldBaadenGame'))`, `<Route path="/math/boat">` — production renders a redirect to `/math` (§2.19) | edit |
| `src/config/categoryThemes.ts` (~75–123) | Tile `{ id:'boat', title:'Fyld Båden', route:'/math/boat', gradient }` **directly after Tal Quiz**; `title` directly above `route` (sweep.mjs regex) | edit |
| `src/config/boatGate.ts` (+ test) | Pure `showsBoatGame(tier, isDev, isHarness)` = `tier==='staging' \|\| isDev \|\| isHarness` — mirror `showsDevTools` in `adultSettingsIa.ts:384`, NOT `BL_TIER` alone | new |
| Menu render (`GameSelectionLayout.tsx` or its data source) | Filter the `boat` tile through the gate | edit |
| `src/assets/themes/icons/games/index.ts` + `math.boat.webp` | Menu icon (`gameIcons.test.ts` fails without it) | edit/new |
| `src/assets/games/math/` | Harbour/boat/crate/pallet WebPs (eager glob) | new |
| `src/config/usageEvents.ts` | `'/math/boat': 'route:math_boat'` (`usageEvents.test.ts` fails otherwise) | edit |
| `src/services/sfxClient.ts` + `public/sounds/ui/*.mp3` | New cues: `horn`, `splash`, `crate-thud`, `pallet-clunk`, `bundle`, `boat-arrive` (+ `CUE_FILES`, `CUE_VOLUME`), via `scripts/transcode-sfx.mjs` | edit/new |
| `src/services/harbourAmbience.ts` + `public/sounds/ambience/harbour.mp3` | In-game loop bed (§4.4) | new |
| `scripts/optimize-theme-art.mjs` | Batch + any `*_KEY_OVERRIDES` for the new art | edit |
| `.claude/skills/ui-screenshot/sweep.mjs` | Add `/math/boat` to `ADVANCE_IS_NOT_A_TASK` (~354) — one crate is not a task | edit |
| `.claude/rules/games-math.md` | gameId list (line 6) + the crates exception, **net zero bytes** (§4.1) | edit |
| `docs/ui-reference/` | Screenshots + README section (fix the stale "8 cards") | edit |
| `art-src/` or a sounds credits file | Licence record for every SFX/ambience file (source, licence, URL) | new |

**Not touched:** progress schema (XP is per section via `sectionForGameId`, `math.` prefix), the API
(`/api/usage` reads `USAGE_EVENTS`, which spreads `ROUTE_EVENTS`), the practice ledger (math has no
prompt pool; `practiceLedger.test.ts:67` pins that), `MathGame.tsx`.

## 4. The traps — read this before you write any of it

### 4.1 Guardrail budget
- **`npm run context:check` is at 47,960 / 48,000 bytes** for "ONE COMPONENT EDIT (worst case)", and
  the worst case IS a math component (CLAUDE.md + working-in-this-tree + game-development +
  games-catalog + games-math + layout-contract + audio-call-sites). The crates exception in
  `games-math.md` (lines ~23–27 "Every countable stand-in…" / "Don't re-add a countable layer") and the
  catalog's line ~108 must be written **net zero**: cut the same bytes elsewhere in those files.
  **Do not create a new rule file scoped to `src/components/math/**`** — it lands in that same worst
  case. Game detail lives in this PRD and in code comments. `contextBudget.test.ts` fails otherwise.
- The exception's wording: *"Fyld Båden (`math.boat`) is the one exception: its number is only spoken,
  the numeral appears only after a correct send, and the crates ARE the answer (owner 2026-10-13)."*

### 4.2 Registration (each one fails a test or silently degrades)
- **gameId letters only** — `hintLines.test.ts` parses `'([a-z]+\.[a-z]+)'`; `math.boat-1` or
  `math.fyldbåden` breaks it silently.
- **`WELCOME_TITLES` in `shared-narration-clips.js` is hand-copied and unguarded** — forget it and the
  welcome plays through live Azure with no test failing. Add a guard that the two lists match, and
  re-break it.
- **Tile id ≠ gameId convention:** icon key is `<section>.<tile.id>` = `math.boat`.
- **The menu wraps:** Tal og Regning already has 7 tiles and an "orphan brake" (`maxWidth: 860`,
  `GameSelectionLayout.tsx` ~205–270) tuned to force 5+2/4+3. An 8th tile changes the arithmetic —
  re-measure with the `data-bl-landmark` probe on every skin; 4+4 is the target, never 7+1.
  (On production the gate hides it, so production stays at 7 until release.)
- **The gate:** `BL_TIER` defaults to `'production'` under `npm run dev`, so a tier-only gate hides the
  game from the owner's own dev machine. Use the `showsDevTools` shape. The route must also be gated
  (a deep link on production redirects to `/math`), not only the tile.

### 4.3 Audio
- **Never chain narration with `await`** (house rule, no queue). The wrong-send pair "loaded number →
  re-ask" is `void speakNumber(loaded)` then a **tracked fixed timer** (~1.6 s) firing
  `void speak(fillBoatPrompt(target))`. **Cancel that timer on any load/unload/horn** — the child is
  already fixing it — and on unmount.
- **Build `fillBoatPrompt(n)` from `getDanishNumberText(n)`, not `${n}`** — so the word matches the bare
  clip exactly, including the owner's **1 → "en"** decision (memory: PRD-11). `findNumber` uses a
  numeral; don't copy that.
- The bare number clips 0–100 are already prebaked (`audio.speakNumber(n)`); the correct-send line and
  the wrong-send "loaded" line reuse them. Only `fillBoatPrompt` 1–100 + the welcome title are new.
- Follow the **8-step protocol** in `audio-system.md` exactly; `audit:approve-all`, say
  "approved-but-unheard".
- **Ambience is a NEW in-game bed** — music today deliberately fades out on every game route
  (`musicClient.routeAllowsMusic`), so nothing collides, but every music-channel trap applies:
  - **Howler `html5: true`** (WebAudio music crashed iPadOS — `_cleanBuffer`), a **native looping
    sprite**, never a timer re-play (iOS blocks off-gesture `play()` on `<audio>`).
  - **Bake the level into the MP3** — iOS ignores `<audio>.volume` and the TTS duck is a no-op there.
    Bake it *below* the music level (start ≈ −50 LUFS; owner judges on the iPad) so narration always
    wins. Script it like `npm run music:bake`.
  - Start it from a **user gesture inside the game** (first pointerdown on the board) as well as on
    mount — the transition wipe can break the tile tap's gesture chain.
  - Obey `settings.musicEnabled` and master mute (ambience is the music slot here); stop on unmount
    and on `leavingFor`.
  - MP3 only, never Ogg (17.7 floor).

### 4.4 Drag and tap
- **One resolve function.** Drag a pallet/crate from the quay onto the deck → `load(kind)`; **tap a quay
  pile** → the same `load(kind)` (fills the next free slot, as Nuancer's `tapShade` does). Drag a loaded
  item back / tap it → `unload(slot)`. Model: `NuancerGame.tsx` 262–330.
- `kidCollision`, never `closestCenter`; `!over` springs back, **unless** `wasWobbledTap(delta)` → treat
  as a tap. `useDragOnlySensors()`, `DRAG_ACTIVATION_DISTANCE`. Compose `useTapActivate` with dnd-kit's
  `onPointerDown`, never replace it. `DraggableItem lift={{scale, rotate}}` — never animate a wrapper
  on `activeId`. `<Box component={motion.div} sx>`, never sx spread into `style`.
- **`MeasuringStrategy.Always`** — the deck is a droppable that *moves* (boat bob, arrival).
- The **horn is tap-only** (it confirms, it doesn't answer), like Hør igen; disabled while the deck is
  empty and during the advance window.
- Guard everything with `gameReady` + a synchronous `isAdvancing` ref; the bundle animation briefly
  locks input too.
- Caps: deck max = 100 (10 pallets). A pallet when 10 are loaded, or a crate when 10 pallets are loaded,
  springs back with `spring-back`. 9 pallets + 9 crates + 1 crate → bundles to 10 pallets.
- No ten-frame component exists any more (PRD-15's was deleted in 91e1020) — the deck is new. Both bays
  are **2×5 ten-frames**: the pallet bay (10 slots) and the crate bay (10 slots, the 10th triggers the
  bundle). Each pallet's art must show **ten units clearly** or it teaches nothing.

### 4.5 Visuals and motion
- **Full-bleed background is a first.** `PersistentWorld` stays mounted behind (blurred, paused) — the
  harbour covers it. Lay out by **reserved space** (flex siblings: quay | water/boat), never a tuned
  percentage against content it doesn't know (`layout-contract.md`). The header ring must stay legible
  over the sky — verify contrast on all skins' ring colours.
- **Continuous motion = CSS keyframes only** (`idleMotion.ts`): water layers drifting, boat bob, flag
  flutter, gulls idle. Never framer `repeat: Infinity` (`idleMotionBudget.test.ts`). Transform/opacity
  only. Measure steady state with `perf.mjs` — the target is the A10X iPad Pro 2017; a full-screen
  animated scene is exactly what made the app burn 40% of every idle second before.
- One-shot motion (arrival, send-off, bundle, wrong bob) = framer presets from `motion.ts`
  (`POP/SNAP/BOUNCE/EXIT_FAST`); dwell via `DWELL_CORRECT()`.
- **`content-visibility` is banned** (Safari 18). Check every new CSS/API against Safari 17.
- **Reduced motion:** water static, no bob, send-off becomes a fade, hint ghosts a static glow.
- **Numerals are Typography**, never baked into art. The sail must be a **blank** sprite; the numeral is
  overlaid. All four boat types carry a blank sail/banner on the mast.
- **Different Gemini boats will not share deck geometry.** The deck (bays) is ONE shared sprite/component
  at a fixed rect; each boat type is layered *around* it (back layer: cabin/mast/sail; front layer:
  hull). Ask for the layers separately in the art doc.
- **Gemini keying:** anything sea/sky needs "flat #00FF00, NOT a sky/sea" stated twice; green paint on
  a boat needs a per-file key override. The **backdrop is not a keyed 1:1 subject** — follow
  `scene-assets.md`'s scene-layer convention (wide, layered), not the single-subject opener.
- **No emoji anywhere**, art for child-facing, `lucide-react` for adult/dev.
- **Theming:** `getCategoryTheme('math')`, never `categoryThemes.math`; accent text on white →
  `onTileColor`.

### 4.6 Flow
- `useSimplifiedAudioHook({componentId, autoInitialize:false})` → `playGameWelcome` → `gameReady`; show
  the full UI immediately, gate input on `gameReady`. Then the first boat's prompt.
- `useTaskRun({ tasksInRound: 8, gameId: 'math.boat' })` (pattern: `ComparisonGame.tsx:133`).
  **One task = one correct send.** `completeTask(firstTry)` once per boat; `firstTry` = no wrong send on
  this boat. Then `run.thenContinue(nextBoat)` — the ceremony plays at the seam *after the send-off*,
  before the next boat arrives.
- Streak: the app's standard `celebrateTier('streak')` + `mascotBus.emit('streak')` every 3rd first-try
  boat unless a slot was crossed. Nothing more.
- `useNeverFailHint(2)`; reset per boat; on trip `mascotBus.emit('hint')` and speak
  `HINT_LINES['math.boat']`.
- Navigation only through `useTransitionNav()` — no raw `navigate()`.
- Narration-unhealthy degraded mode (`ctx.narrationHealthy` false, as `MathGame.tsx:56`): show the
  target numeral on the sail from the start, so the game stays playable without sound.

## 5. What must NOT change
- **Tal Quiz** — file, route, gameId, tile, behaviour.
- XP never depends on difficulty or on how many crates were moved; `taskXp(8, firstTry)` only.
- `rewardNumber()`, never `globalLevel()`; the header holds **the ring alone**; nothing in the harbour
  counts boats or accumulates progress.
- The number is **never visible before a correct send** (except the degraded no-sound mode).
- No streaks, timers, scores, stars, bests, rounds, random rewards, sad mascot, adaptivity, emoji, mic.
- One audio at a time; SFX never through `SimplifiedAudioController`; never await narration in a tap
  handler.
- Endless: no "Færdig!", no round end.

## 6. Work stages (one commit each, each green on its own)

- **W0 — Art prompt doc.** `plans/harbour-game/harbour-art-prompts.md` already lists the asset
  inventory; turn it into paste-ready 4-per-message Gemini batches using `scene-assets.md`'s exact
  opener (and the scene convention for the backdrop). Hand it to the owner. *Owner generates.*
- **W1 — Pure core + narration (no UI).** `boatDeck.ts` + tests, `pickBoatNumber` + `MATH_BOAT` +
  difficulty tests, `fillBoatPrompt` through all 8 prebake steps, welcome title in both lists (+ match
  guard), `HINT_LINES`. All plain-node; can run while the owner generates art.
- **W2 — Registration behind the gate.** `boatGate.ts` + truth-table test, route + production
  redirect, tile, icon, usage event, a placeholder board. Menu wrap re-measured.
- **W3 — Art in.** Key/trim via `optimize-theme-art.mjs`, build the **contact sheet** (all assets on one
  page, light + dark ground) → **owner sign-off (a)**. Nothing wires art the owner has not approved.
- **W4 — Vertical slice.** One boat type, full harbour layers and motion, full loop (drag + tap, bundle
  show, horn, correct send-off, wrong send pair, ceremony seam), SFX + ambience, iPad landscape.
  Verified to rung 2 + `perf.mjs`, then pushed to staging → **owner sign-off (b) on the iPad.** Rework
  until approved; do not start W5 before.
- **W5 — Complete.** Remaining boat types and rotation, hint ghosts, reduced motion, degraded mode,
  iPad portrait, phone landscape + portrait.
- **W6 — Verify + document.** Full sweep (§7), `docs/ui-reference/` shots, `games-math.md` exception
  (net zero), catalog line. Owner play-test with the son.
- **W7 — Release (owner-triggered only).** Remove the gate; menu shows 8 tiles on production; update
  `docs/app-store/listing.md` game count ("20 spil" lines ~187/299) at the next store release.

## 7. Verification

**Rung 1–2 (headless Chrome; real WebKit with iPad UA — layout is settled at rung 2, not 1):**
- `ui-screenshot` on `/math/boat` at iPad landscape + portrait, 844×390, 667×375, all skins, dark,
  reduced motion; rect checks: no overflow/scroll, 44px targets, quay/boat never overlap, ring legible.
- Drag and tap both load/unload on the same model (`webkit.mjs` drives both); a drag must not also
  register a tap.
- `--audio-report`: prompt, wrong-send pair, correct line, ambience actually produce sound; ambience
  stops on leaving.
- `perf.mjs` steady state on the board vs. an existing game — the harbour must not cost materially more
  idle style/paint time.
- `sweep.mjs` XP probe with `/math/boat` in `ADVANCE_IS_NOT_A_TASK`.

**New guards — each one re-broken with `/re-break`:**
1. `boatDeck.test.ts` — bundle at the 10th crate, caps at 100, unload returns whole pallets,
   `loadedValue` = 10·pallets + crates, `ghostFor(n)` = (⌊n/10⌋, n mod 10), and **tap and drag call the
   same function** (source-read guard on the component, comments stripped).
2. `difficulty.test.ts` — `MATH_BOAT` literal pin; sampling: Let never > 20; Normal never > 50; Svær
   never > 100; at Normal/Svær the ≥21 share is 0.75 ± tolerance over thousands of draws; never 0.
3. `boatGate.test.ts` — truth table (staging / dev / harness → shown; production → hidden).
4. Welcome-title match guard — `GAME_WELCOME_MESSAGES` titles ⊆ `WELCOME_TITLES`.
5. `gamePhrases.test.ts` — `fillBoatPrompt` exact strings pinned (incl. n=1 → "en") and enumerated
   1–100.
6. Existing guards that must go green, not be bypassed: `gameIcons`, `usageEvents`, `hintLines`,
   `promptDraw`, `idleMotionBudget`, `noEmoji`, `contextBudget`, `auditClips`.

**Rung 3 (owner's iPad, 17.7.11) — UNKNOWN until he plays it:** how the drag and the horn feel, whether
a 5-year-old reads a pallet as ten, the ambience level against narration, the Danish sounding right,
safe-area insets, real frame rate on the A10X, and whether it is fun. The vertical-slice sign-off is
this rung.

## 8. Out of scope
- Retiring or changing Tal Quiz (separate owner decision once Fyld Båden proves itself; compare
  `route:math_boat` vs `route:math_counting` entries).
- Paid assets: Rive, commissioned art, sound designer, voice actor (decided after the play-test).
- A captain character, tappable harbour toys, an extra streak flourish, per-skin harbours.
- Remaking any other game; the letter-sound game (needs its own Azure-phoneme listening test first).
- Practice ledger / prompt pool for math; any adaptivity.

## 9. Kickoff prompt for a fresh session

> Implement `plans/harbour-game/tmp-prd-harbour-game-01-fyld-baaden.md` (Fyld Båden, a new math game
> next to Tal Quiz). Read §4 traps first, then `.claude/rules/games-math.md`, `drag-and-drop.md`,
> `audio-system.md`, `scene-assets.md`. Start with W0 (art prompt doc for the owner) and W1 (pure core +
> narration), which run in parallel with the owner generating art; stop at W3 and W4 for the owner's two
> sign-offs. Re-break every guard in §7 and name the rung for every claim. The bar is "better than every
> other game on the iPad", not "works".
