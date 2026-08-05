// The "Til de voksne" information architecture (Settings PRD-01 §3 + §12) — as DATA, so it can be
// guarded by a test.
//
// The repo has no jsdom and no component rendering, so the settings surface itself is unguardable.
// What IS guardable is its structure: five mutually-exclusive groups, no ambiguous group name, and —
// the one with real teeth — that every ACCOUNT-scoped destructive action is verified against the
// SERVER, never downgraded to the ~5-minute local unlock that merely opened the menu.
//
// This module is the DECLARATION, not the implementation: the panes render from their own code. It
// exists to state the intended shape in a form a plain-Node test can read, and the group labels /
// rail order below ARE consumed by `AdultSettings.tsx`, so the two can't silently diverge on the
// part that is shared.
//
// PURE + Node-importable: no React, no DOM. Explicit `.ts` on the relative import — Node's ESM
// resolver rejects extensionless specifiers.

import type { PinReason } from './pinReasons.ts'

export type AdultGroupId = 'barn' | 'laering' | 'lyd' | 'udseende' | 'konto'

/**
 * How a destructive action proves the adult.
 *
 * `pinPad` means the CURRENT PIN is typed at the moment of the action and verified server-side
 * (account deletion). That is strictly stronger than any `requirePin` reason, so the test accepts it
 * for account-scoped items.
 */
export type AdultVerification =
  | { kind: 'requirePin'; reason: PinReason }
  | { kind: 'pinPad' }

export interface AdultItem {
  /** Stable id, unique across the WHOLE surface. */
  id: string
  /** Danish label as the adult reads it. */
  label: string
  /** Destroys something. Gets a `color="error"` strip at the bottom of its pane (§7). */
  destructive?: boolean
  /**
   * Whose data a destructive action destroys. `child` = this device's local copy of one child's
   * book; `account` = a credential, a session, or the account itself.
   */
  scope?: 'child' | 'account'
  /** Required on every destructive item. */
  verify?: AdultVerification
  /**
   * The result cannot be undone from inside the app. Signing out is destructive but NOT this — you
   * log back in. A reset is: `resetAll()` bumps `sync.epoch` precisely so the next pull cannot
   * resurrect the book.
   */
  irreversible?: boolean
  /**
   * The word the adult must TYPE before the confirm's action button enables. Read by the pane that
   * renders the confirm, so the declaration below and the shipped dialog cannot drift apart.
   *
   * The PIN answers "is this an adult?" and is often already satisfied by the ~5-minute unlock
   * window; this answers "did you mean to?". See `panes/DestructiveConfirmDialog.tsx`.
   */
  typeToConfirm?: string
}

export interface AdultGroup {
  id: AdultGroupId
  /** A single-word Danish noun. Material bans ambiguous section names — see AMBIGUOUS_LABELS. */
  label: string
  items: AdultItem[]
}

/** Group names a settings surface may never use (Material: no "Other"/"Misc"). */
export const AMBIGUOUS_LABELS = ['andet', 'diverse', 'øvrigt', 'øvrige', 'mere'] as const

/**
 * The rail, top to bottom. Ordered by frequency of use; destructive last WITHIN each pane.
 * `AdultSettings.tsx` renders its rail from this array.
 */
export const ADULT_IA: AdultGroup[] = [
  {
    id: 'barn',
    label: 'Barn',
    items: [
      { id: 'barn.active', label: 'Aktivt barn' },
      { id: 'barn.summary', label: 'Sådan går det' },
      // Switching mid-session is gated; the un-gated BOOT picker (ProfileGate → ProfilePicker) is a
      // different path and is untouched.
      { id: 'barn.switch', label: 'Skift barn', verify: { kind: 'requirePin', reason: 'switchProfile' } },
      { id: 'barn.rename', label: 'Omdøb barnet' },
      { id: 'barn.add', label: 'Tilføj et barn' },
      // Drops this device's local copy of that child's book (the server delete is soft/recoverable),
      // so it is LOCAL authority — the same blast radius as a progress reset.
      {
        id: 'barn.delete',
        label: 'Slet barnet',
        destructive: true,
        scope: 'child',
        verify: { kind: 'requirePin', reason: 'resetProgress' },
        // Recoverable on the SERVER for a while, but gone from this device immediately — and the bin
        // sits one control away from the rename pencil, on adjacent rows, which is the tap this
        // guards against.
        irreversible: true,
        typeToConfirm: 'SLET',
      },
      {
        id: 'barn.reset',
        label: 'Nulstil fremgang',
        destructive: true,
        scope: 'child',
        verify: { kind: 'requirePin', reason: 'resetProgress' },
        irreversible: true,
        typeToConfirm: 'NULSTIL',
      },
    ],
  },
  {
    id: 'laering',
    label: 'Læring',
    items: [
      { id: 'laering.global', label: 'Sværhedsgrad' },
      { id: 'laering.perSection', label: 'Tilpas pr. sektion' },
    ],
  },
  {
    id: 'lyd',
    label: 'Lyd',
    items: [
      { id: 'lyd.sfx', label: 'Lydeffekter' },
      { id: 'lyd.music', label: 'Musik' },
      { id: 'lyd.voice', label: 'Stemme' },
      { id: 'lyd.rate', label: 'Tempo' },
      { id: 'lyd.sample', label: 'Hør et eksempel' },
    ],
  },
  {
    id: 'udseende',
    label: 'Udseende',
    items: [
      { id: 'udseende.theme', label: 'Tema' },
      // "Flydende grafik" (Performance PRD-01 W6) — a plain switch, ON by default, that falls BACK to
      // the pre-PRD rendering path. Not destructive and not PIN-gated beyond the adult menu itself: it
      // changes only how things are drawn, never any data. It lives HERE because the group/item
      // structure is DATA and guarded; adding it in the pane alone would fail that guard.
      { id: 'udseende.smoothGraphics', label: 'Flydende grafik' },
    ],
  },
  {
    id: 'konto',
    label: 'Konto',
    items: [
      { id: 'konto.email', label: 'Konto' },
      { id: 'konto.sync', label: 'Synkronisering' },
      { id: 'konto.syncNow', label: 'Synkronisér nu' },
      // PinSetupDialog asks for the CURRENT code and `pin/set` verifies it server-side under the same
      // lockout — the secret never travels through a generic context callback. Not destructive.
      { id: 'konto.pin', label: 'Kode' },
      {
        id: 'konto.addPasskey',
        label: 'Tilføj Face ID på denne enhed',
      },
      {
        id: 'konto.removePasskey',
        label: 'Fjern Face ID',
        destructive: true,
        scope: 'account',
        verify: { kind: 'requirePin', reason: 'manageCredentials' },
      },
      {
        id: 'konto.signOut',
        label: 'Log ud på denne enhed',
        destructive: true,
        scope: 'account',
        verify: { kind: 'requirePin', reason: 'manageCredentials' },
      },
      {
        id: 'konto.revokeSessions',
        label: 'Log ud alle steder',
        destructive: true,
        scope: 'account',
        verify: { kind: 'requirePin', reason: 'revokeSessions' },
      },
      {
        id: 'konto.deleteAccount',
        label: 'Slet kontoen helt',
        destructive: true,
        scope: 'account',
        irreversible: true,
        // A DIFFERENT word from `barn.delete`'s "SLET" on purpose: the same word on both would let
        // muscle memory carry a child-deletion habit straight into wiping the whole account.
        typeToConfirm: 'SLET ALT',
        // …and THEN the current PIN, typed into the pad and verified by the server under the
        // pin_attempt lockout (`authStore.deleteAccount`). The two do different jobs — the word is
        // deliberation at the moment of the tap, the PIN is authorisation. The pad alone left the
        // confirm itself a single tap, identical in weight to the reversible "Log ud" above it.
        verify: { kind: 'pinPad' },
      },
    ],
  },
]

/** Rail order, for the shell. */
export const ADULT_GROUP_IDS: AdultGroupId[] = ADULT_IA.map((g) => g.id)

export const adultGroupLabel = (id: AdultGroupId): string =>
  ADULT_IA.find((g) => g.id === id)?.label ?? ''

/** Every item, flattened — with the group it was found in. */
export const adultItemsWithGroup = (): { group: AdultGroupId; item: AdultItem }[] =>
  ADULT_IA.flatMap((g) => g.items.map((item) => ({ group: g.id, item })))

/**
 * One item by id. The panes use this to read `typeToConfirm`, so the word declared above is literally
 * the word the shipped dialog demands — a hardcoded duplicate in the component would let the two
 * drift, and then the test below would be checking a value nothing renders.
 */
export const adultItem = (id: string): AdultItem => {
  const found = adultItemsWithGroup().find((e) => e.item.id === id)
  if (!found) throw new Error(`unknown adult settings item: ${id}`)
  return found.item
}
