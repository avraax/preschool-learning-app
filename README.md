# Børnelæring

A Danish-language learning app for a **5–7-year-old pre-reader** — letters, numbers, colours, first
English words and word games, with native Danish voice narration. Built iPad-first, installable as a
PWA, deployed on Vercel.

Because the child can't read yet, everything important is **spoken**, nothing is lost by a wrong
answer (there is no timer and no failure state), and after two wrong taps the correct answer pulses so
a child can never get stuck. Difficulty is static and set by a parent — adaptive difficulty is a
deliberate non-goal.

**Production:** https://preschool-learning-app.vercel.app/

## Sections

| Section | Games |
|---|---|
| **Alfabetet** | Lær Alfabetet · Bogstav Quiz · Hukommelse 10 / 20 |
| **Tal og Regning** | Lær Tal · Tal Quiz · Plus · Minus · Sammenlign Tal · Hvad Mangler? · Hukommelse 10 / 20 |
| **Farver** | Lær Farver · Farvejagt · Hvilken Farve? · Ram Farven · Nuancer (all drag-and-drop) |
| **Engelsk** | Lyt og Find · Find det Engelske Ord · Lær Engelsk |
| **Ordleg** | Læs Ordet · Stav Ordet · Sig et Ord (the child speaks into the mic; the app spells the word back) |

Progress is one unified **reward book** (`/album`): a fixed path of collectible rewards in themed
chapters, previewed as a silhouette in the ring so the child always sees what they're working toward.

Other surfaces: 4 selectable themed worlds with parallax scenes, per-world music and a reacting
mascot; a family account (one adult login, several child profiles with separate synced progress); and
PIN-gated parent tools — difficulty, voice, theme, sound, and a bug reporter.

## Getting started

Requires **Node.js ≥ 22.18** (`npm test` relies on native type-stripping).

```powershell
npm install
npm run dev          # http://localhost:5173
npm run dev:api      # API/auth/TTS proxy — needed for narration and sign-in
```

Run **both** dev servers in Windows PowerShell, not WSL — launching Vite from WSL makes every `/api`
call 502.

## Commands

See the **Commands** section of [CLAUDE.md](./CLAUDE.md) for the full list, including the TTS prebake
and narration-audit flow. The common ones:

```powershell
npm run build        # tsc + Vite production build
npm run lint         # ESLint
npm test             # node --test
npm run preview      # preview the production build
```

## Deployment

**Auto-deploys on push to `master`** — that push is the release. There is no manual deploy script.

## Stack

React 19 + TypeScript, Vite 8, **Material-UI v9 (no Tailwind)**, Framer Motion, Howler.js for SFX.
Narration is **Azure AI Speech** (single TTS provider, Danish `da-DK`), pre-baked to MP3 for the closed
phrase set with Web Speech API as fallback; speech input is Google Cloud STT. React Router v7.
**Every shipped audio file is MP3** — the compatibility floor is iOS/iPadOS 17, which cannot decode Ogg.

## Working on this codebase

> **Read [CLAUDE.md](./CLAUDE.md) first.** It is the maintained source of truth for architecture, and
> the audio, games, layout, drag-and-drop, auth and asset subsystems each have mandatory rules in
> [`.claude/rules/`](./.claude/rules/). Several of them encode gotchas that have already broken
> production once.
>
> This README is deliberately thin and **must stay that way** — an earlier version restated the
> architecture and rotted into advertising Tailwind, Google TTS and a deploy script that no longer
> exists. Describe *what the app is* here; link, don't duplicate, for *how it works*.

Screenshots of every view live in [`docs/ui-reference/`](./docs/ui-reference/) — the baseline for
UI/UX polish work.

## Conventions

Danish for all user-facing copy · Comic Sans MS for child-facing type · minimum 44px touch targets ·
TypeScript strict · full-viewport, no-scroll game layouts.
