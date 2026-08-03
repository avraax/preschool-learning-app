// The viewports every layout guard measures against.
//
// iPad-first, phones supported (see `.claude/rules/responsive-design.md`). The wide entry is the
// owner's own browser window; the two phone entries are the sizes the phone-compact media guards are
// named for. Anything sized in px owns a very different share of a 390px phone than of a 1024px iPad,
// which is why a guard has to sweep all five rather than pick one.
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
  { name: 'iPad landscape 1024x768', w: 1024, h: 768 },
  { name: 'iPad portrait 768x1024', w: 768, h: 1024 },
  { name: 'wide 1254x872', w: 1254, h: 872 },
  { name: 'phone landscape 844x390', w: 844, h: 390 },
  { name: 'phone portrait 390x844', w: 390, h: 844 },
]
