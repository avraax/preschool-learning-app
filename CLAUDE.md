# Børnelæring - Danish Preschool Learning App

Interactive web app teaching Danish children (ages 3-7) the alphabet, math, and colors through games with native Danish audio narration.

**Production**: https://preschool-learning-app.vercel.app

## Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite 5.2
- **UI**: Material-UI v7 (no Tailwind)
- **Animations**: Framer Motion
- **Audio**: SimplifiedAudioController + Google TTS + Web Speech API + Howler.js
- **Routing**: React Router DOM v7
- **Deployment**: Vercel

## Key Commands

```bash
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
.\deploy-with-version.ps1  # Production deployment (ONLY method)
```

## Routes

```
/                    Home
/alphabet            Alphabet selection
/alphabet/learn      Letter learning
/alphabet/quiz       Letter quiz
/math                Math selection
/math/counting       Counting game
/math/numbers        Number learning
/math/addition       Addition practice
/math/comparison     Number comparison
/farver              Colors selection
/farver/jagt         Color Hunt (Farvejagt)
/farver/ram-farven   Color Mixing (Ram Farven)
/memory              Memory card game
/admin/errors        Error dashboard
```

## Project Structure

```
src/
├── components/
│   ├── common/          # Shared UI (RepeatButton, LearningGrid, Logo, AudioPermission)
│   ├── alphabet/        # AlphabetGame, AlphabetLearning, AlphabetSelection
│   ├── math/            # MathGame, NumberLearning, AdditionGame, ComparisonGame, MathSelection
│   ├── farver/          # FarvejagtGame, RamFarvenGame, FarverSelection
│   ├── learning/        # MemoryGame
│   └── admin/           # ErrorDashboard
├── contexts/
│   └── SimplifiedAudioContext.tsx
├── hooks/
│   └── useSimplifiedAudio.ts
├── utils/
│   ├── SimplifiedAudioController.ts   # Central audio system
│   ├── entryAudioManager.ts           # Game entry audio coordination
│   ├── urlParams.ts                   # URL parameter utilities
│   └── deviceDetection.ts
├── services/
│   └── googleTTS.ts
├── config/
│   ├── categoryThemes.ts   # Theme colors per category
│   ├── danish-phrases.ts    # Danish text & number pronunciation
│   └── version.ts
├── App.tsx                  # Router + AudioProvider
└── main.tsx
```

## Rules & Guidelines

All detailed development rules are in `.claude/rules/`:
- **audio-system** — Use `useSimplifiedAudio()`, never bypass the controller
- **routing** — All features must use URL routing with deep linking
- **game-development** — No loading overlays, follow AlphabetGame pattern
- **responsive-layout** — Fill screen, no scrolling, 44px touch targets
- **deployment** — Only use `deploy-with-version.ps1` for production
- **code-style** — MUI v7, Framer Motion, TypeScript strict, Danish content
- **error-logging** — Use curl for production logs, never WebFetch
