// Farvelæg's colour-in pages as DATA (Krea PRD-01 §2.2.8, §2.4, §4.4) — 18 per family, 4 families.
//
// The art is black-on-white line art (`art-src/krea/pages/<id>.jpg`): the first 12 the owner's Gemini
// renders, the other 60 rasterised from hand-authored SVG (closed shapes, no grey), turned into a transparent
// line layer + a lossless region label map by `scripts/krea-regions.mjs`, which writes the region
// counts and boxes to `kreaPageRegions.ts`. `outside` says what happens to the page's outside
// background: `drop` makes it paper you can't colour, `keep` a region like any other, `optional` a
// region the page finishes without. Every page is `optional`: a child may paint the sky or the paper
// behind the dog (owner 2026-11-04), but needn't to get the ✓.
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
  outside: 'drop' | 'keep' | 'optional'
}

export const KREA_PAGES: readonly KreaPage[] = [
  { id: 'hund', name: 'Hund', family: 'dyr', alive: 'sway', doneLine: 'Se, hunden logrer med halen!', outside: 'optional' },
  { id: 'ugle', name: 'Ugle', family: 'dyr', alive: 'flap', doneLine: 'Se, uglen basker med vingerne!', outside: 'optional' },
  { id: 'froe', name: 'Frø', family: 'dyr', alive: 'hop', doneLine: 'Se, frøen hopper!', outside: 'optional' },
  { id: 'strand', name: 'Strand', family: 'steder', alive: 'glow', doneLine: 'Se, solen skinner på stranden!', outside: 'optional' },
  { id: 'skov', name: 'Skov med svampe', family: 'steder', alive: 'sway', doneLine: 'Se, træerne svajer i vinden!', outside: 'optional' },
  { id: 'by', name: 'Byen om natten', family: 'steder', alive: 'glow', doneLine: 'Se, stjernerne blinker!', outside: 'optional' },
  { id: 'tog', name: 'Tog', family: 'ting', alive: 'drive', doneLine: 'Se, toget kører!', outside: 'optional' },
  { id: 'sejlbaad', name: 'Sejlbåd', family: 'ting', alive: 'swim', doneLine: 'Se, båden sejler!', outside: 'optional' },
  { id: 'is', name: 'Is', family: 'ting', alive: 'sway', doneLine: 'Se, isen danser!', outside: 'optional' },
  { id: 'enhjoerning', name: 'Enhjørning', family: 'fantasi', alive: 'hop', doneLine: 'Se, enhjørningen hopper!', outside: 'optional' },
  { id: 'rumskib', name: 'Rumskib', family: 'fantasi', alive: 'fly-up', doneLine: 'Se, rumskibet flyver!', outside: 'optional' },
  { id: 'drage', name: 'Dragen ved slottet', family: 'fantasi', alive: 'hop', doneLine: 'Se, dragen hopper!', outside: 'optional' },
  // The second set (2026-11-04): hand-authored SVG line art, 6 more per family.
  { id: 'kat', name: 'Kat', family: 'dyr', alive: 'hop', doneLine: 'Se, katten hopper!', outside: 'optional' },
  { id: 'fisk', name: 'Fisk', family: 'dyr', alive: 'swim', doneLine: 'Se, fisken svømmer!', outside: 'optional' },
  { id: 'sommerfugl', name: 'Sommerfugl', family: 'dyr', alive: 'flap', doneLine: 'Se, sommerfuglen flagrer!', outside: 'optional' },
  { id: 'kanin', name: 'Kanin', family: 'dyr', alive: 'hop', doneLine: 'Se, kaninen hopper!', outside: 'optional' },
  { id: 'skildpadde', name: 'Skildpadde', family: 'dyr', alive: 'drive', doneLine: 'Se, skildpadden går en tur!', outside: 'optional' },
  { id: 'elefant', name: 'Elefant', family: 'dyr', alive: 'sway', doneLine: 'Se, elefanten danser!', outside: 'optional' },
  { id: 'bondegaard', name: 'Bondegården', family: 'steder', alive: 'glow', doneLine: 'Se, solen skinner på gården!', outside: 'optional' },
  { id: 'havbund', name: 'Under havet', family: 'steder', alive: 'swim', doneLine: 'Se, fiskene svømmer!', outside: 'optional' },
  { id: 'have', name: 'Haven', family: 'steder', alive: 'sway', doneLine: 'Se, blomsterne svajer i vinden!', outside: 'optional' },
  { id: 'legeplads', name: 'Legepladsen', family: 'steder', alive: 'glow', doneLine: 'Se, solen skinner på legepladsen!', outside: 'optional' },
  { id: 'vinter', name: 'Snemand', family: 'steder', alive: 'glow', doneLine: 'Se, sneen glimter!', outside: 'optional' },
  { id: 'camping', name: 'Telt under stjernerne', family: 'steder', alive: 'glow', doneLine: 'Se, stjernerne blinker over teltet!', outside: 'optional' },
  { id: 'bil', name: 'Bil', family: 'ting', alive: 'drive', doneLine: 'Se, bilen kører!', outside: 'optional' },
  { id: 'brandbil', name: 'Brandbil', family: 'ting', alive: 'drive', doneLine: 'Se, brandbilen kører!', outside: 'optional' },
  { id: 'fly', name: 'Fly', family: 'ting', alive: 'fly-up', doneLine: 'Se, flyet letter!', outside: 'optional' },
  { id: 'ballon', name: 'Luftballon', family: 'ting', alive: 'fly-up', doneLine: 'Se, ballonen stiger op!', outside: 'optional' },
  { id: 'kage', name: 'Fødselsdagskage', family: 'ting', alive: 'glow', doneLine: 'Se, lysene skinner på kagen!', outside: 'optional' },
  { id: 'bamse', name: 'Bamse', family: 'ting', alive: 'sway', doneLine: 'Se, bamsen danser!', outside: 'optional' },
  { id: 'havfrue', name: 'Havfrue', family: 'fantasi', alive: 'swim', doneLine: 'Se, havfruen svømmer!', outside: 'optional' },
  { id: 'robot', name: 'Robot', family: 'fantasi', alive: 'hop', doneLine: 'Se, robotten hopper!', outside: 'optional' },
  { id: 'rumvaesen', name: 'Rumvæsen', family: 'fantasi', alive: 'fly-up', doneLine: 'Se, rumvæsenet flyver!', outside: 'optional' },
  { id: 'fe', name: 'Fe', family: 'fantasi', alive: 'flap', doneLine: 'Se, feen basker med vingerne!', outside: 'optional' },
  { id: 'slot', name: 'Slot', family: 'fantasi', alive: 'glow', doneLine: 'Se, slottet lyser op!', outside: 'optional' },
  { id: 'dino', name: 'Dinosaur', family: 'fantasi', alive: 'hop', doneLine: 'Se, dinoen hopper!', outside: 'optional' },
  // The third set (2026-11-04): 9 more per family, hand-authored SVG like the second.
  { id: 'loeve', name: 'Løve', family: 'dyr', alive: 'hop', doneLine: 'Se, løven hopper!', outside: 'optional' },
  { id: 'giraf', name: 'Giraf', family: 'dyr', alive: 'sway', doneLine: 'Se, giraffen svajer med halsen!', outside: 'optional' },
  { id: 'pingvin', name: 'Pingvin', family: 'dyr', alive: 'sway', doneLine: 'Se, pingvinen vralter!', outside: 'optional' },
  { id: 'gris', name: 'Gris', family: 'dyr', alive: 'hop', doneLine: 'Se, grisen hopper i mudderet!', outside: 'optional' },
  { id: 'ko', name: 'Ko', family: 'dyr', alive: 'sway', doneLine: 'Se, koen danser!', outside: 'optional' },
  { id: 'and', name: 'And', family: 'dyr', alive: 'swim', doneLine: 'Se, anden svømmer!', outside: 'optional' },
  { id: 'hest', name: 'Hest', family: 'dyr', alive: 'drive', doneLine: 'Se, hesten traver!', outside: 'optional' },
  { id: 'pindsvin', name: 'Pindsvin', family: 'dyr', alive: 'drive', doneLine: 'Se, pindsvinet går en tur!', outside: 'optional' },
  { id: 'hval', name: 'Hval', family: 'dyr', alive: 'swim', doneLine: 'Se, hvalen svømmer!', outside: 'optional' },
  { id: 'fyrtaarn', name: 'Fyrtårn', family: 'steder', alive: 'glow', doneLine: 'Se, fyrtårnet lyser!', outside: 'optional' },
  { id: 'karrusel', name: 'Karrusel', family: 'steder', alive: 'glow', doneLine: 'Se, karrusellen lyser op!', outside: 'optional' },
  { id: 'juletrae', name: 'Juletræet', family: 'steder', alive: 'glow', doneLine: 'Se, juletræet lyser!', outside: 'optional' },
  { id: 'efteraar', name: 'Efterår', family: 'steder', alive: 'sway', doneLine: 'Se, træet svajer i blæsten!', outside: 'optional' },
  { id: 'regnbue', name: 'Regnbuen', family: 'steder', alive: 'glow', doneLine: 'Se, regnbuen skinner!', outside: 'optional' },
  { id: 'hus', name: 'Huset', family: 'steder', alive: 'glow', doneLine: 'Se, solen skinner på huset!', outside: 'optional' },
  { id: 'bager', name: 'Bageren', family: 'steder', alive: 'glow', doneLine: 'Se, solen skinner på bageren!', outside: 'optional' },
  { id: 'palmeoe', name: 'Palmeøen', family: 'steder', alive: 'sway', doneLine: 'Se, palmen svajer i vinden!', outside: 'optional' },
  { id: 'vindmoelle', name: 'Vindmøllen', family: 'steder', alive: 'sway', doneLine: 'Se, møllen svajer i vinden!', outside: 'optional' },
  { id: 'bus', name: 'Bus', family: 'ting', alive: 'drive', doneLine: 'Se, bussen kører!', outside: 'optional' },
  { id: 'traktor', name: 'Traktor', family: 'ting', alive: 'drive', doneLine: 'Se, traktoren kører!', outside: 'optional' },
  { id: 'helikopter', name: 'Helikopter', family: 'ting', alive: 'fly-up', doneLine: 'Se, helikopteren letter!', outside: 'optional' },
  { id: 'cykel', name: 'Cykel', family: 'ting', alive: 'drive', doneLine: 'Se, cyklen kører!', outside: 'optional' },
  { id: 'ubaad', name: 'Ubåd', family: 'ting', alive: 'swim', doneLine: 'Se, ubåden sejler!', outside: 'optional' },
  { id: 'flyvedrage', name: 'Flyvedrage', family: 'ting', alive: 'fly-up', doneLine: 'Se, dragen flyver op!', outside: 'optional' },
  { id: 'paraply', name: 'Paraply', family: 'ting', alive: 'sway', doneLine: 'Se, paraplyen danser i regnen!', outside: 'optional' },
  { id: 'gave', name: 'Gaven', family: 'ting', alive: 'hop', doneLine: 'Se, gaven hopper!', outside: 'optional' },
  { id: 'frugt', name: 'Frugtskålen', family: 'ting', alive: 'hop', doneLine: 'Se, frugten hopper!', outside: 'optional' },
  { id: 'pirat', name: 'Piratskib', family: 'fantasi', alive: 'swim', doneLine: 'Se, piratskibet sejler!', outside: 'optional' },
  { id: 'nisse', name: 'Nisse', family: 'fantasi', alive: 'hop', doneLine: 'Se, nissen hopper!', outside: 'optional' },
  { id: 'troldmand', name: 'Troldmand', family: 'fantasi', alive: 'glow', doneLine: 'Se, tryllestaven glimter!', outside: 'optional' },
  { id: 'prinsesse', name: 'Prinsesse', family: 'fantasi', alive: 'sway', doneLine: 'Se, prinsessen danser!', outside: 'optional' },
  { id: 'ridder', name: 'Ridder', family: 'fantasi', alive: 'hop', doneLine: 'Se, ridderen hopper!', outside: 'optional' },
  { id: 'svampehus', name: 'Svampehuset', family: 'fantasi', alive: 'glow', doneLine: 'Se, svampehuset lyser op!', outside: 'optional' },
  { id: 'skattekiste', name: 'Skattekisten', family: 'fantasi', alive: 'glow', doneLine: 'Se, skatten glimter!', outside: 'optional' },
  { id: 'superhelt', name: 'Superhelt', family: 'fantasi', alive: 'fly-up', doneLine: 'Se, superhelten flyver!', outside: 'optional' },
  { id: 'tryllehat', name: 'Tryllehatten', family: 'fantasi', alive: 'hop', doneLine: 'Se, kaninen hopper op af hatten!', outside: 'optional' },
]

export const pageById = (id: string | null | undefined): KreaPage | undefined => KREA_PAGES.find((p) => p.id === id)

/** Every line Farvelæg can speak beyond the shared ones: each page's done line. */
export const allPageLines = (): string[] => KREA_PAGES.map((p) => p.doneLine)
