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

export type AdultGroupId = 'familie' | 'laering' | 'lyd' | 'udseende' | 'privatliv'

/**
 * The ordered sub-sections of the `Familie` pane (Familie IA PRD §3).
 *
 * `Barn` and `Konto` used to be two rail groups, which is not how a parent models it: they are one
 * thing — the family — seen from two angles, and the argument for signing in ("Bogen er sikret") is a
 * statement about the CHILD that was filed under account. Merging them also returns the rail to the
 * five mutually-exclusive groups Settings PRD-01 specified.
 *
 * ORDER IS LOAD-BEARING, and it is declared here rather than left to the pane so a plain-Node test can
 * assert it: identity first (the thing the rest hangs off), then the child, then the two signed-in
 * sections, and the DANGER LAST — child block, then account block. NN/g, on placing consequential
 * actions next to benign ones: the remedy is spatial separation plus a redundant visual signal, so
 * `fareKonto` being last puts "Slet kontoen helt" as far from "Omdøb barnet" as the pane allows.
 */
export type FamilieBlock = 'konto' | 'boern' | 'sikkerhed' | 'synk' | 'fareBarn' | 'fareKonto'

/** Top to bottom in the pane. The two danger blocks are last, account last of all (§3.5). */
export const FAMILIE_BLOCK_ORDER: FamilieBlock[] = [
  'konto',
  'boern',
  'sikkerhed',
  'synk',
  'fareBarn',
  'fareKonto',
]

/**
 * The two blocks that render as their own bordered container with its own heading — never one strip
 * with a divider inside it, which Gestalt proximity still reads as a single group.
 */
export const FAMILIE_DANGER_BLOCKS: FamilieBlock[] = ['fareBarn', 'fareKonto']

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
  /**
   * The confirm dialog IS the verification — no PIN.
   *
   * Only legitimate for an action that is account-scoped but **reversible and destroys no data**, which
   * today means the two log-outs and nothing else. The adult has already passed the parental gate to be
   * in this surface at all, and the confirm names what will happen; a PIN on top asked the same question
   * twice (owner, 2026-08-09). Anything that changes a CREDENTIAL or cannot be undone keeps its PIN —
   * `adultSettingsIa.test.ts` holds that line, and the `irreversible` flag is what separates them.
   */
  | { kind: 'confirm' }

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
   * Which sub-section of the `Familie` pane the item renders in (§3). Only that group declares it —
   * the other four panes are a single block each.
   *
   * It exists so "no child-scoped and account-scoped destructive item shares a block" is assertable as
   * DATA. Without it the separation lives only in JSX, where a later tidy-up could merge the two danger
   * strips back into one and nothing would fail.
   */
  block?: FamilieBlock
  /**
   * A tool for the OWNER, not a setting for a parent — hidden in the production build (owner,
   * 2026-09-05). Six items qualify, and the reason is not tidiness in two of them:
   *
   *   * `lyd.voice` / `lyd.rate` write a `voiceOverride`, which `ttsClient.resolveRequest` folds into
   *     the TTS cache key (name + lang + rate). A non-default choice therefore misses EVERY prebaked
   *     clip and sends **all** narration to live Azure — which a guest cannot call
   *     (`canCallPaidApis: false`), so the whole app drops to Web Speech, or to silence offline. A
   *     parent nudging a tempo slider could not possibly know that. `/voicelab` remains the real tool.
   *   * `lyd.sample` only means anything beside those two.
   *   * `lyd.everWorked`, `udseende.smoothGraphics` and `konto.syncNow` are diagnostics and manual
   *     triggers for things that are automatic. `everWorked` is already in the bug report, so the row
   *     is duplicate rather than merely technical.
   *
   * NOT a permission — the app has no roles, and a role tier would today separate the owner from his
   * wife, who is on the same allow-list. The axis is the BUILD: `BL_TIER === 'staging'` (or dev/the
   * harness), so the tools exist on `BL Staging`, which is where the owner tests, and are absent from
   * the App Store build. See `showsDevTools`.
   */
  devTool?: true
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
    // THE MERGE (Familie IA PRD, owner 2026-09-05). `Barn` + `Konto` + the standalone `Log ind` promo
    // row were three doors to two rooms that are one room to a parent — and `KontoPane` opened with
    // `if (guest) return <the sign-in offer>`, so the promo row and the `Konto` rail entry led to the
    // same screen. One group, ordered sub-sections, `block` above.
    //
    // THE ITEM IDS DELIBERATELY KEEP THEIR `barn.` / `konto.` PREFIXES. They are declared "stable id,
    // unique across the WHOLE surface", the panes read `typeToConfirm` through `adultItem(id)`, and the
    // load-bearing assertions in `adultSettingsIa.test.ts` key off them against the real
    // `pinVerifierFor` table. Renaming them buys nothing and risks the one guard that stops an
    // account-scoped destructive action being downgraded to the local unlock. A `barn.*` id under
    // `familie` is odd; it is the cheaper half of that trade. Do not "fix" it.
    id: 'familie',
    label: 'Familie',
    items: [
      // ---- §3.1 the identity row: the account, at the top, iOS's Apple-Account placement ----------
      // Guest: the sign-in offer, and this is now the ONLY place it appears.
      { id: 'konto.email', label: 'Konto', block: 'konto' },

      // ---- §3.2 Børn ------------------------------------------------------------------------------
      { id: 'barn.active', label: 'Aktivt barn', block: 'boern' },
      { id: 'barn.summary', label: 'Sådan går det', block: 'boern' },
      // Switching mid-session is gated; the un-gated BOOT picker (ProfileGate → ProfilePicker) is a
      // different path and is untouched.
      {
        id: 'barn.switch',
        label: 'Skift barn',
        verify: { kind: 'requirePin', reason: 'switchProfile' },
        block: 'boern',
      },
      { id: 'barn.rename', label: 'Omdøb barnet', block: 'boern' },
      { id: 'barn.add', label: 'Tilføj et barn', block: 'boern' },

      // ---- §3.3 Sikkerhed — signed in only --------------------------------------------------------
      // PinSetupDialog asks for the CURRENT code and `pin/set` verifies it server-side under the same
      // lockout — the secret never travels through a generic context callback. Not destructive.
      { id: 'konto.pin', label: 'Kode', block: 'sikkerhed' },
      { id: 'konto.addPasskey', label: 'Tilføj Face ID på denne enhed', block: 'sikkerhed' },
      {
        id: 'konto.removePasskey',
        label: 'Fjern Face ID',
        destructive: true,
        scope: 'account',
        verify: { kind: 'requirePin', reason: 'manageCredentials' },
        // NOT in a danger block: it is per-passkey, so it renders as the "Fjern" button on the row for
        // the device it removes. A block would have to ask WHICH one, which is the row itself.
        block: 'sikkerhed',
      },

      // ---- §3.4 Synkronisering — signed in only ---------------------------------------------------
      { id: 'konto.sync', label: 'Synkronisering', block: 'synk' },
      { id: 'konto.syncNow', label: 'Synkronisér nu', devTool: true, block: 'synk' },

      // ---- §3.5 the danger zone: TWO blocks, child first, account LAST ----------------------------
      // The merge puts "Slet barnet" and "Slet kontoen helt" in one pane for the first time. NN/g:
      // "Avoid placing highly consequential actions … directly next to options that are benign."
      // The remedies are spatial separation, a redundant visual signal and Gestalt proximity — hence
      // two containers with their own headings, the child's one NAMING the child.
      {
        id: 'barn.reset',
        label: 'Nulstil fremgang',
        destructive: true,
        scope: 'child',
        verify: { kind: 'requirePin', reason: 'resetProgress' },
        irreversible: true,
        typeToConfirm: 'NULSTIL',
        block: 'fareBarn',
      },
      // Drops this device's local copy of that child's book (the server delete is soft/recoverable),
      // so it is LOCAL authority — the same blast radius as a progress reset.
      {
        id: 'barn.delete',
        label: 'Slet barnet',
        destructive: true,
        scope: 'child',
        verify: { kind: 'requirePin', reason: 'resetProgress' },
        // Recoverable on the SERVER for a while, but gone from this device immediately. It used to be
        // a bin icon on the roster row, one control away from the rename pencil — the exact adjacency
        // NN/g warns about — so the merge moved it into the block that names its blast radius, where
        // it acts on the ACTIVE child. Deleting another child now costs a switch first, deliberately.
        irreversible: true,
        typeToConfirm: 'SLET',
        block: 'fareBarn',
      },
      {
        // NO PIN (owner, 2026-08-09). Both log-outs are reversible and destroy nothing: you sign back
        // in, and the child's book is on the server. The adult already passed the parental gate to
        // reach this pane, and the confirm names the account — a PIN after that asked the same
        // question a second time. What the PIN also bought was a guarantee that the adult was ONLINE
        // at the moment of signing out; that is now covered where it belongs, by the confirm dialog
        // warning when there is un-pushed progress rather than by a credential prompt.
        id: 'konto.signOut',
        label: 'Log ud på denne enhed',
        destructive: true,
        scope: 'account',
        verify: { kind: 'confirm' },
        block: 'fareKonto',
      },
      {
        id: 'konto.revokeSessions',
        label: 'Log ud alle steder',
        destructive: true,
        scope: 'account',
        verify: { kind: 'confirm' },
        block: 'fareKonto',
      },
      {
        id: 'konto.deleteAccount',
        label: 'Slet kontoen helt',
        destructive: true,
        scope: 'account',
        irreversible: true,
        // A DIFFERENT word from `barn.delete`'s "SLET" on purpose: the same word on both would let
        // muscle memory carry a child-deletion habit straight into wiping the whole account. That was
        // already true when they were two panes apart; now they are in one pane, it is the point.
        typeToConfirm: 'SLET ALT',
        // …and THEN the current PIN, typed into the pad and verified by the server under the
        // pin_attempt lockout (`authStore.deleteAccount`). The two do different jobs — the word is
        // deliberation at the moment of the tap, the PIN is authorisation. The pad alone left the
        // confirm itself a single tap, identical in weight to the reversible "Log ud" above it.
        verify: { kind: 'pinPad' },
        block: 'fareKonto',
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
      { id: 'lyd.voice', label: 'Stemme', devTool: true },
      { id: 'lyd.rate', label: 'Tempo', devTool: true },
      { id: 'lyd.sample', label: 'Hør et eksempel', devTool: true },
      // Read-only status (Audio activation PRD-01 §4.5): the ONE thing the adult cannot otherwise tell
      // apart — "sound has never worked on this iPad" vs "it worked and then stopped". Device-scoped
      // (`bl-audio-ever-worked`), not per-child, and it gates nothing. Listed HERE because the
      // group/item structure is DATA and guarded; adding it in the pane alone would fail that guard.
      { id: 'lyd.everWorked', label: 'Lyd på denne enhed', devTool: true },
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
      { id: 'udseende.smoothGraphics', label: 'Flydende grafik', devTool: true },
    ],
  },
  {
    // THE FIFTH GROUP, added deliberately at App Store PRD Phase A (§3.5 / §3.6) — it broke the
    // Settings PRD-01 five-group contract on purpose, with the owner's decision on record
    // (2026-08-06), and the Familie merge has since restored the count without touching this one.
    // DO NOT fold it into `Familie`. The reason it is its own group: a Kids Category
    // reviewer looks for the parental gate, the microphone default and the privacy policy, and all
    // three are the SAME story. Scattering the mic switch under "Lyd" (which otherwise means playback
    // volume) and the policy into the rail footer would have made a reviewer hunt for the one thing
    // that decides Guideline 1.3.
    //
    // Nothing here is `destructive`: turning the microphone OFF is the safe direction and revoking
    // consent must never be harder than giving it. Turning it ON is guarded instead by an explicit
    // consent screen (`panes/MicConsentDialog.tsx`) that names Google — a switch alone would not be
    // "the parent explicitly consents".
    id: 'privatliv',
    label: 'Privatliv',
    items: [
      { id: 'privatliv.microphone', label: 'Mikrofon' },
      { id: 'privatliv.policy', label: 'Privatlivspolitik' },
      { id: 'privatliv.support', label: 'Support' },
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

/** The `Familie` items in one sub-section, in declaration order. */
export const familieBlockItems = (block: FamilieBlock): AdultItem[] =>
  (ADULT_IA.find((g) => g.id === 'familie')?.items ?? []).filter((i) => i.block === block)

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

/**
 * Whether the owner-only tools (`devTool`) render.
 *
 * PURE and fully enumerable on purpose — the runtime inputs are bound by the caller
 * (`src/utils/adultDevTools.ts`), so the RULE can be truth-tabled in plain Node while the binding
 * stays a one-liner. `BL_TIER` alone is not enough: it defaults to `'production'` when
 * `__BL_TIER__` is undefined, which is every local `npm run dev` — so a tier-only gate would hide
 * these from the owner on the machine he develops on.
 */
export const showsDevTools = (tier: 'staging' | 'production', isDev: boolean, isHarness: boolean): boolean =>
  tier === 'staging' || isDev || isHarness

/** The items a production build must not render. */
export const devToolItemIds = (): string[] =>
  adultItemsWithGroup().filter((e) => e.item.devTool).map((e) => e.item.id)

