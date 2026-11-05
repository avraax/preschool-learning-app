// Fyld Båden's landscape composition, in slot units (`--s`), as numbers a test can read.
//
// Jetty from the LEFT edge, its beginning always off-screen; the boat moored right beside it with the
// whole bow and the horn on screen. The row is [jetty column | boat column]; spare width grows the jetty
// column (flex-grow) up to `JETTY_COL_MAX_S`, past which it is open sea at the bow.
//
// Owner 2026-11-04 (feedback ZZATX on the iPad, F4E9D on an iPhone): the pier's beginning showed and the
// whole row slid right, pushing the bow and the horn off-screen. The column was a
// `clamp(5.8·s, 100cqw − 14·s, 10.6·s)` flex-basis, and its cap left the jetty's end exactly AT the stage
// edge — which is 32px into the screen (Container padding) or more (a phone's safe-area inset).

/** The jetty art's width. Most of it runs off the left edge. */
export const JETTY_W = 11
/** How far the jetty's bollard end reaches past its column, toward the boat's stern (landscape). */
export const JETTY_REACH_S = 0.4
/** The jetty column at its narrowest (a width-bound screen) and widest (spare width). */
export const JETTY_COL_MIN_S = 5.8
export const JETTY_COL_MAX_S = 8.6
/** The boat column: 0.9 of water at the stern + the 12.9-wide boat + 0.2 of air at the bow. */
export const BOAT_GAP_S = 0.9
export const BOAT_W_S = 12.9
export const BOW_AIR_S = 0.2
export const BOAT_COL_S = 14 // = BOAT_GAP_S + BOAT_W_S + BOW_AIR_S (a literal, so the CSS reads `* 14`)
/** `--s` divides the stage width by this, so a width-bound screen fits jetty-min + boat exactly. */
export const LANDSCAPE_BUDGET_S = 19.8
/** The least the jetty's left end may sit past the stage's left edge (≥ padding + safe area). */
export const JETTY_OFFSTAGE_MIN_S = 2

/** Where the jetty's left end lands relative to the stage's left edge, for a column of `colS`. */
export const jettyLeftS = (colS: number) => colS + JETTY_REACH_S - JETTY_W
