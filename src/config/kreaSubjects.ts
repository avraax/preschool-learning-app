// Tegn med Mig's subjects as DATA (Krea PRD-01 §2.2.7, §2.4, §4.3) — 18 per family, 4 families (12 at v1,
// 36 and then 72 in 2026-11); it grows by adding entries, never code.
//
// Each subject is ≤ 6 steps, and each step NAMES a shape ("Tegn en stor cirkel til hovedet") — the shape
// is the lesson, so the guide is built from shapes (`kreaShapes.ts`), not free paths. Every step line is a
// WHOLE sentence, one prebaked clip, never stitched (§4.9). A `mirror` step is drawn on the left of the
// subject's vertical centre line and appears on the right as the child draws (§4.3) — symmetry lives
// here and in Perleplade, nowhere else.
//
// The done line DESCRIBES the alive motion and never grades the picture ("Se, fisken svømmer!", never
// "flot"); `kreaPhrases.test.ts` enforces it.
//
// Explicit `.ts` extensions: this module is in `shared-narration-clips.js`'s plain-Node import graph.

import type { Shape } from './kreaShapes.ts'

export type KreaFamily = 'dyr' | 'steder' | 'ting' | 'fantasi'
export const KREA_FAMILIES: readonly KreaFamily[] = ['dyr', 'steder', 'ting', 'fantasi']

/** The "comes alive" presets (`components/krea/studio/alive.ts`, §4.5). */
export type AlivePreset = 'hop' | 'swim' | 'fly-up' | 'flap' | 'sway' | 'drive' | 'glow'

export interface GuideStep {
  shapes: Shape[]
  /** The spoken instruction — a whole sentence, prebaked. */
  line: string
  /** Drawn on the left of x = 500, mirrored live onto the right. */
  mirror?: boolean
}

export interface KreaSubject {
  id: string
  name: string
  family: KreaFamily
  alive: AlivePreset
  doneLine: string
  steps: GuideStep[]
}

/**
 * The task-XP normaliser for a finished guided or colour-in piece (§2.5): one piece ≈ half a round. A
 * piece takes 1–3 minutes, about a quiz round, so this is a slight damp on purpose (Lepper 1973). The
 * same at every level — XP never depends on difficulty.
 */
export const KREA_TASKS_IN_ROUND = 2

/** The vertical centre line every mirror step reflects across, in subject units. */
export const MIRROR_AXIS = 500

const line = (x0: number, y0: number, x1: number, y1: number): Shape => ({ kind: 'poly', pts: [x0, y0, x1, y1] })
const rect = (x0: number, y0: number, x1: number, y1: number): Shape => ({ kind: 'poly', pts: [x0, y0, x1, y0, x1, y1, x0, y1], closed: true })
const circle = (cx: number, cy: number, r: number): Shape => ({ kind: 'circle', cx, cy, r })

/** Short rays around a sun. */
const rays = (cx: number, cy: number, r0: number, r1: number, n = 8): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n
    return line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
  })

/** A five-pointed star as one closed zigzag, point up. */
const star = (cx: number, cy: number, r0: number, r1: number): Shape => ({
  kind: 'poly',
  closed: true,
  pts: Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? r1 : r0
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]
  }).flat(),
})

const petals = (cx: number, cy: number, dist: number, r: number, n = 5): Shape[] =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n
    return circle(Math.round(cx + Math.cos(a) * dist), Math.round(cy + Math.sin(a) * dist), r)
  })

export const KREA_SUBJECTS: readonly KreaSubject[] = [
  // ----- Dyr ---------------------------------------------------------------------------------------
  {
    id: 'kat',
    name: 'Kat',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, katten hopper!',
    steps: [
      { shapes: [circle(500, 520, 260)], line: 'Tegn en stor cirkel til kattens hoved.' },
      { shapes: [{ kind: 'poly', pts: [285, 340, 300, 130, 430, 275] }, { kind: 'poly', pts: [570, 275, 700, 130, 715, 340] }], line: 'Tegn to trekanter til ørerne.' },
      { shapes: [circle(410, 470, 40), circle(590, 470, 40)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'poly', pts: [465, 570, 535, 570, 500, 615], closed: true }], line: 'Tegn en lille trekant til næsen.' },
      { shapes: [line(380, 600, 170, 565), line(380, 645, 170, 665), line(620, 600, 830, 565), line(620, 645, 830, 665)], line: 'Tegn fire lange streger til knurhårene.' },
    ],
  },
  {
    id: 'fisk',
    name: 'Fisk',
    family: 'dyr',
    alive: 'swim',
    doneLine: 'Se, fisken svømmer!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 440, cy: 520, rx: 300, ry: 180 }], line: 'Tegn en stor oval til fiskens krop.' },
      { shapes: [{ kind: 'poly', pts: [730, 520, 930, 360, 930, 680], closed: true }], line: 'Tegn en trekant til halen.' },
      { shapes: [circle(270, 470, 38)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'curve', pts: [360, 350, 450, 200, 570, 355] }], line: 'Tegn en bue til finnen.' },
      { shapes: [circle(120, 300, 28), circle(90, 190, 20)], line: 'Tegn to små cirkler til boblerne.' },
    ],
  },
  {
    id: 'sommerfugl',
    name: 'Sommerfugl',
    family: 'dyr',
    alive: 'flap',
    doneLine: 'Se, sommerfuglen flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 540, rx: 40, ry: 230 }], line: 'Tegn en lang oval til sommerfuglens krop.' },
      { shapes: [{ kind: 'curve', pts: [470, 430, 320, 170, 120, 250, 150, 460, 470, 500] }], line: 'Tegn en stor vinge. Den anden vinge kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'curve', pts: [470, 560, 260, 560, 200, 730, 330, 790, 470, 640] }], line: 'Tegn en lille vinge nedenunder.', mirror: true },
      { shapes: [circle(280, 350, 45)], line: 'Tegn en prik på vingen.', mirror: true },
      { shapes: [{ kind: 'curve', pts: [485, 310, 455, 210, 390, 150] }], line: 'Tegn en buet streg til følehornet.', mirror: true },
    ],
  },
  {
    id: 'hund',
    name: 'Hund',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, hunden hopper!',
    steps: [
      { shapes: [circle(500, 480, 230)], line: 'Tegn en stor cirkel til hundens hoved.' },
      { shapes: [{ kind: 'ellipse', cx: 260, cy: 500, rx: 65, ry: 170 }, { kind: 'ellipse', cx: 740, cy: 500, rx: 65, ry: 170 }], line: 'Tegn to ovaler til ørerne.' },
      { shapes: [circle(415, 420, 38), circle(585, 420, 38)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 525, rx: 60, ry: 40 }], line: 'Tegn en lille oval til næsen.' },
      { shapes: [{ kind: 'curve', pts: [415, 615, 500, 690, 585, 615] }], line: 'Tegn en bue til munden.' },
    ],
  },
  {
    id: 'kanin',
    name: 'Kanin',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, kaninen hopper!',
    steps: [
      { shapes: [circle(500, 610, 220)], line: 'Tegn en stor cirkel til kaninens hoved.' },
      { shapes: [{ kind: 'ellipse', cx: 405, cy: 230, rx: 55, ry: 160 }, { kind: 'ellipse', cx: 595, cy: 230, rx: 55, ry: 160 }], line: 'Tegn to lange ovaler til ørerne.' },
      { shapes: [circle(420, 560, 38), circle(580, 560, 38)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'poly', pts: [465, 650, 535, 650, 500, 695], closed: true }], line: 'Tegn en lille trekant til næsen.' },
      { shapes: [line(400, 680, 180, 640), line(400, 720, 180, 760), line(600, 680, 820, 640), line(600, 720, 820, 760)], line: 'Tegn fire lange streger til knurhårene.' },
    ],
  },
  {
    id: 'ugle',
    name: 'Ugle',
    family: 'dyr',
    alive: 'flap',
    doneLine: 'Se, uglen basker med vingerne!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 570, rx: 220, ry: 300 }], line: 'Tegn en stor oval til uglens krop.' },
      { shapes: [circle(415, 460, 70)], line: 'Tegn en cirkel til øjet. Det andet øje kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [460, 560, 540, 560, 500, 630], closed: true }], line: 'Tegn en lille trekant til næbbet.' },
      { shapes: [{ kind: 'curve', pts: [285, 450, 120, 600, 295, 800] }], line: 'Tegn en bue til vingen. Den anden vinge kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [330, 360, 300, 190, 420, 290] }], line: 'Tegn en trekant til øret.', mirror: true },
    ],
  },
  {
    id: 'fugl',
    name: 'Fugl',
    family: 'dyr',
    alive: 'fly-up',
    doneLine: 'Se, fuglen flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 460, cy: 600, rx: 250, ry: 170 }], line: 'Tegn en stor oval til fuglens krop.' },
      { shapes: [circle(680, 390, 110)], line: 'Tegn en cirkel til hovedet.' },
      { shapes: [{ kind: 'poly', pts: [785, 350, 900, 395, 785, 440], closed: true }], line: 'Tegn en lille trekant til næbbet.' },
      { shapes: [circle(705, 365, 28)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'curve', pts: [270, 540, 360, 320, 530, 500] }], line: 'Tegn en bue til vingen.' },
      { shapes: [{ kind: 'poly', pts: [215, 600, 60, 490, 60, 710], closed: true }], line: 'Tegn en trekant til halen.' },
    ],
  },
  {
    id: 'snegl',
    name: 'Snegl',
    family: 'dyr',
    alive: 'drive',
    doneLine: 'Se, sneglen kravler!',
    steps: [
      { shapes: [circle(420, 465, 220)], line: 'Tegn en stor cirkel til sneglens hus.' },
      { shapes: [circle(420, 465, 100)], line: 'Tegn en lille cirkel inde i huset.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 770, rx: 400, ry: 70 }], line: 'Tegn en lang oval til kroppen.' },
      { shapes: [line(800, 710, 760, 540), line(860, 715, 910, 550)], line: 'Tegn to streger til følehornene.' },
      { shapes: [circle(755, 510, 30), circle(915, 520, 30)], line: 'Tegn to små cirkler til øjnene.' },
    ],
  },
  {
    id: 'skildpadde',
    name: 'Skildpadde',
    family: 'dyr',
    alive: 'swim',
    doneLine: 'Se, skildpadden svømmer!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 460, cy: 620, r: 280, from: 180, to: 360 }, line(180, 620, 740, 620)], line: 'Tegn en stor bue til skjoldet.' },
      { shapes: [circle(830, 540, 90)], line: 'Tegn en cirkel til hovedet.' },
      { shapes: [{ kind: 'poly', pts: [250, 620, 250, 740, 340, 740, 340, 620] }, { kind: 'poly', pts: [580, 620, 580, 740, 670, 740, 670, 620] }], line: 'Tegn to små firkanter til benene.' },
      { shapes: [circle(460, 480, 75)], line: 'Tegn en cirkel på skjoldet.' },
      { shapes: [circle(855, 515, 25)], line: 'Tegn en lille cirkel til øjet.' },
    ],
  },
  {
    id: 'gris',
    name: 'Gris',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, grisen hopper!',
    steps: [
      { shapes: [circle(500, 520, 260)], line: 'Tegn en stor cirkel til grisens hoved.' },
      { shapes: [{ kind: 'poly', pts: [305, 320, 320, 170, 430, 265] }, { kind: 'poly', pts: [570, 265, 680, 170, 695, 320] }], line: 'Tegn to trekanter til ørerne.' },
      { shapes: [circle(410, 430, 35), circle(590, 430, 35)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 590, rx: 120, ry: 80 }], line: 'Tegn en oval til trynen.' },
      { shapes: [circle(455, 590, 28), circle(545, 590, 28)], line: 'Tegn to små cirkler til næseborene.' },
    ],
  },
  {
    id: 'mus',
    name: 'Mus',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, musen hopper!',
    steps: [
      { shapes: [circle(500, 570, 220)], line: 'Tegn en stor cirkel til musens hoved.' },
      { shapes: [circle(290, 300, 120), circle(710, 300, 120)], line: 'Tegn to store cirkler til ørerne.' },
      { shapes: [circle(420, 520, 35), circle(580, 520, 35)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [circle(500, 620, 35)], line: 'Tegn en lille cirkel til næsen.' },
      { shapes: [line(420, 640, 170, 600), line(420, 680, 170, 720), line(580, 640, 830, 600), line(580, 680, 830, 720)], line: 'Tegn fire lange streger til knurhårene.' },
    ],
  },
  {
    id: 'and',
    name: 'And',
    family: 'dyr',
    alive: 'swim',
    doneLine: 'Se, anden svømmer!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 450, cy: 620, rx: 280, ry: 160 }], line: 'Tegn en stor oval til andens krop.' },
      { shapes: [circle(680, 390, 110)], line: 'Tegn en cirkel til hovedet.' },
      { shapes: [{ kind: 'ellipse', cx: 835, cy: 410, rx: 75, ry: 35 }], line: 'Tegn en lille oval til næbbet.' },
      { shapes: [circle(700, 360, 28)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'curve', pts: [260, 600, 400, 470, 560, 610] }], line: 'Tegn en bue til vingen.' },
      { shapes: [{ kind: 'curve', pts: [40, 870, 160, 810, 280, 870, 400, 810, 520, 870, 640, 810, 760, 870, 880, 810, 960, 860] }], line: 'Tegn en bølget streg til vandet.' },
    ],
  },
  {
    id: 'froe',
    name: 'Frø',
    family: 'dyr',
    alive: 'hop',
    doneLine: 'Se, frøen hopper!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 620, rx: 300, ry: 210 }], line: 'Tegn en stor oval til frøens krop.' },
      { shapes: [circle(360, 380, 90), circle(640, 380, 90)], line: 'Tegn to cirkler til øjnene.' },
      { shapes: [circle(360, 380, 32), circle(640, 380, 32)], line: 'Tegn to små cirkler inde i øjnene.' },
      { shapes: [{ kind: 'curve', pts: [350, 600, 500, 730, 650, 600] }], line: 'Tegn en bue til munden.' },
      { shapes: [{ kind: 'ellipse', cx: 240, cy: 840, rx: 120, ry: 50 }, { kind: 'ellipse', cx: 760, cy: 840, rx: 120, ry: 50 }], line: 'Tegn to ovaler til fødderne.' },
    ],
  },
  {
    id: 'mariehoene',
    name: 'Mariehøne',
    family: 'dyr',
    alive: 'fly-up',
    doneLine: 'Se, mariehønen flyver!',
    steps: [
      { shapes: [circle(500, 580, 300)], line: 'Tegn en stor cirkel til mariehønens krop.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 290, r: 130, from: 180, to: 360 }], line: 'Tegn en bue til hovedet.' },
      { shapes: [line(500, 300, 500, 880)], line: 'Tegn en lang streg midt på kroppen.' },
      { shapes: [circle(365, 480, 48), circle(635, 480, 48), circle(375, 700, 48), circle(625, 700, 48)], line: 'Tegn fire små cirkler til prikkerne.' },
      { shapes: [line(445, 172, 370, 60), line(555, 172, 630, 60)], line: 'Tegn to streger til følehornene.' },
    ],
  },
  {
    id: 'bi',
    name: 'Bi',
    family: 'dyr',
    alive: 'flap',
    doneLine: 'Se, bien flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 480, cy: 600, rx: 260, ry: 170 }], line: 'Tegn en stor oval til biens krop.' },
      { shapes: [{ kind: 'curve', pts: [420, 445, 455, 600, 420, 755] }, { kind: 'curve', pts: [570, 440, 605, 600, 570, 760] }], line: 'Tegn to buede streger på kroppen.' },
      { shapes: [{ kind: 'ellipse', cx: 370, cy: 290, rx: 90, ry: 125 }, { kind: 'ellipse', cx: 600, cy: 290, rx: 90, ry: 125 }], line: 'Tegn to ovaler til vingerne.' },
      { shapes: [circle(310, 570, 32)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'poly', pts: [730, 550, 870, 600, 730, 650], closed: true }], line: 'Tegn en lille trekant til brodden.' },
    ],
  },
  {
    id: 'pingvin',
    name: 'Pingvin',
    family: 'dyr',
    alive: 'sway',
    doneLine: 'Se, pingvinen vralter!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 560, rx: 230, ry: 330 }], line: 'Tegn en stor oval til pingvinens krop.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 650, rx: 140, ry: 210 }], line: 'Tegn en oval til maven.' },
      { shapes: [circle(440, 320, 28), circle(560, 320, 28)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'poly', pts: [455, 370, 545, 370, 500, 425], closed: true }], line: 'Tegn en lille trekant til næbbet.' },
      { shapes: [{ kind: 'curve', pts: [275, 450, 160, 600, 300, 760] }], line: 'Tegn en bue til vingen. Den anden vinge kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'ellipse', cx: 400, cy: 905, rx: 75, ry: 38 }, { kind: 'ellipse', cx: 600, cy: 905, rx: 75, ry: 38 }], line: 'Tegn to ovaler til fødderne.' },
    ],
  },
  {
    id: 'elefant',
    name: 'Elefant',
    family: 'dyr',
    alive: 'sway',
    doneLine: 'Se, elefanten danser!',
    steps: [
      { shapes: [circle(500, 430, 200)], line: 'Tegn en stor cirkel til elefantens hoved.' },
      { shapes: [circle(225, 420, 150), circle(775, 420, 150)], line: 'Tegn to store cirkler til ørerne.' },
      { shapes: [circle(430, 380, 32), circle(570, 380, 32)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'curve', pts: [500, 500, 480, 760, 600, 880, 680, 800] }], line: 'Tegn en lang buet streg til snablen.' },
    ],
  },
  {
    id: 'hval',
    name: 'Hval',
    family: 'dyr',
    alive: 'swim',
    doneLine: 'Se, hvalen svømmer!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 450, cy: 590, rx: 330, ry: 190 }], line: 'Tegn en stor oval til hvalens krop.' },
      { shapes: [{ kind: 'poly', pts: [770, 570, 900, 380, 960, 590], closed: true }], line: 'Tegn en trekant til halen.' },
      { shapes: [circle(260, 560, 32)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [{ kind: 'curve', pts: [180, 650, 300, 710, 430, 670] }], line: 'Tegn en bue til munden.' },
      { shapes: [line(360, 350, 280, 180), line(420, 340, 420, 150), line(480, 350, 560, 180)], line: 'Tegn tre streger til vandsprøjtet.' },
      { shapes: [{ kind: 'curve', pts: [40, 890, 160, 840, 280, 890, 400, 840, 520, 890, 640, 840, 760, 890, 880, 840, 960, 880] }], line: 'Tegn en bølget streg til havet.' },
    ],
  },
  // ----- Steder ------------------------------------------------------------------------------------
  {
    id: 'hus',
    name: 'Hus med sol',
    family: 'steder',
    alive: 'hop',
    doneLine: 'Se, huset hopper!',
    steps: [
      { shapes: [rect(200, 480, 640, 880)], line: 'Tegn en stor firkant til huset.' },
      { shapes: [{ kind: 'poly', pts: [170, 480, 420, 230, 670, 480] }], line: 'Tegn en trekant til taget.' },
      { shapes: [{ kind: 'poly', pts: [370, 880, 370, 700, 470, 700, 470, 880] }], line: 'Tegn en lille firkant til døren.' },
      { shapes: [rect(250, 560, 330, 640)], line: 'Tegn en lille firkant til vinduet.' },
      { shapes: [circle(820, 200, 90)], line: 'Tegn en cirkel til solen.' },
      { shapes: rays(820, 200, 120, 180), line: 'Tegn små streger rundt om solen.' },
    ],
  },
  {
    id: 'bjerge',
    name: 'Bjerge',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på bjergene!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [80, 800, 400, 250, 720, 800] }], line: 'Tegn en stor trekant til bjerget.' },
      { shapes: [{ kind: 'poly', pts: [540, 800, 740, 430, 940, 800] }], line: 'Tegn en mindre trekant til et bjerg mere.' },
      { shapes: [{ kind: 'poly', pts: [312, 400, 355, 440, 400, 400, 445, 440, 488, 400] }], line: 'Tegn en takket streg til sneen på toppen.' },
      { shapes: [circle(830, 190, 80)], line: 'Tegn en cirkel til solen.' },
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til jorden.' },
    ],
  },
  {
    id: 'havet',
    name: 'Havet med båd',
    family: 'steder',
    alive: 'swim',
    doneLine: 'Se, båden sejler!',
    steps: [
      { shapes: [{ kind: 'curve', pts: [40, 720, 160, 660, 280, 720, 400, 660, 520, 720, 640, 660, 760, 720, 880, 660, 960, 710] }], line: 'Tegn en bølget streg til havet.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 540, r: 200, from: 0, to: 180 }, line(300, 540, 700, 540)], line: 'Tegn en bue til båden.' },
      { shapes: [line(500, 540, 500, 170)], line: 'Tegn en lang streg til masten.' },
      { shapes: [{ kind: 'poly', pts: [515, 190, 515, 500, 720, 500], closed: true }], line: 'Tegn en trekant til sejlet.' },
      { shapes: [circle(180, 180, 80)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'skov',
    name: 'Skov',
    family: 'steder',
    alive: 'sway',
    doneLine: 'Se, træerne svajer i vinden!',
    steps: [
      { shapes: [line(40, 860, 960, 860)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [line(255, 610, 255, 860), line(325, 610, 325, 860)], line: 'Tegn to streger til træstammen.' },
      { shapes: [circle(290, 420, 190)], line: 'Tegn en stor cirkel til trækronen.' },
      { shapes: [{ kind: 'poly', pts: [550, 760, 730, 280, 910, 760], closed: true }], line: 'Tegn en stor trekant til grantræet.' },
      { shapes: [line(730, 760, 730, 860)], line: 'Tegn en kort streg til stammen.' },
      { shapes: [circle(860, 140, 70)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'strand',
    name: 'Strand',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på stranden!',
    steps: [
      { shapes: [line(40, 820, 960, 820)], line: 'Tegn en lang streg til stranden.' },
      { shapes: [{ kind: 'curve', pts: [560, 640, 640, 590, 720, 640, 800, 590, 880, 640, 960, 600] }], line: 'Tegn en bølget streg til havet.' },
      { shapes: [{ kind: 'arc', cx: 290, cy: 440, r: 210, from: 180, to: 360 }, line(80, 440, 500, 440)], line: 'Tegn en bue til parasollen.' },
      { shapes: [line(290, 440, 290, 820)], line: 'Tegn en lang streg til parasollens stok.' },
      { shapes: [circle(790, 230, 80)], line: 'Tegn en cirkel til solen.' },
      { shapes: rays(790, 230, 115, 170), line: 'Tegn små streger rundt om solen.' },
    ],
  },
  {
    id: 'fyrtaarn',
    name: 'Fyrtårn',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, fyrtårnet lyser!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [390, 780, 440, 340, 560, 340, 610, 780], closed: true }], line: 'Tegn en høj firkant til fyrtårnet.' },
      { shapes: [rect(440, 220, 560, 340)], line: 'Tegn en lille firkant til lampen.' },
      { shapes: [{ kind: 'poly', pts: [420, 220, 500, 110, 580, 220] }], line: 'Tegn en trekant til taget.' },
      { shapes: [line(600, 250, 820, 180), line(600, 310, 820, 380), line(400, 250, 180, 180), line(400, 310, 180, 380)], line: 'Tegn fire lange streger til lyset.' },
      { shapes: [{ kind: 'curve', pts: [40, 880, 160, 830, 280, 880, 400, 830, 520, 880, 640, 830, 760, 880, 880, 830, 960, 870] }], line: 'Tegn en bølget streg til havet.' },
    ],
  },
  {
    id: 'telt',
    name: 'Telt',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, månen skinner på teltet!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [140, 800, 430, 320, 720, 800] }], line: 'Tegn en stor trekant til teltet.' },
      { shapes: [{ kind: 'poly', pts: [350, 800, 430, 590, 510, 800] }], line: 'Tegn en lille trekant til døren.' },
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [{ kind: 'arc', cx: 820, cy: 210, r: 110, from: 70, to: 290 }, { kind: 'arc', cx: 880, cy: 210, r: 105, from: 102, to: 258 }], line: 'Tegn to buer til månen.' },
      { shapes: [star(190, 200, 90, 40)], line: 'Tegn en stjerne på himlen.' },
    ],
  },
  {
    id: 'regnbue',
    name: 'Regnbue',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, regnbuen skinner!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 500, cy: 700, r: 400, from: 180, to: 360 }], line: 'Tegn en stor bue til regnbuen.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 700, r: 280, from: 180, to: 360 }], line: 'Tegn en mindre bue indeni.' },
      { shapes: [{ kind: 'ellipse', cx: 160, cy: 730, rx: 120, ry: 70 }, { kind: 'ellipse', cx: 840, cy: 730, rx: 120, ry: 70 }], line: 'Tegn to ovaler til skyerne.' },
      { shapes: [circle(830, 160, 80)], line: 'Tegn en cirkel til solen.' },
      { shapes: [line(40, 870, 960, 870)], line: 'Tegn en lang streg til jorden.' },
    ],
  },
  {
    id: 'by',
    name: 'By',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på byen!',
    steps: [
      { shapes: [rect(120, 340, 370, 860)], line: 'Tegn en høj firkant til et hus.' },
      { shapes: [rect(430, 540, 640, 860)], line: 'Tegn en lav firkant til et hus mere.' },
      { shapes: [rect(700, 260, 900, 860)], line: 'Tegn en høj firkant til et hus mere.' },
      { shapes: [rect(165, 410, 235, 480), rect(265, 410, 335, 480), rect(500, 610, 570, 680), rect(765, 330, 835, 400)], line: 'Tegn små firkanter til vinduerne.' },
      { shapes: [circle(540, 220, 80)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'oe',
    name: 'Ø med palme',
    family: 'steder',
    alive: 'sway',
    doneLine: 'Se, palmen svajer i vinden!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 740, rx: 320, ry: 80 }], line: 'Tegn en lang oval til øen.' },
      { shapes: [{ kind: 'curve', pts: [40, 910, 160, 860, 280, 910, 400, 860, 520, 910, 640, 860, 760, 910, 880, 860, 960, 900] }], line: 'Tegn en bølget streg til havet.' },
      { shapes: [line(455, 665, 505, 330), line(535, 665, 585, 330)], line: 'Tegn to streger til træstammen.' },
      {
        shapes: [
          { kind: 'curve', pts: [545, 320, 400, 220, 270, 340] },
          { kind: 'curve', pts: [545, 320, 450, 160, 320, 130] },
          { kind: 'curve', pts: [545, 320, 650, 160, 780, 140] },
          { kind: 'curve', pts: [545, 320, 700, 220, 820, 340] },
        ],
        line: 'Tegn fire buer til palmebladene.',
      },
      { shapes: [circle(150, 170, 75)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'moelle',
    name: 'Mølle',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på møllen!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [380, 880, 420, 450, 580, 450, 620, 880], closed: true }], line: 'Tegn en høj firkant til møllen.' },
      { shapes: [line(285, 165, 715, 595), line(715, 165, 285, 595)], line: 'Tegn to lange streger til vingerne.' },
      { shapes: [circle(500, 380, 45)], line: 'Tegn en lille cirkel midt på vingerne.' },
      { shapes: [{ kind: 'poly', pts: [455, 880, 455, 760, 545, 760, 545, 880] }], line: 'Tegn en lille firkant til døren.' },
      { shapes: [line(40, 880, 960, 880)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [circle(840, 160, 75)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'gaard',
    name: 'Bondegård',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på gården!',
    steps: [
      { shapes: [rect(220, 480, 780, 860)], line: 'Tegn en stor firkant til laden.' },
      { shapes: [{ kind: 'poly', pts: [180, 480, 500, 220, 820, 480] }], line: 'Tegn en trekant til taget.' },
      { shapes: [{ kind: 'poly', pts: [390, 860, 390, 620, 610, 620, 610, 860] }], line: 'Tegn en stor firkant til porten.' },
      { shapes: [line(390, 620, 610, 860), line(610, 620, 390, 860)], line: 'Tegn to streger på porten.' },
      { shapes: [circle(500, 380, 50)], line: 'Tegn en lille cirkel til vinduet.' },
      { shapes: [circle(850, 170, 75)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'iglo',
    name: 'Iglo',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, månen skinner på igloen!',
    steps: [
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [{ kind: 'arc', cx: 460, cy: 800, r: 330, from: 180, to: 360 }], line: 'Tegn en stor bue til igloen.' },
      { shapes: [line(180, 650, 740, 650)], line: 'Tegn en lang streg på igloen.' },
      { shapes: [{ kind: 'arc', cx: 460, cy: 800, r: 100, from: 180, to: 360 }], line: 'Tegn en lille bue til døren.' },
      { shapes: [{ kind: 'arc', cx: 820, cy: 210, r: 110, from: 70, to: 290 }, { kind: 'arc', cx: 880, cy: 210, r: 105, from: 102, to: 258 }], line: 'Tegn to buer til månen.' },
      { shapes: [star(190, 200, 90, 40)], line: 'Tegn en stjerne på himlen.' },
    ],
  },
  {
    id: 'legeplads',
    name: 'Legeplads',
    family: 'steder',
    alive: 'sway',
    doneLine: 'Se, gyngen gynger!',
    steps: [
      { shapes: [line(200, 880, 300, 250), line(300, 250, 700, 250), line(700, 250, 800, 880)], line: 'Tegn tre streger til stativet.' },
      { shapes: [line(420, 250, 420, 640), line(580, 250, 580, 640)], line: 'Tegn to streger til snorene.' },
      { shapes: [rect(370, 640, 630, 710)], line: 'Tegn en lille firkant til sædet.' },
      { shapes: [line(40, 880, 960, 880)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [circle(860, 140, 70)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'nat',
    name: 'Stjernenat',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, stjernerne skinner!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 320, cy: 320, r: 190, from: 70, to: 290 }, { kind: 'arc', cx: 420, cy: 320, r: 180, from: 102, to: 258 }], line: 'Tegn to buer til månen.' },
      { shapes: [star(740, 210, 120, 52)], line: 'Tegn en stjerne på himlen.' },
      { shapes: [star(720, 560, 90, 40)], line: 'Tegn en stjerne mere på himlen.' },
      { shapes: [{ kind: 'ellipse', cx: 260, cy: 660, rx: 140, ry: 65 }], line: 'Tegn en oval til skyen.' },
      { shapes: [{ kind: 'curve', pts: [40, 880, 270, 760, 500, 880, 730, 760, 960, 870] }], line: 'Tegn en bølget streg til bakkerne.' },
    ],
  },
  {
    id: 'oerken',
    name: 'Ørken',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på ørkenen!',
    steps: [
      { shapes: [line(40, 820, 960, 820)], line: 'Tegn en lang streg til jorden.' },
      { shapes: [{ kind: 'poly', pts: [120, 820, 400, 380, 680, 820] }], line: 'Tegn en stor trekant til pyramiden.' },
      { shapes: [{ kind: 'ellipse', cx: 830, cy: 640, rx: 55, ry: 180 }], line: 'Tegn en lang oval til kaktussen.' },
      { shapes: [{ kind: 'curve', pts: [775, 660, 700, 650, 710, 540] }, { kind: 'curve', pts: [885, 610, 955, 600, 945, 500] }], line: 'Tegn to buer til armene.' },
      { shapes: [circle(190, 190, 75)], line: 'Tegn en cirkel til solen.' },
      { shapes: rays(190, 190, 105, 150), line: 'Tegn små streger rundt om solen.' },
    ],
  },
  {
    id: 'pariserhjul',
    name: 'Pariserhjul',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, pariserhjulet lyser!',
    steps: [
      { shapes: [circle(500, 420, 300)], line: 'Tegn en stor cirkel til hjulet.' },
      { shapes: [circle(500, 420, 50)], line: 'Tegn en lille cirkel midt i hjulet.' },
      {
        shapes: [line(561, 455, 747, 563), line(500, 490, 500, 705), line(439, 455, 253, 563), line(439, 385, 253, 278), line(500, 350, 500, 135), line(561, 385, 747, 278)],
        line: 'Tegn seks streger fra midten ud til kanten.',
      },
      { shapes: [line(475, 463, 230, 880), line(525, 463, 770, 880)], line: 'Tegn to lange streger til stativet.' },
      { shapes: [line(40, 880, 960, 880)], line: 'Tegn en lang streg til jorden.' },
    ],
  },
  {
    id: 'bro',
    name: 'Bro',
    family: 'steder',
    alive: 'glow',
    doneLine: 'Se, solen skinner på broen!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 500, cy: 780, r: 300, from: 180, to: 360 }], line: 'Tegn en stor bue til broen.' },
      { shapes: [line(60, 480, 940, 480)], line: 'Tegn en lang streg til vejen.' },
      { shapes: [{ kind: 'curve', pts: [40, 850, 160, 800, 280, 850, 400, 800, 520, 850, 640, 800, 760, 850, 880, 800, 960, 840] }], line: 'Tegn en bølget streg til vandet.' },
      { shapes: [circle(820, 190, 75)], line: 'Tegn en cirkel til solen.' },
      { shapes: [{ kind: 'ellipse', cx: 250, cy: 200, rx: 130, ry: 65 }], line: 'Tegn en oval til skyen.' },
    ],
  },
  // ----- Ting --------------------------------------------------------------------------------------
  {
    id: 'raket',
    name: 'Raket',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, raketten flyver!',
    steps: [
      { shapes: [rect(410, 330, 590, 720)], line: 'Tegn en høj firkant til raketten.' },
      { shapes: [{ kind: 'poly', pts: [410, 330, 500, 140, 590, 330] }], line: 'Tegn en trekant til spidsen.' },
      { shapes: [circle(500, 440, 55)], line: 'Tegn en cirkel til vinduet.' },
      { shapes: [{ kind: 'poly', pts: [410, 560, 300, 740, 410, 720] }, { kind: 'poly', pts: [590, 560, 700, 740, 590, 720] }], line: 'Tegn to trekanter til vingerne.' },
      { shapes: [{ kind: 'poly', pts: [430, 730, 460, 860, 500, 780, 540, 860, 570, 730] }], line: 'Tegn en takket streg til ilden.' },
    ],
  },
  {
    id: 'bil',
    name: 'Bil',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, bilen kører!',
    steps: [
      { shapes: [rect(120, 500, 880, 690)], line: 'Tegn en lang firkant til bilen.' },
      { shapes: [{ kind: 'poly', pts: [270, 500, 340, 330, 660, 330, 730, 500] }], line: 'Tegn taget ovenpå bilen.' },
      { shapes: [circle(290, 700, 85), circle(710, 700, 85)], line: 'Tegn to cirkler til hjulene.' },
      { shapes: [rect(380, 370, 620, 470)], line: 'Tegn en firkant til vinduet.' },
      { shapes: [line(40, 800, 960, 800)], line: 'Tegn en lang streg til vejen.' },
    ],
  },
  {
    id: 'blomst',
    name: 'Blomst',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, blomsten svajer i vinden!',
    steps: [
      { shapes: [circle(500, 330, 80)], line: 'Tegn en cirkel til blomstens midte.' },
      { shapes: petals(500, 330, 150, 70), line: 'Tegn fem små cirkler rundt om til kronbladene.' },
      { shapes: [line(500, 480, 500, 880)], line: 'Tegn en lang streg til stilken.' },
      { shapes: [{ kind: 'curve', pts: [505, 730, 600, 620, 730, 640, 640, 750, 505, 735] }], line: 'Tegn et blad på stilken.' },
      { shapes: [line(150, 880, 850, 880)], line: 'Tegn en streg til jorden.' },
    ],
  },
  {
    id: 'bold',
    name: 'Bold',
    family: 'ting',
    alive: 'hop',
    doneLine: 'Se, bolden hopper!',
    steps: [
      { shapes: [circle(500, 470, 300)], line: 'Tegn en stor cirkel til bolden.' },
      { shapes: [{ kind: 'curve', pts: [300, 250, 420, 470, 300, 690] }, { kind: 'curve', pts: [700, 250, 580, 470, 700, 690] }], line: 'Tegn to buede streger på bolden.' },
      { shapes: [line(500, 170, 500, 770)], line: 'Tegn en lang streg midt på bolden.' },
      { shapes: [line(150, 880, 850, 880)], line: 'Tegn en streg til jorden.' },
    ],
  },
  {
    id: 'tog',
    name: 'Tog',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, toget kører!',
    steps: [
      { shapes: [rect(100, 460, 560, 690)], line: 'Tegn en lang firkant til toget.' },
      { shapes: [{ kind: 'poly', pts: [380, 460, 380, 290, 560, 290, 560, 460] }], line: 'Tegn en høj firkant til førerhuset.' },
      { shapes: [{ kind: 'poly', pts: [170, 460, 170, 340, 250, 340, 250, 460] }], line: 'Tegn en lille firkant til skorstenen.' },
      { shapes: [rect(620, 500, 910, 690)], line: 'Tegn en firkant til vognen.' },
      { shapes: [circle(210, 730, 60), circle(450, 730, 60), circle(680, 730, 60), circle(850, 730, 60)], line: 'Tegn fire cirkler til hjulene.' },
      { shapes: [circle(225, 250, 45), circle(310, 150, 35)], line: 'Tegn to små cirkler til røgen.' },
    ],
  },
  {
    id: 'fly',
    name: 'Fly',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, flyet flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 520, rx: 380, ry: 95 }], line: 'Tegn en lang oval til flyets krop.' },
      { shapes: [{ kind: 'poly', pts: [400, 600, 300, 830, 540, 610] }], line: 'Tegn en trekant til vingen.' },
      { shapes: [{ kind: 'poly', pts: [175, 470, 150, 270, 290, 440] }], line: 'Tegn en trekant til halen.' },
      { shapes: [circle(570, 505, 30), circle(670, 505, 30), circle(770, 505, 30)], line: 'Tegn tre små cirkler til vinduerne.' },
      { shapes: [{ kind: 'ellipse', cx: 790, cy: 190, rx: 130, ry: 65 }], line: 'Tegn en oval til skyen.' },
    ],
  },
  {
    id: 'ballon',
    name: 'Luftballon',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, ballonen flyver op!',
    steps: [
      { shapes: [circle(500, 350, 260)], line: 'Tegn en stor cirkel til ballonen.' },
      { shapes: [{ kind: 'curve', pts: [430, 105, 330, 350, 430, 595] }, { kind: 'curve', pts: [570, 105, 670, 350, 570, 595] }], line: 'Tegn to buede streger på ballonen.' },
      { shapes: [line(330, 550, 420, 760), line(670, 550, 580, 760)], line: 'Tegn to streger til snorene.' },
      { shapes: [rect(400, 760, 600, 890)], line: 'Tegn en lille firkant til kurven.' },
      { shapes: [{ kind: 'ellipse', cx: 160, cy: 720, rx: 110, ry: 60 }], line: 'Tegn en oval til skyen.' },
    ],
  },
  {
    id: 'is',
    name: 'Is',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, isen danser!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [310, 530, 690, 530, 500, 920], closed: true }], line: 'Tegn en stor trekant til vaflen.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 530, r: 210, from: 180, to: 360 }], line: 'Tegn en stor bue til iskuglen.' },
      { shapes: [circle(500, 255, 50)], line: 'Tegn en lille cirkel til kirsebærret.' },
      { shapes: [line(390, 450, 420, 500), line(480, 400, 510, 450), line(580, 450, 610, 500)], line: 'Tegn tre små streger på isen.' },
    ],
  },
  {
    id: 'paraply',
    name: 'Paraply',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, paraplyen svajer i vinden!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 500, cy: 480, r: 320, from: 180, to: 360 }], line: 'Tegn en stor bue til paraplyen.' },
      { shapes: [{ kind: 'curve', pts: [180, 480, 260, 420, 340, 480, 420, 420, 500, 480, 580, 420, 660, 480, 740, 420, 820, 480] }], line: 'Tegn en bølget streg under buen.' },
      { shapes: [line(500, 470, 500, 820)], line: 'Tegn en lang streg til skaftet.' },
      { shapes: [{ kind: 'arc', cx: 435, cy: 820, r: 65, from: 0, to: 180 }], line: 'Tegn en lille bue til håndtaget.' },
      { shapes: [circle(140, 180, 32), circle(860, 170, 32), circle(240, 90, 32)], line: 'Tegn tre små cirkler til regndråberne.' },
    ],
  },
  {
    id: 'snemand',
    name: 'Snemand',
    family: 'ting',
    alive: 'sway',
    doneLine: 'Se, snemanden danser!',
    steps: [
      { shapes: [circle(500, 700, 200)], line: 'Tegn en stor cirkel til snemandens krop.' },
      { shapes: [circle(500, 360, 130)], line: 'Tegn en cirkel til hovedet.' },
      { shapes: [rect(400, 90, 600, 220)], line: 'Tegn en firkant til hatten.' },
      { shapes: [circle(450, 325, 28), circle(550, 325, 28)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'poly', pts: [490, 380, 620, 405, 490, 430], closed: true }], line: 'Tegn en lille trekant til næsen.' },
      { shapes: [circle(500, 600, 32), circle(500, 700, 32), circle(500, 800, 32)], line: 'Tegn tre små cirkler til knapperne.' },
    ],
  },
  {
    id: 'kage',
    name: 'Lagkage',
    family: 'ting',
    alive: 'glow',
    doneLine: 'Se, lysene skinner!',
    steps: [
      { shapes: [rect(200, 520, 800, 860)], line: 'Tegn en stor firkant til kagen.' },
      { shapes: [{ kind: 'curve', pts: [200, 640, 275, 700, 350, 640, 425, 700, 500, 640, 575, 700, 650, 640, 725, 700, 800, 640] }], line: 'Tegn en bølget streg på kagen.' },
      { shapes: [line(330, 510, 330, 360), line(500, 510, 500, 360), line(670, 510, 670, 360)], line: 'Tegn tre streger til lysene.' },
      { shapes: [circle(330, 305, 38), circle(500, 305, 38), circle(670, 305, 38)], line: 'Tegn tre små cirkler til flammerne.' },
      { shapes: [line(100, 900, 900, 900)], line: 'Tegn en lang streg til bordet.' },
    ],
  },
  {
    id: 'bus',
    name: 'Bus',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, bussen kører!',
    steps: [
      { shapes: [rect(100, 330, 900, 720)], line: 'Tegn en lang firkant til bussen.' },
      { shapes: [rect(160, 400, 290, 520), rect(340, 400, 470, 520), rect(520, 400, 650, 520)], line: 'Tegn små firkanter til vinduerne.' },
      { shapes: [{ kind: 'poly', pts: [720, 720, 720, 400, 840, 400, 840, 720] }], line: 'Tegn en høj firkant til døren.' },
      { shapes: [circle(270, 730, 85), circle(590, 730, 85)], line: 'Tegn to cirkler til hjulene.' },
      { shapes: [line(40, 860, 960, 860)], line: 'Tegn en lang streg til vejen.' },
    ],
  },
  {
    id: 'cykel',
    name: 'Cykel',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, cyklen kører!',
    steps: [
      { shapes: [circle(250, 650, 150), circle(750, 650, 150)], line: 'Tegn to cirkler til hjulene.' },
      { shapes: [{ kind: 'poly', pts: [250, 650, 490, 650, 410, 420], closed: true }], line: 'Tegn en trekant til stellet.' },
      { shapes: [line(410, 420, 680, 420), line(680, 420, 750, 650)], line: 'Tegn to streger til forhjulet.' },
      { shapes: [{ kind: 'ellipse', cx: 390, cy: 355, rx: 80, ry: 35 }], line: 'Tegn en lille oval til sadlen.' },
      { shapes: [line(680, 420, 640, 300)], line: 'Tegn en kort streg til styret.' },
      { shapes: [line(40, 840, 960, 840)], line: 'Tegn en lang streg til vejen.' },
    ],
  },
  {
    id: 'papirdrage',
    name: 'Papirdrage',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, papirdragen flyver op!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [500, 80, 720, 330, 500, 640, 280, 330], closed: true }], line: 'Tegn en stor firkant til papirdragen.' },
      { shapes: [line(500, 80, 500, 640), line(280, 330, 720, 330)], line: 'Tegn to streger på papirdragen.' },
      { shapes: [{ kind: 'curve', pts: [500, 640, 400, 720, 540, 800, 420, 900] }], line: 'Tegn en lang bølget streg til halen.' },
      { shapes: [{ kind: 'ellipse', cx: 790, cy: 760, rx: 130, ry: 65 }], line: 'Tegn en oval til skyen.' },
      { shapes: [circle(150, 160, 75)], line: 'Tegn en cirkel til solen.' },
    ],
  },
  {
    id: 'traktor',
    name: 'Traktor',
    family: 'ting',
    alive: 'drive',
    doneLine: 'Se, traktoren kører!',
    steps: [
      { shapes: [rect(150, 480, 780, 680)], line: 'Tegn en lang firkant til traktoren.' },
      { shapes: [{ kind: 'poly', pts: [200, 480, 200, 220, 470, 220, 470, 480] }], line: 'Tegn en høj firkant til førerhuset.' },
      { shapes: [rect(250, 270, 420, 400)], line: 'Tegn en lille firkant til vinduet.' },
      { shapes: [circle(320, 700, 180)], line: 'Tegn en stor cirkel til baghjulet.' },
      { shapes: [circle(680, 760, 110)], line: 'Tegn en lille cirkel til forhjulet.' },
      { shapes: [{ kind: 'poly', pts: [600, 480, 600, 330, 690, 330, 690, 480] }], line: 'Tegn en lille firkant til skorstenen.' },
    ],
  },
  {
    id: 'gave',
    name: 'Gave',
    family: 'ting',
    alive: 'hop',
    doneLine: 'Se, gaven hopper!',
    steps: [
      { shapes: [rect(220, 430, 780, 880)], line: 'Tegn en stor firkant til gaven.' },
      { shapes: [rect(180, 330, 820, 430)], line: 'Tegn en lang firkant til låget.' },
      { shapes: [line(500, 330, 500, 880)], line: 'Tegn en lang streg midt på gaven.' },
      { shapes: [{ kind: 'ellipse', cx: 390, cy: 250, rx: 100, ry: 65 }, { kind: 'ellipse', cx: 610, cy: 250, rx: 100, ry: 65 }], line: 'Tegn to ovaler til sløjfen.' },
    ],
  },
  {
    id: 'helikopter',
    name: 'Helikopter',
    family: 'ting',
    alive: 'fly-up',
    doneLine: 'Se, helikopteren flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 420, cy: 500, rx: 230, ry: 160 }], line: 'Tegn en stor oval til helikopterens krop.' },
      { shapes: [{ kind: 'poly', pts: [645, 450, 930, 490, 645, 550], closed: true }], line: 'Tegn en lang trekant til halen.' },
      { shapes: [line(100, 315, 740, 315)], line: 'Tegn en lang streg til propellen.' },
      { shapes: [circle(320, 470, 75)], line: 'Tegn en cirkel til vinduet.' },
      { shapes: [line(340, 650, 320, 780), line(500, 650, 520, 780)], line: 'Tegn to streger til benene.' },
      { shapes: [line(180, 780, 660, 780)], line: 'Tegn en lang streg under helikopteren.' },
    ],
  },
  {
    id: 'ubaad',
    name: 'Ubåd',
    family: 'ting',
    alive: 'swim',
    doneLine: 'Se, ubåden sejler!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 480, cy: 580, rx: 380, ry: 150 }], line: 'Tegn en lang oval til ubåden.' },
      { shapes: [{ kind: 'poly', pts: [380, 440, 380, 320, 560, 320, 560, 440] }], line: 'Tegn en lille firkant til tårnet.' },
      { shapes: [{ kind: 'poly', pts: [470, 320, 470, 190, 570, 190] }], line: 'Tegn en streg til kikkerten.' },
      { shapes: [circle(300, 590, 38), circle(470, 590, 38), circle(640, 590, 38)], line: 'Tegn tre små cirkler til vinduerne.' },
      { shapes: [{ kind: 'poly', pts: [855, 580, 950, 500, 950, 660], closed: true }], line: 'Tegn en trekant til halen.' },
      { shapes: [circle(150, 370, 30), circle(110, 270, 24)], line: 'Tegn to små cirkler til boblerne.' },
    ],
  },
  // ----- Fantasi -----------------------------------------------------------------------------------
  {
    id: 'drage',
    name: 'Drage',
    family: 'fantasi',
    alive: 'sway',
    doneLine: 'Se, dragen danser!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 420, cy: 640, rx: 240, ry: 140 }], line: 'Tegn en stor oval til dragens krop.' },
      { shapes: [{ kind: 'curve', pts: [585, 555, 650, 470, 640, 350] }, { kind: 'curve', pts: [655, 625, 745, 520, 745, 360] }], line: 'Tegn to buede streger til den lange hals.' },
      { shapes: [{ kind: 'ellipse', cx: 720, cy: 295, rx: 115, ry: 72 }], line: 'Tegn en oval til hovedet.' },
      { shapes: [{ kind: 'poly', pts: [250, 545, 290, 465, 335, 520, 380, 445, 425, 505, 470, 435, 515, 510] }], line: 'Tegn en takket streg til piggene på ryggen.' },
      { shapes: [{ kind: 'curve', pts: [185, 670, 90, 730, 50, 610] }, { kind: 'poly', pts: [30, 650, 50, 570, 100, 620] }], line: 'Tegn en lang bue til halen.' },
      { shapes: [line(340, 770, 340, 880), line(510, 770, 510, 880)], line: 'Tegn to streger til benene.' },
    ],
  },
  {
    id: 'robot',
    name: 'Robot',
    family: 'fantasi',
    alive: 'hop',
    doneLine: 'Se, robotten hopper!',
    steps: [
      { shapes: [rect(330, 440, 670, 770)], line: 'Tegn en stor firkant til robottens krop.' },
      { shapes: [rect(380, 170, 620, 400)], line: 'Tegn en firkant til hovedet.' },
      { shapes: [circle(440, 275, 38)], line: 'Tegn en cirkel til øjet. Det andet øje kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [330, 480, 190, 600, 230, 700] }], line: 'Tegn en streg til armen.', mirror: true },
      { shapes: [rect(380, 770, 460, 920)], line: 'Tegn en firkant til benet.', mirror: true },
      { shapes: [line(500, 170, 500, 90), circle(500, 66, 24)], line: 'Tegn en streg og en prik til antennen.' },
    ],
  },
  {
    id: 'slot',
    name: 'Slot',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, slottet lyser op!',
    steps: [
      { shapes: [rect(300, 460, 700, 860)], line: 'Tegn en stor firkant til slottet.' },
      { shapes: [rect(150, 320, 300, 860)], line: 'Tegn en høj firkant til tårnet. Det andet tårn kommer af sig selv.', mirror: true },
      { shapes: [{ kind: 'poly', pts: [130, 320, 225, 150, 320, 320] }], line: 'Tegn en trekant til taget på tårnet.', mirror: true },
      { shapes: [{ kind: 'arc', cx: 500, cy: 760, r: 90, from: 180, to: 360 }, line(410, 760, 410, 860), line(590, 760, 590, 860)], line: 'Tegn en port med en bue.' },
      { shapes: [{ kind: 'poly', pts: [225, 150, 225, 70, 300, 95, 225, 120] }], line: 'Tegn et lille flag på toppen.', mirror: true },
    ],
  },
  {
    id: 'enhjoerning',
    name: 'Enhjørning',
    family: 'fantasi',
    alive: 'hop',
    doneLine: 'Se, enhjørningen hopper!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 610, rx: 200, ry: 270 }], line: 'Tegn en stor oval til enhjørningens hoved.' },
      { shapes: [{ kind: 'poly', pts: [455, 345, 500, 70, 545, 345] }], line: 'Tegn en lang trekant til hornet.' },
      { shapes: [{ kind: 'poly', pts: [330, 470, 245, 330, 375, 400] }, { kind: 'poly', pts: [625, 400, 755, 330, 670, 470] }], line: 'Tegn to trekanter til ørerne.' },
      { shapes: [circle(420, 540, 38), circle(580, 540, 38)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [circle(445, 770, 28), circle(555, 770, 28)], line: 'Tegn to små cirkler til næseborene.' },
    ],
  },
  {
    id: 'ufo',
    name: 'Flyvende tallerken',
    family: 'fantasi',
    alive: 'fly-up',
    doneLine: 'Se, den flyvende tallerken flyver!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 560, rx: 380, ry: 110 }], line: 'Tegn en lang oval til den flyvende tallerken.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 475, r: 180, from: 180, to: 360 }], line: 'Tegn en bue til toppen.' },
      { shapes: [circle(500, 380, 50)], line: 'Tegn en lille cirkel til rumvæsenet.' },
      { shapes: [circle(320, 575, 30), circle(500, 600, 30), circle(680, 575, 30)], line: 'Tegn tre små cirkler til lysene.' },
      { shapes: [line(330, 660, 260, 820), line(670, 660, 740, 820)], line: 'Tegn to streger til benene.' },
    ],
  },
  {
    id: 'krone',
    name: 'Krone',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, kronen skinner!',
    steps: [
      { shapes: [rect(200, 600, 800, 760)], line: 'Tegn en lang firkant til kronen.' },
      { shapes: [{ kind: 'poly', pts: [200, 600, 200, 330, 350, 480, 500, 280, 650, 480, 800, 330, 800, 600] }], line: 'Tegn en takket streg til toppen.' },
      { shapes: [circle(330, 680, 38), circle(500, 680, 38), circle(670, 680, 38)], line: 'Tegn tre små cirkler til ædelstenene.' },
      { shapes: [circle(200, 280, 38), circle(500, 230, 38), circle(800, 280, 38)], line: 'Tegn tre små cirkler til perlerne.' },
    ],
  },
  {
    id: 'nisse',
    name: 'Nisse',
    family: 'fantasi',
    alive: 'sway',
    doneLine: 'Se, nissen danser!',
    steps: [
      { shapes: [circle(500, 480, 160)], line: 'Tegn en cirkel til nissens hoved.' },
      { shapes: [{ kind: 'poly', pts: [320, 400, 500, 120, 680, 400], closed: true }], line: 'Tegn en stor trekant til huen.' },
      { shapes: [circle(500, 75, 42)], line: 'Tegn en lille cirkel til kvasten.' },
      { shapes: [{ kind: 'curve', pts: [350, 560, 370, 810, 500, 900, 630, 810, 650, 560] }], line: 'Tegn en stor bue til skægget.' },
      { shapes: [circle(440, 465, 28), circle(560, 465, 28)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [circle(500, 550, 34)], line: 'Tegn en lille cirkel til næsen.' },
    ],
  },
  {
    id: 'piratskib',
    name: 'Piratskib',
    family: 'fantasi',
    alive: 'swim',
    doneLine: 'Se, piratskibet sejler!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [160, 570, 840, 570, 720, 730, 280, 730], closed: true }], line: 'Tegn en lang firkant til skibet.' },
      { shapes: [line(500, 570, 500, 150)], line: 'Tegn en lang streg til masten.' },
      { shapes: [rect(320, 210, 680, 470)], line: 'Tegn en stor firkant til sejlet.' },
      { shapes: [{ kind: 'poly', pts: [500, 150, 500, 70, 590, 95, 500, 120] }], line: 'Tegn et lille flag på toppen.' },
      { shapes: [{ kind: 'curve', pts: [40, 820, 160, 760, 280, 820, 400, 760, 520, 820, 640, 760, 760, 820, 880, 760, 960, 810] }], line: 'Tegn en bølget streg til havet.' },
    ],
  },
  {
    id: 'havfrue',
    name: 'Havfrue',
    family: 'fantasi',
    alive: 'swim',
    doneLine: 'Se, havfruen svømmer!',
    steps: [
      { shapes: [circle(500, 210, 110)], line: 'Tegn en cirkel til havfruens hoved.' },
      { shapes: [{ kind: 'curve', pts: [390, 130, 330, 210, 385, 290, 330, 370] }, { kind: 'curve', pts: [610, 130, 670, 210, 615, 290, 670, 370] }], line: 'Tegn to bølgede streger til håret.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 445, rx: 100, ry: 120 }], line: 'Tegn en oval til kroppen.' },
      { shapes: [{ kind: 'curve', pts: [420, 515, 440, 710, 500, 830] }, { kind: 'curve', pts: [580, 515, 560, 710, 500, 830] }], line: 'Tegn to buede streger til halen.' },
      { shapes: [{ kind: 'poly', pts: [500, 830, 380, 930, 620, 930], closed: true }], line: 'Tegn en trekant til halefinnen.' },
      { shapes: [line(405, 420, 270, 530), line(595, 420, 730, 530)], line: 'Tegn to streger til armene.' },
    ],
  },
  {
    id: 'fe',
    name: 'Fe',
    family: 'fantasi',
    alive: 'flap',
    doneLine: 'Se, feen flyver!',
    steps: [
      { shapes: [circle(500, 220, 100)], line: 'Tegn en cirkel til feens hoved.' },
      { shapes: [{ kind: 'poly', pts: [500, 330, 700, 800, 300, 800], closed: true }], line: 'Tegn en stor trekant til kjolen.' },
      { shapes: [{ kind: 'curve', pts: [455, 400, 330, 220, 140, 250, 160, 450, 455, 450] }], line: 'Tegn en stor vinge. Den anden vinge kommer af sig selv.', mirror: true },
      { shapes: [line(450, 490, 300, 600), line(550, 490, 700, 600)], line: 'Tegn to streger til armene.' },
      { shapes: [line(440, 800, 430, 910), line(560, 800, 570, 910)], line: 'Tegn to streger til benene.' },
      { shapes: [circle(460, 210, 26), circle(540, 210, 26)], line: 'Tegn to små cirkler til øjnene.' },
    ],
  },
  {
    id: 'tryllestav',
    name: 'Tryllestav',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, tryllestaven glimter!',
    steps: [
      { shapes: [star(540, 330, 240, 100)], line: 'Tegn en stor stjerne til tryllestaven.' },
      { shapes: [line(540, 430, 540, 920)], line: 'Tegn en lang streg til skaftet.' },
      { shapes: [circle(170, 200, 34), circle(880, 170, 34), circle(860, 620, 34)], line: 'Tegn tre små cirkler rundt om stjernen.' },
      { shapes: [star(220, 650, 100, 44)], line: 'Tegn en lille stjerne mere.' },
    ],
  },
  {
    id: 'rumvaesen',
    name: 'Rumvæsen',
    family: 'fantasi',
    alive: 'hop',
    doneLine: 'Se, rumvæsenet hopper!',
    steps: [
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 580, rx: 250, ry: 290 }], line: 'Tegn en stor oval til rumvæsenets hoved.' },
      { shapes: [circle(500, 510, 110)], line: 'Tegn en stor cirkel til øjet.' },
      { shapes: [circle(500, 510, 40)], line: 'Tegn en lille cirkel inde i øjet.' },
      { shapes: [line(410, 310, 330, 150), line(590, 310, 670, 150)], line: 'Tegn to streger til følehornene.' },
      { shapes: [circle(320, 110, 34), circle(680, 110, 34)], line: 'Tegn to små cirkler på følehornene.' },
      { shapes: [{ kind: 'curve', pts: [400, 710, 500, 790, 600, 710] }], line: 'Tegn en bue til munden.' },
    ],
  },
  {
    id: 'skattekiste',
    name: 'Skattekiste',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, skattekisten skinner!',
    steps: [
      { shapes: [rect(180, 500, 820, 800)], line: 'Tegn en stor firkant til kisten.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 705, r: 380, from: 212.6, to: 327.4 }], line: 'Tegn en bue til låget.' },
      { shapes: [rect(445, 460, 555, 580)], line: 'Tegn en lille firkant til låsen.' },
      { shapes: [line(310, 500, 310, 800), line(690, 500, 690, 800)], line: 'Tegn to streger på kisten.' },    ],
  },
  {
    id: 'planet',
    name: 'Planet',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, planeten skinner!',
    steps: [
      { shapes: [circle(500, 520, 230)], line: 'Tegn en stor cirkel til planeten.' },
      { shapes: [{ kind: 'ellipse', cx: 500, cy: 560, rx: 420, ry: 110 }], line: 'Tegn en lang oval til ringen.' },
      { shapes: [{ kind: 'curve', pts: [345, 380, 500, 430, 655, 380] }], line: 'Tegn en buet streg på planeten.' },
      { shapes: [circle(840, 170, 60)], line: 'Tegn en lille cirkel til månen.' },
      { shapes: [star(170, 170, 100, 44)], line: 'Tegn en stjerne på himlen.' },
    ],
  },
  {
    id: 'juletrae',
    name: 'Juletræ',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, juletræet lyser!',
    steps: [
      { shapes: [{ kind: 'poly', pts: [500, 210, 800, 780, 200, 780], closed: true }], line: 'Tegn en stor trekant til juletræet.' },
      { shapes: [{ kind: 'poly', pts: [445, 780, 445, 890, 555, 890, 555, 780] }], line: 'Tegn en lille firkant til stammen.' },
      { shapes: [star(500, 125, 85, 38)], line: 'Tegn en stjerne på toppen.' },
      { shapes: [circle(440, 460, 34), circle(570, 570, 34), circle(390, 680, 34), circle(640, 700, 34)], line: 'Tegn fire små cirkler til julekuglerne.' },
      { shapes: [rect(650, 800, 790, 920)], line: 'Tegn en lille firkant til gaven.' },
    ],
  },
  {
    id: 'prinsesse',
    name: 'Prinsesse',
    family: 'fantasi',
    alive: 'sway',
    doneLine: 'Se, prinsessen danser!',
    steps: [
      { shapes: [circle(500, 330, 130)], line: 'Tegn en cirkel til prinsessens hoved.' },
      { shapes: [{ kind: 'poly', pts: [400, 245, 400, 110, 450, 170, 500, 90, 550, 170, 600, 110, 600, 245] }], line: 'Tegn en takket streg til kronen.' },
      { shapes: [{ kind: 'curve', pts: [375, 260, 320, 350, 375, 440, 320, 530] }, { kind: 'curve', pts: [625, 260, 680, 350, 625, 440, 680, 530] }], line: 'Tegn to bølgede streger til håret.' },
      { shapes: [{ kind: 'poly', pts: [500, 480, 750, 900, 250, 900], closed: true }], line: 'Tegn en stor trekant til kjolen.' },
      { shapes: [circle(450, 320, 26), circle(550, 320, 26)], line: 'Tegn to små cirkler til øjnene.' },
      { shapes: [{ kind: 'curve', pts: [440, 385, 500, 430, 560, 385] }], line: 'Tegn en bue til munden.' },
    ],
  },
  {
    id: 'svampehus',
    name: 'Svampehus',
    family: 'fantasi',
    alive: 'glow',
    doneLine: 'Se, svampehuset lyser!',
    steps: [
      { shapes: [{ kind: 'arc', cx: 500, cy: 520, r: 360, from: 180, to: 360 }, line(140, 520, 860, 520)], line: 'Tegn en stor bue til taget.' },
      { shapes: [{ kind: 'poly', pts: [330, 520, 330, 880, 670, 880, 670, 520] }], line: 'Tegn en stor firkant til huset.' },
      { shapes: [{ kind: 'poly', pts: [450, 880, 450, 730, 550, 730, 550, 880] }], line: 'Tegn en lille firkant til døren.' },
      { shapes: [circle(400, 620, 38), circle(600, 620, 38)], line: 'Tegn to små cirkler til vinduerne.' },
      { shapes: [circle(320, 420, 45), circle(500, 290, 50), circle(680, 420, 45)], line: 'Tegn tre små cirkler til prikkerne.' },
    ],
  },
  {
    id: 'pirat',
    name: 'Pirat',
    family: 'fantasi',
    alive: 'sway',
    doneLine: 'Se, piraten danser!',
    steps: [
      { shapes: [circle(500, 580, 240)], line: 'Tegn en stor cirkel til piratens hoved.' },
      { shapes: [{ kind: 'arc', cx: 500, cy: 525, r: 325, from: 202.6, to: 337.4 }, line(160, 400, 840, 400)], line: 'Tegn en stor bue til hatten.' },
      { shapes: [circle(410, 540, 32)], line: 'Tegn en lille cirkel til øjet.' },
      { shapes: [circle(590, 540, 55), line(300, 440, 545, 520)], line: 'Tegn en streg og en cirkel til klappen.' },
      { shapes: [{ kind: 'curve', pts: [400, 690, 500, 760, 600, 690] }], line: 'Tegn en bue til munden.' },
    ],
  },
]

export const subjectById = (id: string | null | undefined): KreaSubject | undefined =>
  KREA_SUBJECTS.find((s) => s.id === id)

/** Every line Tegn med Mig can speak: each step, and each subject's done line. */
export function allSubjectLines(): string[] {
  const out: string[] = []
  for (const s of KREA_SUBJECTS) {
    for (const st of s.steps) out.push(st.line)
    out.push(s.doneLine)
  }
  return out
}
