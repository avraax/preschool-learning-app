# PRD — the corner: one book, one child, one labelled door

**Status:** authored 2026-09-05, NOT implemented. Owner picked option A out of three (A / cheap fix /
delete the ring) after the corner was reviewed against Khan Academy Kids, Netflix Kids and NN/g.

**Timing is still open.** This invalidates every child-facing App Store screenshot (§8), so it is either
done *before* the first submission or shipped as 1.1. The owner's stated lean was 1.1; nothing here
assumes otherwise, and §8 is written to be run on the day either way.

---

## 1. Why — three jobs, two identical discs, no labels

The top-right corner currently carries a `RewardRing` and a `ProfileBadge` at the same `size`, 8–12px
apart. Between them they are doing **three unrelated jobs**: how close am I to the next sticker, who is
playing, and where is the adult area. The owner's words: *"it looks weird having these two upper right
icons next to each other, different dimensions, still illustrations, one greyed out, and i dont think
they indicate the feature and meaning behind it very well."*

Every part of that is measurable, and none of it is a taste problem:

- **"Different dimensions."** They are the *same* box — 48px on home, 46px in game, 44px on menus. But
  `RewardRing` paints a 5px stroke (`ringStroke(48) = 5`) plus a centre image at `size * 0.52` = 25px
  held at **`opacity: 0.3` under `filter: brightness(0)`**, while `ProfileBadge` paints a full-colour
  opaque portrait at `objectFit: contain` across the whole 48px box. Equal geometry, roughly triple the
  ink. The eye reads ink, so the pair looks mismatched no matter how carefully the boxes are matched.
  `ProfileBadge`'s "sized at PARITY with the ring" decision (2026-08-09) was solving the wrong variable.
- **"One greyed out."** That is the next reward's silhouette. It is the last surviving piece of the
  "promise now, payoff later" two-beat that Endless Play PRD-01 D4 already deleted everywhere else,
  and at 25px / 30% opacity it is not identifiable as an object at all.
- **"Doesn't indicate the feature."** On a fresh profile the count badge is *hidden at zero*
  (`showCount && count > 0`), so a new child's corner is an empty grey circle with a smudge in it. There
  is nothing on screen that says book, sticker, reward or settings.
- **The part the owner didn't name, and the real defect: two same-size discs, side by side, route to
  two different places.** `ProfileBadge.tsx` says so in its own header — *"Two adjacent same-size discs
  now go to two different places; that is the accepted cost."* It is no longer accepted.
- **The avatar is doing two contradictory jobs.** *Who is playing* is a passive cue aimed at the child;
  *the adult door* is a control aimed at the owner. A five-year-old taps their own face and meets a
  keypad. That is a mis-teaching, not a safety feature — the gate is what makes it safe, and the gate
  works just as well behind a labelled row.

**What the comparable apps do.** Khan Academy Kids puts the avatar top-right, but it opens the
*user-select* screen; "For Parents" is a **labelled row at the bottom of that screen**, behind the
grown-ups gate. Netflix, Disney+, Paramount+ and (since Oct 2025) YouTube on TV all make "who is
watching" an explicit pictorial surface, and Netflix's 2025 kids redesign went *more* visual, not more
chrome. NN/g's children's-UX work is the reason the current centre art fails: 3–5s are pre-readers who
think in icons that **allude to real-world objects**, and an abstract ring around a 30%-opacity
silhouette is the wrong register for the age.

Apple 1.3 requires the parental gate for the adult area. It does **not** require the door to be the
child's face.

---

## 2. The decisions

### 2.1 The corner holds THE BOOK, and nothing else

One circular control, top-right, on home / section menus / in game. It is the child's own Reward Book:

- **Centre: a baked full-colour book object.** It is *their* book and they own it, so it is never
  dimmed, never a silhouette, never gated on progress. Recognisable at 34px, which the silhouette
  never was.
- **The collar: the existing gauge arc**, unchanged — same `rewardRingGeometry.ts`, same derived gap,
  same fill from `xpProgress().fill`. This is the "getting closer" feedback that pulls the next round;
  it is the one thing option C would have cost and the reason C was rejected.
- **The badge: `rewardNumber()`, shown at zero too.**

Read as one sentence: **this is my book · the ring around it is the next sticker coming · the number is
how many I have.** Three facts, one object.

### 2.2 The next-prize silhouette is DELETED

This reverses Reward Book PRD-01's *"the ring's centre IS the next prize"*, deliberately and in the
open, so nobody re-derives it from its own justification.

It was the last survivor of the promise/payoff two-beat. Endless Play PRD-01 D4 already killed the
crossing flash and the crossing chime on the finding that *"for a five-year-old only the sticker meant
anything"*, and moved the ceremony in-game to the seam. The silhouette is the same idea in the same
place, and it is additionally illegible. **Do not restore it as a missing beat: its absence is the
change.**

### 2.3 The count badge shows ZERO

Reverses `RewardRing`'s own *"an empty badge on a fresh profile teaches nothing and is one more thing to
decode."* That was true of a bare numeral floating beside a smudge. With a recognisable book behind it
the 0 has a referent, and a fresh corner that reads **"my book · nothing in it yet · this ring is
filling"** is a complete and honest picture on day one. `count >= 100` still widens to a pill.

### 2.4 Identity moves OUT of the corner and becomes a PILL

A new `ProfileChip`, top-**left**, in the title row: small portrait (~32px) plus **the child's name as
text**.

- **Left, not right** — physical separation is what stops the pair reading as a pair. Adjacency was the
  defect; shrinking the avatar would not have fixed it.
- **A pill, never a circle.** This is the anti-confusion invariant and it is mechanically guarded
  (§7.2): the book is the only circle in the chrome, so shape alone carries "these are different kinds
  of thing" for a child who cannot read either label.
- **The name as text**, reversing `profileBadge.test.ts`'s *"a PICTURE and a letter, never the name as
  text"*. That guard existed because the badge was a 46px disc with no room; a pill has room. Names here
  are short, the owner's five-year-old knows all 29 letters, and even a pre-reader recognises the shape
  of their own name. The `profileInitial` letter-in-a-disc goes away with it. A whitespace-only name
  still renders portrait-only — that state stays supported, it is not a defect.
- **Still not a meter.** The forbidden-import guard moves across intact: no `useProgress`,
  `progressStore`, `rewardNumber`, `xpBus`, `xpProgress`. Add nothing that fills, counts or animates.

### 2.5 IN GAME: the book only — no identity element at all

`GameShell` renders the book and stops. Nobody needs telling who they are mid-game, this is the surface
where real estate matters most, and it retires a cost `GameShell.tsx` recorded against itself: *"the
untappable badge now occupies the corner the tappable ring used to hold, so a child aiming at the far
corner for Min Bog hits a dead disc."* The book takes the corner back.

The adult door therefore leaves the in-game header. That is intended: nobody opens settings mid-round,
and backing out is one tap on a back button that is already in that header.

### 2.6 The adult door becomes a LABELLED ROW inside a "Hvem spiller?" sheet

Tapping the chip opens a new `WhoIsPlayingSheet` — Khan's model, adapted to our gating:

1. The active child, large: portrait + name. Read-only. This is the child-safe payoff of tapping — *"that's me!"*
2. **"Skift barn"** → the parental gate → the adult surface at Konto → Børn.
3. **"Til de voksne"** → the parental gate → the adult surface.
4. **"Luk"**.

**Sibling tiles are NOT shown here.** Børn picker PRD-01 §2.7 put mid-session switching behind the
parental gate, in the adult surface's roster rows, and that stands. Tiles that look tappable but raise a
keypad would be worse than no tiles. "Skift barn" is honest about being an adult action, and it is a
deep-link into the switch that already exists — **no second switching path is built.**

`ProfilePicker` itself is **untouched**: boot behaviour, the cold-start rule, and its "no create
affordance" rule are all out of scope. The sheet is a new component that borrows its visual vocabulary.

### 2.7 Both rows go through the gate that already exists

`adultSurfaceBus.open()` → `AdultSurface` → PIN (or the guest arithmetic gate) → lazy `AdultSettings`.
Unchanged. The sheet adds no gate of its own and must never call `profileStore.selectProfile` directly.

`warmScreenshot` on pointer-down moves to the sheet's two rows, keeping the snapdom chunk off the
dialog's enter transition.

### 2.8 `aria-label="Til de voksne"` moves to that row, and stays unique

It is the selector the entire screenshot and sweep harness clicks. It moves with the door — the
accessible name of a control is its action — and §7.2 asserts it appears exactly once in the tree.
Every recipe becomes two clicks (§7.4).

---

## 3. What changes in code

| File | Change |
|---|---|
| `src/assets/ui/book.webp` + `index.ts` | **New.** Baked book object. Green-screened cutout like the avatars — it sits on the painted world. |
| `src/components/common/RewardRing.tsx` | Centre art → `uiArt.book`; delete `silhouette` / `centreStyle` / `bookFull` / the `rewardArt(next…)` import; `showCount && count > 0` → `showCount`. |
| `src/components/common/ProfileChip.tsx` | **New**, replaces `ProfileBadge.tsx` (deleted). Pill, portrait + name, opens the sheet. |
| `src/components/common/ProfileBadge.tsx` | **Deleted.** |
| `src/components/auth/WhoIsPlayingSheet.tsx` | **New.** §2.6. |
| `src/components/home/HomePage.tsx` | Chip into the title row (left); ring stays right, `ProfileBadge` gone from the cluster. |
| `src/components/common/GameSelectionLayout.tsx` | Same: chip beside the back button / category name; ring keeps the right. |
| `src/components/common/GameShell.tsx` | Ring only. `ProfileBadge` import and render deleted. |
| `src/services/adultSurfaceBus.ts` | `open(target?: 'konto-boern')` — optional, additive; a bare `open()` keeps today's meaning. |
| `src/components/profileBadge.test.ts` | → `profileChip.test.ts`, re-pointed (§7.2). |
| `src/components/rewardSurfaces.test.ts` | Re-point the ring tests; add §7.2's new ones. |
| `.claude/skills/ui-screenshot/**`, `docs/ui-reference/**`, `docs/app-store/listing.md` | §7.4, §8. |

---

## 4. The traps — read this section before writing any of it

### 4.1 `size` is the ring's ONE dimension — never `sx`

`rewardSurfaces.test.ts` already guards this and it exists because of a real defect: a phone-landscape
`sx={{width:36,height:36}}` left a 48px svg and a 25px centre image inside a 36px box, putting the art
7.5px left of the ring's own centre on an iPhone. The book art is sized off `size` exactly as the
silhouette was. Do not introduce a book-specific dimension.

### 4.2 `compact` and the smaller size travel together

A phone-landscape ring passes **both** `compact` and its smaller `size`, or the badge geometry is
computed for the wrong diameter. Guarded already; it survives this change unchanged.

### 4.3 The chip must not become the second door to Min Bog

`rewardSurfaces.test.ts` asserts exactly ONE route to `/album` per surface. The chip routes to the
sheet and nowhere else. This was already guarded on `ProfileBadge`; carry it over rather than dropping
it because "the chip obviously doesn't do that".

### 4.4 The sheet is a blocking overlay — take the same flags the picker takes

`auth.setAuthUiOpen(true)` while open, and `musicClient.setGateBlocking(...)`, or the audio-permission
cue can paint over it and the music bed keeps playing under a modal. One blocking overlay at a time.
Only a `click` handler may close it — see the "Start lyd nu" tap-through incident (0ec1df3); a
`pointerdown` close presses whatever is behind it.

### 4.5 Nothing attached → render NOTHING

`ProfileBadge` returns `null` when there is no profile (detached, or `status: 'choosing'` mid-boot).
The chip keeps that exactly. No placeholder, no skeleton: a grey pill that resolves into a name one
frame later is a flicker in the corner of every cold launch, and the gate is blocking play in that
state anyway.

### 4.6 The portrait resolves unconditionally

`avatarArt(normalizeAvatarId(...))` always returns art and `avatars.test.ts` fails the build if any id
lacks its WebP. Do not add a `??` beside it — the existing guard asserts there is no fallback on that
line, and a fallback would mask a missing asset instead of failing the build.

### 4.7 The book asset needs its own coverage test

Same shape as `rewardArtCoverage.test.ts` / `avatars.test.ts`: the build fails if `uiArt.book` is
missing. An unresolved import here is a blank corner on every screen in the app, and it would not fail
any existing test.

### 4.8 No emoji, and the book is not an exception

`noEmoji.test.ts`'s allowlist is **empty** and stays empty. Baked WebP, or nothing.

### 4.9 Don't let the chip drift into the mascot's space

`scene-and-world.md`: nothing may be positioned by a tuned percentage against content it doesn't know.
The chip belongs to the **chrome** (the toolbar / title row), reserved like the rest of it — not
floated over the world at an offset that happens to look right at 1366×1024.

---

## 5. What must NOT change

- **The ring is still the only door to Min Bog**, and there is still exactly one per surface.
- **`rewardNumber()` is the child-facing number.** Never `globalLevel()`, never a distance — no "n of
  72", no percentage, no "x to go". Only the fill signals nearness.
- **Ring geometry stays derived** in `rewardRingGeometry.ts`, pure and unit-tested at every shipped
  size. No tuned offsets, no tuned percentages, nothing new hardcoded in the component.
- **The ring fills, and that is all it does.** No flash, no crossing chime, no `+N` flyer.
- **The ceremony is the only grant point**, in-game at the seam, via `grantPendingRewards`.
- **The header holds nothing that measures performance.** No score slot, ever.
- **Progress shows in the world only as ambient density.** The book does not gain a world presence.
- **Mid-session child switching stays behind the parental gate**, in Konto → Børn. One switching path.
- **`ProfilePicker` and `ProfileGate` are untouched** — cold-start rule, single-child straight-in, no
  create affordance.
- Danish throughout · Comic Sans for child-facing type · 44px minimum touch targets · token-driven
  colour, `getCategoryTheme(id)` and `onTileColor` · CSS keyframes for any continuous motion, never
  `repeat: Infinity` · **no `content-visibility`** · Safari 17 is the floor.

---

## 6. Verification

### 6.1 Rungs 1–2

`npm test` · `npm run lint` · `npm run build` · `npm run context:check`, then the sweep:

```
node .claude/skills/ui-screenshot/sweep.mjs --selftest
node .claude/skills/ui-screenshot/sweep.mjs --phase smoke
node .claude/skills/ui-screenshot/sweep.mjs --phase layout
node .claude/skills/ui-screenshot/sweep.mjs --phase ceremony --concurrency 1
```

Layout matters more than usual here: the chip is new chrome in a row that already holds a back button,
a category name and (on staging) the backend pill. Check all four skins, dark, reduced motion, phone
portrait **and** phone landscape. Rung 2 (real WebKit, iPad UA) settles the title row — rung 1 and rung
2 size flex differently and this change is a flex change.

### 6.2 New guards, each to be re-broken (`/re-break`)

Every one of these must be proven to fail against the un-fixed code. A guard that greps source strips
comments first — this repo's comments are dense enough to satisfy a naive regex.

1. **The corner holds one control.** No file renders `<RewardRing` and `<ProfileChip` as siblings in
   one cluster. Break: put the chip back beside the ring.
2. **`GameShell` renders no identity element.** Break: re-add the import.
3. **The chip cannot read progress.** Forbidden: `useProgress`, `progressStore`, `rewardNumber`,
   `xpBus`, `xpProgress`. Break: import one.
4. **The chip is not a door to `/album`.** Break: add the navigate.
5. **The count renders at zero.** Break: restore `count > 0`.
6. **No silhouette treatment survives in the corner** — no `brightness(0)`, no `opacity: 0.3` on the
   centre art. Break: restore `centreStyle`.
7. **`aria-label="Til de voksne"` appears exactly once**, on the sheet's row. Break: add a second.
8. **The sheet never switches a child itself** — no `selectProfile` in it. Break: call it.
9. **`uiArt.book` resolves** (§4.7). Break: rename the file.

### 6.3 Rung 3 — the owner

- The corner on home, on a section menu, and in a game — does it read as one thing with one meaning?
- A **fresh profile** (0 stickers): does the corner say anything now?
- Tap the chip → is "that's me" the reaction, and do both adult rows meet the keypad?
- Two children: does the chip name the right one after a switch, on every surface?
- The **child's iPad, 17.7.11** — the Danish, real touch feel, safe-area insets in the title row.

---

## 7. Harness and docs that move with the door

`aria-label="Til de voksne"` is now two clicks deep. Update, in the same commit as the code:

- `.claude/skills/ui-screenshot/reference/recipes.md` — the two voksne captures.
- `.claude/skills/ui-screenshot/SKILL.md` line ~89 (*"the avatar IS the door"* — no longer true).
- `.claude/skills/ui-screenshot/reference/gotchas.md` (~104, ~162).
- `sweep.mjs` ~174 and the `CHROME` regexes in `round-probe.js` / `ceremony-probe.js` — these are
  skip-filters, so they degrade silently rather than failing. Check them by hand.
- `docs/ui-reference/` — re-shoot; the corner is in every frame.
- `.claude/rules/adult-surface.md`, `rewards-and-progression.md`, `scene-and-world.md` — the door moved
  and the silhouette is gone; record both, and **replace** the superseded prose rather than softening it.

---

## 8. App Store — what this invalidates

**All ten child-facing screenshots.** The corner is in every frame, so shots 1–5 change on both iPad
and iPhone. Shots 6 (`*-6-voksne.png`) show the adult pane itself, which does not change — but the
*recipe* that produces them does (§7).

On the day, in this order: **finish the UI → re-shoot → `npm run shots:check` → `npm run shots:upload`
→ attach the build → submit.** Re-shooting before the last UI change means doing it twice.

Keep `&hidetools=1` on any voksne capture, strip `[data-backend-badge]` before capturing, and check byte
25 of the PNG header is `2` (RGB, not RGBA) after every capture.

---

## 9. Out of scope

- `ProfilePicker` / `ProfileGate` / cold-start behaviour.
- Any second path for switching children.
- The Reward Book's own layout (`StickerAlbum`), pacing, slot count, or chapter structure.
- The ceremony.
- The mascot, the world, ambient density.
- The adult surface's contents or IA — only the *door* moves.

---

## 10. Kickoff prompt for a fresh session

> Implement `tmp-prd-corner-identity-and-progress.md`. Read it first, then
> `.claude/rules/rewards-and-progression.md` and `adult-surface.md`. W0 (the baked book asset + its
> coverage test) comes first — everything else renders it. Then the ring, then the chip, then the
> sheet, then the three call sites, then the guards. Re-break every guard in §6.2 before you claim it
> works, and name the verification rung for every claim.
