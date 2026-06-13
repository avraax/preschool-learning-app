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
- **Theming**: Centralized in `src/config/categoryThemes.ts` (alphabet=blue, math=purple, colors=orange, english=green, ordleg=teal).
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
  config/            categoryThemes.ts, englishVocab.ts, version.ts
  api/               tts.ts, stt.ts, log-error.ts, version.ts  (Vercel serverless; mirror dev-server.js)
  App.tsx            Router + SimplifiedAudioProvider + NavigationAudioCleanup
```

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
