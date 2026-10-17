// The front page's DOORS (Category restructure PRD-01, `plans/category-restructure/`).
//
// A door is a VIEW over sections, never a new id. Home shows four doors — Bogstaver og Ord, Tal,
// Engelsk, Farver og Krea — while every `SectionId`, gameId, ledger key and difficulty table keeps its
// old name (PRD §2 A1): renaming ids would cost a schema migration for nothing the child sees. So this
// module is the ONE place that knows which section lives behind which door, in what order the games
// stand, and where a game's back arrow goes. Home, the door menus, every game's back route, the world
// framing and the adult difficulty rows all read it.
//
// GATED. The four doors ship in v1.3 together with Krea (owner, 2026-10-17), so every helper takes
// `fourDoors` — the runtime binding is `fourDoorsShown()` (`src/utils/fourDoors.ts`), which rides the
// Krea gate. With it false, production keeps today's five sections byte-identical. Release = delete the
// gate and the `false` branches here.
//
// Pure, no runtime imports: the prebake enumerator (`shared-narration-clips.js`) reads the spoken names.

import type { SectionId } from './progressSchema.ts'

export type DoorId = 'letters' | 'math' | 'english' | 'colors'

export interface Door {
  id: DoorId
  /** The child-facing name — under the door's icon, as the menu title, and spoken on arrival (D9). */
  label: string
  /** The door's menu. A merged door lives at its PRIMARY section's old menu route (A2). */
  route: string
  /** Whose accent, world framing and bloom slot the door wears (A3). */
  primary: SectionId
  /** Every section whose games stand behind the door. */
  members: readonly SectionId[]
  /** The games, IN MENU ORDER (D3), as full gameIds — `alphabet.learn` and `english.learn` share a
   *  bare id, so a door must never key by the bare one. */
  games: readonly string[]
}

/** The four doors, in home order left → right (D1). */
export const DOORS: readonly Door[] = [
  {
    id: 'letters',
    label: 'Bogstaver og Ord',
    route: '/alphabet',
    primary: 'alphabet',
    members: ['alphabet', 'ordleg'],
    // Letters → words: the learning progression (D3).
    games: ['alphabet.learn', 'alphabet.quiz', 'alphabet.memory', 'ordleg.read', 'ordleg.spelling'],
  },
  {
    id: 'math',
    label: 'Tal',
    route: '/math',
    primary: 'math',
    members: ['math'],
    // Today's order; Fyld Båden first (owner 2026-10-16) and still filtered by its own gate.
    games: [
      'math.boat',
      'math.numbers',
      'math.counting',
      'math.addition',
      'math.subtraction',
      'math.comparison',
      'math.patterns',
      'math.memory',
    ],
  },
  {
    id: 'english',
    label: 'Engelsk',
    route: '/english',
    primary: 'english',
    members: ['english'],
    games: ['english.listen', 'english.word', 'english.learn'],
  },
  {
    id: 'colors',
    label: 'Farver og Krea',
    route: '/farver',
    primary: 'colors',
    members: ['colors', 'krea'],
    // Colour learning, then Krea (D3) — the first row reads as the colour games, the second as crafts.
    games: [
      'colors.laer',
      'colors.farvequiz',
      'colors.farvejagt',
      'colors.nuancer',
      'colors.ram-farven',
      'krea.draw',
      'krea.guide',
      'krea.color',
      'krea.beads',
    ],
  },
]

/** Each section's OWN menu — the five-section world production still shows (and Krea's staging one). */
export const SECTION_MENU_ROUTE: Record<SectionId, string> = {
  alphabet: '/alphabet',
  math: '/math',
  colors: '/farver',
  english: '/english',
  ordleg: '/ordleg',
  krea: '/krea',
}

/** The door a section stands behind. Total over `SectionId` (`doors.test.ts`). */
export const doorOf = (section: SectionId): Door => {
  const door = DOORS.find((d) => d.members.includes(section))
  if (!door) throw new Error(`no door holds section "${section}"`)
  return door
}

/** Where a section's menu is — and therefore where every one of its games' back arrows goes (PRD T1). */
export const menuRouteFor = (section: SectionId, fourDoors: boolean): string =>
  fourDoors ? doorOf(section).route : SECTION_MENU_ROUTE[section]

/** Whose colours and world a section wears: its door's primary under four doors, itself otherwise. */
export const primarySectionFor = (section: SectionId, fourDoors: boolean): SectionId =>
  fourDoors ? doorOf(section).primary : section

/** The colour aliases four doors imply — every non-primary member → its door's primary. Empty when off. */
export const paletteAliasFor = (fourDoors: boolean): Partial<Record<SectionId, SectionId>> => {
  const alias: Partial<Record<SectionId, SectionId>> = {}
  if (!fourDoors) return alias
  for (const d of DOORS) for (const m of d.members) if (m !== d.primary) alias[m] = d.primary
  return alias
}

/** The section a gameId belongs to (`ordleg.read` → `ordleg`). */
export const sectionOfGame = (gameId: string): SectionId => gameId.slice(0, gameId.indexOf('.')) as SectionId

/** The bare tile id within its section (`colors.ram-farven` → `ram-farven`). */
export const tileIdOfGame = (gameId: string): string => gameId.slice(gameId.indexOf('.') + 1)

/** The door whose menu lives at `route`, if any (`/alphabet` → Bogstaver og Ord). */
export const doorAtRoute = (route: string): Door | undefined => DOORS.find((d) => d.route === route)

/**
 * The spoken door name (D9) — said once when the child arrives in a door's menu FROM HOME, never on the
 * way back from a game. It is the label itself, so what the child hears is what is printed under the
 * picture. Built here so the enumerator bakes exactly this string (audio-system.md protocol, step 1).
 */
export const doorNameLine = (door: Door): string => door.label

/** Every door-name line — the enumerator walks this. */
export const allDoorNameLines = (): string[] => DOORS.map(doorNameLine)
