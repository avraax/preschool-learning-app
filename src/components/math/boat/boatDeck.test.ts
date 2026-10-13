import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BAY_SLOTS, DECK_MAX, EMPTY_DECK, deckValue, ghostFor, loadDeck, unloadDeck, type DeckState } from './boatDeck.ts'

const loadN = (deck: DeckState, kind: 'pallet' | 'crate', n: number): DeckState => {
  for (let i = 0; i < n; i++) deck = loadDeck(deck, kind).deck
  return deck
}

test('the 10th single crate bundles into one pallet — the place-value moment', () => {
  const nine = loadN(EMPTY_DECK, 'crate', 9)
  assert.deepEqual(nine, { pallets: 0, crates: 9 })
  const r = loadDeck(nine, 'crate')
  assert.equal(r.outcome, 'bundled')
  assert.deepEqual(r.deck, { pallets: 1, crates: 0 })
  assert.equal(deckValue(r.deck), 10)
})

test('crates never exceed 9 on the deck, at any pallet count', () => {
  let deck = EMPTY_DECK
  for (let i = 0; i < 200; i++) {
    deck = loadDeck(deck, 'crate').deck
    assert.ok(deck.crates < BAY_SLOTS, `crates reached ${deck.crates}`)
  }
})

test('the deck caps at 100: a 10-pallet deck refuses both kinds, and 99 + 1 crate bundles to 100', () => {
  assert.equal(DECK_MAX, 100)
  const full = loadN(EMPTY_DECK, 'pallet', 12)
  assert.deepEqual(full, { pallets: 10, crates: 0 })
  assert.equal(loadDeck(full, 'pallet').outcome, 'full')
  assert.equal(loadDeck(full, 'crate').outcome, 'full')
  assert.deepEqual(loadDeck(full, 'crate').deck, full)
  const ninetyNine = loadN(loadN(EMPTY_DECK, 'pallet', 9), 'crate', 9)
  assert.equal(deckValue(ninetyNine), 99)
  const r = loadDeck(ninetyNine, 'crate')
  assert.equal(r.outcome, 'bundled')
  assert.equal(deckValue(r.deck), 100)
})

test('the deck can never hold more than 100, in any load order', () => {
  const mixed = loadN(loadN(EMPTY_DECK, 'crate', 5), 'pallet', 12)
  assert.deepEqual(mixed, { pallets: 9, crates: 5 })
  assert.equal(deckValue(mixed), 95)
  assert.equal(loadDeck(mixed, 'pallet').outcome, 'full')
  // Every interleaving of 300 random loads stays ≤ 100.
  let deck = EMPTY_DECK
  for (let i = 0; i < 300; i++) {
    deck = loadDeck(deck, (i * 7) % 3 === 0 ? 'pallet' : 'crate').deck
    assert.ok(deckValue(deck) <= DECK_MAX, `reached ${deckValue(deck)}`)
  }
})

test('unloading a pallet returns it whole — no un-bundling', () => {
  const deck = { pallets: 3, crates: 7 }
  const r = unloadDeck(deck, 'pallet')
  assert.deepEqual(r.deck, { pallets: 2, crates: 7 })
  assert.equal(unloadDeck(deck, 'crate').deck.crates, 6)
  assert.equal(unloadDeck(EMPTY_DECK, 'pallet').outcome, 'empty')
  assert.equal(unloadDeck(EMPTY_DECK, 'crate').outcome, 'empty')
  assert.deepEqual(unloadDeck(EMPTY_DECK, 'crate').deck, EMPTY_DECK)
})

test('every number 1–100 is buildable, and the ghost is exactly that build', () => {
  for (let n = 1; n <= 100; n++) {
    const g = ghostFor(n)
    assert.ok(g.pallets <= BAY_SLOTS && g.crates < BAY_SLOTS)
    assert.equal(deckValue(g), n)
    assert.deepEqual(loadN(loadN(EMPTY_DECK, 'pallet', g.pallets), 'crate', g.crates), g)
  }
  assert.deepEqual(ghostFor(37), { pallets: 3, crates: 7 })
})
