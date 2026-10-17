// The picture tray (Krea PRD-01 §2.2.5): EXISTING baked game art, no new renders — 24 pictures (owner,
// 2026-10-16: "we have plenty of items in the app"). Ids are stable data: a picture on a resumed paper
// is looked up by id, so renaming one drops it from a resumed picture. Names live in
// `config/kreaStamps.ts`, and `kreaStamps.test.ts` keeps the two lists identical.
//
// Left out on purpose: the beige Ordleg vehicles and house (they read unpainted next to the rest) and
// the English apple (its leaf is cut off at the top of the render).
import sol from '../../../assets/games/farver/sun.webp'
// The Farver heart has a flattened left lobe; Krea's is built whole from its right lobe (optimize-theme-art.mjs krea).
import hjerte from '../../../assets/games/krea/stamp-hjerte.webp'
import stjerne from '../../../assets/games/farver/star_yellow.webp'
import blomst from '../../../assets/games/farver/flower_orange.webp'
import fisk from '../../../assets/games/farver/fish_orange.webp'
import sommerfugl from '../../../assets/games/farver/butterfly_purple.webp'
import kat from '../../../assets/games/ordleg/kat.webp'
import hund from '../../../assets/games/english/dog.webp'
import trae from '../../../assets/games/english/tree.webp'
import sky from '../../../assets/games/english/cloud.webp'
import maane from '../../../assets/games/english/moon.webp'
import ballon from '../../../assets/games/farver/balloon_red.webp'
import mariehoene from '../../../assets/games/farver/ladybug.webp'
import froe from '../../../assets/games/farver/frog.webp'
import and from '../../../assets/games/english/duck.webp'
import fugl from '../../../assets/games/english/bird.webp'
import skildpadde from '../../../assets/games/farver/turtle.webp'
import hval from '../../../assets/games/farver/whale.webp'
import bold from '../../../assets/games/english/ball.webp'
import jordbaer from '../../../assets/games/farver/strawberry.webp'
import is from '../../../assets/games/english/icecream.webp'
import bjoern from '../../../assets/games/english/bear.webp'
import loeve from '../../../assets/games/english/lion.webp'
import raev from '../../../assets/games/farver/fox.webp'

export const STAMPS: Array<{ id: string; src: string }> = [
  { id: 'sol', src: sol },
  { id: 'hjerte', src: hjerte },
  { id: 'stjerne', src: stjerne },
  { id: 'blomst', src: blomst },
  { id: 'sommerfugl', src: sommerfugl },
  { id: 'trae', src: trae },
  { id: 'sky', src: sky },
  { id: 'maane', src: maane },
  { id: 'ballon', src: ballon },
  { id: 'bold', src: bold },
  { id: 'is', src: is },
  { id: 'jordbaer', src: jordbaer },
  { id: 'kat', src: kat },
  { id: 'hund', src: hund },
  { id: 'fisk', src: fisk },
  { id: 'fugl', src: fugl },
  { id: 'and', src: and },
  { id: 'froe', src: froe },
  { id: 'mariehoene', src: mariehoene },
  { id: 'skildpadde', src: skildpadde },
  { id: 'hval', src: hval },
  { id: 'bjoern', src: bjoern },
  { id: 'loeve', src: loeve },
  { id: 'raev', src: raev },
]

export const STAMP_URLS: Record<string, string> = Object.fromEntries(STAMPS.map((s) => [s.id, s.src]))
export const STAMP_IDS: ReadonlySet<string> = new Set(STAMPS.map((s) => s.id))
