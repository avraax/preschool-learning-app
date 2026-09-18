# PRD: Two New Sections — Engelsk (English) & Ordleg (Word Games)

**Date:** 2026-06-13
**Author context:** Planned interactively; to be implemented in a later session.
**Child context:** Son is ~5, confident Danish reader/counter for his age (counts to 60–70, adds to 20, knows all letters, reads simple Danish words). Now getting curious about **English** as a *total beginner* with *some* passive exposure (occasional shows/songs). He uses the app on **iPad (Safari)** and **desktop/laptop (Chrome)**.
**Constraints (unchanged from prior PRD):** NO adaptive difficulty, NO level selection, NO progression systems. All games static difficulty, manually tuned via future Claude sessions. Danish for all UI/instructions. Comic Sans MS, min 44px touch targets, full-viewport no-scroll layouts.

This PRD defines **two new top-level sections**:
1. **Engelsk** — beginner English learning (green theme).
2. **Ordleg** — Danish word games (teal theme): the existing **Stav Ordet** game *moves here*.

---

## Architecture primer (how sections are wired today — read first)

Confirmed by reading the codebase:

- **`src/config/categoryThemes.ts`** is the single source of truth for each section's theme + game list. Each section is a `CategoryTheme` with `name`, `gradient`, `accentColor`, `borderColor`, `hoverBorderColor`, `icon`, `iconSize`, `description`, and a `games[]` array (`{ id, title, emoji, route, gradient }`).
- **Selection screens are data-driven.** e.g. `MathSelection.tsx` is literally:
  ```tsx
  <GameSelectionLayout categoryId="math" games={categoryThemes.math.games} />
  ```
  So adding games to a section = adding entries to its `games[]` array. (This is why the prior PRD's Minus Opgaver / Stav Ordet entries already show in their menus — they were added to `categoryThemes`.)
- **The Home screen is NOT data-driven.** `HomePage` in `src/App.tsx` (~lines 88–650) renders each section card as a **hardcoded JSX block** (alphabet, math, colors), each referencing `categoryThemes.<id>.*` and an `onClick={() => navigate('/<id>')}`. **Adding a root section requires adding a new card block here.** There are currently **3 cards**; this PRD adds **2 more (→ 5)** — verify the home grid/layout handles 5 cards responsively in portrait + landscape.
- **Routes** live in `src/App.tsx` (`<Routes>`, ~line 850+).
- **Audio** is centralized — see `.claude/rules/audio-system.md`. Components use `useAudio()`; new audio capabilities are added as methods on `AudioController`. Never call TTS/Web Speech/Howler directly in components.
- **TTS endpoints already accept a per-request `voice` + `audioConfig`** (`api/tts.ts` line 62/79–83 and `dev-server.js` line 44/52–56: `voice: voice || TTS_CONFIG.voice`). So English audio needs **no backend change** — only a client path to request an `en-GB` voice.
- **Two API runtimes must stay in sync:** `api/*.ts` (Vercel serverless, prod) and `dev-server.js` (local Express, dev). Any new endpoint must be added to **both**.

---

## Prerequisites & current repo state (read before starting)

**Repo state when this PRD was written (2026-06-13):** The prior PRD's work (`tmp-prd-game-upgrades.md`) is **uncommitted on `master`** — difficulty upgrades, plus `SubtractionGame.tsx` and `SpellingGame.tsx` (the latter currently at route **`/alphabet/spelling`**, registered in `categoryThemes.alphabet.games`). Start from the current working tree, not a clean checkout. Stav Ordet will be **relocated** to `/ordleg/spelling` by this PRD (Part 2.1).

**Google Cloud setup (REQUIRED for the speech game — do this first):**

**Local dev environment (Windows) — avoid a known time-sink:**
- Run **both** servers from **Windows PowerShell**, in two terminals: `npm run dev:api` (Express API, port 3001) and `npm run dev` (Vite, port 5173, proxies `/api` → `127.0.0.1:3001`).
- **Do NOT launch `npm run dev` from a WSL/Ubuntu shell.** If Vite runs in WSL while the API runs on Windows, they're in different network namespaces and every `/api/*` call returns **502** (Vite-in-WSL can't reach `127.0.0.1:3001` on Windows). Tell-tale: Vite prints a `10.255.255.254` Network URL (WSL) instead of the real LAN IP. Both terminals must be native Windows PowerShell.

---

# PART 1 — Engelsk (English Section)

**Section id:** `english`
**Route base:** `/english`
**Danish section name:** `Engelsk`
**Theme color:** **Green** (distinct from alphabet=blue, math=purple, colors=orange). Suggested palette below.
**Teaching language:** **Danish instructions** — the app speaks/explains in Danish; only the *target word* is English. (e.g. "Tryk på hunden — på engelsk hedder den *dog*.")
**Target-word display:** Show the **written English word** (text) alongside picture + audio. Reading exposure is wanted.
**English accent:** **British (en-GB)**. Use a clear, child-friendly female `en-GB` voice (e.g. `en-GB-Neural2-A` or `en-GB-Wavenet-A` — implementer picks the warmest; keep it female to match the Danish `da-DK-Wavenet-F`).

### 1.1 Vocabulary (keep super simple — ~8–10 words per theme)

Themes in scope: **First words** (animals, food, everyday objects), **Numbers 1–10**, **Colors**, **Greetings & phrases**.

Each entry needs: English word, Danish translation (for Danish→English game + instructions), emoji/picture. Draft lists (implementer may finalize/swap for clearer emoji):

```ts
// Animals
[ {en:'dog', da:'hund', emoji:'🐕'}, {en:'cat', da:'kat', emoji:'🐱'}, {en:'fish', da:'fisk', emoji:'🐟'},
  {en:'bird', da:'fugl', emoji:'🐦'}, {en:'cow', da:'ko', emoji:'🐄'}, {en:'horse', da:'hest', emoji:'🐴'},
  {en:'pig', da:'gris', emoji:'🐷'}, {en:'duck', da:'and', emoji:'🦆'}, {en:'bear', da:'bjørn', emoji:'🐻'},
  {en:'lion', da:'løve', emoji:'🦁'} ]

// Food
[ {en:'apple', da:'æble', emoji:'🍎'}, {en:'banana', da:'banan', emoji:'🍌'}, {en:'milk', da:'mælk', emoji:'🥛'},
  {en:'bread', da:'brød', emoji:'🍞'}, {en:'egg', da:'æg', emoji:'🥚'}, {en:'cheese', da:'ost', emoji:'🧀'},
  {en:'water', da:'vand', emoji:'💧'}, {en:'cake', da:'kage', emoji:'🍰'}, {en:'ice cream', da:'is', emoji:'🍦'},
  {en:'cookie', da:'småkage', emoji:'🍪'} ]

// Everyday objects
[ {en:'ball', da:'bold', emoji:'⚽'}, {en:'car', da:'bil', emoji:'🚗'}, {en:'book', da:'bog', emoji:'📖'},
  {en:'chair', da:'stol', emoji:'🪑'}, {en:'bed', da:'seng', emoji:'🛏️'}, {en:'cup', da:'kop', emoji:'☕'},
  {en:'shoe', da:'sko', emoji:'👟'}, {en:'hat', da:'hat', emoji:'🎩'}, {en:'door', da:'dør', emoji:'🚪'},
  {en:'key', da:'nøgle', emoji:'🔑'} ]

// Numbers 1–10
[ {en:'one', da:'en', n:1}, {en:'two', da:'to', n:2}, {en:'three', da:'tre', n:3}, {en:'four', da:'fire', n:4},
  {en:'five', da:'fem', n:5}, {en:'six', da:'seks', n:6}, {en:'seven', da:'syv', n:7}, {en:'eight', da:'otte', n:8},
  {en:'nine', da:'ni', n:9}, {en:'ten', da:'ti', n:10} ]

// Colors
[ {en:'red', da:'rød', hex:'#E53935'}, {en:'blue', da:'blå', hex:'#1E88E5'}, {en:'green', da:'grøn', hex:'#43A047'},
  {en:'yellow', da:'gul', hex:'#FDD835'}, {en:'orange', da:'orange', hex:'#FB8C00'}, {en:'purple', da:'lilla', hex:'#8E24AA'},
  {en:'pink', da:'lyserød', hex:'#EC407A'}, {en:'black', da:'sort', hex:'#212121'}, {en:'white', da:'hvid', hex:'#FAFAFA'},
  {en:'brown', da:'brun', hex:'#6D4C41'} ]

// Greetings & phrases (~8)
[ {en:'hello', da:'hej'}, {en:'goodbye', da:'farvel'}, {en:'thank you', da:'tak'}, {en:'please', da:'vær så venlig'},
  {en:'yes', da:'ja'}, {en:'no', da:'nej'}, {en:'good morning', da:'godmorgen'}, {en:'good night', da:'godnat'} ]
```

> Store as a typed module, e.g. `src/config/englishVocab.ts`.

### 1.2 Games (4 — all map to existing patterns)

All are **task-based** quizzes except Explore (learning-based). Follow `.claude/rules/game-development.md`. **Reuse `UnifiedQuizGame`** (`src/components/common/UnifiedQuizGame.tsx`) — verified reusable for these:
- **Question side:** it already supports `questionVisual?: { emoji, word }` (added during the prior PRD's alphabet word-association work) — use it to show the picture/word prompt.
- **Answer options:** each option renders `item.display` (string/number). For **picture answers** (Lyt og Find), set `display` to the **emoji** — it renders fine as a large glyph. For **word answers** (Find det Engelske Ord / Dansk til Engelsk), set `display` to the English word text.
- **GAP to close — prompt language:** `UnifiedQuizGame` currently speaks `audioPrompt` through the **Danish** audio path. The English games need the *target word* spoken in **en-GB**. Add an opt-in to the quiz config (e.g. `promptLanguage?: 'da-DK' | 'en-GB'`, or a `speakPrompt` override callback) so English prompts route through `AudioController.speakEnglish()` (Part 1.3) while Danish instruction text stays `da-DK`. This is the one real extension `UnifiedQuizGame` needs; everything else is config.

| Game | Danish title | Route | Pattern | Description |
|---|---|---|---|---|
| **A. Listen & match** | `Lyt og Find` | `/english/listen` | Task quiz | App speaks an English word (en-GB). Child taps the matching **picture** from 4 options. Pure listening comprehension. Danish prompt: "Hvad hørte du? Tryk på det rigtige billede." |
| **B. Picture → English word** | `Find det Engelske Ord` | `/english/word` | Task quiz | Show a picture. Child picks the correct **written English word** from 4 options. Early English reading. Danish prompt + the English option words shown as text. |
| **C. Danish → English** | `Dansk til Engelsk` | `/english/translate` | Task quiz | Show/speak a Danish word he knows (+emoji). Child picks the **English** equivalent (text + audio on tap). Bridges from native language. |
| **D. Explore / learn** | `Lær Engelsk` | `/english/learn` | Learning | Browse cards freely: picture + English word (text) + tap-to-hear (en-GB) + optional Danish translation. Mirrors `AlphabetLearning`/`NumberLearning`. |

Common rules for the quiz games:
- 4 answer options, static difficulty, no progression.
- Danish instruction/feedback audio; English only for the target word.
- Reuse `CelebrationEffect`, `LottieCharacter`, score chip, and an English-themed `RepeatButton` variant (green).
- Full-viewport no-scroll layout per `.claude/rules/responsive-design.md`.

### 1.3 English audio (en-GB) — the one client change needed

Backend already supports per-request voice. Per audio rules, add a method to `AudioController` (do NOT call TTS directly in components):

```ts
// AudioController.ts — new method
async speakEnglish(text: string): Promise<string> {
  return this.queueAudio(async () => {
    /* same guard/permission flow as speak(), but pass an en-GB voice + en-GB audioConfig
       to googleTTS.synthesizeAndPlay so the request voice overrides TTS_CONFIG.voice */
  })
}
```
- Expose via `useAudio()` (e.g. `audio.speakEnglish('dog')`).
- Define the en-GB voice constant centrally (e.g. extend `shared-tts-config.js` with an `EN_VOICE` block, or pass an explicit `voice` object). Keep `da-DK` as the default for all existing Danish audio.
- Caching: the existing TTS cache keys on text — ensure the cache key also incorporates voice/language so `"dog"` (en-GB) and any Danish homograph don't collide. **Verify/extend the cache key in `googleTTS.ts` to include voice name.** (Important correctness check.)

---

# PART 2 — Ordleg (Word Games Section)

**Section id:** `ordleg`
**Route base:** `/ordleg`
**Danish section name:** `Ordleg`
**Theme color:** **Teal** (suggested palette below).
**Contents:** **Stav Ordet** (moved here).

### 2.1 Move Stav Ordet into Ordleg

Currently `Stav Ordet` lives under Alphabet: `categoryThemes.alphabet.games` has `{ id:'spelling', route:'/alphabet/spelling' }`, component `src/components/alphabet/SpellingGame.tsx`, route in `App.tsx`.

Changes:
1. **Remove** the `spelling` entry from `categoryThemes.alphabet.games`.
2. **Add** it to the new `categoryThemes.ordleg.games` with route **`/ordleg/spelling`** (teal gradient).
3. **Move the file** `src/components/alphabet/SpellingGame.tsx` → `src/components/ordleg/SpellingGame.tsx` (new folder), update its import path in `App.tsx`, and re-theme its colors blue→teal (it currently uses `AlphabetRepeatButton`; introduce/use an `OrdlegRepeatButton` teal variant).
4. **Update the route** in `App.tsx`: `/alphabet/spelling` → `/ordleg/spelling`. (Optional: keep a redirect from the old path; not required since it was never released.)
5. Update **`CLAUDE.md`** route table accordingly.

> Note: this is a relocation, not a rewrite. Keep the game's behavior identical.

# PART 3 — Routes, Navigation & Home Screen

### 3.1 New routes (`src/App.tsx`)
```tsx
// English
<Route path="/english" element={<EnglishSelection />} />
<Route path="/english/listen" element={<EnglishListenGame />} />
<Route path="/english/word" element={<EnglishWordGame />} />
<Route path="/english/translate" element={<EnglishTranslateGame />} />
<Route path="/english/learn" element={<EnglishLearning />} />

// Ordleg
<Route path="/ordleg" element={<OrdlegSelection />} />
<Route path="/ordleg/spelling" element={<SpellingGame />} />   {/* moved from /alphabet/spelling */}
```
Remove the old `<Route path="/alphabet/spelling" .../>`.

### 3.2 Selection wrappers (mirror `MathSelection.tsx`)
```tsx
// EnglishSelection.tsx
<GameSelectionLayout categoryId="english" games={categoryThemes.english.games} />
// OrdlegSelection.tsx
<GameSelectionLayout categoryId="ordleg" games={categoryThemes.ordleg.games} />
```

### 3.3 Home screen cards (`HomePage` in `src/App.tsx`)
Add **two new hardcoded section card blocks** (copy an existing block, e.g. the colors one) for `english` and `ordleg`, each `onClick={() => navigate('/english')}` / `navigate('/ordleg')` and referencing `categoryThemes.english.*` / `categoryThemes.ordleg.*`.
- **Layout:** home goes from 3 → 5 cards. **Verify the grid is responsive** in portrait + landscape on iPad and desktop (per responsive rules). Likely need to adjust the home grid column counts.

### 3.4 `categoryThemes.ts` — add two sections + move spelling
```ts
english: {
  id: 'english', name: 'Engelsk',
  gradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 50%, #A5D6A7 100%)',
  accentColor: '#2E7D32', borderColor: '#66BB6A', hoverBorderColor: '#2E7D32',
  icon: '🇬🇧', iconSize: '6rem',
  description: 'Lær dine første engelske ord med billeder og lyd',
  games: [
    { id:'listen',    title:'Lyt og Find',           emoji:'👂', route:'/english/listen',    gradient:'linear-gradient(135deg, #66BB6A 0%, #43A047 100%)' },
    { id:'word',      title:'Find det Engelske Ord', emoji:'🔤', route:'/english/word',      gradient:'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)' },
    { id:'translate', title:'Dansk til Engelsk',     emoji:'🔁', route:'/english/translate', gradient:'linear-gradient(135deg, #43A047 0%, #2E7D32 100%)' },
    { id:'learn',     title:'Lær Engelsk',           emoji:'📚', route:'/english/learn',     gradient:'linear-gradient(135deg, #388E3C 0%, #1B5E20 100%)' },
  ],
},
ordleg: {
  id: 'ordleg', name: 'Ordleg',
  gradient: 'linear-gradient(135deg, #E0F2F1 0%, #B2DFDB 50%, #80CBC4 100%)',
  accentColor: '#00796B', borderColor: '#4DB6AC', hoverBorderColor: '#00796B',
  icon: '🗣️', iconSize: '6rem',
  description: 'Stav ord og sig ord højt med din stemme',
  games: [
    { id:'spelling', title:'Stav Ordet', emoji:'✏️',  route:'/ordleg/spelling', gradient:'linear-gradient(135deg, #26A69A 0%, #00897B 100%)' },
  ],
},
```
And **remove** the `spelling` entry from `alphabet.games`.

### 3.5 `CLAUDE.md` route table
Add:
```
/english                 English section menu
/english/listen          Listen & match (audio→picture)
/english/word            Picture → English word
/english/translate       Danish → English match
/english/learn           Explore English words
/ordleg                  Ordleg section menu
/ordleg/spelling         Stav Ordet (moved from /alphabet/spelling)
```
Remove `/alphabet/spelling`.

---

# PART 4 — Theming Summary

| Section | id | Danish name | Color | accentColor |
|---|---|---|---|---|
| Alphabet | alphabet | Alfabetet | Blue | `#1976D2` (existing) |
| Math | math | Tal og Regning | Purple | `#9C27B0` (existing) |
| Colors | colors | Farver | Orange | `#E65100` (existing) |
| **English** | **english** | **Engelsk** | **Green** | `#2E7D32` |
| **Ordleg** | **ordleg** | **Ordleg** | **Teal** | `#00796B` |

Add matching `RepeatButton` variants: `EnglishRepeatButton` (green), `OrdlegRepeatButton` (teal) in `src/components/common/RepeatButton.tsx`. Consider routing exact shades through the `child-ui-designer` agent during implementation if desired.

---

# PART 5 — Architecture Rules (mandatory)

- **Audio:** centralized only. New playback (English en-GB, read-back, per-letter spelling) → methods on `AudioController`, exposed via `useAudio()`. See `.claude/rules/audio-system.md`.
- **Games:** task-based games use `entryAudioManager.onComplete()`, show full UI immediately, use `RepeatButton`, disable until `entryAudioComplete`. No loading-screen takeovers. See `.claude/rules/game-development.md`.
- **Layout:** full-viewport, no-scroll, CSS Grid, 44px+ touch targets, portrait + landscape. See `.claude/rules/responsive-design.md`.
- **State:** local React state only. **Language:** all UI/instructions Danish. **Type:** TS strict. **Font:** Comic Sans MS.

---

# PART 6 — Open Questions / Risks to resolve during implementation

2. **TTS cache key** must include voice/language once English (en-GB) is added — otherwise English/Danish audio could collide. Verify in `googleTTS.ts`.
3. **Open-vocabulary spelling of special characters** — recognized words with æ/ø/å must spell correctly with the existing per-letter Danish audio (Stav Ordet already handles æøå; reuse it).
5. **Confidence threshold** for "friendly retry" vs accept — tune on the device.
6. **Home grid** must look good with 5 section cards (currently designed for 3).
7. **en-GB voice selection** — pick the warmest child-friendly female voice; confirm it's available (Neural2/Wavenet/Studio tier) and not deprecated.

---

# PART 7 — Suggested Execution Order

1. **Scaffolding:** add `english` + `ordleg` to `categoryThemes.ts`; add green/teal `RepeatButton` variants; add the two home cards + verify 5-card grid.
2. **Move Stav Ordet** → `ordleg` (file move, route `/ordleg/spelling`, re-theme teal). Verify it still works.
3. **English audio path:** add `AudioController.speakEnglish()` + `useAudio` exposure + en-GB voice config + cache-key fix.
4. **English games** (D Explore first as it's simplest, then A → B → C). Build vocab module `englishVocab.ts`.
8. **Routes + CLAUDE.md + final responsive pass** on iPad and desktop.

Steps 1–4 are mostly pattern-following (lower risk). Steps 5–7 are the genuinely new speech capability (higher risk — budget testing time on the iPad).

---

# Appendix A — Mandatory patterns (condensed, so this PRD is self-contained)

> These are the actionable essentials of `.claude/rules/audio-system.md`, `game-development.md`, and `responsive-design.md`. Those files are the canonical source (and auto-load in this repo); this appendix lets the PRD stand alone.

### A.1 Audio system
- **All audio goes through the centralized 3-tier system. No exceptions.** `AudioController` singleton (`src/utils/AudioController.ts`) → `useAudio()` hook (`src/hooks/useAudio.ts`) → `GlobalAudioPermission` (session permission modal) + `entryAudioManager` (game-entry audio). Stack: Google Cloud TTS (primary) → Web Speech API (fallback) → Howler.js (SFX).
- **Never:** create audio code outside the system; call Web Speech/Howler/HTML5 Audio directly in components; create component-level `isPlaying`/audio state; bypass the AudioController queue.
- **Always:** use `useAudio()` in components; add new audio capabilities as **methods on `AudioController`**, exposed via `useAudio`; route everything through the queue.
- **Component pattern:**
  ```ts
  const audio = useAudio({ componentId: 'MyGame' })
  await audio.speak('Hej børn!'); await audio.speakNumber(5); await audio.playSuccessSound()
  ```
- **Adding a method** (e.g. `speakEnglish`, `speakLetter`): wrap body in `this.queueAudio(async () => { this.updateUserInteraction(); const ok = await this.checkAudioPermission(); if (!ok) return; await this.googleTTS.synthesizeAndPlay(text, 'primary', true) })`, then export through `useAudio`.
- Navigation cleanup is automatic (`NavigationAudioCleanup` in `App.tsx`). Permission is session-based/automatic; iOS Safari 10s interaction timeout is handled in `AudioController`.

### A.2 Game development
- **Two game types.** *Task-based* (quiz/problem): use `entryAudioManager.onComplete()`. *Learning-based* (exploration, e.g. the English "Lær Engelsk" browse): direct audio on tap, no entry coordination.
- **Task-based required pattern:**
  ```ts
  const [entryAudioComplete, setEntryAudioComplete] = useState(false)
  useEffect(() => {
    entryAudioManager.onComplete('gameType', () => {
      setEntryAudioComplete(true)
      setTimeout(() => generateNewProblem(), 500)
    })
  }, [])
  // Render full UI immediately: <AppBar> always visible; <Button disabled={!entryAudioComplete}>Gentag</Button>;
  // content via conditional rendering: {options.length > 0 ? options.map(...) : null}
  ```
- **Strict rules:** show full UI immediately — **no loading overlays / "Lytter…" screens**; register `entryAudioManager.onComplete()` directly (do NOT use a `useTaskBasedGame` hook); use the right `RepeatButton` variant; disable repeat until `entryAudioComplete`; use conditional content rendering; no intermediate states.
- **RepeatButton variants** (`src/components/common/RepeatButton.tsx`): `MathRepeatButton` (purple), `AlphabetRepeatButton` (blue), `ColorRepeatButton` (orange). **This PRD adds `EnglishRepeatButton` (green) + `OrdlegRepeatButton` (teal).**
- **Theming:** `import { getCategoryTheme } from '../config/categoryThemes'` → `getCategoryTheme('english' | 'ordleg' | ...)`.

### A.3 Responsive design / layout
- **Every game layout fills the screen with NO scrolling, in portrait AND landscape.**
- **Layout skeleton:**
  ```tsx
  <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <AppBar sx={{ flex: '0 0 auto' }} />
    <Container sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ flex: 1, display: 'grid', gridAutoRows: 'minmax(0, 1fr)', gap: { xs: '8px', md: '12px' } }}>
        {/* content */}
      </Box>
    </Container>
  </Box>
  ```
- **Grid:** CSS Grid with dynamic sizing, never fixed dimensions; responsive columns by orientation/size (e.g. `gridTemplateColumns: { xs: 'repeat(6,1fr)', sm: 'repeat(8,1fr)', md: 'repeat(10,1fr)' }`); `gridAutoRows: 'minmax(0,1fr)'`; add `'@media (orientation: landscape)'` column overrides.
- **Aspect ratios:** quiz cards 4:3 (min 80px / max 120px); memory cards 3:4; action buttons 3:2–4:3 (min 44px); display cards 1:1–4:3. When using aspect ratios set `gridAutoRows: 'auto'`.
- **Typography:** `clamp()` (e.g. `fontSize: 'clamp(1rem, 3.5vw, 1.5rem)'`), adjust for landscape. **Touch targets ≥ 44px.**
- **Don'ts:** no fixed heights (`height: 200px`); no breakpoints without orientation queries; no small touch targets; no layouts needing scroll. Reference implementation: `src/components/common/LearningGrid.tsx`.
