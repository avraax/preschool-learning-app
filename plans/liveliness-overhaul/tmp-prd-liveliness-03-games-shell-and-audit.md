# Liveliness PRD — Game Shell Entry/Exit + Per-Game Audit

**Date:** 2026-07-15
**Part of:** Liveliness & Journey Overhaul (see `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md`).
**Depends on:** PRD-01 (level-up ceremony/handoff) and PRD-02 (`<BackButton>`, transition system, nav SFX).

This PRD has **two phases** that ship in separate sessions:
- **Phase A — Shared shell** (one session): the "Er du klar?" game-entry beat + unifying the in-game shell's
  interaction language (back button, mascot presence, celebration/level-up hooks) once, in `GameShell`.
- **Phase B — Per-area audit** (one session PER area): apply a checklist to align each area's games. Order:
  alphabet → math → farver → english → ordleg → memory. Mirrors the games-overhaul area cadence.

---

## Context

After PRD-01/02, the menus and progression feel alive but the **inside of games** still starts abruptly (no
"get ready" beat) and each game's shell details drift (two back-button styles, uneven mascot/celebration
wiring). The owner chose to **audit each game** so the whole app reads as one lively world — **without
rewriting game logic**. This PRD standardizes the shell and defines the alignment checklist.

**Success looks like:** every game opens with a short, skippable mascot "Er du klar? … Kør!"; every game has the
same friendly back button, a present reactive mascot, and correct celebration/level-up hooks; and moving between
any two games feels consistent.

---

## Guardrails (from roadmap, repeated for self-containment)

- iPad-first, no-scroll, 44px+, Danish, Comic Sans MS, token-driven, reduced-motion (keep audio/reward, drop
  motion), one TTS at a time + separate SFX channel, no adaptive difficulty.
- **Do NOT rewrite game mechanics** — this is shell + interaction-language alignment only. Content/mechanic
  reworks belong to the `games-overhaul` program, not here.
- Farver drag games obey `.claude/rules/drag-and-drop.md` (kidCollision, spring-back, advance-guard, etc.).

---

## Verified grounding (current code)

- `GameShell.tsx` (~227 lines) is the shared in-game scaffold: transparent-for-immersive backdrop (world shows
  through blurred/dimmed) or section gradient for flat; header with a static back `IconButton` (→ `backRoute`)
  + `score` slot; one-shot title entrance; optional `promptStage` 3-zone body; corner `Mascot` (bus-driven);
  `CelebrationEffect`. It bridges a legacy `guideReaction` prop onto `mascotBus` (`cheer`→`correct`,
  `think`→`wrong`) at ~lines 65–68.
- **Game entry today:** no countdown/intro. UI renders immediately, a spoken welcome plays
  (`audio.playGameWelcome(type)`, strings in `GAME_WELCOME_MESSAGES`), then after an iOS-tuned delay a
  `gameReady` flag unlocks interaction and the first question generates. Games optionally
  `mascotBus.emit('welcome')`.
- `RoundResultScreen` handles round exit + (after PRD-01) the XP-meter beat + level-up handoff.
- `UnifiedQuizGame` / `UnifiedMemoryGame` are the config-driven engines most games build on; both consume
  `GameShell` + `celebrateTier` + `mascotBus`.
- Sections + routes (from `App.tsx`): alphabet (`/alphabet/learn`, `/alphabet/quiz`), math
  (`/math/counting|numbers|addition|subtraction|comparison|patterns`), farver
  (`/farver/laer|jagt|quiz|ram-farven|nuancer`), english (`/english/listen|word|translate|learn`), ordleg
  (`/ordleg/read|spelling|mic`), memory (`/learning/memory/:type/:size`).

---

## Phase A — Shared shell (one session)

### A1. Game-entry "Er du klar?" beat

A short, **skippable**, mascot-presents moment before the first question. Implemented **once in `GameShell`**
(or a small `<GameIntro/>` it renders) so every game inherits it — no per-game code.

- **Trigger:** on game mount, before `gameReady` unlocks. Gate behind a new optional `GameShell` prop
  `intro?: boolean` (default `true`; a game can opt out, e.g. calm browse screens set `intro={false}`).
- **Visual (~1–1.5s):** the corner `Mascot` (or an enlarged intro pose) does a cheerful gesture; a light
  "Er du klar?" title flourish, then "Kør!" as it dismisses and the board comes alive. Reuse `mascotBus` (emit
  `welcome`) + a framer beat; no heavy new art.
- **Audio:** keep the existing spoken welcome (`playGameWelcome`) — the beat is timed so the welcome line and the
  "Kør!" dismissal feel intentional together (audio-led, as today), not a silent countdown.
- **Skippable:** a tap anywhere during the beat fast-forwards to `gameReady` (reuse RoundResultScreen's
  tap-to-fast-forward pattern — a ref set synchronously, checked before scheduling).
- **Reduced-motion:** no visual beat; the spoken welcome + instant `gameReady` (today's behavior) — i.e. the
  intro is purely additive and disappears under reduced motion.
- **Interaction-lock safety:** the beat must not delay the existing iOS audio-unlock/`gameReady` timing in a way
  that breaks first-tap responsiveness — the skip tap must both dismiss the beat AND satisfy the unlock. Verify
  on device.

### A2. Unify the shell interaction language

- **Back button:** replace `GameShell`'s static back `IconButton` with the shared `<BackButton variant="game"
  to={backRoute} />` from PRD-02 (reverse themed wipe + `back` SFX). One consistent affordance app-wide.
- **Mascot presence:** ensure every game routes reactions through `mascotBus` (the `guideReaction` bridge stays
  for legacy callers). Document the canonical events (`welcome|correct|wrong|streak|round|hint|sticker`) so the
  audit can check each game emits the right ones.
- **Celebration + level-up:** confirm each game uses `celebrateTier(...)` (not the legacy `celebrate`) and that
  round games flow through `RoundResultScreen` so the PRD-01 XP meter + level-up handoff fire. Browse games call
  `grantXp(section, 6, 'browse-milestone')` at their milestone (PRD-01).
- **Entrance:** the `GameShell` title/body entrance stays, but is coordinated with the intro beat so they don't
  double-animate.

### A3. Files to touch (Phase A)
- `src/components/common/GameShell.tsx` — `intro` prop + entry beat (or `<GameIntro/>`), `<BackButton>`,
  coordinate entrance.
- `src/components/common/GameIntro.tsx` (optional new) — the "Er du klar?" beat.
- Verify `UnifiedQuizGame` / `UnifiedMemoryGame` pass through cleanly (no per-game change expected).

---

## Phase B — Per-area audit (one session per area)

For each area, run the **audit checklist** against every game and fix drift. **No mechanic changes.**

### Audit checklist (apply to each game)
1. **Entry beat** present (or intentionally `intro={false}` for calm browse) and skippable.
2. **Back button** is the shared `<BackButton>` (no bespoke `IconButton`).
3. **Navigation** into/out uses the transition system (games are reached via PRD-02 wiring; verify no raw
   `navigate()` bypasses the wipe from within the game).
4. **Mascot** reacts via `mascotBus` to correct/wrong/streak/round; `welcome` on entry.
5. **SFX** fire the right cues (`correct`/`wrong`/`match`/`chomp`/etc.) — no missing feedback on taps/drops.
6. **Celebration** uses `celebrateTier`; round games end on `RoundResultScreen` (→ XP meter + level-up).
7. **Browse games** grant browse-milestone XP (PRD-01) and expose exploration stickers.
8. **Reduced-motion** path verified (audio/reward kept, motion dropped).
9. **No-scroll / 44px / token-driven** still hold on the touched surfaces.
10. **Living feel:** idle/tap micro-feedback consistent with menus where it makes sense (e.g. tappable tiles
    squash) — without interfering with gameplay (esp. Farver drag: obey drag-and-drop rules).

### Per-area notes (starting warmth — not final scope)

- **Alphabet** (`/alphabet/learn`, `/alphabet/quiz`): quiz → confirm round + RoundResultScreen + XP; learn →
  browse-milestone XP + intro opt-out.
- **Math** (`counting|numbers|addition|subtraction|comparison|patterns`): the richest set; verify every quiz
  variant flows through the shared shell + entry beat; `numbers` is a browse.
- **Farver** (`laer|jagt|quiz|ram-farven|nuancer`): drag games — **do not touch collision/spring-back**; only
  add shell/entry/back/celebration alignment. `laer` is a browse.
- **English** (`listen|word|translate|learn`): shared-engine reuse; `learn` is a browse.
- **Ordleg** (`read|spelling|mic`): honor the owner constraint — **Læs Ordet must not read the prompt word
  aloud** (son can't spell yet); the mic game (`SpeakWordGame`) uses STT — verify the entry beat doesn't fight
  the mic permission/timing.
- **Memory** (`/learning/memory/:type/:size`): one board = one round; verify flip/match SFX + round result +
  entry beat.

### Files to touch (Phase B)
Per area: that area's game components (e.g. `src/components/alphabet/*`, `src/components/math/*`, etc.) — mostly
swapping to `<BackButton>`, confirming `celebrateTier`/`mascotBus`/`grantXp` usage, and passing `intro`
appropriately. Expect small, surgical edits; flag anything that would require a mechanic change as out of scope
(defer to `games-overhaul`).

---

## Danish copy
- Entry beat: "Er du klar?" → "Kør!" (both short, spoken + shown). Reuse existing `GAME_WELCOME_MESSAGES` for the
  per-game welcome line. If "Er du klar?"/"Kør!" are spoken, add them as a closed-set phrase + prebake + audition.

## Verification
- Phase A: `ui-screenshot` one quiz game + one browse — confirm the entry beat plays, is skippable, respects
  reduced-motion, and the shared back button reverses the wipe. Build + lint clean.
- Phase B (per area): drive each game in that area on an iPad viewport — run the checklist, confirm no console
  errors, no scroll, and (for Farver) run the drag-and-drop abort-probe + positive-control from the
  drag-and-drop rules. Build + lint clean. Commit per area.

## Embedded implementation reference (Appendix A)
- `GameShell` current props include `backRoute`, `score`, `promptStage`, `guideReaction` (legacy → bus bridge at
  ~65–68), title. Add `intro?: boolean` (default true).
- Entry today: `audio.playGameWelcome(type)` + a `gameReady` flag gate (iOS-tuned delay); games optionally
  `mascotBus.emit('welcome')`.
- `mascotBus` events: `welcome|idle|correct|wrong|streak|round|hint|sticker`.
- `celebrateTier(tier)` tiers (post-PRD-01): `micro|streak|round|best|sticker|page|levelup`.
- Round exit: `RoundResultScreen` (+ PRD-01 XP-meter beat + `levelUpBus` handoff).
- `<BackButton to variant='menu'|'game'>` from PRD-02.
- Fast-forward pattern to reuse for skip: a ref set synchronously on the trigger, checked at the top of the
  handler, cleared in per-question/entry setup (as in `RoundResultScreen` and the drag advance-guard).
