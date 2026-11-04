// The picker's shelf headings (owner 2026-11-04: 72 pictures per game, grouped so a child can find the
// animals). Read by the picker only, never spoken. Perleplade's families include `natur`; the drawing
// games' include `steder`.

export const KREA_FAMILY_LABEL: Record<string, string> = {
  dyr: 'Dyr',
  steder: 'Steder',
  natur: 'Natur',
  ting: 'Ting',
  fantasi: 'Fantasi',
}

/** The free boards' shelf in Perleplade. */
export const FREE_BOARDS_LABEL = 'Frie plader'

/** Items in family order, stable inside a family (the authored order). */
export function byFamily<T extends { family: string }>(items: readonly T[], order: readonly string[]): T[] {
  return [...items].sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family))
}
