# PRD — "Hvem spiller?" on every cold start, and the guest loses "Tilføj et barn"

**Status:** AUTHORED 2026-09-05, NOT IMPLEMENTED. Every decision below was made by the owner on
2026-09-05 and is recorded with its alternative, so none of them gets re-argued.
**Scope:** the boot-time child picker's *policy*, deleting its "Tilføj barn" button, and deleting the
guest's "Tilføj et barn" row. **Adding a child happens ONLY inside the gated "Til de voksne" area**
(owner, 2026-09-05) — apart from the mandatory first-run dialog, which is the way into the app at all.
No schema change, no server work, no new spoken lines, no new art.

---

## 1. Why — the picker exists, it just almost never appears

`ProfilePicker` ("Hvem spiller?") is already built: full-screen at `AUTH_Z`, a grid of baked avatar
tiles, raised by the pure `profileGateSurface()` in `src/contexts/profileGatePolicy.ts`. **This PRD is
not a new screen.** It changes one condition and removes one button.

Today `profileStore.hydrate()` boots straight into the child named by the stored pointer:

```ts
const target =
  (pointer && cached.some((p) => p.id === pointer) ? pointer : null) ??
  (cached.length === 1 ? cached[0].id : null)
```

So a two-child family meets the picker **once** — the first launch on that device, before a pointer
exists — and every launch after that silently resumes as whoever played last. The second child has no
way to start their own session except through the adult menu, behind a PIN. That is the defect: on a
shared family iPad the wrong child's book is the default, and the child cannot fix it themselves.

The owner's reference is the streaming-service pattern (Netflix and its kin ask "who's watching?" at
launch). **That comparison was NOT re-researched this session** — no vendor page was read, and in
particular whether Netflix re-asks after a background/resume is **UNKNOWN**. §2.2's cold-start-only
answer is our own reasoning, not a citation. Do not write it up as an industry finding.

---

## 2. The decisions

Each row is the owner's answer of 2026-09-05, with the option it beat, so the trade-off is visible
without re-opening it.

### 2.1 The picker appears on every cold start when there are **2 or more** children

One child still boots straight into their book. This preserves the accounts-PRD contract recorded in
`profileGatePolicy.ts` and `ProfileGate.tsx` — *"one child boots straight in, which is what keeps 'the
child never sees a login screen' true"* — and the median install (one child, one iPad) is unchanged.

Rejected: showing it for one child too. It would put a screen with a single tile in front of the child
on every launch, offering no choice, and reverse that contract for nothing.

**Signed-in only.** A guest has exactly one fixed local child (`local-guest`) and never reaches this.

### 2.2 Cold start ONLY — never on resume

Returning from the background drops the child straight back onto the board they left. Nothing about
`visibilitychange`, `pagehide` or an iOS PWA resume may raise the picker.

Rejected: re-asking after a long absence, and re-asking on every foreground. Both can throw a child out
of a live game, and an iPad app-switch mid-round is ordinary behaviour here, not an edge case.

### 2.3 There is NO "Tilføj barn" on the picker — the existing one is DELETED

**It is on the picker today, and it is reachable by a child with no gate at all** — `ProfileGate`
passes `onCreate={() => setCreating(true)}` and `CreateProfileDialog` opens straight away. So a
five-year-old at the picker can create nameless children on the account right now. The button goes,
and the `onCreate` prop with it.

The owner first chose to keep it behind `requirePin('adultMenu')` and then reversed to removing it
(2026-09-05, same session). Removal is the better answer for a structural reason worth keeping:
**the picker only appears once there are already 2+ children.** The first child comes from the
mandatory create dialog and the second from the adult menu, so the picker is never the surface that
needs an add button — it would exist only to add a third. Deleting it closes the hole outright rather
than putting a gate in front of it, and leaves the picker doing exactly one thing.

Accepted cost: an adult adding a third child goes to `Til de voksne` → `Konto` → `Børn`.

**Picking a child at boot stays un-gated**, by design — a child choosing their own avatar is the
point (accounts PRD §7.4). Nothing on this screen gains a PIN; one thing leaves it.

### 2.4 PICK ONLY — no add, no rename, no delete, no "administrer profiler"

With §2.3 the picker has exactly one job: choose who is playing. Rename and delete live in
`Til de voksne` → `Konto` → `Børn` behind the parental gate, and `Slet barnet` deliberately moved into
the danger block a day earlier (`tmp-prd-adult-familie-ia.md` §3.5). Any management affordance — on the
one screen a child is looking at — is the duplicate-affordance problem that PRD removed.

### 2.5 Each tile shows the avatar and the name, and nothing else

What the picker renders today. A pre-reader recognises their own animal; the name is for the adult.

Rejected: adding each child's sticker count. It reads a book belonging to a child who is **not
attached**, and `progressStore` is single-attach by construction (`.claude/rules/auth.md`) — so it is
real work for a warm detail, and it would invite a second reader of another child's document.

### 2.6 A roster that arrives LATE does not interrupt

If this device had one child cached, auto-entered the app, and `/api/profiles` then answers with three,
**stay as the child we entered as** and show the picker on the next cold start.

This costs nothing to implement — `refreshRoster` already clears the selection only when the ACTIVE
profile has disappeared — but it must be written down, because the "correct" instinct is to raise the
picker the moment the roster lands, and that drops a picker over a child who has already started
playing (slow connection, second device, or a child added on the phone).

Known cost, accepted: the very first launch on a NEW device after signing in may enter as one child
before the full roster arrives. Rejected middle option: interrupt only if nothing has been played yet
— correct, but a third rule to hold in your head for one launch of one device.

### 2.7 "Skift barn" in the adult menu keeps its roster rows

Tapping a child in `Konto` → `Børn` still switches inline, still behind
`requirePin('switchProfile')`. Rejected: reusing the full-screen picker there — the same screen would
be PIN-gated or not depending on how you reached it.

### 2.8 The guest's "Tilføj et barn" row is DELETED

Not shown at all when `auth.phase === 'guest'` — no button, no "Kræver en konto" hint, no scroll to the
offer. **This reverses a decision recorded in `.claude/rules/adult-surface.md`** ("Say the price before
the work"), and that bullet must be rewritten in the same commit rather than left contradicting the
code.

It is the right reversal *now* and was not before: since the Barn+Konto merge the sign-in offer sits at
the top of the very same pane, a few centimetres above, and its `Plads til flere børn` row already says
what an account buys. The row had become a second pointer to something already on screen.

---

## 3. What changes in code

| file | change |
|---|---|
| `src/services/profileStore.ts` | `hydrate`: drop the **pointer branch** from `target`, so only `cached.length === 1` auto-selects. `deleteProfile`: when exactly one child remains, select it rather than publishing `choosing` (§4.3). |
| `src/contexts/profileGatePolicy.ts` | picker condition `profiles.length > 0` → `> 1`. Its comment already says "more than one child"; the code never matched it. |
| `src/components/auth/ProfileGate.tsx` | Stop passing `onCreate` to the picker (§2.3). The **mandatory** first-profile dialog stays exactly as it is (§4.4). |
| `src/components/auth/ProfilePicker.tsx` | Delete the `onCreate` prop and the button it renders. The tile grid is unchanged. |
| `src/components/adult/panes/konto/BoernSection.tsx` | Render "Tilføj et barn" only when NOT a guest; drop the guest hint and the `onWantAccount` prop. |
| `src/components/adult/panes/KontoPane.tsx` | Remove the now-dead `offerRef` / `showOffer` scroll plumbing. |
| `src/utils/devHarness.ts` | **`?devkids=<n>`** — seed `n` stand-in profiles under the DEV bypass (§6.1). Without it this feature is unreachable by every rung-1/2 recipe. |
| `.claude/rules/adult-surface.md` | Rewrite the "Say the price before the work" bullet (§2.8). |
| `.claude/rules/auth.md` | The picker rule ("only when more than one profile AND no valid pointer") becomes "whenever there is more than one profile, every cold start". |

---

## 4. The traps — read this section before writing any of it

### 4.1 The pointer branch is ALSO the "no level-1 flash" optimisation

`hydrate`'s comment says it attaches immediately *"so the very first render sees the child's real data
(no level-1 flash)"*. Dropping it for 2+ children means `progressStore` is **inert** behind the picker,
and the app underneath renders with the DEFAULT skin — `themeId` is a per-child setting — until a child
is picked. The picker is full-screen at `AUTH_Z`, so nothing is visible; there will be a repaint the
instant a tile is tapped. **That is correct and must not be "fixed" by pre-attaching a guess**, which
would be a write to the wrong book waiting to happen.

### 4.2 `hydrate`'s `already` guard is what makes §2.2 free

`hydrate(accountId)` early-returns its selection logic when the same identity asks twice
(`this.hydratedFor === key`). That is the only reason a resume cannot re-raise the picker. **Do not
remove it, and do not add a `hydrate` call to any resume path.** A page reload is a genuine cold start
(module state resets) and correctly asks again.

### 4.3 Deleting down to ONE child must not leave a one-tile picker

`deleteProfile` publishes `{ activeProfileId: null, status: 'choosing' }`. With the policy at `> 1`
that now yields `'none'` — a rendered app with an INERT store and nobody playing, which is the
"nobody to play as" hole. So the store must select the sole survivor. Handle it in `deleteProfile`,
not in the policy: the policy stays a pure statement of what to SHOW.

### 4.4 The mandatory create dialog stays, and stays un-gated

`rosterSettled && profiles.length === 0` raises an un-dismissible `CreateProfileDialog`. §2.3 removes
the picker's OPTIONAL create button and nothing else — this path is untouched and must stay un-gated:
it is the only way into the app, and a brand-new account may have no PIN set yet, so a `requirePin`
here would lock the adult out of their own first run. The two are different surfaces that happen to
share a component; do not delete both.

### 4.5 The screenshot harness must never meet the picker

`?nogate=1` attaches `DEV_PROFILE` (one child) and guest attaches `GUEST_PROFILE` (one child), so
neither reaches `> 1` and every existing recipe keeps working. **This is load-bearing**: if the picker
ever became reachable under `?nogate=1`, every recipe in `.claude/skills/ui-screenshot/` and
`sweep.mjs` would break at once and silently — the same failure class as rewording
`aria-label="Til de voksne"`. `?devkids=<n>` (§6.1) is the deliberate, opt-in way in.

### 4.6 Do not delete the pointer WRITE

After this change nothing reads the pointer at boot. Keep `writePointer` in `selectProfile` anyway:
it is one line, it is what a later "sidst spillet" marker would want, and deleting it is a behaviour
change disguised as a tidy-up. Say so in a comment or the next session removes it.

### 4.7 The gate is a promise, not a modal

`requirePin` resolves `true` without prompting inside the ~5-minute adult-unlock window
(`.claude/rules/adult-surface.md`). So an adult who just came from the settings surface will get no
prompt at all — that is correct, and it is why the gate must be `await`ed rather than assumed to show
something.

---

## 5. What must NOT change

- **`aria-label="Til de voksne"`** on the profile badge. Every recipe and `sweep.mjs` clicks it.
- **Picking a child at boot stays un-gated.** Nothing on that screen gains a PIN; the create button
  simply leaves it (§2.3).
- **Creating a child lives ONLY behind the parental gate**, in `Til de voksne` → `Konto` → `Børn` —
  plus the mandatory first-run dialog, which precedes any account having a child to protect (§4.4).
  Do not re-add a create affordance to any un-gated surface.
- **`profileGateBlocks`** keeps claiming `authUiOpen` and keeps `musicClient.setGateBlocking('profile')`
  silent behind the picker. With the picker now showing on most launches for a two-child family, the
  bed simply starts a beat later.
- **`progressStore` stays inert until `attach()`**, and `profileStore` stays its only caller.
- **No schema change and no `SCHEMA_VERSION` bump.** A v5 would wipe every child's book
  (`.claude/rules/rewards-and-progression.md`).
- **The guest path is untouched** apart from §2.8's deleted row.

---

## 6. Verification

### 6.1 The DEV seam this needs — build it first

**`?devkids=<n>`** in `src/utils/devHarness.ts`, DEV/harness-only like every sibling: under the auth
bypass, seed `n` stand-in profiles instead of the single `DEV_PROFILE`. Without it the picker is
reachable only by minting a real session, which **writes into the owner's production Neon database**
(`.claude/rules/auth.md`) — so the feature would be rung-3-only and every claim below unverifiable.
Same shape and same reasoning as `?hidetools=1`.

### 6.2 New guards, each to be re-broken (`/re-break`)

1. `profileGateSurface` returns `'picker'` at 2 profiles and `'none'` at 1 — pinned as a table over
   0/1/2/3 profiles × settled/unsettled × creating, so the `> 1` boundary is explicit.
2. `hydrate` does not honour the pointer when more than one child is cached (assert against the store's
   published state, not the source text).
3. Deleting down to one child leaves that child SELECTED, never `choosing` (§4.3).
4. The mandatory first-profile dialog is still raised for an answered, empty roster.
5. The picker renders NO create affordance: `ProfilePicker` has no `onCreate` prop and `ProfileGate`
   passes none — and the MANDATORY dialog still opens for an empty roster, so the guard cannot pass by
   having deleted both (§4.4).
6. `BoernSection` renders no "Tilføj et barn" affordance on the guest branch.

### 6.3 Rungs 1–2

`cdp.mjs` with `?nogate=1&devkids=2`: the picker appears, two tiles, tapping one enters the app as that
child and the store attaches. Re-run without `devkids` and assert it does **not** appear (a
known-negative control — §4.5 is the claim that most needs one). Then `webkit.mjs --device ipad-pro`
for layout, plus `844×390` and `375×667`: full-screen, no horizontal overflow, every tile ≥ 44px.

### 6.4 Rung 3 — the owner

The resume behaviour (§2.2) is the residue: backgrounding a real iPad mid-game and returning must land
back on the board, and no harness can prove that. Also: a real two-child family across two launches.

---

## 7. Out of scope

The picker's visual design (it ships as it is) · sticker counts on tiles (§2.5) · adding or managing
profiles from the picker (§2.3, §2.4) · the adult "Skift barn" rows (§2.7) · anything about PIN policy ·
the guest book adoption flow, which already runs at first child creation and is untouched.

---

## 8. Kickoff prompt for a fresh session

> Implement `tmp-prd-boern-picker.md`. Build `?devkids=<n>` FIRST (§6.1) — without it nothing below is
> verifiable. Then: the picker on every cold start at 2+ children, cold start only, "Tilføj barn"
> the picker's own "Tilføj barn" deleted (the MANDATORY create dialog stays — §4.4), and the guest's
> "Tilføj et barn" row deleted. §4 is the list of things that look like tidy-ups and are not. Follow §6 exactly: every new guard re-broken, and a
> known-negative control for "the harness never meets the picker".
