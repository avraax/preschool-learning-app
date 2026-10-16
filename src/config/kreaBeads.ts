// Perleplade's content (Krea PRD-02 §2.9, §3, §4.4) — pure data, so the board model, the tests and (in
// W3) the narration enumerator read ONE source. Patterns are hand-authored STRING GRIDS, one per level
// (one char per peg, `.` = not part of the pattern), never a Let grid scaled up; free boards are peg
// MASKS (`#` = a peg) over the same square grid, not Hama's hex offset, so a tap target stays a square.
//
// Every count a child sees (the legend's ● 12) is DERIVED from the grid here, never hand-typed — a typo
// in a row would otherwise show one number and need another. `kreaBeads.test.ts` holds §4.4's guards:
// each grid fits its level's board, uses only that level's palette, no legend count passes 100 (the
// prebaked number range), Svær is not Let resized, and the symmetric ones ARE symmetric.
//
// Explicit `.ts` extensions: this module will join `shared-narration-clips.js`'s plain-Node graph (W3).

import { KREA_BEADS, type DifficultyLevel } from './difficulty.ts'
import { paletteFor, PALETTE_12, type CrayonColor } from './kreaPalette.ts'

/** The grid letters. Upper case = Let's 8 crayons; lower case + W = the four light ones (Normal and up). */
export const BEAD_LEGEND: Record<string, CrayonColor> = {
  R: 'roed',
  O: 'orange',
  Y: 'gul',
  G: 'groen',
  B: 'blaa',
  L: 'lilla',
  N: 'brun',
  S: 'sort',
  g: 'lysegroen',
  b: 'lyseblaa',
  p: 'lyseroed',
  W: 'hvid',
}

export type BeadLevel = DifficultyLevel

export interface BeadPatternDef {
  id: string
  /** Danish, for assistive tech and probes (the card itself is a picture). */
  name: string
  /** Mirror-symmetric about the vertical axis, colours included — tested, so a typo in a row shows. */
  symmetric: boolean
  grids: Record<BeadLevel, readonly string[]>
}

export interface BeadBoardDef {
  id: string
  name: string
  masks: Record<BeadLevel, readonly string[]>
}

const full = (n: number): string[] => Array.from({ length: n }, () => '#'.repeat(n))

// ----- the 8 patterns (§2.9), Let 7×7 · Normal 10×10 · Svær 13×13 ---------------------------------

export const BEAD_PATTERNS: readonly BeadPatternDef[] = [
  {
    id: 'hjerte',
    name: 'Hjerte',
    symmetric: true,
    grids: {
      let: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
      normal: [
        '..........',
        '.RRR..RRR.',
        'RRRRRRRRRR',
        'RRppRRppRR',
        'RRppppppRR',
        'RRRppppRRR',
        '.RRRppRRR.',
        '..RRRRRR..',
        '...RRRR...',
        '....RR....',
      ],
      svaer: [
        '.............',
        '..RRR...RRR..',
        '.RRRRR.RRRRR.',
        'RRWRRRRRRRWRR',
        'RWRRRRRRRRRWR',
        'RRRRRpppRRRRR',
        'RRRRpppppRRRR',
        '.RRRRpppRRRR.',
        '..RRRRpRRRR..',
        '...RRRRRRR...',
        '....RRRRR....',
        '.....RRR.....',
        '......R......',
      ],
    },
  },
  {
    id: 'sommerfugl',
    name: 'Sommerfugl',
    symmetric: true,
    grids: {
      let: ['LL...LL', 'LYLNLYL', 'LLLNLLL', '.LLNLL.', 'OOLNLOO', 'OYO.OYO', '.O...O.'],
      normal: [
        'LL......LL',
        'LLL.NN.LLL',
        'LYLLNNLLYL',
        'LLLLNNLLLL',
        '.LLLNNLLL.',
        '..LLNNLL..',
        '.OOONNOOO.',
        'OObONNObOO',
        'OOOO..OOOO',
        '.OO....OO.',
      ],
      svaer: [
        '....S...S....',
        '.....S.S.....',
        'LLL...N...LLL',
        'LpLLL.N.LLLpL',
        'LppLLLNLLLppL',
        'LLLLLLNLLLLLL',
        '.LLLLLNLLLLL.',
        '..LLLLNLLLL..',
        '..OOOONOOOO..',
        '.OObOONOObOO.',
        'OObbOONOObbOO',
        'OOOOO.N.OOOOO',
        '.OOO.....OOO.',
      ],
    },
  },
  {
    id: 'fisk',
    name: 'Fisk',
    symmetric: false,
    grids: {
      let: ['.......', '.BBB..O', 'BSBBBOO', 'BBBBBBO', 'BBBBBOO', '.BBB..O', '.......'],
      normal: [
        '..........',
        '...BBBB...',
        '..BBBBBB.O',
        '.BSBbBBBOO',
        'BBBBbBBBOO',
        'BBBBbBBBBO',
        '.BBBbBBBOO',
        '..BBBBBB.O',
        '...BBBB...',
        '..........',
      ],
      svaer: [
        '.............',
        '....OOO......',
        '...BBBBBB...O',
        '..BBBBBBBB.OO',
        '.BWSBbBbBBBOO',
        'BBBBBbBbBBBBO',
        'BRBBBbBbBBBBO',
        '.BBBBbBbBBBOO',
        '..BBBBBBBB.OO',
        '...BBBBBB...O',
        '.....OO......',
        '.............',
        '.............',
      ],
    },
  },
  {
    id: 'blomst',
    name: 'Blomst',
    symmetric: true,
    grids: {
      let: ['..RRR..', '.RRYRR.', '.RYYYR.', '.RRYRR.', '..RRR..', 'GG.G.GG', '...G...'],
      normal: [
        '...RRRR...',
        '..RRppRR..',
        '.RRpYYpRR.',
        '.RpYYYYpR.',
        '.RpYYYYpR.',
        '.RRpYYpRR.',
        '..RRRRRR..',
        '....GG....',
        '.GG.GG.GG.',
        '..GGGGGG..',
      ],
      svaer: [
        '.....LLL.....',
        '..LL.LLL.LL..',
        '.LLLLLLLLLLL.',
        '..LLLYYYLLL..',
        '.LLLYYOYYLLL.',
        '..LLLYYYLLL..',
        '.LLLLLLLLLLL.',
        '..LL.LGL.LL..',
        '......G......',
        '.GGG..G..GGG.',
        '..GGG.G.GGG..',
        '....GGGGG....',
        '.....GGG.....',
      ],
    },
  },
  {
    id: 'stjerne',
    name: 'Stjerne',
    symmetric: true,
    grids: {
      let: ['...Y...', '...Y...', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YY.YY.', '.Y...Y.'],
      normal: [
        '....YY....',
        '....YY....',
        '...YYYY...',
        'YYYYYYYYYY',
        '.YYYOOYYY.',
        '..YYOOYY..',
        '..YYYYYY..',
        '.YYYYYYYY.',
        '.YYY..YYY.',
        'YY......YY',
      ],
      svaer: [
        '......Y......',
        '.....YYY.....',
        '.....YYY.....',
        '....YYYYY....',
        'YYYYYYOYYYYYY',
        '.YYYYOOOYYYY.',
        '..YYYOOOYYY..',
        '...YYYOYYY...',
        '...YYYYYYY...',
        '..YYYY.YYYY..',
        '..YYY...YYY..',
        '.YYY.....YYY.',
        '.YY.......YY.',
      ],
    },
  },
  {
    id: 'hus',
    name: 'Hus',
    symmetric: false,
    grids: {
      let: ['...R...', '..RRR..', '.RRRRR.', '.YYYYY.', '.YBYBY.', '.YYNYY.', 'GGGGGGG'],
      normal: [
        '....RR..N.',
        '...RRRR.N.',
        '..RRRRRRN.',
        '.RRRRRRRR.',
        'RRRRRRRRRR',
        '.YbbYYbbY.',
        '.YbbYYbbY.',
        '.YYYNNYYY.',
        '.YYYNNYYY.',
        'GGGGGGGGGG',
      ],
      svaer: [
        'YY....R......',
        'YY...RRR.....',
        '....RRRRR....',
        '...RRRRRRR...',
        '..RRRRRRRRR..',
        '.RRRRRRRRRRR.',
        '..OOOOOOOOO..',
        '..ObbOOObbO..',
        '..ObbOOObbO..',
        '..OOONNNOOO..',
        '..OOONNNOOO..',
        '..OOONNNOOO..',
        'GpGGGGGGGGGpG',
      ],
    },
  },
  {
    id: 'kat',
    name: 'Kat',
    symmetric: false,
    grids: {
      let: ['O.....O', 'OO...OO', 'OOOOOOO', 'OGOOOGO', 'OOOSOOO', '.OOOOO.', '..OOO..'],
      normal: [
        '.O......O.',
        '.OO....OO.',
        '.OpO..OpO.',
        '.OOOOOOOO.',
        'OOGSOOSGOO',
        'OOOOOOOOOO',
        'OOOOppOOOO',
        '.OOOSSOOO.',
        '..OOOOOO..',
        '...OOOO...',
      ],
      svaer: [
        '.O.........O.',
        '.OO.......OO.',
        '.OpO.....OpO.',
        '.OOOONONOOOO.',
        'OOGGGOOOGGGOO',
        'OOGSGOOOGSGOO',
        'ONOOOOOOOOONO',
        'OOOOOOpOOOOOO',
        'SSOOOOOOOOOSS',
        'OOOOOpOpOOOOO',
        'SSOOOOOOOOOSS',
        '.OOOOOOOOOOO.',
        '.............',
      ],
    },
  },
  {
    id: 'regnbue',
    name: 'Regnbue',
    symmetric: true,
    grids: {
      let: ['.RRRRR.', 'RROOORR', 'ROOYOOR', 'ROYYYOR', 'ROYGYOR', 'ROYGYOR', 'ROYGYOR'],
      normal: [
        '..RRRRRR..',
        '.RROOOORR.',
        'RROOYYOORR',
        'ROOYYYYOOR',
        'ROYYGGYYOR',
        'ROYGGGGYOR',
        'ROYGBBGYOR',
        'ROYGBBGYOR',
        'ROYG..GYOR',
        'ROYG..GYOR',
      ],
      svaer: [
        '....RRRRR....',
        '..RROOOOORR..',
        '.ROOYYYYYOOR.',
        '.ROYYGGGYYOR.',
        'ROYGGBBBGGYOR',
        'ROYGBBLBBGYOR',
        'ROYGBLLLBGYOR',
        'ROYGBL.LBGYOR',
        'ROYGBL.LBGYOR',
        'ROYGBL.LBGYOR',
        'WWWGBL.LBGWWW',
        'WWWWW...WWWWW',
        '.WWW.....WWW.',
      ],
    },
  },
]

// ----- the 5 free boards (§2.9) — shaped pegboards, anything goes anywhere ------------------------

export const BEAD_BOARDS: readonly BeadBoardDef[] = [
  { id: 'firkant', name: 'Firkant', masks: { let: full(7), normal: full(10), svaer: full(13) } },
  {
    id: 'cirkel',
    name: 'Cirkel',
    masks: {
      let: ['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],
      normal: [
        '...####...',
        '.########.',
        '.########.',
        '##########',
        '##########',
        '##########',
        '##########',
        '.########.',
        '.########.',
        '...####...',
      ],
      svaer: [
        '....#####....',
        '..#########..',
        '.###########.',
        '.###########.',
        '#############',
        '#############',
        '#############',
        '#############',
        '#############',
        '.###########.',
        '.###########.',
        '..#########..',
        '....#####....',
      ],
    },
  },
  {
    id: 'hjerte',
    name: 'Hjerte',
    masks: {
      let: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
      normal: [
        '.###..###.',
        '##########',
        '##########',
        '##########',
        '##########',
        '.########.',
        '..######..',
        '...####...',
        '....##....',
        '..........',
      ],
      svaer: [
        '..###...###..',
        '.#####.#####.',
        '#############',
        '#############',
        '#############',
        '#############',
        '.###########.',
        '..#########..',
        '...#######...',
        '....#####....',
        '.....###.....',
        '......#......',
        '.............',
      ],
    },
  },
  {
    id: 'stjerne',
    name: 'Stjerne',
    masks: {
      let: ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
      normal: [
        '....##....',
        '....##....',
        '...####...',
        '##########',
        '.########.',
        '..######..',
        '..######..',
        '.###..###.',
        '.##....##.',
        '##......##',
      ],
      svaer: [
        '......#......',
        '.....###.....',
        '.....###.....',
        '....#####....',
        '#############',
        '.###########.',
        '..#########..',
        '...#######...',
        '...#######...',
        '..####.####..',
        '..###...###..',
        '.###.....###.',
        '.##.......##.',
      ],
    },
  },
  {
    id: 'fisk',
    name: 'Fisk',
    masks: {
      let: ['.......', '.###..#', '#######', '#######', '#######', '.###..#', '.......'],
      normal: [
        '..........',
        '..####...#',
        '.######.##',
        '##########',
        '##########',
        '##########',
        '.######.##',
        '..####...#',
        '..........',
        '..........',
      ],
      svaer: [
        '.............',
        '....####.....',
        '...######...#',
        '.#########.##',
        '##########.##',
        '#############',
        '#############',
        '#############',
        '##########.##',
        '.#########.##',
        '...######...#',
        '....###......',
        '.............',
      ],
    },
  },
]

// ----- derived, never hand-typed --------------------------------------------------------------------

export const boardSize = (level: BeadLevel): number => KREA_BEADS[level].board
export const beadPalette = (level: BeadLevel): readonly CrayonColor[] => paletteFor(KREA_BEADS[level].palette)

export const patternById = (id: string | null | undefined): BeadPatternDef | undefined => BEAD_PATTERNS.find((p) => p.id === id)
export const boardById = (id: string | null | undefined): BeadBoardDef | undefined => BEAD_BOARDS.find((b) => b.id === id)

/** A pattern's target colour per peg (row-major), `null` where the pattern has no bead. */
export function patternCells(def: BeadPatternDef, level: BeadLevel): (CrayonColor | null)[] {
  return def.grids[level].flatMap((row) => [...row].map((ch) => (ch === '.' ? null : (BEAD_LEGEND[ch] ?? null))))
}

/** A free board's pegs (row-major): true where there is a peg. */
export function boardMask(def: BeadBoardDef, level: BeadLevel): boolean[] {
  return def.masks[level].flatMap((row) => [...row].map((ch) => ch === '#'))
}

/** The legend: how many beads of each colour, in palette order, colours that occur only. */
export function legendCounts(cells: readonly (CrayonColor | null)[]): Array<[CrayonColor, number]> {
  const n = new Map<CrayonColor, number>()
  for (const c of cells) if (c) n.set(c, (n.get(c) ?? 0) + 1)
  return PALETTE_12.filter((c) => n.has(c)).map((c) => [c, n.get(c)!])
}

// ----- the reserved layout (§4.2) — the component reads these same numbers ------------------------

/**
 * The bead studio's fixed columns and rows, in CSS px on a tablet. The board is the REMAINDER (a flex
 * cell, never a tuned percentage); these are what it is the remainder OF, so the pitch test below and the
 * component cannot disagree. The stage rects are the shell's measured game stage on the iPad (WebKit,
 * iPad UA, 2026-10-16: `[data-krea-stage]` 960×584 at 1024×768, 704×848 at 768×1024).
 */
export const BEAD_LAYOUT = {
  minPitchPx: 40,
  /** A bowl cell; the bowls stand in 2 columns beside the board (landscape) or 2 rows under it (portrait). */
  bowlPx: 64,
  bowlGapPx: 8,
  /** The side column: the way on (and the pattern card, W3). */
  sidePx: 168,
  gapPx: 16,
  /** The board's plastic rim, in pitches (half a pitch round the outer pegs). */
  rimPitches: 0.6,
  ipadStage: { landscape: { w: 960, h: 584 }, portrait: { w: 704, h: 848 } },
} as const

/** The peg pitch a square board of `n` pegs gets in a stage rect, after the reserved bowls and side. */
export function boardPitch(n: number, stage: { w: number; h: number }, orientation: 'landscape' | 'portrait'): number {
  const L = BEAD_LAYOUT
  const bowlsAcross = 2 * L.bowlPx + L.bowlGapPx
  const box =
    orientation === 'landscape'
      ? Math.min(stage.w - bowlsAcross - L.sidePx - 2 * L.gapPx, stage.h)
      : Math.min(stage.w, stage.h - bowlsAcross - L.gapPx)
  return box / (n + L.rimPitches)
}
