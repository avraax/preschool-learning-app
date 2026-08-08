// Every group the shared enumeration emits must have a bucket in the /audit harness.
//
// WHY THIS EXISTS. `AuditHarness` buckets clips with `out[clip.group].push(clip)`, so a group with no
// bucket is `undefined.push` — inside a `useMemo`, i.e. during render, so it takes the ENTIRE /audit
// route down to the error boundary. It has now happened twice:
//
//   * `levelup`, with the reward ceremony's spoken line.
//   * `math` (921 clips) and `ordleg` (54), with 91e1020 on 2026-08-02 — undetected for six days.
//
// The second one is the reason this file exists rather than another comment. Nothing failed: the
// owner signs narration off with `npm run audit:approve-all`, and that CLI path reads
// `collectNarrationClips()` directly and never constructs a bucket. So the audit ledger kept
// reporting "all clips signed off" while the only surface that can actually PLAY a clip was dead.
// A guard that lives in a comment is not a guard.
//
// Deliberately asserted against the ENUMERATOR, not a hand-copied list: a literal list here would
// have to be updated by the same person who forgot to update `AuditGroup`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectNarrationClips } from '../../../shared-narration-clips.js'
import { GROUP_ORDER, GROUP_LABELS, emptyGroups } from './auditClips.ts'

test('every emitted narration group has a bucket, a label and a place in the order', () => {
  const emitted = [...new Set(collectNarrationClips().map((c) => c.group))].sort()
  assert.ok(emitted.length > 0, 'the enumerator produced no clips at all')

  const buckets = emptyGroups()
  const missing = emitted.filter((g) => !(g in buckets))
  assert.deepEqual(
    missing,
    [],
    `these groups would crash /audit on out[clip.group].push: ${missing.join(', ')}`,
  )

  for (const g of emitted) {
    assert.ok(GROUP_ORDER.includes(g as never), `${g} is bucketed but absent from GROUP_ORDER`)
    assert.ok(GROUP_LABELS[g as never], `${g} has no Danish label, so its section header is blank`)
  }
})

test('the bucket set is exactly GROUP_ORDER, so no group can be ordered-but-unbucketed', () => {
  // The two are derived from each other today; pinned so a future hand-written map can't drift.
  assert.deepEqual(Object.keys(emptyGroups()).sort(), [...GROUP_ORDER].sort())
  assert.deepEqual(Object.keys(GROUP_LABELS).sort(), [...GROUP_ORDER].sort())
})

test('a push into every emitted group succeeds — the exact operation that crashed', () => {
  // Asserting the KEY EXISTS is not the same as asserting the harness's own statement works: an
  // `undefined` value would satisfy `in` and still throw. This runs the real line.
  const buckets = emptyGroups() as Record<string, unknown[]>
  for (const clip of collectNarrationClips()) {
    assert.doesNotThrow(
      () => buckets[clip.group].push(clip),
      `out['${clip.group}'].push threw — /audit renders to the error boundary`,
    )
  }
})
