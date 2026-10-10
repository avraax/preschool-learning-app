import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_STORE_ID, WRITE_REVIEW_URL } from './storeReview.ts'

test('the rating row opens the PRODUCTION app on the write-review sheet', () => {
  const url = new URL(WRITE_REVIEW_URL)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, 'apps.apple.com')
  assert.equal(url.pathname, `/app/id${APP_STORE_ID}`)
  assert.equal(url.searchParams.get('action'), 'write-review')
  // `com.vraa.earlylearning`'s ASC record. The staging app (6799489044) is never on the store, so a
  // review link to it would be a dead page.
  assert.equal(APP_STORE_ID, '6799119188')
})
