import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EntryClaim, WELCOME_LEAD_IN_MS, WELCOME_SETTLE_MS } from './entryPacing.ts'

// The arrival narration is paced by two silences (entryPacing.ts). What can break, and what each of
// these asserts:
//   · the silences are real and long enough to be the thing the owner asked for (not 0, not 50ms);
//   · a superseded claim reports false, so a welcome that was scheduled before the child tapped stays
//     quiet instead of cutting off their own audio;
//   · the CONTROLLER actually awaits them — a constant that nothing reads is the classic green-test-
//     broken-product shape, so the wiring is read out of the source.

test('the entry silences are long enough to change the pacing', () => {
  // The themed wipe's reveal is 220-340ms and the board charges in after it, so a lead-in under ~500ms
  // would still speak over an arriving board — which is the complaint this exists to answer.
  assert.ok(WELCOME_LEAD_IN_MS >= 500, `lead-in ${WELCOME_LEAD_IN_MS}ms is too short to clear the wipe`)
  assert.ok(WELCOME_SETTLE_MS >= 400, `settle ${WELCOME_SETTLE_MS}ms is not a breath`)
  // …and not so long the child is left waiting at a silent board.
  assert.ok(WELCOME_LEAD_IN_MS <= 1200, 'lead-in is long enough to read as a broken board')
  assert.ok(WELCOME_SETTLE_MS <= 1200, 'settle is long enough to read as a broken board')
})

test('a pause that keeps its claim resolves true', async () => {
  const entry = new EntryClaim()
  const token = entry.claim()
  assert.equal(await entry.pause(5, token), true)
})

test('a pause whose channel was taken resolves false', async () => {
  const entry = new EntryClaim()
  const token = entry.claim()
  const pending = entry.pause(10, token)
  entry.release() // the child tapped: their own audio now owns the channel
  assert.equal(await pending, false)
})

test('a later claim supersedes an earlier one', async () => {
  const entry = new EntryClaim()
  const first = entry.claim()
  const second = entry.claim() // e.g. a second board arriving
  const [a, b] = await Promise.all([entry.pause(5, first), entry.pause(5, second)])
  assert.equal(a, false)
  assert.equal(b, true)
})

test('a superseded pause still waits its full duration', async () => {
  // It must not settle early: resolving the moment it is released would let a superseded welcome race
  // the audio that superseded it, which is the exact ordering the no-queue engine exists to prevent.
  const entry = new EntryClaim()
  const token = entry.claim()
  const started = Date.now()
  const pending = entry.pause(60, token)
  entry.release()
  assert.equal(await pending, false)
  assert.ok(Date.now() - started >= 55, 'released pause settled early')
})

test('the audio controller actually awaits both silences around the welcome', () => {
  // Comments stripped first: a rule that greps source must not be satisfiable by the comment that
  // describes it (.claude/rules — working-in-this-tree).
  const src = readFileSync(new URL('./SimplifiedAudioController.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')

  const welcome = src.slice(src.indexOf('async playGameWelcome'))
  assert.ok(
    welcome.includes('await this.entry.pause(WELCOME_LEAD_IN_MS'),
    'playGameWelcome does not await the lead-in silence',
  )
  assert.ok(
    welcome.includes('await this.entry.pause(WELCOME_SETTLE_MS'),
    'playGameWelcome does not await the settle silence',
  )
  // And stopping playback must release the claim, or a tap during the lead-in cannot cancel a welcome.
  assert.ok(
    /stopCurrentAudio[\s\S]{0,400}this\.entry\.release\(\)/.test(src),
    'stopCurrentAudio does not release the entry claim',
  )
})
