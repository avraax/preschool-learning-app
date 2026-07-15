// Progression curves (Liveliness PRD-01) — the single source of the XP → level and XP → bloom math.
//
// PURE + unit-testable: no imports, no side effects, no store access. The progressStore stores only
// raw XP counters; every displayed level / bloom stage / ring fill is DERIVED here so it can never
// desync from the curve. Build/test scripts import this .ts directly (Node ≥22 strips types).

// ----- Global level curve --------------------------------------------------------------------
// 1-based level → XP required to advance from that level to the NEXT one. Grows with level so the
// first level-ups come fast (inside the first round) and later ones settle to ~one per 8–10 rounds,
// capped at 260 so late levels stay reachable in a session or two (never asymptotic).
export const xpToNext = (level: number): number =>
  Math.min(260, Math.max(20, Math.round(20 + 15 * Math.pow(Math.max(0, level - 1), 1.25))))

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

// ----- Per-round XP ---------------------------------------------------------------------------
// Derived from round STRUCTURE only — never from the difficulty setting or star thresholds
// (fairness: no adaptive difficulty leverage on XP). A weak round still yields visible movement.
export interface RoundXpInput {
  correct: number // first-try-correct count in the round
  total: number // round length (unused by the formula today; kept for future tuning)
  mistakes: number // wrong taps across the round
  anyNewBest: boolean // beat a personal best (streak/stars/count)
  stickerCount: number // stickers awarded this round
  pageCompleted: boolean // a sticker set just completed
}

export function roundXp(i: RoundXpInput): number {
  let xp = 8 // base for completing a round
  xp += 2 * Math.max(0, i.correct) // per first-try-correct
  if (i.mistakes === 0) xp += 6 // perfect-round bonus
  if (i.anyNewBest) xp += 8 // new personal best
  xp += 3 * Math.max(0, i.stickerCount)
  if (i.pageCompleted) xp += 15
  return xp
}
