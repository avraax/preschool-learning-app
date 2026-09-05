// The parental gate for GUEST play — a local arithmetic challenge, no account required.
//
// WHY THIS EXISTS AT ALL. A1 makes the app playable with no account, and that immediately orphans the
// adult area: `requirePin` routes `adultMenu` to the LOCAL verifier, the local verifier is cached only
// after a successful ONLINE verify (`.claude/rules/auth.md`), and a guest has never had a session — so
// the PIN path falls through to the server, which has no account to check against. A guest could
// therefore never open "Indstillinger" at all: no difficulty, no sound settings, no bug report, no
// privacy links, and no way to sign in. That would make the guest path PARTIAL, which is exactly the
// residual rejection risk the App Store PRD names in §5 item 3.
//
// AND A PIN WOULD BE THE WRONG SHAPE ANYWAY. Apple's own definition of a parental gate is "adult-level
// tasks that must be completed in order to continue using your app or game"
// (https://developer.apple.com/kids/) — a task, not a secret. A guest has no secret to have set. So the
// gate for an account-less device is the classic Kids Category arithmetic challenge.
//
// THE DIFFICULTY IS CALIBRATED AGAINST A REAL CHILD, not against an abstraction: the owner's son is 5,
// counts to 60-70, adds to 20 on his fingers, and does basic subtraction. He cannot multiply. So
// multiplication is the right operation, and both operands are >= 4 — which also makes every product
// two digits (16..81), so the entry has a fixed length and can submit itself on the second digit
// exactly as the PIN pad does on the fourth.
//
// This does NOT replace the PIN for an account holder. A signed-in adult keeps the PIN, which is
// stronger (a child can eventually learn 6 x 7; the PIN is a secret). This is the account-less case only.
//
// PURE + Node-importable: no React, no DOM, no `Math.random` at module scope.

export interface GuestChallenge {
  a: number
  b: number
  answer: number
  /** Danish, as the adult reads it. The multiplication sign is U+00D7, not the letter x. */
  prompt: string
}

/** Both operands are in this range, so every product is exactly two digits. */
export const OPERAND_MIN = 4
export const OPERAND_MAX = 9

/** Every answer has exactly this many digits — the entry auto-submits on the last one. */
export const ANSWER_DIGITS = 2

/**
 * Build a challenge. `rand` is injected (a `() => number` in [0,1)) so the generator is testable and so
 * this module stays free of `Math.random`, which the workflow/test environment forbids at module scope.
 */
export function makeGuestChallenge(rand: () => number = Math.random): GuestChallenge {
  const span = OPERAND_MAX - OPERAND_MIN + 1
  const a = OPERAND_MIN + Math.floor(rand() * span)
  const b = OPERAND_MIN + Math.floor(rand() * span)
  return { a, b, answer: a * b, prompt: `Hvor meget er ${a} × ${b}?` }
}

/**
 * Check a typed answer. Takes the raw string so the caller does no parsing of its own — a leading zero
 * or a stray space must not be the difference between an adult getting in and not.
 */
export function isGuestAnswerCorrect(typed: string, challenge: GuestChallenge): boolean {
  const n = Number.parseInt(typed.trim(), 10)
  return Number.isFinite(n) && n === challenge.answer
}
