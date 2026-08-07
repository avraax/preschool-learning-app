// "May the guest book be handed to the child about to be created?" — one pure predicate.
//
// PURE AND NODE-IMPORTABLE by design: no `window`, no `localStorage`, no `Date.now()`, no `crypto`. The
// caller reads the state (the claimed flag, the guest document, the roster) and passes it in, so the
// decision can be unit-tested exhaustively without a DOM. Explicit `.ts` extensions for the same reason.
//
// WHY THE ANSWER IS ALMOST ALWAYS "NO" (adult-login-visibility PRD §6):
//
// The only safe adoption is a COPY onto a brand-new child with no server row. `api/progress.ts` stores a
// first PUT for a child that has no `profileProgress` row verbatim — no merge, no `baseRev` check, no
// anti-rollback — so the guest document simply BECOMES the child's first server version and no CRDT join
// ever runs. Every hazard is avoided rather than handled:
//
//   • `getDeviceId()` is per DEVICE, not per profile, so the guest book and any child book on this iPad
//     key their G-Counter ledger entry identically. `mergeLedger` takes a per-device `max`, so merging a
//     guest doc at 200 XP into a child at 300 XP yields 300, not 500 — silently. Copying onto an empty
//     target joins nothing, so it cannot fire.
//   • Re-keying the ledger under a synthetic device id to dodge that trips `wentBackwards` on the server
//     (any device entry that disappears or decreases is rejected) — a permanent 409 after three retries,
//     then a quiet, permanently dirty profile.
//
// Hence `rosterCount === 0`: an account that already has children is outside the free window, and we
// cannot know WHICH of those children the guest was anyway. That is a reasoned no, not a gap.

import { totalSlots, totalXp, type PersistedProgress } from './progressSchema.ts'
import { rewardNumber } from './progression.ts'

export interface GuestAdoptionInput {
  /** `guestBookClaimed()` — the device-scoped one-way flag. */
  claimed: boolean
  /** The guest book, already through `normalizePersisted` (a non-v4 blob arrives here as `null`). */
  guestDoc: PersistedProgress | null
  /** How many children the account has. Only ZERO is eligible — see the header. */
  rosterCount: number
  /**
   * Has a roster refresh ANSWERED yet? "No children" and "we haven't asked yet" are different states
   * (`.claude/rules/auth.md`), and reading `profiles.length === 0` directly has already shipped one bug.
   */
  rosterSettled: boolean
  /** A real session exists. Without one there is no account to adopt INTO. */
  hasSessionToken: boolean
}

export interface GuestAdoptionOffer {
  offer: boolean
  /**
   * The child-facing number of rewards in the guest book, for the hint copy. Derived through the pure
   * `rewardNumber()` — never `collectedFromLevel` recomputed inline, and never `globalLevel()`.
   */
  stickers: number
}

const NO_OFFER: GuestAdoptionOffer = { offer: false, stickers: 0 }

export function guestAdoptionOffer(input: GuestAdoptionInput): GuestAdoptionOffer {
  const { claimed, guestDoc, rosterCount, rosterSettled, hasSessionToken } = input

  if (claimed) return NO_OFFER
  if (!hasSessionToken) return NO_OFFER
  if (!rosterSettled) return NO_OFFER
  if (rosterCount !== 0) return NO_OFFER
  if (!guestDoc) return NO_OFFER
  // An untouched guest book is worth nothing and asking about it is pure noise.
  if (totalXp(guestDoc) <= 0) return NO_OFFER

  return { offer: true, stickers: rewardNumber(totalSlots(guestDoc)) }
}
