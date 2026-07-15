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

## Typography

Use `clamp()` for responsive text: `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`.
Adjust for landscape orientation.

## Touch Targets

- Minimum 44px touch areas (accessibility requirement)
- Scale up on larger screens
- Use padding to increase tap areas without affecting visual size

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
