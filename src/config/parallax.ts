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
