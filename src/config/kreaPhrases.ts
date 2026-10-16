// Everything Krea says (Krea PRD-01 §2.3.15), built here so the prebake enumerator can reach it
// (`.claude/rules/audio-system.md` protocol, step 1). Narration GUIDES, it is not chatty: the welcome,
// the colour name on pick, one DESCRIBING line on done, and the "Nyt papir?" confirm — silent while
// drawing.
//
// It DESCRIBES, it never grades or praises the product: "Du har brugt fire farver!", never "Sikke en
// flot tegning" (Lepper 1973 ran exactly this on preschoolers drawing; inflated praise backfires —
// Brummelman 2016). `kreaPhrases.test.ts` fails on "flot", "smuk" or "dygtig" in any Krea line.
//
// Explicit `.ts` extension: this module is in `shared-narration-clips.js`'s plain-Node import graph.

import { getDanishNumberText } from './danish-phrases.ts'
import { PALETTE_12, type CrayonColor } from './kreaPalette.ts'

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

/** The welcome titles = the tile titles (`categoryThemes.ts`). */
export const KREA_WELCOME_TITLES = ['Fri Tegning', 'Tegn med Mig', 'Farvelæg'] as const

/** The discard confirm, spoken because a 5-year-old can't read "Er du sikker?" (§2.1.4). */
export const NEW_PAPER_TITLE = 'Nyt papir?'
export const NEW_PAPER_LINE = 'Vil du have et nyt papir? Din tegning forsvinder.'

/** The most crayons a picture can use — the bound the enumerator bakes up to. */
export const KREA_MAX_COLORS = PALETTE_12.length

/**
 * Fri Tegning's done line: "Du har brugt {n} farver!" — n = distinct palette crayons inked (rainbow
 * and glitter are brushes, stamps are pictures). n = 1 says "én farve" (the stressed form, not "en").
 * A picture made only of rainbow, glitter or stamps has NO palette colour, so it gets the line that
 * describes what the picture is doing instead of "Du har brugt nul farver".
 */
export const DRAW_ALIVE_LINE = 'Se, din tegning danser!'
export function colorsUsedLine(n: number): string {
  if (n <= 0) return DRAW_ALIVE_LINE
  if (n === 1) return 'Du har brugt én farve!'
  return `Du har brugt ${getDanishNumberText(Math.min(n, KREA_MAX_COLORS))} farver!`
}

/** Every Krea line the app can speak — the enumerator walks this, and the guards read it too. */
export function allKreaLines(): string[] {
  const lines: string[] = [...KREA_WELCOME_TITLES, NEW_PAPER_LINE, DRAW_ALIVE_LINE]
  for (const c of KREA_COLORS) lines.push(KREA_COLOR_NAME[c])
  for (let n = 1; n <= KREA_MAX_COLORS; n++) lines.push(colorsUsedLine(n))
  return lines
}
