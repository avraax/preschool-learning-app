// The parallax driver's target registry (Performance PRD-01 W2.5).
//
// WHY IT REPLACED A CSS CUSTOM PROPERTY. `useParallax` used to write `--parallax-x/y` on the
// PersistentWorld root every frame and `ParallaxLayer` read them inside a `calc()` in its `transform`.
// That is the exact trap PRD-01 F9 records from Motion's own docs — "individual transforms are
// implemented with CSS variables, which are NOT hardware accelerated even though they end up in a
// transform" — plus a second cost: a custom-property write on an ancestor invalidates style for the
// whole subtree, which on the home screen is ~20 animating ambient sprites. So one 60Hz write made
// three full-bleed 2048px layers un-compositable AND re-resolved every sprite's style, every frame.
//
// PRD-01 F2 recorded the opposite conclusion ("the parallax custom-property driver is not the cause —
// do not restructure the parallax driver"), measured at ~11% of ~57 ms/s. That measurement was taken
// with the 25 Framer loops still running and saturating the main thread, which masked it. After W1
// removed them the same subtraction measured **~24 percentage points of busy on home at 6x** — so F2
// is superseded, not wrong-at-the-time. Re-measure before trusting either number again.
//
// A registry rather than a `querySelectorAll` per frame: the layers mount asynchronously (the art is
// lazy-loaded), so the driver cannot resolve them once at start, and re-querying every frame would put
// back a slice of the main-thread cost this exists to remove.

export interface ParallaxTarget {
  el: HTMLElement
  /** How far this element moves per unit of driver output (0 = pinned, 1 = full travel). */
  depth: number
  /** Anchored strips don't drift vertically — they'd lift off the edge they exist to cover. */
  driftY: boolean
  /**
   * A STATIC art nudge (% of the element's own height, − = up) that lines up independently generated
   * layers. Not drift — it must survive in the transform even at rest, which is why it is baked into
   * the suffix rather than added to the animated part.
   */
  offsetYPct: number
}

const targets = new Set<ParallaxTarget>()

/** Register an element for per-frame transform writes. Returns the unregister function. */
export const registerParallaxTarget = (t: ParallaxTarget): (() => void) => {
  targets.add(t)
  return () => {
    targets.delete(t)
  }
}

export const parallaxTargets = (): Set<ParallaxTarget> => targets

/**
 * The transform for one target at a given driver output, in px.
 *
 * PURE and exported so a test can pin it: the sign formatting matters, because `calc(x + -7%)` is
 * INVALID CSS and silently drops the ENTIRE transform — the bug that once made an `offsetY` "fix" do
 * nothing at all (see `.claude/rules/scene-assets.md`).
 */
export const parallaxTransform = (t: ParallaxTarget, x: number, y: number): string => {
  const tx = `${(x * t.depth).toFixed(2)}px`
  const drift = t.driftY ? `${(y * t.depth).toFixed(2)}px` : '0px'
  const ty = t.offsetYPct
    ? `calc(${drift} ${t.offsetYPct < 0 ? '-' : '+'} ${Math.abs(t.offsetYPct)}%)`
    : drift
  return `translate3d(${tx}, ${ty}, 0)`
}

/** Write every registered target's transform for one frame. */
export const writeParallaxFrame = (x: number, y: number): void => {
  for (const t of targets) t.el.style.transform = parallaxTransform(t, x, y)
}
