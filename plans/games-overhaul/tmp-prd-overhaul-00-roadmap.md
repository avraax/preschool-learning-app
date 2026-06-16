# Game Experience Overhaul — Master Roadmap

**Date:** 2026-06-15
**Owner:** Allan (parent). **Target user:** one ~5-year-old boy (single-child, at-home, **iPad/tablet** primary). Knows all letters, counts to ~60–70, adds to 20 on fingers, basic subtraction, cannot yet read/spell fluently.
**Status:** Planning. This session produced the **Foundation PRD** (`plans/games-overhaul/tmp-prd-overhaul-01-foundation.md`) + this roadmap. Per-game PRDs are written in their own later sessions, one game at a time.

---

## Why this program exists (Context)

The app is functionally solid (resilient audio, responsive no-scroll layouts, tactile "lifted 3D" tiles, a 6-theme skin system with mascots and custom imagery). But across **all 18 game experiences** the same gaps recur:

- **Flat progression** — every round feels identical; nothing to finish, no sense of getting better.
- **Repetitive reward** — the same confetti burst every correct answer; it stops landing after a few minutes.
- **No memory** — score resets each session; effort doesn't accumulate into anything.
- **Thin "game feel"** — mostly TTS voice, very few sound effects; little moment-to-moment juice beyond the tile press.
- **Thin scaffolding** — no hints or encouragement when stuck.

The goal is a **thorough, game-by-game level-up** of gameplay, UI, UX and "juice", anchored to the 5-year-old — explicitly allowing new games, removed games, or changed mechanics, not just polish.

### Direction decided with the owner (2026-06-15)

| Decision | Choice |
|---|---|
| What "better" means | **All of:** juice & feel, motivation & progress, gameplay depth, learning clarity |
| Progression model | **Persist progress** (localStorage) **+ meta-rewards** |
| Reward flavor | **Collecting** + **beating his best** |
| The collectible | **Sticker album** (themed pages he fills + shows off) |
| Reward architecture | **One shared hub** — stars/stickers earned in any game feed one collection |
| Round structure | **Bounded rounds** (fixed set → result/reward screen) for task games |
| "His best" measures | **Longest streak**, **stars per round**, **personal-best count** — **no timers** |
| Sound | **Rich SFX** layer (formalize the existing Howler/SoundManager seed) |
| Lineup | **Fully open** to add / remove / merge / replace games |
| Difficulty | **Static, manually tuned** — NO adaptive difficulty, NO in-game level selection (standing constraint) |
| Visual quality floor | **Match or exceed** the current immersive 3D UI / theme / mascot / imagery quality on every new surface |

---

## Program structure

```
plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md      ← this file (index, order, PRD template)
plans/games-overhaul/tmp-prd-overhaul-01-foundation.md   ← shared systems EVERY game plugs into (DONE this session)
plans/games-overhaul/tmp-prd-overhaul-02-<area>.md  ← per-area deep-dive PRDs (future sessions)
...
```

**The Foundation PRD is the keystone and must be implemented first.** It defines the progress store, the sticker album + hub, the bounded-round + result-screen system, the SFX layer, and the celebration/juice tiers. Every per-game PRD assumes these exist and references them.

---

## Recommended order of work

Each item below = one focused future session: **deep-dive design discussion → write that PRD → (separate session) implement → verify on device.**

1. **Foundation** (`-01-`) — implement first. No game work lands well without it.
2. **Math** (`-02-`) — 6 games, the richest learning surface and where the son is most actively progressing (counting, +/−). Highest payoff; also the best proving ground for the round/reward system.
3. **Alphabet** (`-03-`) — 2 games. He knows all letters, so the lift here is phonics/word-association depth + reward, and turning free-exploration into something with a goal.
4. **Ordleg** (`-04-`) — 3 games (Læs Ordet, Stav Ordet, Sig et Ord). His emergent-reading frontier; the mic game is the likely favorite and deserves real investment.
5. **English** (`-05-`) — 4 games. Strong shared-engine reuse; mostly benefits from the foundation + better distractors/scaffolding.
6. **Farver** (`-06-`) — 2 drag games. Most bespoke; biggest juice opportunity (drag physics, snap, mixing animation). Save for when the SFX/juice system is mature.
7. **Memory** (`-07-`) — 1 engine, 2 variants. Self-contained; slots in anywhere after foundation.

> Order is a recommendation, not a contract — any area can jump the queue. Foundation stays #1 regardless.

---

## Per-game intent snapshot (carried into each deep-dive)

This captures what the inventory found so each future session starts warm. **Not final scope** — each game gets its own questioning round.

### Math (`-02-`)
- **Tal Quiz** (recognition 1–50): bounded rounds + stickers; tie wrong-distractors to **near numbers** (digit-swap, off-by-one/ten) so a correct tap is a real discrimination, not a lucky guess.
- **Lære Tal** (browse 1–100): turn passive poster into a game with a goal — e.g. "find the number" challenges, exploration stickers. Decide: keep endless-explore + add optional challenge mode.
- **Plus / Minus**: bounded rounds + rewards; **near-answer distractors** instead of random; SFX + celebration tiers.
- **Sammenlign Tal** (>,<,=): clarify the symbol metaphor (the "hungry mouth eats the bigger number" device); keep emoji counts; round + reward.
- **Hvad Mangler?** (sequences/skip-count): likely **too hard mixed**; consider splitting simple-next vs skip-counting.
- Cross-math: a shared **counting-aid component** is a strong candidate (define once, reuse).

### Alphabet (`-03-`)
- **Bogstav Quiz**: word-association mode exists but is silent/random — make it a deliberate, badged mode; add phonics sound; rounds + stickers.
- **Lær Alfabetet**: add a guided path / "find the letter again" recall challenge; animated letter formation candidate.

### Ordleg (`-04-`)
- **Læs Ordet**: keep "no audio scaffold" rule (per owner: he can't spell yet, must not read prompt aloud); add hint ladder (picture/first-sound) *without* defeating the reading; more words; title-case vs ALL CAPS decision.
- **Stav Ordet**: add backspace/undo, progress within word, bigger touch targets on tablet, hint for next letter; rounds.
- **Sig et Ord** (mic/STT): the standout. Give it a **word goal** ("say the animal you see") so it teaches vocabulary instead of rewarding any word; better STT-fail feedback; lean into celebration. Possibly the model for new speech games.

### English (`-05-`)
- All four: better distractors (minimal-pairs instead of random), "audio is playing" visual cue, bounded rounds + stickers, thematic grouping. **Lær Engelsk** browse → add exploration stickers + progress.

### Farver (`-06-`)
- **Farvejagt**: drag juice — snap/pop on drop, drag trail, scatter-in, drop SFX; visual progress toward target; rounds.
- **Ram Farven**: blending transition animation (not instant), splash/drip SFX, attempt feedback, clearer "try a new color" cue.

### Memory (`-07-`)
- Flip SFX, match pop/dissolve, "pairs remaining" indicator; rounds = one board; best-time-free, best could be "fewest flips" (gentle).

---

## Hard rule: every PRD must be self-contained

Implementation happens in a **fresh session with no memory of this planning work**. If a PRD forces that session to re-explore the codebase to understand how to integrate, it will exhaust its context before building. Therefore **every `-NN-` PRD MUST embed enough to implement with near-zero exploration**:

- **Verbatim current signatures** of every shared API it touches (interfaces, hook returns, component props) — copied into an "Embedded implementation reference" appendix, like `plans/games-overhaul/tmp-prd-overhaul-01-foundation.md` Appendix A.
- **Exact integration points** as `file:line` (e.g. "replace the `generateNewQuestion()` call at `UnifiedQuizGame.tsx:263`").
- **Complete content/data** inline (full word/number/sticker lists, config objects) — not "add some words".
- **Named utilities to reuse** with their paths, so the session doesn't reinvent them.
- A **verification** section the session can run as-is.

A PRD that says "extend the quiz config" without showing the config interface and the line to change is **not done**. Treat Appendix A of the Foundation PRD as the quality bar for this.

## Standard PRD template (use for every `-NN-` per-game/area doc)

```markdown
# Overhaul PRD — <Area / Game>

## Context
Why this game is being reworked; the inventory findings; what success looks like for the son.

## Current state
Mechanic, learning goal, files, current UX, concrete weaknesses (cite file:line).

## Target experience
The redesigned gameplay loop, UI, UX, and juice — described so a fresh session can build it.
Explicit before/after for each change. Note what is REMOVED.

## Foundation hooks
Exactly how this game uses the shared systems from Foundation PRD:
- Round config (length, star thresholds)
- Which sticker set(s) it can award
- Which SFX cues it fires
- Celebration tier mapping

## Learning design
What it teaches, the scaffolding/hints, why it fits a 5yo. Honor static-difficulty constraint.

## Visual/asset spec
New components/surfaces; how they meet-or-exceed the immersive 3D quality bar; theme-token usage
(no hardcoded styling); any new imagery/mascot/animation needs.

## Data & content
Word/number lists, sticker definitions, config objects — concrete and complete.

## Files to touch
New + modified files; reuse existing utilities (name them).

## Verification
How to test end-to-end on iPad (dev servers, routes, what to observe). Build/lint must pass.

## Open questions resolved
The AskUserQuestion decisions made for this game.
```

---

## Execution guide — what to run, in what order

Two kinds of session alternate per game-area:
- **Design session** (interactive — Claude asks you questions, then writes that area's PRD).
- **Implement session** (clean — Claude reads the PRD and builds it).

**Always start each session fresh** (`/clear` or a new session) so context isn't polluted. **Commit at the end of every session** so the next clean session sees the committed PRD/code. Foundation is already written, so its first session is an implement session.

### Step 0 — (optional) commit the planning output
```
Commit the new overhaul planning docs: plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md and plans/games-overhaul/tmp-prd-overhaul-01-foundation.md. Branch off master first, message describing the game-overhaul program.
```

### Step 1 — IMPLEMENT the Foundation (clean session)
```
Read plans/games-overhaul/tmp-prd-overhaul-01-foundation.md in full, plus the guardrails in plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md. Implement the Foundation PRD exactly: the progress store + useProgress, the sticker album/config/reveal + /album route and home-screen hub entry, the bounded-round + RoundResultScreen system wired into UnifiedQuizGame, the sfxClient SFX layer, and the celebration tiers. Follow .claude/rules (audio-system, game-development, responsive-design) and the app-wide visual quality floor (Principle 0). Do NOT change per-game content yet — only the shared systems, plus wiring ONE existing UnifiedQuizGame game (alphabet quiz) into a round as a reference/smoke test. Then run npm run build + npm run lint, drive it on an iPad viewport with the ui-screenshot skill, and report. Commit on a branch when green.
```

### Step 2…N — per game-area, run DESIGN then IMPLEMENT

For each area in this order — **Math → Alphabet → Ordleg → English → Farver → Memory** — run these two prompts (separate clean sessions). Replace `<AREA>` and the next file number `NN`.

**Design session (interactive):**
```
We're doing the per-game deep-dive for the <AREA> games in the Game Experience Overhaul. Read plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md (esp. the per-game intent snapshot, the PRD template, and the SELF-CONTAINMENT hard rule) and plans/games-overhaul/tmp-prd-overhaul-01-foundation.md (the shared systems these games plug into). Explore the actual <AREA> game files. Then go into plan mode and ask me as many AskUserQuestion rounds as needed to lock the redesign (gameplay, UI, UX, juice, learning, what to add/remove/merge, round length, star thresholds, which sticker set, SFX cues). When we're aligned, write a self-contained PRD to plans/games-overhaul/tmp-prd-overhaul-NN-<area>.md following the template — including an Embedded implementation reference appendix with verbatim current signatures and exact file:line integration points, like Foundation Appendix A. Commit the PRD.
```

**Implement session (clean):**
```
Read plans/games-overhaul/tmp-prd-overhaul-NN-<area>.md in full, plus plans/games-overhaul/tmp-prd-overhaul-01-foundation.md and the guardrails in plans/games-overhaul/tmp-prd-overhaul-00-roadmap.md. Implement the <AREA> PRD exactly, reusing the Foundation systems (progress store, rounds, RoundResultScreen, stickers, sfxClient, celebration tiers). Follow .claude/rules and the visual quality floor. Run npm run build + npm run lint, verify on an iPad viewport with the ui-screenshot skill, and report. Commit on a branch when green.
```

> After each area's implement session, **play-test with your son** before the next area — what you learn should feed the next design session. That's the whole point of going one-by-one.

### Quick order reference
1. Commit planning docs (Step 0)
2. Implement Foundation (Step 1)
3. Math: design → implement → play-test
4. Alphabet: design → implement → play-test
5. Ordleg: design → implement → play-test
6. English: design → implement → play-test
7. Farver: design → implement → play-test
8. Memory: design → implement → play-test

## Global guardrails (apply to every PRD in this program)

- **Static difficulty only.** No adaptive difficulty, no in-game level pickers. Tuning happens by editing constants in future sessions.
- **Danish** for all child-facing text. Comic Sans MS for child-facing type.
- **iPad-first**, but stay fully responsive + no-scroll full-viewport (`.claude/rules/responsive-design.md`).
- **Min 44px touch targets.**
- **Token-driven theming only** — read values via `useTheme()` / `getCategoryTheme(id)`; never hardcode. Educational colors (Farvejagt/RamFarven) stay as data, not themeable.
- **Audio rules** (`.claude/rules/audio-system.md`): one TTS at a time, no queue; SFX is a separate short channel (see Foundation).
- **Quality floor:** new surfaces match or exceed the current immersive 3D / mascot / themed-scene look.
- **Reduced-motion** respected (existing `CelebrationEffect` already reads `prefers-reduced-motion`).

## Verification baseline (every implementation session)
- `npm run dev` + `npm run dev:api` (both in Windows PowerShell — never WSL, see project memory).
- `npm run build` and `npm run lint` clean.
- Manually drive on iPad-sized viewport; use the `ui-screenshot` skill to confirm layout + no console errors.
