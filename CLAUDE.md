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
npm run build        # TypeScript compile + Vite production build (rewrites src/config/version.ts — don't commit that churn)
npm run lint         # ESLint
npm test             # Node built-in runner (node --test, type-stripped ≥22.18); curve unit tests in src/**/*.test.ts
npm run preview      # Preview production build
npm run tts:prebake  # Regenerate prebaked TTS (needs Azure creds; resumable). Commit its output.
npm run audit:check  # Narration guard (PRD-11): flags closed-set clips not signed off in docs/audit/
npm run audit:approve-all  # Owner bulk sign-off of the current narration set (after a /audit listen pass)
git push origin master  # Deploy to production (Vercel)
```

**Prebaked TTS (PRD-06):** the closed narration set is synthesized once into `public/sounds/tts/` +
a committed manifest; `ttsClient` plays those before Azure. Rerun `npm run tts:prebake` and commit
the output after changing narrated content — see `.claude/rules/audio-system.md`.

## Routes

5 sections — `/alphabet` `/math` `/farver` `/english` `/ordleg` — each a menu + its games, plus `/album`, `/learning/memory/:type/:size`, and off-menu `/voicelab`. All routes are enumerated in `App.tsx`; every feature uses bookmarkable, deep-linkable URLs (utilities in `src/utils/urlParams.ts`).

## Key Architecture

- **Audio**: Centralized `SimplifiedAudioController` singleton (single audio at a time — new audio cancels current; **no queue**). See `.claude/rules/audio-system.md` for mandatory rules.
- **Games**: two patterns — task-based **quizzes** (bounded rounds of 8 → `RoundResultScreen`; wrong answers only break first-try) and calm **learning browses** (free exploration, no round). Both earn **live per-task XP** (see Progression); stickers drop only on a level-up. gameIds are `<section>.<game>`. Per-game mechanics + invariants: `.claude/rules/games-catalog.md` · how to build: `.claude/rules/game-development.md` · drag games: `.claude/rules/drag-and-drop.md`.
- **Game-entry beat** (Liveliness PRD-03): `GameShell` renders a skippable "Er du klar? … Kør!" mascot curtain (`GameIntro.tsx`) over the (instant-load) board on mount — additive polish that never gates the game's own `gameReady`/interaction timing; a tap anywhere fast-forwards (bubbles to the window `pointerdown` audio-unlock). Gated by `intro?: boolean` (default true) + reduced-motion (never shown → today's silent-instant load); calm `Lær …` browses pass `intro={false}`. Dev harness: `/dev/game-intro?category=&phase=ready|go` (frozen). The **unified in-game interaction language**: shared `<BackButton variant='game'>` (PRD-02), correct/wrong mascot via GameShell's `guideReaction`→`mascotBus` bridge (hand-rolled games set `guideReaction`; the engine does it internally), a synchronous `sfx.play('tap')` "every tap is felt" tick on each answer press, `mascotBus.emit('streak')` alongside `celebrateTier('streak')` on the 3-in-a-row milestone (round is covered by `RoundResultScreen`'s own `'round'` emit), and `celebrateTier` (never legacy `celebrate`). Navigation always flows through the transition system / `RoundResultScreen` — no raw `navigate()` from inside a game.
- **Layout**: Full-viewport, no-scroll game layouts. See `.claude/rules/responsive-design.md`.
- **Drag & drop**: The Farver games use `@dnd-kit` via shared primitives in `src/components/common/dnd/` — **`kidCollision` (never `closestCenter`)** so abortive drags spring back instead of scoring. See `.claude/rules/drag-and-drop.md` for mandatory rules (spring-back, advance-guard, floating-droppable measuring, the `sx`-not-raw-`style` gotcha, non-mutating `shuffle`).
- **Theming**: Fully token-driven. Each theme (skin) = one `ThemeTokens` object in `src/theme/tokens/*.tokens.ts`; `buildTheme(tokens)` maps it onto the MUI theme and attaches `theme.categories` / `theme.decor` / `theme.customShadows`. No styling values are hardcoded in components — read them via `useTheme()` or `getCategoryTheme(id)`. The active skin is chosen at runtime via the front-page **ThemeSelector** (`AppThemeProvider` in `src/theme/ThemeProvider.tsx`, persisted to `localStorage`). Ships **4 registered themes**: Regnbue (default), Havet, Rummet, Dinosaurer (`src/theme/themes.ts`). Two more token files — `jungle.tokens.ts` (Junglen) + `candy.tokens.ts` (Slikland) — exist but are **deliberately not registered** (add them to the `themes` array to ship). **Educational colors are NOT themeable** — Farvejagt/RamFarven color content stays as data. See "Adding a theme" below.
- **Scene & mascot**: An app-wide **persistent parallax world** (`src/components/common/scene/` — `PersistentWorld` + `ThemeScene` + `AmbientField` + `ParallaxLayer`/`useParallax`) renders behind every page for immersive skins. `scene/routeKind.ts` classifies each route as `menu` (bright live world + idle mascot) or `game` (dim/blur scrim, idle mascot hides). The **mascot** is rendered INSIDE each page — menus mount `ThemeMascot`, games mount GameShell's `Mascot` — and reacts to game events (`cheer`/`think`/…) via the `mascotBus` (`src/services/mascotBus.ts`), decoupled from the world layer to avoid Chrome hover-compositing flicker. The scene freezes (rAF stopped + ambient CSS paused) on game routes and under `prefers-reduced-motion` (see PWA/stability).
- **Music**: `musicClient` singleton (`src/services/musicClient.ts`, **HTML5 Audio** — moved off WebAudio for iOS-PWA stability) plays a per-world background-music bed on **menu surfaces only** (home + the 5 section menus + `/album`); entering a game/browse screen fades it out so narration + SFX own the mix. Menu-path classification shares `SECTION_MENU_PATHS` (`src/utils/menuPaths.ts`) with `scene/routeKind.ts` (the `/album` extra is music-only — the scene dims `/album`). Toggled by the 🎵 control in the "Til de voksne" menu, honoring `progressStore.settings.musicEnabled`. A **separate channel** from TTS and SFX (never routed through `SimplifiedAudioController`).
- **Update banner** (PRD-09): `useUpdateChecker` (`src/hooks/useUpdateChecker.ts`) polls the deployed build; when a newer build is live `UpdateBanner` shows a **dismissible** bottom-centre announcement pill (no reload) and the apply-update is a **hold-gated item in the `AdultCorner` menu** — never a child-tappable reload button. Pairs with the network-only / `lazyWithReload` recovery.
- **State**: Local React state only, no global state management — EXCEPT persistent progress (below).
- **Progress / rewards** (Game Experience Overhaul foundation): `progressStore` singleton (`src/services/progressStore.ts`, localStorage key `bornelaering-progress`, versioned + private-mode-safe) is the single source of truth for persistent single-profile progress — collected stickers, per-game bests (longest streak / best stars / best count), lifetime stars. Read it via `useProgress()` (`src/hooks/useProgress.ts`, `useSyncExternalStore`). Task quizzes run **bounded rounds** (`useRound`, default 8 questions, no timer; wrong answers don't punish, only break a question's first-try flag) and end on `RoundResultScreen` (stars → "Ny rekord!" ribbon → streak → XP-meter → replay/album/back). A normal round reveals **no** sticker (`outcome.stickers === []`); the sticker reveal moved to the level-up ceremony (PRD-04, see Progression). `UnifiedQuizGame` opts in via an optional `round` + `gameId` config (absent → endless behavior). It also carries a **never-fail hint** (PRD-05): set `hintAfterNWrong` and after that many wrong taps the correct `AnswerTile` pulses (reduced-motion → static accent glow ring), matching the hand-rolled color/spelling games; the wrongs already broke first-try so no extra star bookkeeping. An optional `speakCorrectFact(item)` speaks a completed fact on a correct answer instead of the tapped-item echo. **Result screen (PRD-09):** action buttons stay `pointer-events:none` until they animate in, and a tap anywhere **fast-forwards** the ceremony — done by remounting the beats under a keyed `<Fragment>` (framer won't reschedule an already-pending delayed animation just by lowering its `delay`); the star timeline collapses to the actual star count. The level-up ceremony's spoken/sticker award lines branch on `award.isNew` — a duplicate says **"skinnende"**, never **"nyt"**.
- **Progression / journey** (Liveliness PRD-01; earning + visibility **reworked by PRD-04**): purely-rewarding cross-game level. `progressStore.progression` (schema **v2**) stores only `globalXp` + per-section `bloom` XP + `lastCelebratedLevel`; level + bloom stage/fill are **derived** via pure `src/config/progression.ts` (`levelFromXp`/`taskXp`/`roundXp`/`bloomStage`), never stored. **XP is earned PER COMPLETED TASK, live**, via `progressStore.grantTaskXp(gameId, {firstTry, section?})` at the few choke points — `useRound.completeQuestion` (opt in with `RoundConfig.gameId`; covers all 9 useRound games), `UnifiedMemoryGame`'s match branch, and browse screens' `useBrowseXp(section)` (per NEW item, `gameId:'browse'`) — each pinging `xpBus` → the header/menu `LevelRingMini` (ring ticks + "+X" flyer). `roundXp` is **bonuses-only** at round end (perfect / new-best / page); `taskXp` weights are per-game + first-try, **never difficulty-dependent** (fairness). Read via `useProgress()` (`globalLevel`/`xpProgress`/`bloomFor`). **Mid-game level-up = small flourish now, big ceremony deferred**: `LevelUpWatcher` is gated OFF `game` routes (via `routeKind`) so the full-screen ceremony never interrupts play — it fires on the next menu; `RoundResultScreen` triggers it directly, keyed on the store cursor (`globalLevel() > lastCelebratedLevel`, **NOT** `outcome.xp.leveledUp` — the crossing may be mid-round). Ceremony = `levelUpBus.emit` → app-root `LevelUpOverlay` (`celebrateTier('levelup')` + `speakLevelUp`), fires once via `lastCelebratedLevel` (**starts at 1** so trin 1 isn't celebrated) → `markLevelCelebrated` on dismiss. **Stickers are the trophy of a level-up** (PRD-04): `recordRoundResult`/browse grant NONE; `LevelUpOverlay` calls `progressStore.grantLevelUpSticker()` and reveals it inside the ceremony. Home shows `ProgressionCompanion`; game headers + section menus show `LevelRingMini`. New spoken praise is a closed set → prebaked + auditioned like other narration.
- **Difficulty** (static, manual — NO adaptivity by design): `progressStore.settings.difficulty` holds a global Let/Normal/Svær + optional per-section overrides; set in the **"Til de voksne" → Sværhedsgrad** panel (`DifficultyPanel.tsx`), read live via `useDifficulty(section)` / `progressStore.difficultyFor(section)`. ~12 games read it when generating content and regenerate the current question on a mid-game change. The manual level is **authoritative** — PRD-05's default recalibrations (counting-as-counting, bumped math Normal ranges, reachable Memory 3★) are just new defaults, all still overridden by this panel. Sections: alphabet/math/colors/english/ordleg. The **sticker album** (`/album`, `StickerAlbum`) is the shared collection; sets/stickers are data in `src/config/stickers.ts` (emoji-based); each section biases awards toward its own page via `stickerSetForSection(section)`, and `progressStore.grantSticker` falls back to the global uncollected pool once a page is full so the album still completes. A child-resistant parent reset lives in the **"Til de voksne" corner menu** (hold the ⚙️ corner button ~2s on any page) → "Nulstil al fremgang" → a "Kun for voksne" gate (type 3 digits shown as Danish words, e.g. "fem · to · fire", reusable `AdultGate` component) → `progressStore.resetAll()` (clears stickers/bests/stars/trin but **preserves** sound/music/difficulty); a wrong/cancelled gate resets nothing.
- **SFX**: `sfx` singleton (`src/services/sfxClient.ts`, Howler) is a SEPARATE short channel from TTS — it never cancels/queues against narration. Cues live in `public/sounds/ui/*` (curated from the mascot packs). Mute respects `progressStore.settings.sfxEnabled`. NEVER route SFX through `SimplifiedAudioController`. Cue files play in **full** (no Howler sprite), so a file's length = its playback length — keep cues short and trim curated clips, never ship a whole source track (PRD-07 cut multi-second clips, incl. a 47s "flip", down to short cues). Celebrations escalate by **tier** via `useCelebration().celebrateTier(tier)` (micro/streak/round/best/sticker/page/levelup/levelup-mini → confetti + matching SFX; `levelup-mini` is the non-interrupting mid-game level-up burst); the legacy `celebrate(intensity)` still works.
- **Routing**: React Router v7 in `App.tsx` (lazy-loaded route components), `useNavigate()` for navigation (but menus/games route through the themed transition system below, not raw `navigate`), NavigationAudioCleanup for audio cleanup (+ diagnostics route breadcrumbs) on route changes.
- **Menus & navigation** (Liveliness PRD-02): menu/game navigation goes through `useTransitionNav()` (`navigateWithTransition`/`goBack`) → `TransitionProvider` drives a decoupled **opaque wipe overlay** (`src/components/common/transition/`) so the page mount/unmount happens fully covered — obeying the SAME compositing-flicker rules as the persistent world (opaque paint, `transform`/`clip-path` only, **no `backdrop-filter`**, `will-change` cleared at idle, `absolute` not `fixed`). Per-skin wipe = the `theme.transition` token (iris/wave/zoom/leaves + a flat `fade` default in `buildTheme`); reduced-motion → fast opaque fade or plain navigate. The shared animated `BackButton` (reverses the wipe) replaces the old per-screen back `IconButton`s in `GameSelectionLayout`/`GameShell`. Menu liveliness primitives: `LivingCard`/`useLivingCard` (CSS idle-breathe + framer tap-squash, on separate nested layers so transforms don't fight), shared `ThemedBurst` (also consumed by `ThemeMascot`), `GameTileIcon` (soft-3D-styled, registry-ready), `useIdleAttract` (after ~8s idle: mascot beckon + one card wiggle). **Visible bloom**: `PersistentWorld` reads `bloomFor(section)` for the current route → adds ambient objects scaling with stage/fill (home reflects the best across sections). Raw `navigate()` bypasses the wipe — only NotFound / `RoundResultScreen` do that intentionally.
- **Delivery / caching** (PRD-07): `vercel.json` applies **all** matching header rules, and for a duplicate key the **last** matching entry wins — so the `/(.*)` `no-store` catch-all is overridden by more-specific rules placed **after** it (`/assets` + `/sounds/tts/` immutable; `/sounds/(.*)`, images, `manifest.json`, `da-DK.pls` = 1-day). Keep the immutable `/sounds/tts/` rule **after** the general `/sounds/` one, and keep **HTML uncached** so deploys are picked up (verify prod with `curl -I`, not local dev — Vercel headers don't apply in dev). First-paint JS is split in `vite.config.ts` `manualChunks`: `media-vendor` = **howler only** (eager via `sfxClient`) — don't co-bundle lazy-only libs with it (react-confetti rides the lazy `CelebrationEffect`/`StickerReveal` chunk). Adult dialogs (`VoiceOverridePanel`/`BugReportDialog`/`DifficultyPanel`) are `React.lazy` in `AdultCorner` so they stay off first paint.
- **PWA / stability** (PRD-08): Network-only, **no service worker** — `main.tsx` runs a one-time legacy-SW unregister + cache sweep (`utils/swCleanup.ts`) for clients from an older SW era. Exactly one manifest: hand-authored `public/manifest.json` (linked in `index.html`) — keep its `theme_color`/`background_color` consistent with the `theme-color` meta in `index.html`, and `orientation: any` (landscape-first design). Lazy routes are wrapped in `lazyWithReload` (`utils/lazyWithReload.ts`): a stale-chunk/dynamic-import failure after a deploy triggers a single `location.reload()` (sessionStorage-guarded against loops) instead of crashing into `AppErrorBoundary`. `progressStore` flushes synchronously on `pagehide`/`visibilitychange:hidden` (survives a fast PWA swipe-away) and re-hydrates from a cross-tab `storage` event (last-writer-wins). The persistent parallax scene freezes (rAF stopped + ambient CSS `animation-play-state: paused`) on game routes (`scene/routeKind.ts`), on top of the existing `prefers-reduced-motion` gate.
- **Adult tools / bug reports**: the **"Til de voksne" corner button** (`AdultCorner`, mounted globally in `App.tsx`, bottom-right, hold ~2s to open — plain tap just wiggles; dev-only `?adult-tap=1` makes a plain tap open it for headless tests) consolidates all parent-facing tools: 🐞 bug reporter, 🎙️ voice override panel, 🔊 SFX toggle, ♻️ gated progress reset, and the version/build footer (the old floating mic icon + version chip were removed). **Bug reporting**: `diagnosticsBuffer` (`src/services/diagnosticsBuffer.ts`, installed as the FIRST import in `main.tsx`) always records rings of console lines (300), network calls (100) and route/tap breadcrumbs (60); opening the menu captures a **screenshot** (snapdom, before the menu renders); "Rapportér et problem" → `bugReporter.buildReportPayload()` (build info, device, audio health incl. TTS circuit-breaker + permission snapshot, progress state, diagnostics rings) → POST `/api/bug-report` → **Vercel Blob** (`bug-reports/<date>/<ID>/report.json` + `screenshot.jpg`) → short code (e.g. `R7K3F`) shown to the adult; offline/failure → "Gem som fil" downloads the same JSON. **Crashes auto-upload** slim reports (no screenshot): window `error`/`unhandledrejection` hooks + the global `AppErrorBoundary` (kid-friendly "Ups!" + reload; `?crash-test=1` throws on purpose), deduped by signature, max 3/session. Locally `dev-server.js` mirrors the endpoint to a gitignored `.bug-reports/` folder — the whole flow works without Blob. Retrieval: the `/debug-report` skill (`.claude/skills/debug-report/`).
- **API endpoints**: the `api/*.ts` Vercel functions (paid TTS/STT proxies + bug-report storage) are a trust boundary — scoped CORS + origin allow-list + per-IP rate limit + no error-detail leaks, all via `lib/server-utils.ts`, and **mirrored in `dev-server.js`**. See `.claude/rules/api-endpoints.md`.

## UI reference

**Screenshots** of every view (iPad + phone + overlays) live in `docs/ui-reference/` (see its README) — the baseline for UI/UX polish work; re-capture after visual changes.

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
