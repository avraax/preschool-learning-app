// Shared educational color content for the Farver (Colors) section.
//
// This data is the single source of truth for every color game (Farvejagt, Hvilken Farve?,
// Nuancer, Lær Farver). Per the project rule, **educational colors are NOT themeable** — these
// hexes/names are content, not theme tokens, and must read true regardless of the active skin.

export interface ColorObject {
  objectName: string          // indefinite Danish noun ("æble")
  objectNameDefinite: string  // definite form ("æblet") — used in spoken reinforcement
  art: string                 // baked soft-3D art id (src/assets/games/farver/<art>.webp) → colorObjectArt()
  hex: string                 // the object's true color (drives the draggable tile color)
  neuter: boolean             // true = et-word (neuter gender) → color predicate takes -t ("rødt")
  quizSafe?: boolean          // false = picture contradicts its color → excluded from Hvilken Farve?
  canonical?: boolean         // false = the object's color is NOT world knowledge → never askable
  obvious?: boolean           // false = colour is real but not unambiguous at 5 → held back from Let
}

/**
 * Which objects Hvilken Farve? asks from (per-level, see `COLORS_QUIZ` in `difficulty.ts`).
 *
 * The object is DESATURATED at every level, so the pool is a FAIRNESS surface: the child answers from
 * what they know about the subject, never from the picture.
 *
 * `all`     — every canonical subject (18). Normal and Svær.
 * `obvious` — only the subjects whose colour a Danish 5-year-old holds without hesitation (12), so a
 *             cob of corn that reads yellow-and-green or a blue-grey whale can't cost the easiest
 *             level a question. Let.
 */
export type ColorPool = 'obvious' | 'all'

// Neuter (-t) forms of the declinable base colors. Common-gender objects speak the base name;
// lilla/orange are indeclinable (no -t form). Used so the spoken "{objektet} er {farve}" echo
// agrees grammatically ("æblet er rødt", not "æblet er rød").
const NEUTER_COLOR: Record<string, string> = {
  rød: 'rødt',
  blå: 'blåt',
  grøn: 'grønt',
  gul: 'gult',
}

/** The spoken color word agreeing with the object's gender: neuter (et-words) → the -t form. */
export const spokenColor = (hue: string, neuter: boolean): string =>
  neuter ? (NEUTER_COLOR[hue] ?? hue) : hue

// Real-world objects grouped by their color — the curated shared set (PRD-09 §4, owner-locked §6.1):
// exactly 4 per hue = 24, each with a baked soft-3D `art` id (src/assets/games/farver/<art>.webp)
// rendered in the hue's TRUE colour so it reads correct with no coloured backing tile. Trimmed from
// the old ~36 by dropping the `quizSafe:false` items (emoji that contradict their colour) and
// near-duplicate roles. Reused by Farvejagt (hunt + distractors), Hvilken Farve? (dragged object),
// and Lær Farver (examples). `objectName`/`objectNameDefinite` are unchanged for every retained
// object so the spoken echoes stay identical (no new narration → no prebake/audit cycle).
//
// TWO independent "not askable in Hvilken Farve?" flags, because they record different reasons:
//
// `canonical: false` marks the objects whose colour is a PROPERTY OF THIS PICTURE rather than world
// knowledge — a car, a shirt and a crystal can be any colour, and this `hjerte` is authored lilla
// while any child would answer rød. The object is desaturated at EVERY level now (Difficulty PRD-02),
// so these six have no right answer anywhere and leave the quiz entirely. That is 18 of the 24 left,
// with grøn/gul/orange at four each and rød/blå/lilla at two — guarded in `colorContent.test.ts`,
// which is also where to look after adding art for a canonical red or blue.
//
// `obvious: false` marks the six whose colour IS real world knowledge but not unambiguous to a Danish
// 5-year-old (a cob reads yellow-and-green, whales read blue-grey, pumpkins also come white). They are
// asked at Normal/Svær and held back from Let's pool — one of Let's four easing axes now that the
// reveal axis is gone. Default-true by omission, the same convention as `canonical`.
export const DANISH_OBJECTS: Record<string, ColorObject[]> = {
  rød: [
    { objectName: 'æble', objectNameDefinite: 'æblet', art: 'apple', hex: '#dc2626', neuter: true },
    { objectName: 'bil', objectNameDefinite: 'bilen', art: 'car', hex: '#ef4444', neuter: false, canonical: false },
    { objectName: 'rose', objectNameDefinite: 'rosen', art: 'rose', hex: '#f87171', neuter: false, canonical: false },
    { objectName: 'jordbær', objectNameDefinite: 'jordbærret', art: 'strawberry', hex: '#991b1b', neuter: true }
  ],
  blå: [
    // A whale reads blue-GREY as often as blue — real, but not what Let should hinge on.
    { objectName: 'hval', objectNameDefinite: 'hvalen', art: 'whale', hex: '#1d4ed8', neuter: false, obvious: false },
    { objectName: 'blåbær', objectNameDefinite: 'blåbærret', art: 'blueberry', hex: '#3730a3', neuter: true },
    { objectName: 'lastbil', objectNameDefinite: 'lastbilen', art: 'truck', hex: '#2563eb', neuter: false, canonical: false },
    { objectName: 'skjorte', objectNameDefinite: 'skjorten', art: 'shirt', hex: '#1e40af', neuter: false, canonical: false }
  ],
  grøn: [
    { objectName: 'agurk', objectNameDefinite: 'agurken', art: 'cucumber', hex: '#16a34a', neuter: false },
    // Turtles read brown to a child, and kløver is an unfamiliar subject at 5 — both Normal-and-up.
    { objectName: 'skildpadde', objectNameDefinite: 'skildpadden', art: 'turtle', hex: '#15803d', neuter: false, obvious: false },
    { objectName: 'kløver', objectNameDefinite: 'kløveren', art: 'clover', hex: '#166534', neuter: false, obvious: false },
    { objectName: 'træ', objectNameDefinite: 'træet', art: 'tree', hex: '#14532d', neuter: true }
  ],
  gul: [
    { objectName: 'sol', objectNameDefinite: 'solen', art: 'sun', hex: '#eab308', neuter: false },
    { objectName: 'banan', objectNameDefinite: 'bananen', art: 'banana', hex: '#facc15', neuter: false },
    // A cob reads yellow-AND-green (husk + kernels), so it is not a clean gul question.
    { objectName: 'majs', objectNameDefinite: 'majsen', art: 'corn', hex: '#fde047', neuter: false, obvious: false },
    { objectName: 'kylling', objectNameDefinite: 'kyllingen', art: 'chick', hex: '#facc15', neuter: false }
  ],
  lilla: [
    { objectName: 'druer', objectNameDefinite: 'druerne', art: 'grapes', hex: '#a855f7', neuter: false },
    // Aubergine's colour is not world knowledge at 5 (and the subject itself often isn't either).
    { objectName: 'aubergine', objectNameDefinite: 'auberginen', art: 'eggplant', hex: '#9333ea', neuter: false, obvious: false },
    { objectName: 'krystal', objectNameDefinite: 'krystallet', art: 'crystal', hex: '#7c3aed', neuter: true, canonical: false },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', art: 'heart', hex: '#8b5cf6', neuter: true, canonical: false }
  ],
  orange: [
    { objectName: 'appelsin', objectNameDefinite: 'appelsinen', art: 'orange_fruit', hex: '#f97316', neuter: false },
    // Pumpkins also come white and green, so orange is a likely answer rather than a certain one.
    { objectName: 'græskar', objectNameDefinite: 'græskarret', art: 'pumpkin', hex: '#ea580c', neuter: true, obvious: false },
    { objectName: 'ræv', objectNameDefinite: 'ræven', art: 'fox', hex: '#ea580c', neuter: false },
    { objectName: 'gulerod', objectNameDefinite: 'guleroden', art: 'carrot', hex: '#f97316', neuter: false }
  ]
}

// Hunt-target options (Farvejagt) — the 6 vivid colors with their spoken prompts.
export const COLOR_TARGETS = [
  { color: 'rød', phrase: 'Find alle røde ting' },
  { color: 'blå', phrase: 'Find alle blå ting' },
  { color: 'grøn', phrase: 'Find alle grønne ting' },
  { color: 'gul', phrase: 'Find alle gule ting' },
  { color: 'lilla', phrase: 'Find alle lilla ting' },
  { color: 'orange', phrase: 'Find alle orange ting' }
]

// A representative "true" swatch hex per hue (for quiz options / browse headers). Uses the base
// (middle) shade so the color reads canonically.
export const COLOR_SWATCH: Record<string, string> = {
  rød: '#EF4444',
  blå: '#3B82F6',
  grøn: '#22C55E',
  gul: '#FDE047',
  lilla: '#A855F7',
  orange: '#F97316'
}

export interface ColorShade {
  name: string  // Danish shade name (spoken + shown)
  hex: string
}

// Per-hue shade families, ordered LIGHT → DARK. Drives Nuancer (ordering) + Lær Farver (browse).
// Three steps per hue keeps the names natural and the lightness gaps readable for a young child.
export const SHADES: Record<string, ColorShade[]> = {
  rød: [
    { name: 'lyserød', hex: '#FCA5A5' },
    { name: 'rød', hex: '#EF4444' },
    { name: 'mørkerød', hex: '#991B1B' }
  ],
  blå: [
    { name: 'lyseblå', hex: '#BFDBFE' },
    { name: 'blå', hex: '#3B82F6' },
    { name: 'mørkeblå', hex: '#1E3A8A' }
  ],
  grøn: [
    { name: 'lysegrøn', hex: '#86EFAC' },
    { name: 'grøn', hex: '#22C55E' },
    { name: 'mørkegrøn', hex: '#166534' }
  ],
  gul: [
    { name: 'lysegul', hex: '#FEF08A' },
    { name: 'gul', hex: '#FDE047' },
    { name: 'mørkegul', hex: '#CA8A04' }
  ],
  lilla: [
    { name: 'lys lilla', hex: '#E9D5FF' },
    { name: 'lilla', hex: '#A855F7' },
    { name: 'mørk lilla', hex: '#6B21A8' }
  ],
  orange: [
    { name: 'lys orange', hex: '#FED7AA' },
    { name: 'orange', hex: '#F97316' },
    { name: 'mørk orange', hex: '#C2410C' }
  ]
}

// Stable hue order for browse grids / round rotation.
export const HUE_ORDER = ['rød', 'blå', 'grøn', 'gul', 'lilla', 'orange'] as const

// The same 6 hues in COLOUR-WHEEL order (Difficulty PRD-01 W4). `HUE_ORDER` is a display order — its
// neighbours are rød/blå and grøn/gul, which is not what a child confuses — so adjacency has to come
// from the wheel instead: rød → orange → gul → grøn → blå → lilla → back to rød. That's what makes
// Hvilken Farve?'s Svær ("adjacent hues only") the real pairs, rød/orange and blå/lilla, and Let
// ("non-adjacent") genuinely far apart. CYCLIC: the last entry neighbours the first.
export const HUE_WHEEL = ['rød', 'orange', 'gul', 'grøn', 'blå', 'lilla'] as const

/** The two wheel neighbours of a hue (wrapping), or `[]` for an unknown hue. */
export const adjacentHues = (hue: string): string[] => {
  const i = HUE_WHEEL.indexOf(hue as (typeof HUE_WHEEL)[number])
  if (i < 0) return []
  const n = HUE_WHEEL.length
  return [HUE_WHEEL[(i - 1 + n) % n], HUE_WHEEL[(i + 1) % n]]
}

// ---- Hvilken Farve? content pool -----------------------------------------------------------------

/** Questions in one Hvilken Farve? round. Exported so the game AND the pool guard read ONE value. */
export const COLORS_QUIZ_ROUND = 8

/** One asked object, flattened out of `DANISH_OBJECTS` with its hue attached. */
export interface QuizObject {
  color: string
  objectName: string
  objectNameDefinite: string
  art: string
  neuter: boolean
}

/**
 * The objects Hvilken Farve? may ask from a given pool.
 *
 * Both pools drop `quizSafe:false` (a picture that contradicts its own colour) AND `canonical:false`
 * (a greyed-out car has no right answer, and the object is greyed at every level now) — 18 objects.
 * `'obvious'` additionally drops `obvious:false`, leaving Let the 12 subjects whose colour is
 * unambiguous at 5. Pure + module-level data, so `colorContent.test.ts` can assert neither pool ever
 * falls below `COLORS_QUIZ_ROUND`.
 */
export const quizObjectPool = (pool: ColorPool): QuizObject[] =>
  HUE_ORDER.flatMap((color) =>
    (DANISH_OBJECTS[color] ?? [])
      .filter((o) => o.quizSafe !== false && o.canonical !== false && (pool === 'all' || o.obvious !== false))
      .map((o) => ({
        color,
        objectName: o.objectName,
        objectNameDefinite: o.objectNameDefinite,
        art: o.art,
        neuter: o.neuter,
      })),
  )
