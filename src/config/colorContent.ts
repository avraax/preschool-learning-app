// Shared educational color content for the Farver (Colors) section.
//
// This data is the single source of truth for every color game (Farvejagt, Hvilken Farve?,
// Nuancer, Lær Farver). Per the project rule, **educational colors are NOT themeable** — these
// hexes/names are content, not theme tokens, and must read true regardless of the active skin.

export interface ColorObject {
  objectName: string          // indefinite Danish noun ("æble")
  objectNameDefinite: string  // definite form ("æblet") — used in spoken reinforcement
  emoji: string
  hex: string                 // the object's true color (drives the draggable tile color)
}

// Real-world objects grouped by their color. Each color has 5-7 child-recognisable items.
export const DANISH_OBJECTS: Record<string, ColorObject[]> = {
  rød: [
    { objectName: 'æble', objectNameDefinite: 'æblet', emoji: '🍎', hex: '#dc2626' },
    { objectName: 'bil', objectNameDefinite: 'bilen', emoji: '🚗', hex: '#ef4444' },
    { objectName: 'rose', objectNameDefinite: 'rosen', emoji: '🌹', hex: '#f87171' },
    { objectName: 'bold', objectNameDefinite: 'bolden', emoji: '⚽', hex: '#b91c1c' },
    { objectName: 'jordbær', objectNameDefinite: 'jordbæret', emoji: '🍓', hex: '#991b1b' },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', emoji: '❤️', hex: '#dc2626' },
    { objectName: 'hat', objectNameDefinite: 'hatten', emoji: '👒', hex: '#ef4444' }
  ],
  blå: [
    { objectName: 'hav', objectNameDefinite: 'havet', emoji: '🌊', hex: '#3b82f6' },
    { objectName: 'lastbil', objectNameDefinite: 'lastbilen', emoji: '🚙', hex: '#2563eb' },
    { objectName: 'hval', objectNameDefinite: 'hvalen', emoji: '🐳', hex: '#1d4ed8' },
    { objectName: 'skjorte', objectNameDefinite: 'skjorten', emoji: '👔', hex: '#1e40af' },
    { objectName: 'blåbær', objectNameDefinite: 'blåbæret', emoji: '🫐', hex: '#3730a3' },
    { objectName: 'himmel', objectNameDefinite: 'himlen', emoji: '☁️', hex: '#60a5fa' }
  ],
  grøn: [
    { objectName: 'blad', objectNameDefinite: 'bladet', emoji: '🌿', hex: '#22c55e' },
    { objectName: 'agurk', objectNameDefinite: 'agurken', emoji: '🥒', hex: '#16a34a' },
    { objectName: 'skildpadde', objectNameDefinite: 'skildpadden', emoji: '🐢', hex: '#15803d' },
    { objectName: 'kløver', objectNameDefinite: 'kløveren', emoji: '🍀', hex: '#166534' },
    { objectName: 'træ', objectNameDefinite: 'træet', emoji: '🌳', hex: '#14532d' },
    { objectName: 'salat', objectNameDefinite: 'salaten', emoji: '🥬', hex: '#22c55e' }
  ],
  gul: [
    { objectName: 'sol', objectNameDefinite: 'solen', emoji: '☀️', hex: '#eab308' },
    { objectName: 'banan', objectNameDefinite: 'bananen', emoji: '🍌', hex: '#facc15' },
    { objectName: 'majs', objectNameDefinite: 'majsen', emoji: '🌽', hex: '#fde047' },
    { objectName: 'stjerne', objectNameDefinite: 'stjernen', emoji: '⭐', hex: '#f59e0b' },
    { objectName: 'smør', objectNameDefinite: 'smørret', emoji: '🧈', hex: '#fbbf24' },
    { objectName: 'kylling', objectNameDefinite: 'kyllingen', emoji: '🐥', hex: '#facc15' }
  ],
  lilla: [
    { objectName: 'druer', objectNameDefinite: 'druerne', emoji: '🍇', hex: '#a855f7' },
    { objectName: 'aubergine', objectNameDefinite: 'auberginen', emoji: '🍆', hex: '#9333ea' },
    { objectName: 'krystal', objectNameDefinite: 'krystallet', emoji: '🔮', hex: '#7c3aed' },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', emoji: '💜', hex: '#8b5cf6' },
    { objectName: 'blomst', objectNameDefinite: 'blomsten', emoji: '🌸', hex: '#a855f7' }
  ],
  orange: [
    { objectName: 'appelsin', objectNameDefinite: 'appelsinen', emoji: '🍊', hex: '#f97316' },
    { objectName: 'græskar', objectNameDefinite: 'græskaret', emoji: '🎃', hex: '#ea580c' },
    { objectName: 'ræv', objectNameDefinite: 'ræven', emoji: '🦊', hex: '#ea580c' },
    { objectName: 'gulerod', objectNameDefinite: 'guleroden', emoji: '🥕', hex: '#f97316' },
    { objectName: 'hjerte', objectNameDefinite: 'hjertet', emoji: '🧡', hex: '#fb923c' },
    { objectName: 'fersken', objectNameDefinite: 'ferskenen', emoji: '🍑', hex: '#fdba74' }
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
