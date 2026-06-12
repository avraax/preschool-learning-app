---
description: URL routing rules for React Router v7 navigation
globs: src/**
---

# URL Routing Rules

## All Features MUST Use URL Routing

- No component-level state navigation
- Every unique app state must have a unique URL
- Query parameters for user settings (filters, ranges, levels)
- Back/forward buttons must work correctly
- All pages must support direct URL access (deep linking)
- Parents should be able to bookmark and share specific exercise URLs

## Route Structure

```
/                          Home page
/alphabet                  Alphabet selection
/alphabet/learn            Interactive letter learning
/alphabet/quiz             Letter quiz game
/math                      Math selection
/math/counting             Counting game
/math/numbers              Number learning
/math/addition             Addition practice
/math/comparison           Number comparison
/farver                    Colors selection
/farver/jagt               Farvejagt (Color Hunt)
/farver/ram-farven         Ram Farven (Color Mixing)
/memory                    Memory card game
/admin/errors              Error dashboard
```

## Query Parameters

Use `src/utils/urlParams.ts` utilities:
- `level`: Custom level ranges (e.g., `A-J`, `1-10`)
- `range`: Number ranges for math
- `limit`: Result pagination
- `device`: Device filtering

## Implementation

- **BrowserRouter**: Set up in `main.tsx`
- **Routes**: Centralized in `App.tsx`
- **Navigation**: Use `useNavigate()` hook
- **URL Building**: Use `buildGameUrl()` from `urlParams.ts`
