# PRD — Practice Loop: what the child is asked next, and what happens when he's wrong

Status: authored 2026-08-04, **NOT IMPLEMENTED**. Four independent work items, each separately
shippable, ordered by value. W2 depends on W1's bag; W3 and W4 depend on nothing.

Comes out of the 2026-08-04 self-analysis session (code read + research, no play-test). That session
produced 21 findings; these are the four the owner picked as "fix first" because each is small,
mechanical, and changes what the child actually practises rather than how the app looks.

---

## 1. The problem, in one paragraph per item

**W1 — every prompt is drawn with replacement.** `Math.random()` picks the letter/word/object fresh on
each question, so a round can ask the same thing twice. Bogstav Quiz has 28 askable letters and asks 8
questions: **P(at least one repeat) ≈ 66%** (∏(1−i/28), i=1..7 = 0.332). Both English quizzes over 82
words: ≈30%. Læs Ordet keeps a 3-deep recent window and Hvilken Farve avoids only the previous object,
which bounds *adjacency* and not *frequency*. The catalog rule "a level's content POOL must be at least
the ROUND LENGTH" exists precisely to stop a round repeating itself — and it cannot work, because
sampling with replacement repeats whatever the pool size is. Growing Læs Ordet's Let pool from 5 to 9
words (2026-08-03, in response to the owner's "reads as stuck rather than easy") therefore did not fix
what it was bought to fix. **The fix already exists in this codebase**: `makeTargetBag` in
`src/config/colorMixing.ts`, written after "avoiding only the previous target let 8 mixes from Let's 4
goals hand out lilla four times". That lesson was never propagated past Ram Farven.

**W2 — nothing records what he gets wrong.** `PerGameStats` is `bestStreak / bestStars / bestCount /
roundsCompleted / lifetimeCorrect` — aggregates only. So the letters he already owns come back at
exactly the same rate as the ones he misses, forever. Spaced and expanding retrieval is one of the
best-evidenced effects in early learning (Fyfe/learning-science reviews; expanding retrieval with
preschoolers, d ≈ 1.9 over elaboration). **This is not adaptive difficulty**: the level stays manual and
adult-set, and nothing reads performance to change a LEVEL — only the ORDER inside that level's own
pool. Write that sentence into the code, because the standing rule in `difficulty.ts` ("**NO
ADAPTIVITY.** … Nothing in this file — or anything reading it — looks at the child's performance") is
otherwise a correct reason for a future session to delete this feature.

**W3 — a wrong answer teaches nothing.** It plays a soft `wrong` SFX, breaks the question's first-try
flag, and after 2 wrongs pulses the correct tile. That is a pointer, not an explanation; brief
explanatory feedback beats knowledge-of-result for young children. The app already speaks the right
sentence — `startsWithPhrase` → "Wienerbrød starter med W" — but **only on the correct tap**, i.e. only
to the child who did not need it. Two games have a `speakCorrectFact` at all (`AlphabetGame.tsx:132`,
`HvadManglerGame.tsx:284`).

**W4 — two games are unsolvable, with no explanation, when narration dies.** Tal Quiz shows nothing but
a speaker and an equalizer by deliberate design (the numeral and the counting row were both removed as
giveaways); Lyt og Find is audio→picture. Both are correct designs *while audio works*. This app has
already shipped total silence on the target device twice over (Ogg on iPadOS 17.7; iOS
suspension/`NotAllowedError`), and in that state the child faces a board that cannot be answered and
nothing tells anybody why.

## 2. Non-goals

- **No adaptive difficulty.** Standing owner rule, untouched. W2 changes draw order only.
- **No schema v5.** W2 stays out of the synced CRDT (see D2).
- No new games, no new sections, no change to XP, `taskXp`, the reward curve, the book, or the ceremony.
- No change to Sig et Ord (child ASR runs to ~35% WER at this age; its ungraded open-ended design is
  the only honest one and the analysis explicitly said leave it).
- No change to Læs Ordet's silence (see W3's exception) or to the "a board must not restate its own
  answer" rule outside W4's degraded mode.

---

## 3. W1 — one bag, every place a prompt is drawn

### 3.1 The module

New **pure, Node-importable** `src/config/promptBag.ts` (in `config/`, not `utils/`, because
`difficulty.test.ts`-style sampling tests and possibly `shared-narration-clips.js` must import it;
relative imports in that graph need explicit `.ts` extensions). It may import `../utils/shuffle.ts`
and nothing else.

```ts
export interface PromptBag<T> {
  /** The next prompt. Never repeats until the pool has been exhausted. */
  next(): T
  /** Push an item back in `ahead` draws' time (W2's re-ask). Clamped into the remaining pass. */
  requeue(item: T, ahead: number): void
  /** Rebuild for a new pool (a mid-game difficulty change). Keeps the seam rule against the last item. */
  reset(items: readonly T[]): void
}

export function makePromptBag<T>(
  items: readonly T[],
  opts?: { key?: (t: T) => string; rnd?: () => number },
): PromptBag<T>
```

Semantics, and every one of these is a unit assertion:

1. A pass is a `shuffle()` of the pool; `next()` walks it. One pass yields **every item exactly once**.
2. On exhaustion it reshuffles. **The first item of the new pass is never the last item of the old
   one** — that is `makeTargetBag`'s `avoidFirst`, and the seam is where the naive fix fails.
3. A pool of 1 is legal and returns that item forever (don't throw; Ram Farven's Let pool is 4).
4. `reset()` is idempotent for an unchanged pool — a difficulty change that doesn't move the pool must
   not restart the pass (otherwise every level-change reshuffles and the guarantee erodes).
5. `rnd` is injectable so the tests are deterministic (same reason `shuffle` takes it).

### 3.2 Call sites — convert these five

Verified as bare `Math.random()` selection over a content pool:

| file:line | pool | today |
|---|---|---|
| `src/components/alphabet/AlphabetGame.tsx:36` | `WORD_LETTERS` (28) | nothing at all — 66% repeat/round |
| `src/components/english/EnglishListenGame.tsx:35` | `quizEnglishWords` (82) | nothing |
| `src/components/english/EnglishWordGame.tsx` (`generateQuizItem`) | `quizEnglishWords` (82) | nothing |
| `src/components/farver/FarveQuizGame.tsx:135` | `quizObjectPool(reveal)` | avoids previous only |
| `src/components/ordleg/LaesOrdetGame.tsx:56` | `READING_WORDS` filtered by `wordMaxLen` | recent-3 window |
| `src/components/ordleg/SpellingGame.tsx:253` | `spellingWordsFor(level)` | verify — looked like plain random |

The bag lives in a `useRef` beside the existing `recentRef`/`previousObject` refs (both of which are
DELETED, not kept alongside — two mechanisms is how one gets bypassed), rebuilt via `reset()` when the
level's pool changes. `UnifiedQuizGame` calls `generateQuizItem` per question, so nothing in the engine
changes; the bag belongs to each game's config closure.

**Also grep for the ones this table missed.** `grep -rn "Math.random" src/components` and for each hit
either convert it or add it to an `EXEMPT` map in `promptBag.ts` **with a reason string**, exactly the
shape `difficulty.ts` uses. Expected exemptions, each for a real reason:

- `src/config/mathProblems.ts` — a parameter space, not a content list. A bag over "every legal
  `a+b`" is meaningless; the generators already vary start/step/gap per level.
- `src/components/farver/RamFarvenGame.tsx` — already has `makeTargetBag`. **Leave it.** Migrating it
  buys nothing and risks the `colorMixing.test.ts` invariants; note the duplication in a comment on
  both sides instead.
- `UnifiedMemoryGame` / `MemoryGame.tsx:52,95` — a board is already `shuffle(pool).slice()`, i.e. a
  one-pass bag by construction.
- `ordleg.mic` — no target word exists.
- Distractor selection everywhere — distractors are already `shuffle`d and are not the thing that
  repeats; converting them is scope creep.

### 3.3 Guards (and the re-break)

- `promptBag.test.ts` — the five semantics above, seeded.
- **A measured before/after, not a claim.** Simulate 200 rounds of 8 per game at each level with a
  seeded rnd and assert the improvement as literals: distinct-items-per-round and
  P(any repeat). Bogstav Quiz must go from ~0.66 to **0.0**; Læs Ordet Let must reach 8 distinct of 9.
  Measure Læs Ordet's current number in the same run rather than trusting this PRD's estimate.
- A **source guard** (`promptDraw.test.ts`) reading the game components as text, comments stripped
  (the `noEmoji`/`authOverlayZ` rule — a plain `includes()` was once satisfied by the comment
  explaining the fix): no file under `src/components/{alphabet,math,farver,english,ordleg}` may select
  from a content pool with `Math.random()` unless its path is in `EXEMPT`.
- Re-break: revert `AlphabetGame.tsx` to `Math.random()`; the simulation assertion — not just the
  source guard — must go red.

---

## 4. W2 — a practice ledger, so a missed item comes back sooner

### 4.1 Where it lives (D2)

**Device-local, per child, NOT in the synced CRDT.** New `src/services/practiceLedger.ts` over its own
key `bornelaering-practice:<profileId>`, with the pure decision logic in `src/config/practiceWeights.ts`.

Why not `progressSchema` v4→v5: a per-item map has to acquire merge semantics, and the merge is the one
chain in this app protected hardest (`grantedSlots ≤ collectedFromLevel(globalLevel())`, the convexity
clamp, the G-Counter). A scheduling hint does not deserve that risk — losing it costs one session of
ordering, not a sticker. Record the door out, because someone will want it: **if it ever syncs, it is
per-key LWW (`max(misses)`, `max(lastSeenAt)`) under its own `version` field, never a G-Counter** —
summing misses across devices would over-drill an item the child has since learned.

Consequences to accept explicitly: a second iPad starts with an empty ledger, and the parent-facing
"hvad driller" row (a later finding, not this PRD) would read only the device in hand.

### 4.2 Shape and write points

```ts
interface PracticeEntry { misses: number; seen: number; lastSeenAt: number }
// keyed `<gameId>:<itemKey>` — e.g. `alphabet.quiz:Æ`, `ordleg.read:kat`
recordAttempt(gameId: string, itemKey: string, firstTry: boolean): void
```

Written at the points that **already know** first-try, so no new bookkeeping:

- `UnifiedQuizGame`'s resolve — the wrong branch (beside `firstAttemptRef.current = false`) records a
  miss on the **current** item; the correct branch records a `seen`.
- `SpellingGame`'s wrong-slot branch (hand-rolled).
- Capped at 300 entries, evicting by oldest `lastSeenAt`. `progressStore.resetAll()` and
  `profileStore.deleteProfile()` must clear the child's ledger — add both, and test both.

### 4.3 The rule (deterministic, no probability model)

On a miss, the item is requeued **`2 + min(misses, 3)` draws ahead** inside the current pass (W1's
`requeue`); if fewer draws remain, it goes to the front of the next pass. That is expanding retrieval in
one line: first re-ask soon, each subsequent miss pushes it further out. When a bag is built,
`practiceWeights.ts` also front-loads the pass with the pool's most-missed items — **at most 2 per
pass**, so a round never becomes a drill of the same three letters (that is what would make a 5-year-old
quit, and it is the failure mode to guard, not the under-drilling).

`practiceWeights.ts` **must not import `difficulty.ts`** and no `difficultyFor()` call site may import
the ledger. Assert both as a source guard — that is the mechanical form of "this is not adaptivity", and
it is what tells a future session the feature is legal.

### 4.4 Guards

- `practiceWeights.test.ts` pins the requeue offsets as literals and the ≤2-per-pass front-load.
- A simulation: a child who always misses `Æ` sees it again within 3 questions, and a round still
  contains ≥6 distinct items.
- Re-break: delete the requeue call → the "seen again within 3" assertion goes red (not just the
  offsets test, which would stay green off the pure function).

---

## 5. W3 — the never-fail hint speaks the answer

### 5.1 Behaviour

In `UnifiedQuizGame`, when `registerHintWrong()` returns true (today: pulse + `mascotBus.emit('hint')`),
also speak the line that names the correct answer — **fire-and-forget, never awaited**
(`audio-system.md` step 8; the single channel means it cancels any playing clip, which is correct — the
`wrong` SFX is a separate channel and survives). The argument is `currentItem`, the right answer, **not**
the tapped one.

This must not read as punishment: it is identification, the same distinction that lets Ram Farven name a
wrong-but-real mix ("rød og gul bliver orange") without saying "forkert".

### 5.2 What each game speaks — near-zero new narration

The rule: **speak the already-baked line that names the answer; where none exists, re-speak the prompt;
where the prompt must stay silent, stay silent.** Per game (verify each against
`src/config/prebakedTts.ts` before writing any of it):

- **Bogstav Quiz** — `startsWithPhrase(letter, word)`. Already built, baked and audited. Nothing new.
- **Hvad Mangler** — its existing `speakCorrectFact` (the finished sequence). Nothing new.
- **Tal Quiz** — re-speak the prompt ("Find tallet N"). The fact *is* the prompt. Nothing new.
- **Both English quizzes** — re-speak the English word (the prompt). Nothing new.
- **Hvilken Farve** — `spokenColor(hue, neuter)` ("æblet er rødt"). Verify it is baked for the quiz
  pool; Farvejagt speaks these on a correct drop, but per `audio-system.md` a clip can be baked purely
  as a side effect of another game's loop, so **diff the manifest, don't grep the phrase**.
- **Stav Ordet** — `letterPhrase(letter, word)` for the pulsed letter ("K som Kat"). Baked for Lær
  Alfabetet and Hukommelse; confirm the exact string.
- **Læs Ordet — stays SILENT.** Its standing invariant is that it never reads the prompt word, because
  silent decoding is the exercise; the hint remains the picture pulse alone. This is a content fact, not
  an omission — say so in the code, or it gets "fixed" later.

If any line turns out unbaked, it goes through the full 8-step protocol in `audio-system.md` (build in
`config/` → enumerate in `shared-narration-clips.js` via the same builder → pin the literal →
`npm run tts:prebake` → `audit:check` → owner sign-off, which per standing preference is
`npm run audit:approve-all` with the clips declared approved-but-unheard).

### 5.3 Guards

- Declare the per-game hint line as **data** (a table in `src/config/hintLines.ts` keyed by `gameId`,
  with `null` for Læs Ordet and a reason string), read by the games *and* by the test — a hardcoded
  duplicate in the test would let the guard pass against a value nothing renders (`adultSettingsIa`'s
  lesson).
- Assert every non-null entry resolves to a key present in `prebakedTts.ts` — that is the assertion
  that keeps a hint off live Azure.
- Re-break: remove the speak call from the hint branch → a test asserting the hint fires narration
  (spy on the config's fact/prompt fn) goes red.

---

## 6. W4 — a degraded mode when narration is dead

### 6.1 The signal

`ttsClient` already keeps circuit-breaker health and already snapshots it into bug reports
(`ttsClient.ts:523`). Extend that snapshot with **consecutive playback failures** — `play()` rejection,
decode error, fetch failure — reset to 0 on the first success. Expose a reactive
`narrationHealthy: boolean` through `SimplifiedAudioContext` (which already carries `isWorking`) and the
hook:

```
narrationHealthy = state.isWorking && ttsHealth.consecutivePlaybackFailures < 2
```

`isWorking` alone is not enough — it answers "can we play audio at all", which was already false in the
suspension case but **true** during the Ogg failure, where the element existed and the bytes were
undecodable. That is the exact bug this must catch.

### 6.2 The behaviour

While `narrationHealthy` is false:

- **Tal Quiz** reveals the numeral in the focal zone (`PromptFocus`).
- **Lyt og Find** reveals the English word as type.
- Both revert **automatically and mid-round** on recovery.

State plainly in both components that this **deliberately re-creates the giveaway the owner removed**
(the board now restates its own answer, and the task degrades to shape-matching). That is the correct
trade only here: a solvable board beats an unanswerable one, and the alternative is a child tapping at
random until an adult notices.

Because the board is trivial in this mode, a degraded round **grants XP as normal** (he played; never
punish) but **does not record a new personal best** — one flag through `recordRoundResult`. Do not add a
child-facing badge: no emoji ships, child surfaces take baked art only, and a warning glyph is for the
adult, who already gets audio health in the bug report.

### 6.3 Verification

Add a dev/harness-only `?mute-tts=1` that forces the failure counter, gated `DEV || __HARNESS__` so it
is statically absent from deploy output — the same discipline as `?nogate=1`, and `harnessBuild.test.ts`
already fails if a deploy script selects harness mode. Then rung 1 (`cdp.mjs`) screenshots both states,
and `--audio-report` still asserts the healthy path makes sound.

Re-break: delete the fallback with `?mute-tts=1` set → the probe must find a board with no readable
prompt (assert the focal zone has no text), not merely "a screenshot that looks fine".

---

## 7. Order, and what "done" means

1. **W1** — self-contained, highest value, no narration and no schema. Ship alone.
2. **W2** — needs W1's `requeue`. Ship alone.
3. **W3** — independent; its cost is entirely in verifying which lines are already baked.
4. **W4** — independent; touches `ttsClient` + two games.

Acceptance, all four: `npm test` green, `npm run lint` clean, and the measured numbers in §3.3 pinned as
literals rather than derived (a derived pin agrees with itself while the product regresses). Every new
guard gets the `/re-break` treatment against **what it measures**, not something adjacent.

Rung note for the final report: W1/W2/W3 are unit-testable and need no device. W4's fallback is rung 1
(Chrome + `?mute-tts=1`). Nothing here needs the owner's iPad, and nothing here changes narration
wording, so no listening pass is required unless §5.2 turns up an unbaked line.
