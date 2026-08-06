---
paths:
  - "src/components/**/*.tsx"
  - "src/components/common/LearningGrid.tsx"
---

# Responsive Design & Layout Rules

## Core Principle

All game layouts MUST fill available screen space without scrolling, working in both portrait and landscape.

## Phone-compact variant (iPad-first, phones supported)

The app is designed iPad-first, but every screen must ALSO fit phones. Use the shared guards from
`src/theme/phoneMedia.ts` — `PHONE_LANDSCAPE` (landscape ≤480px height), `PHONE_PORTRAIT`
(portrait ≤480px width), `PHONE_ANY` — as sx keys for a compact variant:

```typescript
import { PHONE_LANDSCAPE } from '../../theme/phoneMedia'
sx={{ fontSize: '1.6rem', [PHONE_LANDSCAPE]: { fontSize: '1.05rem' } }}
```

The SAME constant also works in JS — `useMediaQuery(PHONE_ANY)` (MUI strips a leading `@media`), so a
layout that has to *branch* rather than restyle (single-pane vs. two-pane) uses one definition of
"phone", not a second hand-written query that drifts.

No phone reaches 480 CSS px on its short side's counterpart (max is ~440, iPhone Pro Max), and no
tablet goes below ~600 — so these guards can never affect iPads. When adding a new game/screen,
verify it at 844×390 (and 667×375) with the ui-screenshot skill. GameShell/GameSelectionLayout/
UnifiedQuizGame/LearningGrid/UnifiedMemoryGame/RoundResultScreen already carry compact variants —
reuse them before inventing new ones.

### A `PHONE_LANDSCAPE` variant with no `PHONE_PORTRAIT` sibling is a bug waiting to be measured

Phone landscape gets fixed first because it is the obviously cramped one, and phone PORTRAIT is then left
inheriting `xs` — which in this codebase is a roomy tablet-ish layout, not a phone one. Lær Engelsk shipped
that way: two columns of 96px cards, i.e. five rows, under a hero and two chip rows, so the category chips
painted straight OVER the word cards and four animals fell below the fold. **Body overflow is `hidden`, so
"below the fold" here means unreachable, not scrollable** — always check `scrollHeight` vs `innerHeight`
and for a scrollable ancestor before deciding an overflow is benign.

Two things that make the fix converge instead of oscillating:

- **The binding constraint is usually the ROW COUNT, not the item height.** The grid is centred in a flex
  parent, so an overflow is clipped at BOTH ends and shrinking cards moves the last row by half of what
  you removed — 74→66px changed nothing measurable. Removing a whole row does. Match the column count the
  landscape variant already uses (5 for a 10-item grid) rather than shaving pixels.
- **Verify at 375×667, not just 390×844.** Four columns cleared the taller phone and still clipped the
  iPhone SE, which is 177px shorter. Both sizes are named in this file for that reason.

### The header band's empty middle is only empty ABOVE phone landscape

`GameShell` puts the game title *below* the toolbar and `GameSelectionLayout` left-aligns its own, so on
both shells the header's centre is free (back sits left, the reward ring right) — a genuinely safe slot for
a floating global element. **At `PHONE_LANDSCAPE`, GameShell moves the title INTO the header row**, to give
that row's height back to the play surface. So the slot is occupied there, and only there: the audio cue
shipped over "Bogstav Quiz" and the prompt art at 844×390 while 1024×768 and both portraits were spotless.
Anything `position: fixed` in that band needs a phone-landscape sibling (the cue moves to bottom-centre,
where that shell hides the corner mascot), and it has to be **measured** — this is the same class as the
`PHONE_LANDSCAPE`-with-no-sibling rule above, and no screenshot of the iPad would ever have shown it.

### A green unit suite is NOT device coverage

`sceneLayers.test.ts` is the ONLY unit consumer of `REFERENCE_VIEWPORTS`, and it is **insensitive to
viewport size**: `overscanPx` is `max(fraction × size, ceil(travel) + 6)`, so its `overscan < travel` term
can never be true at any viewport, and the one term that scales with height (`offsetY`) sits on a single
layer that is in `OFFSET_EXEMPT`. Adding a 1×1 viewport still passed. It remains worth keeping — it catches
a NEW nudged edge-covering layer, which is what it was written for — but **adding a viewport to that array
buys no layout coverage.** Device-size checking comes from the browser sweep
(`.claude/skills/ui-screenshot/sweep.mjs --phase layout`), which measures real rects in a real engine and
confirms them by hit-test.

## MUI units & this project's breakpoints — two things that don't read like traps

- **The breakpoints are OVERRIDDEN** in `src/theme/buildTheme.ts`: `sm 600 · md 768 · lg 1024`. So `md`
  is iPad **PORTRAIT**, not desktop, and `lg` is what means iPad landscape. Consequences that have
  actually misled a session: an `{ xs, md }` pair applies its `md` value to an 844-wide phone in
  LANDSCAPE (which is also `PHONE_LANDSCAPE`), while a 667-wide one gets `xs` — so the two phone
  landscape viewports can take different branches of the same responsive object.
- **A spacing prop multiplies; a size prop does not.** `width: 120` is 120px, but `pb: 120` is
  120 × the 8px spacing unit = **960px** (same for `p`/`m`/`gap`). Passing a px constant straight to
  `pb` collapsed a game's answer tiles to their 44px floor and pushed them off the top of the screen;
  the viewport that happened to get screenshotted looked fine, and only a rect measurement caught it.
  Write `pb: '120px'` when the value is a real length.

## Layout Pattern

```typescript
<Box sx={{
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}}>
  <AppBar sx={{ flex: '0 0 auto' }} />
  <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <Box sx={{
      flex: 1,
      display: 'grid',
      gridAutoRows: 'minmax(0, 1fr)',
      gap: { xs: '8px', md: '12px' }
    }}>
      {/* Content */}
    </Box>
  </Container>
</Box>
```

## Grid Rules

- Use CSS Grid with dynamic sizing, never fixed dimensions
- Responsive columns based on orientation and screen size
- Use `gridAutoRows: 'minmax(0, 1fr)'` for equal height distribution
- Example: `gridTemplateColumns: { xs: 'repeat(6, 1fr)', sm: 'repeat(8, 1fr)', md: 'repeat(10, 1fr)' }`
- Add `'@media (orientation: landscape)'` overrides for column counts

### A bare `orientation: landscape` query also catches the iPad — the PRIMARY device

Almost every landscape override in this codebase was written while fixing a phone, and a bare
orientation query hits the 1024×768 iPad just as hard. It is not a clipping bug, so nothing fails and no
screenshot looks wrong — the board is simply small, with the slack sitting unused. Measured twice in one
session: Hvilken Farve's prompt object rendered at **80px, smaller than its own 92px answer swatches**,
and Ram Farven's bench capped at 172px with **~215px of column height unused**.

- **Sizes go on `PHONE_LANDSCAPE`** (`src/theme/phoneMedia.ts`); **structure stays on the bare
  orientation query** — row-vs-column direction and column counts are genuinely orientation-driven and
  usually correct for both device classes. They are separate axes in the same `sx`; splitting them is
  the fix, not swapping one for the other.
- **Because the breakpoints are overridden (`lg` = 1024, see above), `lg` INSIDE a landscape query is
  iPad-only** — no phone reaches 1024 CSS px in landscape. So raising just that one value fixes the iPad
  without touching any phone, which is usually the smallest possible change.
- Growing something costs width you may not have: the same measurement pass showed 1024×768 landscape
  with only **25px of horizontal margin** left, so treat a size increase there as vertical-only, and
  size the element as a card — closing a void is not the same as filling it.

## Aspect Ratios

| Element | Ratio | Min Height | Max Height |
|---------|-------|------------|------------|
| Quiz cards (letters/numbers) | 4:3 | 80px | 120px |
| Memory cards | 3:4 | 60px | 100px |
| Action buttons | 3:2 to 4:3 | 44px | - |
| Display cards | 1:1 to 4:3 | - | - |

When using aspect ratios, set `gridAutoRows: 'auto'` and let aspect ratio determine height — but only
where the container's height is unbounded. Inside a no-scroll column it needs a height budget:

**An aspect-ratio'd panel in a no-scroll column must be sized from BOTH axes.** `aspect-ratio` + a width
cap knows nothing about the leftover height, so rows past the budget are simply clipped — and because the
centring flex parent overflows *both* ways, the panel also grows UP over whatever sits above it (Min Bog
ate its own "x / 9 samlet" line, which reads as a missing element, not as an overflow). Give the wrapper
`containerType: 'size'` and size the panel `width: min(100cqw, calc(100cqh * var(--ar)), <cap>)` with
`aspectRatio: var(--ar)` — one custom property per layout variant (`StickerAlbum.tsx` is the reference: 1
for its 3×3 page, 2.4 for the phone-landscape 5×2). Don't over-constrain: `height: 100%` *and*
`aspect-ratio` *and* `max-width` fight, and CSS resolves it by dropping your square. Prove it with
`--measure` (`rect.b <= innerHeight`), never a screenshot. Container-query units are Safari 16+, so
they're safe on the iOS 17 floor.

## The focal band is already full — adding to it means re-measuring

`PromptFocus` sits in GameShell's fixed 40%/30% band, and the browse blooms were deliberately sized
(PRD-18 W5) to fill that whole band. So **putting anything in the `repeat` slot costs ~58px of it** (pill
+ gap) and the bloom then overflows its own subject zone and paints UNDER the pill — flex does not save
you, because a fixed `clamp()`/vh glyph or `<img>` never shrinks. Trim the bloom's vh caps and prove
`subject.bottom <= pill.top` with `--measure` (not by eye) at **1024×768, 844×390 and 667×375** — phone
landscape has only ~95px of band and fails on its own after iPad passes. If it still won't fit, drop the
secondary element on that viewport rather than clipping it.

## A wrapping flow next to a fixed neighbour

Two rules, both learned the hard way on the section menus (`GameSelectionLayout` — a decorative section
landmark beside the wrapping game-tile flow):

- **The neighbour must be a flex SIBLING, never `position:absolute`.** A wrapping flow's extent depends
  on ITEM COUNT × viewport × orientation, so no set of `left`/`top` percentages can clear it — tuning
  them fixes one viewport and breaks another (this shipped as a landmark sitting on top of two game
  tiles). Give it its own track in a row/column and the overlap becomes structurally impossible.
- **Flex wrap has no orphan brake — `maxWidth` is the brake.** Each line is filled greedily, so a track
  that is *almost* wide enough for N items drops exactly ONE onto a second row (6+1), the same orphan the
  quiz grids refuse via `answerGrid.ts`. Narrowing the track forces the break earlier and the wrap comes
  out balanced (5+2 / 4+3). Counter-intuitively, *tightening* gaps/sizes can create an orphan by letting
  one more item squeeze onto the first line — so re-measure every section at every viewport after any
  sizing tweak, and compare against the BASELINE (see the `ui-screenshot` skill) before calling a wrap a
  regression: this layout already shipped with orphan rows.

## Typography

Use `clamp()` for responsive text: `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`.
Adjust for landscape orientation.

## Touch Targets

- Minimum 44px touch areas (accessibility requirement)
- Scale up on larger screens
- Use padding to increase tap areas without affecting visual size — **and cancel it with a matching
  NEGATIVE MARGIN** (`p: '16px', m: '-16px'`), so the layout box stays the size of the art and nothing on
  the board moves because a target grew. Put the handlers on that padded wrapper, with the visual element
  as its child.
- **A `::after` ring is NOT a touch target.** The obvious trick — an absolutely-positioned pseudo-element
  with a negative `inset` — looks right in computed style and Chrome does **not** hit-test it: measured
  with `elementFromPoint` just outside the art, which returned the ancestor, not the button. Slop has to be
  a real box. Prove it the same way (hit-test a point *inside the slop, outside the ink*), never by eye —
  a screenshot cannot show where a press would land.

## Overlays & stacking

A MUI `<Dialog>` defaults to `theme.zIndex.modal` = **1300**, while this app's blocking surfaces are
hand-rolled `position: fixed` boxes at ~10000 (lock screen, profile picker). So a dialog opened FROM one
of those mounts **underneath** it: live, interactive, and simply not drawn. That is a dead button with no
error, no failing test and a screenshot that looks right — it shipped twice.

The **audio cue** (`AudioBlockedCue`) is the counter-example worth knowing: it sits **below** 1300 on
purpose, so an adult dialog covers it rather than competing. A non-blocking chip that outranked the modal
tier would paint over settings for no benefit. Non-blocking ⇒ go under 1300; blocking ⇒ claim
`authUiOpen` (see `.claude/rules/audio-system.md`) instead of climbing.

**Two MUI Dialogs are the same trap without the 10 000.** Both default to 1300, so a nested dialog
raised FROM another dialog is on top only by DOM mount order — it looks right until something changes
the mount order, and nothing fails. The account-deletion PIN pad shipped like that over the settings
surface. Give the raised one an explicit z-index from the shared constant; see the `AUTH_Z` notes in
`.claude/rules/auth.md`.

- Give any dialog that can appear over a full-screen surface an explicit z-index above it, from a shared
  constant — `src/components/auth/authOverlayZ.ts` is the pattern (one documented ordering, no literals
  at the call sites, guarded by its own test).
- **Prove it with a hit-test, not a screenshot**: `document.elementFromPoint(cx, cy)` at the element's
  centre must return that element, not the thing above it. See the `ui-screenshot` skill.
- Prefer standing the lower surface DOWN over out-stacking it — one blocking overlay at a time is the
  app's rule (see `authUiOpen` in `.claude/rules/audio-system.md`). The z-index is the backstop.

## Decor next to content: RESERVE the space, don't tune a percentage

Background decor positioned as `position: absolute; left/top: N%` cannot be tuned to clear content whose
extent it doesn't know. The section-menu landmark (`GameSelectionLayout`) sat at `left:2%; top:54%` while
the game-tile flow sized itself from the game COUNT × viewport × orientation — so it collided in exactly
the configurations nobody screenshotted: measured a 106×46px overlap with "Lær Tal" at 1254×872 and
79×116px into "Sammenlign Tal" at 768×1024 (portrait wraps the flow down into the landmark), while
1024×768 looked perfectly fine. Every "fix the percentage" is a fix for one viewport.

- Make the decor and the content **siblings in one flex container** so the decor reserves its own track
  and the content lays out in what's left. Clearance then holds for every section, skin, device and
  orientation *by construction* — no magic numbers to re-tune.
- **Reserve along the axis that has slack, and check what the reservation costs.** A left COLUMN is the
  obvious move and it was wrong here: it stole ~1.8 tiles of width and wrapped Tal og Regning's 7 tiles
  to 6 + a lone "Hukommelse" — trading an overlap for the orphan row we refuse in the quiz grids. A
  COLUMN direction (tiles, then decor beneath, `alignSelf: flex-end` to dodge the corner mascot) costs
  nothing, because this layout's spare space is vertical (~200px of ~700 used on iPad landscape).
  So measure the row shape too, not just the overlap — otherwise the "fix" quietly degrades composition.
- A vertical-only idle float stays inside its own track, so decor can still breathe.
- The same class covers the corner mascot — and its footprint is now **exported**, so reserve that
  rather than re-measuring it per game: `MASCOT_CORNER_SIZE` in `src/components/common/mascotCorner.ts`
  (Sammenlign Tal reserves it as padding on its body column; phone landscape hides the companion, so
  there is nothing to reserve there). A game whose play surface FILLS the viewport has nothing for a
  `position: fixed` companion to be positioned "around" — it must give up the band. It also covered ThemeScene's stage-gated `bloomScenery`
  sprites — absolute-percent decor seated in the world, invisible until the child had bloomed — and
  those were **deleted rather than fixed** (owner, 2026-08-03: "it looks misplaced"). That is the
  outcome to remember: percentage anchors survived two rounds of tuning and a per-viewport guard that
  proved they cleared the mascot and the shelf, and they *still* read as clutter, because clearing
  furniture is not the same as composing with the art. Reserve the space or drop the element.
  **Drifting `AmbientField` sprites are exempt**: they cross the whole sky by design, so a
  momentary pass behind a tile is the feature. Don't carve a hole in the sky — a cloud that vanishes
  mid-flight is worse than one that passes behind a puzzle piece.
- Verify by **measuring rect intersections** across sections × skins × viewports × both orientations, not
  by eye. And guard the probe: a crashed route still satisfies `--wait-for` on the error boundary's
  "Prøv igen" button, and "0 overlaps" is then vacuously true because there are no tiles at all —
  assert the expected tile count and bail on `Noget gik galt` (this bit for real when a parallel
  session's half-saved file crashed the route mid-sweep).

## A corner-inset control is a CLIPPING problem, not a spacing one

`theme.shape.borderRadius` is **16** here, so an sx `borderRadius: 4` is **64px** — and a card with
`overflow: hidden` silently *cuts* anything straying outside that arc. The (now-deleted)
audio-permission modal's ✕ — a 32px `size="small"` button at `top/right: 8` — had its disc centre 24px in
against a 64px arc, so the corner ate a crescent of it: it read as "too close to the edge" when it was
actually being clipped. **The arithmetic below still governs every corner-inset control here**
(LockScreen's ✕ is the live one, built to the same recipe).

A round control of diameter `d` inset `i` from both edges of a corner radius `R` is fully inside iff
`√2·(R − (i + d/2)) + d/2 ≤ R`. For R=64 and d=44 that needs `i ≥ ~13`; the shipped value is 16
(58.8 ≤ 64, ~5px slack). Recompute when the radius or the size changes, and **don't read MUI's
`borderRadius: N` as N pixels** — it multiplies `shape.borderRadius`.

Verifying an app-root overlay like this is awkward headlessly (`?nogate=1` — the only way past the auth
gate — stands the auth surfaces AND the audio cue down, and minting a real session just for a screenshot
writes into the owner's production DB). Reproduce the **px geometry** in any live page instead (two discs
on two `overflow:hidden` cards of the same radius) and screenshot the A/B — the clipped crescent is
unmistakable.

## Don'ts

- No fixed heights like `height: 200px`
- No breakpoints without orientation queries
- No small touch targets on mobile
- No layouts that require scrolling to see all game content
- Don't spread a `SxProps` into an object literal (`sx={{ ...a, ...b }}`) — an `sx` prop can be an
  array or a function, so spreading it breaks typing and can silently drop styles. Merge with the
  array form (`sx={[a, b]}`) or apply each on a separate nested `<Box>`.

## Reference

See `src/components/common/LearningGrid.tsx` for a complete implementation.
