# PRD: Preschool Learning App — Game Upgrades & New Games

**Date:** 2026-06-12
**Context:** App was built 1-1.5 years ago for a 3-4 year old. Child is now ~5, counts to 60-70, adds to 20 (with fingers), does basic subtraction, knows all letters. Games need difficulty increase + new games.
**Constraint:** NO adaptive difficulty, NO level selection, NO progression systems. All games are static difficulty, manually tuned via future Claude sessions.

---

## Part 1: TTS Voice Evaluation

### Current Setup
- **Voice:** `da-DK-Wavenet-F` (Google Cloud TTS)
- **Config file:** `shared-tts-config.js`
- **Settings:** speakingRate 0.8, pitch 1.1, OGG_OPUS encoding, 24kHz
- **Price:** $4/1M characters (WaveNet price was reduced from $16)
- **Free tier:** 1M chars/month
- **API endpoint:** `api/tts.ts` (Vercel serverless function)
- **Fallback:** Web Speech API (browser-native) when Google TTS fails

### Decision: Stay on Google Cloud TTS

After evaluating all options, Google Cloud TTS remains the best choice. Only switch voice model if testing proves Chirp3-HD is clearly better. Do NOT switch providers.

### Upgrade Candidate: Chirp3-HD (same provider, newer model)
- **30 Danish voices** (15 female, 15 male) — GA since July 2025
- **Price:** $30/1M characters (7.5x current, no free tier documented)
- **Quality:** Major quality leap over WaveNet — emotional range, human disfluencies, expressive intonation
- **Limitation:** Pause control and custom pronunciations NOT supported for da-DK
- **speakingRate/pitch:** Supported

### Evaluation Task (do this first, only switch if clearly better)

Generate audio samples comparing current voice to 3-4 Chirp3-HD female voices.

**Test voices (female):**
- `da-DK-Chirp3-HD-Kore`
- `da-DK-Chirp3-HD-Aoede`
- `da-DK-Chirp3-HD-Achernar`
- `da-DK-Chirp3-HD-Leda`

**Test phrases (cover typical app usage):**
1. `"Hej! Velkommen til spillet"` (welcome)
2. `"Hvad er tre plus fem?"` (math question)
3. `"Godt klaret! Det var rigtigt!"` (praise)
4. `"A som i abe"` (letter association)
5. `"Find alle de røde ting"` (color hunt instruction)

**How to test:**
```javascript
// Use dev-server.js or standalone script with Google TTS API:
const request = {
  input: { text: "Hej! Velkommen til spillet" },
  voice: { languageCode: 'da-DK', name: 'da-DK-Chirp3-HD-Kore' },
  audioConfig: { audioEncoding: 'OGG_OPUS', speakingRate: 0.8, pitch: 1.1, sampleRateHertz: 24000 }
};
```

If Chirp3-HD wins, only change needed is the voice name in `shared-tts-config.js`. No env var or infrastructure changes.

### All Alternatives Evaluated and Rejected

| Provider | Reason for rejection |
|---|---|
| **Google Neural2** ($16/1M) | 4x cost of WaveNet for modest improvement; only 1 female voice, loses male voice |
| **ElevenLabs** | Free tier only 10K chars/month; documented English phonetic bias on non-English languages; inconsistent Danish stod (glottal stop) and soft 'd' handling; Danish likely Tier 4 (not Tier 1-3) in their v3 model quality ranking |
| **Azure TTS** | 2 Danish neural voices, no HD for Danish; quality slightly below Google; 500K chars/month free |
| **Amazon Polly** | Only 1 neural Danish voice (female); no generative engine for Danish |
| **Edge TTS** | Free but reverse-engineered unofficial API; can break anytime; no SLA |
| **Piper (offline)** | Only 1 Danish model ("talesyntese"), trained on 4,108 utterances from 1990s data, medium/robotic quality |
| **CoRal Rost v3** | Excellent quality (MOS 4.23/5.0), purpose-built Danish, but requires GPU server — impractical for a Vercel-deployed web app. Worth revisiting if we ever pre-generate static audio files |
| **Coqui VITS Danish** | Basic quality, company shut down Jan 2024, community fork only |
| **Meta MMS-TTS-dan** | CC BY-NC license (non-commercial only), monotone quality |

### Future Option: Pre-generated Static Audio
The app has a finite vocabulary (26 letters, numbers 0-100, color names, game instructions, praise phrases). A future optimization could pre-generate all audio clips using CoRal Rost v3 (MOS 4.23/5.0, open-source, Danish government-funded) and serve as static assets — eliminating all runtime API costs. Not in scope for this PRD.

---

## Part 2: Difficulty Upgrades to Existing Games

### 2A. Addition Game
**File:** `src/components/math/AdditionGame.tsx`

**Current values (lines 121-135):**
- `firstNum`: 1-6 (`Math.floor(Math.random() * 6) + 1`)
- `maxSecondNum`: capped so sum ≤ 10 (`Math.min(10 - firstNum, 6)`)
- Wrong answers: 1-10 (`Math.floor(Math.random() * 10) + 1`)
- 4 answer options total

**Change to:**
- `firstNum`: 1-10 (`Math.floor(Math.random() * 10) + 1`)
- `maxSecondNum`: capped so sum ≤ 20 (`Math.min(20 - firstNum, 10)`)
- Wrong answers: 1-20 (`Math.floor(Math.random() * 20) + 1`)
- Keep 4 answer options

**Why:** Child can add to 20 using fingers. This matches his current ability.

---

### 2B. Number Quiz (Tal Quiz)
**File:** `src/components/math/MathGame.tsx`

**Current value (line 9):**
```typescript
const MAX_NUMBER = 30
```

**Change to:**
```typescript
const MAX_NUMBER = 50
```

The wrong answer generation (line 32) already uses `MAX_NUMBER` so no additional change needed.

**Why:** Child counts to 60-70. 50 gives room to practice without being trivially easy.

---

### 2C. Comparison Game
**File:** `src/components/math/ComparisonGame.tsx`

**Current values:**
- Number range: 1-10 (lines 123-124: `Math.floor(Math.random() * 10) + 1`)
- `DANISH_NUMBERS` array (lines 28-30): only goes to "ti" (10)

**Changes:**
1. Extend `DANISH_NUMBERS` array to index 20:
```typescript
const DANISH_NUMBERS = [
  'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti',
  'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve'
]
```

2. Change number range from 1-10 to 1-20:
```typescript
const leftNum = Math.floor(Math.random() * 20) + 1
let rightNum = Math.floor(Math.random() * 20) + 1
```
Also update the `while` loop on line 135 that forces different numbers.

3. Verify the emoji visual aids grid layout handles 15-20 emojis without scrolling (responsive design rule). May need to reduce emoji size for larger numbers.

**Why:** Child handles numbers well beyond 10. Extending to 20 introduces Danish teen numbers which are good to learn.

---

### 2D. Alphabet Quiz — Word Association Variant
**File:** `src/components/alphabet/AlphabetGame.tsx`

**Current behavior:** Hear a letter spoken, pick from 4 letter cards.

**Add variant mode:** Alternate between current mode and a new "word association" mode:
- Show an emoji + Danish word (e.g. 🍎 "Æble")
- Child picks which letter the word starts with from 4 options
- Audio says "Hvad starter [word] med?"

**Word list (one per letter that has a clear, child-friendly word):**
```typescript
const LETTER_WORDS: Record<string, { word: string; emoji: string }> = {
  'A': { word: 'Abe', emoji: '🐒' },
  'B': { word: 'Bil', emoji: '🚗' },
  'C': { word: 'Cykel', emoji: '🚲' },
  'D': { word: 'Drage', emoji: '🐉' },
  'E': { word: 'Elefant', emoji: '🐘' },
  'F': { word: 'Fisk', emoji: '🐟' },
  'G': { word: 'Giraf', emoji: '🦒' },
  'H': { word: 'Hund', emoji: '🐕' },
  'I': { word: 'Is', emoji: '🍦' },
  'J': { word: 'Jul', emoji: '🎄' },
  'K': { word: 'Kat', emoji: '🐱' },
  'L': { word: 'Løve', emoji: '🦁' },
  'M': { word: 'Mus', emoji: '🐭' },
  'N': { word: 'Næsehorn', emoji: '🦏' },
  'O': { word: 'Orm', emoji: '🪱' },
  'P': { word: 'Panda', emoji: '🐼' },
  'R': { word: 'Raket', emoji: '🚀' },
  'S': { word: 'Sol', emoji: '☀️' },
  'T': { word: 'Tog', emoji: '🚂' },
  'U': { word: 'Ugle', emoji: '🦉' },
  'V': { word: 'Vandmelon', emoji: '🍉' },
  'Y': { word: 'Yoghurt', emoji: '🥛' },
  'Z': { word: 'Zebra', emoji: '🦓' },
  'Æ': { word: 'Æble', emoji: '🍎' },
  'Ø': { word: 'Ørn', emoji: '🦅' },
  'Å': { word: 'Ål', emoji: '🐍' },
}
```

Note: Letters Q, W, X are omitted — they're in the Danish alphabet but rarely used in Danish words. No good child-friendly Danish words start with them.

**Implementation:** Alternate randomly — ~50% of rounds are classic "hear letter" mode, ~50% are "word association" mode. Same 4-option grid, same scoring, same UI layout. The question area changes to show emoji + word instead of just playing audio.

**Why:** Child knows all letters. Pure letter recognition is too easy. Word association adds reading/phonics practice.

---

### 2E. Farvejagt (Color Hunt)
**File:** `src/components/farver/FarvejagtGame.tsx`

**Current values (lines 204-219):**
- Target objects: `slice(0, Math.min(4, targetObjects.length))` → up to 4 targets
- Distractors: 1 item per other color → ~5 distractors
- Total items: ~8-9

**Changes:**
1. Increase targets to 5-6:
```typescript
.slice(0, Math.min(6, targetObjects.length))
```

2. Increase distractors to 2 per other color → ~10 distractors:
```typescript
.slice(0, 2) // 2 items per other color
```

3. Total items: ~15-16. Verify `generateRandomPositions()` handles this count without overlap issues.

**Why:** More items makes the hunt harder and more engaging. Child is old enough for a busier screen.

---

### Games NOT being changed
- **Memory Game** (`learning/MemoryGame.tsx`) — 20 pairs, stays as-is
- **Ram Farven** (`farver/RamFarvenGame.tsx`) — color mixing, stays as-is
- **Number Learning** (`math/NumberLearning.tsx`) — browse 1-100, stays as-is
- **Alphabet Learning** (`alphabet/AlphabetLearning.tsx`) — browse/tap letters, stays as-is

---

## Part 3: New Games

### 3A. Minus Opgaver (Subtraction Game)
**Route:** `/math/subtraction`
**File:** `src/components/math/SubtractionGame.tsx`
**Menu:** Add to `MathSelection.tsx`
**Theme:** Purple (math category)

**Gameplay:** Identical UI pattern to `AdditionGame.tsx` but with subtraction.
- First number: 1-10
- Second number: 1 to firstNum (so result ≥ 0)
- Results range: 0-9
- Wrong answers: 0-10
- 4 answer options
- Show visual: `firstNum - secondNum = ?`
- Use minus sign (➖) instead of plus
- Audio: "Hvad er [X] minus [Y]?"

**Implementation:** Clone `AdditionGame.tsx`, change:
- `generateNewProblem()` logic for subtraction
- Operator display from `+` to `-`
- Audio prompt from "plus" to "minus"
- Welcome message to subtraction-specific
- Route and navigation
- Use `MathRepeatButton` (purple theme, same as addition)
- Use same `useSimplifiedAudioHook`, `useGameState`, `LottieCharacter`, `CelebrationEffect` patterns

---

### 3B. Stav Ordet (Spell the Word)
**Route:** `/alphabet/spelling`
**File:** `src/components/alphabet/SpellingGame.tsx`
**Menu:** Add to `AlphabetSelection.tsx`
**Theme:** Blue (alphabet category)

**Gameplay:**
1. Show a picture (emoji) and the word text on screen
2. Play audio of the Danish word
3. Show scrambled letter tiles below
4. Child taps letters in correct order to spell the word (reading/copying exercise)
5. Green highlight on correct tap, red shake on wrong
6. Audio plays each letter sound as tapped
7. Celebration on complete word

**Display mode:** Show word text on screen — child sees the word and taps letters to match. This is a reading/copying exercise, not a memory-based spelling test.

**Word list (2-3 letter words only, child-friendly):**
```typescript
const SPELLING_WORDS = [
  { word: 'ko', emoji: '🐄' },
  { word: 'bi', emoji: '🐝' },
  { word: 'is', emoji: '🍦' },
  { word: 'os', emoji: '🧀' },
  { word: 'sol', emoji: '☀️' },
  { word: 'hus', emoji: '🏠' },
  { word: 'bil', emoji: '🚗' },
  { word: 'kat', emoji: '🐱' },
  { word: 'hej', emoji: '👋' },
  { word: 'hat', emoji: '🎩' },
  { word: 'mus', emoji: '🐭' },
  { word: 'bus', emoji: '🚌' },
  { word: 'ost', emoji: '🧀' },
  { word: 'fod', emoji: '🦶' },
  { word: 'bog', emoji: '📖' },
  { word: 'and', emoji: '🦆' },
  { word: 'arm', emoji: '💪' },
  { word: 'ben', emoji: '🦵' },
  { word: 'hul', emoji: '🕳️' },
  { word: 'sø', emoji: '🏞️' },
  { word: 'ko', emoji: '🐄' },
  { word: 'ål', emoji: '🐍' },
  { word: 'øl', emoji: '🍺' },
]
```

Remove duplicates before finalizing. Include words with Æ, Ø, Å to practice Danish-specific letters.

**UI Layout:**
- **Top:** Large emoji + word text displayed prominently + audio button (tap to hear word again)
- **Middle:** Letter slots (empty boxes showing word length, fill left-to-right as correct letters are tapped)
- **Bottom:** Scrambled letter tiles (the word's letters + 2-3 random distractor letters, all shuffled)
- Use `AlphabetRepeatButton` (blue theme)

**Letter tile interaction:**
- All tiles shuffled randomly in the bottom area
- Tapped correct letter: slides from bottom pool into next empty slot with satisfying sound
- Tapped wrong letter: shake animation, letter stays in pool
- Tiles should be large (44px+ touch target) with Comic Sans MS font

**Audio flow:**
1. Game says "Stav ordet" and shows emoji + word text, plays word audio
2. Each correct letter tap: play letter sound via TTS
3. Word complete: play full word audio again + celebration effect
4. Auto-advance to next word after celebration

**Patterns to follow:**
- Full-viewport no-scroll layout per `responsive-design.md`
- `useSimplifiedAudioHook` for audio
- `useGameState` for score tracking
- `LottieCharacter` + `CelebrationEffect` for feedback
- `categoryThemes.ts` blue/alphabet theme
- Task-based game pattern per `game-development.md`

---

## Part 4: Route & Navigation Updates

### New Routes (add to `App.tsx`)
```typescript
<Route path="/math/subtraction" element={<SubtractionGame />} />
<Route path="/alphabet/spelling" element={<SpellingGame />} />
```

### Menu Updates
- **`MathSelection.tsx`**: Add "Minus Opgaver" card with ➖ icon, linking to `/math/subtraction`
- **`AlphabetSelection.tsx`**: Add "Stav Ordet" card with ✏️ icon, linking to `/alphabet/spelling`

### CLAUDE.md Route Update
Add to the route structure section:
```
/math/subtraction        Subtraction practice
/alphabet/spelling       Spell the Word game
```

---

## Part 5: Dev Environment Notes

The local dev environment was set up in the same session that produced this PRD:

- **API server:** `npm run dev:api` — Express on port 3001, handles `/api/tts`, `/api/log-error`, `/api/version`
- **Vite dev:** `npm run dev` — port 5173, proxies `/api/*` to port 3001
- **Credentials:** `.env.local` has fresh Google Cloud TTS service account key (generated 2026-06-12)
- **Files created/modified:** `dev-server.js`, `vite.config.ts` (proxy restored), `package.json` (dev:api script added)

Run both in separate terminals for local development with working TTS.

---

## Part 6: Execution Order

1. **TTS evaluation** — compare Chirp3-HD samples to current WaveNet-F, only switch if clearly better
2. **Addition Game** — change 3 constants in `AdditionGame.tsx`
3. **Number Quiz** — change 1 constant in `MathGame.tsx`
4. **Comparison Game** — extend `DANISH_NUMBERS` array + change number range in `ComparisonGame.tsx`
5. **Farvejagt** — increase target/distractor counts in `FarvejagtGame.tsx`
6. **Minus Opgaver** — new game, clone `AdditionGame.tsx` pattern → `SubtractionGame.tsx`
7. **Alphabet Quiz word-association** — add variant mode to `AlphabetGame.tsx`
8. **Stav Ordet** — new game → `SpellingGame.tsx`, most complex (new tap-sequence mechanic)
9. **Routes & menus** — update `App.tsx`, `MathSelection.tsx`, `AlphabetSelection.tsx`, `CLAUDE.md`

Steps 2-5 are quick changes (minutes each). Steps 6-8 are larger (new components/features). Step 9 is wiring.

---

## Architecture References

When implementing, follow these mandatory rules:
- **Audio:** `src/utils/AudioController.ts` singleton, `useSimplifiedAudioHook` or `useAudio` hook. See `.claude/rules/audio-system.md`
- **Game pattern:** Task-based games use `entryAudioManager.onComplete()`. See `.claude/rules/game-development.md`
- **Layout:** Full-viewport no-scroll, CSS Grid. See `.claude/rules/responsive-design.md`
- **Theming:** `src/config/categoryThemes.ts` — alphabet=blue, math=purple, colors=orange
- **State:** Local React state only, no global state management
- **Typography:** Comic Sans MS for child-facing content
- **Touch targets:** Minimum 44px
- **Language:** All user-facing text in Danish
