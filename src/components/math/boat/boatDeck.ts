// Fyld Båden's deck — the ONE model both gestures resolve through (Harbour PRD-01 §4.4).
//
// Pure and Node-importable on purpose: a drag onto the deck and a tap on a quay pile both call
// `loadDeck`; a drag back to the quay and a tap on a loaded item both call `unloadDeck`. The component
// only renders this state, so tap/drag parity is a property of the call sites, not of two code paths.
//
// The 10th single crate BUNDLES into one pallet (owner, 2026-10-13: "ti enere er én tier" is the
// place-value moment the game exists for). Unloading a pallet returns it whole — there is no
// un-bundling. The deck holds at most 100 (ten pallets), the highest number a boat can ask for.

export type CargoKind = 'pallet' | 'crate'

export interface DeckState {
  /** Pallets of ten on the deck, 0–10. */
  pallets: number
  /** Single crates on the deck, 0–9 (a 10th bundles). */
  crates: number
}

/** Slots per bay — both bays are 2×5 ten-frames. */
export const BAY_SLOTS = 10
export const DECK_MAX = BAY_SLOTS * 10

export const EMPTY_DECK: DeckState = { pallets: 0, crates: 0 }

/** What a load did, so the board can pick the matching sound and animation. */
export type LoadOutcome = 'loaded' | 'bundled' | 'full'
export type UnloadOutcome = 'unloaded' | 'empty'

export function loadDeck(deck: DeckState, kind: CargoKind): { deck: DeckState; outcome: LoadOutcome } {
  if (deck.pallets >= BAY_SLOTS) return { deck, outcome: 'full' }
  if (kind === 'pallet') return { deck: { ...deck, pallets: deck.pallets + 1 }, outcome: 'loaded' }
  if (deck.crates + 1 === BAY_SLOTS) return { deck: { pallets: deck.pallets + 1, crates: 0 }, outcome: 'bundled' }
  return { deck: { ...deck, crates: deck.crates + 1 }, outcome: 'loaded' }
}

export function unloadDeck(deck: DeckState, kind: CargoKind): { deck: DeckState; outcome: UnloadOutcome } {
  const key = kind === 'pallet' ? 'pallets' : 'crates'
  if (deck[key] === 0) return { deck, outcome: 'empty' }
  return { deck: { ...deck, [key]: deck[key] - 1 }, outcome: 'unloaded' }
}

export const deckValue = (deck: DeckState): number => deck.pallets * 10 + deck.crates

export const isDeckEmpty = (deck: DeckState): boolean => deck.pallets === 0 && deck.crates === 0

/** The exact load for `n` — what the hint's ghost outlines show (§2.1.7). */
export const ghostFor = (n: number): DeckState => ({ pallets: Math.floor(n / 10), crates: n % 10 })
