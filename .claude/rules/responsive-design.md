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

No phone reaches 480 CSS px on its short side's counterpart (max is ~440, iPhone Pro Max), and no
tablet goes below ~600 — so these guards can never affect iPads. When adding a new game/screen,
verify it at 844×390 (and 667×375) with the ui-screenshot skill. GameShell/GameSelectionLayout/
UnifiedQuizGame/LearningGrid/UnifiedMemoryGame/RoundResultScreen already carry compact variants —
reuse them before inventing new ones.

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

## Aspect Ratios

| Element | Ratio | Min Height | Max Height |
|---------|-------|------------|------------|
| Quiz cards (letters/numbers) | 4:3 | 80px | 120px |
| Memory cards | 3:4 | 60px | 100px |
| Action buttons | 3:2 to 4:3 | 44px | - |
| Display cards | 1:1 to 4:3 | - | - |

When using aspect ratios, set `gridAutoRows: 'auto'` and let aspect ratio determine height.

## The focal band is already full — adding to it means re-measuring

`PromptFocus` sits in GameShell's fixed 40%/30% band, and the browse blooms were deliberately sized
(PRD-18 W5) to fill that whole band. So **putting anything in the `repeat` slot costs ~58px of it** (pill
+ gap) and the bloom then overflows its own subject zone and paints UNDER the pill — flex does not save
you, because a fixed `clamp()`/vh glyph or `<img>` never shrinks. Trim the bloom's vh caps and prove
`subject.bottom <= pill.top` with `--measure` (not by eye) at **1024×768, 844×390 and 667×375** — phone
landscape has only ~95px of band and fails on its own after iPad passes. If it still won't fit, drop the
secondary element on that viewport rather than clipping it.

## Typography

Use `clamp()` for responsive text: `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`.
Adjust for landscape orientation.

## Touch Targets

- Minimum 44px touch areas (accessibility requirement)
- Scale up on larger screens
- Use padding to increase tap areas without affecting visual size

## Overlays & stacking

A MUI `<Dialog>` defaults to `theme.zIndex.modal` = **1300**, while this app's blocking surfaces are
hand-rolled `position: fixed` boxes at ~10000 (lock screen, profile picker, audio permission). So a
dialog opened FROM one of those mounts **underneath** it: live, interactive, and simply not drawn. That
is a dead button with no error, no failing test and a screenshot that looks right — it shipped twice.

- Give any dialog that can appear over a full-screen surface an explicit z-index above it, from a shared
  constant — `src/components/auth/authOverlayZ.ts` is the pattern (one documented ordering, no literals
  at the call sites, guarded by its own test).
- **Prove it with a hit-test, not a screenshot**: `document.elementFromPoint(cx, cy)` at the element's
  centre must return that element, not the thing above it. See the `ui-screenshot` skill.
- Prefer standing the lower surface DOWN over out-stacking it — one blocking overlay at a time is the
  app's rule (see `authUiOpen` in `.claude/rules/audio-system.md`). The z-index is the backstop.

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
