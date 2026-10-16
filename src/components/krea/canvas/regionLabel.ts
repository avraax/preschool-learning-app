// Line art → colour-in regions (Krea PRD-01 §4.4) — the pure core of `scripts/krea-regions.mjs`, kept
// here so it is unit-tested with the rest of the canvas engine. No DOM, no sharp: it takes a greyscale
// buffer and returns a label map.
//
//   1. threshold the line art into line / not-line;
//   2. label the connected components of NOT-line pixels (4-connected, so a diagonal pinhole in a line
//      never joins two areas);
//   3. components below a minimum area become UNFILLABLE (a 5-year-old can't hit a pupil);
//   4. the page's outside background is dropped (unfillable) or kept as a region, per page;
//   5. what is left is numbered 1..N.
//
// Label values: 0 = a line pixel, `UNFILLABLE` = paper you can't colour, 1..N = the regions.
//
// It also REJECTS a page whose art has drifted to grey shading or texture (Gemini does), rather than
// thresholding it into hundreds of speckle regions: re-render instead.

export const UNFILLABLE = 0xffff

/** A pixel at or below this luminance is line. Generous, so anti-aliased edges seal every gap. */
export const LINE_MAX = 165
/** The mid-grey band the rejection counts — clearly neither line nor paper. */
export const GREY_MIN = 90
export const GREY_MAX = 200

export interface RegionMap {
  w: number
  h: number
  labels: Uint16Array
  count: number
  /** Per region (index = id − 1): [x0, y0, x1, y1], inclusive. */
  boxes: Array<[number, number, number, number]>
  /** Per region: its pixel count. */
  areas: number[]
}

/**
 * The share of mid-grey pixels in the page that are NOT the anti-aliased edge of a line: a mid-grey
 * pixel counts only when no line pixel lies within 2 px of it. Clean line art scores ~0; a page with
 * shading or hatching scores high.
 */
export function greyShare(lum: Uint8Array, w: number, h: number): number {
  let grey = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = lum[y * w + x]
      if (v < GREY_MIN || v > GREY_MAX) continue
      let nearLine = false
      for (let dy = -2; dy <= 2 && !nearLine; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < w && lum[yy * w + xx] < GREY_MIN) {
            nearLine = true
            break
          }
        }
      }
      if (!nearLine) grey++
    }
  }
  return grey / (w * h)
}

/** Above this share of stray mid-grey the page is rejected (§4.4: "more than ~2%"). */
export const GREY_REJECT = 0.02

export interface LabelOptions {
  /** Components smaller than this many pixels become unfillable. */
  minArea: number
  /** Drop the largest component touching the border (the page's outside), or keep it as a region. */
  outside: 'drop' | 'keep'
}

export function labelRegions(lum: Uint8Array, w: number, h: number, opts: LabelOptions): RegionMap {
  const n = w * h
  const comp = new Int32Array(n).fill(-1)
  const sizes: number[] = []
  const touchesBorder: boolean[] = []
  const stack = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1 || lum[i] <= LINE_MAX) continue
    const id = sizes.length
    let top = 0
    let size = 0
    let border = false
    stack[top++] = i
    comp[i] = id
    while (top) {
      const p = stack[--top]
      size++
      const x = p % w
      const y = (p - x) / w
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true
      if (x > 0 && comp[p - 1] === -1 && lum[p - 1] > LINE_MAX) { comp[p - 1] = id; stack[top++] = p - 1 }
      if (x < w - 1 && comp[p + 1] === -1 && lum[p + 1] > LINE_MAX) { comp[p + 1] = id; stack[top++] = p + 1 }
      if (y > 0 && comp[p - w] === -1 && lum[p - w] > LINE_MAX) { comp[p - w] = id; stack[top++] = p - w }
      if (y < h - 1 && comp[p + w] === -1 && lum[p + w] > LINE_MAX) { comp[p + w] = id; stack[top++] = p + w }
    }
    sizes.push(size)
    touchesBorder.push(border)
  }

  let outside = -1
  if (opts.outside === 'drop') {
    for (let c = 0; c < sizes.length; c++) if (touchesBorder[c] && (outside < 0 || sizes[c] > sizes[outside])) outside = c
  }

  // Number the surviving components in scan order, so ids are stable for the same art.
  const remap = new Int32Array(sizes.length).fill(0)
  let count = 0
  const labels = new Uint16Array(n)
  const boxes: RegionMap['boxes'] = []
  const areas: number[] = []
  for (let i = 0; i < n; i++) {
    const c = comp[i]
    if (c < 0) continue
    if (c === outside || sizes[c] < opts.minArea) {
      labels[i] = UNFILLABLE
      continue
    }
    if (!remap[c]) {
      remap[c] = ++count
      boxes.push([w, h, -1, -1])
      areas.push(0)
    }
    const id = remap[c]
    labels[i] = id
    const b = boxes[id - 1]
    const x = i % w
    const y = (i - x) / w
    if (x < b[0]) b[0] = x
    if (y < b[1]) b[1] = y
    if (x > b[2]) b[2] = x
    if (y > b[3]) b[3] = y
    areas[id - 1]++
  }
  return { w, h, labels, count, boxes, areas }
}
