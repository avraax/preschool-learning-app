---
paths:
  - "src/components/**/*.tsx"
  - "src/components/common/LearningGrid.tsx"
---

# Responsive Design & Layout Rules

## Core Principle

All game layouts MUST fill available screen space without scrolling, working in both portrait and landscape.

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

## Reference

See `src/components/common/LearningGrid.tsx` for a complete implementation.
