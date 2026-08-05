// Hard bounds on the parallax driver's output. PURE (no React, no DOM) so the scene layers, the
// bloom-anchor guard and Node tests can all import the same numbers.
//
// `useParallax` writes `--parallax-x/y` every frame as `strength × (autonomous drift + pointer)`,
// smoothed — the smoothing only ever APPROACHES the target, so `strength × (drift + pointer)` is a
// true upper bound on the magnitude. A layer at `depth` therefore never travels further than
// `PARALLAX_MAX_* × depth`, which is exactly the overscan `ParallaxLayer` has to reserve: a layer
// that drifts further than it over-hangs slides off its own edge and shows whatever is behind it.

export const PARALLAX_STRENGTH = 40

// Amplitudes of the two contributions the driver sums, per axis.
export const PARALLAX_DRIFT_X = 0.6
export const PARALLAX_POINTER_X = 0.5
export const PARALLAX_DRIFT_Y = 0.42
export const PARALLAX_POINTER_Y = 0.4

export const PARALLAX_MAX_X = PARALLAX_STRENGTH * (PARALLAX_DRIFT_X + PARALLAX_POINTER_X)
export const PARALLAX_MAX_Y = PARALLAX_STRENGTH * (PARALLAX_DRIFT_Y + PARALLAX_POINTER_Y)

/** Max px a scene element at `depth` can be displaced from its resting position. */
export const parallaxTravelX = (depth: number): number => PARALLAX_MAX_X * Math.abs(depth)
export const parallaxTravelY = (depth: number): number => PARALLAX_MAX_Y * Math.abs(depth)

// A little more than the exact travel: sub-pixel rounding at fractional device-pixel ratios.
export const OVERSCAN_SAFETY_PX = 6
// The framing the old fixed `scale(1.12)` produced. Kept as a floor so the screens where the
// overscan was already sufficient frame exactly as they did before.
export const OVERSCAN_LEGACY_FRACTION = 0.06

/** CSS length for a layer's overscan on one axis — the `max()` the floor and the travel resolve to. */
export const overscanCss = (travelPx: number): string =>
  `max(${OVERSCAN_LEGACY_FRACTION * 100}%, ${Math.ceil(travelPx) + OVERSCAN_SAFETY_PX}px)`

/** What `overscanCss` resolves to in px against a container of `sizePx` on that axis. */
export const overscanPx = (travelPx: number, sizePx: number): number =>
  Math.max(OVERSCAN_LEGACY_FRACTION * sizePx, Math.ceil(travelPx) + OVERSCAN_SAFETY_PX)

// --- Promotion budget (Performance PRD-01 W2) --------------------------------------------------
//
// "Only promote what actually moves." A full-bleed scene layer at dpr 2 is a ~22 MB compositing
// texture, and all three of them were promoted and translated on every skin. The far layer's depth is
// 0.14, so its ENTIRE range of motion is `PARALLAX_MAX_X × 0.14 ≈ 6 px` horizontally — a live
// compositing layer, a `will-change: transform`, and a per-frame transform, to move six pixels.
//
// Below this threshold a layer emits no transform and no `will-change` at all. **The overscan stays
// exactly as it is** (`overscanCss` still reserves the same bleed), so the layer's BOX is unchanged and
// the framing is pixel-identical — only the promotion goes. That is why the threshold lives here next
// to the travel/overscan derivation rather than in the component: the two must be read from one place
// or the "reserve what you can travel" invariant silently stops matching what actually travels.
export const PROMOTE_MIN_TRAVEL_PX = 8

/**
 * Does a layer at `depth` move enough to be worth a compositing layer?
 *
 * Judged on the LARGEST single-axis travel, not the sum: 6px of horizontal drift is 6px of visible
 * motion whether or not the layer also drifts 4px vertically, and summing them would promote the far
 * layer on a technicality (10.7px combined) while it still only ever moves ~6px in any direction.
 *
 * With today's amplitudes the cut lands between the far layers (depth 0.12–0.14 → 5.3–6.2px, NOT
 * promoted) and the mid layers (0.42–0.44 → 18.5–19.4px, promoted). The ground layers are 0.80–0.82.
 */
export const shouldPromoteLayer = (depth: number): boolean =>
  Math.max(parallaxTravelX(depth), parallaxTravelY(depth)) >= PROMOTE_MIN_TRAVEL_PX

// --- Ambient promotion ceiling (W2.4) ----------------------------------------------------------
//
// `AmbientField` renders `scene.ambient.count + bloomExtra` sprites, and `bloomExtra` tops out around
// 12, so a fully bloomed 16-sprite skin draws 28. The COUNT is deliberately untouched — it is the
// visible bloom, it is the only way progress shows in the world, and F3 measured the CSS drift as free.
// What is capped is the ceiling itself, so a future bloom curve cannot quietly double the number of
// animated elements the compositor has to hold.
export const AMBIENT_PROMOTED_MAX = 28
