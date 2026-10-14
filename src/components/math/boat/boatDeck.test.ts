import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BAY_SLOTS, DECK_MAX, EMPTY_DECK, deckValue, ghostFor, loadDeck, unloadDeck, type DeckState } from './boatDeck.ts'

const loadN = (deck: DeckState, kind: 'box' | 'fish', n: number): DeckState => {
  for (let i = 0; i < n; i++) deck = loadDeck(deck, kind).deck
  return deck
}

test('the 10th single fish is packed into one box — the place-value moment', () => {
  const nine = loadN(EMPTY_DECK, 'fish', 9)
  assert.deepEqual(nine, { boxes: 0, fish: 9 })
  const r = loadDeck(nine, 'fish')
  assert.equal(r.outcome, 'bundled')
  assert.deepEqual(r.deck, { boxes: 1, fish: 0 })
  assert.equal(deckValue(r.deck), 10)
})

test('single fish never exceed 9 on the deck, at any box count', () => {
  let deck = EMPTY_DECK
  for (let i = 0; i < 200; i++) {
    deck = loadDeck(deck, 'fish').deck
    assert.ok(deck.fish < BAY_SLOTS, `fish reached ${deck.fish}`)
  }
})

test('the deck caps at 100: a 10-box deck refuses both kinds, and 99 + 1 fish packs to 100', () => {
  assert.equal(DECK_MAX, 100)
  const full = loadN(EMPTY_DECK, 'box', 12)
  assert.deepEqual(full, { boxes: 10, fish: 0 })
  assert.equal(loadDeck(full, 'box').outcome, 'full')
  assert.equal(loadDeck(full, 'fish').outcome, 'full')
  assert.deepEqual(loadDeck(full, 'fish').deck, full)
  const ninetyNine = loadN(loadN(EMPTY_DECK, 'box', 9), 'fish', 9)
  assert.equal(deckValue(ninetyNine), 99)
  const r = loadDeck(ninetyNine, 'fish')
  assert.equal(r.outcome, 'bundled')
  assert.equal(deckValue(r.deck), 100)
})

test('the deck can never hold more than 100, in any load order', () => {
  const mixed = loadN(loadN(EMPTY_DECK, 'fish', 5), 'box', 12)
  assert.deepEqual(mixed, { boxes: 9, fish: 5 })
  assert.equal(deckValue(mixed), 95)
  assert.equal(loadDeck(mixed, 'box').outcome, 'full')
  // Every interleaving of 300 loads stays ≤ 100.
  let deck = EMPTY_DECK
  for (let i = 0; i < 300; i++) {
    deck = loadDeck(deck, (i * 7) % 3 === 0 ? 'box' : 'fish').deck
    assert.ok(deckValue(deck) <= DECK_MAX, `reached ${deckValue(deck)}`)
  }
})

test('unloading a box returns it whole — no unpacking', () => {
  const deck = { boxes: 3, fish: 7 }
  const r = unloadDeck(deck, 'box')
  assert.deepEqual(r.deck, { boxes: 2, fish: 7 })
  assert.equal(unloadDeck(deck, 'fish').deck.fish, 6)
  assert.equal(unloadDeck(EMPTY_DECK, 'box').outcome, 'empty')
  assert.equal(unloadDeck(EMPTY_DECK, 'fish').outcome, 'empty')
  assert.deepEqual(unloadDeck(EMPTY_DECK, 'fish').deck, EMPTY_DECK)
})

test('every number 1–100 is buildable, and the ghost is exactly that build', () => {
  for (let n = 1; n <= 100; n++) {
    const g = ghostFor(n)
    assert.ok(g.boxes <= BAY_SLOTS && g.fish < BAY_SLOTS)
    assert.equal(deckValue(g), n)
    assert.deepEqual(loadN(loadN(EMPTY_DECK, 'box', g.boxes), 'fish', g.fish), g)
  }
  assert.deepEqual(ghostFor(37), { boxes: 3, fish: 7 })
})
