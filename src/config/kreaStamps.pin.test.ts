import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KREA_STAMP_NAME } from './kreaStamps.ts'

// A bare "is" was read as the ENGLISH word (owner, 2026-10-17); "and", "sky" and "bold" have the same
// trap. Every picture name is said with its Danish article, which gives Azure the Danish context.
test('picture names carry their article, so Danish homographs of English words read as Danish', () => {
  for (const [id, name] of Object.entries(KREA_STAMP_NAME)) assert.match(name, /^(en|et) \S/, `${id}: "${name}"`)
  assert.equal(KREA_STAMP_NAME.is, 'en is')
  assert.equal(KREA_STAMP_NAME.and, 'en and')
  assert.equal(KREA_STAMP_NAME.hjerte, 'et hjerte')
})
