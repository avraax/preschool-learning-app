# PRD — Immersive Theme Worlds (realistic, kid-friendly)

Status: **APPROVED for implementation** (decisions locked via product Q&A). To be implemented
in a fresh session from the current `master` HEAD. No code has been written for this yet.

Owner context: Danish preschool learning app (`Børnelæring`) for a ~5-year-old. React 19 +
TS + Vite 8 + MUI v9, Framer Motion, Howler. Deploy: Vercel on push to `master`. See
`CLAUDE.md` and `.claude/rules/*` for house rules (audio, responsive, game patterns).

---

## 1. Goal

Today a theme only repaints colors. Make each theme an **immersive, "realistic-but-friendly"
world** — layered parallax scenery, themed ambient objects, a per-world mascot, themed
materials and a themed title font — so picking a theme feels like *stepping into that place*.
Keep it calm and usable for an early learner: the **game/quiz screens stay focused**; the
worlds live on the **home page and section menus**.

This builds directly on the existing token-driven theme system (Phases 1–3, already shipped):
`ThemeTokens` → `buildTheme()` → `AppThemeProvider` (runtime switch + localStorage) →
front-page `ThemeSelector`. Six themes exist today as **color-only** skins; this PRD turns
them into full worlds.

## 2. Locked decisions (do not re-litigate)

| Topic | Decision |
|---|---|
| Visual technique | **Layered illustrated scenes with parallax** |
| Art style | **Soft 3D render (Pixar-ish): rounded, warm, soft lighting, non-scary** |
| Asset source | **AI-generated illustrations**, then optimized |
| Reskin depth | **Full material reskin on home + section menus**; game screens **calm** |
| Game screens | Theme **colors + one light static motif**; clean readable cards; **no parallax, no moving objects** |
| Mascot | **One per world**; idle animation + **tap → react + short Danish line via existing TTS** |
| Parallax driver | **Auto drift + gentle touch response** (NO gyroscope / no motion permission) |
| Fonts | **Themed title font only** (headers); body stays Comic Neue. Fonts must be **self-hosted/bundled** so they render identically on iOS/desktop |
| Ambient sound | **None** (single audio channel stays reserved for learning narration) |
| World lineup | Keep all 5 + plain **Regnbue** default. **Rummet (Space) uses a dark backdrop**; content cards stay light |
| Performance | **Prioritize performance**: WebP/AVIF, modest resolution, **lazy-load only the active theme** |

## 3. Non-goals / constraints

- **No game difficulty/range changes.** Out of scope entirely.
- **Educational colors are NOT themed.** `FarvejagtGame` color-object swatches and
  `RamFarvenGame` mixing colors are *subject matter*, never reskinned. (Same rule as the
  existing theme system.)
- **No new audio channel / no background music.** Mascot speech reuses the existing
  `SimplifiedAudioController` (single audio at a time, no queue).
- **PWA stays network-only** (no offline precaching added). Art is fetched on demand and may
  be added to the runtime cache opportunistically, but offline support is not a requirement.
- **Readability first.** Text always sits on solid/scrimmed surfaces; never directly on busy art.
- **No layout/usability regressions** on game screens; touch targets ≥ 44px; no-scroll game
  layouts preserved (`.claude/rules/responsive-design.md`).

## 4. Current architecture (starting point)

- `src/theme/tokens/types.ts` — `ThemeTokens`, `CategoryPalette`, `DecorTokens`, `ShadowTokens`.
- `src/theme/tokens/<id>.tokens.ts` — one object per skin: `kidTheme` (id `kid`, "Regnbue"),
  `ocean`, `space`, `jungle`, `candy`, `dino`. Authored via `tokens/helpers.ts`
  (`category()`, `gradient3()`, `cardSurface()`, `neutralShadows()`, `SECTION_ICONS`, `COMIC_FONT`).
- `src/theme/buildTheme.ts` — `buildTheme(tokens)` → MUI theme; attaches `theme.categories`,
  `theme.decor`, `theme.customShadows`; calls `setActiveTokens()` for non-React reads.
- `src/theme/themes.ts` — registry array + `themeOptions` (selector metadata) + `getThemeTokens()`.
- `src/theme/ThemeProvider.tsx` — `AppThemeProvider` (themeId state, localStorage key
  `bornelaering-theme`, rebuilds theme on change) + `useThemeSwitch()`.
- `src/components/common/ThemeSelector.tsx` — collapsed corner button (active emoji) →
  popover of all themes. Lives on the home page only.
- `src/config/categoryThemes.ts` — section **content** (names, `games[]`); colors come from tokens.
- `src/App.tsx` — `HomePage` renders the title, the 5 section cards (data-driven map reading
  `theme.categories`), balloons easter-egg, and `<ThemeSelector/>`. Section menus are the
  `*Selection.tsx` components using `GameSelectionLayout`.

The theme switch already re-renders the home page (it consumes `useTheme()`); other screens
re-mount with the active skin on navigation.

## 5. System design

### 5.1 Token schema extensions (`types.ts`)

Add to `ThemeTokens`:

```ts
export type AmbientMotion = 'rise' | 'fall' | 'drift' | 'twinkle'

export interface ParallaxLayerSpec {
  src: string          // imported asset URL (transparent PNG/WebP) or '' for none
  depth: number        // 0 = static (far), 1 = strongest parallax (near); ~0.05–0.3 typical
  // optional placement hints; default = cover/full-bleed
  anchor?: 'top' | 'bottom' | 'center'
  opacity?: number
}

export interface AmbientSpriteSpec {
  src: string          // small transparent sprite (e.g. a single bubble/leaf/star)
  size: [number, number] // min/max px
}

export interface SceneTokens {
  dark: boolean                 // dark decorative backdrop (Space). Cards/text stay light.
  layers: ParallaxLayerSpec[]   // back→front; rendered behind content with parallax
  ambient: {
    sprites: AmbientSpriteSpec[]
    count: number               // simultaneous objects (perf-capped, see §7)
    motion: AmbientMotion
  }
  mascot: {
    src: string                 // mascot sprite (transparent)
    lines: string[]             // short Danish phrases spoken on tap (pick one at random)
  }
  selectorThumb: string         // small scene thumbnail for the theme selector
}

export interface MaterialTokens {
  // Home + menu "furniture" (NOT applied to game screens).
  cardFrame: string             // border/frame treatment (CSS border or background image)
  cardSurfaceOverlay?: string   // optional texture overlay on cards (subtle, low opacity)
  buttonGradient: string        // primary/menu button background
  motif: string                 // small static motif used on game screens (e.g. a corner png or css)
}

// add to ThemeTokens:
//   titleFontFamily: string    // bundled themed display font for titles (fallback to COMIC_FONT)
//   scene: SceneTokens
//   materials: MaterialTokens
```

Notes:
- `buildTheme()` maps `titleFontFamily` into the theme (e.g. `theme.typography.h1.fontFamily`
  or a custom `theme.titleFontFamily` field used by the home/menu title components) and
  attaches `theme.scene` + `theme.materials` like the existing `theme.decor`.
- Keep the **default `kid` theme authored with today's exact values**; give it a gentle
  "Regnbue" world (soft clouds + rainbow) so it isn't visually empty, but it must remain the
  safe, light, familiar look.

### 5.2 Asset pipeline (AI-generated, optimized)

- **Style prompt baseline (reuse for every asset):** *"soft 3D rendered children's
  illustration, Pixar/Disney-style, rounded friendly shapes, soft global lighting, gentle
  colors, no text, no scary elements, clean transparent background"* + per-theme subject.
- **Per scene, export separate transparent layers** (typically 3): far (sky/water/space),
  mid, near/foreground — so the parallax engine can offset them independently. Plus: the
  **mascot** sprite, **ambient sprites** (1–4 tiny transparent cutouts), and a **selector
  thumbnail** (~240×160).
- **Format & size:** export PNG → optimize to **AVIF + WebP** (with PNG fallback only if
  needed). Target backgrounds sized for iPad (max ~1536px wide, responsive `srcset` if raster
  scaling matters). **Budget: ≤ ~700KB total per theme** after optimization (see §7).
- **Location & loading:** store under `src/assets/themes/<id>/...` and **dynamic-import per
  theme** (Vite hashes + code-splits) so only the active theme's art is fetched. Provide a
  per-theme async `loadSceneAssets(id)` that resolves the imported URLs into the
  `SceneTokens.layers[].src` etc. Show a graceful fade-in; never block first paint.
- Colors in the art must **harmonize with each theme's existing accent palette** (see §6).

### 5.3 Parallax + scene rendering

New `src/components/common/scene/`:
- `ThemeScene.tsx` — top-level world layer. Absolutely positioned inside the home/menu root
  (behind content, `pointer-events: none`, `aria-hidden`). Renders: dark/light base →
  `ParallaxLayer` per `scene.layers` → `AmbientField` → (mascot is rendered by the page, not
  here, so it can be interactive). Lazy-loads the active theme's assets.
- `ParallaxLayer.tsx` — positions one layer; offsets by `depth`. Driver: a shared hook
  `useParallax()` that produces a smoothed offset from (a) a slow autonomous drift
  (sine over time) and (b) pointer/touch position (gentle, clamped). Use transforms only
  (`translate3d`), `will-change: transform`. **Respect `prefers-reduced-motion`:** no
  parallax, no drift (render layers static).
- `AmbientField.tsx` — renders `scene.ambient.count` sprites with CSS keyframe motion
  (`rise`/`fall`/`drift`/`twinkle`), randomized position/size/duration/delay computed **once**
  (memoized by theme id) to avoid re-randomizing on re-render. `pointer-events: none`,
  `aria-hidden`. Reduced-motion → render a few **static** sprites or none.

### 5.4 Mascot

`src/components/common/ThemeMascot.tsx`:
- Renders the active theme's mascot sprite with a gentle idle animation (bob/scale/blink via
  Framer Motion). Sits in a fixed, tap-friendly spot on the **home page** (e.g. near the
  title, replacing/!augmenting the existing `LottieCharacter` welcome slot) and optionally a
  smaller idle mascot on **section menus**.
- **Tap:** plays a reaction animation AND speaks a random `scene.mascot.lines[]` entry via the
  existing audio hook (`useSimplifiedAudioHook` → `audio.speak(line)`; call
  `audio.updateUserInteraction()` first per iOS rules in `.claude/rules/audio-system.md`).
  Must obey the no-queue rule (new tap cancels current). Disable speech if audio not ready.
- Mascot is the ONE interactive element of the world layer; everything else is
  `pointer-events: none`.

### 5.5 Material reskin (home + menus only)

- Extend `buildTheme()` / components so home + menu **cards, primary buttons, and the title**
  read `theme.materials` + `theme.titleFontFamily`. Keep card **geometry** (radius, padding,
  min sizes, touch targets) unchanged — only frame/surface/typography change — to avoid layout
  regressions.
- `GameSelectionLayout` (used by all `*Selection.tsx` menus) renders `<ThemeScene/>` behind
  its content and applies themed materials to its cards/buttons.
- The home page (`App.tsx`) renders `<ThemeScene/>` + `<ThemeMascot/>` and themed title.

### 5.6 Game screens (calm)

- Game/quiz/learning components keep today's structure and the existing themed **colors**
  (already token-driven via `getCategoryTheme`). Add **one** light static themed **motif**
  (`theme.materials.motif`) — e.g. a faint corner illustration or a themed header strip — at
  low opacity, non-interactive, behind/around the existing clean cards.
- **No** `ThemeScene`, **no** parallax, **no** ambient objects, **no** mascot on game screens.
- Verify no regression to no-scroll layouts and contrast.

### 5.7 Themed title fonts (bundled)

- Add per theme a `titleFontFamily`, loaded via **`@fontsource`** (self-hosted woff2), with
  **`COMIC_FONT` as the final fallback**. Body text stays Comic Neue everywhere.
- **Hard requirement:** the chosen font MUST include Danish glyphs **æ ø å Æ Ø Å** (the title
  is "Børnelæring"). Verify per font; if a candidate lacks them, fall back to Comic Neue.
- Candidate picks (verify glyph coverage + license before bundling):
  - Regnbue → Comic Neue (unchanged) or `Baloo 2`
  - Havet → `Fredoka` (round, bubbly)
  - Rummet → `Orbitron` or `Exo 2` (techy) — **verify æøå**; fallback if missing
  - Junglen → `Chewy` or `Luckiest Guy`
  - Slikland → `Grandstander` or `Pacifico` (script — check readability)
  - Dinosaurer → `Bangers` (comic-adventure) — **verify æøå**
- Only load the **active** theme's title font (dynamic `@fontsource` import or font-display
  swap) to control payload.

### 5.8 Theme selector upgrade

- Replace the emoji in the collapsed/expanded `ThemeSelector` with the **`selectorThumb`**
  scene thumbnail per world (small rounded image) + name; active one ringed. Keep the
  collapsed single-button + tap-to-expand behavior already shipped. Lazy-load thumbnails
  (they're tiny) so the picker previews each world.

## 6. Per-theme creative briefs

For each: tie art to the **existing token accent colors** (already in the `*.tokens.ts` files),
keep soft-3D friendly style, 3 parallax layers (far→near), ambient set, mascot + sample Danish
lines, title font, and a game-screen motif. (Section icons stay constant: 📚🧮🎨🌍🗣️.)

### 🌈 Regnbue (default, `kid`) — keep light & familiar
- Palette: current (purple/blue/green/orange/teal accents; bg `#F8FAFC`).
- Layers: soft sky gradient → fluffy clouds → a gentle rainbow arc (reuse current motif).
- Ambient: floating soft stars/sparkles + a balloon or two. Motion: `drift`.
- Mascot: the current friendly character (reuse existing `LottieCharacter`). Lines:
  "Hej! Skal vi lege?", "Godt klaret!", "Vi ses!"
- Title font: Comic Neue (unchanged). Motif: small rainbow corner.

### 🌊 Havet (Ocean) — `ocean`
- Palette ties: ocean blue `#0277BD`, teal `#00897B`, coral `#E64A19`, sandy gold `#F9A825`.
- Layers: sunlit blue water + light rays (far) → coral reef / seaweed silhouettes (mid) →
  sandy seabed foreground (near).
- Ambient: rising bubbles + a small fish or two. Motion: `rise`.
- Mascot: a cute round fish or friendly octopus. Lines: "Pluf! Vil du dykke med?",
  "Bobler!", "Sikke flot!"
- Title font: Fredoka. Motif: a small bubble cluster / shell in a corner.

### 🚀 Rummet (Space) — `space` — **dark backdrop**
- Palette ties: indigo `#3949AB`, nebula purple `#8E24AA`, cyan `#00ACC1`, star gold.
  **Dark page background**; content cards stay light & readable.
- Layers: deep starry sky + soft nebula glow (far) → a planet + moon (mid) → a friendly
  rocket / floating astronaut helmet (near).
- Ambient: twinkling stars + the occasional shooting star. Motion: `twinkle`.
- Mascot: a small smiling astronaut or alien. Lines: "Klar til opsendelse?", "3-2-1!",
  "Til stjernerne!"
- Title font: Orbitron/Exo 2 (verify æøå). Motif: a tiny planet/star corner.

### 🌴 Junglen (Jungle) — `jungle`
- Palette ties: leaf green `#2E7D32`, teal `#00897B`, parrot orange `#EF6C00`, macaw blue
  `#1565C0`, flower pink `#C2185B`.
- Layers: misty jungle canopy light (far) → big leaves / vines (mid) → foreground ferns &
  grass (near).
- Ambient: fluttering butterflies + slowly falling leaves. Motion: `fall`.
- Mascot: a cheerful monkey or toucan. Lines: "Uh-uh-ah-ah!", "Kom og leg i junglen!",
  "Sejt!"
- Title font: Chewy/Luckiest Guy. Motif: a leaf/vine corner.

### 🍭 Slikland (Candy) — `candy`
- Palette ties: bubblegum pink `#D81B60`, grape `#8E24AA`, tangerine `#F4511E`, mint `#00897B`,
  blueberry `#039BE5`; soft pastel bg.
- Layers: pastel sky + candy clouds (far) → lollipops / candy-cane hills (mid) → foreground
  gumdrops & sprinkles (near).
- Ambient: floating candies + falling sprinkles. Motion: `fall`.
- Mascot: a smiling cupcake or gummy bear. Lines: "Mmm, slik!", "Så sødt!", "Skal vi lege?"
- Title font: Grandstander (or Pacifico). Motif: a candy/sprinkle corner.

### 🦕 Dinosaurer (Dinosaurs) — `dino` — friendly, not scary
- Palette ties: fern `#558B2F`, swamp teal `#00796B`, volcano orange-red `#D84315`, stone
  slate `#455A64`, amber `#FF8F00`.
- Layers: prehistoric sky + distant mountains/volcano glow (far) → fern silhouettes & a cute
  dino on the horizon (mid) → foreground rocks & leaves (near).
- Ambient: floating leaves + an occasional gliding (friendly) pterodactyl. Motion: `fall`.
- Mascot: a chubby baby dino (cute, smiling — never scary). Lines: "Rooar! (en venlig en)",
  "Lad os grave!", "Flot fundet!"
- Title font: Bangers (verify æøå). Motif: a small dino-egg / footprint corner.

## 7. Performance & accessibility budgets

- **Per-theme art ≤ ~700KB** optimized (AVIF/WebP); lazy-load active theme only; preload on
  selector open/selection. First home paint must not wait on art (fade art in).
- **Ambient objects:** ≤ ~14 on home, ≤ ~6 on menus. Transforms only; `will-change: transform`;
  avoid layout thrash. Target 60fps on iPad; no jank during navigation.
- **`prefers-reduced-motion: reduce`:** disable parallax + drift + ambient motion (static
  scene, mascot idle reduced to none). The app already honors this in `CelebrationEffect`.
- **Contrast:** all text on solid/scrimmed surfaces; verify WCAG AA-ish legibility on each
  world (esp. dark Space). No text directly over busy art.
- **Memory:** unload/replace previous theme's large assets on switch where practical.

## 8. File/architecture plan

New:
- `src/theme/tokens/*` additions (SceneTokens, MaterialTokens, titleFontFamily) + values in
  each `*.tokens.ts`.
- `src/assets/themes/<id>/` — optimized art (layers, mascot, ambient sprites, selectorThumb).
- `src/theme/sceneAssets.ts` — per-theme async asset loader (dynamic imports) + types.
- `src/components/common/scene/ThemeScene.tsx`, `ParallaxLayer.tsx`, `AmbientField.tsx`,
  `useParallax.ts`.
- `src/components/common/ThemeMascot.tsx`.

Edits:
- `src/theme/buildTheme.ts` — map `titleFontFamily`, attach `scene` + `materials`.
- `src/theme/tokens/helpers.ts` — add helpers for materials/scene if useful.
- `src/App.tsx` — render `<ThemeScene/>` + `<ThemeMascot/>`; themed title; materials on cards/buttons.
- `src/components/common/GameSelectionLayout.tsx` — `<ThemeScene/>` + materials (menus).
- `src/components/common/ThemeSelector.tsx` — thumbnails.
- Game components — add `theme.materials.motif` (calm), no scene.
- `package.json` — add chosen `@fontsource/*` title fonts.
- `CLAUDE.md` — update Theming section + "Adding a theme" to include world assets/mascot/font.

## 9. Phasing (each phase: build → `npm run build` → on-device iPad check → commit)

- **P0 — Plumbing:** extend tokens (scene/materials/titleFont), `buildTheme` mapping, asset
  loader skeleton, `prefers-reduced-motion` hook. No visual change yet.
- **P1 — One reference world (Havet):** full pipeline end-to-end for Ocean (art layers +
  parallax + ambient + mascot + title font + materials + selector thumb) on home. Validate
  perf + art workflow before scaling.
- **P2 — Remaining worlds:** Space (dark), Jungle, Candy, Dino, and Regnbue’s gentle world.
- **P3 — Section menus:** `ThemeScene` + materials + idle mascot on `*Selection.tsx`.
- **P4 — Game-screen motifs + selector thumbnails + polish:** calm motifs on games, themed
  selector previews, reduced-motion + contrast QA, asset-size audit.

## 10. Acceptance criteria

- Switching theme on the home selector visibly changes the **whole world** (backdrop,
  parallax, ambient objects, mascot, title font, card/button materials), persists across
  reloads, and updates menus on navigation.
- Game/quiz/learning screens remain calm (colors + one light motif), fully readable, no-scroll,
  ≥44px targets, no difficulty change.
- Space is dark with readable light cards; all worlds pass a contrast pass.
- `prefers-reduced-motion` disables parallax/ambient; app stays usable.
- Active-theme art ≤ ~700KB; lazy-loaded; home first paint not blocked; smooth on iPad.
- Educational colors (Farvejagt/RamFarven) untouched. Build + lint clean. Commit per phase.

## 11. Open items (recommended defaults — confirm or override during build)

- **Default theme for new users:** keep **Regnbue** (familiar/light). (Could default to Havet.)
- **Exact title fonts:** pick from §5.7 candidates after verifying **æøå** glyphs + license.
- **Mascot on menus:** include a smaller idle mascot on section menus (recommended) vs home-only.
- **Selector thumbnails:** use real `selectorThumb` art (recommended) vs keep emoji.
- **Asset tooling:** which image model + optimizer (e.g. squoosh/sharp) — implementer's choice,
  meet the §7 budget and the soft-3D style baseline.
