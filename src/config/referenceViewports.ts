// The viewports every layout guard measures against.
//
// iPad-first, phones supported (see `.claude/rules/responsive-design.md`). The wide entry is the
// owner's own browser window; the two phone entries are the sizes the phone-compact media guards are
// named for. Anything sized in px owns a very different share of a 390px phone than of a 1024px iPad,
// which is why a guard has to sweep all of these rather than pick one.
//
// WHICH DEVICE MATTERS (2026-08-04). The child plays on an **iPad Pro 2nd gen (A10X, 2017) on iPadOS
// 17.7.11, its terminal OS** — the compatibility floor in CLAUDE.md. That device has **never sent a bug
// report**, so its window size is NOT measured; see `docs/device-testing.md` for what is known and what
// is still assumed. The 12.9" entries below ARE measured, but from the household's **M1** iPad Pro
// (prod reports K2HXP/WSNHY: `platform: MacIntel`, `isM1iPad: true`, UA `Macintosh … Version/26.5` —
// M1+ iPads send a desktop-class UA). Both 12.9" Pro generations share the same CSS geometry
// (2732x2048 @dpr 2 → 1366x1024 pt), so these numbers transfer IF the child's is the 12.9" model — the
// 2nd gen also shipped as a 10.5" (1112x834 pt), and which one it is has not been confirmed.
//
// The 992 (not 1024) is real: iOS keeps a ~32px status strip even in standalone PWA mode. Don't round
// it. The 678x992 Split View entry comes from a real report — a full-width-only assumption is wrong.
// Note `1024x768` is NOT any current iPad Pro; it is kept because it is the tighter small-iPad case.
//
// DO NOT read "npm test passes" as "the layout is verified at these sizes". The only unit consumer is
// `sceneLayers.test.ts`, and it is currently INSENSITIVE to viewport size: `overscanPx` is defined as
// `max(fraction × size, ceil(travel) + 6)`, so its `overscan < travel` term can never be true whatever
// the viewport, and the one term that does scale with height (`offsetY`) exists on a single layer that
// is in `OFFSET_EXEMPT`. Proved by adding a 1x1 viewport: the suite still passed. That guard still earns
// its place — it catches a NEW nudged edge-covering layer, which is what it was written for — but these
// entries buy it nothing. **Device-size verification has to come from the browser sweep**
// (`.claude/skills/ui-screenshot/sweep.mjs --phase layout`), which measures real rects in a real engine.
//
// This replaced `sceneFurniture.ts` on 2026-08-03. That module existed to keep earned `bloomScenery`
// sprites from being seated underneath the persistent menu furniture (mascot / Min Bog shelf / corner
// gear / reward ring); the feature was removed, and its measured furniture rectangles went with it.

export interface Viewport {
  name: string
  w: number
  h: number
}

export const REFERENCE_VIEWPORTS: Viewport[] = [
  // Measured from a real 12.9" iPad Pro PWA (M1). Transfers to the child's device if his is the 12.9".
  { name: 'iPad Pro 12.9 landscape 1366x992', w: 1366, h: 992 },
  { name: 'iPad Pro 12.9 portrait 1024x1334', w: 1024, h: 1334 },
  { name: 'iPad Pro split view 678x992', w: 678, h: 992 },
  // The other candidate for the child's 2nd-gen Pro: the 10.5" (1112x834 pt), minus the status strip.
  { name: 'iPad Pro 10.5 landscape 1112x810', w: 1112, h: 810 },
  // Smaller/older iPads — kept because they are the tighter case.
  { name: 'iPad landscape 1024x768', w: 1024, h: 768 },
  { name: 'iPad portrait 768x1024', w: 768, h: 1024 },
  { name: 'wide 1254x872', w: 1254, h: 872 },
  // A real phone from the reports: 390x844 @dpr 3, PWA, both orientations.
  { name: 'phone landscape 844x390', w: 844, h: 390 },
  { name: 'phone portrait 390x844', w: 390, h: 844 },
]
