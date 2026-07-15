# Liveliness PRD — The Structured World (visual overhaul of the shell)

**Date:** 2026-07-15
**Part of:** Liveliness & Journey Overhaul (see `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md`).
**Depends on:** PRD-01/-02/-03/-04 shipped (persistent world, transition system, living cards, mascot bus,
progression/bloom, reward moments all exist). This PRD **re-skins and deepens** those systems — it does not
replace them.
**Owner:** Allan (parent). **Target user:** one ~5-year-old boy, iPad-primary, **pre-reader** (navigation must
never require reading).

> **This is a single cohesive release, not phased shipping.** The whole redesign lands together. The build-order
> in §"Build order" is an *internal* sequence for the implementing sessions and the asset-generation loop; nothing
> goes to production piecemeal.

---

## 1. Context — why this exists

The app already owns a beautiful, **alive background**: a per-skin persistent parallax world, an idle mascot,
themed wipes, background music, a bloom/XP progression layer. But the **surface the child actually touches** is
the weak point:

- Home and all 5 section menus are a **rigid grid of near-identical frosted-glass rectangles**, each holding one
  small icon + a label. Every menu looks the same; every tile looks the same (`HomePage.tsx`,
  `GameSelectionLayout.tsx`).
- The tiles **float on top of** the world rather than living **in** it — the liveliness is all in the backdrop,
  none in the foreground.
- Each world is a **single flat backdrop image** with no real depth (`SceneAssets.layers` = one image;
  `ambientSprites: []`).
- The per-game tile-icon registry is **empty** (`GameTileIcon.tsx` `GAME_ICON_IMAGES = {}`) → every game tile
  falls back to a bare emoji.
- Progress exists but reads **subtly** — a small ring + a de-emphasized "Min Bog" pill.
- The transition between screens is a flat wipe — you *swap slides*, you don't *go somewhere*.

**The complaint, precisely:** the world is alive but the interactive surface is a spreadsheet.

## 2. North star — "The Structured World"

Decided with the owner this session (full decision log in §3). The direction is **A (lush, structured,
predictable) fused with B (a sense of place / a world you travel into)**:

- The 5 sections stay in a **clear, predictable arrangement** — the child never hunts, which protects focus and
  works for a non-reader. **No hidden navigation, no free-roam map.**
- Tiles stop being frosted cards floating on the world. They become **tactile, soft-3D objects that live in the
  world** — seated on the scene's own features (clouds, shore, asteroids, foliage), casting soft contact shadows,
  the multi-layer landscape parallaxing behind *and* around them.
- Entering a section feels like **travelling into that place**: tapping an object performs a **cinematic push-in**
  that focuses the persistent world onto that object's locale, then the section menu mounts framed on that region
  and tinted to the section's accent — B's "I'm going somewhere" beat without B's art explosion (the section
  menus reuse the theme's *one* world, focused, not 24 bespoke backdrops).
- **Progress is physically visible**: the world blooms as the child learns (more scenery, a growing companion,
  the section landmarks fill with life) — a reason to come back.
- Idle screens are **calm-alive** (gentle breathe/drift, occasional mascot glance); **delight is released on
  interaction** — taps, correct answers, arriving somewhere, levelling up.
- The **mascot is a present, reactive guide** — greets on arrival, glances toward things, points, celebrates,
  beckons when idle — warm without owning the screen.

**Success looks like:** the son opens the app and sees a *place* — his place — with five tactile things resting
in it, a friend waving hello, and visible signs of how far he's come; he taps one, the world carries him inside,
and every screen feels hand-made and calm rather than tiled.

## 3. Decision log (locked this session — do not re-litigate)

| # | Decision | Choice |
|---|---|---|
| Nav metaphor | Structured vs world-map vs character-hub | **A + B blend: "Structured World"** — predictable layout, objects live in the world, travel-into-section feel |
| Build technique | baked art vs WebGL vs hybrid | **Baked soft-3D art (WebP) + CSS depth/parallax/springs.** NO runtime WebGL/Three.js |
| Scope | shell vs shell+games | **Shell** (home, 5 section menus, transitions, rewards, mascot) **+ a reusable visual-language spec** games inherit in a later pass |
| Assets | who/how | **Owner generates in Gemini.** This PRD ships a **style guide + copy-paste prompt per asset** + a generate→review→integrate loop |
| Liveliness dial | idle energy | **Calm-alive** — restful when idle; energy on interaction |
| Mascot role | | **Present & reactive guide** (greet/glance/point/celebrate/beckon), not full co-star, not background-only |
| Progress visibility | | **Central & visible** — the world visibly grows; companion + level prominent |
| Theme coverage | | **All 4 registered themes at launch** (Regnbue/Havet/Rummet/Dinosaurer) |
| Travel feel | | **Cinematic push-in** (~0.5–0.7s focus into the section's locale); reduced-motion → fast opaque fade |
| Section objects | theme-constant vs per-theme | **Theme-constant** — one soft-3D object set reused across all worlds (like today's section icons) |
| Device floor | | **Recent iPad (2021+), generous budget.** Phone/portrait must keep working (compact variants) but need not be lavish |
| Menu audio | | **Add gentle per-world ambient loop + reactive tap/arrive/bloom SFX** (honor existing mute toggles) |
| Scene depth | | **Multi-layer parallax per world** (far/mid/near), ~8–12 backdrop layers total |
| Mascot poses | | **Core set ~4 poses × 4 worlds** (idle, greet, point, celebrate) ≈ 16 renders |
| Game icons | | **Soft-3D icon for every game** (~22 distinct, theme-constant) |
| Home layout | | **Objects seated in the scene** along a gentle per-theme arc at fixed anchors — **defined per theme** so each world seats its 5 objects on its own features |
| Extra surfaces in scope | | Reward/celebration moments · Album (Min Bog) · Game-entry beat · Adult corner (light polish) |
| Guardrails | | No reading-dependent nav · nothing scary/over-stimulating · never slow him down (skippable/short) · keep it uncluttered |
| Art style | | **Soft-3D "claymation / Pixar-lite"** — rounded, soft matte shading, gentle rim light, soft contact shadow (matches current bear/icons) |

**Proposed defaults for the few things not explicitly decided** (called out again in §12 for sign-off):
- The mascot stays **un-named** and speaks via existing bubble-copy pools + poses; **no new spoken TTS narration**
  is required by this PRD (avoids a prebake/audit cycle). One optional short spoken greeting on home arrival is a
  stretch, gated behind a flag.
- Section menus **reuse the theme's one world, focused per-section** (accent tint + enlarged section landmark),
  rather than bespoke per-section backdrops.
- Bloom scenery uses a **modest per-theme sprite set** (§7) layered on the existing CSS ambient, not a bespoke
  per-section scenery engine.

---

## 4. Guardrails (repeated for self-containment)

- **iPad-first**, fully responsive, **no-scroll full-viewport** (`.claude/rules/responsive-design.md`); 44px+
  targets; **Danish**; **Comic Sans MS** for child-facing type; **token-driven only** (never hardcode colors).
- **Non-reader:** every navigation target must be identifiable by **object/icon/audio**, never by reading a label.
  Labels stay as reinforcement only.
- **Nothing scary / over-stimulating:** no dark/startling imagery, no sudden loud audio, no strobing.
- **Never slow him down:** every ceremony/transition is **short and skippable**; the game is always ≤1 tap of
  waiting away. Push-in ≤0.7s and fast-forwardable.
- **Keep it uncluttered:** generous negative space, few elements, calm composition even while lively.
- **Reduced-motion respected on every new animation** — motion removed, but **layout, art, reward, and audio are
  kept**. Push-in → fast opaque fade; breathe/parallax/idle-attract off; scene frozen.
- **Compositing-flicker discipline (LOAD-BEARING — see PRD-02 §"Flicker rules"):** opaque transition overlays only;
  the transform/clip-path animates, never page opacity; **never** `backdrop-filter` on a moving layer; the
  orchestrator **never touches `PersistentWorld`**; `will-change` set only during animation, cleared at idle;
  overlays are `position:absolute` inside the relative host, **not `fixed`**. Verify on **real iOS standalone PWA**,
  including press-hold and touch-pan near a transition.
- **All 4 registered skins + flat/unregistered skins + portrait & landscape** must render correctly.
- **No adaptive difficulty** (standing constraint). Nothing here touches XP-earning fairness.
- **Visual quality floor:** must match or exceed today's immersive look; never regress it.

---

## 5. Verified grounding (current code — cite when integrating)

App root (`src/App.tsx`): `<TransitionProvider>` (~`:206`) wraps a relative host `Box`
(`height: calc(var(--vh)*100)`/`100dvh`, `overflow:hidden`, `:235`) containing `<PersistentWorld/>` (z0, `:240`),
`<LevelUpOverlay/>`+`<LevelUpWatcher/>` (`:245`), the foreground pages `Box` (z1, keyed on `location.pathname`,
`:252`), and `<TransitionOverlay/>` (z50, `:321`). Dev routes gated on `import.meta.env.DEV`: `/dev/mascot`,
`/dev/round-result`, `/dev/game-intro` (`:306`), `/audit` (`:310`). `?theme=<id>` forces a skin.

Scene (`src/components/common/scene/`):
- `PersistentWorld.tsx` — `immersive = theme.scene.layers.length>0` (`:43`, null for flat skins);
  `inGame = routeKind(pathname)==='game'` (`:45`) → blur7/scale1.06 + dim; drives `useParallax(rootRef,{disabled:
  reduce||inGame})` (`:72`) writing `--parallax-x/y`; **visible-bloom path** `:52-66` → `sectionForPath` →
  `bloomFor(section)` → `bloomExtra = round(stage*2+fill*4)` → `<ThemeScene bloomExtra>`.
- `ThemeScene.tsx` (props `paused?`, `bloomExtra?`) — `loadSceneAssets(themeId)`, renders
  `scene.layers.map` → `<ParallaxLayer spec url index>` (`:75`) + `<AmbientField>` (`:78`) + readability scrim.
- `ParallaxLayer.tsx` (props `spec, url, index`) — `anchor top|bottom|center`; drift
  `translate3d(var(--parallax-x)*depth, …) scale(1.12)`.
- `AmbientField.tsx` — `count = scene.ambient.count + max(0,bloomExtra)` (`:100`); deterministic PRNG by
  `hashSeed(themeId)+count`; CSS sprites when `ambientSprites` empty; `animationPlayState` respects `paused`.
- `useParallax.ts` — `useParallax(ref,{disabled,strength=40})`, rAF, writes CSS vars, no re-render.
- `routeKind.ts` — `routeKind(pathname): 'menu'|'game'` via `SECTION_MENU_PATHS` (`src/utils/menuPaths.ts` =
  `['/','/alphabet','/math','/farver','/english','/ordleg']`); `isHomeRoute` = `'/'`.

Theme/tokens (`src/theme/`): `ThemeProvider.tsx` `useThemeSwitch()`; `themes.ts` registry `[kid,ocean,space,dino]`,
`defaultThemeId='kid'`, `getThemeTokens(id)`; `buildTheme.ts` attaches `scene/materials/transition/categories/
decor/customShadows/titleFontFamily` and `declare module` augments `Theme`; `tokens/types.ts` is the schema
(`SceneTokens` `:99` = `{dark, layers: ParallaxLayerSpec[], ambient:{sprites,count,motion}, mascot:{src,lines[]},
selectorThumb, music?, progressionCompanion?}`; `ParallaxLayerSpec` `:87` = `{src,depth,anchor?,opacity?}`;
`TransitionTokens` `:136`; `TransitionVariant` `:134` = `wave|zoom|leaves|iris|fade`). `tokens/helpers.ts`:
`SECTION_ICONS`, `category(...)`, `gradient3`, `onCardColor`, `emptyScene()`. `config/categoryThemes.ts`:
`getCategoryTheme(id)` reads active tokens; `categoryContent` holds the **authoritative game list** (see below).

Menus/cards: `HomePage.tsx` (`homeCards[5]` `:23`, grid `:174`, `<LivingCard>`→`<Card>` with
`sectionIconImages[id]`, `<ProgressionCompanion size={84}>` header `:168`, Min Bog shelf `:267`, `useIdleAttract`
`:59`, `<ThemeMascot parallaxDepth={0} attract>` `:353`). `GameSelectionLayout.tsx` (props `{categoryId,games}`;
AppBar `<BackButton to="/" variant="menu">` + `<LevelRingMini size={44}>`; grid → `<LivingCard>`→`<Card>` with
`<GameTileIcon id fallbackEmoji>` `:236`; `<ThemeMascot>` `:260`). `LivingCard.tsx`
(`{index,frozen,attract,burstMotion,onActivate}` → `useLivingCard`, tap `sfx.play('card-pop')`+bump+burst).
`useLivingCard.ts` (breatheSx/controls/bump/wiggle, reduced-motion gated). `useIdleAttract.ts`
(`{enabled?,idleMs=8000,onAttract}`). `GameTileIcon.tsx` (`GAME_ICON_IMAGES={}` — **empty**; emoji fallback).
`ThemeMascot.tsx` (`{sx?,onTap?,parallaxDepth=0.45,reaction?,attract?}`; `loadSceneAssets` sprite; parallax ride).
`Mascot.tsx` (in-game, subscribes `mascotBus`; `MascotEvent = welcome|idle|correct|wrong|streak|round|hint|
sticker`). `mascotBus.ts` (`emit/subscribe`). `ThemedBurst.tsx` (`fire()` imperative, `{motionKind,originTop,
count}`). `mascotAnimations.ts` `getTapAnims(themeId)`.

Transitions (`src/components/common/transition/`): `TransitionProvider.tsx` — `useTransitionNav()` →
`navigateWithTransition(to,{replace?})` / `goBack(to)`; phases `idle→covering→revealing`; `descriptor =
theme.transition`; `withUsher = !reduce && forward && routeDepth(to)===2` (`:92`); arrival cue on reveal
(`menu-open` onto menu, `mascotBus.emit('welcome')` onto game). `TransitionOverlay.tsx` — single opaque
`motion.div`, **the panel's `onAnimationComplete` drives the phase** (`:97`); per-variant `initial/coverTo/revealTo`
switch (`:38`, transforms/clip-path only); usher `motion.img` (`:214`). `routeDepth.ts` — `routeDepth(p)` 0/1/2,
`directionFor(from,to)`.

Progression: `progression.ts` (`levelFromXp`, `bloomStage`/`bloomFill`, `BLOOM_STAGE_XP=[0,40,120,260,480]`).
`ProgressionCompanion.tsx` (`{size=96,level?,fill?,stage?,showBadge?,interactive?,celebrating?}`; stages =
`theme.scene.progressionCompanion?.stages ?? ['🌱','🌿','🌷','🌳','🌟']`; SVG ring + face + badge).
`LevelRingMini.tsx` (`{size=46,flourish?,compact?}`; subscribes `xpBus`). Reward moments:
`RoundResultScreen.tsx`, `LevelUpOverlay.tsx`, `StickerReveal.tsx`, `CelebrationEffect.tsx`
(`celebrateTier`: `micro|streak|round|best|sticker|page|levelup|levelup-mini`), `GameIntro.tsx`.

Assets (`src/assets/themes/`): per-world dir (`kid/ocean/space/dino/`) `index.ts` exports `SceneAssets`
`{layers[],ambientSprites[],mascot,selectorThumb}` (`sceneAssets.ts:12`); loader `loadSceneAssets(id)` dynamic-
imports per `loaders` registry (`:22`, keyed kid/ocean/space/dino). `assets/themes/icons/index.ts` →
`sectionIconImages: Record<SectionIconId,url>` (theme-constant section icons, statically bundled).

**Authoritative game list** (`categoryThemes.ts` `categoryContent`) — the icon manifest must cover exactly these
(keyed collision-free, see §6.4; note `memory10`/`memory20` ids repeat across alphabet & math but differ by
route/content — letters vs numbers):

| Section | game `id` | title | route |
|---|---|---|---|
| alphabet | learn | Lær Alfabetet | /alphabet/learn |
| alphabet | quiz | Bogstav Quiz | /alphabet/quiz |
| alphabet | memory10 | Hukommelse 10 | /learning/memory/letters/10 |
| alphabet | memory20 | Hukommelse 20 | /learning/memory/letters/20 |
| math | numbers | Lær Tal | /math/numbers |
| math | counting | Tal Quiz | /math/counting |
| math | addition | Plus Opgaver | /math/addition |
| math | subtraction | Minus Opgaver | /math/subtraction |
| math | comparison | Sammenlign Tal | /math/comparison |
| math | patterns | Hvad Mangler? | /math/patterns |
| math | memory10 | Hukommelse 10 | /learning/memory/numbers/10 |
| math | memory20 | Hukommelse 20 | /learning/memory/numbers/20 |
| colors | laer | Lær Farver | /farver/laer |
| colors | farvejagt | Farvejagt | /farver/jagt |
| colors | farvequiz | Hvilken Farve? | /farver/quiz |
| colors | ram-farven | Ram Farven | /farver/ram-farven |
| colors | nuancer | Nuancer | /farver/nuancer |
| english | listen | Lyt og Find | /english/listen |
| english | word | Find det Engelske Ord | /english/word |
| english | translate | Dansk til Engelsk | /english/translate |
| english | learn | Lær Engelsk | /english/learn |
| ordleg | read | Læs Ordet | /ordleg/read |
| ordleg | spelling | Stav Ordet | /ordleg/spelling |
| ordleg | mic | Sig et Ord | /ordleg/mic |

---

## 6. Technical design

Organized as **workstreams (W1–W10)**. W1 is the reusable spec + primitives; everything else consumes it.
Nothing ships until all land (one cohesive release).

### W1 — Visual-language spec + shared primitives (do first)

The reusable language the whole shell (and, later, games) inherits. Produce these as code + a short doc comment
block in each primitive; the "spec" is the primitives themselves plus this section.

**W1.1 `SceneObject` primitive** — `src/components/common/scene/SceneObject.tsx`. The tactile soft-3D object
that replaces the frosted `<Card>` as the tappable unit.
```ts
interface SceneObjectProps {
  art: string                 // webp url (section object or per-game icon)
  label: string               // Danish label (reinforcement only — never the sole affordance)
  accent: string              // section accent (ring/label/burst tint)
  size?: number | string      // clamp-driven
  index?: number              // phases the idle breathe
  frozen?: boolean            // pause breathe during a wipe / when not foreground
  attract?: boolean           // one-shot wiggle (idle-attract)
  burstMotion: AmbientMotion  // themed particle kind on tap
  shadow?: 'contact' | 'float'// soft grounded contact shadow vs floating
  onActivate: () => void
  sx?: SxProps
}
```
Composition (reuse the flicker-safe nesting from `LivingCard`): outer position box → CSS breathe wrapper
(`useLivingCard` breatheSx) → `motion.div` tap squash (`controls`/`bump`) → `<img>` object + a **separate soft
contact-shadow ellipse** beneath (a blurred radial `Box`, scales down on tap) + label chip below/over + a
`<ThemedBurst>`. Depth via layered `filter: drop-shadow()` + the contact ellipse (NO card frame). Reduced-motion:
static, contact shadow still drawn.
- Keep `LivingCard` for backward-compat, but home/section tiles migrate to `SceneObject`. The **card frame,
  glass, and border are removed** — the object sits directly in the world.

**W1.2 Depth & material tokens** — extend `tokens/types.ts`:
```ts
// on SceneTokens (all optional; defaulted in buildTheme):
homeAnchors?: HomeAnchor[]          // per-theme seating of the 5 section objects (W3)
sectionFocus?: Record<SectionId, SceneFocus>  // per-section camera focus for the push-in / framed menu (W2,W5)
bloomScenery?: BloomSprite[]        // discrete stage-gated scenery sprites (W7)
ambient: { sprites: string[]; count: number; motion: AmbientMotion }  // sprites now MAY be populated

interface HomeAnchor { section: SectionId; xPct: number; yPct: number; scale: number; rotate?: number; depth?: number }
interface SceneFocus { xPct: number; yPct: number; zoom: number }   // where the world re-centers for this section
interface BloomSprite { src: string; minStage: number; xPct: number; yPct: number; depth: number; scale: number }
```
`buildTheme.ts`: default all new fields to sane empties so flat skins & un-updated skins keep working.

**W1.3 Shared depth helpers** — `src/theme/depth.ts`: `softShadow(elevation)`, `contactShadow(color,size)`,
`tiltOnPointer(strength)` (a tiny pointer-tilt hook for objects, `disabled` under reduced-motion / in-game),
reused by `SceneObject`, reward art, and later games. This is the "premium 3D look" delivered in CSS.

**W1.4 Doc:** add a short "Structured World visual language" section to `CLAUDE.md` (Key Architecture) once built,
and a `.claude/rules/` note if the primitives need mandatory-usage rules (defer to session-debrief).

### W2 — Multi-layer parallax worlds (deepen the scene)

Turn each world from one flat image into **2–3 stacked layers** so objects sit *inside* the world.

- Extend each theme's `SceneAssets.layers` (in `src/assets/themes/<id>/index.ts`) + `scene.layers`
  (`ParallaxLayerSpec[]` in the token file) from 1 → **2–3 layers**: `sky/far` (`anchor:'top'` or `'center'`,
  `depth ~0.2`), `mid` (`depth ~0.5`), `near/foreground` (`anchor:'bottom'`, `depth ~0.85`, the ground/shore/
  ledge objects rest on). Index-align assets ↔ token specs (existing `ThemeScene` contract).
- The near layer defines the **resting surfaces** referenced by `homeAnchors` (W3). Draw it with clear seating
  spots (a cloud bank, a shoreline, an asteroid cluster, a mossy ridge).
- `AmbientField` already adds bloom count on top; no change needed there beyond optionally consuming
  `ambient.sprites` (W7).
- **Perf:** ≤3 layers/world; near layer can be the only heavy one; keep each webp within budget (§ asset sizes).
  Parallax is the existing CSS-var rAF (cheap). Freeze on game routes unchanged.

### W3 — Home redesign (5 equal objects seated in the world)

Rework `HomePage.tsx`.
- **Remove** the card grid. Render the 5 section objects as `<SceneObject>` at **per-theme fixed anchors**
  (`theme.scene.homeAnchors`) positioned as `%` over the scene — seated on the near-layer features along a gentle
  arc / balanced scatter. **Fixed positions** (predictable for a non-reader), but **each theme supplies its own
  anchors** so Regnbue seats them on clouds, Havet on the shore, Rummet on asteroids, Dino on ridges/foliage.
- All 5 **equal** — no hero, no "try this" highlight (owner: fully equal). Composition balance is the art
  director's job via the anchors.
- Header keeps the brand lockup; **progress becomes prominent** (W7): the `ProgressionCompanion` grows in size/
  presence; the Min Bog shelf stays but as a small secondary.
- Mascot: `<ThemeMascot>` upgraded to the reactive guide (W6) — greets on load, glances toward objects, beckons
  on idle.
- **Responsive fallback:** below a width/height threshold (phone/portrait), if free anchor placement can't stay
  uncluttered, fall back to a **tactile flowing arrangement** of the same `<SceneObject>`s (objects on a themed
  ground band, wrap-friendly) — never a frosted-card grid. Define one shared fallback, reuse in W4.
- Idle-attract (`useIdleAttract`) retargets to wiggle one `SceneObject` + mascot beckon (reduced-motion off).

### W4 — Section menus redesign (travel into the section's locale)

Rework `GameSelectionLayout.tsx` (covers all 5 section menus).
- The persistent world **stays the same theme world**, but **framed on this section's locale** via
  `theme.scene.sectionFocus[section]` — `PersistentWorld` applies a subtle scene transform (translate/scale toward
  that focus) when `routeKind==='menu' && !isHome`, and a **section accent tint** overlay (from
  `getCategoryTheme(section).accentColor`). This is what makes `/alphabet` feel like a *different place* than
  `/math` without new backdrops.
- The section's **object becomes an enlarged landmark** in the framed scene (e.g. the book rests large in the
  corner), reinforcing "you are in the reading place."
- **Game tiles** become `<SceneObject>`s using the **per-game soft-3D icons** (W-assets / `GameTileIcon`
  registry, now populated) seated on a themed foreground surface (a shelf/ground line), arranged in a
  **count-aware tactile flow** (3–8 games) — orderly and uncluttered, not a rigid frosted grid, not a random
  scatter. Reuse the W3 responsive fallback arrangement.
- Header: keep `<BackButton variant="menu">` (reverse push-in) + `<LevelRingMini>`; restyle to sit lightly on
  the framed scene.
- **Icon registry fix (W4.1):** change `GameTileIcon` lookup + registry key from the bare `game.id` to a
  **collision-free key** (`\`${section}.${id}\`` or the route). Otherwise alphabet `memory10` and math `memory10`
  collide. `GameSelectionLayout` passes the section; the registry is keyed `<section>.<id>`.

### W5 — Cinematic "push-in / travel into a section" transition

Add a new transition variant that focuses the world into the tapped object's locale.
- Extend `TransitionVariant` (`tokens/types.ts:134`) with `'push'`. Add a `case 'push'` in
  `TransitionOverlay.tsx`'s switch (`:38`) — a `scale`+`translate` toward the target's screen position under an
  opaque cover, obeying all flicker rules (transform/clip-path only; opaque panel; world untouched during cover).
- The provider already sets `withUsher`/`forward`/`routeDepth(to)===2`. Extend `navigateWithTransition` to accept
  an **optional focus origin** (the tapped object's anchor screen-rect) so the push aims at the object the child
  touched; fall back to center. Home→section and section→game both use `push` when forward; `goBack` reverses.
- Under the cover, `PersistentWorld` transitions its `sectionFocus` for the destination so the revealed menu is
  already framed on the locale (continuity — the push and the framing agree).
- Per-skin flavor rides the existing motif system (Regnbue sparkle / Havet wave-crest / Rummet warp / Dino
  leaves) on the opaque panel. **Keep ≤0.7s total; tap fast-forwards; reduced-motion → the existing fast opaque
  fade (`reduced:'fade'`).**
- Set each theme's `transition.variant='push'` (or keep the current per-skin variant and layer the focus-push on
  top — implementer's call; simpler is one shared `push` with per-skin motif+color+sfx). Document the choice.

### W6 — Reactive mascot guide (poses + menu reactions)

Make `ThemeMascot` (menu buddy) a warm guide using **~4 baked poses per world** (idle, greet, point, celebrate).
- Add a pose asset set per theme: `SceneAssets.mascotPoses: { idle, greet, point, celebrate }` (new field;
  default to `{idle: mascot}` so un-updated skins still work). Loader unchanged pattern.
- `ThemeMascot` gains a `pose` state and cross-fades poses (opacity swap between two `<img>`s — cheap, flicker-
  safe, no layout change). Extend its `reaction` handling: on **home/section mount** → `greet`; when the child
  hovers/rests near an object (or during idle-attract) → `point` toward it; on level-up/bloom milestone crossing a
  menu → `celebrate`; else `idle`. Bubble copy keeps using existing pools (no new TTS required).
- Optionally let `ThemeMascot` subscribe to `mascotBus` on menus (today only the in-game `Mascot` does) so a
  level-up that lands on a menu makes the guide celebrate. Keep it decoupled from the world layer (flicker rule).
- Reduced-motion: static `greet`/`idle` pose, no beckon.

### W7 — Visible progression (the world grows)

Make progress the emotional spine of home (owner: central & visible). Reuse PRD-01/-04 selectors; add scenery.
- **Companion prominence:** enlarge/foreground `ProgressionCompanion` on home; give each theme a real
  `scene.progressionCompanion.stages` (baked growing-companion art per world, replacing the emoji-plant default)
  — a small stretch asset set (see §asset tiers, tier-2).
- **Bloom scenery:** add `scene.bloomScenery: BloomSprite[]` per theme — discrete soft-3D sprites (flowers/corals/
  stars/ferns) placed at anchors that **fade/pop in as `bloomStage` rises** (read `bloomFor` like `PersistentWorld`
  already does). `PersistentWorld` renders those whose `minStage ≤ current stage` for the active section (home =
  max across sections), on the near/mid layer, appearing statically under reduced-motion. This upgrades today's
  "extra ambient count" into **recognizable, earned scenery**.
- **Section landmarks bloom:** the section's enlarged landmark object (W4) gains small bloom accents at higher
  stages (token-driven, reuse `bloomScenery` filtered by section focus).
- Monotonic + persisted (existing store) → the child returns to a world *they* grew.

### W8 — Reward-moment polish

Re-skin, don't re-architect, the existing choreographies (they already read tokens + reduced-motion).
- `RoundResultScreen`, `LevelUpOverlay`, `StickerReveal`, `GameIntro`: adopt the new `SceneObject`/depth helpers
  for their art, ensure they sit in the framed world language, and use the new mascot `celebrate` pose. Keep the
  existing beat timelines, fast-forward, and `celebrateTier` tiers.
- `GameIntro` "Er du klar? … Kør!" curtain: align its look to the destination section's locale/accent (it already
  takes `categoryId`).
- No new tiers, no new reward mechanics — visual coherence only.

### W9 — Menu ambient audio + reactive SFX

- **Ambient bed:** a low-volume per-world ambient loop on **menu surfaces only** (like `musicClient`'s menu-only
  rule), layered *under* the existing music. Add a small ambient channel (extend `musicClient` with a second
  looping element, or a dedicated `ambientClient`) — **separate from TTS**, honoring `settings.musicEnabled`
  (and/or a new `settings.ambientEnabled`; default follow music). New audio assets: 4 short seamless loops
  (`/sounds/ambient/<id>.mp3`). Fades out entering a game (reuse the music fade rule).
- **Reactive SFX:** reuse/extend `sfxClient` cues — object-tap pop, arrive-chime (`menu-open`), a soft **bloom
  cue** when new scenery appears, push-in travel cue (per-skin, already exists). Respect `settings.sfxEnabled`,
  never route through `SimplifiedAudioController`. Keep cues short (full-file playback).
- **Calm-alive:** ambient is quiet and non-looping-obvious; SFX are tactile, not busy.

### W10 — Peripheral surfaces

- **Album (Min Bog / `StickerAlbum.tsx`):** restyle as a treasured collection inside the world (stickers seated on
  themed shelves/pages with depth), not a flat grid. Keep the data model (`stickers.ts`) untouched.
- **Adult corner / dialogs (`AdultCorner`, `VoiceOverridePanel`, `DifficultyPanel`, `BugReportDialog`):** light
  polish only — consistent surfaces/typography with the new language; these are adult-facing, low priority. No
  behavior change.
- **Game-entry beat:** covered in W8.

---

## 7. Tokens & type changes (concrete)

`src/theme/tokens/types.ts` — extend `SceneTokens` with the optional fields in W1.2 (`homeAnchors`,
`sectionFocus`, `bloomScenery`, populated `ambient.sprites`, `progressionCompanion` art). Add `mascotPoses` to
`SceneAssets` (`src/theme/sceneAssets.ts`). Add `'push'` to `TransitionVariant`.
`src/theme/buildTheme.ts` — default every new field (empty arrays / `{idle: mascot}` / etc.) so flat &
un-updated skins are unaffected. `src/theme/tokens/{kidTheme,ocean,space,dino}.tokens.ts` — author
`homeAnchors` (5 each), `sectionFocus` (5 each), `bloomScenery`, extra `layers`, `mascotPoses`,
`progressionCompanion` per theme. Educational color content stays data (untouched).

---

## 8. Assets & the Gemini generation loop

**This is the manual work.** All art is baked soft-3D WebP, generated by the owner in **Gemini (2.5 Flash Image /
"Nano Banana")**, reviewed together, and integrated. Full prompt appendix in **Appendix B**.

### 8.1 The loop (per batch)
1. Implementer (a build session) requests **one batch** (from Appendix B) and pastes the prompts here.
2. Owner generates in Gemini, **uploading the existing `mascot.webp` / `scene.webp` for that theme as a style/
   character reference** so nothing drifts, iterates until happy, downloads.
3. Owner drops files into the batch's target dir; implementer runs the **processing step** (background removal if
   needed + resize + `cwebp` compress to target size), wires them into `index.ts` / registries / tokens, and
   screenshots via `ui-screenshot`.
4. Repeat per batch. When all batches are in and wired, the release ships.

### 8.2 Style guide (global — every prompt appends this)
> *Soft-3D "claymation / Pixar-lite" render. Rounded, smooth matte clay-like surfaces, gentle soft studio
> lighting with a soft top-left key light and a subtle rim light, soft ambient occlusion, soft contact shadow.
> Warm, friendly, calm, child-safe — nothing scary, no sharp teeth, no dark or startling elements. Slight 3/4
> top-down camera, centered, generous margin, single isolated subject, no text, no words, no letters unless
> explicitly requested. Consistent scale and lighting across the set. Isolated on a transparent background (or a
> flat solid #00FF00 background for clean cut-out). High detail, high quality.*

Reference-image discipline: for **mascot poses** and **per-world scenes**, upload that theme's existing
`mascot.webp`/`scene.webp` as the first reference and prompt *"keep the same character/world, same style and
palette."* For the **theme-constant section objects and game icons**, upload the existing
`assets/themes/icons/*.webp` set as style references so all icons match each other.

### 8.3 Asset manifest (tiered so the loop can batch)

**Tier 1 — core (required for the release):**
| Batch | Assets | Count | Target dir | Notes |
|---|---|--:|---|---|
| B1 Section objects | book, abacus, palette, globe, speech-bubble (theme-constant) | 5 | `src/assets/themes/icons/` | Regenerate the 5 section icons at hero fidelity; double as home objects + menu landmarks |
| B2 Game icons | one soft-3D icon per distinct game concept (§5 table) | ~22 | `src/assets/themes/icons/games/` | Theme-constant; keyed `<section>.<id>`; memory letters vs numbers distinct |
| B3 World layers | far/mid/near per theme × 4 | ~10–12 | `src/assets/themes/<id>/` | Near layer must show clear resting surfaces for `homeAnchors` |
| B4 Mascot poses | idle, greet, point, celebrate × 4 worlds | 16 | `src/assets/themes/<id>/` | Use existing `mascot.webp` as reference per world |

**Tier 2 — enrichment (in the same release; generate after Tier 1 is wired):**
| Batch | Assets | Count | Notes |
|---|---|--:|---|
| B5 Bloom scenery | ~3–4 sprites × 4 worlds (flower/coral/star/fern etc.) | ~12–16 | Stage-gated `bloomScenery` |
| B6 Companion stages | ~4–5 growth stages × 4 worlds | ~16–20 | Replaces emoji-plant `progressionCompanion` |
| B7 Ambient sprites | ~2–3 drifting sprites × 4 worlds | ~8–12 | Optional upgrade of CSS ambient |

Rough total: **~55 (Tier 1)** + **~40 (Tier 2)** ≈ **~95 renders**. Big but front-loaded and batchable; Tier 1
alone delivers the transformed feel if Tier 2 slips.

### 8.4 Processing / sizing conventions
- Objects & icons: square, subject centered, export **512–768 px** webp, target **≤40 KB** each (match today's
  ~55 KB icon budget across the set). Transparent alpha.
- Scene layers: landscape, **~2048×1280** max, webp **≤180 KB** each; near layer may carry alpha where the
  foreground is cut out.
- Background removal (if Gemini leaves a bg): any bg-remover or the green-key; then `cwebp -q 82` (or Squoosh).
- Keep filenames stable and lowercase-kebab; register in the theme's `index.ts` and the icon registry.

---

## 9. Danish copy

Non-verbal-first. No new **closed-set TTS narration is required** by this PRD (mascot uses existing bubble pools;
level-up praise already exists from PRD-01/04). Labels reused verbatim from `categoryContent` (§5 table) and
`SECTION_ICONS`. **If** the optional spoken home greeting (proposed default: off) is adopted, it is a new
closed-set clip → must go through `npm run tts:prebake` + `/audit` (see `.claude/rules/audio-system.md`) — call
it out in that session, don't add it silently.

---

## 10. Files to touch

**Create**
- `src/components/common/scene/SceneObject.tsx` — the tactile object primitive (W1.1).
- `src/theme/depth.ts` — soft/contact-shadow + pointer-tilt helpers (W1.3).
- `src/services/ambientClient.ts` (or extend `musicClient.ts`) — menu ambient bed (W9).
- `public/sounds/ambient/{kid,ocean,space,dino}.mp3` — ambient loops (W9, owner-sourced/royalty-free).
- Asset dirs/files per Appendix B (`src/assets/themes/icons/games/*`, extra layers + poses under
  `src/assets/themes/<id>/`, bloom/companion/ambient sprites).

**Edit**
- `src/theme/tokens/types.ts` — `HomeAnchor`/`SceneFocus`/`BloomSprite`, extend `SceneTokens`, add `'push'`.
- `src/theme/sceneAssets.ts` — `mascotPoses` + new layer/sprite fields on `SceneAssets`.
- `src/theme/buildTheme.ts` — default all new fields.
- `src/theme/tokens/{kidTheme,ocean,space,dino}.tokens.ts` — author anchors/focus/scenery/layers/poses/companion.
- `src/assets/themes/{kid,ocean,space,dino}/index.ts` — import + export new layers/poses/sprites.
- `src/assets/themes/icons/index.ts` — hero section objects + a `gameIconImages` map keyed `<section>.<id>`.
- `src/components/common/GameTileIcon.tsx` — key by `<section>.<id>`, consume `gameIconImages`.
- `src/components/home/HomePage.tsx` — objects-seated-in-world layout + prominent progress + reactive mascot (W3).
- `src/components/common/GameSelectionLayout.tsx` — framed locale + landmark + `SceneObject` game tiles (W4).
- `src/components/common/scene/PersistentWorld.tsx` — `sectionFocus` framing/tint on section menus; render
  `bloomScenery` (W2/W4/W7).
- `src/components/common/scene/ThemeScene.tsx` / `AmbientField.tsx` — consume extra layers + `ambient.sprites`.
- `src/components/common/transition/{TransitionProvider,TransitionOverlay}.tsx` — `push` variant + focus origin (W5).
- `src/components/common/ThemeMascot.tsx` — pose cross-fade + guide reactions (W6).
- `src/components/common/ProgressionCompanion.tsx` — baked companion art per theme (W7).
- `src/components/common/{RoundResultScreen,LevelUpOverlay,StickerReveal,GameIntro}.tsx` — depth/language polish (W8).
- `src/components/hub/StickerAlbum.tsx` — collection-in-the-world restyle (W10).
- `src/services/sfxClient.ts` — bloom cue (+ any new cues).
- `src/components/dev/DevRoutes.tsx` — add a `/dev/scene?theme=&section=` harness to preview home/section framing,
  seating, bloom stage, and the push-in in isolation (see §11).

**Reuse (don't reinvent):** `useLivingCard`, `ThemedBurst`, `useIdleAttract`, `useParallax`, `loadSceneAssets`,
`getCategoryTheme`, `bloomFor`/`progression.ts`, `celebrateTier`, `mascotBus`, `useTransitionNav`, `BackButton`,
`LevelRingMini`.

---

## 11. Verification

- `npm run dev` + `npm run dev:api` (**Windows PowerShell**, never WSL — project memory). `npm run build` +
  `npm run lint` clean.
- New dev harness `/dev/scene?theme=<id>&section=<s>&bloom=<0..4>` to preview seating/framing/bloom/push-in per
  skin without playing through. Also drive real routes with `?theme=<id>`.
- With `ui-screenshot` on an iPad viewport, **for each of the 4 skins**:
  - **Home:** 5 objects seated in the world (not a grid), balanced + uncluttered, objects cast contact shadows,
    world parallaxes behind/around them, companion/level prominent, mascot greets then beckons on idle (~8s).
  - **Home → section:** cinematic push-in ≤0.7s aimed at the tapped object; section menu framed on that locale
    with accent tint + enlarged landmark; game tiles are soft-3D `SceneObject`s (icons present, no bare emoji);
    **no white-flash / no fixed-layer blank** (the load-bearing regression check). Test press-hold + touch-pan
    near a transition.
  - **Section → game → back:** push-in/reverse work; back button reverses; arrival SFX fire.
  - **Bloom:** seed XP (`window.__progress.grantXp`) and confirm scenery/companion visibly grow; new-scenery bloom
    cue plays.
  - **Reduced-motion:** transitions become fast fades; breathe/parallax/idle-attract off; scene frozen; objects &
    art & contact shadows still render; navigation + reward + audio intact; no console errors.
  - **Phone/portrait (844×390, 667×375):** the responsive fallback arrangement holds (tactile objects, never a
    frosted grid), no scroll, 44px targets.
- **Real iOS standalone PWA** pass for the push-in transition + scene framing (device-specific fixed-layer/
  touch-pan behavior).
- Perf sanity on the target iPad: ≤3 scene layers/world, capped bursts, `will-change` cleared at idle, no rAF
  during game routes (scene frozen).

---

## 12. Open items for owner sign-off (proposed defaults in brackets)

1. **Mascot name & voice** — [un-named; existing bubble pools; no new TTS]. Want a name / a short spoken greeting?
2. **Section menu backdrops** — [reuse the theme world, focused per-section + accent tint + enlarged landmark]
   vs bespoke per-section backdrops (≈24 more scenes — not recommended).
3. **Push-in variant** — [one shared `push` focus with per-skin motif/color/sfx] vs keeping each skin's current
   distinct wipe and layering focus on top.
4. **Ambient audio** — [add a quiet per-world loop + `settings.ambientEnabled` following `musicEnabled`]. OK to
   source 4 royalty-free loops, or skip ambient and keep only reactive SFX?
5. **Tier-2 assets** — [include B5–B7 in this release]. If your Gemini time is tight, are you fine shipping Tier 1
   first and folding Tier 2 in shortly after (still one visible release, just a two-step asset loop)?
6. **Album depth** — [restyle to collection-in-the-world]. In scope for launch or acceptable as a fast-follow?

---

## Appendix A — Verbatim signatures / anchors (implement with near-zero exploration)

*(Condensed; expand from §5 grounding. All line numbers are current-tree references.)*

```
App.tsx: <TransitionProvider>(206) → host Box(235, relative, 100dvh, overflow:hidden) →
  <PersistentWorld/>(240,z0) · <LevelUpOverlay/>+<LevelUpWatcher/>(245) · pages Box(252,z1,key=pathname) ·
  <TransitionOverlay/>(321,z50). Dev routes gated import.meta.env.DEV (306). ?theme=<id> forces skin.

SceneTokens (tokens/types.ts:99): { dark:boolean; layers:ParallaxLayerSpec[]; ambient:{sprites:string[];
  count:number; motion:'rise'|'fall'|'drift'|'twinkle'}; mascot:{src;lines:string[]}; selectorThumb:string;
  music?:string; progressionCompanion?:{stages:string[]; ringColor:string} }
ParallaxLayerSpec(:87): { src:string; depth:number; anchor?:'top'|'bottom'|'center'; opacity?:number }
SceneAssets (sceneAssets.ts:12): { layers:string[]; ambientSprites:string[]; mascot:string; selectorThumb:string }
  loadSceneAssets(id) dynamic-imports assets/themes/<id> per loaders registry(:22); hasSceneAssets(id).
TransitionVariant(:134): 'wave'|'zoom'|'leaves'|'iris'|'fade'  (add 'push')
TransitionTokens(:136): { variant; color(opaque); direction:'up'|'down'|'left'|'right'|'in'; coverMs; revealMs;
  ease; sfx:SfxCue; motif?; reduced:'fade'|'none' }

useTransitionNav(): { navigateWithTransition(to:string,{replace?}):void; goBack(to:string):void }
TransitionProvider: phases idle→covering→revealing; descriptor=theme.transition; withUsher=!reduce && forward &&
  routeDepth(to)===2 (:92); reveal cue: menu→sfx 'menu-open', game→mascotBus.emit('welcome').
TransitionOverlay: single opaque motion.div; panel.onAnimationComplete drives phase (:97); switch on variant(:38)
  gives initial/coverTo/revealTo (transform/clip-path only). usher motion.img(:214).
routeDepth(p): 0 home /1 section /2 game; directionFor(from,to).

PersistentWorld: immersive=theme.scene.layers.length>0(:43,null if flat); inGame=routeKind==='game'(:45);
  useParallax(rootRef,{disabled:reduce||inGame})(:72); bloom path :52-66 (sectionForPath→bloomFor→
  bloomExtra=round(stage*2+fill*4)→<ThemeScene bloomExtra>). ThemeScene(paused?,bloomExtra?) renders
  scene.layers.map→<ParallaxLayer spec url index>(:75)+<AmbientField>(:78). routeKind via SECTION_MENU_PATHS
  (utils/menuPaths.ts).

SceneObjectProps / HomeAnchor / SceneFocus / BloomSprite: defined in W1.1/W1.2 above (new).

LivingCard props: {index,frozen?,attract?,burstMotion:AmbientMotion,onActivate,sx?,children}. useLivingCard
  ({index,frozen})→{breatheSx,controls,bump,wiggle}. ThemedBurst ref.fire(); {motionKind,originTop?,count?}.
useIdleAttract({enabled?,idleMs=8000,onAttract}). GameTileIcon({id,fallbackEmoji}) — GAME_ICON_IMAGES={} (empty;
  RE-KEY to <section>.<id>).
ThemeMascot props: {sx?,onTap?,parallaxDepth=0.45,reaction?,attract?}. Mascot subscribes mascotBus; MascotEvent=
  welcome|idle|correct|wrong|streak|round|hint|sticker. getTapAnims(themeId).

progression.ts: levelFromXp(xp), bloomStage(xp)0..4, bloomFill(xp)0..1, BLOOM_STAGE_XP=[0,40,120,260,480].
ProgressionCompanion({size=96,level?,fill?,stage?,showBadge?,interactive?,celebrating?}); stages default
  ['🌱','🌿','🌷','🌳','🌟']. LevelRingMini({size=46,flourish?,compact?}) subscribes xpBus.
celebrateTier tiers: micro|streak|round|best|sticker|page|levelup|levelup-mini. sfxClient cues (current):
  tap|pick-up|spring-back|chomp|match|correct|wrong|drop-snap|flip|streak-up|star|sticker-reveal|round-complete|
  page-complete|card-pop|nav-whoosh|nav-wave|nav-warp|nav-stomp|menu-open|back. sfx.play(cue,{rate?,volume?}).

categoryContent (categoryThemes.ts:45): authoritative game list — see §5 table. getCategoryTheme(id):
  {id,name,gradient,accentColor,onCardColor,tileSurface,borderColor,hoverBorderColor,icon,iconSize,description,
  games:[{id,title,emoji,route,gradient}]}.
Registered themes: kid(Regnbue,light,drift,iris), ocean(Havet,light,rise,wave), space(Rummet,DARK,twinkle,zoom),
  dino(Dinosaurer,light,fall,leaves). jungle/candy unregistered.
```

## Appendix B — Gemini prompts (copy-paste; append the §8.2 style guide to every one)

> Owner: upload the relevant existing reference image(s) first (§8.2), then paste. Regenerate until the set looks
> consistent. Request transparent background; if not clean, use a flat green background for cut-out.

### B1 — Section objects (theme-constant, ×5) → `src/assets/themes/icons/`
- **Alfabetet:** *"A friendly stack of 3–4 chunky children's picture books, spines facing out, soft rounded
  corners, cheerful primary-pastel covers, no readable text on them."*
- **Tal (math):** *"A cute wooden toy abacus with a few rows of colorful rounded beads, chunky friendly frame."*
- **Farver:** *"A rounded artist's paint palette with soft blobs of rainbow paint and a stubby friendly brush
  resting on it."*
- **Engelsk:** *"A happy little globe of the Earth on a tiny stand, soft continents, gentle glossy highlight."*
- **Ordleg:** *"A plump rounded speech bubble with a friendly small smile/spark inside, no letters or text."*

### B2 — Game icons (theme-constant, ×~22) → `src/assets/themes/icons/games/`, keyed `<section>.<id>`
Append the style guide; each a single small soft-3D object, matching the B1 set's scale/light. Subjects:
- `alphabet.learn`: *stack of ABC blocks spelling nothing, one block shows a friendly star* · `alphabet.quiz`:
  *a single glossy target/bullseye with a soft star* · memory (letters): *two rounded face-down memory cards, one
  flipping to show a friendly star* (reuse for memory10/20 letters).
- `math.numbers`: *three chunky colorful number blocks (shapes, not specific digits)* · `math.counting`: *a small
  pile of countable rounded gems/dots* · `math.addition`: *a soft glossy plus sign* · `math.subtraction`: *a soft
  glossy minus sign* · `math.comparison`: *a cute balance scale, slightly tipped* · `math.patterns`: *a jigsaw
  puzzle piece with one gap* · memory (numbers): *two memory cards, one flipping to show a friendly number-ish
  spark* (reuse for memory10/20 numbers — distinct from letters memory).
- `colors.laer`: *a soft rainbow arc* · `colors.farvejagt`: *a magnifying glass over a colorful spot (a hunt)* ·
  `colors.farvequiz`: *a friendly question mark made of colorful segments* · `colors.ram-farven`: *a paint bucket
  tipping a splash of color at a target* · `colors.nuancer`: *a gradient swatch fan going light→dark of one hue*.
- `english.listen`: *a friendly ear with soft sound waves* · `english.word`: *a card showing a simple picture (a
  cat) with a soft spark, no text* · `english.translate`: *two speech bubbles with a soft swap arrow between* ·
  `english.learn`: *a book with a tiny globe resting on it*.
- `ordleg.read`: *an open picture book with a soft spark* · `ordleg.spelling`: *a friendly pencil writing a soft
  swirl (no letters)* · `ordleg.mic`: *a chunky cute microphone with a soft sound spark*.

### B3 — World layers (×~3 per theme) → `src/assets/themes/<id>/`
For each theme upload the existing `scene.webp` as reference: *"Keep this exact world, style, and palette. Split
it into parallax layers."* Then per layer:
- **far/sky:** *"just the sky and most-distant elements of this world, full-bleed, no foreground."*
- **mid:** *"the mid-distance scenery of this world (hills/reefs/nebulae/tree-line), transparent where sky shows."*
- **near/foreground:** *"the near foreground of this world with clear flat resting surfaces where objects can sit
  (a cloud bank for Regnbue / a shoreline sandbar for Havet / a cluster of asteroids for Rummet / a mossy ridge
  for Dinosaurer), transparent above the surface line."*
(Per-world flavor: Regnbue = bright rainbow sky + soft clouds; Havet = sunny underwater/seaside blues + coral;
Rummet = deep starry space + planets (dark world); Dinosaurer = lush prehistoric jungle + friendly ferns.)

### B4 — Mascot poses (×4 per theme) → `src/assets/themes/<id>/`
Upload that world's existing `mascot.webp` as reference: *"Same character, same style and colors, full body,
transparent background."* Poses:
- `idle`: *"standing relaxed, gentle friendly smile, looking forward."*
- `greet`: *"waving one paw/hand happily, welcoming, big warm smile."*
- `point`: *"pointing to the side with one arm, curious happy expression, inviting you to look."*
- `celebrate`: *"arms up cheering, joyful, tiny sparkles around (sparkles optional)."*

### B5–B7 — Tier-2 (bloom scenery, companion growth stages, ambient sprites)
Small single soft-3D sprites per world, style guide appended, transparent bg:
- **B5 bloom scenery:** Regnbue *tiny flower / sparkle-star / soft cloud puff*; Havet *little coral / seashell /
  starfish*; Rummet *tiny planet / comet / star cluster*; Dinosaurer *fern sprout / friendly egg / small
  mushroom*.
- **B6 companion stages** (a growing creature per world, 4–5 stages seed→full, consistent character across
  stages — upload stage N as reference for stage N+1): Regnbue a sprouting rainbow-plant; Havet a growing coral/
  pearl; Rummet a growing little star/planet; Dinosaurer a hatching→growing dino sprout.
- **B7 ambient sprites:** 2–3 drifting motes per world matching `ambient.motion` (drift/rise/fall/twinkle).

---

*End of PRD. Implement in a fresh session per the roadmap's execution guide; run the asset loop (§8) in batches;
ship as one cohesive release.*
