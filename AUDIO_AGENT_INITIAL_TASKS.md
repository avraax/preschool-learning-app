# Audio Centralization Agent - Initial Task Plan

## Quick Start Guide for Agent

### Your First Session Checklist
1. ✅ Read `AUDIO_CENTRALIZATION_AGENT.md` (your core instructions)
2. ✅ Review `AUDIO_CONSOLIDATION_TARGETS.md` (current opportunities)
3. ✅ Study `AUDIO_CONSOLIDATION_EXAMPLES.md` (pattern library)
4. ✅ Understand `AUDIO_AGENT_SELF_IMPROVEMENT.md` (evolution protocol)
5. ✅ Execute tasks from this initial plan

## Priority 1: Entry Audio Pattern Consolidation (Biggest Impact)

### Task 1.1: Analyze Current Entry Audio Usage
```bash
# Commands to run
grep -r "entryAudioManager.onComplete" src/components --include="*.tsx" -n
grep -r "entryAudioComplete" src/components --include="*.tsx" -n
grep -r "useGameEntryAudio" src/components --include="*.tsx" -n
```

### Task 1.2: Implement Centralized Solution
1. Add to `AudioController.ts`:
```typescript
async playGameEntryWithSetup(
  gameType: GameType,
  setupCallback: () => void,
  delay: number = 500
): Promise<void>
```

2. Create new hook `hooks/useGameAudioSetup.ts`

3. Update these components:
   - `src/components/alphabet/AlphabetGame.tsx`
   - `src/components/math/MathGame.tsx`
   - `src/components/math/AdditionGame.tsx`
   - `src/components/math/ComparisonGame.tsx`
   - `src/components/learning/MemoryGame.tsx`

**Expected Impact**: ~100 lines removed, cleaner component code

## Priority 2: Unified Repeat Button

### Task 2.1: Analyze Repeat Button Usage
```bash
# Find all repeat button instances
grep -r "RepeatButton" src/components --include="*.tsx" -n
ls src/components/common/RepeatButton.tsx
```

### Task 2.2: Create Unified Component
1. Create `AudioRepeatButton.tsx` with theme support
2. Deprecate individual button components
3. Update all usages to new unified component

**Expected Impact**: ~50 lines removed, consistent UI

## Priority 3: Context-Aware Audio Methods

### Task 3.1: Catalog Number Speaking Patterns
```bash
# Find all number speaking variations
grep -r "speakNumber\|speak.*[0-9]\|tallet\|plus\|minus" src/components --include="*.tsx" -A 2 -B 2
```

### Task 3.2: Implement Smart Methods
1. Add to AudioController:
   - `speakMathProblem()`
   - `speakNumberInContext()`
   - `speakGameInstruction()`

**Expected Impact**: ~80 lines removed, better Danish language handling

## Weekly Goals - Week 1

### Monday-Tuesday: Entry Audio Consolidation
- [ ] Complete Task 1.1 & 1.2
- [ ] Test on 3 different games
- [ ] Document new pattern

### Wednesday-Thursday: Repeat Button Unification  
- [ ] Complete Task 2.1 & 2.2
- [ ] Update all components
- [ ] Verify theme consistency

### Friday: Context-Aware Audio
- [ ] Complete Task 3.1 & 3.2
- [ ] Test Danish pronunciation
- [ ] Create usage examples

## Consolidation Search Queries

### Find Component Audio State
```bash
# Local audio state that should be centralized
grep -r "useState.*[Aa]udio\|useState.*[Pp]laying\|useState.*[Ss]peak" src/components --include="*.tsx"
```

### Find Direct Audio API Usage
```bash
# Should return ZERO results outside core system
grep -r "new SpeechSynthesisUtterance\|speechSynthesis\|new Audio\|Howler" src/components --include="*.tsx"
```

### Find Duplicate Success/Error Patterns
```bash
# Similar celebration/error handling
grep -r "announceGameResult.*setTimeout\|showSuccess.*setTimeout" src/components --include="*.tsx" -A 5
```

## Code Quality Checklist

Before implementing any consolidation:
- [ ] Does it reduce code by >20 lines?
- [ ] Does it improve developer experience?
- [ ] Is the abstraction clear and intuitive?
- [ ] Will it work on iOS Safari?
- [ ] Does it maintain current functionality?

## Testing Protocol

For each consolidation:
1. **Unit Test**: New AudioController methods
2. **Integration Test**: Component integration
3. **Platform Test**: iOS Safari, Android Chrome, Desktop
4. **Regression Test**: Existing games still work
5. **Performance Test**: No latency increase

## Success Metrics - Week 1 Targets

### Quantitative Goals
- Lines of code reduced: **200+**
- Duplicate patterns eliminated: **3**
- Components simplified: **10+**
- New centralized methods: **5-7**

### Qualitative Goals
- ✅ All entry audio uses same pattern
- ✅ Repeat buttons are consistent
- ✅ Number speaking is context-aware
- ✅ No component manages audio state

## Reporting Template

At end of each session:
```markdown
## Consolidation Report - [Date]

### Patterns Addressed
- [Pattern name]: [X] instances consolidated

### Code Reduction
- Files modified: [number]
- Lines removed: [number]
- Lines added: [number]
- Net reduction: [number]

### New Methods Added
- `AudioController.methodName()` - [purpose]

### Components Updated
- [Component]: [what changed]

### Next Session Plan
- [Next consolidation target]

### Self-Improvement Notes
- [Any patterns noticed for future]
```

## Emergency Contacts

If you encounter:
- **iOS Audio Breaks**: Check `src/utils/iosAudioHelper.ts`
- **Permission Issues**: Review `src/contexts/AudioPermissionContext.tsx`
- **TTS Failures**: Examine `src/services/googleTTS.ts`
- **Queue Problems**: Debug in `src/utils/AudioController.ts`

## Remember Your Mission

**"One Audio System to Rule Them All"**

Every line of audio code outside the centralized system is a bug to be fixed. Every duplicate pattern is an opportunity for consolidation. You are the guardian of audio architecture.

Start with Priority 1 and work systematically. Document everything. The codebase will thank you.