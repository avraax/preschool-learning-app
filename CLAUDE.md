# Børnelæring - Danish Preschool Learning App

Danish educational web app for children aged 5-7. Alphabet, math, colors, and memory games with native Danish audio narration.

## Tech Stack

- React 19 + TypeScript, Vite 8, Material-UI v9 (no Tailwind)
- Framer Motion for animations, Howler.js for sound effects
- Audio: `SimplifiedAudioController` singleton → `ttsClient` playback engine → **Azure AI Speech** (single TTS provider) → Web Speech API (fallback) → Howler (SFX). Danish da-DK voice (Christel) for most sections; Azure en-US Ava (multilingual) for the Engelsk section. The VoiceOverridePanel (opened from the "Til de voksne" corner menu) can swap the Danish narration voice live among all Azure VoiceLab voices. Danish pronunciation is corrected via a hosted W3C PLS lexicon (`public/da-DK.pls`) + inline IPA. (Google TTS was removed in the Audio v2 rebuild; Google STT still powers "Sig et Ord".)
- Speech input (Sig et Ord): Google Cloud Speech-to-Text v2 via `/api/stt` + `useSpeechInput` hook
- React Router DOM v7 (route components lazy-loaded via `lazyWithReload` — stale-chunk → reload-once recovery). Single hand-authored PWA manifest (`public/manifest.json`); **no service worker** (network-only)
- Deployment: Vercel (auto-deploy on push to `master`)

## Commands

```
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build
npm run lint         # ESLint
npm run preview      # Preview production build
npm run tts:prebake  # Regenerate prebaked TTS (needs Azure creds; resumable). Commit its output.
git push origin master  # Deploy to production (Vercel)
```

**Prebaked TTS (PRD-06):** the closed narration set (letters, numbers 0–100, fixed prompts/welcomes/
success/encouragement, colour + shade + object lines, English words) is synthesized once at the
DEFAULT voice/rate into `public/sounds/tts/*.ogg` with a committed manifest (`src/config/prebakedTts.ts`,
keyed via `shared-tts-key.js`). `ttsClient` plays the prebaked file directly (no Azure round-trip, no
first-tap latency); Azure serves only genuinely dynamic text or a non-default VoiceLab voice. Run
`npm run tts:prebake` and commit the regenerated files after changing any of that content.

## Route Structure

```
/                        Home
/alphabet                Alphabet section menu
/alphabet/learn          Interactive letter learning
/alphabet/quiz           Letter recognition quiz
/math                    Math section menu
/math/counting           Counting game
/math/numbers            Number learning
/math/addition           Addition practice
/math/subtraction        Subtraction practice
/math/comparison         Number comparison
/math/patterns           Hvad Mangler? (patterns + skip-counting)
/farver                  Colors section menu
/farver/laer             Lær Farver (explore colors, shades + example objects)
/farver/jagt             Farvejagt (Color Hunt)
/farver/quiz             Hvilken Farve? (object → tap the matching color)
/farver/ram-farven       Ram Farven (Color Mixing)
/farver/nuancer          Nuancer (order shades light→dark)
/english                 English section menu
/english/listen          Lyt og Find (audio → picture)
/english/word            Find det Engelske Ord (picture → English word)
/english/translate       Dansk til Engelsk (Danish → English match)
/english/learn           Lær Engelsk (explore English words)
/ordleg                  Ordleg section menu
/ordleg/read             Læs Ordet (read word → pick picture)
/ordleg/spelling         Stav Ordet (moved from /alphabet/spelling)
/ordleg/mic              Sig et Ord (microphone speech game)
/learning/memory/:type/:size   Memory card game (type = letters|numbers, size = 10|20 pairs)
/learning/memory/:type         Size-less fallback (same component; defaults the board size)
/album                   Sticker album / reward hub (shared collection)
/voicelab                Hidden, off-menu internal TTS voice-audition tool (not linked in the UI)
```

URL utilities in `src/utils/urlParams.ts`. All features must use URL routing with bookmarkable, deep-linkable URLs.

## Key Architecture

- **Audio**: Centralized `SimplifiedAudioController` singleton (single audio at a time — new audio cancels current; **no queue**). See `.claude/rules/audio-system.md` for mandatory rules.
- **Games**: Two patterns - task-based (quiz) and learning-based (exploration). Most quizzes are thin configs over `UnifiedQuizGame`. See `.claude/rules/game-development.md`.
- **Layout**: Full-viewport, no-scroll game layouts. See `.claude/rules/responsive-design.md`.
- **Drag & drop**: The Farver games use `@dnd-kit` via shared primitives in `src/components/common/dnd/` — **`kidCollision` (never `closestCenter`)** so abortive drags spring back instead of scoring. See `.claude/rules/drag-and-drop.md` for mandatory rules (spring-back, advance-guard, floating-droppable measuring, the `sx`-not-raw-`style` gotcha, non-mutating `shuffle`).
- **Theming**: Fully token-driven. Each theme (skin) = one `ThemeTokens` object in `src/theme/tokens/*.tokens.ts`; `buildTheme(tokens)` maps it onto the MUI theme and attaches `theme.categories` / `theme.decor` / `theme.customShadows`. No styling values are hardcoded in components — read them via `useTheme()` or `getCategoryTheme(id)`. The active skin is chosen at runtime via the front-page **ThemeSelector** (`AppThemeProvider` in `src/theme/ThemeProvider.tsx`, persisted to `localStorage`). Ships **4 registered themes**: Regnbue (default), Havet, Rummet, Dinosaurer (`src/theme/themes.ts`). Two more token files — `jungle.tokens.ts` (Junglen) + `candy.tokens.ts` (Slikland) — exist but are **deliberately not registered** (add them to the `themes` array to ship). **Educational colors are NOT themeable** — Farvejagt/RamFarven color content stays as data. See "Adding a theme" below.
- **Scene & mascot**: An app-wide **persistent parallax world** (`src/components/common/scene/` — `PersistentWorld` + `ThemeScene` + `AmbientField` + `ParallaxLayer`/`useParallax`) renders behind every page for immersive skins. `scene/routeKind.ts` classifies each route as `menu` (bright live world + idle mascot) or `game` (dim/blur scrim, idle mascot hides). The **mascot** is rendered INSIDE each page — menus mount `ThemeMascot`, games mount GameShell's `Mascot` — and reacts to game events (`cheer`/`think`/…) via the `mascotBus` (`src/services/mascotBus.ts`), decoupled from the world layer to avoid Chrome hover-compositing flicker. The scene freezes (rAF stopped + ambient CSS paused) on game routes and under `prefers-reduced-motion` (see PWA/stability).
- **Music**: `musicClient` singleton (`src/services/musicClient.ts`, **HTML5 Audio** — moved off WebAudio for iOS-PWA stability) plays a per-world background-music bed on **menu surfaces only** (home + the 5 section menus + `/album`); entering a game/browse screen fades it out so narration + SFX own the mix. Menu-path classification shares `SECTION_MENU_PATHS` (`src/utils/menuPaths.ts`) with `scene/routeKind.ts` (the `/album` extra is music-only — the scene dims `/album`). Toggled by the 🎵 control in the "Til de voksne" menu, honoring `progressStore.settings.musicEnabled`. A **separate channel** from TTS and SFX (never routed through `SimplifiedAudioController`).
- **Update banner**: `UpdateBanner` (`src/components/common/UpdateBanner.tsx`) + `useUpdateChecker` (`src/hooks/useUpdateChecker.ts`) poll the deployed build version and show a gentle "ny version" refresh prompt when a newer deploy is detected (pairs with the network-only / `lazyWithReload` stale-chunk recovery).
- **State**: Local React state only, no global state management — EXCEPT persistent progress (below).
- **Math games** (Game Experience Overhaul): the five task games run **bounded rounds of 8** with the global sticker pool. Math `gameId`s: `math.counting`, `math.addition`, `math.subtraction`, `math.comparison`, `math.patterns`. Tal Quiz / Plus / Minus use **near-number distractors** (digit-swap, off-by-one/ten) instead of random. **Tal Quiz counts** (PRD-05): for n ≤ 20 the numeral is HIDDEN and exactly n objects are shown with the prompt "Hvor mange?" (the child actually counts — a giant numeral was trivial symbol-matching); n > 20 (Normal/Svær only) shows the numeral alone (recognition), never a misleading capped object row. **Plus/Minus/Sammenlign speak the completed fact** on a correct tap ("tre plus fire er syv", "sytten er større end ni") *instead of* echoing the tapped number; Hvad Mangler reads the finished number sequence. Sammenlign Tal is "tap the bigger number → krokodille >/< mouth eats it" (equality dropped); its object piles are fixed-height and shrink-to-fit so up to 20 objects show unclipped and order-match the numerals. Plus/Minus **Normal** ranges bumped (PRD-05): addition sums ≤20 with addends ≥2, subtraction minuend ≤20 (Svær subtraction = two-digit minuend 11–20). Lær Tal is a calm 1–100 browse that earns session-local exploration-milestone stickers (every 12 distinct taps) — no challenge mode.
- **Alphabet games** (Game Experience Overhaul): Bogstav Quiz (`alphabet.quiz`, bounded rounds of 8, global pool) is **all word-association** — show a picture, tap the letter the word starts with (the trivial "hør bogstavet" recognition mode was removed); distractors stay random (Q/W/X never the answer, only distractors). Lær Alfabetet is a calm A–Å browse that earns session-local exploration-milestone stickers (every 9 distinct taps, mirroring Lær Tal) — no challenge mode.
- **Ordleg games** (Game Experience Overhaul): all three run **bounded rounds of 8** (3★=0 / 2★≤2) with the global sticker pool, ending on `RoundResultScreen`. Læs Ordet (`ordleg.read`) is a thin `UnifiedQuizGame` round config — still **never reads the prompt word aloud** (silent decoding is the exercise); after 2 wrong picture taps the correct picture pulses (shared engine never-fail hint, PRD-05); Let pool widened + anti-repeat guard so short words don't repeat. Stav Ordet (`ordleg.spelling`) is hand-rolled: wrong letter = `wrong` SFX + shake, and after **2 wrong taps on a slot** the correct tile pulses (never-fail **next-letter hint**, reduced-motion → static glow; using it costs a star). Sig et Ord (`ordleg.mic`) stays **open-ended** — say any word → spelled back; **no target word, no STT grading**; a recognized word = 1/8 (`OrdlegScoreChip` shows the count), an STT mishear stays on the same question without counting and only breaks first-try.
- **English games** (Game Experience Overhaul): the three quizzes run **bounded rounds of 8** (3★=0 / 2★≤2) with the global sticker pool, ending on `RoundResultScreen` — they are thin `UnifiedQuizGame` round configs (`english.listen`, `english.word`, `english.translate`). Distractors stay **random** and themes stay **mixed** (no minimal-pairs, no per-theme rounds — deliberate beginner floor); the green `EnglishRepeatButton` is the only audio affordance (no "audio playing" cue). Lær Engelsk is a calm browse that earns session-local exploration-milestone stickers (every 9 distinct words tapped, mirroring Lær Alfabetet) — no challenge mode.
- **Farver games** (Game Experience Overhaul): both drag games are hand-rolled (dnd-kit) and now wire onto the Foundation round/reward system (global sticker pool, ending on `RoundResultScreen`). Farvejagt (`colors.farvejagt`) runs a **round = 5 boards** (each fully-collected board = 1 question); boards are calmer (~12 items — 5-6 targets + **1** distractor per other color), items **scatter-in**, a correct drop **snaps+pops into a tidy ring** inside the target circle (`drop-snap` SFX + spoken "{objektet} er {farve}") with a **pip progress ring** around the circle, a wrong drop bounces back + `wrong` SFX, and after **2 wrong drops** an uncollected target **pulses** (never-fail hint, costs a star); board-complete spins the ring before advancing. Ram Farven (`colors.ramfarven`) runs a **round = 8 mixes**; two droplets **swirl/blend** into the pot over ~600ms (`drop-snap`), a correct mix shows a **recipe reveal** (🔴+🔵=🟣 + spoken "rød og blå bliver lilla"), a wrong mix briefly shows the wrong color + `spring-back` SFX + a fizz-puff visual (**no spoken feedback**), a **Tøm** button empties a mis-dragged pot, and after **2 wrong mixes** the 2 correct droplets pulse (hint, costs a star). Both run 3★=0 / 2★≤2, use `celebrateTier` (not legacy `celebrate`), show round progress via `ColorProgressChip`, and route all **chrome** through tokens (`getCategoryTheme('colors')` + `useTheme()`) — **educational color hexes stay as data** (the `DroppableZone` hover tint is now neutral/overridable so it never forces red on non-red targets). Reduced motion degrades all juice to instant/static; SFX + spoken reinforcement + reward still land. **The section now has 5 games** (challenge expansion): the educational color content for Farvejagt/Hvilken Farve?/Nuancer/Lær Farver (objects, hunt targets, per-hue shade families, swatches) lives in `src/config/colorContent.ts` (NOT themeable); Ram Farven's mixing recipes (`primaryColors`/`possibleTargets`/`mixingRules`) live in `RamFarvenGame.tsx` (not colorContent). Ram Farven's recipe set spans **9 targets**, wired to a **difficulty-gated pool** (Let → Normal → Svær widen from the iconic two-primary secondaries up to all 9, incl. black-based shades); still 2-droplet, mechanic unchanged. **Lær Farver** (`/farver/laer`) is a calm browse (tap a color → name + shade trio + example objects; exploration-milestone stickers every 9 distinct taps, mirroring Lær Tal). **Hvilken Farve?** (`colors.quiz`, `/farver/quiz`) is hand-rolled (dnd-kit) — **drag the object onto the matching color** (4 color-swatch drop zones); wrong color bounces back + `wrong` SFX, after 2 wrong the correct color pulses (hint costs a star); bounded round of 8. **Nuancer** (`colors.nuancer`, `/farver/nuancer`) is hand-rolled (dnd-kit): **drag** 3 shades of one hue into slots **light→dark** (left=lightest); wrong slot bounces back + `wrong` SFX + shake, after 2 wrong drops the correct tile for the next empty slot pulses (hint costs a star), bounded round of 8, 3★=0/2★≤2. **All five Farver games are now drag-based** except the calm Lær Farver browse (tap-to-hear). **Content-quality invariants** (PRD-04): the spoken color echo `"{objektet} er {farve}"` must go through `spokenColor(hue, neuter)` (colorContent.ts) so the adjective agrees in gender ("æblet er rødt", "havet er blåt" — not "rød"/"blå"); every `ColorObject` carries a `neuter` flag, and objects whose emoji contradict their color (⚽/👒/☁️/🌸) carry `quizSafe:false` so Hvilken Farve never scores the child on a picture that reads a different color.
- **Memory games** (Game Experience Overhaul): one engine (`UnifiedMemoryGame.tsx`) + a config factory (`MemoryGame.tsx`) now power **four** games — letters/numbers × **10-pair / 20-pair** — as **separate routes** (`/learning/memory/:type/:size`, static difficulty, not an in-game picker), reached from the Alfabetet + Tal menus as **"Hukommelse 10" / "Hukommelse 20"** (🧠). gameIds: `memory.letters.10/.20`, `memory.numbers.10/.20`. **One board = one round** (no `useRound` — Memory always finds every pair, so the only skill signal is mismatched turns): completing the board ends on `RoundResultScreen`. Scoring maps with **zero Foundation change** — `recordRoundResult(gameId, { correct: boardPairs, total: boardPairs + mismatches, longestStreak })`, so `mistakes = mismatches` → **stars scale with mismatches** (10-pair `{three:9,two:18}`, 20-pair `{three:18,two:34}` — retuned in PRD-05 so a strong-but-imperfect child can reach 3★; always ≥1) and **longest match-streak** is the "Længste stime" record. Juice: `sfx.play('flip')` on each reveal, `sfx.play('match')` + a match **pop** on a pair (deliberately NOT a full `celebrateTier` — the per-match cue stays light), `celebrateTier('streak')` every 3rd consecutive match (not on the final pair), gentle `sfx.play('wrong')` on a mismatch. Global sticker pool. Cards uplifted to the `AnswerTile` depth language (token-driven via `useTheme()` + `darken`/`hexToRgba` — no hardcoded colors; matched = success glow), board-size-aware grid columns, pairs-remaining chip (`Par: X/P` via `customLabel`), reduced-motion drops the pop but keeps flips + colour/glow.
- **Progress / rewards** (Game Experience Overhaul foundation): `progressStore` singleton (`src/services/progressStore.ts`, localStorage key `bornelaering-progress`, versioned + private-mode-safe) is the single source of truth for persistent single-profile progress — collected stickers, per-game bests (longest streak / best stars / best count), lifetime stars. Read it via `useProgress()` (`src/hooks/useProgress.ts`, `useSyncExternalStore`). Task quizzes run **bounded rounds** (`useRound`, default 8 questions, no timer; wrong answers don't punish, only break a question's first-try flag) and end on `RoundResultScreen` (stars → "Ny rekord!" ribbon → streak → `StickerReveal` → replay/album/back). `UnifiedQuizGame` opts in via an optional `round` + `gameId` config (absent → endless behavior). It also carries a **never-fail hint** (PRD-05): set `hintAfterNWrong` (2 for all 7 config quizzes) and after that many wrong taps the correct `AnswerTile` pulses (reduced-motion → static accent glow ring), matching the hand-rolled color/spelling games; the 2 wrongs already broke first-try so no extra star bookkeeping. An optional `speakCorrectFact(item)` speaks a completed fact on a correct answer instead of the tapped-item echo.
- **Difficulty** (static, manual — NO adaptivity by design): `progressStore.settings.difficulty` holds a global Let/Normal/Svær + optional per-section overrides; set in the **"Til de voksne" → Sværhedsgrad** panel (`DifficultyPanel.tsx`), read live via `useDifficulty(section)` / `progressStore.difficultyFor(section)`. ~12 games read it when generating content and regenerate the current question on a mid-game change. The manual level is **authoritative** — PRD-05's default recalibrations (counting-as-counting, bumped math Normal ranges, reachable Memory 3★) are just new defaults, all still overridden by this panel. Sections: alphabet/math/colors/english/ordleg. The **sticker album** (`/album`, `StickerAlbum`) is the shared collection; sets/stickers are data in `src/config/stickers.ts` (emoji-based, app-wide pool). A child-resistant parent reset lives in the **"Til de voksne" corner menu** (hold the ⚙️ corner button ~2s on any page) → "Nulstil al fremgang" → a "Kun for voksne" gate (type 3 digits shown as Danish words, e.g. "fem · to · fire", reusable `AdultGate` component) → `progressStore.resetAll()`; a wrong/cancelled gate resets nothing.
- **SFX**: `sfx` singleton (`src/services/sfxClient.ts`, Howler) is a SEPARATE short channel from TTS — it never cancels/queues against narration. Cues live in `public/sounds/ui/*` (curated from the mascot packs). Mute respects `progressStore.settings.sfxEnabled`. NEVER route SFX through `SimplifiedAudioController`. Celebrations escalate by **tier** via `useCelebration().celebrateTier(tier)` (micro/streak/round/best/sticker/page → confetti + matching SFX); the legacy `celebrate(intensity)` still works.
- **Routing**: React Router v7 in `App.tsx` (lazy-loaded route components), `useNavigate()` for navigation, NavigationAudioCleanup for audio cleanup (+ diagnostics route breadcrumbs) on route changes.
- **PWA / stability** (PRD-08): Network-only, **no service worker** — `main.tsx` runs a one-time legacy-SW unregister + cache sweep (`utils/swCleanup.ts`) for clients from an older SW era. Exactly one manifest: hand-authored `public/manifest.json` (linked in `index.html`; `theme_color`/`background_color` `#8B5CF6` matching the `theme-color` meta; `orientation: any`). Lazy routes are wrapped in `lazyWithReload` (`utils/lazyWithReload.ts`): a stale-chunk/dynamic-import failure after a deploy triggers a single `location.reload()` (sessionStorage-guarded against loops) instead of crashing into `AppErrorBoundary`. `progressStore` flushes synchronously on `pagehide`/`visibilitychange:hidden` (survives a fast PWA swipe-away) and re-hydrates from a cross-tab `storage` event (last-writer-wins). The persistent parallax scene freezes (rAF stopped + ambient CSS `animation-play-state: paused`) on game routes (`scene/routeKind.ts`), on top of the existing `prefers-reduced-motion` gate.
- **Adult tools / bug reports**: the **"Til de voksne" corner button** (`AdultCorner`, mounted globally in `App.tsx`, bottom-right, hold ~2s to open — plain tap just wiggles; dev-only `?adult-tap=1` makes a plain tap open it for headless tests) consolidates all parent-facing tools: 🐞 bug reporter, 🎙️ voice override panel, 🔊 SFX toggle, ♻️ gated progress reset, and the version/build footer (the old floating mic icon + version chip were removed). **Bug reporting**: `diagnosticsBuffer` (`src/services/diagnosticsBuffer.ts`, installed as the FIRST import in `main.tsx`) always records rings of console lines (300), network calls (100) and route/tap breadcrumbs (60); opening the menu captures a **screenshot** (snapdom, before the menu renders); "Rapportér et problem" → `bugReporter.buildReportPayload()` (build info, device, audio health incl. TTS circuit-breaker + permission snapshot, progress state, diagnostics rings) → POST `/api/bug-report` → **Vercel Blob** (`bug-reports/<date>/<ID>/report.json` + `screenshot.jpg`) → short code (e.g. `R7K3F`) shown to the adult; offline/failure → "Gem som fil" downloads the same JSON. **Crashes auto-upload** slim reports (no screenshot): window `error`/`unhandledrejection` hooks + the global `AppErrorBoundary` (kid-friendly "Ups!" + reload; `?crash-test=1` throws on purpose), deduped by signature, max 3/session. Locally `dev-server.js` mirrors the endpoint to a gitignored `.bug-reports/` folder — the whole flow works without Blob. Retrieval: the `/debug-report` skill (`.claude/skills/debug-report/`).
- **API endpoints**: the `api/*.ts` Vercel functions (paid TTS/STT proxies + bug-report storage) are a trust boundary — scoped CORS + origin allow-list + per-IP rate limit + no error-detail leaks, all via `lib/server-utils.ts`, and **mirrored in `dev-server.js`**. See `.claude/rules/api-endpoints.md`.

## Project Structure

```
src/
  components/
    common/          SimplifiedAudioPermission, GameSelectionLayout, GameHeader, UnifiedQuizGame, LearningGrid, RepeatButton, ScoreChip, CelebrationEffect (+ tiers), RoundResultScreen, StickerReveal, AnswerTile, AdultGate (digit-words gate), AppErrorBoundary (global crash fallback), balloon/
    adult/           AdultCorner ("Til de voksne" corner button + menu), BugReportDialog
    hub/             StickerAlbum (the /album reward hub)
    alphabet/        AlphabetGame, AlphabetLearning, AlphabetSelection
    math/            MathGame, NumberLearning, MathOperationGame (+/−), ComparisonGame, HvadManglerGame, MathSelection
    farver/          FarvejagtGame, RamFarvenGame, FarverSelection
    english/         EnglishSelection, EnglishListenGame, EnglishWordGame, EnglishTranslateGame, EnglishLearning
    ordleg/          OrdlegSelection, LaesOrdetGame, SpellingGame, SpeakWordGame (mic/STT)
    learning/        MemoryGame
  contexts/          SimplifiedAudioContext.tsx (audio permission + readiness state)
  hooks/             useSimplifiedAudio.ts (component audio interface), useSpeechInput.ts (mic capture), useProgress.ts (persistent progress), useRound.ts (bounded rounds)
  utils/             SimplifiedAudioController.ts, urlParams.ts, deviceDetection.ts, remoteConsole.ts
  services/          ttsClient.ts (Azure playback engine), progressStore.ts (persistent progress singleton), sfxClient.ts (SFX channel), diagnosticsBuffer.ts (always-on console/network/breadcrumb rings), bugReporter.ts (report build/upload + crash auto-report), screenshotService.ts (snapdom capture)
  config/            categoryThemes.ts (section content + token-backed colors), stickers.ts (album sets/data), englishVocab.ts, version.ts
  theme/             tokens/ (types.ts, helpers.ts, <skin>.tokens.ts), buildTheme.ts, themes.ts (registry), ThemeProvider.tsx
  api/               tts-azure.ts, stt.ts, log-error.ts, bug-report.ts (Vercel Blob storage), version.ts  (Vercel serverless; mirror dev-server.js; shared Azure core in shared-azure-tts.js + helpers in lib/server-utils.ts)
  App.tsx            Router + SimplifiedAudioProvider + NavigationAudioCleanup + AdultCorner + CrashTestProbe
```

**UI reference screenshots** of every view (iPad + phone + overlays) live in `docs/ui-reference/`
(see its README) — use as the baseline for UI/UX polish work, and re-capture after visual changes.

## Adding a theme

1. Copy an existing `src/theme/tokens/<skin>.tokens.ts` (e.g. `ocean.tokens.ts`) to a new file, give it a unique `id`, a `name` + `selectorEmoji` (shown in the picker), and edit the colors. Use the `category()` / `gradient3()` / `neutralShadows()` helpers from `tokens/helpers.ts` so the structure matches other skins.
2. Each theme must give the 5 sections (alphabet/math/colors/english/ordleg) **distinct, readable accents**. Keep `success` green-ish and `error` red-ish (kids read green=correct / red=wrong). Section emojis stay constant across skins (`SECTION_ICONS`).
3. Register it: import and append to the `themes` array in `src/theme/themes.ts`. It appears in the front-page selector automatically. The default `kid` theme (`kidTheme.tokens.ts`) keeps hand-written exact values; don't refactor it.

## Production Logs

Client-side remote logging (`remoteConsole`) is **dev-only / OFF in production** (Audio v2 decision —
no durable storage). End users no longer POST to `/api/log-error`; the endpoint receives ~no traffic.
Server-side errors are recorded via `lib/server-utils.ts` `logServerError` (Vercel function logs +
absolute-URL POST). Force client logging on elsewhere with `?enable-console=true`.

```bash
# ALWAYS use curl, not WebFetch (large JSON parsing issues)
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=50"
curl -s "https://preschool-learning-app.vercel.app/api/log-error?limit=50&device=iPad&level=error"
```

Params: `limit`, `level` (error/warn/info/log), `device`, `since` (ISO date).

## Bug reports (Til de voksne)

Adults hold the corner ⚙️ button ~2s → "Til de voksne" menu → "Rapportér et problem" (a screenshot
of the moment is captured BEFORE the menu renders). Reports are stored durably in **Vercel Blob**
under `bug-reports/<date>/<ID>/` (`report.json` + `screenshot.jpg`) and identified by a short code
(e.g. `R7K3F`). Crashes (window errors, unhandled rejections, ErrorBoundary catches) auto-upload
slim `type:"crash"` reports — deduped, max 3/session. Locally, `dev-server.js` mirrors the endpoint
into the gitignored `.bug-reports/` folder, so the full flow works offline/without Blob.

One-time prod setup: Vercel dashboard → Storage → create a **Blob** store → connect to the project
(adds `BLOB_READ_WRITE_TOKEN`). **Required:** set `BUG_REPORT_READ_KEY` in the Vercel env — GET
reads are **fail-closed** (403 until the key is set) since reports contain child screenshots;
once set, every GET must pass `&key=<value>` (PRD-03). The Vercel CLI is installed & the project is
linked (`.vercel/project.json`), so this key is settable from here:
`vercel env add BUG_REPORT_READ_KEY production` (value via stdin).

**To debug a report, use the `/debug-report` skill** (handles "newest report", one code, or many).
Raw access:

```bash
# ALWAYS use curl, not WebFetch. Local base: http://127.0.0.1:3001
# Prod GET is fail-closed: every request needs &key=$BUG_REPORT_READ_KEY (else 403). Local is open.
curl -s "https://preschool-learning-app.vercel.app/api/bug-report?list=10&expand=1&key=$BUG_REPORT_READ_KEY"  # newest first + summaries
curl -s "https://preschool-learning-app.vercel.app/api/bug-report?id=R7K3F&key=$BUG_REPORT_READ_KEY"          # full report JSON
curl -s -o /tmp/shot.jpg "<screenshotUrl from the response>"                          # then Read the jpg
```

## Conventions

- camelCase variables, PascalCase components
- TypeScript strict mode
- Feature-based file organization
- Comic Sans MS for child-facing typography
- Danish language for all user-facing content
- Minimum 44px touch targets
