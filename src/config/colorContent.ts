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
}

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
export const DANISH_OBJECTS: Record<string, ColorObject[]> = {
  rød: [
    { objectName: 'æble', objectNameDefinite: 'æblet', art: 'apple', hex: '#dc2626', neuter: true },
    { objectName: 'bil', objectNameDefinite: 'bilen', art: 'car', hex: '#ef4444', neuter: false },
    { objectName: 'rose', objectNameDefinite: 'rosen', art: 'rose', hex: '#f87171', neuter: false },
    { objectName: 'jordbær', objectNameDefinite: 'jordbærret', art: 'strawberry', hex: '#991b1b', neuter: true }
  ],
  blå: [
    { objectName: 'hval', objectNameDefinite: 'hvalen', art: 'whale', hex: '#1d4ed8', neuter: false },
    { objectName: 'blåbær', objectNameDefinite: 'blåbærret', art: 'blueberry', hex: '#3730a3', neuter: true },
    { objectName: 'lastbil', objectNameDefinite: 'lastbilen', art: 'truck', hex: '#2563eb', neuter: false },
    { objectName: 'skjorte', objectNameDefinite: 'skjorten', art: 'shirt', hex: '#1e40af', neuter: false }
  ],
  grøn: [
    { objectName: 'agurk', objectNameDefinite: 'agurken', art: 'cucumber', hex: '#16a34a', neuter: false },
    { objectName: 'skildpadde', objectNameDefinite: 'skildpadden', art: 'turtle', hex: '#15803d', neuter: false },
    { objectName: 'kløver', objectNameDefinite: 'kløveren', art: 'clover', hex: '#166534', neuter: false },
    { objectName: 'træ', objectNameDefinite: 'træet', art: 'tree', hex: '#14532d', neuter: true }
  ],
  gul: [
    { objectName: 'sol', objectNameDefinite: 'solen', art: 'sun', hex: '#eab308', neuter: false },
    { objectName: 'banan', objectNameDefinite: 'bananen', art: 'banana', hex: '#facc15', neuter: false },
    { objectName: 'majs', objectNameDefinite: 'majsen', art: 'corn', hex: '#fde047', neuter: false },
    { objectName: 'kylling', objectNameDefinite: 'kyllingen', art: 'chick', hex: '#facc15', neuter: false }
  ],
  lilla: [
    { objectName: 'druer', objectNameDefinite: 'druerne', art: 'grapes', hex: '#a855f7', neuter: false },
    { objectName: 'aubergine', objectNameDefinite: 'auberginen', art: 'eggplant', hex: '#9333ea', neuter: false },
    { objectName: 'krystal', objectNameDefinite: 'krystallet', art: 'crystal', hex: '#7c3aed', neuter: true },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', art: 'heart', hex: '#8b5cf6', neuter: true }
  ],
  orange: [
    { objectName: 'appelsin', objectNameDefinite: 'appelsinen', art: 'orange_fruit', hex: '#f97316', neuter: false },
    { objectName: 'græskar', objectNameDefinite: 'græskarret', art: 'pumpkin', hex: '#ea580c', neuter: true },
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
