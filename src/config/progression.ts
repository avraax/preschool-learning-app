// Progression curves (Reward Book PRD-01) — the single source of the XP → reward-slot math.
//
// PURE + unit-testable: no imports, no side effects, no store access. The progressStore stores only
// raw XP counters; every displayed level / collected count / bloom stage is DERIVED here so it can
// never desync from the curve. Build/test scripts import this .ts directly (Node ≥22 strips types).
//
// THE MODEL (Reward Book PRD-01 D1): **trin ≡ sticker slot number**. There is one track. Reaching
// level N+1 awards reward-path slot N, so `collected === level - 1` always. The word "trin" never
// reaches the child — the level integer is an internal cursor for "how many rewards are owed".

// ----- The reward path shape ------------------------------------------------------------------
export const REWARD_XP = 40 // XP that equals one completed round
export const FAST_SLOTS = 9 // slots 1..9 land one-per-round — chapter 1 IS the tutorial page
export const CHAPTER_SIZE = 9

// How many baked companion growth stages every world ships (SceneAssets.companionStages).
// DELIBERATELY NOT the chapter count any more (Reward Horizon PRD-01 §3.2): the book grows by
// appending chapters, the companion art does not, so tying the clamp to CHAPTER_COUNT would index
// past the last baked stage the moment chapter 6 shipped. The companion finishes growing at chapter
// 5 and stays grown — it must never regress.
export const COMPANION_STAGES = 5

// NB `REWARD_SLOTS` / `CHAPTER_COUNT` live in stickers.ts now, DERIVED from REWARD_CHAPTERS, so a new
// chapter is content rather than engineering. They are not re-exported here on purpose: this module
// must not import stickers.ts (stickers.ts imports THIS one, and a cycle has to survive plain Node in
// shared-narration-clips.js as well as Vite).

// ----- Global level curve ---------------------------------------------------------------------
// 1-based level → XP required to advance from that level to the NEXT one. **Exactly two tiers, still**
// (Reward Pacing PRD-01 D3) — only the boundary and the multiplier moved, from 18/×2 to 9/×3.
//
// Chapter 1 (slots 1..9) costs one round each: dense-then-thin is the *recommended* shape for a token
// system, not a compromise — you establish the behaviour on continuous reinforcement, then thin the
// schedule (D2, §2.1). So the first page is a rule the child can experience: it fills one per round,
// and the page-complete beat is taught early. From slot 10 on a reward costs THREE rounds.
//
// The pacing promise this buys, measured (§4.1): the ring moves ~38% per round instead of ~115% —
// i.e. it is a progress meter rather than a spinner that resets — and the 72-slot book costs 7920 XP,
// ~172 rounds of ordinary play (~8 weeks at 3 rounds/day) instead of ~110.
//
// There is deliberately NO third, slower tier — that is the grind the extra chapters exist to avoid,
// and slowing further is the one direction the evidence says can't overshoot into harm (§2.2), which
// is why the answer to "still too fast" is a new chapter, never a fourth multiplier. The curve has no
// ceiling; the BOOK does (see `owedRewards`, which clamps at REWARD_SLOTS now the gold pass is gone).
export const xpToNext = (level: number): number =>
  level <= FAST_SLOTS ? REWARD_XP : REWARD_XP * 3

// Total lifetime XP needed to have been AWARDED n reward slots. DERIVED by walking the curve so a
// tier change can never leave a hand-copied multiplier behind: this exact expression was copied
// verbatim in four places (Reward Pacing PRD-01 D9), one of them the shipping `?rewards=n` dev seed —
// which would have silently seeded the WRONG XP for every seeded screenshot and verification walk.
// A wrong baseline is worse than a failing test, so this landed before the curve changed.
export const xpForSlots = (slots: number): number => {
  let xp = 0
  for (let level = 1; level <= Math.max(0, Math.floor(slots)); level++) xp += xpToNext(level)
  return xp
}

export interface LevelInfo {
  level: number // current 1-based level
  xpIntoLevel: number // XP accumulated inside the current level
  xpForThisLevel: number // XP span of the current level (== xpToNext(level))
  xpToNextLevel: number // XP still needed to reach the next level
}

// Walk the cumulative curve to convert lifetime XP → level + progress within it.
export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1
  let remaining = Math.max(0, Math.floor(totalXp))
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level++
  }
  const need = xpToNext(level)
  return { level, xpIntoLevel: remaining, xpForThisLevel: need, xpToNextLevel: need - remaining }
}

// ----- The ONE mapping (PRD §13: the only real hazard — never recompute this inline) -----------
// Level 1 = an empty book. Reaching level 2 awards slot 1 (index 0).
export const collectedFromLevel = (level: number): number => Math.max(0, level - 1)

// THE child-facing number (Reward Horizon PRD-01 §3.1). Equals the count of rewards in the book,
// always, on every surface. It is `grantedSlots` — what the ceremony has actually HANDED OVER — and
// never `collectedFromLevel(level)`, which is the debt CEILING and runs one ahead for the length of a
// pending ceremony. Since the ring is the door into the book, a one-off disagreement between the ring
// badge and the book header is a very likely path; this definition makes it impossible.
export const rewardNumber = (grantedSlots: number): number =>
  Math.max(0, Math.floor(grantedSlots))

// 0-based slot index → its chapter index (0-based, unbounded — the book can grow).
export const chapterOfSlot = (slotIndex0: number): number =>
  Math.floor(Math.max(0, slotIndex0) / CHAPTER_SIZE)

// Companion growth stage from the collected count: one stage per chapter, clamped at the last BAKED
// stage (COMPANION_STAGES, not the chapter count — see the constant). Monotone non-decreasing: the
// companion grows and then stays grown, never regresses.
export const companionStageForCollected = (collected: number): number =>
  Math.min(COMPANION_STAGES - 1, Math.floor(Math.max(0, collected) / CHAPTER_SIZE))

// ----- Per-section bloom (UNCHANGED — Reward Book D7 leaves the world alone) -------------------
// Cumulative XP thresholds for bloom stages 0..4 (drives how alive a section's menu world looks).
export const BLOOM_STAGE_XP = [0, 40, 120, 260, 480] as const // stages 0..4
export const BLOOM_MAX_XP = 480

// Highest stage whose threshold the given bloom XP has reached (0..4).
export const bloomStage = (xp: number): number =>
  BLOOM_STAGE_XP.reduce<number>((acc, t, i) => (xp >= t ? i : acc), 0)

// 0..1 fill toward full bloom (BLOOM_MAX_XP), clamped.
export const bloomFill = (xp: number): number => Math.min(1, Math.max(0, xp) / BLOOM_MAX_XP)

// ----- Per-task XP ----------------------------------------------------------------------------
// XP is earned PER COMPLETED TASK, live, in whatever game is being played (a question answered, a
// pair matched, a color board finished). Reward Book PRD-01 §5 replaced the old per-game weight
// table with "a round is a round": one task is worth REWARD_XP / tasksInRound, so ANY completed
// round is worth ≈ REWARD_XP regardless of how it's subdivided. That's both fairer across games and
// self-balancing — the pacing promise ("chapters 1-2: one reward per round") holds everywhere.
// NEVER difficulty-dependent (fairness: no adaptive-difficulty leverage).
export const taskXp = (tasksInRound: number, firstTry: boolean): number =>
  Math.max(1, Math.ceil(REWARD_XP / Math.max(1, tasksInRound))) + (firstTry ? 1 : 0)

// XP per NEW browse item, once ever (browse screens have no round to normalise against).
export const BROWSE_TASK_XP = 2

// ----- Per-round XP (BONUSES ONLY) ------------------------------------------------------------
// Per-task XP is granted live during play (taskXp above), so the round END only adds the extras
// that can't be attributed to a single task: a perfect round and a new personal best. They carry
// into the NEXT reward rather than granting one. Derived from round STRUCTURE only — never the
// difficulty setting (fairness).
export interface RoundXpInput {
  mistakes: number // wrong taps across the round
  anyNewBest: boolean // beat a personal best (streak/stars/count)
}

export function roundXp(i: RoundXpInput): number {
  let xp = 0
  if (i.mistakes === 0) xp += 6 // perfect-round bonus
  if (i.anyNewBest) xp += 8 // new personal best
  return xp
}

// The largest XP a single round can produce: a full 8-task round with every answer first-try
// (8 × taskXp(8,true) = 48) + the perfect bonus (6) + a new personal best (8) = 62.
//
// NB the PRD quotes 54 here, having treated "perfect" and "new best" as alternatives; they aren't —
// a perfect round very often IS a new best (3★ / 8 correct).
//
// A single round can cross two slots only while a slot costs ≤ 62, i.e. **only inside the fast tier**
// now that the slow tier is 120/slot. Past slot 9 the trailing-grant path in `RewardOverlay` is
// therefore unreachable from play — and it is KEPT anyway (Reward Pacing PRD-01 §4.2): it is still
// the net for a cross-device CRDT merge (the XP ledger is a G-Counter, so two devices that each
// played offline sum), and `grantPendingRewards()` handing over every owed slot in ONE commit is a
// load-bearing invariant, not an optimisation for the rare double.
export const MAX_ROUND_XP = 62
