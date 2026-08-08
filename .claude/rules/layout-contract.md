---
paths:
  - "src/components/**/*.tsx"
---

# Layout contract

What every component must satisfy. The derivations, the measured numbers, the aspect-ratio budget, the
focal-band arithmetic and the corner-clipping formula are in `.claude/rules/responsive-design.md` — read
it when the work *is* layout.

**Core principle:** every game layout fills the screen without scrolling, in both orientations.

## Phones are supported; iPads are the primary device

Use the shared guards from `src/theme/phoneMedia.ts` as sx keys — `PHONE_LANDSCAPE` (landscape ≤480px
height), `PHONE_PORTRAIT` (portrait ≤480px width), `PHONE_ANY`. They also work in JS via
`useMediaQuery(PHONE_ANY)`, so a layout that must *branch* rather than restyle uses one definition of
"phone". No phone reaches 480 CSS px on the relevant axis and no tablet goes below ~600, so these can
never affect an iPad.

- **A `PHONE_LANDSCAPE` variant with no `PHONE_PORTRAIT` sibling is a bug waiting to be measured.**
  Phone portrait then inherits `xs`, which here is a roomy tablet-ish layout. **Body overflow is
  `hidden`, so "below the fold" means unreachable, not scrollable** — check `scrollHeight` vs
  `innerHeight` before deciding an overflow is benign.
- **The binding constraint is usually the ROW COUNT, not the item height.** The grid is centred in a
  flex parent, so an overflow clips at both ends and shrinking cards moves the last row by half of what
  you removed. Remove a row.
- Verify a new screen at **844×390 and 667×375** — four columns cleared the taller phone and still
  clipped the iPhone SE. `GameShell`, `GameSelectionLayout`, `UnifiedQuizGame`, `LearningGrid` and
  already carry compact variants; reuse them.

## Two MUI facts that don't read like traps

- **The breakpoints are overridden** in `src/theme/buildTheme.ts`: `sm 600 · md 768 · lg 1024`. So `md`
  is iPad **portrait**, not desktop, and `lg` means iPad landscape. An `{ xs, md }` pair applies its
  `md` value to an 844-wide phone in landscape while a 667-wide one gets `xs`.
- **A spacing prop multiplies; a size prop does not.** `width: 120` is 120px, but `pb: 120` is
  120 × 8 = **960px** (same for `p`/`m`/`gap`). Write `pb: '120px'` when the value is a real length.

## A bare `orientation: landscape` query also catches the iPad

Most landscape overrides here were written while fixing a phone, and a bare orientation query hits the
1024×768 iPad just as hard. Nothing fails and no screenshot looks wrong — the board is simply small with
the slack unused (measured: a prompt object at 80px, under its 92px answer swatches).

- **Sizes go on `PHONE_LANDSCAPE`; structure stays on the bare orientation query.** Row-vs-column
  direction and column counts are genuinely orientation-driven — separate axes in the same `sx`.
- Because `lg` = 1024, **`lg` inside a landscape query is iPad-only** — usually the smallest fix.
- Growing something costs width you may not have. Size the element as a card: closing a void is not the
  same as filling it.

## Grid

```typescript
<Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
  <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <Box sx={{ flex: 1, display: 'grid', gridAutoRows: 'minmax(0, 1fr)', gap: { xs: '8px', md: '12px' } }}>
```

Dynamic sizing, never fixed dimensions; responsive column counts with
`'@media (orientation: landscape)'` overrides. `clamp()` for responsive text.

## Touch targets

- Minimum 44px.
- Grow a target with padding **and cancel it with a matching negative margin** (`p: '16px', m: '-16px'`),
  so the layout box stays the size of the art and nothing on the board moves. Handlers go on the padded
  wrapper, the visual element is its child.
- **An `::after` ring is not a touch target.** Chrome does not hit-test an absolutely-positioned
  pseudo-element with a negative `inset`; slop has to be a real box. Prove it by hit-testing a point
  inside the slop, outside the ink — a screenshot cannot show where a press would land.

## Overlays & stacking

A MUI `<Dialog>` defaults to `theme.zIndex.modal` = **1300**, while this app's blocking surfaces are
hand-rolled `position: fixed` boxes at ~10000 (lock screen, profile picker). A dialog opened *from* one
of those mounts underneath it: live, interactive and simply not drawn — a dead button with no error and
a screenshot that looks right. It shipped twice. Two MUI Dialogs are the same trap without the 10000:
both default to 1300, so a nested one is on top only by DOM mount order.

- Give any dialog that can appear over a full-screen surface an explicit z-index from a shared constant
  (`src/components/auth/authOverlayZ.ts`). Non-blocking surfaces go **under** 1300 on purpose
  (`AudioBlockedCue`); blocking ones claim `authUiOpen` rather than climbing.
- **Prove it with a hit-test, not a screenshot**: `document.elementFromPoint(cx, cy)` at the element's
  centre must return that element.

## Decor next to content: reserve the space, don't tune a percentage

Background decor at `position: absolute; left/top: N%` cannot be tuned to clear content whose extent it
doesn't know — that extent depends on item count × viewport × orientation, so every "fix the percentage"
fixes one viewport. Make the decor and the content **siblings in one flex container**, reserving along
the axis that has slack (a left column stole ~1.8 tiles of width and created an orphan row). The corner
mascot's footprint is exported as `MASCOT_CORNER_SIZE`. Percentage-anchored decor here was **deleted
rather than fixed** — reserve the space or drop it. Derivation: `responsive-design.md`.

## Don'ts

- No fixed heights, no breakpoints without orientation queries, no sub-44px targets.
- **Don't spread a `SxProps` into an object literal** (`sx={{ ...a, ...b }}`) — an `sx` prop can be an
  array or a function, so spreading breaks typing and can silently drop styles. Use `sx={[a, b]}`.
