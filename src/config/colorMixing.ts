// Ram Farven's colour-mixing recipes — educational DATA, never themeable (like `colorContent.ts`).
//
// This moved out of `RamFarvenGame.tsx` on 2026-08-02 for one reason: the game speaks lines built from
// these recipes ("rød og blå bliver lilla", "Lav lilla farve ved at blande farverne"), and
// `shared-narration-clips.js` can only import `src/config/*.ts` — data stranded in a .tsx can never be
// enumerated, so those clips silently stayed live/unauditioned. The game still owns everything else
// (pot mechanics, difficulty pools, the recipe reveal UI).

export interface ColorDroplet {
  id: string
  color: string
  colorName: string
  hex: string
  isUsed: boolean
}

export interface TargetColor {
  color: string
  name: string
  hex: string
}

/** The 5 droppable source colours (3 primaries + white/black for tints and shades). */
export const primaryColors: ColorDroplet[] = [
  { id: 'red', color: 'rød', colorName: 'rød', hex: '#EF4444', isUsed: false },
  { id: 'blue', color: 'blå', colorName: 'blå', hex: '#3B82F6', isUsed: false },
  { id: 'yellow', color: 'gul', colorName: 'gul', hex: '#FDE047', isUsed: false },
  { id: 'white', color: 'hvid', colorName: 'hvid', hex: '#F8FAFC', isUsed: false },
  { id: 'black', color: 'sort', colorName: 'sort', hex: '#1F2937', isUsed: false }
]

/** The 9 mixable goals. The difficulty pools that gate them stay in the game. */
export const possibleTargets: TargetColor[] = [
  // Secondary colors (two primaries)
  { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  { color: 'orange', name: 'orange', hex: '#F97316' },
  { color: 'grøn', name: 'grøn', hex: '#10B981' },
  // Tints (primary + white)
  { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  // Shades (primary + black) and grey
  { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  { color: 'grå', name: 'grå', hex: '#9CA3AF' }
]

/** Both orders are listed so a mix is order-independent; the SPOKEN line is built per key, so
 *  "rød og blå bliver lilla" and "blå og rød bliver lilla" are both real (and both prebaked). */
export const mixingRules: Record<string, TargetColor> = {
  // Secondaries
  'rød+blå': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  'blå+rød': { color: 'lilla', name: 'lilla', hex: '#A855F7' },
  'rød+gul': { color: 'orange', name: 'orange', hex: '#F97316' },
  'gul+rød': { color: 'orange', name: 'orange', hex: '#F97316' },
  'blå+gul': { color: 'grøn', name: 'grøn', hex: '#10B981' },
  'gul+blå': { color: 'grøn', name: 'grøn', hex: '#10B981' },
  // Tints (+ white)
  'rød+hvid': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  'hvid+rød': { color: 'lyserød', name: 'lyserød', hex: '#FFB3BA' },
  'blå+hvid': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  'hvid+blå': { color: 'lyseblå', name: 'lyseblå', hex: '#BFDBFE' },
  'gul+hvid': { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  'hvid+gul': { color: 'lysegul', name: 'lysegul', hex: '#FEF9C3' },
  // Shades (+ black)
  'rød+sort': { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  'sort+rød': { color: 'mørkerød', name: 'mørkerød', hex: '#991B1B' },
  'blå+sort': { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  'sort+blå': { color: 'mørkeblå', name: 'mørkeblå', hex: '#1E3A8A' },
  'sort+hvid': { color: 'grå', name: 'grå', hex: '#9CA3AF' },
  'hvid+sort': { color: 'grå', name: 'grå', hex: '#9CA3AF' }
}
