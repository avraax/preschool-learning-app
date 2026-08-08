# Børnelæring - Danish Preschool Learning App

Danish educational web app for children aged 5-7: alphabet, math, colours and memory games with native Danish narration.

## How to talk to the owner (applies to EVERY reply)

Short, plain, natural language. Answer first. A few sentences, not a report.

- **Don't explain reasoning he already agreed to**, don't estimate durations, don't recap the session.
- Name the command, the file, or the thing to tap — then stop.
- When he asks "in short", he means 3–5 sentences. A two-item question gets a two-item answer.
- Still say plainly what's broken or blocked, and flag real caveats — in a sentence, not a section.
- Keep the density where a future session is the reader: PRDs, commit messages, `.claude/rules`, this file.

This has been asked for three times (2026-08-01 ×2, 2026-08-04) and kept not sticking, because it only
lived in agent memory, which is advisory. It lives here now. Don't delete it, and don't let a long
research answer be the exception — the 2026-08-04 orientation question got ~10 paragraphs and the useful
version was three sentences.

## Tech Stack

- React 19 + TypeScript, Vite 8, Material-UI v9 (no Tailwind), build target pinned `['safari17','ios17']`
- Framer Motion for one-shot animation + gestures; continuous idle motion is CSS keyframes
- Audio: `SimplifiedAudioController` → `ttsClient` → **Azure AI Speech** (sole TTS provider) → Web Speech
  (fallback) → Howler (SFX). Danish da-DK Christel; en-US Ava for Engelsk. Pronunciation via a
  hosted W3C PLS lexicon (`public/da-DK.pls`).
- Speech input (Sig et Ord): Google Cloud STT v2 via `/api/stt` + `useSpeechInput`, recognizer
  **`eu/chirp_3`** — `short` returns zero results for a single isolated Danish word (measured)
- React Router DOM v7, routes lazy-loaded via `lazyWithReload`. One hand-authored PWA manifest
  (`public/manifest.json`); **no service worker** (network-only)

## Commands

```
npm run dev          # Dev server at http://localhost:5173
npm run build        # tsc + Vite build (rewrites src/config/version.ts — don't commit that churn)
npm run lint         # ESLint
npm test             # node --test, type-stripped; unit tests in src/**/*.test.ts + lib/**
npm run probe        # Session-context probe (plans/session-performance/)
npm run context:check  # Guardrail byte budget (also enforced by src/config/contextBudget.test.ts)
npm run tts:prebake  # Regenerate prebaked TTS (needs Azure creds; resumable). Commit its output.
npm run audit:check  # Narration guard: closed-set clips not signed off in docs/audit/
npm run audit:approve-all  # Owner bulk sign-off of the current narration set
git push origin master  # Deploy to production (Vercel)
```

**Relative imports carry an explicit extension:** `.ts` for the client/test graph, `.js` for anything a
**Vercel function** reaches (`api/`, `lib/`, and the `src/config` modules they pull) — Vercel compiles
each to a sibling `.js` and rewrites no specifiers, so `.ts` there is a production-only
`ERR_MODULE_NOT_FOUND`. "Reaches" is **transitive**. Run each plain-node entry after touching an
extension rather than reasoning about it. → `api-endpoints.md`.

**Prebaked TTS:** the closed narration set is synthesized once into `public/sounds/tts/` plus a committed
manifest, and `ttsClient` plays those before Azure. **Every line the app speaks is prebaked** except Sig
et Ord's read-back of an arbitrary spoken word. **Adding or changing any spoken line follows the 8-step
protocol in `audio-system.md`.**

## Routes

5 sections — `/alphabet` `/math` `/farver` `/english` `/ordleg` — each a menu + its games, plus `/album`,
`/learning/memory/:type/:size`, and off-menu `/voicelab` and `/audit`. Features use bookmarkable,
deep-linkable URLs (`src/utils/urlParams.ts`); routes are enumerated in `App.tsx`.

## Key Architecture

Each bullet is the rule that would cause a mistake if absent; the detail lives in the path-scoped rule it
points to, loaded when you touch matching files.

- **Audio**: one audio at a time — new audio cancels current, **no queue**. Audio unlocks on the first
  gesture anywhere; there is **no blocking permission modal**.
  → `audio-system.md` (engine), `audio-call-sites.md` (components).
- **SFX**: `sfx` (`src/services/sfxClient.ts`, Howler) is a separate short channel — never route SFX
  through `SimplifiedAudioController`. **All shipped audio is MP3, never Ogg/Opus**: Apple has no Ogg
  container before iPadOS 18.4, so Ogg silenced the 17.7 floor device. → `audio-system.md`.
- **Games**: task-based **quizzes** and calm **learning browses**, and **both are ENDLESS** — no round
  boundary, no "Færdig!", no stars, no bests. Both earn live per-task XP; the sticker ceremony fires
  **in-game at the seam**, the moment the ring fills. gameIds are `<section>.<game>`.
  → `games-catalog.md`, `game-development.md`.
- **In-game interaction**: one shared vocabulary, and **navigation always flows through the
  transition system — no raw `navigate()` from inside a game.** The header holds the **reward ring and
  nothing else**. → `game-development.md`.
- **Animation mechanism**: a continuous, stateless animation is a **CSS keyframe animation**
  (`src/theme/idleMotion.ts`), never a framer `repeat: Infinity` loop — 25 of those spent ~40% of every
  second recalculating style while the app sat still. **`content-visibility` is Safari 18 → banned**; it
  fails silently, so it looks right everywhere except the one device that matters.
  → `animation-and-performance.md`.
- **Layout**: full-viewport, no-scroll game layouts; reserve the space rather than tuning a percentage
  against content it doesn't know. → `responsive-design.md`.
- **Drag & drop / tap parity**: `@dnd-kit` via shared primitives in `src/components/common/dnd/`.
  **A game that accepts one gesture must accept both** — a 5-year-old taps — through **one** resolve
  function, and collision is **`kidCollision`, never `closestCenter`**. → `drag-and-drop.md`.
- **Theming**: token-driven — **no styling values hardcoded in components**. Two that look fine on the
  default skin and break the others: **`getCategoryTheme(id)`, never `categoryThemes[id]`**, and accent
  text on a white surface uses **`theme.onTileColor`**, never raw `accentColor`. → `theming.md`.
- **Scene & mascot & music**: a persistent parallax world renders behind every page; the mascot renders
  inside each page and reacts via `mascotBus`. **Progress shows in the world only as ambient density**,
  and nothing may be positioned by a tuned percentage against content it doesn't know.
  → `scene-and-world.md`, `scene-assets.md`.
- **Menus & navigation**: navigation goes through `useTransitionNav()` → an opaque wipe overlay, so the
  page swap happens fully covered; **raw `navigate()` bypasses it**. → `scene-and-world.md`.
- **State**: local React state only, no global state management — except persistent progress (below).
- **The Reward Book / progress**: **one track, one reward slot.** `progressStore` (per-child, schema v4,
  **inert until `profileStore.attach()`**) is the source of truth; everything else is derived in the pure
  `src/config/progression.ts`. `collectedFromLevel(level) = level - 1` is the mapping, never recomputed
  inline. `rewardNumber()` is the child-facing number: **never show `globalLevel()`**, and never as a
  distance. Rewards are granted **only by the ceremony**, and the ring is the only door to Min Bog. XP is
  never difficulty-dependent. → `rewards-and-progression.md`.
- **Difficulty** (static, manual — **no adaptivity by design**): a global Let/Normal/Svær plus optional
  per-section overrides, defined once in the pure `src/config/difficulty.ts`. **Verifying that a game
  reads its table is not verifying that the level is playable** — audit a level by sampling the
  generators, never by reading the table. A harder level must never cost rewards. → `games-catalog.md`.
- **PWA / delivery / the target device**: network-only, **no service worker** — so **never design a
  feature around "works offline"** (the native shell inverts this).
  **The compatibility floor is the child's device: an iPad Pro 2nd gen
  on iPadOS 17.7.11.** Check any new web/media API against **Safari 17**, not "latest Safari".
  → `pwa-and-device.md` (device record: `docs/device-testing.md`).
- **Adult tools / bug reports**: the "Til de voksne" corner button opens the lazy `AdultSettings`. Its
  group/item structure is **data** (`src/config/adultSettingsIa.ts`, guarded), and **every irreversible
  action is type-to-confirm** with a fixed Danish word — a PIN does not substitute. To debug a bug report
  use the `/debug-report` skill. → `adult-surface.md`.
- **Update banner**: a newer live build shows a **dismissible** pill; applying it is a PIN-gated
  adult-menu item, never a child-tappable reload.
- **Accounts / auth**: one adult account (Google OIDC + passkey) with N child profiles and local-first
  progress sync. **Guest play needs no account** — `AuthGate` gates sync, not play. `/api/tts-azure` +
  `/api/stt` need a 15-minute access JWT; `?nogate=1` bypasses both gates in DEV. → `auth.md`.
- **API endpoints**: the `api/*.ts` Vercel functions are a trust boundary — scoped CORS + origin
  allow-list + per-IP rate limit + no error-detail leaks, via `lib/server-utils.ts` and **mirrored in
  `dev-server.js`**. → `api-endpoints.md`.
- **Env & secrets**: a bare `vercel env pull` overwrites `.env.local` wholesale. → `env-and-secrets.md`.

## Verifying without the owner's iPad

Three rungs, and **a claim must name the rung it came from**: (1) headless Chrome, (2) real WebKit with
an iPad UA, (3) the owner's iPad — the residue: whether the Danish sounds right, real touch feel, true
iPadOS 17.7 behaviour. **Unverified is not broken; say UNKNOWN.** The ladder table, the probes, the
recipes and the DEV query params live in **`.claude/skills/ui-screenshot/`**; reach for it whenever the
work touches visible UI or audio. Screenshots of every view live in `docs/ui-reference/`.

## Conventions

- camelCase variables, PascalCase components; TypeScript strict mode; feature-based files; Comic Sans MS
  for child-facing typography; Danish for all user-facing content; 44px minimum touch targets
- **No emoji ships in the UI** — baked art on child-facing surfaces, `lucide-react` on adult/dev ones.
  They render in the OS font, so they change shape between the 17.7 floor device and a newer one.
  `src/config/noEmoji.test.ts` enforces it and **its allowlist is empty**; add art plus a coverage test
  instead of re-opening it.
- **Never edit a file with a shell text pipeline — use the Edit tool.** A PowerShell pipeline re-encodes
  the file and mojibakes every `æøå`; a `node -e`/heredoc patch command-substitutes any backtick in the
  replacement and silently drops what was inside it.
- **After fixing a bug, re-break the code to prove the new test actually fails.** A test seeded with the
  wrong *shape* stays green while the product is broken. The break must target what the test *measures*,
  and a guard that greps source must strip comments first. Use the `/re-break` skill.
- **Local green proves nothing about the deployed artifact.** Dev, `vite preview` and a local
  `vercel build` all read the working tree — `curl` the deployed URL or read the built output.
- **Another session may be working in this same tree.** Check `git log` as well as `git status` before
  touching an unexpected failure, commit your own work promptly rather than leaving it staged, and
  remember `master` is the deploy trigger.
- **A probe of an external service has three outcomes, not two** — a rate-limit, partial read or
  fail-closed 403 is UNKNOWN, never folded into a real verdict.

The incidents behind the last four bullets, the recovery steps and the full parallel-session hazard list
are in **`.claude/rules/working-in-this-tree.md`**.
