# Liveliness PRD-06 — Games Visual Uplift: Foundation (keystone)

**Date:** 2026-07-16
**Part of:** Liveliness & Journey Overhaul (see `plans/liveliness-overhaul/tmp-prd-liveliness-00-roadmap.md`).
This is the **"later pass"** that PRD-05 §Scope explicitly deferred: *"Shell + a reusable visual-language
spec games inherit in a later pass."* PRD-05 re-skinned the SHELL (home + 5 section menus + transitions +
rewards + mascot) into "The Structured World." This sub-program brings the **game boards** up to that same
standard.
**Depends on:** PRD-01/-02/-03/-04/-05 shipped (persistent world, transition system, `SceneObject`, `depth.ts`,
`mascotBus`, progression/bloom, reward moments, themed wipes all exist). This PRD **consumes and extends** them.
**Owner:** Allan (parent). **Target user:** one ~5-year-old boy, iPad-primary, **pre-reader** (nothing may gate
play behind reading; never slow him down; nothing scary/over-stimulating).

> **This is the KEYSTONE of a small program.** Implement it FIRST. It defines Step 0 (remove the game-entry
> beat) + the shared visual language every area inherits (the tactile-tile primitive, the focal-zone dissolve,
> in-game world presence, HUD unification, and the baked-art conventions). The per-area uplift PRDs
> (`-07` Alphabet → `-08` Math → `-09` Farver → `-10` Ordleg → `-11` English) each consume this foundation's
> named APIs and add that area's baked-art batch + per-game rework. See §"Program structure & order".

---

## 1. Context — why the games lag the shell

PRD-05 turned home + the 5 section menus into a lush, tactile, per-skin **Structured World**: soft-3D baked-WebP
objects that **rest in the world** on grounding light-pools + soft contact shadows, a multi-layer parallax
backdrop, a reactive mascot guide, themed push-in framing, visible bloom. The menus feel hand-made and alive.

The **games did not get this pass.** They got an *interaction-language* pass earlier (PRD-03: entry beat,
unified back button, mascot reactions, tap SFX, live XP), but their **boards, tiles, backdrops, and prompt art
still read as "standard app."** Stepping from a section menu into a game is a visible production-value cliff.

**Grounded in reality this session** (screenshots, iPad viewport): the `math` (Rummet) menu is game-objects
seated around a ringed planet with an astronaut-mascot; entering `math/counting` drops you onto flat white cards
floating over a *dimmed blur* of that same planet. The `alphabet/quiz` board is a big white frosted-glass
rectangle holding a **flat 2D system emoji** apple + keyboard-key answer tiles — mounted over the freshly-lush
menu you just left.

**The core finding: the app now carries THREE material vocabularies, and the games use the two weaker ones.**

| Vocabulary | Where today | Look |
|---|---|---|
| **Frameless clay object** (shell / PRD-05) | Home + section menus (`SceneObject`) | Cut-out soft-3D WebP **resting** on a soft *contact-shadow ellipse* + a grounding *light-pool*; **no frame/border**; baked art. Objects live *in* the world. |
| **Lifted plastic button** | `AnswerTile`, Memory cards, `MathOperationGame`, `FarveQuiz` object tile | Gradient fill + `3px` accent border + a hard `0 8px 0` colored **bottom lip** + press-travel. Reads as a keyboard key. Already "3D" — but a *different, harder* 3D than the shell. |
| **Flat candy / glossy** | `Farvejagt` tiles, `RamFarven` droplets, the `SpeakWord` mic orb, color swatches | Solid-color fills, single diagonal sheen, generic `boxShadow: 3` — **ungrounded** (no contact shadow, no lip). The flattest surfaces in the app. |

On top of the tile mismatch, four things read "standard app" the instant a game opens:
1. **The big white frosted `PromptStage` card** (`backdrop-filter: blur(12px)`, translucent paper, diffuse
   `0 8px 32px` shadow) — nothing in the menu language looks like it. The #1 offender.
2. **Flat 2D system emoji** for every prompt/object subject — a jarring downgrade from the baked soft-3D art the
   child saw one tap earlier.
3. **The world goes dim + blur + occluded** — the alive world is scrimmed and then covered by the white card.
4. **HUD holdouts** — `RepeatButton` ("Hør igen") is a plain MUI `boxShadow:2/4` button; `ScoreChip` is a flat
   glowing pill; two files still carry the legacy hardcoded `#ECF1F8` tile gradient.

**Success looks like:** the son taps a game object in a menu, the themed wipe carries him in, and the game board
feels like *the same hand-made place* — the calm world still softly present behind, the question's subject a
tactile soft-3D thing resting in it, answer tiles that feel like pressable clay (not app buttons), one coherent
HUD sitting lightly on the world — **with the letter/number as clear and focused as it is today, or clearer.**

### Learning-first guardrail (overrides everything below)

The **learning experience of each game comes first.** Never let visual polish or motion reduce a game's clarity,
readability, focus, or pedagogy for a pre-reader. Specific commitments this session:
- The answer tiles' **clear "I can press this" affordance** (press-travel, obvious tappable shape) is *good
  pedagogy* and is **kept** in the new primitive — we change the material, not the affordance.
- **Glyphs stay type.** Letters and numerals on tiles/prompts are the *content being taught* (recognizing the
  letterform / numeral IS the lesson). They are **never** replaced by baked art. Only **pictorial subjects**
  (the apple, the color objects, counting objects, English vocab) become baked soft-3D WebP.
- Dissolving the focal card must not weaken "where do I look" — the subject stays large, centered, and lit by
  its own grounding pool, and the world behind is **frozen and quiet** so it never competes.
- If any re-skin idea and a game's learning goal conflict, **the learning goal wins**, and the per-area PRD flags
  the trade-off to the owner.

## 2. Decision log (locked with the owner 2026-07-16 — do not re-litigate)

| # | Decision | Choice |
|---|---|---|
| Ambition | light polish vs full re-skin vs comprehensive uplift | **Comprehensive uplift** — every game brought up to shell level; shared solutions where possible, per-game rework where needed; larger workload accepted |
| Game-entry beat | keep vs remove | **REMOVE** the "Er du klar? … Kør!" `GameIntro` beat + all its wiring, as **Step 0**; build the new game experience from that clean baseline |
| World presence during play | focused/dimmed vs calm-present vs full-immersion | **Calm-present & grounded** — ease the dim/blur so the world stays softly visible, ground the game's own elements IN it (contact shadows), but keep it **frozen/quiet** so it never competes with the content |
| Material strategy | adopt `SceneObject` vs new primitive vs re-skin-in-place | **New shared "tactile-tile" primitive** — pressable (press-travel kept) but clay-material + grounded contact shadow, no keyboard lip / heavy border; unifies answer tiles, memory cards, drag tiles, swatches, and the "Lær" browse |
| Focal zone (the `PromptStage` card) | restyle vs dissolve vs keep | **Dissolve into the world** — remove the frosted panel; the prompt subject rests directly in the calm world on its own grounding light-pool, "Hør igen" a floating pill beneath |
| Prompt/object art | emoji-in-holders vs curated subset vs full baked-art | **Full baked-art replacement** of all *pictorial* subjects (glyphs stay type); baked soft-3D WebP via the PRD-05 Gemini green-screen pipeline |
| Menu→game wipe | keep vs remove vs simplify | **Keep** the themed per-skin wipe (no white flash; themed travel). Separate system from the removed `GameIntro`. |
| Motion/juice ceiling | calm vs balanced vs lively | **Balanced** — tactile press on every tap, one soft pop + few sparkles on correct, gentle shake on wrong, celebrations reserved for real milestones (streak/round/level-up). Softer/clay-like versions of today's amount. |
| HUD unification | full vs light | **Fully unify** — "Hør igen", `ScoreChip`, level ring, back button share the tactile soft-3D language and sit lightly on the world (also fixes the legacy MUI button + `#ECF1F8`) |
| Art sequencing | progressive (emoji-interim) vs art-gated | **Art-gated per area** — an area ships only once its baked-art batch is ready (no emoji-in-holder interim); the FOUNDATION itself needs no per-area art and ships first |
| Performance | match PRD-05 vs conservative | **Match PRD-05** — recent iPad (2021+), generous-but-disciplined; scene frozen in-game, capped FX, `will-change` cleared at idle, baked WebP within size budgets |
| Audio scope | SFX-only vs strictly-visual vs new-narration | **SFX polish only** — reuse/extend existing `sfxClient` cues for the new tactile feedback; **no new spoken narration** (no prebake/`/audit` cycle); existing TTS untouched |
| PRD structure | one PRD vs full-upfront vs small-program-JIT | **Small program, JIT areas** — this Foundation + `-07` Alphabet now; areas 2–5 authored just-in-time so each absorbs play-test learnings |
| Area order | | **Alphabet → Math → Farver → Ordleg → English** |

## 3. Guardrails (repeated for self-containment)

- **iPad-first**, fully responsive, **no-scroll full-viewport** (`.claude/rules/responsive-design.md`); **min 44px**
  touch targets; **Danish** child-facing copy; **Comic Sans MS** for child-facing type.
- **Token-driven theming only** — read via `useTheme()` / `getCategoryTheme(id)`; never hardcode colors. Works on
  **all 4 registered skins** (Regnbue/Havet/Rummet-dark/Dinosaurer) **and flat/unregistered skins**, portrait +
  landscape. **Educational colors** (Farvejagt/RamFarven content) stay as data, never themed.
- **Reduced-motion respected on every new animation** — motion removed, but **layout, art, reward, and audio are
  kept** (contact shadows + light-pools + baked art still render; `useReducedMotion()` gates the motion).
- **Audio rules** (`.claude/rules/audio-system.md`): one TTS at a time, no queue; SFX a separate short channel via
  `sfxClient`, never routed through `SimplifiedAudioController`. **This PRD adds no new closed-set narration.**
- **No adaptive difficulty** (standing constraint) — nothing here touches content generation or XP fairness.
- **Compositing-flicker discipline** (LOAD-BEARING — see PRD-02 §"Flicker rules" / PRD-05 §4): opaque transition
  overlays only; the transform/clip-path animates, never page opacity; **never `backdrop-filter` on a moving
  layer**; `will-change` set only during animation and cleared at idle. Verify on **real iOS standalone PWA**.
- **Visual quality floor:** every re-skinned surface must **match or exceed** the shell's Structured-World look;
  never regress it.
- **Learning-first** (§1) beats all of the above where they conflict.

## 4. North star for a game board (the target, described so a fresh session can build it)

When a game mounts (after the themed wipe lifts):
- The **persistent world is still there**, softly visible and **frozen** — not the heavy blur+dim of today, but a
  gentle readability veil so the content pops while the *place* remains felt. (F3.)
- The **question's subject rests in that world** — a baked soft-3D object on a grounding light-pool + soft contact
  shadow, exactly like a `SceneObject` on the menu — **not** inside a white frosted card. "Hør igen" is a floating
  themed pill beneath it. (F2.)
- The **answer tiles are tactile clay** — the shared `TactileTile` primitive: a soft matte surface, a grounded
  contact shadow, a satisfying press-travel, correct/wrong/hint feedback in the balanced motion register — **not**
  bordered keyboard keys, **not** flat candy stickers. Glyph content (letters/numbers) stays crisp type; pictorial
  content is baked art. (F1.)
- The **HUD sits lightly on the world** — one coherent soft-3D family for "Hør igen", score, the level ring, and
  the back button. (F4.)
- **Feedback is balanced** — every tap felt (`sfx('tap')` + press-squash), correct = soft pop + a few sparkles,
  wrong = gentle shake, milestones escalate via the existing `celebrateTier` tiers. (Motion ceiling.)
- **The mascot** stays the reactive corner buddy (bus-driven), unchanged mechanically; because the world calms, it
  reads a touch more present. No new mascot work in this PRD.

## 5. Technical design — foundation workstreams (F0–F6)

> Nothing here is area-specific. F0 unblocks the clean baseline; F1–F5 are the reusable language; F6 defines how
> the per-area PRDs consume it. Build F0 first, then F1–F4 can proceed in parallel, F5 is a conventions doc + a
> reusable processing recipe (no new runtime code beyond an art loader pattern).

### F0 — Remove the game-entry beat ("Er du klar? … Kør!") — do this FIRST

Rip out `GameIntro` and all its wiring so the board simply appears when the screen arrives. The board's own
`gameReady`/audio-welcome timing is **independent** of the curtain and stays exactly as-is (removing the curtain
returns the arrival to today's silent-instant load). **Removal checklist (exact anchors in Appendix A §A0):**

- **Delete** `src/components/common/GameIntro.tsx`.
- **`GameShell.tsx`:** remove the `intro?: boolean` prop (`:44-47`), the `showIntro` state + `reduce` gate
  (`:72`), the `<AnimatePresence>{showIntro && <GameIntro …/>}</AnimatePresence>` block (`:231-235`), and the
  `GameIntro` import (`:7`). Remove the `useReducedMotion` import only if it becomes unused.
- **Every caller passing `intro={false}`** (the calm "Lær …" browses) — drop the now-nonexistent prop. Full list
  in Appendix A §A0 (from the repo-wide grep).
- **`App.tsx`:** remove the `/dev/game-intro` dev route.
- **`DevRoutes.tsx`:** remove the `GameIntro` dev harness (`?category=&phase=ready|go`).
- **`.claude/skills/ui-screenshot/SKILL.md`:** remove the "entry-beat curtain swallows the first tap /
  `[data-game-intro]` / `/dev/game-intro`" gotcha note (it will be stale). *(Doc-only; do in the same commit.)*
- **CLAUDE.md:** delete the "Game-entry beat (Liveliness PRD-03)" bullet in Key Architecture (stale after removal).
- Confirm no remaining references: repo-wide `GameIntro`, `showIntro`, `data-game-intro`, `game-intro`,
  `phase=ready` all return zero hits.
- **Keep** the themed wipe (`TransitionProvider`/`TransitionOverlay`) and its `mascotBus.emit('welcome')`
  game-arrival cue — those are a separate system the owner chose to keep.

**Verify F0 in isolation:** `npm run build` + `npm run lint` clean; drive `/alphabet/quiz` → board is interactive
immediately with no curtain; drive a `Lær …` browse → unaffected; 0 console errors.

### F1 — The `TactileTile` primitive (the shared soft-3D pressable)

**Create `src/components/common/TactileTile.tsx`** — the single tappable/pressable unit every game reuses, the
game-board analogue of the shell's `SceneObject`. It merges the two weaker vocabularies into the shell's clay
language **while keeping a clear press affordance** (the pedagogy point). It reuses the shell's depth helpers
verbatim: `softShadow`/`contactShadow`/`usePointerTilt` (`src/theme/depth.ts`) and the flicker-safe nested-motion
pattern from `SceneObject`/`useLivingCard`.

**Props (concrete — implement this interface):**
```tsx
interface TactileTileProps {
  onActivate: () => void                    // tap/press (AnswerTile's onClick)
  accent: string                            // section accent: surface tint, contact-shadow tint, feedback rings
  state?: 'idle' | 'correct' | 'wrong'      // feedback (mirrors AnswerTileState)
  hint?: boolean                            // never-fail hint pulse; active only when state==='idle'
  disabled?: boolean                        // locked during the advance window
  variant?: 'tile' | 'card' | 'chip'        // radius/size defaults: quiz tile · memory face · small chip
  interactive?: boolean                     // default true; false = pure display (memory BACK face) → no press/tilt
  size?: number | string                    // optional; default fills the caller's grid cell (100%)
  index?: number                            // phase offset (only used if idle-breathe is enabled — see below)
  children: React.ReactNode                 // content: glyph <Typography> | baked-art <img> | equalizer | swatch
  sx?: SxProps<Theme>
}
```
> **Calm default:** answer-tile grids do **NOT** idle-breathe (4 tiles breathing distracts a pre-reader) — the
> "alive" is on press. `index`/breathe stays available for single/hero uses. This is a deliberate departure from
> `SceneObject`, which breathes because menu objects are few and ambient.

**Composition (mirror `SceneObject`'s flicker-safe nesting):** outer `Box` (caller sizing / grid cell) → framer
squash layer (`motion.div`, `whileTap`/`controls` press-travel) → **surface `Box`** (`tileSurface(accent, dark)`,
`borderRadius` per `variant`, optional `1px` low-opacity accent edge, top inner-light highlight, `filter:
softShadow()`) + a **separate blurred contact-ellipse `Box` beneath** (`contactShadow(accent)`, shrinks to
`scale(~0.85)` on press) + the `children` content slot. **No `0 8px 0` lip, no `3px` border, no
`backdrop-filter`.** `usePointerTilt` on the surface for non-touch (disabled under RM/touch).

**Material spec (what makes it "clay, not a keyboard key"):**
- Surface: soft matte, section-tinted — reuse `tileSurface(accent, dark)` (the existing white→faint-accent
  vertical gradient) but **remove the hard `0 8px 0` colored lip and the heavy `3px` border**. Depth comes from a
  **separate grounded contact-shadow ellipse beneath the tile** (`contactShadow(accent)` on a blurred `Box`) +
  layered `softShadow()` on the tile itself — exactly the `SceneObject` recipe, adapted to a rounded rectangle.
- Shape: generous rounded rect (`borderRadius` ~ `22–24px`), hairline inner highlight (top inner light) for the
  clay read, **no** thick accent frame. A very thin (`1px`) low-opacity accent edge is allowed for definition.
- Press: `press-travel` (translateY on `:active` / framer `whileTap`) sinking toward the contact shadow, which
  shrinks on press (the tile settles) — the "I pressed a soft thing" feel replacing the "key bottomed out on its
  lip" feel. Keep the `cubic-bezier(0.22,1,0.36,1)` snappy press curve.
- Optional pointer-tilt on non-touch (via `usePointerTilt`, disabled under reduced-motion / touch).

**Feedback states (props-driven, balanced motion register):**
- `state: 'idle' | 'correct' | 'wrong' | 'hint'` (mirrors today's `AnswerTile` feedback):
  - `correct` → soft scale pop `[1,1.08,1]` (down from today's `1.12`), a **few** sparkles (cap lower than
    today's 8), success-tinted contact shadow + a soft success ring; `sfx('correct')`.
  - `wrong` → gentle x-shake (shorter amplitude than today), error-tinted contact shadow briefly; `sfx('wrong')`.
  - `hint` → slow breathe + accent glow ring (reduced-motion → static glow) — matches the never-fail hint the
    games already drive via `useNeverFailHint`.
- Reduced-motion: no squash/shake/tilt/sparkle; the state still reads via **static** color/ring/contact-shadow
  changes + the audio; the tile + contact shadow + content always render.

**Content slot:** children (a glyph `Typography`, a numeral, a baked-art `<img>`, an equalizer, a color swatch).
`TactileTile` owns material + depth + press + feedback; the *content* is passed in. This lets it back:
- Quiz answer tiles (glyph or baked-art content) — replaces `AnswerTile` as the rendered surface.
- Memory card faces (front/back) — replaces the `0 8px 0`-lip card faces; the real-3D flip (`rotateY`,
  `perspective`, `backface-visibility`) stays, only the face material changes.
- Farver drag tiles + color swatches + `RamFarven` droplets — the draggable/droppable *look* becomes clay
  (the dnd-kit mechanics, `kidCollision`, spring-back, measuring are **untouched** — see `.claude/rules/
  drag-and-drop.md`; only the visual surface changes).
- `LearningGrid` cells — the "Lær …" browse tiles.

**Migration approach (per-area, not here):** the Foundation ships `TactileTile` + swaps it into the **shared
engines** (`UnifiedQuizGame` via `AnswerTile`, `LearningGrid`, `UnifiedMemoryGame`) so every game that rides those
engines upgrades at once. Hand-rolled games (`MathOperationGame`, `ComparisonGame`, `SpellingGame`, the Farver
dnd games, `SpeakWordGame`) adopt it in their **area PRDs**. `AnswerTile` is refactored to render a `TactileTile`
internally (keeping its public props stable) so no quiz config changes.

> **Learning check:** the primitive must keep the tap target ≥44px and keep the pressable read obvious. If play-
> testing shows the softer (lip-less) tile reads as less "pressable" for the son, the fallback is a **subtle**
> retained edge (a 2px accent under-line), NOT a return to the hard keyboard lip. Flag in the Alphabet PRD's
> verification.

### F2 — Focal-zone dissolve (retire the frosted `PromptStage` card)

Replace the frosted-glass `PromptStage` with an **in-world focal presentation**: the prompt subject rests directly
in the calm framed world, exactly like a `SceneObject`.

- **Create `src/components/common/PromptFocus.tsx`** (replaces `PromptStage` as the thing `GameShell`'s
  `promptStage` slot renders). It draws: the subject (baked-art `<img>` or a `renderHero` node or a large glyph)
  on a **grounding light-pool** (`radial-gradient` warm-white→accent, reused from `SceneObject`) + a **soft
  contact shadow** beneath, and the "Hør igen" pill floating below. **No panel, no border, no
  `backdrop-filter`.** A very soft, wide readability halo behind the subject (barely-there, not a card) keeps it
  legible over busy backdrops without reading as a frame.
  ```tsx
  interface PromptFocusProps {
    accent: string
    chargeKey?: string | number   // re-run the charge-in per question (replaces PromptStage.chargeKey)
    subject: React.ReactNode      // the baked-art <img> | config.renderHero node | large glyph <Typography>
    repeat?: React.ReactNode       // the "Hør igen" pill, floated beneath the subject
    sx?: SxProps<Theme>
  }
  ```
  Composition: grounding light-pool `Box` (`radial-gradient` warm-white→`accent`, blurred — reuse `SceneObject`'s
  pool) + a soft contact-ellipse `Box` beneath (`contactShadow(accent)`) + the `subject` on a framer charge-in/
  idle-float layer (keyed by `chargeKey`, RM-gated) + the `repeat` pill below. A single low-opacity wide radial
  halo behind the subject for legibility — **not** a bordered/blurred panel.
- Keep the **charge-in per question** (subject pops/settles on each new question, keyed like today's `chargeKey`)
  and a gentle idle float — both reduced-motion-gated.
- `GameShell`'s 3-zone anti-void layout (`GameShell.tsx:195-211`) is **preserved** — the focal zone still occupies
  its `flex: 40`/`30`(phone) band so no game floats in a void; only the *material* of what fills it changes.
- `UnifiedQuizGame` passes its existing hero/emoji into `PromptFocus` instead of `PromptStage` (same call site);
  `renderHero(item)` still works (Tal Quiz numeral+objects, Hvad Mangler sequence). `HeroEmoji` becomes a baked-art
  `<img>` (area PRDs supply the art); until an area's art lands the area doesn't ship (art-gated), so there is no
  emoji-interim to design.
- **Deprecate `PromptStage.tsx`** once no caller remains (grep-verified). Keep it only if a caller outside the
  quiz engine still needs it — audit in Appendix A.

> **Learning check:** the dissolved focal zone must keep the subject unmistakably the thing to look at. Mitigations
> baked in: large centered subject, its own light-pool, the world frozen+quiet behind, generous negative space.

### F3 — In-game world presence (ease the dim, ground the board)

Today `PersistentWorld` applies a heavy `blur(7px)` + `scale(1.06)` + dim on game routes (`routeKind==='game'`).
Soften it to **calm-present**:
- Reduce the in-game treatment to a **light readability veil** — less blur (or none) + a gentle darkening/lightening
  scrim tuned per `scene.dark`, enough that content pops but the *place* is still legible. Exact current values in
  Appendix A §A4; the area is the `inGame` branch of `PersistentWorld.tsx` (~`:43-72`).
- Keep the scene **frozen** in-game (rAF stopped + ambient CSS paused — unchanged; PWA-stability rule) and keep
  `useParallax` disabled in-game. Calm ≠ moving.
- **Grounding:** because the veil lightens, the game's own tiles/subject now visibly cast their contact shadows
  onto the world and read as resting *in* it — no extra per-game code; it falls out of F1/F2 using `contactShadow`.
- Reduced-motion + flat skins: unchanged behavior (flat skins have no world; `GameMotif` still handles them —
  optionally give `GameMotif` a matching calm treatment so flat skins feel consistent, low priority).

> **Flicker rule:** the veil is an **opaque-enough** scrim on the world layer that is *static* during play (the
> world is frozen), so it does not violate the moving-layer `backdrop-filter` ban. Do not animate blur on a moving
> layer. Verify no white-flash on the dark skin (`?theme=space`).

### F4 — HUD unification (one soft-3D family, lightly on the world)

Bring all in-game chrome into the tactile language; fix the legacy holdouts.
- **`RepeatButton.tsx` ("Hør igen"):** rebuild off the tactile language instead of the plain MUI
  `variant="contained"` + `boxShadow:2/4`. A soft-3D themed pill (accent surface, grounded soft shadow, press-
  travel, `cubic-bezier` press) — reuse `softShadow`/`contactShadow` or a shared `TactilePill`. Keep the 5 per-
  category color variants + the disabled state + the speaker icon + Danish label. **44px+**.
- **`ScoreChip.tsx`:** keep the pip design, but move from a flat `bgcolor:accent` + single glow to the tactile
  material (soft surface + grounded shadow) so it matches "Hør igen" and the level ring. Keep the per-category
  variants + pip fill logic.
- **Level ring (`LevelRingMini`) + back button (`BackButton variant="game"`):** already shell-consistent (PRD-04/
  -02) — verify they visually agree with the new "Hør igen"/score material; adjust only for coherence, no behavior
  change. The back button already reverses the wipe — untouched.
- **Kill `#ECF1F8`:** replace the two hardcoded legacy tile gradients (`FarveQuizGame.tsx:353`,
  `SpeakWordGame.tsx:224`) with `tileSurface(accent, dark)` — but this lands when those games adopt `TactileTile`
  in the Farver/Ordleg area PRDs; note it here as a tracked debt so it isn't forgotten.
- Consider a shared `TactilePill` primitive if "Hør igen" + score + other pills share enough (implementer's call;
  keep it if ≥2 real consumers).

### F5 — Baked-art conventions + the Gemini pipeline (how pictorial subjects become soft-3D)

All *pictorial* prompt/object subjects become baked **soft-3D WebP**, generated by the owner in **Gemini** on a
flat `#00FF00` green screen and keyed with the existing `sharp` pipeline — **reuse `.claude/rules/scene-assets.md`
verbatim** (green-EXCESS keying, edge-extend before softening, trim + square-contain for sprites/icons, magenta-
composite verification, temp `.mjs` in repo root then delete). No new pipeline is invented; this PRD only defines
**where game art lives** and **the manifest each area supplies.**

- **Where it lives:** game subject art is **theme-constant** (like the section objects / game icons) — one set
  reused across all 4 skins. Store under `src/assets/games/<section>/*.webp` (new dir), exported via a per-section
  `index.ts` manifest keyed by content id (e.g. `alphabet` letter→word art keyed by letter; Farver objects keyed
  by object id). A small loader mirrors `sceneAssets.ts`'s dynamic-import pattern.
- **The rule again:** **glyphs are NOT art.** Letters/numerals rendered on tiles or as the focal subject stay as
  `Typography` (Comic Sans). Baked art is only for *depicted things* (animals/objects/food/vehicles/etc.).
- **Sizing/processing:** match PRD-05 §8.4 — square, subject-centered, 512–768px WebP, **≤40 KB** each, transparent
  alpha. Keep each area's set stylistically consistent (upload the existing `assets/themes/icons/*.webp` set as
  Gemini style references so game art matches the section objects).
- **Style guide:** reuse PRD-05 §8.2 verbatim (soft-3D "claymation / Pixar-lite", soft top-left key + rim light,
  soft contact shadow, child-safe, isolated on `#00FF00`).
- **Art-gated:** each area PRD lists its exact subject manifest (id → Danish word → Gemini prompt). The area's code
  swap can be built against the manifest, but the area **ships only when its WebP batch is keyed + wired**. The
  Foundation itself ships with **zero** new art (F0–F4 are material/layout/HUD code).

### F6 — Program structure & order (how the areas consume this)

Each per-area PRD (`-07`…`-11`) is a focused implement session that:
1. **Produces the area's Gemini prompt doc for the owner FIRST** (before/at the start of implementation) — a
   self-contained prompt per subject that the owner pastes straight into Gemini, per the "generation loop" in
   `.claude/rules/scene-assets.md` (full §8.2 style guide inlined, `#00FF00`, existing section icons as style
   refs, named by content id). Confirm the subject manifest (§4-style table) with the owner, save the doc under
   `plans/liveliness-overhaul/<area>-art-prompts.md`. The owner generates + hands back the folder; the session
   keys it (green-EXCESS pipeline) and wires it. **Do this every area without being re-asked** (worked example:
   `-07`'s `alphabet-art-prompts.md`).
2. Adopts `TactileTile` (F1) + `PromptFocus` (F2) across that section's games (shared engines already upgraded;
   hand-rolled games adopt directly).
3. Applies any **per-game UX/layout rework** that area needs to reach shell level (the owner's mandate: as much
   rework as it takes; shared where possible). Known candidates flagged this session: **Sig et Ord** (sparse/dead
   space → richer speaking moment), **Ram Farven** (faint target + busy station → clearer mixing bench),
   **Farvejagt** (flat scattered stickers → findable objects resting in the scene) — but every area audits its own.
4. Wires its **baked-art manifest** (F5) once the owner returns the keyed batch; ships art-gated.
5. Verifies with `ui-screenshot` across all 4 skins + reduced-motion + phone-portrait; build+lint clean; then the
   owner **play-tests with his son**, and that feeds the next area's PRD (authored just-in-time).

**Order:** `-07` Alphabet (worked example, written now) → `-08` Math → `-09` Farver (dnd — extra care per the drag
rules) → `-10` Ordleg (incl. the Sig et Ord rework) → `-11` English.

## 6. Danish copy

**No new child-facing strings and no new narration.** Labels/prompts/echoes are reused verbatim from existing
content (`categoryContent`, per-game content files). "Hør igen" and all spoken lines are unchanged. (If a per-area
UX rework ever needs a new spoken line — e.g. a reworked Sig et Ord — that area PRD must route it through
`npm run tts:prebake` + `/audit` per the audio rules and call it out; the Foundation adds none.)

## 7. Files to touch (Foundation only)

**Create**
- `src/components/common/TactileTile.tsx` — the shared soft-3D pressable primitive (F1).
- `src/components/common/PromptFocus.tsx` — in-world focal presentation replacing the frosted `PromptStage` (F2).
- *(maybe)* `src/components/common/TactilePill.tsx` — shared soft-3D pill if ≥2 consumers (F4).
- `src/assets/games/` — new art root + a loader/manifest pattern (F5; populated per area, empty at Foundation).

**Edit**
- **Delete** `src/components/common/GameIntro.tsx` + all references (F0 — full list Appendix A §A0).
- `src/components/common/GameShell.tsx` — remove `intro`/`showIntro`/`GameIntro` (F0).
- `src/components/common/AnswerTile.tsx` — render a `TactileTile` internally; keep public props stable (F1).
- `src/components/common/UnifiedQuizGame.tsx` — render `PromptFocus` instead of `PromptStage` at the existing call
  site; thread baked-art hero (F2).
- `src/components/common/LearningGrid.tsx` — cells become `TactileTile` (F1).
- `src/components/common/UnifiedMemoryGame.tsx` — card faces become `TactileTile` material (keep the 3-D flip) (F1).
- `src/components/common/scene/PersistentWorld.tsx` — soften the `inGame` veil (F3).
- `src/components/common/RepeatButton.tsx` — tactile rebuild, keep variants (F4).
- `src/components/common/ScoreChip.tsx` — tactile material, keep pips/variants (F4).
- `src/App.tsx` + `src/components/dev/DevRoutes.tsx` — remove the `/dev/game-intro` route + harness (F0).
- `.claude/skills/ui-screenshot/SKILL.md` + `CLAUDE.md` — remove stale GameIntro notes (F0).
- *(deprecate)* `src/components/common/PromptStage.tsx` — remove once no caller remains (F2).

**Reuse (don't reinvent):** `src/theme/depth.ts` (`softShadow`/`contactShadow`/`usePointerTilt`),
`SceneObject.tsx` (nesting pattern + light-pool + contact ellipse), `useLivingCard`, `ThemedBurst`,
`useReducedMotion`, `tileSurface`/`darken`/`hexToRgba` (`tokens/helpers.ts`), `getCategoryTheme`, `sfxClient` cues,
`celebrateTier`, `useNeverFailHint`, the dnd primitives (`src/components/common/dnd/`), the scene-assets keying
pipeline (`.claude/rules/scene-assets.md`).

## 8. Verification (Foundation)

- `npm run dev` + `npm run dev:api` (**Windows PowerShell**, never WSL — project memory). `npm run build` +
  `npm run lint` clean.
- **F0:** `/alphabet/quiz` opens straight to an interactive board, **no curtain**; repo-wide grep for `GameIntro`/
  `showIntro`/`data-game-intro`/`/dev/game-intro` = 0 hits; a `Lær …` browse still works; 0 console errors.
- **F1:** drive a quiz (`?nogate=1`) — answer tiles read as tactile clay (grounded contact shadow, press-travel),
  **no keyboard lip**; use DEV `?fx=correct|wrong|hint` to capture each feedback state; confirm ≥44px targets and
  the balanced motion register (softer pop, fewer sparkles). Memory faces + `LearningGrid` cells use the same
  material. `AnswerTile`'s public props unchanged (no quiz config edits).
- **F2:** the quiz focal zone is the subject on a light-pool + "Hør igen" pill — **no frosted card, no
  `backdrop-filter`** in the focal zone (grep/inspect). `renderHero` games (Tal Quiz, Hvad Mangler) still render.
  The 3-zone layout still prevents a void.
- **F3:** on `?theme=space` (dark) and `?theme=kid`, the in-game world is softly present (lighter veil), still
  frozen (no rAF during game routes), tiles cast contact shadows onto it; **no white-flash** on the swap.
- **F4:** "Hør igen", score chip, level ring, back button read as one soft-3D family across all 4 skins; the
  legacy MUI look is gone; disabled + per-category variants intact.
- **Reduced-motion** (`?reduce=1` for JS paths + OS-level media for CSS): motion removed; art, contact shadows,
  light-pools, feedback color/ring, and audio all intact; navigation + rewards work; 0 console errors.
- **Phone/portrait** (844×390, 667×375): no scroll, 44px targets, tactile tiles hold.
- **Real iOS standalone PWA** pass for the softened world veil + focal zone (device-specific fixed-layer/touch-pan).

## Appendix A — Verbatim current signatures / anchors (implement with near-zero exploration)

*(Populated from a repo audit this session. All line numbers are current-tree references on `feature/ui-ux-upgrade`.)*

### A0 — `GameIntro` removal checklist (every reference, verbatim anchors)
`GameIntro.tsx` (1-187): props `{ categoryId, onDismiss, hold?, initialPhase?: 'ready'|'go' }`; renders a full-bleed
`motion.div` `<Box data-game-intro>` (`position:absolute; inset:0; zIndex:5`) opaque themed curtain, tap-to-skip,
mascot greet pose + `"Er du klar?"`→`"Kør!"` swap; `GO_AT=850`, `DISMISS_AT=1350`; emits `mascotBus.emit('welcome')`
+ `sfx.play('nav-whoosh')`. **Delete the file.**

| File | Line(s) | Reference to remove/adjust |
|---|---|---|
| `GameShell.tsx` | 8 | `import GameIntro from './GameIntro'` |
| `GameShell.tsx` | 44-47 | `intro?: boolean` prop + doc comment |
| `GameShell.tsx` | 62 | `intro = true,` destructure default |
| `GameShell.tsx` | 72 | `const [showIntro, setShowIntro] = useState(intro && !reduce)` |
| `GameShell.tsx` | 231-235 | `<AnimatePresence>{showIntro && <GameIntro …/>}</AnimatePresence>` block |
| `App.tsx` | 50 | `const DevGameIntro = lazy(() => import('./components/dev/DevRoutes').then(m => ({default: m.DevGameIntro})))` |
| `App.tsx` | 309 | `{import.meta.env.DEV && <Route path="/dev/game-intro" element={<DevGameIntro/>}/>}` |
| `DevRoutes.tsx` | 7 | `import GameIntro from '../common/GameIntro'` |
| `DevRoutes.tsx` | 116-130 | `DevGameIntro` component (`/dev/game-intro` target) incl. its `<GameIntro … hold initialPhase={phase}/>` at 127 |
| `DevRoutes.tsx` | 110, 125 | `intro={false}` on `DevRoundResult` + `DevGameIntro`'s GameShell (prop gone) |
| `AlphabetLearning.tsx` | 138 | `intro={false}` (drop the prop) |
| `NumberLearning.tsx` | 158 | `intro={false}` |
| `FarverLearning.tsx` | 102 | `intro={false}` |
| `EnglishLearning.tsx` | 67 | `intro={false}` |

Doc-only (same commit): `.claude/rules/game-development.md:86`, `CLAUDE.md:41`, `.claude/skills/ui-screenshot/SKILL.md:169-173`.
After removal, repo-wide grep `GameIntro|showIntro|data-game-intro|/dev/game-intro|phase=ready` = 0 code hits.
(`useReducedMotion` in `GameShell` stays — it still gates other motion.)

### A1 — Shared surface props (verbatim interfaces)
```tsx
// AnswerTile.tsx (23-33) — width/height 100% (caller grid imposes 4/3 aspect + size); borderRadius 18px;
// rendered component={motion.button} with data-answer-tile + data-tile-state.
export type AnswerTileState = 'idle' | 'correct' | 'wrong'
interface AnswerTileProps { onClick: () => void; accent: string; state?: AnswerTileState; disabled?: boolean; hint?: boolean; children: React.ReactNode }

// PromptStage.tsx (19-25) + HeroEmoji (99-111). chargeKey re-runs charge-in per question; idleFloat from theme/motion.
interface PromptStageProps { accent: string; chargeKey?: string | number; repeat?: React.ReactNode; children: React.ReactNode }
export const HeroEmoji: React.FC<{ children: React.ReactNode }>  // fontSize clamp(3.5rem,14vh,7rem); phone clamp(2.2rem,18vh,3.2rem)

// ScoreChip.tsx (15-31) — six per-category exports: Alphabet/Math/Color/ColorProgress/English/OrdlegScoreChip (Color+ColorProgress both 'colors').
type CategoryId = 'alphabet'|'math'|'colors'|'english'|'ordleg'
interface ScoreChipProps { category: CategoryId; answered?: number; total?: number; record?: number; value?: number; customLabel?: string; disabled?: boolean; onClick?: () => void }

// RepeatButton.tsx (10-23) — 5 per-category exports: {Alphabet,Math,Color,English,Ordleg}RepeatButton (all label "Hør igen"). No default export.
interface RepeatButtonProps { onClick: () => void; disabled?: boolean; label?: string; size?: 'small'|'medium'|'large'; category?: 'alphabet'|'math'|'colors'|'english'|'ordleg'; useLucideIcons?: boolean }

// LearningGrid.tsx (8-16) — 29 items triggers isAlphabet column layout; cell renders bare glyph {item} (line 171).
interface LearningGridProps { items: (string|number)[]; currentIndex: number; onItemClick: (index: number) => void; disabled?: boolean; accent?: string }
```

### A2 — `UnifiedQuizConfig` / `QuizItem` + the PromptStage & AnswerTile call sites
```tsx
// UnifiedQuizGame.tsx — QuizItem (57-66), UnifiedQuizConfig (69-126). Key fields:
export interface QuizItem { value: string|number; display: string|number; audioPrompt: string; repeatWord: string; questionVisual?: { emoji: string; word?: string } }
export interface UnifiedQuizConfig {
  quizType: 'alphabet'|'counting'|'arithmetic'|'english'|'ordleg'
  generateQuizItem: () => QuizItem
  generateOptions: (correctAnswer: QuizItem) => QuizItem[]
  title: string; emoji: string; teacherCharacter: 'owl'|'fox'; theme: CategoryTheme; backRoute: string
  ScoreChipComponent: React.ComponentType<any>; RepeatButtonComponent: React.ComponentType<any>; showRepeat?: boolean
  gameWelcomeType: string
  speakQuizPrompt/ speakClickedItem/ getRepeatAudio: (item, audio) => Promise<string>
  speakCorrectFact?: (item, audio) => Promise<string>
  hintAfterNWrong?: number
  round?: RoundConfig; gameId?: string
  renderHero?: (item: QuizItem) => React.ReactNode
  skipFirstPrompt?: boolean
}
// Renders <PromptStage> at 589-603 (into GameShell promptStage slot): accent, chargeKey=`${value}-${round.index}`,
//   repeat=<RepeatButton onClick={repeatItem}/>, children = renderHero() (local, 522-571: config.renderHero →
//   questionVisual emoji/word via <HeroEmoji> → English 🔊 equalizer → <HeroEmoji>{item.display}</HeroEmoji>).
// Renders <AnswerTile> at 697-736: accent, state=tileStateFor(item,i), hint=tileHintFor(item), disabled=isAdvancingRef.current;
//   child = <Typography>{item.display}</Typography> (glyph large, word-label smaller via isWordLabel()).
// >>> Foundation: PromptStage → PromptFocus (same slot); AnswerTile renders TactileTile internally (props stay identical).
```

### A3 — depth + material helpers (already used by the shell)
```ts
// src/theme/depth.ts (VERBATIM — reuse these; do not reinvent):
//   softShadow(elevation=1): string            — layered drop-shadow filter for a cut-out object
//   contactShadow(accent='#000', strength=1): string — radial-gradient for a grounded ellipse Box
//   usePointerTilt({strength=8, disabled}): { transform, handlers }
// src/theme/tokens/helpers.ts:
//   tileSurface, darken, neutralShadows, hexToRgba — see A5 (verbatim bodies).
```

### A4 — `PersistentWorld` in-game treatment (verbatim — F3 softens this)
```tsx
// PersistentWorld.tsx: inGame = routeKind(pathname) === 'game' (46); ease = reduce ? '0s' : '0.4s' (47).
// useParallax(rootRef, { disabled: reduce || inGame }) (83).
// Scene layer Box (93-117): filter: inGame ? 'blur(7px)' : 'none'; transform: inGame ? 'scale(1.06)' : … ;
//   transition: `filter ${ease} ease, transform ${ease} ease`; <ThemeScene paused={inGame} … /> (116, freezes ambient).
// Dim overlay Box (136-151): opacity: inGame ? 1 : 0; transition opacity ${ease};
//   background dark: 'radial-gradient(115% 90% at 50% 48%, rgba(7,11,26,0.58) 0%, rgba(7,11,26,0.34) 60%, rgba(7,11,26,0.46) 100%)'
//              light: 'radial-gradient(115% 90% at 50% 48%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0.30) 60%, rgba(255,255,255,0.40) 100%)'
```
**F3 change:** soften to a *light* veil — reduce/remove the `blur(7px)` (try `blur(2–3px)` or none) and lower the dim
opacities (e.g. light ~0.30/0.14/0.20, dark ~0.40/0.22/0.30 — tune with `ui-screenshot`) so the world stays felt but
content still pops. Keep `paused={inGame}` (frozen) and `useParallax` disabled in-game. The overlay is **static during
play** (world frozen) → no moving-layer `backdrop-filter` violation. Verify no white-flash on `?theme=space`.

### A5 — `tokens/helpers.ts` bodies (verbatim — reuse, don't reinvent)
```tsx
export const hexToRgba = (hex, alpha) => { /* #rgb|#rrggbb → rgba() */ }                       // 18-26
export const tileSurface = (accent, dark = false) =>                                            // 83-86
  `linear-gradient(180deg, #FFFFFF 0%, ${hexToRgba(accent, dark ? 0.14 : 0.08)} 100%)`
export const darken = (hex, amount) => { /* toward black by amount 0–1 → rgb() */ }             // 88-100
export const neutralShadows = (focusColor) => ({                                                // 146-153
  card: '0 8px 32px rgba(0,0,0,0.12)', cardHover: '0 12px 48px rgba(0,0,0,0.18)',
  focusRing: `0 0 0 4px ${hexToRgba(focusColor, 0.4)}`,
  pop: `0 4px 0 ${darken(focusColor, 0.3)}, 0 10px 24px ${hexToRgba(focusColor, 0.35)}`,
})
// depth.ts (VERBATIM, already in tree): softShadow(elevation=1), contactShadow(accent,strength=1), usePointerTilt({strength,disabled}).
// NOTE: TactileTile drops AnswerTile's `0 8px 0 darken(accent,0.3)` hard lip; depth comes from contactShadow() + softShadow() instead.
```

### A6 — `SceneObject` / `depth.ts` recipe (already read, verbatim in-tree)
`SceneObject.tsx` composition to mirror: outer position box → `useLivingCard` breathe wrapper → framer squash
`motion.div` → `<img>` + a **separate blurred contact-ellipse `Box`** (`bottom:-4%`, `contactShadow(accent)`,
shrinks to `scale(0.82)` on press) + a **grounding light-pool `Box`** (`radial-gradient` warm-white→accent, 132%,
`blur(7px)`) + `<ThemedBurst>`. Reduced-motion → static, shadow + pool still drawn. `TactileTile` and `PromptFocus`
reuse this exact nesting (adapted to a rounded-rect tile / a free-standing subject).

## Appendix B — Baked-art pipeline (reuse, do not re-derive)

Reuse `.claude/rules/scene-assets.md` verbatim (green-EXCESS keying; edge-extend before softening; trim + square-
contain for sprites; magenta-composite + assemble-to-verify offline; temp `.mjs` in repo root then delete; watch
for stray `*.mjs`). Reuse PRD-05 §8.2 style guide + §8.4 sizing (≤40 KB square WebP, transparent). Game art is
**theme-constant** and lives under `src/assets/games/<section>/`. Each **area PRD** carries its own subject
manifest (id → Danish word → Gemini prompt); the Foundation ships none.

---

*End of Foundation PRD. Implement F0 first, then F1–F5; ship the Foundation (no new art) before any area. Then run
the area PRDs in order (`-07` Alphabet first), each art-gated and play-tested before the next.*
