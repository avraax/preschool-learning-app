# Liveliness & Journey Overhaul — Master Roadmap

**Date:** 2026-07-15
**Owner:** Allan (parent). **Target user:** one ~5-year-old boy (single-child, at-home, **iPad/tablet** primary). Knows all letters, counts to ~60–70, adds to 20 on fingers, basic subtraction, **cannot yet read/spell fluently** (pre-reader).
**Status:** Planning. This session produced this roadmap + the three PRDs below. Implementation happens in later, separate sessions (foundation first).

---

## Why this program exists (Context)

The app's **games** got a thorough overhaul (see `plans/games-overhaul/`), but the connective tissue —
the **menu pages, the navigation between them, and the flow into/out of games** — is still "boring standard".
Concretely:

- **Route transitions** are a bare 0.18s fade-in on the incoming page — no exit, no direction, no personality
  (`App.tsx` ~lines 631–639). Home→section→game feels like slides swapping.
- **Back buttons** are plain static `IconButton`s, styled *inconsistently* between the section-menu level
  (`rgba(255,255,255,0.2)`) and the game level (`rgba(255,255,255,0.8)` + blur).
- **No "get ready" beat** when a game starts — the UI just appears.
- **Menus go inert once loaded** — nothing invites a hesitant 5-year-old to tap.
- **No navigation SFX** — the world is silent as you move through it (cue vocabulary has `tap`/`flip` but no
  whoosh/menu/back cues).
- **Section tiles use flat emoji** while home cards use richer soft-3D icons — a visible inconsistency.
- **Progress is invisible between games** — effort in one game doesn't visibly accumulate into anything the
  child feels app-wide.

Meanwhile the app already owns a strong, **under-exploited** foundation to build on: an app-wide
**persistent parallax world** behind every page (never unmounts on nav), two reactive **mascots**
(`ThemeMascot` menu buddy + `Mascot` in-game), a tiered **celebration** system (`celebrateTier`),
a **SFX** channel (`sfxClient`), and card entrance/hover springs.

The goal: **far more liveliness, animation, and gamification** across these surfaces, plus a new
**cross-game progression/journey** layer, so the target audience stays engaged and keeps coming back.

### Direction decided with the owner (2026-07-15)

| Decision | Choice |
|---|---|
| Ambition | **Rich enhancement** — keep the home-grid + section-grid structure; make everything richly alive |
| Navigation model | **Enhanced card menus** — grid stays; the persistent world remains the backdrop (**NOT** a world-map) |
| Gamification depth | **Progression / journey** — the world visibly fills with life; a real, newly-persisted progression layer |
| Cross-game earning | **A global level that ramps up from playing ANY game** ("playing games rewards you in general"), on top of per-section world "bloom" |
| Locking content | **Never lock** — progression is purely rewarding; every game always playable |
| Progress source | **New "world life" metric** (per-section bloom) + the new global level (do NOT reuse the sticker/star economy as the driver) |
| Idle/attract loop | **Yes, gentle** — after ~8s idle, mascot gesture + one card wiggle; off under reduced-motion |
| Game-entry beat | **Mascot presents** — a short, skippable "Er du klar? … Kør!" |
| Level display (pre-reader) | **Number + visual** — a growing companion + filling ring AND a level-number badge |
| Level-up moment | **Big celebratory reveal** — confetti + mascot cheer + reward reveal + spoken Danish praise (reuse `celebrateTier`) |
| Route transitions | **Themed wipe per skin** (Havet=wave, Rummet=warp/zoom, Dinosaurer=leaf/stomp, Regnbue=rainbow iris) |
| Cross-game streamlining | **Audit each game too** — align the interaction language app-wide (shell first, then area-by-area) |
| Data migration | **Wiping already-earned rewards is acceptable** — keep the schema bump simple; no careful forward-migration |

---

## Program structure

```
plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md                 ← this file (index, order, template, guardrails)
plans/liveliness-overhaul/tmp-prd-liveliness-01-progression-foundation.md  ← shared progression layer (IMPLEMENT FIRST)
plans/liveliness-overhaul/tmp-prd-liveliness-02-menus-and-navigation.md    ← living menus, themed transitions, nav SFX, back button
plans/liveliness-overhaul/tmp-prd-liveliness-03-games-shell-and-audit.md   ← game-entry beat + unify shell + per-game audit
```

**PRD-01 is the keystone and must be implemented first.** It defines the global XP/level system, per-section
"bloom", the level-up ceremony, and the child-facing growth display. PRD-02's "visible bloom" and PRD-03's
level-up handoff both read the selectors PRD-01 exposes.

---

## Recommended order of work

Each item = one focused future session: **(clean) implement → verify on device → play-test with son**.
The two design-heavy PRDs (01, 02) already carry their full technical design inline, so their first sessions
are **implement** sessions, not design sessions.

1. **Progression foundation** (`-01-`) — implement first. Its headless layer (curves + store + hook + audio)
   can ship and be verified before any visual work.
2. **Menus & navigation** (`-02-`) — the biggest visible payoff (themed transitions, living cards, idle life,
   nav SFX, unified back button, visible bloom). Depends on `-01-` for `bloomFor()` / `globalLevel()`.
3. **Games shell + audit** (`-03-`) — the "Er du klar?" entry beat and one unified shell language, then an
   area-by-area audit (alphabet → math → farver → english → ordleg → memory). This PRD spawns several small
   implement sessions, like the games-overhaul cadence.

> Order is a recommendation, not a contract. Foundation stays #1 regardless (the others reference its API).

---

## Hard rule: every PRD must be self-contained

Implementation happens in a **fresh session with no memory of this planning work**. If a PRD forces that
session to re-explore the codebase, it will exhaust its context before building. Therefore every `-NN-` PRD
**MUST embed enough to implement with near-zero exploration**:

- **Verbatim current signatures** of every shared API it touches (interfaces, hook returns, component props),
  copied into an "Embedded implementation reference" appendix.
- **Exact integration points** as `file:line` (e.g. "replace the keyed `motion.div` at `App.tsx:634–639`").
- **Complete content/data** inline (full curve tables, Danish copy, cue lists, token shapes) — not "add some".
- **Named utilities to reuse** with their paths.
- A **verification** section the session can run as-is.

Treat the Appendix A of `plans/games-overhaul/tmp-prd-overhaul-01-foundation.md` as the quality bar.

## Standard PRD template

```markdown
# Liveliness PRD — <Area>

## Context
Why this surface is being reworked; what's boring today; what success looks like for the son.

## Current state
Files, current behavior, concrete weaknesses (cite file:line).

## Target experience
The redesigned behavior, described so a fresh session can build it. Explicit before/after. Note removals.

## Technical design
Architecture, data shapes, APIs, integration points (file:line), reuse of existing utilities.

## Danish copy
All child-facing strings, verbatim.

## Files to touch
New + modified files; utilities to reuse (named, with paths).

## Verification
End-to-end test on iPad (dev servers, routes, what to observe). Build/lint must pass.

## Embedded implementation reference (Appendix A)
Verbatim current signatures of every shared API touched.
```

---

## Execution guide — what to run, in what order

**Always start each session fresh** (`/clear` or a new session) so context isn't polluted. **Commit at the
end of every session** so the next clean session sees committed code.

### Step 0 — commit the planning output
```
Commit the new liveliness-overhaul planning docs under plans/liveliness-overhaul/. Branch off master first,
message describing the liveliness/journey overhaul program.
```

### Step 1 — IMPLEMENT the progression foundation (clean session)
```
Read plans/liveliness-overhaul/tmp-prd-liveliness-01-progression-foundation.md in full, plus the guardrails
in plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md. Implement it exactly: the pure curves module,
the progressStore `progression` slice (schema bump — wiping old progress is acceptable), grantXp + selectors,
useProgress additions, the speakLevelUp audio method (prebake + audition its phrases), the levelUpBus +
LevelUpOverlay + LevelUpWatcher, the 'levelup' celebration tier, the RoundResultScreen XP-meter beat + level-up
handoff, browse-milestone XP, and the home-page growing companion + level badge. Follow .claude/rules
(audio-system, game-development, responsive-design). Add unit tests for the curves. Run npm run build +
npm run lint, drive it on an iPad viewport with the ui-screenshot skill (force a level-up), and report.
Commit on a branch when green.
```

### Step 2 — IMPLEMENT menus & navigation (clean session)
```
Read plans/liveliness-overhaul/tmp-prd-liveliness-02-menus-and-navigation.md in full, plus the roadmap
guardrails and (for the bloomFor/globalLevel API it consumes) plans/liveliness-overhaul/tmp-prd-liveliness-01-progression-foundation.md.
Implement the transition system, per-theme wipes, mascot usher, living cards, idle attract, nav SFX, shared
BackButton, and visible bloom. OBEY the compositing-flicker rules in the PRD. Run npm run build + npm run lint,
verify a full home→section→game→back cycle with the ui-screenshot skill (confirm no white-flash regression),
and report. Commit on a branch when green.
```

### Step 3…N — game-entry beat, then per-area audit (clean sessions)
```
Read plans/liveliness-overhaul/tmp-prd-liveliness-03-games-shell-and-audit.md. First implement the shared
game-entry "Er du klar?" beat + unified shell (BackButton, mascot presence, celebration/level-up language) in
GameShell. Then, one AREA per later session (alphabet → math → farver → english → ordleg → memory), apply the
audit checklist to that area's games. Follow .claude/rules (drag-and-drop for Farver, audio everywhere). Verify
each area with ui-screenshot, build + lint clean, commit per area.
```

> After each implement session, **play-test with your son** before the next — what you learn feeds the next.

---

## Global guardrails (apply to every PRD in this program)

- **iPad-first**, fully responsive, **no-scroll full-viewport** (`.claude/rules/responsive-design.md`).
- **Danish** for all child-facing text. Comic Sans MS for child-facing type. **Min 44px touch targets.**
- **Token-driven theming only** — read via `useTheme()` / `getCategoryTheme(id)`; never hardcode. Educational
  colors (Farvejagt/RamFarven) stay as data. New surfaces render correctly in all registered skins (immersive
  **and** flat) and portrait + landscape.
- **Reduced-motion respected** on every new animation — motion is removed, but **reward + audio are kept**
  (existing `CelebrationEffect` / `RoundResultScreen` already read `prefers-reduced-motion`).
- **Audio rules** (`.claude/rules/audio-system.md`): one TTS at a time, no queue; SFX a separate short channel;
  new spoken phrases get a new controller method, are prebaked (`npm run tts:prebake`) + auditioned (`/audit`).
- **No adaptive difficulty** (standing constraint) — XP must **not** depend on the difficulty setting.
- **Compositing-flicker discipline** for all transition/scene work (opaque overlays, world layer untouched,
  no `backdrop-filter` on moving layers, `will-change` cleared at idle) — see PRD-02 §"Flicker rules".
- **Visual quality floor:** new surfaces match or exceed the current immersive 3D / mascot / themed-scene look
  (Principle 0 in `plans/games-overhaul/tmp-prd-overhaul-01-foundation.md`).

## Verification baseline (every implementation session)

- `npm run dev` + `npm run dev:api` (both in **Windows PowerShell** — never WSL, see project memory).
- `npm run build` and `npm run lint` clean.
- Drive on an iPad-sized viewport with the **`ui-screenshot`** skill; confirm layout + **no console errors**.
- Note the real-iOS-standalone-PWA check for anything touching transitions/scene (Chrome emulation catches
  most, but the fixed-layer/touch-pan behavior is device-specific).
