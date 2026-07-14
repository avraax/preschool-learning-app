# PRD-10 — Refactor, dead code & docs

**Priority:** P3 (maintainability; do it *after* the behavioural PRDs so it consolidates correct logic)
**Scope:** Large
**Depends on:** best after PRD-01, PRD-02, PRD-05 (so the hint/round/drag logic is fixed before it's
centralized)

---

## Context

The overhaul left two engines (`UnifiedQuizGame`, `UnifiedMemoryGame`) plus several hand-rolled games
that duplicate the same scaffolding. CLAUDE.md and `.claude/rules/*` have drifted from the code in
several places. This PRD consolidates and documents — **no behaviour change intended** (it should be a
no-op for the child), so land it only once the behavioural fixes are in.

## Problems (with evidence)

### P1 — ~900–1300 lines of duplicated scaffolding

- `MathOperationGame.tsx` (~575 lines) and `ComparisonGame.tsx` are ~90% clones of `UnifiedQuizGame`
  (welcome/reveal scaffold, round wiring, `firstAttemptRef`, `finishRound`, `handleReplay`,
  streak-every-3). `renderHero` on the engine was added to absorb equation-card games and isn't used
  for them.
- The **never-fail hint** ("pulse the correct thing after 2 wrong, costs a star") is implemented ~5
  times independently (SpellingGame, Farvejagt, RamFarven, FarveQuiz, Nuancer) and has **already
  drifted** (e.g. Nuancer resets its counter per correct drop; Farvejagt accumulates per board).
- The drag games (`FarvejagtGame`, `RamFarvenGame`, `FarveQuizGame`, `NuancerGame`) copy ~400 lines of
  welcome/init refs, drag start/over/cancel handlers, difficulty-rebuild effects, and three private
  `shuffle` implementations (one biased `.sort(() => Math.random() - 0.5)`).
- `DraggableItem` hardcodes `position: absolute; left/top: %`, so three games wrap it in a
  `position: relative !important` hack to place it inline — the component should own an `inline` mode.
- The 2×2 answer-grid `sx` block is duplicated verbatim between `UnifiedQuizGame` and
  `MathOperationGame`.

### P2 — Dead code

- `src/components/common/GameHeader.tsx` — zero importers.
- `src/components/common/GameGuide.tsx` — zero renders (GameShell mounts `Mascot` directly).
- `useTargetGameState` in `src/hooks/useGameState.ts` — unused.
- `src/theme/kidTheme.ts` — back-compat shim, zero importers.
- `RepeatButton` `primary`/`secondary` variants — byte-identical styles.
- Empty `src/components/demo/*` and `src/components/test/*` dirs.
- ~10 unused `SimplifiedAudioController` methods (`handleCompleteGameResult`, `handleGameCompletion`,
  `playCelebrationWithStandardTiming`, `speakNewColorHuntGame`, `speakComparisonProblem`,
  `speakMathProblem`, `playSuccessSound`, `playEncouragementSound`, `emergencyStop`);
  `speakSlowly`/`speakWithEnthusiasm` are aliases of `speak`; the `useSSML` flag is threaded but
  ignored; `backup` voice ≡ `primary`.
- `DragOverlay` blocks in the drag games render `{null}` (dead).
- HomePage's `useCharacterState('wave')` + 1s timer mutates state that's never rendered.
- Stale `danish-phrases.ts` entries (descriptions claiming counting "1-30"/memory "40 kort";
  unused comparison/position templates; dead `speakComparisonProblem`).

### P3 — Doc drift (CLAUDE.md + `.claude/rules/*`)

- English voice is `en-US-AvaMultilingualNeural`, but `.claude/rules/audio-system.md`,
  `SimplifiedAudioController.ts` comments, and `EnglishListenGame`/`EnglishLearning` comments say
  **en-GB / "British English"**.
- CLAUDE.md says "Ships **6 themes**"; only **4** are registered in `src/theme/themes.ts` (jungle/candy
  tokens exist but are deliberately unregistered).
- The scene/parallax/ambient/mascot/`mascotBus`/music systems, the manual **DifficultyPanel** +
  difficulty system (~12 consumers), the 🎵 music toggle, and `UpdateBanner` are absent from CLAUDE.md.
- The route list omits `/voicelab` and the size-less `/learning/memory/:type` fallback route.
- CLAUDE.md's Farver paragraph describes Ram Farven behaviour (wrong-mix narration, "one source
  colorContent.ts") that doesn't match code (see PRD-01/PRD-04).
- `.claude/rules/game-development.md` describes the pre-overhaul config recipe (title/emoji/teacher/3
  audio callbacks); it omits `round`/`gameId`/`useRound`/`progressStore`/the hint convention/
  `renderHero`/`skipFirstPrompt`.
- CLAUDE.md's Memory line claims `celebrateTier('micro')` on a pair; code deliberately plays only
  `sfx 'match'` + a pop.

### P4 — Divergent letter tables & biased shuffle

Three letter→word→emoji tables (handled by PRD-04 if done first — otherwise unify here). Biased
`.sort(() => Math.random() - 0.5)` used as a shuffle across many files.

## Goals / Non-goals

**Goals:** one place for the quiz scaffold, one for the drag scaffold, one hint implementation, one
shuffle util, one letter-word source; dead code removed; docs match reality.

**Non-goals:** any behaviour change (this PRD should be invisible to the child). If a "refactor"
reveals a behaviour bug, split it into the relevant behavioural PRD.

## Implementation plan

1. **Absorb `MathOperationGame`/`ComparisonGame` into `UnifiedQuizGame` configs** using `renderHero`
   for the equation/crocodile card. Move the shared 2×2 grid `sx` into the engine.
2. **Extract a shared drag-game scaffold** (a hook or a `UnifiedDragGame` analogue) owning
   welcome/init, round wiring, drag handlers, and **one** hint state machine with a single agreed
   reset policy. Give `DraggableItem` an `inline` prop and delete the three `!important` hacks and dead
   `DragOverlay` blocks.
3. **Add `shuffle<T>()`** (Fisher-Yates) in `src/utils/` and replace the biased sort idiom everywhere.
4. **Delete the dead code** in P2 (grep each for zero importers first).
5. **Unify letter tables** into `src/config/letterWords.ts` if PRD-04 didn't.
6. **Update docs (P3):** fix CLAUDE.md (4 themes; document scene/mascot/music/difficulty/UpdateBanner;
   add `/voicelab` + memory fallback routes; correct the Farver + Memory paragraphs; en-US voice) and
   `.claude/rules/audio-system.md` + `game-development.md` (current engine recipe, round/reward wiring,
   hint convention). Share one `MENU_PATHS` constant between `scene/routeKind.ts` and `musicClient.ts`
   (they've already diverged on `/album`).

## Acceptance criteria

- [ ] `MathOperationGame`/`ComparisonGame` are engine configs (or the duplication is otherwise
      eliminated); the hint exists once; one shuffle util; one letter-word source.
- [ ] Listed dead files/methods removed; `npm run build` + `npm run lint` clean; full harness sweep
      shows no behavioural change vs before.
- [ ] CLAUDE.md and `.claude/rules/*` match the code on the drifted points above.

## How to verify

- Before/after `ui-screenshot` sweep of every game — screenshots and round outcomes should be
  unchanged (this is a no-op refactor).
- `npm run build && npm run lint`.
- `grep` confirms removed symbols have no remaining importers.

## Risks / notes

- Largest and riskiest PRD; do it last and in small, individually-verified commits.
- The `kid` theme (`kidTheme.tokens.ts`) keeps hand-written exact values — don't "refactor" it into
  the helpers (per the existing CLAUDE.md note).
- If consolidating reveals a latent behaviour difference between an engine and a hand-rolled game,
  treat the engine (post-PRD-02) as the source of truth.
