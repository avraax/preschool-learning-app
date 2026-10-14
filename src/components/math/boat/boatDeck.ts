// Fyld Båden's deck — the ONE model both gestures resolve through (Harbour PRD-01 §4.4).
//
// Pure and Node-importable on purpose: a drag onto the deck and a tap on a quay pile both call
// `loadDeck`; a drag back to the quay and a tap on a loaded item both call `unloadDeck`. The component
// only renders this state, so tap/drag parity is a property of the call sites, not of two code paths.
//
// The ones are single FISH and the tens are a FISH BOX holding ten (owner, 2026-10-14 — pallets and
// crates were replaced: a 5-year-old doesn't know what a pallet is). The 10th single fish is PACKED
// into one box (owner, 2026-10-13: "ti enere er én tier" is the place-value moment the game exists
// for). Unloading a box returns it whole — no unpacking. The deck holds at most 100 (ten boxes), the
// highest number a boat can ask for.

export type CargoKind = 'box' | 'fish'

export interface DeckState {
  /** Fish boxes (ten each) on the deck, 0–10. */
  boxes: number
  /** Single fish on the deck, 0–9 (a 10th is packed into a box). */
  fish: number
}

/** Slots per bay — both bays are 2×5 ten-frames. */
export const BAY_SLOTS = 10
export const DECK_MAX = BAY_SLOTS * 10

export const EMPTY_DECK: DeckState = { boxes: 0, fish: 0 }

/** What a load did, so the board can pick the matching sound and animation. */
export type LoadOutcome = 'loaded' | 'bundled' | 'full'
export type UnloadOutcome = 'unloaded' | 'empty'

export function loadDeck(deck: DeckState, kind: CargoKind): { deck: DeckState; outcome: LoadOutcome } {
  // The cap is on the VALUE, not the box count: 10 boxes beside 5 fish would be 105, a number no boat
  // can ask for (found by the WebKit gesture probe, 2026-10-13).
  if (deckValue(deck) + (kind === 'box' ? 10 : 1) > DECK_MAX) return { deck, outcome: 'full' }
  if (kind === 'box') return { deck: { ...deck, boxes: deck.boxes + 1 }, outcome: 'loaded' }
  if (deck.fish + 1 === BAY_SLOTS) return { deck: { boxes: deck.boxes + 1, fish: 0 }, outcome: 'bundled' }
  return { deck: { ...deck, fish: deck.fish + 1 }, outcome: 'loaded' }
}

export function unloadDeck(deck: DeckState, kind: CargoKind): { deck: DeckState; outcome: UnloadOutcome } {
  const key = kind === 'box' ? 'boxes' : 'fish'
  if (deck[key] === 0) return { deck, outcome: 'empty' }
  return { deck: { ...deck, [key]: deck[key] - 1 }, outcome: 'unloaded' }
}

export const deckValue = (deck: DeckState): number => deck.boxes * 10 + deck.fish

export const isDeckEmpty = (deck: DeckState): boolean => deck.boxes === 0 && deck.fish === 0

/** The exact load for `n` — what the hint's ghost outlines show (§2.1.7). */
export const ghostFor = (n: number): DeckState => ({ boxes: Math.floor(n / 10), fish: n % 10 })
