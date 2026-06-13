# Børnelæring - Danish Preschool Learning App

Danish educational web app for children aged 3-7. Alphabet, math, colors, and memory games with native Danish audio narration.

## Tech Stack

- React 19 + TypeScript, Vite 8, Material-UI v9 (no Tailwind)
- Framer Motion for animations, Howler.js for sound effects
- Audio: `SimplifiedAudioController` singleton → Google Cloud TTS (primary) → Web Speech API (fallback) → Howler (SFX). British en-GB voice for the Engelsk section.
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
/farver/jagt             Farvejagt (Color Hunt)
/farver/ram-farven       Ram Farven (Color Mixing)
/english                 English section menu
/english/listen          Lyt og Find (audio → picture)
/english/word            Find det Engelske Ord (picture → English word)
/english/translate       Dansk til Engelsk (Danish → English match)
/english/learn           Lær Engelsk (explore English words)
/ordleg                  Ordleg section menu
/ordleg/read             Læs Ordet (read word → pick picture)
/ordleg/spelling         Stav Ordet (moved from /alphabet/spelling)
/ordleg/mic              Sig et Ord (microphone speech game)
/learning/memory/:type   Memory card game (type = letters | numbers)
```

URL utilities in `src/utils/urlParams.ts`. All features must use URL routing with bookmarkable, deep-linkable URLs.

## Key Architecture

- **Audio**: Centralized `SimplifiedAudioController` singleton (single audio at a time — new audio cancels current; **no queue**). See `.claude/rules/audio-system.md` for mandatory rules.
- **Games**: Two patterns - task-based (quiz) and learning-based (exploration). Most quizzes are thin configs over `UnifiedQuizGame`. See `.claude/rules/game-development.md`.
- **Layout**: Full-viewport, no-scroll game layouts. See `.claude/rules/responsive-design.md`.
- **Theming**: Fully token-driven. Each theme (skin) = one `ThemeTokens` object in `src/theme/tokens/*.tokens.ts`; `buildTheme(tokens)` maps it onto the MUI theme and attaches `theme.categories` / `theme.decor` / `theme.customShadows`. No styling values are hardcoded in components — read them via `useTheme()` or `getCategoryTheme(id)`. The active skin is chosen at runtime via the front-page **ThemeSelector** (`AppThemeProvider` in `src/theme/ThemeProvider.tsx`, persisted to `localStorage`). Ships 6 themes: Regnbue (default), Havet, Rummet, Junglen, Slikland, Dinosaurer. **Educational colors are NOT themeable** — Farvejagt/RamFarven color content stays as data. See "Adding a theme" below.
- **State**: Local React state only, no global state management.
- **Routing**: React Router v7 in `App.tsx` (lazy-loaded route components), `useNavigate()` for navigation, NavigationAudioCleanup for audio cleanup on route changes.
- **PWA**: Network-only strategy (no offline caching), auto-generated service worker.

## Project Structure

```
src/
  components/
    common/          SimplifiedAudioPermission, GameSelectionLayout, GameHeader, UnifiedQuizGame, LearningGrid, RepeatButton, ScoreChip, CelebrationEffect, balloon/
    alphabet/        AlphabetGame, AlphabetLearning, AlphabetSelection
    math/            MathGame, NumberLearning, MathOperationGame (+/−), ComparisonGame, HvadManglerGame, MathSelection
    farver/          FarvejagtGame, RamFarvenGame, FarverSelection
    english/         EnglishSelection, EnglishListenGame, EnglishWordGame, EnglishTranslateGame, EnglishLearning
    ordleg/          OrdlegSelection, LaesOrdetGame, SpellingGame, SpeakWordGame (mic/STT)
    learning/        MemoryGame
  contexts/          SimplifiedAudioContext.tsx (audio permission + readiness state)
  hooks/             useSimplifiedAudio.ts (component audio interface), useSpeechInput.ts (mic capture)
  utils/             SimplifiedAudioController.ts, urlParams.ts, deviceDetection.ts, remoteConsole.ts
  services/          googleTTS.ts
  config/            categoryThemes.ts (section content + token-backed colors), englishVocab.ts, version.ts
  theme/             tokens/ (types.ts, helpers.ts, <skin>.tokens.ts), buildTheme.ts, themes.ts (registry), ThemeProvider.tsx
  api/               tts.ts, stt.ts, log-error.ts, version.ts  (Vercel serverless; mirror dev-server.js)
  App.tsx            Router + SimplifiedAudioProvider + NavigationAudioCleanup
```

## Adding a theme

1. Copy an existing `src/theme/tokens/<skin>.tokens.ts` (e.g. `ocean.tokens.ts`) to a new file, give it a unique `id`, a `name` + `selectorEmoji` (shown in the picker), and edit the colors. Use the `category()` / `gradient3()` / `neutralShadows()` helpers from `tokens/helpers.ts` so the structure matches other skins.
2. Each theme must give the 5 sections (alphabet/math/colors/english/ordleg) **distinct, readable accents**. Keep `success` green-ish and `error` red-ish (kids read green=correct / red=wrong). Section emojis stay constant across skins (`SECTION_ICONS`).
3. Register it: import and append to the `themes` array in `src/theme/themes.ts`. It appears in the front-page selector automatically. The default `kid` theme (`kidTheme.tokens.ts`) keeps hand-written exact values; don't refactor it.

## Production Logs

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
