// "NEW IN THIS RELEASE" — the marker on what v1.3 added (owner, 2026-10-17).
//
// The four Krea games, Fyld Båden, and the two front-page doors they stand behind (Tal, Farver og Krea)
// carry three twinkling white stars (`NewSparkles`) until THAT CHILD has opened the game — a door until
// every new game behind it is opened (owner, 2026-10-17, reversing his first "whole release, every
// visit": after the first play the stars said something false and kept pulling him toward the same
// games). It replaced a soft gold halo the owner rejected as smudged and too wide. No text ("NY" is
// unreadable to the audience) and no emoji (CLAUDE.md).
//
// IT MUST NOT OUTLIVE 1.3. `newThisRelease.test.ts` reads package.json and goes RED the moment the
// version leaves 1.3.x, so bumping to 1.4.0 cannot ship with a stale glow. The 1.4 fix is to empty
// `NEW_GAME_IDS` (or point `NEW_RELEASE` at whatever 1.4 adds) — the plumbing stays for next time.
//
// Pure, no runtime imports beyond the door map, so a plain-Node test can read it.

import { DOORS, type DoorId } from './doors.ts'

/** The release whose additions glow. The guard pins it to package.json's major.minor. */
export const NEW_RELEASE = '1.3'

/** The games 1.3 added, as full gameIds. */
export const NEW_GAME_IDS: readonly string[] = [
  'math.boat',
  'krea.draw',
  'krea.guide',
  'krea.color',
  'krea.beads',
]

/** Does this game glow? */
export const isNewGame = (gameId: string): boolean => NEW_GAME_IDS.includes(gameId)

/** Does this door hold at least one new game? (Tal and Farver og Krea in 1.3.) */
export const isNewDoor = (doorId: DoorId): boolean =>
  DOORS.some((d) => d.id === doorId && d.games.some(isNewGame))

// ONCE OPENED, THE STARS GO (owner, 2026-10-17). `opened` is the child's own record (`newSeen`).

/** Does this game still sparkle for this child — new, and not opened yet? */
export const showsNewGame = (gameId: string, opened: ReadonlySet<string>): boolean =>
  isNewGame(gameId) && !opened.has(gameId)

/** Does this door still sparkle — does it hold a new game this child has not opened? */
export const showsNewDoor = (doorId: DoorId, opened: ReadonlySet<string>): boolean =>
  DOORS.some((d) => d.id === doorId && d.games.some((g) => showsNewGame(g, opened)))
