# Børnelæring - Danish Preschool Learning App

Danish educational web app for children aged 3-7. Alphabet, math, colors, and memory games with native Danish audio narration.

## Tech Stack

- React 19 + TypeScript, Vite 8, Material-UI v9 (no Tailwind)
- Framer Motion for animations, Howler.js for sound effects
- Audio: `SimplifiedAudioController` singleton → `ttsClient` playback engine → **Azure AI Speech** (single TTS provider) → Web Speech API (fallback) → Howler (SFX). Danish da-DK voice (Christel) for most sections; Azure en-US Ava (multilingual) for the Engelsk section. The mic-icon VoiceOverridePanel can swap the Danish narration voice live among all Azure VoiceLab voices. Danish pronunciation is corrected via a hosted W3C PLS lexicon (`public/da-DK.pls`) + inline IPA. (Google TTS was removed in the Audio v2 rebuild; Google STT still powers "Sig et Ord".)
- Speech input (Sig et Ord): Google Cloud Speech-to-Text v2 via `/api/stt` + `useSpeechInput` hook
- React Router DOM v7 (route components lazy-loaded), Vite PWA Plugin
- Deployment: Vercel (auto-deploy on push to `master`)

## Commands

```
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build
npm run lint         # ESLint
npm run preview      # Preview production build
git push origin master  # Deploy to production (Vercel)
```

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
/album                   Sticker album / reward hub (shared collection)
```

URL utilities in `src/utils/urlParams.ts`. All features must use URL routing with bookmarkable, deep-linkable URLs.

## Key Architecture

- **Audio**: Centralized `SimplifiedAudioController` singleton (single audio at a time — new audio cancels current; **no queue**). See `.claude/rules/audio-system.md` for mandatory rules.
- **Games**: Two patterns - task-based (quiz) and learning-based (exploration). Most quizzes are thin configs over `UnifiedQuizGame`. See `.claude/rules/game-development.md`.
- **Layout**: Full-viewport, no-scroll game layouts. See `.claude/rules/responsive-design.md`.
- **Theming**: Fully token-driven. Each theme (skin) = one `ThemeTokens` object in `src/theme/tokens/*.tokens.ts`; `buildTheme(tokens)` maps it onto the MUI theme and attaches `theme.categories` / `theme.decor` / `theme.customShadows`. No styling values are hardcoded in components — read them via `useTheme()` or `getCategoryTheme(id)`. The active skin is chosen at runtime via the front-page **ThemeSelector** (`AppThemeProvider` in `src/theme/ThemeProvider.tsx`, persisted to `localStorage`). Ships 6 themes: Regnbue (default), Havet, Rummet, Junglen, Slikland, Dinosaurer. **Educational colors are NOT themeable** — Farvejagt/RamFarven color content stays as data. See "Adding a theme" below.
- **State**: Local React state only, no global state management — EXCEPT persistent progress (below).
- **Math games** (Game Experience Overhaul): the five task games run **bounded rounds of 8** with the global sticker pool. Math `gameId`s: `math.counting`, `math.addition`, `math.subtraction`, `math.comparison`, `math.patterns`. Tal Quiz / Plus / Minus use **near-number distractors** (digit-swap, off-by-one/ten) instead of random. Sammenlign Tal is "tap the bigger number → krokodille >/< mouth eats it" (equality dropped). Lær Tal is a calm 1–100 browse that earns session-local exploration-milestone stickers (every 12 distinct taps) — no challenge mode.
- **Alphabet games** (Game Experience Overhaul): Bogstav Quiz (`alphabet.quiz`, bounded rounds of 8, global pool) is **all word-association** — show a picture, tap the letter the word starts with (the trivial "hør bogstavet" recognition mode was removed); distractors stay random (Q/W/X never the answer, only distractors). Lær Alfabetet is a calm A–Å browse that earns session-local exploration-milestone stickers (every 9 distinct taps, mirroring Lær Tal) — no challenge mode.
- **Ordleg games** (Game Experience Overhaul): all three run **bounded rounds of 8** (3★=0 / 2★≤2) with the global sticker pool, ending on `RoundResultScreen`. Læs Ordet (`ordleg.read`) is a thin `UnifiedQuizGame` round config — still **never reads the prompt word aloud** (silent decoding is the exercise), no hints. Stav Ordet (`ordleg.spelling`) is hand-rolled: wrong letter = `wrong` SFX + shake, and after **2 wrong taps on a slot** the correct tile pulses (never-fail **next-letter hint**, reduced-motion → static glow; using it costs a star). Sig et Ord (`ordleg.mic`) stays **open-ended** — say any word → spelled back; **no target word, no STT grading**; a recognized word = 1/8 (`OrdlegScoreChip` shows the count), an STT mishear stays on the same question without counting and only breaks first-try.
- **English games** (Game Experience Overhaul): the three quizzes run **bounded rounds of 8** (3★=0 / 2★≤2) with the global sticker pool, ending on `RoundResultScreen` — they are thin `UnifiedQuizGame` round configs (`english.listen`, `english.word`, `english.translate`). Distractors stay **random** and themes stay **mixed** (no minimal-pairs, no per-theme rounds — deliberate beginner floor); the green `EnglishRepeatButton` is the only audio affordance (no "audio playing" cue). Lær Engelsk is a calm browse that earns session-local exploration-milestone stickers (every 9 distinct words tapped, mirroring Lær Alfabetet) — no challenge mode.
- **Farver games** (Game Experience Overhaul): both drag games are hand-rolled (dnd-kit) and now wire onto the Foundation round/reward system (global sticker pool, ending on `RoundResultScreen`). Farvejagt (`colors.farvejagt`) runs a **round = 5 boards** (each fully-collected board = 1 question); boards are calmer (~12 items — 5-6 targets + **1** distractor per other color), items **scatter-in**, a correct drop **snaps+pops into a tidy ring** inside the target circle (`drop-snap` SFX + spoken "{objektet} er {farve}") with a **pip progress ring** around the circle, a wrong drop bounces back + `wrong` SFX, and after **2 wrong drops** an uncollected target **pulses** (never-fail hint, costs a star); board-complete spins the ring before advancing. Ram Farven (`colors.ramfarven`) runs a **round = 8 mixes**; two droplets **swirl/blend** into the pot over ~600ms (`drop-snap`), a correct mix shows a **recipe reveal** (🔴+🔵=🟣 + spoken "rød og blå bliver lilla"), a wrong mix briefly shows the wrong color + `wrong` SFX + "Den blev …, prøv igen" then fizzes out, a **Tøm** button empties a mis-dragged pot, and after **2 wrong mixes** the 2 correct droplets pulse (hint, costs a star). Both run 3★=0 / 2★≤2, use `celebrateTier` (not legacy `celebrate`), show round progress via `ColorProgressChip`, and route all **chrome** through tokens (`getCategoryTheme('colors')` + `useTheme()`) — **educational color hexes stay as data** (the `DroppableZone` hover tint is now neutral/overridable so it never forces red on non-red targets). Reduced motion degrades all juice to instant/static; SFX + spoken reinforcement + reward still land. **The section now has 5 games** (challenge expansion): all educational color content (objects, hunt targets, per-hue shade families, swatches) lives in one source — `src/config/colorContent.ts` (NOT themeable). Ram Farven's recipe set was deepened to **9 targets** (added tints/shades `lysegul`, `mørkerød`, `mørkeblå` — still 2-droplet, mechanic unchanged). **Lær Farver** (`/farver/laer`) is a calm browse (tap a color → name + shade trio + example objects; exploration-milestone stickers every 9 distinct taps, mirroring Lær Tal). **Hvilken Farve?** (`colors.quiz`, `/farver/quiz`) is hand-rolled (dnd-kit) — **drag the object onto the matching color** (4 color-swatch drop zones); wrong color bounces back + `wrong` SFX, after 2 wrong the correct color pulses (hint costs a star); bounded round of 8. **Nuancer** (`colors.nuancer`, `/farver/nuancer`) is hand-rolled (dnd-kit): **drag** 3 shades of one hue into slots **light→dark** (left=lightest); wrong slot bounces back + `wrong` SFX + shake, after 2 wrong drops the correct tile for the next empty slot pulses (hint costs a star), bounded round of 8, 3★=0/2★≤2. **All five Farver games are now drag-based** except the calm Lær Farver browse (tap-to-hear).
- **Memory games** (Game Experience Overhaul): one engine (`UnifiedMemoryGame.tsx`) + a config factory (`MemoryGame.tsx`) now power **four** games — letters/numbers × **10-pair / 20-pair** — as **separate routes** (`/learning/memory/:type/:size`, static difficulty, not an in-game picker), reached from the Alfabetet + Tal menus as **"Hukommelse 10" / "Hukommelse 20"** (🧠). gameIds: `memory.letters.10/.20`, `memory.numbers.10/.20`. **One board = one round** (no `useRound` — Memory always finds every pair, so the only skill signal is mismatched turns): completing the board ends on `RoundResultScreen`. Scoring maps with **zero Foundation change** — `recordRoundResult(gameId, { correct: boardPairs, total: boardPairs + mismatches, longestStreak })`, so `mistakes = mismatches` → **stars scale with mismatches** (10-pair `{three:6,two:14}`, 20-pair `{three:14,two:30}`; always ≥1) and **longest match-streak** is the "Længste stime" record. Juice: `sfx.play('flip')` on each reveal, `celebrateTier('micro')` + a match **pop** on a pair, `celebrateTier('streak')` every 3rd consecutive match (not on the final pair), gentle `sfx.play('wrong')` on a mismatch. Global sticker pool. Cards uplifted to the `AnswerTile` depth language (token-driven via `useTheme()` + `darken`/`hexToRgba` — no hardcoded colors; matched = success glow), board-size-aware grid columns, pairs-remaining chip (`Par: X/P` via `customLabel`), reduced-motion drops the pop but keeps flips + colour/glow.
- **Progress / rewards** (Game Experience Overhaul foundation): `progressStore` singleton (`src/services/progressStore.ts`, localStorage key `bornelaering-progress`, versioned + private-mode-safe) is the single source of truth for persistent single-profile progress — collected stickers, per-game bests (longest streak / best stars / best count), lifetime stars. Read it via `useProgress()` (`src/hooks/useProgress.ts`, `useSyncExternalStore`). Task quizzes run **bounded rounds** (`useRound`, default 8 questions, no timer; wrong answers don't punish, only break a question's first-try flag) and end on `RoundResultScreen` (stars → "Ny rekord!" ribbon → streak → `StickerReveal` → replay/album/back). `UnifiedQuizGame` opts in via an optional `round` + `gameId` config (absent → endless behavior). The **sticker album** (`/album`, `StickerAlbum`) is the shared collection; sets/stickers are data in `src/config/stickers.ts` (emoji-based, app-wide pool). A child-resistant parent reset lives behind a 3s hold on the home version label → a "Kun for voksne" gate (type 3 digits shown as Danish words, e.g. "fem · to · fire") → `progressStore.resetAll()`; a wrong/cancelled gate resets nothing.
- **SFX**: `sfx` singleton (`src/services/sfxClient.ts`, Howler) is a SEPARATE short channel from TTS — it never cancels/queues against narration. Cues live in `public/sounds/ui/*` (curated from the mascot packs). Mute respects `progressStore.settings.sfxEnabled`. NEVER route SFX through `SimplifiedAudioController`. Celebrations escalate by **tier** via `useCelebration().celebrateTier(tier)` (micro/streak/round/best/sticker/page → confetti + matching SFX); the legacy `celebrate(intensity)` still works.
- **Routing**: React Router v7 in `App.tsx` (lazy-loaded route components), `useNavigate()` for navigation, NavigationAudioCleanup for audio cleanup on route changes.
- **PWA**: Network-only strategy (no offline caching), auto-generated service worker.

## Project Structure

```
src/
  components/
    common/          SimplifiedAudioPermission, GameSelectionLayout, GameHeader, UnifiedQuizGame, LearningGrid, RepeatButton, ScoreChip, CelebrationEffect (+ tiers), RoundResultScreen, StickerReveal, AnswerTile, balloon/
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
  services/          ttsClient.ts (Azure playback engine), progressStore.ts (persistent progress singleton), sfxClient.ts (SFX channel)
  config/            categoryThemes.ts (section content + token-backed colors), stickers.ts (album sets/data), englishVocab.ts, version.ts
  theme/             tokens/ (types.ts, helpers.ts, <skin>.tokens.ts), buildTheme.ts, themes.ts (registry), ThemeProvider.tsx
  api/               tts-azure.ts, stt.ts, log-error.ts, version.ts  (Vercel serverless; mirror dev-server.js; shared Azure core in shared-azure-tts.js + helpers in lib/server-utils.ts)
  App.tsx            Router + SimplifiedAudioProvider + NavigationAudioCleanup
```

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

## Conventions

- camelCase variables, PascalCase components
- TypeScript strict mode
- Feature-based file organization
- Comic Sans MS for child-facing typography
- Danish language for all user-facing content
- Minimum 44px touch targets
