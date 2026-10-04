// Section-qualified picture lookup (Game Depth PRD-01 §3.6). Bogstav Quiz shows pictures that live in
// OTHER sections' art folders, and their stems collide — `car`, `fish`, `apple`, `bird`, `star`,
// `flower`, `hat` exist in several folders as different pictures in different colours — so an
// unqualified fallback chain (like `ordlegArt`'s) would pick whichever map it checked first. An
// `ArtRef` names its folder. Nothing is copied: the alphabet folder is keyed by LETTER (its loader
// uppercases every stem), so a word picture dropped in there would register as a letter.
import type { ArtRef } from '../../config/letterWords'
import { alphabetArt } from './alphabet'
import { ordlegArtMap } from './ordleg'
import { englishArtMap } from './english'
import { farverArt } from './farver'
import { mathArt } from './math'
import { sharedArtMap } from './shared'

const MAPS: Record<string, Record<string, string>> = {
  alphabet: alphabetArt,
  ordleg: ordlegArtMap,
  english: englishArtMap,
  farver: farverArt,
  math: mathArt,
  shared: sharedArtMap,
}

/** The baked WebP URL for a section-qualified ref, or `undefined`. */
export const wordArt = (ref: ArtRef): string | undefined => {
  const slash = ref.indexOf('/')
  return MAPS[ref.slice(0, slash)]?.[ref.slice(slash + 1)]
}

export default wordArt
