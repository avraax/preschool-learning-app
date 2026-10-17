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

/** The grid letters. Upper case = the 8 strong crayons; lower case + W = the four light ones. */
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
  /** Said when the finished piece pops off the board — it DESCRIBES, never grades (PRD-01 §5). */
  doneLine: string
  grids: Record<BeadLevel, readonly string[]>
}

export interface BeadBoardDef {
  id: string
  name: string
  masks: Record<BeadLevel, readonly string[]>
}

const full = (n: number): string[] => Array.from({ length: n }, () => '#'.repeat(n))

// ----- the 8 patterns (§2.9), Let 10×10 · Normal 13×13 · Svær 16×16 ---------------------------------

export const BEAD_PATTERNS: readonly BeadPatternDef[] = [
  {
    id: 'hjerte',
    name: 'Hjerte',
    symmetric: true,
    doneLine: 'Se, hjertet hopper!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '................',
        '..RRRR....RRRR..',
        '.RppppR..RppppR.',
        'RpWWpppRRpppWWpR',
        'RpWppppppppppWpR',
        'RpWppRRppRRppWpR',
        'RpppRRRRRRRRpppR',
        'RpppRRRRRRRRpppR',
        '.RpppRRRRRRpppR.',
        '..RpppRRRRpppR..',
        '...RppppppppR...',
        '....RppppppR....',
        '.....RppppR.....',
        '......RppR......',
        '.......RR.......',
        '................',
      ],
    },
  },
  {
    id: 'sommerfugl',
    name: 'Sommerfugl',
    symmetric: true,
    doneLine: 'Se, sommerfuglen flagrer!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '...S........S...',
        '....S......S....',
        '.....S.NN.S.....',
        'LLL...SNNS...LLL',
        'LbbLL..NN..LLbbL',
        'LbBbLL.NN.LLbBbL',
        'LbbbLLLNNLLLbbbL',
        'LLLLLLLNNLLLLLLL',
        '.LLLLLLNNLLLLLL.',
        '..LLLLLNNLLLLL..',
        '..ppppLNNLpppp..',
        '.ppOOppNNppOOpp.',
        'ppOYOppNNppOYOpp',
        'pppOppp..pppOppp',
        '.ppppp....ppppp.',
        '..ppp......ppp..',
      ],
    },
  },
  {
    id: 'fisk',
    name: 'Fisk',
    symmetric: false,
    doneLine: 'Se, fisken svømmer!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '................',
        '......OOO.......',
        '.....OOOO.......',
        '....BBBBBBB.....',
        '..BBBbBbBBBB..OO',
        '.BWSBbBbBbBBBOOO',
        'BBSSBbBbBbBBBBOO',
        'BBBBBbBbBbBBBBBO',
        'BRRBBbBbBbBBBBBO',
        'BBBBBbBbBbBBBBOO',
        '.BBBBbBbBbBBBOOO',
        '..BBBbBbBBBB..OO',
        '....BBBBBBB.....',
        '......OO........',
        '.b..............',
        'b.b.............',
      ],
    },
  },
  {
    id: 'blomst',
    name: 'Blomst',
    symmetric: true,
    doneLine: 'Se, blomsten danser!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '.....pppppp.....',
        '...pppLLLLppp...',
        '..ppLLLLLLLLpp..',
        '..pLLpLLLLpLLp..',
        '.ppLpppLLpppLpp.',
        '.pLLppOYYOppLLp.',
        '.pLLpOYYYYOpLLp.',
        '..pLLpOYYOpLLp..',
        '...ppLLLLLLpp...',
        '.....pLLLLp.....',
        '.......GG.......',
        '..gg...GG...gg..',
        '.gGGg..GG..gGGg.',
        '..gGGg.GG.gGGg..',
        '....gGGGGGGg....',
        '......GGGG......',
      ],
    },
  },
  {
    id: 'stjerne',
    name: 'Stjerne',
    symmetric: true,
    doneLine: 'Se, stjernen funkler!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '.......YY.......',
        '.......YY.......',
        '......YYYY......',
        '......YOOY......',
        '.....YYOOYY.....',
        'YYYYYYOOOOYYYYYY',
        '.YYYYOOOOOOYYYY.',
        '..YYYYOOOOYYYY..',
        '...YYYYOOYYYY...',
        '....YYYYYYYY....',
        '....YYYYYYYY....',
        '...YYYY..YYYY...',
        '...YYY....YYY...',
        '..YYY......YYY..',
        '..YY........YY..',
        '.Y............Y.',
      ],
    },
  },
  {
    id: 'hus',
    name: 'Hus',
    symmetric: false,
    doneLine: 'Se, huset vipper!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        'YYY.........NN..',
        'YYY.....R...NN..',
        'YYY....RRR..NN..',
        '......RRRRR.NN..',
        '.....RRRRRRRNN..',
        '....RRRRRRRRRR..',
        '...RRRRRRRRRRRR.',
        '..RRRRRRRRRRRRRR',
        '...OOOOOOOOOOOO.',
        '...ObbbOOOObbbO.',
        '...ObWbOOOObWbO.',
        '...ObbbOOOObbbO.',
        '...OOOOONNOOOOO.',
        '...OOOOONNOOOOO.',
        '...OOOOONYOOOOO.',
        'GGpGGGGGNNGGGpGG',
      ],
    },
  },
  {
    id: 'kat',
    name: 'Kat',
    symmetric: false,
    doneLine: 'Se, katten hopper!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '.O............O.',
        '.ON..........NO.',
        '.OpO........OpO.',
        '.OppONNNNNNOppO.',
        '.ONOOOONNOOOONO.',
        'ONOOONONNONOOONO',
        'OOgggOOOOOOgggOO',
        'OgSSgOOOOOOgSSgO',
        'OOgggOOWWOOgggOO',
        'NNOOOOWppWOOOONN',
        'SSOOOWWppWWOOOSS',
        'OOSSOWWWWWWOSSOO',
        'SSNOOWWWWWWOONSS',
        '.NNOOOWWWWOOONN.',
        '..NNOOOOOOOONN..',
        '....NNOOOONN....',
      ],
    },
  },
  {
    id: 'regnbue',
    name: 'Regnbue',
    symmetric: true,
    doneLine: 'Se, regnbuen skinner!',
    grids: {
      let: [
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
      normal: [
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
      svaer: [
        '....RRRRRRRR....',
        '..RROOOOOOOORR..',
        '.ROOYYYYYYYYOOR.',
        '.ROYYggggggYYOR.',
        'ROYggGGGGGGggYOR',
        'ROYgGBBBBBBGgYOR',
        'ROYgGBbbbbBGgYOR',
        'ROYgGBbLLbBGgYOR',
        'ROYgGBb..bBGgYOR',
        'ROYgGBb..bBGgYOR',
        'ROYgGBb..bBGgYOR',
        'ROYgGBb..bBGgYOR',
        'WWWgGBb..bBGgWWW',
        'WWWWWBb..bBWWWWW',
        'WWWWWW....WWWWWW',
        '.WWWW......WWWW.',
      ],
    },
  },
]

// ----- the 5 free boards (§2.9) — shaped pegboards, anything goes anywhere ------------------------

export const BEAD_BOARDS: readonly BeadBoardDef[] = [
  { id: 'firkant', name: 'Firkant', masks: { let: full(10), normal: full(13), svaer: full(16) } },
  {
    id: 'cirkel',
    name: 'Cirkel',
    masks: {
      let: [
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
      normal: [
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
      svaer: [
        '.....######.....',
        '...##########...',
        '..############..',
        '.##############.',
        '.##############.',
        '################',
        '################',
        '################',
        '################',
        '################',
        '################',
        '.##############.',
        '.##############.',
        '..############..',
        '...##########...',
        '.....######.....',
      ],
    },
  },
  {
    id: 'hjerte',
    name: 'Hjerte',
    masks: {
      let: [
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
      normal: [
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
      svaer: [
        '................',
        '..####....####..',
        '.######..######.',
        '################',
        '################',
        '################',
        '################',
        '################',
        '.##############.',
        '..############..',
        '...##########...',
        '....########....',
        '.....######.....',
        '......####......',
        '.......##.......',
        '................',
      ],
    },
  },
  {
    id: 'stjerne',
    name: 'Stjerne',
    masks: {
      let: [
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
      normal: [
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
      svaer: [
        '.......##.......',
        '......####......',
        '......####......',
        '.....######.....',
        '.....######.....',
        '################',
        '.##############.',
        '..############..',
        '...##########...',
        '....########....',
        '....########....',
        '...##########...',
        '...####..####...',
        '..####....####..',
        '..###......###..',
        '.##..........##.',
      ],
    },
  },
  {
    id: 'fisk',
    name: 'Fisk',
    masks: {
      let: [
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
      normal: [
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
      svaer: [
        '................',
        '......###.......',
        '.....####.......',
        '....#######.....',
        '..##########..##',
        '.###############',
        '################',
        '################',
        '################',
        '################',
        '.###############',
        '..##########..##',
        '....#######.....',
        '......##........',
        '................',
        '................',
      ],
    },
  },
]

// ----- derived, never hand-typed --------------------------------------------------------------------

/** Every line Perleplade's patterns speak (the prebake enumerator walks `allKreaLines`, which calls this). */
export const allBeadLines = (): string[] => BEAD_PATTERNS.map((p) => p.doneLine)

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
  /** Svær's 16 a side can't reach 40 px in the iPad's 584 px; the owner accepted ~35 (2026-10-16). */
  svaerMinPitchPx: 35,
  /**
   * A bowl cell. The bowls stand in 2 columns beside the board (landscape), or in 3 ROWS under it
   * (portrait) — 3, not 2, so the pattern card and the way on fit beside them in that row (W3).
   *
   * Grown from 64 (owner, 2026-10-17: "the bowls and the beads in them are too small"; the heap beads
   * are a % of the bowl, so they grow with it). Each size is the most that costs the BOARD nothing it
   * needs: landscape 84 is exactly where the board stops being height-limited on the iPad stage (2×84+8
   * + side + gaps = 960 − 584), and 6 rows (6×84 + 5×8 = 544) still fit its 584 height; portrait 70
   * keeps Svær's 16×16 above its 35 px floor (`kreaBeads.test.ts` measures both).
   */
  bowlPx: 84,
  portraitBowlPx: 70,
  bowlGapPx: 8,
  portraitBowlRows: 3,
  /** The side column (landscape): the picker door, the pattern card, the way on. */
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
      : Math.min(stage.w, stage.h - (L.portraitBowlRows * L.portraitBowlPx + (L.portraitBowlRows - 1) * L.bowlGapPx) - L.gapPx)
  return box / (n + L.rimPitches)
}
