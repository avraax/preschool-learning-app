# Liveliness PRD — Menus & Navigation (living cards, themed transitions, nav SFX, visible bloom)

**Date:** 2026-07-15
**Part of:** Liveliness & Journey Overhaul (see `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md`).
**Depends on:** PRD-01 (`bloomFor(section)`, `globalLevel()`, `xpProgress` selectors). Implement PRD-01 first.

---

## Context

Menu pages and the movement between them are the "boring standard" part of the app. Route transitions are a
bare 0.18s fade-in with no exit/direction/personality; menus go inert once loaded; back buttons are plain and
inconsistent; there are no navigation sounds; and section tiles use flat emoji while home cards use richer
soft-3D icons. This PRD makes the menus **alive** and gives movement through the app **personality** — while
strictly respecting the app's persistent-world architecture and its documented Chrome compositing-flicker
history.

**Success looks like:** the home and section menus breathe and invite a tap; tapping a card pops with a themed
particle burst and a sound; a **signature per-skin wipe** (a rising wave for Havet, a warp for Rummet, tumbling
leaves for Dino, a rainbow iris for Regnbue) carries the child into a game with the mascot **leading the way**;
back is one friendly consistent button that reverses the wipe; and each section's world is visibly **more alive**
the more it's been played.

---

## Guardrails (from roadmap, repeated for self-containment)

- iPad-first, responsive, **no-scroll full-viewport**; 44px+ targets; Danish; Comic Sans MS; token-driven only.
- **Reduced-motion**: every animation gated — transitions → instant fade / none; no usher, no idle attract, no
  breathe/bursts; back button + mascot static.
- Works in all registered skins (immersive **and** flat) + portrait/landscape.
- **Compositing-flicker discipline** — see the hard rules below; this is load-bearing.

---

## Verified grounding (current code)

- Router region in `src/App.tsx` (~620–712): a `position:relative` host `Box`
  (`height: calc(var(--vh)*100)`, `overflow:hidden`) containing `<PersistentWorld/>` (z0) and a
  `<Box zIndex:1>` wrapping a **single `motion.div` keyed on `location.pathname`** (0.18s `opacity/scale`
  **fade-in only**, lines 634–639). **No `AnimatePresence`, no exit anim** — a comment (627–629) records the
  cross-fade was REMOVED because a promoted opacity layer painted white over the scene during Chrome
  hover-compositing.
- `PersistentWorld` (`src/components/common/scene/PersistentWorld.tsx`) is `position:absolute` (**not `fixed`** —
  fixed blanks during touch-pan), blurs+dims on game routes (blur 7px, scale 1.06, radial dim, 0.4s) keyed off
  `routeKind(pathname)`. Returns `null` for flat skins (`theme.scene.layers.length === 0`).
- Registered skins: `kid` (Regnbue), `ocean` (Havet), `space` (Rummet), `dino` (Dinosaurer);
  `jungle`/`candy` exist but unregistered. `theme.scene.ambient.motion` ∈ `rise|fall|drift|twinkle`;
  `theme.scene.dark` flags dark worlds.
- Theme buckets are attached in `src/theme/buildTheme.ts` (`scene = tokens.scene ?? emptyScene()`) with a
  `declare module '@mui/material/styles'` augmentation of `interface Theme`. **`theme.transition` follows this
  exact pattern.**
- `HomePage` is inline in `App.tsx` (98–457): 5-card grid from a `homeCards` array, `sectionIconImages[id]`
  **soft-3D icons**, `motion.div` staggered entrance + `whileHover/whileTap` scale, plus the "Min Bog" shelf.
- `GameSelectionLayout.tsx` (shared by all 5 section menus): tile grid (`motion.div` + `Card`, staggered
  entrance, hover spring) rendering **flat `game.emoji`** (the icon mismatch); transparent `AppBar` with a
  static back `IconButton` (`rgba(255,255,255,0.2)`) → `navigate('/')`; corner `<ThemeMascot parallaxDepth={0}/>`.
- `GameShell.tsx` has a second, differently-styled static back `IconButton` (`rgba(255,255,255,0.8)` +
  `blur(8px)`) → `navigate(backRoute)`.
- Mascots: `ThemeMascot.tsx` (per-page menu buddy: idle bob, `getTapAnims(themeId)` tap wiggle,
  `spawnBubbleBurst()` themed particles, rides `--parallax-x/y`); `Mascot.tsx` (in-game, `mascotBus`-driven).
  Both are `position:fixed z6`, per-page — decoupled from the world on purpose (flicker history).
- `sfxClient.ts`: `SfxCue` union + `CUE_FILES` + `CUE_VOLUME`; `sfx.preload()` iterates `CUE_FILES` on first
  gesture; **`sfx.stopAll()` runs in `NavigationAudioCleanup` on every `location.pathname` change**; missing
  files degrade to silence.
- `useReducedMotion()` gates motion everywhere; `AmbientField`/scene freeze on game routes via
  `animationPlayState:'paused'`.
- Menu-path classification: `src/utils/menuPaths.ts` (`SECTION_MENU_PATHS`) shared with `scene/routeKind.ts`.

---

## Technical design

### 1. Transition system — decoupled OPAQUE "wipe" overlay (NOT AnimatePresence page-exit)

**Recommendation: a full-screen opaque wipe overlay driven by a transition orchestrator.** The flicker-prone
page mount/unmount happens *while fully covered*; the persistent world is never touched. Wrapping `<Routes>` in
`AnimatePresence` with an exit animation (two page subtrees + a transparent page opacity-fading over the scene)
is exactly the removed cross-fade that flickered — **reject it**. Keep the single keyed page render (optionally
drop even the 0.18s fade, since the reveal supersedes it — fewer promoted layers).

**State machine** — a `TransitionProvider` mounted in `App.tsx` inside the relative host `Box`, rendering the
overlay above pages (z1) and mascots (z6):
```
idle ──navigateWithTransition(to)──▶ covering
covering ──cover anim done──▶ (call navigate(to)) ──▶ revealing
revealing ──reveal anim done──▶ idle
```
- **covering** (~coverMs, default 250ms): opaque overlay animates *in* (transform/clip-path only). Fire the
  theme travel SFX. If forward-into-game, spawn the usher sprite (§3).
- **swap point**: cover `onAnimationComplete` → `navigate(to)`. React Router mounts the new page under the
  fully opaque cover (a suspended lazy page shows only a blank `Box` — invisible under the cover).
- **revealing** (~revealMs, default 300ms): overlay animates *out* in the travel direction, revealing the
  committed page. On complete → `idle`; if landed on a menu route, fire `menu-open`.

**Public API** — `useTransitionNav()`:
```ts
navigateWithTransition(to: string, opts?: { replace?: boolean }): void
goBack(to: string): void   // same machine, forces dir='back'
```
Same-path calls no-op (safe fallback — a missed call never dead-ends). Wiring points are few and central:
`HomePage` cards + Min Bog, `GameSelectionLayout` (covers all 5 section menus), `GameShell` back
(covers all games). Any `navigate()` NOT routed through this bypasses the wipe — audit those 3 points.

**Direction** — add `routeDepth` (co-locate with `menuPaths.ts` or a new `src/config/routeDepth.ts`):
```ts
export const routeDepth = (p: string) => (p === '/' ? 0 : p.split('/').filter(Boolean).length)
// 0 = home, 1 = section menu, 2 = game
export const directionFor = (from: string, to: string) =>
  routeDepth(to) >= routeDepth(from) ? 'forward' : 'back'
```
The theme descriptor's `direction` is the *forward* vector; `back` plays the reverse (cover from the opposite
edge, reveal back the way we came) for spatial consistency.

### 2. Flicker rules (LOAD-BEARING — do not deviate)

- Overlay paint is **opaque** (solid/gradient). Never cross-fade a transparent layer over the scene; the wipe
  animates `transform`/`clip-path`, **not** the page's opacity.
- **Never** put `backdrop-filter` on the overlay (it samples the scene and re-composites — the exact failure
  mode). Opaque paint only.
- The orchestrator **never touches `PersistentWorld`** (no opacity/filter changes). The world's own `inGame`
  blur transition keeps running *underneath the cover* and is finished by the time reveal starts.
- Keep a single keyed page render; do not reintroduce `AnimatePresence` page exit.
- `will-change: transform` on the overlay + motif **only during** the animation; reset to `auto` at `idle`
  (no permanent promoted layer).
- Overlay layer hints: `transform: translateZ(0)`, `backface-visibility: hidden`, `contain: strict`.
- Overlay is `position:absolute; inset:0` inside the existing relative host (**not `fixed`**) — matches the
  world and sidesteps fixed-layer touch-pan blanking. It exists only transiently during a tap-driven transition
  (no concurrent pan), so this is safe.
- **Test matrix:** Chrome iPad emulation (fractional DPR) + real iOS standalone PWA; include press-hold and
  touch-pan on menus mid/near-transition → confirm no fixed-layer blank and no white-over-scene regression.

### 3. Per-theme wipes (`theme.transition` token bucket)

Add to `src/theme/tokens/types.ts`, optional on `ThemeTokens`, defaulted in `buildTheme.ts`
(`transition = tokens.transition ?? defaultTransition()`), registered in the `declare module` augmentation like
`scene`:
```ts
export type TransitionVariant = 'wave' | 'zoom' | 'leaves' | 'iris' | 'fade'
export interface TransitionTokens {
  variant: TransitionVariant
  color: string                 // OPAQUE fill/gradient the overlay paints (never transparent)
  direction: 'up' | 'down' | 'left' | 'right' | 'in'   // forward vector; back reverses
  coverMs: number               // ~250
  revealMs: number              // ~300
  ease: number[] | string       // cubic-bezier
  sfx: SfxCue                    // forward travel cue
  motif?: 'wave' | 'rocket' | 'leaves' | 'sparkle'     // signature sprite on the overlay
  reduced: 'fade' | 'none'      // reduced-motion fallback
}
```

| Skin | variant | visual | dir (fwd) | cover/reveal | motif | sfx |
|---|---|---|---|---|---|---|
| **Regnbue** (kid) | `iris` | Soft rainbow radial/arc sweeps up from bottom (echoes the home rainbow arc), covers, then irises open. Bright sparkle speckle. | `up` | 240/300 | `sparkle` | `nav-whoosh` |
| **Havet** (ocean) | `wave` | Foam-crested wave rises from the bottom edge (opaque ocean-blue gradient + white foam crest), covers, then recedes downward on reveal (tide out). | `up` | 260/320 | `wave` | `nav-wave` |
| **Rummet** (space) | `zoom` | Warp-in: opaque dark `#070B1A` radial with a starburst scales up from center, covers; reveal = the field zooms *through* and out. | `in` | 260/340 | `rocket` | `nav-warp` |
| **Dinosaurer** (dino) | `leaves` | Earthy green→amber panel sweeps left→right with tumbling jungle leaves on the leading edge + a subtle dust puff (stompy). | `right` | 260/320 | `leaves` | `nav-stomp` |

Flat/unregistered skins → `{ variant:'fade', color: theme.decor.pageBackground, reduced:'fade' }` (flat pages
carry their own opaque bg, so a fast opaque fade works with no world present).

Renderers: `src/components/common/transition/variants/{Wave,Zoom,Leaves,Iris,Fade}.tsx` (or one
`TransitionOverlay` switching on `variant`). `wave`/`leaves` use `clip-path`/translate; `zoom`/`iris` use
`scale` + radial-gradient mask; `fade` uses opacity of the **opaque** panel (safe — it's opaque, not the page).
Reduced-motion → `reduced` fallback: `fade` = instant opaque swap ≤80ms; `none` = plain `navigate`, no overlay.

### 4. Mascot-led navigation (usher)

**Constraint:** `ThemeMascot` (menu) and `Mascot` (in-game) are per-page and unmount on navigation; a mascot
can't glide across the route change (that decoupling is what fixed the flicker). **Solution: the overlay carries
an ephemeral usher sprite that lives and dies with the overlay** — it never crosses a compositing boundary or
survives the route swap.

Forward-into-**game** sequence (section→game gets the full usher; home→section stays light):
1. Tap a tile → tile squash + `card-pop` SFX (§5/§7).
2. **covering**: overlay slides in; on top of it an usher sprite (same per-theme mascot URL from
   `loadSceneAssets(themeId).mascot`, already cached → same buddy) enters from the menu mascot's corner and
   beckons/leaps toward the travel direction.
3. cover complete → `navigate(to)`.
4. **revealing**: overlay + usher slide out in the travel direction — the buddy "leads" the child in. Underneath,
   the in-game `Mascot` mounts and plays `welcome` via `mascotBus.emit('welcome')`.

The usher is disposable and self-contained on the overlay layer; the two real mascots keep their flicker-safe
mount/unmount untouched. Reduced-motion → no usher, plain fade wipe.

### 5. Living cards (shared with home + section tiles)

- **`useLivingCard({ index, reduce, frozen })`** hook + **`<ThemedBurst/>`** component.
- **Idle breathe (CSS only, cheap):** keyframe `transform: scale(1) → scale(1.012) → scale(1)` over 3.6–4.6s,
  `ease-in-out infinite`, `animation-delay: index * 0.35s` (out of phase). Wrapped in
  `@media (prefers-reduced-motion: no-preference)`. Pausable via `animationPlayState:'paused'` (reuse the
  `AmbientField`/scene-freeze pattern) while a wipe is covering or the menu isn't foreground.
- **Tap squash/stretch:** the *tapped card only* runs a framer keyframe
  `scaleX:[1,0.94,1.03,1], scaleY:[1,1.06,0.97,1]` ~320ms spring (richer than today's flat `whileTap`). One at
  a time → negligible cost.
- **Themed particle burst on tap:** extract `ThemeMascot`'s `spawnBubbleBurst` into a reusable
  `<ThemedBurst origin motion={theme.scene.ambient.motion} />` (bubbles/stars/leaves/sparkles keyed off
  `motion`, same clip-path shapes). `ThemeMascot` refactors to consume it too (single source of truth). Cap
  concurrent bursts (ignore a new burst if >2 active).
- **Unified icon language:** a shared **`<GameTileIcon id gradient fallbackEmoji/>`** renders a soft-3D per-game
  asset from an icon registry when present, else the emoji **styled identically** (same
  `drop-shadow(0 4px 8px rgba(0,0,0,0.22))`, size clamp, `userSelect:none`). Unifies styling immediately; richer
  per-game art can land incrementally under `src/assets/themes/icons`.
- **Perf budget:** idle breathe is pure CSS (no per-card framer/rAF); `will-change` only on the actively tapped
  card; pause breathe + bursts while covered / scene-frozen / reduced-motion; keep `whileHover` behind
  `@media (hover:hover) and (pointer:fine)`.

### 6. Idle / attract loop

**`useIdleAttract({ enabled, idleMs = 8000, onAttract })`**:
- Arms a timer; **resets on any interaction** (`pointerdown`, `keydown`, throttled `pointermove`) and on route
  change; pauses on `visibilitychange:hidden`.
- On fire: (a) trigger the menu mascot's attract pose, (b) wiggle exactly **one** card (rotate the index each
  cycle). Re-arm with a slightly longer gap + jitter while still idle. Stop immediately on interaction.
- Lives in the menu page (`HomePage`, `GameSelectionLayout`); owns `attractCardIndex` (passed to that
  `LivingCard` as a one-shot `wiggle` flag → a single bounce/tilt keyframe) and toggles a new `attract` prop on
  `ThemeMascot`.
- **Mascot attract:** add `attract?: boolean` to `ThemeMascot` (sibling to `reaction`) → a beckon/hop reusing
  one `getTapAnims(themeId)` entry (on-brand per world) + optionally a small `ThemedBurst`.
- Reduced-motion → `enabled=false`; nothing animates.

### 7. Navigation SFX

Add to `SfxCue` union + `CUE_FILES` + `CUE_VOLUME` in `sfxClient.ts` (preload is automatic). Reuse an existing
curated file initially (missing = silence), drop dedicated `/sounds/ui/*.ogg` later.

| New cue | Fires | Vol | Notes |
|---|---|--:|---|
| `card-pop` | card/tile/Min Bog tap (onClick, before nav) | 0.35 | subtle pop |
| `nav-whoosh` | cover start (generic / Regnbue) | 0.35 | default travel |
| `nav-wave` | cover start (ocean) | 0.35 | per `theme.transition.sfx` |
| `nav-warp` | cover start (space) | 0.40 | |
| `nav-stomp` | cover start (dino) | 0.40 | thud+rustle |
| `menu-open` | reveal complete onto a menu route | 0.30 | soft arrive chime |
| `back` | cover start when `dir==='back'` | 0.30 | softer reverse whoosh |
| `level-up` | (used by PRD-01's `'levelup'` tier) | 0.45 | fanfare; alias `page-complete` until dedicated |

**Integration caution:** `NavigationAudioCleanup` calls `sfx.stopAll()` on every path change. The travel cue
(played at cover start) mostly finishes during cover, but **`menu-open` must fire *after* navigation/cleanup**
(on reveal complete) or it's immediately stopped — either fire it post-cleanup (natural, on reveal) or exclude
`nav-*`/`menu-open`/`back` from `stopAll()`.

### 8. Shared animated `<BackButton>`

Replaces the two inconsistent static `IconButton`s (`GameSelectionLayout` + `GameShell`).
- **API:** `<BackButton to={string} variant?: 'menu'|'game' />` → internally `useTransitionNav().goBack(to)`
  (reverse wipe + `back` SFX).
- **Visual:** circular, frosted (`rgba(255,255,255,0.28)` + `blur(8px)`), lucide `ArrowLeft`, ≥44px,
  `edge="start"`, safe-area aware. One consistent look everywhere.
- **Motion:** entrance slide/fade from left; `whileHover:{scale:1.06}` (guarded `hover:hover`);
  `whileTap:{scale:0.9, x:-2}` (nudge-left ⇒ "back"). Reduced-motion → static.

### 9. Visible bloom (consumes PRD-01)

`GameSelectionLayout` / the section's scene read `bloomFor(section)` (PRD-01) — map the `/farver` route to the
`colors` SectionId. At higher `stage`: reveal extra decorations / ambient sprites (raise `scene.ambient.count`),
fade in a layer, light the path between game cards; continuous props scale with `fill`. All token-driven — bloom
multiplies existing scene knobs, no bespoke per-section engine. Monotonic + persisted → the child returns to a
world they made bloom. Reduced motion → decorations appear statically.

### 10. Extract `HomePage`

Extract `HomePage` out of `App.tsx` into `src/components/home/HomePage.tsx` — it's ~360 inline lines that will
grow (living cards, idle attract, `navigateWithTransition`, the progression companion from PRD-01). Isolates the
hooks and shrinks `App.tsx` to routing/orchestration, lowering regression risk.

---

## Danish copy

Minimal here (mostly non-verbal). Any spoken menu cues stay short; the mascot's existing bubble copy pools cover
attract gestures. No new closed-set narration is strictly required for this PRD (level-up praise lives in PRD-01).

---

## Files to touch

**Create**
- `src/components/common/transition/TransitionProvider.tsx` — context + state machine + `navigateWithTransition`/`goBack`.
- `src/components/common/transition/TransitionOverlay.tsx` — renders variant + motif + usher.
- `src/components/common/transition/variants/{Wave,Zoom,Leaves,Iris,Fade}.tsx` (or one switch component).
- `src/hooks/useTransitionNav.ts` — thin context accessor.
- `src/hooks/useIdleAttract.ts` — idle/attract loop.
- `src/hooks/useLivingCard.ts` — idle breathe + tap squash wiring.
- `src/components/common/ThemedBurst.tsx` — extracted themed particle burst (shared with `ThemeMascot`).
- `src/components/common/BackButton.tsx` — shared animated back button.
- `src/components/common/GameTileIcon.tsx` — icon unification (3-D art with emoji fallback).
- `src/components/home/HomePage.tsx` — extracted from `App.tsx`.
- `src/config/routeDepth.ts` (or extend `src/utils/menuPaths.ts`) — `routeDepth` + `directionFor`.
- (optional later) `public/sounds/ui/{card-pop,nav-whoosh,nav-wave,nav-warp,nav-stomp,menu-open,back}.ogg`.

**Edit**
- `src/theme/tokens/types.ts` — add `TransitionTokens`/`TransitionVariant`; `transition?` on `ThemeTokens`.
- `src/theme/buildTheme.ts` — `transition` bucket + `defaultTransition()` + `declare module` augmentation.
- `src/theme/tokens/{kidTheme,ocean,space,dino}.tokens.ts` — add each `transition` descriptor.
- `src/App.tsx` — mount `TransitionProvider` + `<TransitionOverlay/>` in the host `Box`; render extracted
  `HomePage`; keep the single keyed page render (optionally drop the 0.18s fade).
- `src/services/sfxClient.ts` — add the new cues.
- `src/components/common/GameSelectionLayout.tsx` — `navigateWithTransition`, `<BackButton>`, `useLivingCard`,
  `<GameTileIcon>`, `useIdleAttract`, consume `bloomFor(section)`.
- `src/components/common/GameShell.tsx` — `<BackButton variant="game">` via `goBack`.
- `src/components/common/ThemeMascot.tsx` — consume `<ThemedBurst>`; add `attract` prop.

---

## Verification

- `npm run dev` + `npm run dev:api` (Windows PowerShell). `npm run build` + `npm run lint` clean.
- With `ui-screenshot` on an iPad viewport, per skin (at least Regnbue + Havet + Rummet + Dino):
  - Home entrance: cards breathe; wait ~8s → idle attract fires (mascot + one card), stops on tap.
  - Full **home → section → game → back** cycle: confirm the themed wipe plays, the usher leads into the game,
    `menu-open`/travel/`back` SFX fire, and there is **no white-flash / no fixed-layer blank** (this is the key
    regression check — the removed cross-fade). Test press-hold + a touch-pan near a transition.
  - Section tiles now use unified soft-3D-styled icons; a played section shows more bloom than a fresh one
    (drive some rounds first, or seed via `window.__progress.grantXp`).
  - Toggle `prefers-reduced-motion` → transitions become instant fades, no usher/breathe/attract, back button
    static; navigation still works; no console errors.
- Note the **real iOS standalone PWA** check for the transition overlay (device-specific fixed-layer behavior).

---

## Embedded implementation reference (Appendix A) — verbatim current signatures / anchors

`App.tsx` router region (keep single keyed render; mount overlay in the host `Box`):
```tsx
<Box sx={{ position:'relative', height:'calc(var(--vh,1vh)*100)', '@supports (height:100dvh)':{height:'100dvh'}, overflow:'hidden' }}>
  <PersistentWorld />
  <Box sx={{ position:'relative', zIndex:1 }}>
    <motion.div key={location.pathname} initial={reduceMotion?false:{opacity:0,scale:0.99}} animate={{opacity:1,scale:1}} transition={reduceMotion?{duration:0}:{duration:0.18,ease:'easeOut'}}>
      <Suspense fallback={<Box sx={{height:'100dvh'}} />}>
        <Routes location={location}>…</Routes>
      </Suspense>
    </motion.div>
  </Box>
  {/* NEW: <TransitionOverlay/> here, above z1 pages */}
</Box>
```
Lines: host `Box` opens at 620, `<PersistentWorld/>` 625, keyed `motion.div` 634–639, `<Routes>` 641–708.

`buildTheme.ts` pattern to mirror (`scene = tokens.scene ?? emptyScene()` + `declare module '@mui/material/styles' { interface Theme { scene: SceneTokens; … } }`).

`sfxClient.ts` current `SfxCue`: `tap | pick-up | spring-back | chomp | match | correct | wrong | drop-snap | flip | streak-up | star | sticker-reveal | round-complete | page-complete`. `sfx.play(cue, { rate?, volume? })`; `sfx.stopAll()`; `sfx.preload()`.

`ThemeMascot` props (current): renders the theme mascot; `reaction?: 'cheer'|'think'|…`; `parallaxDepth`. Add `attract?: boolean`. `spawnBubbleBurst()` is the particle routine to extract into `ThemedBurst`.

`GameSelectionLayout` back button (line ~82–92): circular `IconButton`, `rgba(255,255,255,0.2)`, lucide `ArrowLeft` → `navigate('/')`. `GameShell` back button (line ~98–114): `rgba(255,255,255,0.8)`+blur → `navigate(backRoute)`. Both replaced by `<BackButton>`.

`loadSceneAssets(themeId)` returns `{ mascot, … }` (cached) — the usher reuses `.mascot`.
`routeKind(pathname)` + `SECTION_MENU_PATHS` (`src/utils/menuPaths.ts`) classify menu vs game.
