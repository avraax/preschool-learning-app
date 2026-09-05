# PRD — "Familie": merge Barn + Konto + the sign-in row into one group

**Status:** AUTHORED 2026-09-05, NOT IMPLEMENTED. Owner chose shape **A** after being shown three.
**Scope:** the adult surface's information architecture only. No auth logic, no progress logic, no new
spoken lines, no new server work.

---

## 1. Why — there are literally two doors to one room

A guest opening "Til de voksne" sees **both**:

- the **`Log ind`** promo row pinned above the rail, and
- a rail entry **`Konto — Ikke logget ind`**

…and `KontoPane` opens with `if (guest) return <the sign-in offer>` before it renders anything else. So
the two entries lead to the *same screen*. That is not untidiness, it is a duplicate affordance.

Underneath it is a modelling problem the owner named directly (2026-09-05): **`Barn` and `Konto` are not
two things to a parent.** They are one thing — the family — seen from two angles. Today the child roster
lives in one group and the account that would *back it up* lives in another, and the argument for signing
in ("Bogen er sikret" — the child's book is uncopied) is a statement about the CHILD that is filed under
account.

**The merge also restores a contract this surface already broke.** Settings PRD-01 specified **five
mutually-exclusive groups**; `Privatliv` was added as a deliberate sixth at App Store PRD Phase A
(§3.5/§3.6, owner 2026-08-06). Folding `Barn` + `Konto` into `Familie` returns the rail to five:

| today (6) | after (5) |
|---|---|
| Barn · **Konto** · Læring · Lyd · Udseende · Privatliv | **Familie** · Læring · Lyd · Udseende · Privatliv |

---

## 2. What comparable products do — researched 2026-09-05

Cited so the shape is not re-argued from taste. Every URL read on 2026-09-05.

- **Netflix nests profiles INSIDE the account, not beside it.** The hierarchy is account → *Profile and
  Parental Controls* → per-profile settings, i.e. "the account is the container level and profiles are
  user-level divisions within it". That is exactly `Familie` ⊃ children.
  https://help.netflix.com (via search), https://www.lincolnshire.gov.uk/directory-record/78986/streaming-services-netflix-guidance-for-parents-and-carers
- **Khan Academy Kids keeps profiles and parental controls in ONE parent section** — profiles are created
  there (name, age, avatar, multiple children) and the learning restrictions live in the same place.
  This repo already cites Khan Academy Kids as the source of the avatar-as-door pattern
  (`.claude/rules/adult-surface.md`), so following it here is consistent rather than novel.
  https://khankids.zendesk.com/hc/en-us/articles/360006764812
- **Duolingo splits `Account` from `Profile`** — the very split the owner finds unintuitive. Worth
  recording as the rejected precedent, not the followed one.
  https://duolingo.fandom.com/wiki/Frequently_asked_questions/Configuration
- **The conventional section ORDER for an account surface** is General → Security → Notifications →
  Privacy → **Danger Zone last**, and the guidance is explicit that destructive actions must be
  *"isolate[d] … in a 'Danger zone'"* with *"a distinct border or background"*.
  https://uxpatterns.dev/patterns/authentication/account-settings
- **Apple's HIG could not be read.** `developer.apple.com/design/human-interface-guidelines/settings`
  returns only its title to a fetch (JS-rendered), three attempts. **UNKNOWN, not a finding** — do not
  cite Apple in the implementation as if it had been read. What *is* observable in iOS itself is that the
  Apple Account sits as a distinct row at the very TOP of Settings, above the grouped list, which is the
  pattern §3.1 adopts.

---

## 3. The shape

One rail entry, **`Familie`**, whose pane is ordered sub-sections. Order is load-bearing: identity first
(it is the thing the rest hangs off), destructive last and furthest from everything benign.

### 3.1 Top: the identity row

The account, as one row at the top of the pane — iOS's Apple-Account placement.

- **Guest:** the sign-in offer. This is the *only* place it now appears. **The standalone `Log ind` row
  above the rail is DELETED.**
- **Signed in:** the email, plus its state.

**Every word of the existing offer copy survives unchanged.** `.claude/rules/adult-surface.md` §"The
account offer" records why each line is there — outcomes not features, "Bogen er sikret" leading because
it is the only line true for every family, the progress-aware sticker count, the four-clause trust line,
"say the price before the work". Re-litigating that copy is out of scope; this PRD moves it, nothing else.

### 3.2 `Børn`

Active child · `Sådan går det` (read-only) · roster · switch · rename · add. Unchanged behaviour,
including `barn.switch`'s `requirePin('switchProfile')` and `barn.add`'s "Kræver en konto" routing —
which now routes *within the same pane* instead of across the rail, and is a small win the merge buys
for free.

### 3.3 `Sikkerhed` — signed in only

`Kode` (PIN) · `Tilføj Face ID` · `Fjern Face ID`. Verification unchanged (`removePasskey` keeps
`requirePin('manageCredentials')`).

### 3.4 `Synkronisering` — signed in only

The sync state row. `Synkronisér nu` stays a `devTool`, i.e. absent from the production build
(`adultSettingsIa` `devTool`, 2026-09-05).

### 3.5 The danger zone — **TWO blocks, never one**

This is the crux, and the reason shape A needed a PRD rather than an afternoon.

Merging the groups puts **`Slet barnet`** and **`Slet kontoen helt`** in one pane for the first time.
NN/g, verbatim (read 2026-09-05): *"Avoid placing highly consequential actions (that will require a lot
of user work to fix if accidentally triggered) directly next to options that are benign."* Its remedies
are spatial separation (Fitts' Law — *"the few additional milliseconds … is nothing compared to the
frustration and time it would take to undo a major error"*), redundant visual signals, and the Gestalt
proximity principle. https://www.nngroup.com/articles/proximity-consequential-options/

So the pane ends with two visually distinct blocks, in this order, **account last**:

| block | items | scope |
|---|---|---|
| **`Farligt for {navn}`** | `Nulstil fremgang` · `Slet barnet` | `child` — this device's copy |
| **`Farligt for kontoen`** | `Log ud på denne enhed` · `Log ud alle steder` · `Slet kontoen helt` | `account` |

Requirements on the blocks:

1. **Separate containers with their own headings**, not one strip with a divider. The Gestalt argument is
   the whole point: a divider inside one group still reads as one group.
2. **The child block names the child** (`Farligt for Gæst`), as the reset confirmation already does. The
   blast radius must be legible from the heading alone.
3. **The account block is last**, so `Slet kontoen helt` is the furthest control in the pane from
   `Omdøb barnet` — today they are in different groups, and that accidental protection must be replaced
   with a deliberate one.
4. **Every existing verification is preserved exactly.** `NULSTIL` / `SLET` / `SLET ALT` stay three
   distinct words — `adultSettingsIa.test.ts` already forbids two destructive actions sharing one, and
   the reason is precisely the muscle memory this merge makes possible.

### 3.6 Guest sees a short pane, and that is correct

No account ⇒ §3.3 and §3.4 do not render, and neither does `Farligt for kontoen`. A guest's `Familie`
pane is: sign-in offer → `Børn` → `Farligt for Gæst`. Three blocks, no dead rows, no "requires an
account" stubs except the one that already exists on `Tilføj et barn`.

---

## 4. What changes in code

| file | change |
|---|---|
| `src/config/adultSettingsIa.ts` | `AdultGroupId`: drop `'barn'` + `'konto'`, add `'familie'`. Re-parent both groups' items into it, in §3 order. |
| `src/config/adultSettingsIa.test.ts` | "exactly the six groups" → five. Plus the new guards in §6. |
| `src/components/adult/AdultSettings.tsx` | Rail renders 5 entries. **Delete the standalone `Log ind` row** (`[data-guest-signin-promo]`). `lastPane` must fall back when it holds a now-invalid `'barn'`/`'konto'`. |
| `src/components/adult/panes/` | `BarnPane` + `KontoPane` → one `FamiliePane` composing the §3 sub-sections. The two current files hold the logic; this is composition, not a rewrite. |

**Keep the item ids** (`barn.delete`, `konto.deleteAccount`, …) even though the group is now `familie`.
They are declared "stable id, unique across the WHOLE surface", the panes read `typeToConfirm` through
`adultItem(id)`, and `adultSettingsIa.test.ts`'s load-bearing assertions key off them against the real
`pinVerifierFor` table. Renaming them buys nothing and risks the one guard that stops an account-scoped
destructive action being downgraded to the local unlock. The mild oddity of a `barn.*` id under
`familie` is the cheaper half of that trade — **say so in a comment, so the next reader does not "fix"
it.**

---

## 5. What must NOT change

- **`aria-label="Til de voksne"`** on the profile badge. Every `ui-screenshot` recipe and `sweep.mjs`
  clicks it; rewording silently breaks the whole harness at once (`adult-surface.md`).
- **`data-guest-gate-prompt` / `data-guest-gate-key`** — the arithmetic gate the screenshot recipe
  solves (`listing.md` §2.2).
- **The three guideline-critical items stay visible and un-`devTool`:** `konto.deleteAccount`
  (Guideline 5.1.1(v) requires in-app deletion to be findable), `privatliv.microphone`,
  `privatliv.policy`. Guarded already; the guard must survive the re-parenting.
- **`Privatliv` stays its own group.** It exists separately so a Kids Category reviewer finds the mic
  default and the policy without hunting (App Store PRD §3.6). Do not fold it into `Familie`.
- **One `Luk`, no back arrow at regular width, max modal depth 3**, and the phone's `fullScreen`
  push-nav (`adult-surface.md` navigation grammar). The merged pane is longer; on a phone that is a
  scroll, which is fine — and it *helps* §3.5, since it puts more distance between benign and destructive.

---

## 6. Verification

**New guards (all must be re-broken — `/re-break`):**

1. The rail is exactly the five groups, in order, named literally.
2. `familie` contains every item that was in `barn` or `konto` — **no item is lost in the move**. Assert
   against the literal id list, not a count.
3. **No child-scoped and account-scoped destructive item may share a block.** The IA needs a `block`
   (or `dangerBlock`) field for this to be assertable as data.
4. The account danger block is **last** in the pane order.
5. Source-read on `FamiliePane`: the two danger blocks are separate containers (the data being right
   proves nothing about the render — `game-development.md`'s "a config test cannot see whether the
   component USES the config").
6. **No `[data-guest-signin-promo]` anywhere** — the duplicate door is gone.

**Existing suites that must stay green:** `adultSettingsIa.test.ts` (the PIN-downgrade assertions),
`gateLayout.test.ts` (`data-capture-exclude` on the Dialog ROOT), `noEmoji.test.ts`,
`contextBudget.test.ts`.

**Rung 1–2:** drive the surface with `cdp.mjs` — the gate-solving eval is in
`.claude/skills/ui-screenshot/SKILL.md`. Assert five rail entries, no `Log ind` row, and both danger
blocks present when signed in. Note `?hidetools=1` forces the production shape.

**Rung 3 (owner):** the signed-in half is unreachable to the harness — minting a session writes into the
production Neon database (`.claude/rules/auth.md`), so `Sikkerhed`, `Synkronisering` and
`Farligt for kontoen` are device-checked only.

---

## 7. The consequence nobody would look for

**`docs/app-store/shots/iphone-6-voksne.png` IS the rail/group list.** This change makes that screenshot
wrong the moment it ships. Re-shoot it — `docs/app-store/listing.md` §2.2 has the command, and it needs
**`&hidetools=1`** so it shows the production shape. The iPad shot is the `Læring` pane and is unaffected.

---

## 8. Out of scope

The sign-in offer's copy (§3.1) · anything in `Læring`/`Lyd`/`Udseende`/`Privatliv` · the `devTool`
gating shipped 2026-09-05 · auth, sync and progress behaviour · the `fire` pronunciation fix, which is a
separate audition (`scripts/audition-fire.mjs`).

---

## 9. Kickoff prompt for a fresh session

> Implement `tmp-prd-adult-familie-ia.md` — merge the adult surface's `Barn` and `Konto` groups plus the
> standalone `Log ind` row into one `Familie` group, with the two separate danger blocks §3.5 requires.
> Follow §6 exactly: every new guard re-broken with `/re-break`, and re-shoot `iphone-6-voksne.png` per §7.
