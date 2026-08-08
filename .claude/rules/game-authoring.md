---
paths:
  - "src/components/common/UnifiedQuizGame.tsx"
  - "src/components/common/TactileTile.tsx"
  - "src/components/common/PromptFocus.tsx"
  - "src/components/common/RepeatButton.tsx"
  - "src/components/common/GameShell.tsx"
  - "src/components/common/answerGrid.ts"
  - "src/hooks/usePromptBag.ts"
---

# Building a new game: the quiz engine and the shared primitives

Reach for this when you are **creating a game or a board surface**, not when editing an existing one —
that is why it is scoped to the primitives themselves rather than to the section directories. The
always-on contract (the two game types, interaction parity, entry audio, advance-lock) is in
`.claude/rules/game-development.md`.

## Prefer UnifiedQuizGame for new quizzes

Most task-based quizzes are a thin **config** over `src/components/common/UnifiedQuizGame.tsx`
(see AlphabetGame, MathGame, the three English games, LaesOrdetGame, HvadManglerGame). The config
(`UnifiedQuizConfig`) provides:

- **Content**: `generateQuizItem()`, `generateOptions(correct, optionCount)` (return the shuffled tile set
  — use `shuffle()` from `src/utils/shuffle.ts`, never a biased `.sort(() => Math.random())`).
  **`optionCount` is resolved CENTRALLY by the engine** from the difficulty table
  (`optionCountFor(gameId, level)` — 3/4/5, or 3/4/6 for Læs Ordet's picture tiles), so no config
  hand-rolls it; each game still owns *which* distractors it picks and must return exactly that many
  items. The grid's columns + width envelope follow the count via the shared
  `src/components/common/answerGrid.ts` (also used by the hand-rolled `MathOperationGame`) — never
  hardcode `repeat(2)`/`repeat(4)` in a game again, and never leave a row holding a single tile.
- **Chrome**: `title`, `emoji`, `theme` (a `CategoryTheme`), `RepeatButtonComponent`, `backRoute`,
  `showRepeat` (default true). There is **no score/progress chip** — `ScoreChip` and GameShell's
  `score` slot were deleted (owner, 2026-08-02): a per-question pip row was a second progress meter
  inches from the reward ring, and 8 pips is past the subitizing limit. The ring is the only meter.
- **Audio**: `gameWelcomeType` (add the string to `GAME_WELCOME_MESSAGES` in
  `SimplifiedAudioController.playGameWelcome`) + the callbacks `speakQuizPrompt`, `speakClickedItem`,
  `getRepeatAudio`. Optional `speakCorrectFact(item)` speaks a **completed fact** on a correct tap
  INSTEAD of echoing the tapped item (single channel — replaces, never stacks; e.g. Hvad Mangler's
  finished sequence). `skipFirstPrompt` suppresses voicing the first prompt when the welcome already
  said it.
- **Endless play + rewards**: set `gameId` (stable progress id, e.g. `'alphabet.quiz'`) and
  `tasksInRound` (default 8). **`tasksInRound` is NOT a length — nothing counts down to it.** It is the
  `taskXp` normaliser ("a round is a round", so every game pays the same per notional round) AND the
  value the game's prompt bag uses as its no-repeat `window`; pass the game's own round constant to
  both, from config, so they cannot drift. The engine runs `useTaskRun`, grants **live per-task XP**,
  and fires the sticker ceremony **in-game at the seam** via `run.thenContinue()`. There is no
  round-end surface and no star/best bookkeeping — see `rewards-and-progression.md`. Wrong answers
  never punish; they only break the question's first-try flag (which feeds the streak beat).
- **Never-fail hint** (PRD-05): `hintAfterNWrong` (2 for every config quiz) pulses the correct
  `AnswerTile` after that many wrong taps (reduced-motion → static glow). The 2 wrongs already broke
  first-try, so no extra star bookkeeping. It also **SPEAKS the answer** via `config.speakHint(item)` —
  a pulse is a pointer, not an explanation, and the app already had the right sentence but only ever said
  it on the CORRECT tap, i.e. only to the child who didn't need it. The argument is the CURRENT item (the
  answer), never the tapped one; fire-and-forget, never awaited.
- **What each game's hint SAYS is data**, in `src/config/hintLines.ts` keyed by `gameId` — read by the
  games *and* by the guard, because a test with its own copy passes against a value nothing renders. The
  rule is "speak the already-baked line that names the answer; where none exists, re-speak the prompt;
  where the prompt must stay silent, stay silent" — so it costs no new narration, and
  `hintLines.test.ts` asserts every line resolves in `prebakedTts.ts` (a hint must never reach live Azure
  at the one moment the child is already stuck). The table is TOTAL over games that HAVE a hint: a
  deliberately silent one (Læs Ordet never reads its prompt word) carries `voice: null` + a reason.
- **Custom hero**: `renderHero(item, ctx)` renders a richer subject in the focal zone (`PromptFocus`)
  instead of the default glyph/emoji — used today by Tal Quiz (the shared `ListenHero`, since its answer
  is audio-only) and Hvad Mangler (the sequence with a pulsing "?").
- **Hear-before-commit** (`previewBeforeCommit`) — supported by the engine but **NO game opts in
  today**. It makes a tap a two-step answer: 1st tap AUDITIONS the tile (`speakClickedItem` + the
  shared `'selected'` state — a lifted accent outline, NOT correct/wrong colours) and returns WITHOUT
  scoring; a 2nd tap on the SAME tile commits. english.word (and english.translate, before that game
  was removed) used it (PRD-14 W7) so a pre-reader could hear each unreadable English word before
  choosing — **removed 2026-07-31 after play-testing**: the owner's 5-year-old read the ignored first
  tap as a broken game and kept tapping. Their prompts already speak the target word, so single-tap
  keeps them real print recognition.
  **Before re-enabling it anywhere, solve the discoverability problem** — an unscored first tap needs a
  signal a pre-reader actually reads.
- **A prompt WORD renders as one uniform string** — never per-letter size/weight/opacity. PRD-18 W1's
  `emphasizeFirstLetter` flag (oversized bold first grapheme + muted rest, as a silent "sound this out
  first" nudge on Læs Ordet) was **deleted 2026-08-03** on sight: owner "it looks wrong and takes too
  much focus. All letters should be displayed the same no matter what." It also mis-taught the thing the
  game teaches — the prompt is `textTransform: uppercase`, so a shrunk + faded capital O reads as a
  lowercase one and "SO" looked like Title Case "So". The durable rule: **typography may not encode a
  hint inside text the child is being asked to decode**, because the child cannot tell your emphasis
  from the letter's actual shape.

Only hand-roll a full component for genuinely novel mechanics (e.g. SpellingGame, SpeakWordGame, and
the dnd-kit Farver games — see `.claude/rules/drag-and-drop.md`). **MathOperationGame (+/−) and
ComparisonGame stay hand-rolled** despite ~cloning the engine's scaffold: they have bespoke
*post-correct-tap* animations (the equation reveal; Sammenlign's `?`→`>`/`<` swap plus the losing tile
receding) and the engine has no `onCorrectAnimate`-style callback — absorbing them into `UnifiedQuizGame`
needs that hook added first (it would touch all 7 config quizzes, so verify carefully).

## Shared primitives — reuse, don't re-fragment

- **Never-fail hint** → `useNeverFailHint` (`src/hooks/useNeverFailHint.ts`), used by the engine AND
  the hand-rolled games. Each game keeps its OWN reset boundary (per question / slot / board / target)
  and decides whether to nudge the mascot — that variance is **intentional, not drift; don't "unify"
  it**. The hook owns only the wrong-counter + threshold trip + the pulse state.
- **Prompt draw** → `usePromptBag` (`src/hooks/usePromptBag.ts`) over the game's pool from
  `src/config/promptPools.ts`. **Never `Math.random()` over a content pool** — that idiom is what made a
  round repeat itself (see the pool invariant in `games-catalog.md`), and `promptDraw.test.ts` fails on
  any new one that isn't in `promptBag.ts`'s `EXEMPT` map with a reason. Pass the game's round-length
  constant as the bag's `window`: one value feeds the `RoundConfig`, the no-repeat window and the
  measured simulation, so they cannot drift. Two things that are easy to get wrong:
  **(a) don't keep a second anti-repeat mechanism beside it** — the old `recentRef` / `previousObject` /
  `previousHue` / `previousWord` refs were DELETED, not kept alongside, because two mechanisms is how one
  gets bypassed (and each of them bounded ADJACENCY, which was never the defect).
  **(b) the per-level FILTER belongs in `promptPools.ts`, not the `.tsx`** — a guard cannot read a list
  out of a component, so a simulation would have to re-derive the pool, and a guard that re-derives its
  subject agrees with itself while the product regresses.
- **Shuffle** → `shuffle()` (`src/utils/shuffle.ts`), a non-mutating Fisher-Yates. Never the biased
  `.sort(() => Math.random() - 0.5)` idiom, and never sort shared config in place.
- **Drag games** → the `src/components/common/dnd/` primitives (see `.claude/rules/drag-and-drop.md`).
- **Game-board surfaces** → `TactileTile` (pressable clay tile), `PromptFocus` (in-world focal zone),
  `TactilePill` (HUD pills; `AnswerTile`/`RepeatButton` ride these) via `src/theme/depth.ts`
  (`softShadow`/`contactShadow`). New or hand-rolled game surfaces reuse these — don't re-invent tile
  depth, a keyboard-lip button, or a frosted `PromptStage` card (PRD-06 F1/F2/F4). The Foundation's
  swap auto-upgraded only the **shared engines** (`UnifiedQuizGame`/`UnifiedMemoryGame`/`LearningGrid`);
  **hand-rolled games + screens that render `PromptStage` directly still show the old frosted card** and
  must be migrated to `PromptFocus` per area — check with a `PromptStage` import grep before assuming a
  game already upgraded. **`PromptFocus` goes in GameShell's `promptStage` slot, never in `children`.**
  In the slot it is sized to the anti-void 40% band; in `children` it stretches over the whole body, and
  ComparisonGame was the one game doing that (measured: a 512px focal zone holding a 114px answer tile,
  "Hør igen" stranded at the bottom of the viewport, and the centred circular light-pool wide enough to
  read as a magenta smudge — on LIGHT skins only, which is why dark-skin review never caught it). A game
  whose answers ARE its focal content has no prompt/answer split, so it should own its column directly
  rather than wrap it in `PromptFocus` (see Sammenlign Tal). **The same applies to the `promptStage` SLOT
  itself** — a fixed 40% band at the TOP with the body beneath, right for prompt-then-answer and wrong when
  the focal element IS the interaction: Sig et Ord's mic sat in that band with an empty body under it, so
  the board hugged the top with half the screen unused (owner, 2026-08-04). Pass no `promptStage` and
  GameShell centres the column. Dense no-scroll grids (Lær Tal at 1–100 = 10 rows) must pass `TactileTile`'s
  **`compact`** prop — otherwise its 44px min-height + padding overflow the short rows and tiles overlap
  the row below; `LearningGrid` trips it automatically for numbers >60. A 2D grid of many small cells
  additionally needs **`field`**: the primitive's defaults are built for a roomy board, and at chart
  density they broke three ways at once (opaque tops merging into one white slab over the world, an outer
  state ring clipped by the grid's `overflow:hidden` stage, and every tile's drop-shadow pooling into a grey
  wash across the whole board). `field` swaps in a translucent surface, an inset ring and a tight
  shadow — the two props are separate axes, so set both. Measurements + rationale live on the prop's doc
  comment and `depth.ts`'s `fieldShadow()`.
- **Baked game-art** (pictorial subjects, per-section) → `src/assets/games/<section>/index.ts`
  eager-`import.meta.glob`s `*.webp` keyed by content id → a sync `letterArt()`-style helper.
  **Art-gated**: empty until the owner's keyed WebP are dropped in (auto-registers, no code change);
  consumers fall back to emoji/glyph until then. Use ASCII aliases (`AE`/`OE`/`AA`) for filesystem-awkward
  glyphs. Render hooks: quiz hero via `QuizItem.questionVisual.art` (→ `HeroArt`), Memory via
  `MemoryItemDisplay.iconArt`, browse bloom via `PromptFocus`. **Glyphs stay type — only depicted
  subjects are baked** (recognising the letter/number IS the lesson). Art generation + keying:
  `.claude/rules/scene-assets.md`.
