// Types for `scripts/mascot-ink.mjs` (plain `.mjs` so it runs with a bare `node`; `mascotInk.test.ts`
// imports its measurer rather than re-deriving the table).
import type { InkBox, MascotSprite } from '../src/theme/mascotInk.ts'

export const INK_ALPHA: number
export function inkBox(file: string): Promise<InkBox>
export function measureAll(): Promise<Record<string, Record<MascotSprite, InkBox>>>
