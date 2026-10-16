// Farvelæg's colour-in pages as DATA (Krea PRD-01 §2.2.8, §2.4, §4.4) — 3 per family, 4 families.
//
// The art is the owner's Gemini line art (`art-src/krea/pages/<id>.jpg`), turned into a transparent
// line layer + a lossless region label map by `scripts/krea-regions.mjs`, which writes the region
// counts and boxes to `kreaPageRegions.ts`. `outside` says what happens to the page's outside
// background: `drop` makes it paper you can't colour (a subject on its own — the dog, the ice cream),
// `keep` makes it a region like any other (a scene whose background is a sky).
//
// The done line DESCRIBES the alive motion, never grades ("Se, toget kører!").
//
// Explicit `.ts` extensions: this module is in `shared-narration-clips.js`'s plain-Node import graph.

import type { AlivePreset, KreaFamily } from './kreaSubjects.ts'

export interface KreaPage {
  id: string
  name: string
  family: KreaFamily
  alive: AlivePreset
  doneLine: string
  outside: 'drop' | 'keep'
}

export const KREA_PAGES: readonly KreaPage[] = [
  { id: 'hund', name: 'Hund', family: 'dyr', alive: 'sway', doneLine: 'Se, hunden logrer med halen!', outside: 'drop' },
  { id: 'ugle', name: 'Ugle', family: 'dyr', alive: 'flap', doneLine: 'Se, uglen basker med vingerne!', outside: 'drop' },
  { id: 'froe', name: 'Frø', family: 'dyr', alive: 'hop', doneLine: 'Se, frøen hopper!', outside: 'drop' },
  { id: 'strand', name: 'Strand', family: 'steder', alive: 'glow', doneLine: 'Se, solen skinner på stranden!', outside: 'drop' },
  { id: 'skov', name: 'Skov med svampe', family: 'steder', alive: 'sway', doneLine: 'Se, træerne svajer i vinden!', outside: 'drop' },
  { id: 'by', name: 'Byen om natten', family: 'steder', alive: 'glow', doneLine: 'Se, stjernerne blinker!', outside: 'drop' },
  { id: 'tog', name: 'Tog', family: 'ting', alive: 'drive', doneLine: 'Se, toget kører!', outside: 'drop' },
  { id: 'sejlbaad', name: 'Sejlbåd', family: 'ting', alive: 'swim', doneLine: 'Se, båden sejler!', outside: 'drop' },
  { id: 'is', name: 'Is', family: 'ting', alive: 'sway', doneLine: 'Se, isen danser!', outside: 'drop' },
  { id: 'enhjoerning', name: 'Enhjørning', family: 'fantasi', alive: 'hop', doneLine: 'Se, enhjørningen hopper!', outside: 'drop' },
  { id: 'rumskib', name: 'Rumskib', family: 'fantasi', alive: 'fly-up', doneLine: 'Se, rumskibet flyver!', outside: 'drop' },
  { id: 'drage', name: 'Dragen ved slottet', family: 'fantasi', alive: 'hop', doneLine: 'Se, dragen hopper!', outside: 'drop' },
]

export const pageById = (id: string | null | undefined): KreaPage | undefined => KREA_PAGES.find((p) => p.id === id)

/** Every line Farvelæg can speak beyond the shared ones: each page's done line. */
export const allPageLines = (): string[] => KREA_PAGES.map((p) => p.doneLine)
