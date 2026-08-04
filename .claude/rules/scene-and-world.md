---
paths:
  - "src/components/common/scene/*.tsx"
  - "src/components/common/scene/*.ts"
  - "src/components/common/transition/*.tsx"
  - "src/components/common/ThemeMascot.tsx"
  - "src/components/common/Mascot.tsx"
  - "src/components/common/LivingCard.tsx"
  - "src/components/common/GameSelectionLayout.tsx"
  - "src/config/parallax.ts"
  - "src/config/referenceViewports.ts"
  - "src/services/mascotBus.ts"
  - "src/services/musicClient.ts"
  - "src/utils/menuPaths.ts"
---

# The persistent world, the mascot, the music bed & the menu/transition layer

## The world

An app-wide **persistent parallax world** (`src/components/common/scene/` — `PersistentWorld` +
`ThemeScene` + `AmbientField` + `ParallaxLayer`/`useParallax`) renders behind every page for immersive
skins. `scene/routeKind.ts` classifies each route as `menu` (bright live world + idle mascot) or `game`
(dim/blur scrim, idle mascot hides). The scene **freezes** (rAF stopped + ambient CSS
`animation-play-state: paused`) on game routes and under `prefers-reduced-motion`.

Per-skin worlds are **multi-layer parallax** (far/mid/near `ParallaxLayer`s, index-aligned to
`SceneAssets.layers`). Section menus frame the world via `theme.scene.sectionFocus` + accent tint.

- **Home's 5 tappable `SceneObject`s share ONE arc shape on every skin** (`theme.scene.homeAnchors`;
  outer pair lowest, centre highest). A skin may shift the whole arc to match its horizon but must **NOT
  re-order it**, or that object's label drops out of the row — ocean sank Farver below its neighbours to
  seat the palette on the reef, dino lifted it above to clear the volcano: opposite art reasons, same
  broken row.
- **A layer's overscan is DERIVED from its own max travel** (`PARALLAX_MAX_* × depth`, pure in
  `src/config/parallax.ts`), never a fixed percentage, and the nearest/**ground layer is
  `anchor:'bottom'`**. A constant `scale(1.12)` is 52px of margin on an iPad but 23px on a phone in
  landscape, and a static `offsetY` art nudge eats it outright — at which point the layer slides off its
  own edge and the one behind it shows through (the blue sky that flickered along the bottom). Guarded by
  `sceneLayers.test.ts` per viewport, though **that test is insensitive to viewport size** — see
  `.claude/rules/pwa-and-device.md`.

## Progress in the world is ambient DENSITY, and nothing else

`bloomFor(section)` → `bloomExtra` → more drifting sprites. The stage-gated `bloomScenery` sprites (a
flower/star/cloud per skin, seated at hand-authored `xPct`/`yPct`, popping in at bloom stages) were
**deleted 2026-08-03** (owner: "it looks misplaced"), along with `sceneFurniture.ts` and
`bloomAnchors.test.ts`, which existed only to keep them off the mascot.

The lesson to keep: **a percentage anchor can't compose against art it doesn't know.** The only invariant
anyone could state was "don't hide behind the furniture", which those sprites satisfied while still reading
as clutter dropped on the scene. **Don't re-add decor seated in the world unless its position DERIVES from
the art** — the same rule that governs `homeAnchors` and responsive-design.md's "reserve the space, don't
tune a percentage". Drifting `AmbientField` sprites are the exception: they cross the whole sky by design.

All world/reward art is baked **soft-3D WebP** generated on a green screen and keyed via the pipeline in
`.claude/rules/scene-assets.md`.

## The mascot

Rendered **INSIDE each page** — menus mount `ThemeMascot`, games mount GameShell's `Mascot` — and reacts to
game events (`cheer`/`think`/…) via the `mascotBus` (`src/services/mascotBus.ts`). It is deliberately
decoupled from the world layer to avoid Chrome hover-compositing flicker; keep it that way. Its footprint is
exported as `MASCOT_CORNER_SIZE` so a layout reserves it rather than re-measuring (responsive-design.md).

## The music bed

`musicClient` (`src/services/musicClient.ts`, **HTML5 Audio** — moved off WebAudio for iOS-PWA stability)
plays a per-world bed on **menu surfaces only** (home + the 5 section menus + `/album`) **and only once the
auth/profile gate has opened**; entering a game/browse screen fades it out so narration + SFX own the mix.
It is a **separate channel** from TTS and SFX — never routed through `SimplifiedAudioController` — and it
honours the Musik switch in "Til de voksne" → Lyd (`progressStore.settings.musicEnabled`).

**The gate half cannot be inferred from the route, and it is not a special case.** `AppThemeProvider` starts
the bed and sits ABOVE `AuthGate` in `main.tsx`, and the lock screen lives at `/`, which IS a menu path — so
the bed played over the login screen and through the whole Google round trip while being *correct* about the
route. `AuthGate`/`ProfileGate` therefore REPORT themselves (`musicClient.setGateBlocking`), and the same
shape applies to anything else a pre-gate provider can start.

Menu-path classification shares `SECTION_MENU_PATHS` (`src/utils/menuPaths.ts`) with `scene/routeKind.ts`
(the `/album` extra is music-only — the scene dims `/album`).

## Menus & the transition wipe

Liveliness PRD-02. Menu/game navigation goes through `useTransitionNav()` (`navigateWithTransition` /
`goBack`) → `TransitionProvider` drives a decoupled **opaque wipe overlay**
(`src/components/common/transition/`) so the page mount/unmount happens fully covered. **Raw `navigate()`
bypasses the wipe** — only NotFound and `RoundResultScreen` do that intentionally.

**The wipe obeys the SAME compositing-flicker rules as the persistent world**, and that is why it exists in
this shape: opaque paint, `transform`/`clip-path` only, **no `backdrop-filter`**, `will-change` cleared at
idle, `absolute` not `fixed`. Per-skin wipe = the `theme.transition` token (iris/wave/zoom/leaves + a flat
`fade` default in `buildTheme`); reduced-motion → fast opaque fade or a plain navigate.

Menu liveliness primitives, all shared — reuse rather than re-fragment:

- `LivingCard`/`useLivingCard` — CSS idle-breathe + framer tap-squash, on **separate nested layers so the
  transforms don't fight**
- `ThemedBurst` (also consumed by `ThemeMascot`), `GameTileIcon` (soft-3D, registry-ready)
- `useIdleAttract` — after ~8s idle: mascot beckon + one card wiggle
- the shared animated `BackButton` (reverses the wipe) replaced the old per-screen back `IconButton`s in
  `GameSelectionLayout`/`GameShell`
- **Visible bloom**: `PersistentWorld` reads `bloomFor(section)` for the current route and adds ambient
  objects scaling with stage/fill (home reflects the best across sections)
