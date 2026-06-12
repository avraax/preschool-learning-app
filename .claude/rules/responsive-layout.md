---
description: Responsive layout, grid, and aspect ratio rules
globs: src/components/**
---

# Responsive Layout Rules

## Core Principle

All game layouts MUST fill available screen space without scrolling, with optimal proportions in both portrait and landscape.

## Layout Structure

```typescript
<Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
  <AppBar sx={{ flex: '0 0 auto' }} />
  <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <Box sx={{ flex: 1, display: 'grid', gridAutoRows: 'minmax(0, 1fr)', gap: { xs: '8px', md: '12px' } }}>
      {/* Content */}
    </Box>
  </Container>
</Box>
```

## Grid Requirements

- Use CSS Grid with dynamic sizing, not fixed dimensions
- Responsive columns based on orientation and screen size
- Landscape-specific layouts via `@media (orientation: landscape)`

## Typography

Use `clamp()` for responsive fonts: `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`

## Touch Targets

Minimum **44px** touch areas for accessibility.

## Aspect Ratios

| Element       | Ratio | Min Height | Max Height |
|---------------|-------|------------|------------|
| Quiz cards    | 4:3   | 80px       | 120px      |
| Memory cards  | 3:4   | 60px       | 100px      |
| Action buttons| 3:2   | 44px       | —          |
| Display cards | 1:1   | —          | —          |

## Avoid

- Fixed heights (`height: 200px`)
- Layouts requiring scrolling
- Small touch targets on mobile
- `gridAutoRows: 'minmax(0, 1fr)'` without aspect ratio constraints

## Reference

See `src/components/common/LearningGrid.tsx` for a complete implementation example.
