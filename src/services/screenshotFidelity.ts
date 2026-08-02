// Pure decision rules for the bug-report screenshot's pre-capture stabilisation
// (`screenshotService.stabilizeForCapture`). Split out so they are Node-testable — the DOM walk
// around them is not.

/**
 * Should this element's used horizontal margins be pinned before the clone?
 *
 * `getComputedStyle().marginLeft` reports `0px` for `margin-left: auto`, so snapdom's
 * computed-style clone loses every `mx: 'auto'` centring. We detect it geometrically: BOTH sides
 * show a gap the reported margin doesn't explain, and the two gaps are equal — the signature of
 * `margin: 0 auto`.
 *
 * The equality requirement is what keeps this safe. `justify-content: flex-end` also leaves an
 * unexplained gap, but only on one side, so it is skipped — and it doesn't need pinning anyway,
 * because `justify-content` IS copied to the clone. Where both gaps ARE equal (centring, whether
 * by auto margins, `justify-content: center` or `justify-items: center`), pinning them makes the
 * element's outer box fill the parent's content box exactly, leaving no free space for any
 * alignment property to redistribute — so the result is right either way.
 *
 * @param gapL  px between the parent's content-box left edge and the element's border box
 * @param gapR  px between the element's border box and the parent's content-box right edge
 * @param marginLeft   computed margin-left in px (what the clone would get)
 * @param marginRight  computed margin-right in px
 */
export function needsMarginPin(
  gapL: number,
  gapR: number,
  marginLeft: number,
  marginRight: number
): boolean {
  if (!Number.isFinite(gapL) || !Number.isFinite(gapR)) return false
  // Sub-pixel gaps aren't worth a mutation, and a NEGATIVE gap means the element overflows its
  // parent (a scroller, a negative margin) — geometry we must not re-state as a margin.
  if (gapL <= 1 || gapR <= 1) return false
  if (Math.abs(gapL - gapR) >= 2) return false // not centred → some other mechanism owns it
  // Already explained by the computed margins the clone will receive → nothing to fix.
  if (Math.abs(gapL - marginLeft) <= 1 && Math.abs(gapR - marginRight) <= 1) return false
  return true
}

/**
 * Is this element's `text-overflow: ellipsis` currently NOT firing?
 *
 * snapdom pins each box's computed width, so a label whose text measures a fraction wider in the
 * clone truncates even though it fits live. Elements that pass this check get `overflow: visible`
 * for the capture; ones that are genuinely truncated on screen are left alone, so a real
 * truncation still appears in the report.
 *
 * The 1px tolerance absorbs sub-pixel rounding between the fractional layout width and the
 * integer `scrollWidth`/`clientWidth`.
 */
export function isFalseEllipsis(scrollWidth: number, clientWidth: number): boolean {
  if (!Number.isFinite(scrollWidth) || !Number.isFinite(clientWidth)) return false
  if (clientWidth <= 0) return false
  return scrollWidth <= clientWidth + 1
}
