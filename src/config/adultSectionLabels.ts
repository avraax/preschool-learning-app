// The five section names as an ADULT reads them, in one place — the difficulty rows and the child's
// "har spillet" summary both label the same five sections and used to spell them independently.

import type { SectionId } from './progressSchema.ts'

export const SECTION_LABELS: Record<SectionId, string> = {
  alphabet: 'Alfabetet',
  math: 'Tal',
  colors: 'Farver',
  english: 'Engelsk',
  ordleg: 'Ordleg',
}
