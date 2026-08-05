# Animation mechanism & rendering cost

Performance PRD-01 (`plans/performance/`). The app ran at **~40% of every second in style
recalculation while sitting completely still** on a 6×-throttled thread — a fair stand-in for the
child's 2017 iPad. Under `prefers-reduced-motion` the same screens sat at ~8% with ZERO recalculations,
which is what proved the cost was removable without moving a pixel.

Measurements live in `docs/device-testing.md` (steady-state table + eager-JS list) and the PRD's §7.
This file is the rules, not the numbers.

## 1. A continuous, stateless animation is a CSS keyframe animation. Never a JS loop.

`src/theme/idleMotion.ts` is the vocabulary — `idleFloat` / `idlePulse` / `hintPulse` / `idleGlow` /
`equalizerBar` / `idleWobble` / the `wipe*` motifs. Each returns a `{ props, sx }` bundle so a call site
never knows which mechanism is running.

A framer `repeat: Infinity` is a JavaScript animation: framer's frameloop ticks it every rAF, writes an
inline style, and the browser recalculates style once per frame. **Framer keeps what it is good at** —
one-shot event feedback (pop, shake, charge-in), gestures, `AnimatePresence`, layout animations.

- **Reduced motion still wins.** Every helper takes `reduce` first and returns nothing when set.
- `src/theme/idleMotionBudget.test.ts` fails the build on a new `repeat: Infinity` under
  `src/components/**`. The allowlist is exhaustive and each entry needs a REASON; the surviving ones are
  all interaction-gated (a hint that tripped after 2 wrong answers, a drag hovering a target), so they
  cost nothing at rest. **Adding an entry is a decision** — if it is idle ambience, convert it instead.
- `theme/motion.ts` keeps the springs/dwells and must stay free of loops. Don't fork the vocabulary.

## 2. Two transforms on one element: the cascade decides, and it is not who you think

A CSS `animation` and a framer transform on the same element both write `transform`. **A running CSS
animation OUTRANKS framer's inline `transform`** (animations sit above normal author declarations,
including the `style` attribute). So the CSS one silently swallows the framer one while it runs.

- Default to the **nested-layer** pattern — `useLivingCard` is the original: outer element = CSS idle,
  inner = framer feedback. `TactileTile` stacks three (breathe → hint → feedback).
- Sharing ONE element is safe **only where the two states are mutually exclusive by construction**
  (Min Bog's next-prize slot, Hvilken Farve's prompt object). If they can overlap, nest.

## 3. `will-change` is spent, not sprinkled — and an animated element promotes itself

An element already running a `transform`/`opacity` keyframe animation is promoted BY that animation.
Adding `will-change` buys nothing and costs a compositing texture, at dpr 2, on a GPU that shares system
memory with a 2048×2732 backing store.

- **Only promote what actually moves.** `shouldPromoteLayer(depth)` (`src/config/parallax.ts`) leaves a
  layer whose largest single-axis travel is a few px un-promoted — that is the far layer on every skin.
  The threshold lives beside the travel/overscan derivation so the three cannot disagree; the overscan is
  unchanged either way, so the box and the framing are pixel-identical.
- **A layer COUNT floor follows from §3**: a screen with a live ambient field has roughly
  `9 + sprite count` layers by construction. A gate like "layers ≤ 18" on a menu route is unreachable
  while the world animates — the number that responds to discipline is the `will-change` CENSUS.
- The one justified spend added by PRD-01: `will-change: filter` on the in-game blur box, only while a
  game is open (the world is frozen, so the blurred result never changes). Cleared at idle.
- Guarded by `idleMotionBudget.test.ts` (AmbientField promotes nothing by hand; ParallaxLayer has exactly
  one `will-change` site and it must sit inside the promote branch).

## 4. A var-driven transform is not hardware accelerated, and it invalidates the whole subtree

Motion's own docs say it, and this app hit it twice. `useParallax` used to write `--parallax-x/y` on the
world root every frame while the layers read them through `calc()`: that made three full-bleed layers
un-compositable AND re-resolved every animating sprite's style, 60 times a second. It now writes
`transform` **directly** onto layers that register themselves (`scene/parallaxTargets.ts`).

The same shape is why framer's individual-transform syntax (`x: 100`, `scale: 2`) is the wrong tool for a
continuous animation — it compiles to CSS variables. Animate an explicit `transform` string.

## 5. `box-shadow` for boxes is only true for an OPAQUE box

`filter: drop-shadow` paints the element's own silhouette BEHIND it, so on a **translucent** surface the
shadow shows through the element's face and is load-bearing for the MATERIAL, not just the outline.
`box-shadow` is clipped to outside the border box and cannot do that.

Every tile surface here is translucent toward the bottom (`tileSurface()` ends at `rgba(accent, 0.08)`),
so converting lifted a tile face by ~20 RGB with DOM rects byte-identical — a visible change with nothing
failing. A compensating background wash closed only a fraction of it, because the face and the external
shadow are two mismatches with different causes.

- `boxSoftShadow()` (`src/theme/depth.ts`) is for **opaque fills only** — `TactilePill`, Sig et Ord's orb.
- `TactileTile`, Plus/Minus's equation tile and Stav Ordet's slots deliberately KEEP `softShadow()`.
- Chained `drop-shadow` is still slow and buggy on mobile Safari, so this is a real trade, not a
  non-issue: the full conversion is worth a large layer drop on a dense browse. It needs owner sign-off,
  not an implementer's judgement.
- **Blur radii are 1:1 between the two** — the Filter Effects spec defines `drop-shadow`'s third length as
  "interpreted as in box-shadow". Rescaling them "for the different units" measured as a regression.

## 6. Safari 17 is the API floor

**`content-visibility` is Safari 18+ and the child's iPad is on its TERMINAL OS**, so it is permanently
unavailable — and it is the most tempting wrong answer to a compositing problem. It fails SILENTLY
(simply ignored), so the app looks right everywhere except the one device that matters: the same shape as
the Ogg audio that silenced the app twice. Banned outright, guarded by `idleMotionBudget.test.ts`.
`contain` and `contain-intrinsic-size` DID ship in Safari 17.0 and are used (`ThemeScene`).

## 7. "Flydende grafik" — one branch point, mechanism only, permanent

`src/config/perfProfile.ts` is the ONE place the rendering profile branches, read by four files. It exists
because **you cannot type a query parameter into a standalone PWA**: it is the only way to A/B the two
rendering paths ON the child's iPad, and the only way to back out of a regression without a deploy.
Persisted as `settings.smoothGraphics`, surfaced in "Til de voksne" → Udseende.

- **PERMANENT** (owner, 2026-08-05, stated twice). Don't re-litigate it and don't delete the legacy path
  in a tidy-up.
- **Default is the FAST path**, from every direction (never-set, `true`, and a fresh document).
- **It may switch only the animation MECHANISM or a compositing promotion — never a size, position, count
  or existence.** That bound is what makes a permanent dual path affordable to verify: because the legacy
  branch cannot move a box, the screenshot sweep is owed on the default path alone.
- It is RENDERING only — never XP, difficulty, narration or a round outcome.
- Both bounds and the default are guarded by `src/config/perfProfile.test.ts`, including "no fifth file
  starts reading the profile without being declared".

## 8. Measuring this class of change

Full recipes: `.claude/skills/ui-screenshot/` (`perf.mjs`). Two rules that are not about the tool:

- **An attribution measured while something else saturates the thread is worthless.** TWO of PRD-01's own
  findings — "the parallax custom-property driver is not the cause" and "the ambient field's CSS
  animations are free" — were both wrong for exactly this reason: the 25 framer loops masked them, and
  both flipped once the loops were gone. **Re-measure every attribution after removing the dominant
  cost**, and treat a subtraction that landed "in the noise" as unmeasured rather than as zero.
- **`recalcPerSec` cannot go below ~60 while anything animates** — Blink counts one style recalculation
  per animating FRAME, whatever the mechanism (stripping every CSS animation leaves it at 60; only
  reduced motion reaches 0). **Gate on `recalcMsPerSec`.** A target read off a reduced-motion run is a
  target for an app with no animation.
