// The feedback door's two invariants: the Send button can't fire an empty message, and the label the
// support page tells a parent to look for is the label the component actually renders.
//
// The repo has no jsdom, so the dialog itself is unguardable. What IS guardable is the pure rule and
// the fact that the component reads it from here instead of re-typing it.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  FEEDBACK_ATTACHMENT_NOTE,
  FEEDBACK_ENTRY_LABEL,
  FEEDBACK_INTRO,
  FEEDBACK_MAX_CHARS,
  canSubmitFeedback,
} from './feedbackForm.ts'

const SRC = path.join(import.meta.dirname, '..')
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')

/** Comments are stripped first: a rule that is only satisfied by a comment ABOUT it is not satisfied. */
const codeOf = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

test('an empty or whitespace-only message cannot be sent', () => {
  assert.equal(canSubmitFeedback(''), false)
  assert.equal(canSubmitFeedback('   '), false)
  assert.equal(canSubmitFeedback('\n\t  \n'), false)
})

test('a real message can be sent', () => {
  assert.equal(canSubmitFeedback('Lyden forsvandt i Alfabetquiz'), true)
  // Leading/trailing whitespace must not disqualify an otherwise real message.
  assert.equal(canSubmitFeedback('  min søn elsker krokodillen  '), true)
  assert.equal(canSubmitFeedback('a'), true)
})

test('the cap is enforced on the TRIMMED message', () => {
  assert.equal(canSubmitFeedback('x'.repeat(FEEDBACK_MAX_CHARS)), true)
  assert.equal(canSubmitFeedback('x'.repeat(FEEDBACK_MAX_CHARS + 1)), false)
  // Whitespace padding must not push a legal message over the cap.
  assert.equal(canSubmitFeedback(`   ${'x'.repeat(FEEDBACK_MAX_CHARS)}   `), true)
})

test('the dialog enforces the rule rather than re-implementing it', () => {
  const dialog = codeOf('components/adult/FeedbackDialog.tsx')
  assert.match(dialog, /canSubmitFeedback/, 'FeedbackDialog must gate Send on canSubmitFeedback()')
  assert.doesNotMatch(
    dialog,
    /disabled=\{[^}]*note\.trim\(\)/,
    'the emptiness rule was re-typed inline — it lives in feedbackForm.ts so the test can reach it',
  )
})

test('the row, its aria-label and the dialog title all read from the one constant', () => {
  const settings = codeOf('components/adult/AdultSettings.tsx')
  const dialog = codeOf('components/adult/FeedbackDialog.tsx')

  assert.match(settings, /FEEDBACK_ENTRY_LABEL/, 'the rail-footer row must use the constant')
  assert.match(dialog, /FEEDBACK_ENTRY_LABEL/, 'the dialog title must use the same constant')

  // The old narrow label is why this feature exists. If it comes back anywhere, the support page's
  // instructions and this module disagree again.
  for (const file of ['components/adult/AdultSettings.tsx', 'components/adult/FeedbackDialog.tsx']) {
    assert.doesNotMatch(
      codeOf(file),
      /Rapportér et problem/,
      `${file} still renders the old narrow label`,
    )
  }
})

test('the copy is Danish prose, not a placeholder', () => {
  // These strings are the entire feature as a parent meets it; an empty one ships a blank dialog.
  assert.ok(FEEDBACK_ENTRY_LABEL.length > 0)
  assert.ok(FEEDBACK_INTRO.length > 30, 'the intro is too thin to explain what belongs here')
  assert.ok(
    FEEDBACK_ATTACHMENT_NOTE.length > 30,
    'the attachment note must say what is sent, in a parent’s words',
  )
  // It invites all three things. A narrow invitation is the defect this replaced.
  for (const word of ['Ros', 'idéer', 'ikke virker']) {
    assert.ok(FEEDBACK_INTRO.includes(word), `the intro never mentions ${word}`)
  }
})
