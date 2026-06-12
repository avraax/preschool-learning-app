---
description: Code conventions and style rules
globs: src/**
---

# Code Style Rules

## Naming

- **Variables/functions**: camelCase
- **Components**: PascalCase
- **Files**: Feature-based organization

## Tech Stack (Do Not Deviate)

- **UI Framework**: Material-UI v7 (no Tailwind)
- **Animations**: Framer Motion
- **Routing**: React Router DOM v7
- **Language**: TypeScript strict mode
- **Build**: Vite

## Shared Configurations

Reuse existing shared configs — do not duplicate:
- `src/config/categoryThemes.ts` — color schemes per game category
- `src/config/version.ts` — build version tracking
- `src/config/danish-phrases.ts` — Danish text and number pronunciation
- `SimplifiedAudioController` — all audio management

## Guidelines

- Prefer editing existing files over creating new ones
- Check for existing patterns before creating new abstractions
- Keep components simple — local `useState` is fine, no global state library needed
- All content must be in Danish (text + audio)
- Target age group: 3-7 years old
