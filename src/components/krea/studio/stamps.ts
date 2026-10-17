// The stamp tray (Krea PRD-01 §2.2.5): EXISTING baked game art, no new renders. Ids are stable data —
// a stamp on a resumed paper is looked up by id, so renaming one drops it from a resumed picture.
import sol from '../../../assets/games/farver/sun.webp'
// The Farver heart has a flattened left lobe; Krea's is built whole from its right lobe (optimize-theme-art.mjs krea).
import hjerte from '../../../assets/games/krea/stamp-hjerte.webp'
import stjerne from '../../../assets/games/farver/star_yellow.webp'
import blomst from '../../../assets/games/farver/flower_orange.webp'
import fisk from '../../../assets/games/farver/fish_orange.webp'
import sommerfugl from '../../../assets/games/farver/butterfly_purple.webp'
import kat from '../../../assets/games/ordleg/kat.webp'
import hund from '../../../assets/games/english/dog.webp'

export const STAMPS: Array<{ id: string; src: string }> = [
  { id: 'sol', src: sol },
  { id: 'hjerte', src: hjerte },
  { id: 'stjerne', src: stjerne },
  { id: 'blomst', src: blomst },
  { id: 'fisk', src: fisk },
  { id: 'sommerfugl', src: sommerfugl },
  { id: 'kat', src: kat },
  { id: 'hund', src: hund },
]

export const STAMP_URLS: Record<string, string> = Object.fromEntries(STAMPS.map((s) => [s.id, s.src]))
export const STAMP_IDS: ReadonlySet<string> = new Set(STAMPS.map((s) => s.id))
