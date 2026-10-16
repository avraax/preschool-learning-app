// Everything Krea says (Krea PRD-01 §2.3.15), built here so the prebake enumerator can reach it
// (`.claude/rules/audio-system.md` protocol, step 1). Narration GUIDES, it is not chatty: the welcome,
// the colour name on pick, the "Nyt papir?" confirm, Tegn med Mig's step lines and one describing line
// when a guided or colour-in piece is done (`kreaSubjects.ts`, `kreaPages.ts`) — silent while drawing.
// (Fri Tegning's done line "Du har brugt {n} farver" went with its done button, owner 2026-10-16: a
// free canvas has no finish.)
//
// It DESCRIBES, it never grades or praises the product: "Se, fisken svømmer!", never "Sikke en
// flot tegning" (Lepper 1973 ran exactly this on preschoolers drawing; inflated praise backfires —
// Brummelman 2016). `kreaPhrases.test.ts` fails on "flot", "smuk" or "dygtig" in any Krea line.
//
// Explicit `.ts` extension: this module is in `shared-narration-clips.js`'s plain-Node import graph.

import { PALETTE_12, type CrayonColor } from './kreaPalette.ts'
import { allSubjectLines } from './kreaSubjects.ts'
import { allPageLines } from './kreaPages.ts'

/** The crayon's spoken Danish name — said on every pick, so each choice is a tiny Farver lesson. */
export const KREA_COLOR_NAME: Record<CrayonColor, string> = {
  roed: 'rød',
  orange: 'orange',
  gul: 'gul',
  lysegroen: 'lysegrøn',
  groen: 'grøn',
  lyseblaa: 'lyseblå',
  blaa: 'blå',
  lilla: 'lilla',
  lyseroed: 'lyserød',
  brun: 'brun',
  sort: 'sort',
  hvid: 'hvid',
}

export const KREA_COLORS = PALETTE_12

/** The rainbow crayon's spoken name — said when it is picked, like every crayon. */
export const KREA_RAINBOW_NAME = 'regnbue'

/** The welcome titles = the tile titles (`categoryThemes.ts`). */
export const KREA_WELCOME_TITLES = ['Fri Tegning', 'Tegn med Mig', 'Farvelæg'] as const

/** The discard confirm, spoken because a 5-year-old can't read "Er du sikker?" (§2.1.4). */
export const NEW_PAPER_TITLE = 'Nyt papir?'
export const NEW_PAPER_LINE = 'Vil du have et nyt papir? Din tegning forsvinder.'

/** Every Krea line the app can speak — the enumerator walks this, and the guards read it too. */
export function allKreaLines(): string[] {
  const lines: string[] = [...KREA_WELCOME_TITLES, NEW_PAPER_LINE, KREA_RAINBOW_NAME]
  for (const c of KREA_COLORS) lines.push(KREA_COLOR_NAME[c])
  lines.push(...allSubjectLines(), ...allPageLines())
  return lines
}
