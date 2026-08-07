# PRD — Sign-in visibility in the adult area, and guest-book adoption

Status: **authored, not implemented.** Ships in v1.0, before the first App Store submission — it is on
the critical path. Written 2026-08-07 from a planning session; self-contained by design, so a fresh
session needs nothing but this file and the repo.

---

## 1. Why

Two problems, one surface.

**Sign-in is invisible.** An adult who would benefit from an account has to already know it exists to
find it. Today's only path is: corner gear → arithmetic parental gate → adult menu → Konto pane → "Log
ind med Google". Nothing on the way in says an account is on offer, or what it is for.

**Signing in silently costs the child everything.** A guest plays as a fixed local child
(`local-guest`). On sign-in the app creates a brand-new profile and that profile starts from zero; the
guest book stays on disk, orphaned forever. The Konto pane is honest about it today — "Fremgangen fra
denne enhed flyttes ikke over automatisk." — but honesty is not the same as a good outcome.

**The owner's constraint:** everything stays *inside* the adult area. Nothing moves in front of the
parental gate. The adult area **is** the parental gate, which is what keeps Kids Category Guideline 1.3
out of play entirely — no links out, no purchasing opportunity, no adult-directed messaging on a
child-facing surface. Do not reopen that.

---

## 2. What the implementing session must know before touching anything

Facts that are expensive to rediscover and cheap to get wrong.

**The app.** Danish learning app for a 5-year-old. Five sections, 24 games. All user-facing copy is
Danish. The compatibility floor is an iPad Pro 2nd gen on iPadOS 17.7.11. Ships both as a web app on
`boernelaering.dk` and as a Capacitor iOS shell — this change is web code, so it lands in both.

**The adult menu's group/item structure is DATA**, in `src/config/adultSettingsIa.ts`, guarded by
`src/config/adultSettingsIa.test.ts`, whose `ADULT_GROUP_IDS` assertion is an **exact pinned
six-element list** (`barn · laering · lyd · udseende · konto · privatliv`). **This PRD does not touch
that file.** The promo in W2 is the same class of thing as the apply-update strip
(`AdultSettings.tsx:218-241`) and the bug-report/version rail footer (`:286-321`): both are component
chrome, neither is an IA item. Do not add a seventh group and do not invent a fake item.

**What the benefits copy may and may not promise.** Passkeys and Face ID are deliberately absent from
the iOS shell — the passkey RP ID is `boernelaering.dk`, the shell's origin is `capacitor://localhost`,
and that cannot satisfy it. **Google or the numeric code only.** The Konto pane's signed-in branch
already says so; new copy must not contradict it. What an account genuinely buys:

1. progress synced across devices,
2. more than one child profile,
3. Sig et Ord's microphone game, which needs a server-minted access JWT a guest deliberately never
   gets (`/api/stt`; see `PrivatlivPane.tsx:8-14` for why the guest case is a different truth, not a
   degraded one).

**Guest play is cheap because it reuses existing machinery.** `progressStore` is inert until
`profileStore.attach()`, and `profileStore` is the **only** caller of attach/detach. Guest is a new
caller, not a second progress path. Device-scoped flags live in `src/utils/guestMode.ts`
(`bl-guest-mode`, `bl-has-signed-in`). The guest child is a module constant in `profileStore.ts:77`
(`id: 'local-guest'`, name `Gæst`) and is deliberately never written to the roster cache.

**House rules that will bite.**

- **No emoji ships anywhere in the UI.** The allowlist in `src/config/noEmoji.test.ts` is empty. Adult
  surfaces use `lucide-react`; child-facing ones use baked art.
- **Nothing styling-related is hardcoded in components** — tokens only. The adult theme
  (`src/theme/adultTheme.tsx`) already supplies radius, the 44px button floor, `divider`,
  `text.secondary`, `background.default`.
- Layouts are full-viewport and no-scroll — `.claude/rules/layout-contract.md` and
  `responsive-design.md` own that. The adult Dialog is `height: min(640px, calc(100vh - 64px))` and
  **never grows**; anything added to the rail either scrolls inside the `List` or eats fixed height.
- **Danish text is written with the Edit/Write tool, never a shell text pipeline.** A PowerShell
  pipeline re-encodes the file and mojibakes every `æøå`; a `node -e`/heredoc patch
  command-substitutes backticks and silently drops identifiers.
- Two source-grepping guards sit in the files being edited: `src/config/runtimeTarget.test.ts:86-90`
  greps `AdultSettings.tsx` for the literal `{updateAvailable && onApplyUpdate && (`, and
  `src/config/guestAdultGate.test.ts:116-133` greps `GuestAdultGate.tsx` / `AuthDialogs.tsx`. Don't
  restructure those expressions.

**Rules files worth reading before W3:** `.claude/rules/auth.md` (guest play, the effect-order trap,
the v4 document and the merge) and `.claude/rules/rewards-and-progression.md` (what may and may not be
written to a progress document).

---

## 3. Out of scope

The sign-in mechanics themselves — the Google flow, the shell's browser handoff, the PIN, passkeys —
all work and are not being redesigned. No change in front of the parental gate. No change to the
arithmetic gate's difficulty. Not Android.

---

## 4. W1 — Konto pane guest state reads as an offer

**File:** `src/components/adult/panes/KontoPane.tsx`, the guest early-return at **lines 255-294**
(`guest = auth?.phase === 'guest'` at `:96`). The signed-in branch below it is untouched.

Replace the two existing `PaneSection`s with:

```
PaneSection title="Konto"
  "I spiller uden konto"                                   (fontWeight 600, ~0.95rem)
  "Fremgangen ligger kun på denne iPad, og der kan kun være ét barn."   (body2, text.secondary)

PaneSection title="Med en konto"
  [Tablet]  "Fremgangen følger med til jeres andre enheder."
  [Users]   "Flere børn, hver med sin egen bog."
  [Mic]     "Mikrofonspillet \"Sig et Ord\" kan slås til."

  Button variant="contained"  "Log ind med Google"   (minHeight 44)
  caption — see W5
```

The three rows reuse the `LinkRow` shape from `panes/PrivatlivPane.tsx:26-54` (icon box at
`color: 'text.secondary'`, `mr: 1.5`, then title + hint) **with the chevron dropped and no `onClick`** —
they are statements, not links. Extract a local presentational `BenefitRow` rather than copying
`LinkRow` wholesale; it needs no `Button` wrapper, so it also stays out of the tab order.

Icons are lucide: `Tablet`, `Users`, `Mic` (`Mic` is already imported in `PrivatlivPane`). Sizes 18-20,
`aria-hidden` — they are decorative, the text carries the meaning.

**Fix while here:** the guest sign-in button at `:282` calls `void startGoogleSignIn()` and discards the
`SignInResult`, so a failed sign-in shows nothing at all. Mirror `LockScreen.tsx:128-134` — busy state
on the button, and surface `result.message` in a `role="status"` line beneath it on failure.

Copy constraints, restated because they are easy to violate while rewording:

- do not promise Face ID or passkeys,
- do not imply progress is currently unsaved — it *is* saved, just device-local,
- keep straight quotes around `"Sig et Ord"` to match the rest of the file.

Height: this is roughly the same as today's guest branch, and it lives in the scrollable detail pane, so
there is no layout risk. The "must not claim the pane's height" requirement is about the **landing**,
which W2 handles.

---

## 5. W2 — A quiet sign-in row on the adult menu landing

**File:** `src/components/adult/AdultSettings.tsx`.

Add a single row **inside the rail column, above the `List`** (which starts at `:260`), as a
`flex: '0 0 auto'` box — structurally the mirror of the existing footer at `:289`. Rendered only when
`auth?.phase === 'guest'`. `AdultSettings` has no auth import today; add `useAuthContext` from
`../../contexts/AuthContext` (cf. `KontoPane.tsx:33,93`).

```
[LogIn]  Log ind
         Flere børn, flere enheder, mikrofonspil
```

- `onClick` calls the component's existing `select('konto')` (`:126-133`) — it already handles the
  compact push and the persisted `lastPane`.
- Presentation: bordered and unfilled, so it reads as an offer rather than an alert. `border: '1px
  solid'`, `borderColor: 'divider'`, `borderRadius: 2`, `minHeight: 44`. **No `bgcolor`** — the
  apply-update strip's `primary.main` is the loud register and this is deliberately not that.
- `aria-label="Log ind"`; the lucide `LogIn` icon is `aria-hidden`.
- Add `data-guest-signin-promo` for the screenshot probe.
- Also: give the Konto rail row `secondary="Ikke logget ind"` when guest. The `secondary` slot already
  exists on that `ListItemButton` and is used for `barn` (`:275`) — this is a two-line change and it
  makes the destination legible from the landing.

**Why here and not above the split.** The strip above the split (`:218`) spans every pane, so it would
follow an adult who opened the menu for the sound settings all the way into Lyd. Inside the rail column
it costs ~60px of fixed height, never scrolls past, and on compact — where the rail *is* the root list
(`showRail`/`showDetail`, `:161-162`) — it lives on the landing and disappears the moment a pane pushes
over it. That is exactly "on the landing itself".

---

## 6. The migration decision

**Verdict: adopt the guest book, once, copy-only, onto a first child — and ask before doing it.**

### 6.1 Why copy-onto-a-brand-new-child is the only safe shape

`api/progress.ts:118-130` stores a first PUT for a child that has no `profileProgress` row **verbatim**:

```ts
if (!existing) { create({ profileId, doc: incoming, rev: 1, epoch: incoming.sync.epoch }); return { rev: 1 } }
```

No merge, no `baseRev` check, no anti-rollback. A child created seconds ago is guaranteed to be inside
that window. So the guest document simply *becomes* the child's first server version, and no CRDT join
ever runs. Every later increment from this iPad increments the same ledger entry — which is correct,
because it is the same device.

Everything that punishes a naive migration is **avoided** rather than handled:

- **The G-counter collision.** `getDeviceId()` (`src/services/deviceId.ts:25-43`) is per *device*, not
  per profile, so the guest book and any child book on this iPad key their ledger entry identically.
  `mergeLedger` (`src/config/progressMerge.ts:211-213`) takes a per-device `max`, so merging a guest doc
  at 200 XP into a child at 300 XP yields **300, not 500** — silently, with no error and nothing in a
  bug report. Copying onto an empty target joins nothing, so this cannot fire.
- **A permanent 409.** Re-keying the guest's ledger under a synthetic device id to dodge the above then
  trips `wentBackwards` (`api/progress.ts:45-56`, mirrored `dev-server.js:687-696`): any device entry
  that disappears or decreases is rejected. `progressSync` retries 3× (`MAX_CONFLICT_RETRIES`) and then
  goes quiet and permanently dirty. Not reachable when there is no stored row.
- **A 422 that never retries.** `progressInvariantViolations` (`src/config/progressSchema.ts:347-376`)
  is a 422 that `progressSync` deliberately does **not** retry — the child would stop syncing with no
  visible symptom. The source is a live valid document, but W3 re-checks before writing anyway and
  falls back to a fresh start rather than stranding the child.
- **Ceremony integrity.** The whole document moves intact, so nothing writes `grantedSlots` or
  `stickers.firstAt` by hand and `grantedSlots === Σ ledger.slots` holds by construction. No new slot is
  granted, so "rewards are granted only by the ceremony" is not violated — the same slots simply arrive
  under a new key. (Moving XP without slots would leave the child instantly owed N rewards and fire
  them all in one ceremony via `grantPendingRewards()`; moving slots without XP would break the
  `grantedSlots ≤ collectedFromLevel(globalLevel())` inequality and 422.)
- **Epoch.** Carried as-is. The create branch records `epoch: incoming.sync.epoch`; there is nothing to
  conflict with. Do not normalise it to 0 — if the guest ever used "Nulstil fremgang", that epoch is
  load-bearing.
- **`profileId`.** `attach()` re-stamps it (`progressStore.ts:246`), so the copy self-heals; W3 stamps it
  anyway, because the only exposure is pushing a copied doc *before* attaching it.

### 6.2 The cases that get a reasoned "no"

- **An account that already has children.** We cannot know which child the guest was, and any target
  with a server row is outside the free window. **No offer.** Merging into a chosen child is the exact
  shape §6.1 rules out.
- **An account whose children already have progress.** Same, and the pulled document would win
  regardless. The guest book on this device is a shadow of a child that already exists elsewhere;
  dropping it is the right outcome, not a regrettable one.
- **The same guest device signing into a second account.** A device-scoped `bl-guest-claimed` flag,
  never cleared, means the book is claimed exactly once. Without it the same XP would be counted into
  two accounts.

The guest book is **never deleted**, only marked claimed. If the adult later signs out and taps "Spil
uden konto", guest play resumes on that same book — it is claimed, so it can never be adopted again.

### 6.3 Prompt, not silent

Google's own anonymous-auth guidance is about **ordering and atomicity** — migrate before you commit the
sign-in, never leave the user in a limbo state — not about consent. We satisfy that by writing the copy
locally **before** `selectProfile()` attaches, and by never mutating the source. The consent argument
comes from the guest-conversion literature and NN/g's login-wall work: a transfer should happen with the
user's knowledge, and you don't move someone's data without a stated reason.

What settles it here is a concrete ambiguity. The guest book belongs to **one specific child**. If the
adult's first profile is a sibling rather than the child who has been playing, silent adoption puts
months of stickers on the wrong kid, with no undo. So the ask is an **attribution** question, not a
permission dialog — and it costs no extra screen:

> In the existing `CreateProfileDialog`, when the offer is eligible, **one checkbox, defaulted on**:
> "Flyt fremgangen fra denne iPad til {navn}", hint: "{n} klistermærker og alle rekorder følger med."
> When the name field is empty, say "til barnet".

Apple HIG's account guidance backs the surrounding shape too: explain the benefit at the point of
sign-in and don't demand an account to play — which is what W1 and W2 do.

Sources consulted: [Firebase — Best Practices for Anonymous Authentication](https://firebase.blog/posts/2023/07/best-practices-for-anonymous-authentication/) ·
[Guest Conversion Feature](https://medium.com/@ericmorgan1/guest-conversion-feature-42c65bb320f) ·
[NN/g — Login Walls Stop Users in Their Tracks](https://www.nngroup.com/articles/login-walls/) ·
[Apple HIG — Managing accounts](https://developers.apple.com/design/human-interface-guidelines/patterns/managing-accounts/)

---

## 7. W3 — Adoption machinery (no UI)

Three files. Landable and testable on its own, with no caller.

**`src/utils/guestMode.ts`** — add alongside the existing flags:

- `GUEST_CLAIMED_KEY = 'bl-guest-claimed'`
- `guestBookClaimed(): boolean`
- `markGuestBookClaimed(): void`

Unlike `guestModeActive()` / `hasEverSignedIn()`, which fail **toward playable** on a storage throw,
these fail **toward claimed**. The safe failure here is not adopting; the unsafe one is adopting twice.

**`src/config/guestAdoption.ts`** — new, **pure and Node-importable**: no `window`, no `localStorage`,
no `Date.now()`, no `crypto`. It takes the already-read state and returns a decision:

```ts
guestAdoptionOffer({ claimed, guestDoc, rosterCount, rosterSettled, hasSessionToken })
  → { offer: boolean; stickers: number }
```

Offer only when **all** hold: not `claimed`; `guestDoc` is non-null (i.e. `normalizePersisted` accepted
it — a non-v4 blob normalises to `null` by design); `Σ ledger.xp > 0`; `rosterCount === 0` **and**
`rosterSettled` (per `.claude/rules/auth.md`: "no children" and "we haven't asked yet" are different
states, and reading `profiles.length === 0` directly has already caused one shipped bug);
`hasSessionToken`.

`stickers` is the child-facing number for the hint copy — derive it through the existing pure
`rewardNumber()` in `src/config/progression.ts`. **Never recompute `collectedFromLevel` inline**, and
never show `globalLevel()`.

**`src/services/progressStore.ts`** — add `adoptDocument(fromProfileId, toProfileId): boolean`. This is
the only sanctioned surface; no caller may reach into `persisted`. It must:

1. return `false` if `localStorage[progressKeyFor(toProfileId)]` already exists (never overwrite a book),
2. read the source key and `normalizePersisted` it; return `false` on `null`,
3. set `doc.profileId = toProfileId`,
4. reset sync bookkeeping to never-synced-and-dirty: `sync.serverRev = 0`, `sync.syncedRev = 0`,
   `sync.originDevice = getDeviceId()`, **`rev` kept** (if `syncedRev >= rev` the doc reads clean and is
   never pushed),
5. run `progressInvariantViolations(doc)` and return `false` on any violation,
6. write the target key,
7. **not** attach, **not** touch the source key, **not** touch the ledger entries, **not** touch
   `sync.epoch`.

**Ordering is load-bearing:** `adoptDocument` runs *before* `profileStore.selectProfile()`. A failure
then leaves the guest book intact and the child simply starts fresh at
`progressStore.ts:245` (`doc = defaultPersisted(...)`) — the existing behaviour, which is a safe floor.

---

## 8. W4 — The ask, and the wiring

**`src/components/auth/CreateProfileDialog.tsx`** — render the checkbox from §6.3 only when
`guestAdoptionOffer(...).offer` is true, defaulted checked, and hand the choice back with the created
profile. Everything the predicate needs is already reachable: `guestBookClaimed()`, the guest doc via
`progressKeyFor(GUEST_PROFILE_ID)`, and `profiles.length` / `rosterSettled` from the profile store
state. Keep it one row — no explanatory paragraph, no second screen.

**`src/components/auth/ProfileGate.tsx`** (the `createProfile` → `selectProfile` path around `:67`) —
after `createProfile()` resolves and **before** `selectProfile(profile.id)`:

```
if (optedIn && progressStore.adoptDocument(GUEST_PROFILE_ID, profile.id)) markGuestBookClaimed()
```

On `false`: log in DEV and continue. **Profile creation must never be blocked by a failed adoption.**

Note the create dialog is also reachable as "Tilføj et barn" from the picker when the roster is
non-empty; the `rosterCount === 0` condition already excludes that path, and no extra guard is needed.

---

## 9. W5 — Copy reconciliation (must not land before W4)

Two strings currently promise the opposite of what the app will do. They change together, or the app
lies:

- `src/components/adult/panes/KontoPane.tsx:289`
- `src/components/auth/LockScreen.tsx:353`

> "Fremgangen fra denne enhed flyttes ikke over automatisk."
> → "Fremgangen fra denne iPad kan følge med til det første barn, du opretter."

If W3/W4 are dropped or deferred, **leave the old strings alone** — they are correct as long as nothing
migrates.

---

## 10. W6 — Tests

- **`src/config/guestAdoption.test.ts`** (new, plain node): no doc / zero XP / already claimed / roster
  non-empty / roster unsettled / no session token each refuse; one positive case.
- **`adoptDocument`**: refuses an existing target key; refuses a document failing
  `progressInvariantViolations`; preserves `Σ ledger.xp`, `grantedSlots` and `stickers.firstAt`;
  re-stamps `profileId`; leaves the source key byte-identical; leaves the result dirty so it pushes
  (`syncedRev < rev`, `serverRev === 0`).
- **`adultSettingsIa.test.ts` must remain untouched** — if it needed editing, the promo was built as IA
  data by mistake.
- Existing guards that must stay green without modification: `noEmoji.test.ts`,
  `runtimeTarget.test.ts`, `guestAdultGate.test.ts`, `rewardSurfaces.test.ts`.

Then run the **`/re-break` skill** on W3/W6: re-break each invariant and require *that* test to go red. A
test seeded with the wrong document shape stays green while adoption silently drops the ledger, which is
precisely the failure this PRD exists to prevent.

---

## 11. W7 — Re-capture the App Store screenshots

`docs/app-store/shots/ipad-6-voksne.png` and its iPhone twin are committed captures of this exact pane.
W1 and W2 invalidate both.

Re-capture with the commands in `docs/app-store/listing.md` §2.2, **in real guest mode through the
arithmetic parental gate** — that is how shot 6 was originally taken and the §2.2 note says so. Verify
dimensions and that there is no alpha channel, and update the "CAPTURED 2026-08-06" line in §2.2. This is
a work item, not a footnote: an un-recaptured shot is a submission that shows a screen the app no longer
has.

---

## 12. Landing order

Each item is independently landable.

1. **W1** — Konto pane guest state.
2. **W2** — landing promo row + Konto rail `secondary`.
3. **W3** — adoption machinery (no caller yet).
4. **W4** — the checkbox and the wiring.
5. **W5** — copy reconciliation (**never before W4**).
6. **W6** — tests, written alongside W3/W4.
7. **W7** — screenshots, last, once the pane has stopped changing.

W1 and W2 depend on nothing else, so sign-in discoverability ships even if the migration slips out of
v1.0.

---

## 13. Verification

Name the rung on every claim. All of this is rung 1–2; nothing needs the owner's iPad except the final
read-through of the Danish.

- `npm run build`, `npm run lint`, `npm test`, `npm run context:check`.
- **`ui-screenshot` skill.** The existing Konto recipe is at
  `.claude/skills/ui-screenshot/reference/recipes.md:14-25` (`[data-rail-item=konto]`, `--settle 4500`).
  Add a real-guest run through the arithmetic gate to see the promo row; assert
  `[data-guest-signin-promo]` is present under guest and **absent** when signed in.
- **Measure, don't eyeball, the rail.** At 1024×768 and at `PHONE_ANY` (844×390 and 667×375): the promo
  row must not push the rail `List` into overflow and the dialog must not scroll. Body overflow is
  `hidden`, so "below the fold" means unreachable — check `scrollHeight` vs `innerHeight`.
- **Adoption end-to-end against a scratch account.** Never the shared Neon DB — it is the owner's real
  account and test rows land in his play-test (`.claude/rules/auth.md`). Drive it through the real UI;
  `import()` inside `--eval` gets a different module instance than the app, so use the `window.__auth` /
  `__profiles` / `__progress` / `__sync` DEV handles if you need to inspect state.
- After adoption, confirm the child's first sync is a **201-shaped first version** (`rev: 1`), not a 409
  or a 422, and that `rewardNumber()` on the new child equals what the guest showed.
- Danish copy written with the Edit/Write tool only.

---

## 14. Kickoff prompt for the implementing session

> Implement `tmp-prd-adult-login-visibility.md` — sign-in discoverability in the adult area plus the
> one-shot guest-book adoption — work items W1→W7, in order, each landable on its own.
> Read the PRD first: it carries the constraints (the guarded IA data, the per-device G-counter ledger,
> the App Store screenshot re-capture) so you don't have to rediscover them.
