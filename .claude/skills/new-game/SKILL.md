---
name: new-game
description: Scaffold a new game component following established patterns
user-invocable: true
---

# Create a New Game Component

Scaffold a new game following the established AlphabetGame/MathGame patterns.

## Steps

1. **Ask the user** for:
   - Game name (Danish)
   - Category (alphabet, math, farver, learning)
   - Game type (task-based quiz or learning exploration)

2. **Create the component** at `src/components/<category>/<GameName>.tsx` following:
   - Use `useSimplifiedAudio()` for all audio
   - Use `entryAudioManager.onComplete()` for task-based games
   - Show full UI immediately — no loading overlays
   - Use appropriate RepeatButton variant
   - Material-UI v7 components
   - Framer Motion animations

3. **Add the route** in `src/App.tsx`:
   - Add route under the appropriate category
   - Use URL query parameters for settings

4. **Add navigation** from the category selection page:
   - Add card/button to the selection component
   - Use `useNavigate()` for navigation

5. **Use category theme** from `src/config/categoryThemes.ts`

## Reference Files

- Task-based game: `src/components/alphabet/AlphabetGame.tsx`
- Learning game: `src/components/alphabet/AlphabetLearning.tsx`
- Selection page: `src/components/math/MathSelection.tsx`
- Category themes: `src/config/categoryThemes.ts`
- RepeatButton: `src/components/common/RepeatButton.tsx`
