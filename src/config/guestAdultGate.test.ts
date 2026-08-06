// The guest parental gate (App Store PRD §3.2 / A1).
//
// The property that matters is not "the arithmetic is right" — it is that the gate is HARDER THAN THE
// CHILD and reachable by the adult. Those are the two ways it can fail, and only one of them is loud.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  ANSWER_DIGITS,
  isGuestAnswerCorrect,
  makeGuestChallenge,
  OPERAND_MAX,
  OPERAND_MIN,
} from './guestAdultGate.ts'

const SRC = path.join(import.meta.dirname, '..')

const codeOf = (rel: string): string =>
  readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Deterministic `rand` so the sweep below is exhaustive rather than lucky. */
const seq = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

test('the challenge is always multiplication of two operands in range', () => {
  for (let a = 0; a < 1; a += 0.05) {
    for (let b = 0; b < 1; b += 0.05) {
      const c = makeGuestChallenge(seq([a, b]))
      assert.ok(c.a >= OPERAND_MIN && c.a <= OPERAND_MAX, `a out of range: ${c.a}`)
      assert.ok(c.b >= OPERAND_MIN && c.b <= OPERAND_MAX, `b out of range: ${c.b}`)
      assert.equal(c.answer, c.a * c.b)
    }
  }
})

test('every possible answer has exactly ANSWER_DIGITS digits', () => {
  // Load-bearing: the entry auto-submits on the last digit, so a one- or three-digit answer would be
  // either unsubmittable or submitted early. This is why OPERAND_MIN is 4 and not 2.
  for (let a = OPERAND_MIN; a <= OPERAND_MAX; a++) {
    for (let b = OPERAND_MIN; b <= OPERAND_MAX; b++) {
      assert.equal(
        String(a * b).length,
        ANSWER_DIGITS,
        `${a} × ${b} = ${a * b} does not have ${ANSWER_DIGITS} digits`,
      )
    }
  }
})

test('the gate is beyond a 5-year-old: no operand is trivially small', () => {
  // Calibrated against the real child (5, counts to 60-70, adds to 20 on his fingers, no
  // multiplication). ×1, ×2 and ×3 are the ones a child can reach by counting or doubling, so the
  // floor exists to exclude them. A "simplification" back to 2..9 would quietly make ×2 answerable.
  assert.ok(OPERAND_MIN >= 4, `OPERAND_MIN is ${OPERAND_MIN} — ×2 and ×3 are countable`)
  const smallest = OPERAND_MIN * OPERAND_MIN
  assert.ok(smallest >= 16, `the easiest question is ${OPERAND_MIN} × ${OPERAND_MIN} = ${smallest}`)
})

test('the answer check tolerates what a real keypad produces', () => {
  const c = makeGuestChallenge(seq([0, 0])) // 4 × 4 = 16
  assert.equal(c.answer, 16)
  assert.equal(isGuestAnswerCorrect('16', c), true)
  assert.equal(isGuestAnswerCorrect(' 16 ', c), true)
  assert.equal(isGuestAnswerCorrect('17', c), false)
  assert.equal(isGuestAnswerCorrect('', c), false)
  assert.equal(isGuestAnswerCorrect('abc', c), false)
})

test('the prompt uses the multiplication SIGN, not the letter x', () => {
  // The letter x is read aloud as a letter by screen readers and looks like a variable; U+00D7 is the
  // operator. This app is Danish and typographically fussy on purpose.
  const c = makeGuestChallenge(seq([0.5, 0.5]))
  assert.ok(c.prompt.includes('×'), `prompt uses the wrong glyph: ${c.prompt}`)
  assert.ok(!/\dx\d|\d x \d/.test(c.prompt), `prompt uses the letter x: ${c.prompt}`)
})

test('a guest reaches the adult gate INSTEAD of the PIN, and the PIN path is untouched', () => {
  // The bug this closes: `requirePin` routed a guest to the LOCAL verifier, which is only cached after
  // an ONLINE verify, so it fell through to a server with no account — locking a guest out of "Til de
  // voksne" entirely, and with it the difficulty, the privacy links and the way to sign in.
  const code = codeOf('contexts/AuthContext.tsx')
  const guestAt = code.indexOf("snapshot.phase === 'guest'")
  const verifierAt = code.indexOf('pinVerifierFor(reason')
  assert.ok(guestAt > 0, 'requirePin does not branch on the guest phase')
  assert.ok(guestAt < verifierAt, 'the guest branch sits after the PIN routing it is meant to replace')
  // …and the dev bypass still wins over both, or every headless recipe grows a gate.
  assert.ok(code.indexOf('isDevBypass()') < guestAt)
})

test('the DEV bypass is detected at construction, so auto-guest cannot pre-empt it', () => {
  // Found while capturing App Store screenshots: React runs a CHILD's effect before its parent's, and
  // `AuthGate.GateBody` (hydrate) is a child of `AuthProvider` (boot). That was harmless while a
  // session-less device started `signedOut` — the gate blocked and hydrate early-returned. Auto-guest
  // unblocks the gate on the FIRST render, so hydrate began running before boot, `isDevBypass()` was
  // still false, and `?nogate=1` silently attached the guest child instead of DEV_PROFILE. Every
  // headless recipe kept working, which is exactly why this needs a test rather than a fix.
  const code = readFileSync(path.join(SRC, 'services/authStore.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  const ctorAt = code.indexOf('constructor()')
  const bootAt = code.indexOf('boot(): void')
  const detectAt = code.indexOf('this.devBypass = detectDevBypass()')
  assert.ok(ctorAt > 0 && bootAt > ctorAt, 'constructor/boot moved — re-point this guard')
  assert.ok(detectAt > ctorAt && detectAt < bootAt, 'the dev bypass is no longer detected in the constructor')
  // …and auto-guest must not run under it, or a harness load leaves the browser in guest mode for
  // every later non-harness load.
  assert.match(code, /if \(!this\.devBypass && shouldAutoGuest\(\)/)
})

test('a new question on every open, and after every wrong answer', () => {
  // The only realistic attack: a child watches the adult once and repeats the taps.
  const code = codeOf('components/auth/GuestAdultGate.tsx')
  assert.match(code, /setNonce\(\(n\) => n \+ 1\)/, 'the challenge is never re-rolled')
  // Once in the open effect, once in the wrong branch.
  const rolls = code.match(/setNonce\(\(n\) => n \+ 1\)/g) ?? []
  assert.ok(rolls.length >= 2, `only ${rolls.length} re-roll site(s) — open and wrong-answer both need one`)
})

test('the gate always settles its promise', () => {
  // A `requirePin` that never resolves is a dead adult menu with no error anywhere — a failure shape
  // this repo has shipped before. Cancel must resolve false, not simply close.
  const dialogs = codeOf('components/auth/AuthDialogs.tsx')
  assert.match(dialogs, /r\?\.\(ok\)/, 'the resolver is not called')
  const gate = codeOf('components/auth/GuestAdultGate.tsx')
  assert.match(gate, /onClose=\{\(\) => onResolve\(false\)\}/, 'dismissing the dialog never resolves')
  assert.match(gate, /onClick=\{\(\) => onResolve\(false\)\}/, 'Annullér never resolves')
})
