// Balanced rows for a door menu's tiles (Category restructure PRD-01 D2/T12).
//
// A merged door holds up to 9 games, and flex-wrap fills each line greedily — so a track that is almost
// wide enough for all of them drops ONE onto a second line (8+1), the orphan the quiz grids refuse
// (`answerGrid.ts`). The section menus used to fight that with a `maxWidth` brake tuned for the one
// 7-tile section; that cannot hold for 3, 5, 8 and 9 tiles at once. So the rows are decided here, from
// the COUNT and the most a row may hold on this viewport, and rendered as explicit lines.
//
// The rule: as few rows as the width allows, and the tiles spread as evenly as possible across them,
// longer rows first — 9 → 5+4, 8 → 4+4, 7 → 4+3, 9 at three-a-row → 3+3+3. No row is ever more than one
// tile shorter than another, so an orphan of 1 is impossible unless there is only 1 tile.

/** Row sizes for `count` tiles when a row may hold at most `maxPerRow`. Sums to `count`. */
export const balancedRows = (count: number, maxPerRow: number): number[] => {
  if (count <= 0) return []
  const perRowCap = Math.max(1, Math.floor(maxPerRow))
  const rows = Math.ceil(count / perRowCap)
  const base = Math.floor(count / rows)
  const extra = count % rows
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0))
}
