// Progression curves (Liveliness PRD-01) — the single source of the XP → level and XP → bloom math.
//
// PURE + unit-testable: no imports, no side effects, no store access. The progressStore stores only
// raw XP counters; every displayed level / bloom stage / ring fill is DERIVED here so it can never
// desync from the curve. Build/test scripts import this .ts directly (Node ≥22 strips types).

// ----- Global level curve --------------------------------------------------------------------
// 1-based level → XP required to advance from that level to the NEXT one (Liveliness PRD-04:
// "steady climb, climb forever"). A gentle linear ramp with a low floor and a soft cap so consistent
// effort earns a level at a steady pace: the first level-up lands inside a session or two, and late
// levels stay reachable (~4 rounds/level) instead of ballooning. No level cap — the number climbs
// forever; the companion just reaches its final visual form via companionStageForLevel.
//   L1→2 = 50, L2→3 = 60, L3→4 = 70 … capped at 160/level by ~L12.
export const xpToNext = (level: number): number =>
  Math.min(160, 50 + 10 * Math.max(0, level - 1))

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

// ----- Per-section bloom ---------------------------------------------------------------------
// Cumulative XP thresholds for bloom stages 0..4 (drives how alive a section's menu world looks).
export const BLOOM_STAGE_XP = [0, 40, 120, 260, 480] as const // stages 0..4
export const BLOOM_MAX_XP = 480

// Highest stage whose threshold the given bloom XP has reached (0..4).
export const bloomStage = (xp: number): number =>
  BLOOM_STAGE_XP.reduce<number>((acc, t, i) => (xp >= t ? i : acc), 0)

// 0..1 fill toward full bloom (BLOOM_MAX_XP), clamped.
export const bloomFill = (xp: number): number => Math.min(1, Math.max(0, xp) / BLOOM_MAX_XP)

// ----- Per-task XP (Liveliness PRD-04) --------------------------------------------------------
// XP is now earned PER COMPLETED TASK, live, in whatever game is being played (a question answered,
// a pair matched, a color board finished) — not lumped at round end. Base + a small first-try bonus,
// keyed by gameId (fallback 'default'), tuned so a few minutes of ANY game earns roughly comparable
// XP (per-game fairness). NEVER difficulty-dependent (fairness: no adaptive-difficulty leverage).
export const TASK_XP: Record<string, { base: number; firstTry: number }> = {
  default: { base: 3, firstTry: 1 }, // quiz question, math op, comparison, læsordet, english, mic
  'ordleg.spelling': { base: 4, firstTry: 2 }, // per completed word
  memory: { base: 2, firstTry: 0 }, // per matched pair (many per board; no first-try notion)
  'colors.farvejagt': { base: 6, firstTry: 2 }, // per completed board (big task)
  'colors.ramfarven': { base: 5, firstTry: 2 }, // per correct mix
  'colors.nuancer': { base: 5, firstTry: 2 }, // per completed shade-set
  'colors.quiz': { base: 3, firstTry: 1 }, // per question
  browse: { base: 1, firstTry: 0 }, // per NEW item explored
}

// XP for one completed task in `gameId`, with a first-try bonus. Difficulty never enters here.
export function taskXp(gameId: string, firstTry: boolean): number {
  const t = TASK_XP[gameId] ?? TASK_XP.default
  return t.base + (firstTry ? t.firstTry : 0)
}

// ----- Per-round XP (now BONUSES ONLY) --------------------------------------------------------
// Per-task XP is granted live during play (taskXp above), so the round END only adds the extras that
// can't be attributed to a single task: a perfect round, a new personal best, and a completed sticker
// page. Derived from round STRUCTURE only — never the difficulty setting (fairness). NO base, NO
// per-correct, NO per-sticker term (those would double-count the live per-task grants).
export interface RoundXpInput {
  correct: number // first-try-correct count in the round (kept for future tuning; unused here)
  total: number // round length (kept for future tuning; unused here)
  mistakes: number // wrong taps across the round
  anyNewBest: boolean // beat a personal best (streak/stars/count)
  stickerCount: number // stickers awarded this round (kept for shape; unused — no per-sticker XP)
  pageCompleted: boolean // a sticker set just completed (from a level-up trophy; see progressStore)
}

export function roundXp(i: RoundXpInput): number {
  let xp = 0
  if (i.mistakes === 0) xp += 6 // perfect-round bonus
  if (i.anyNewBest) xp += 8 // new personal best
  if (i.pageCompleted) xp += 15 // a sticker page just completed
  return xp
}
